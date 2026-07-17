import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { findWebDataStream } from '@/lib/ga4/setup';
import { createMeasurementProtocolSecret, listMeasurementProtocolSecrets } from '@/lib/ga4/api';
import { findBigQueryExport, findEventInBigQuery, type BigQueryExport } from './bigQuery';
import { pollRealtimeForEvents } from './ga4Realtime';
import { sendTestEvent, validateTestEventPayload, type MpValidationMessage } from './measurementProtocol';

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type StepValidationResult = {
  stepId: string;
  order: number;
  label: string;
  eventName: string | null;
  status: 'pass' | 'fail';
  mpAccepted: boolean;
  mpMessages: string[];
  realtimeConfirmed: boolean;
  bigQueryConfirmed: 'confirmed' | 'not_yet' | 'not_configured';
  detail: string;
};

export type ValidationRunResult = {
  id: string;
  source: 'ga4_realtime' | 'bigquery';
  overallPass: boolean;
  steps: StepValidationResult[];
};

export async function runValidation(userId: string, funnelId: string): Promise<ValidationRunResult> {
  const funnel = await prisma.funnel.findUnique({ where: { id: funnelId }, include: { steps: { orderBy: { order: 'asc' } } } });
  if (!funnel || funnel.ownerId !== userId) throw new ValidationError('Funnel not found', 404);
  if (funnel.status !== 'approved') throw new ValidationError('Approve this funnel before validating it.', 400);

  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection || !connection.ga4PropertyId) throw new ValidationError('Connect Google Analytics and select a property in Settings first.', 400);

  const ctx = { userId, funnelId };
  const refreshToken = connection.refreshToken;
  const propertyId = connection.ga4PropertyId;

  const stream = await findWebDataStream(ctx, refreshToken, propertyId);
  if (!stream?.name || !stream.webStreamData?.measurementId) {
    throw new ValidationError('This GA4 property has no web data stream yet — add one in GA4 Admin, then try again.', 400);
  }
  const measurementId = stream.webStreamData.measurementId;

  let secrets = await listMeasurementProtocolSecrets(ctx, refreshToken, stream.name);
  let secret = secrets.find((s) => s.displayName === 'Funnel Setuper validation');
  if (!secret) {
    secret = await createMeasurementProtocolSecret(ctx, refreshToken, stream.name, 'Funnel Setuper validation');
  }
  if (!secret.secretValue) throw new ValidationError('Could not obtain a Measurement Protocol secret for this data stream.', 502);
  const apiSecret = secret.secretValue;

  const bigQueryExport = await findBigQueryExport(ctx, refreshToken, propertyId);

  const stepsWithEvent = funnel.steps.filter((s) => s.ga4EventName);
  const validationRunId = crypto.randomUUID();
  const clientId = `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;

  const results: StepValidationResult[] = [];
  const eventsSent: { stepId: string; eventName: string }[] = [];

  for (const step of funnel.steps) {
    if (!step.ga4EventName) {
      results.push({
        stepId: step.id,
        order: step.order,
        label: step.label,
        eventName: null,
        status: 'fail',
        mpAccepted: false,
        mpMessages: [],
        realtimeConfirmed: false,
        bigQueryConfirmed: 'not_configured',
        detail: 'No GA4 event name set for this step yet — run GTM/GA4 setup first.',
      });
      continue;
    }

    const eventName = step.ga4EventName;
    let mpAccepted = false;
    let mpMessages: MpValidationMessage[] = [];
    try {
      const validation = await validateTestEventPayload(measurementId, apiSecret, eventName, clientId, validationRunId);
      mpAccepted = validation.ok;
      mpMessages = validation.messages;
      if (mpAccepted) {
        await sendTestEvent(measurementId, apiSecret, eventName, clientId, validationRunId);
        eventsSent.push({ stepId: step.id, eventName });
      }
    } catch (err) {
      mpMessages = [{ description: err instanceof Error ? err.message : 'Unknown error sending the test event.' }];
    }

    results.push({
      stepId: step.id,
      order: step.order,
      label: step.label,
      eventName,
      status: 'fail', // resolved below once realtime/BigQuery checks run
      mpAccepted,
      mpMessages: mpMessages.map((m) => m.description ?? m.validationCode ?? 'Unknown validation issue'),
      realtimeConfirmed: false,
      bigQueryConfirmed: bigQueryExport ? 'not_yet' : 'not_configured',
      detail: mpAccepted ? 'Test event sent — checking whether it landed…' : 'Google rejected this event payload before it was sent.',
    });
  }

  if (eventsSent.length > 0) {
    const confirmedMap = await pollRealtimeForEvents(ctx, refreshToken, propertyId, eventsSent.map((e) => e.eventName));
    for (const result of results) {
      if (result.eventName) result.realtimeConfirmed = confirmedMap.get(result.eventName) ?? false;
    }

    if (bigQueryExport) {
      await checkBigQueryConfirmations(ctx, refreshToken, bigQueryExport, eventsSent, validationRunId, results);
    }
  }

  for (const result of results) {
    if (!result.eventName) continue;
    const landed = result.realtimeConfirmed || result.bigQueryConfirmed === 'confirmed';
    result.status = result.mpAccepted && landed ? 'pass' : 'fail';
    if (result.mpAccepted && !landed) {
      result.detail = bigQueryExport
        ? "Sent successfully, but it hasn't shown up in GA4 Realtime or the linked BigQuery export yet. BigQuery export can lag several minutes — re-run validation shortly."
        : "Sent successfully, but it hasn't shown up in GA4 Realtime yet. Try again in a minute — Realtime data can take a little while to appear.";
    } else if (result.mpAccepted && landed) {
      result.detail = result.bigQueryConfirmed === 'confirmed'
        ? 'Confirmed — exact-matched in the linked BigQuery export.'
        : 'Confirmed in GA4 Realtime.';
    }
  }

  const overallPass = results.length > 0 && results.every((r) => r.status === 'pass');
  const source: 'ga4_realtime' | 'bigquery' = bigQueryExport ? 'bigquery' : 'ga4_realtime';

  const run = await prisma.validationRun.create({
    data: {
      funnelId: funnel.id,
      userId,
      source,
      resultsJson: JSON.stringify(results),
      overallPass,
    },
  });

  return { id: run.id, source, overallPass, steps: results };
}

async function checkBigQueryConfirmations(
  ctx: { userId?: string; funnelId?: string },
  refreshToken: string,
  bigQueryExport: BigQueryExport,
  eventsSent: { stepId: string; eventName: string }[],
  validationRunId: string,
  results: StepValidationResult[],
) {
  for (const { stepId, eventName } of eventsSent) {
    const confirmed = await findEventInBigQuery(ctx, refreshToken, bigQueryExport, eventName, validationRunId);
    const result = results.find((r) => r.stepId === stepId);
    if (result) result.bigQueryConfirmed = confirmed ? 'confirmed' : 'not_yet';
  }
}
