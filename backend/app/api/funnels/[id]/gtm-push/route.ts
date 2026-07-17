import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createTag, createTrigger } from '@/lib/gtm/api';
import { buildFunnelPlan } from '@/lib/gtm/plan';
import { buildGa4ConfigTagResource, buildTagResource, buildTriggerResource } from '@/lib/gtm/resources';
import { loadFunnelForGtm, loadGtmConnection, prepareWorkspaceAndSnapshot, SetupError } from '@/lib/gtm/setup';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceIdForUser } from '@/lib/workspace';

type StepResult = {
  stepId: string;
  label: string;
  trigger: 'created' | 'reused' | 'skipped' | 'error';
  tag: 'created' | 'reused' | 'skipped' | 'error';
  error?: string;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const workspaceId = await requireWorkspaceIdForUser(userId);

  const body = await request.json().catch(() => ({}));
  const overrideMeasurementId: string | undefined = body?.ga4MeasurementId;
  const eventNameOverrides: Record<string, string> = body?.eventNameOverrides ?? {};

  try {
    const funnel = await loadFunnelForGtm(workspaceId, params.id);
    const connection = await loadGtmConnection(workspaceId);

    if (overrideMeasurementId) {
      await prisma.funnel.update({ where: { id: funnel.id }, data: { ga4MeasurementId: overrideMeasurementId } });
      funnel.ga4MeasurementId = overrideMeasurementId;
    }
    for (const [stepId, eventName] of Object.entries(eventNameOverrides)) {
      if (!eventName) continue;
      await prisma.funnelStep.update({ where: { id: stepId }, data: { ga4EventName: eventName } });
      const step = funnel.steps.find((s) => s.id === stepId);
      if (step) step.ga4EventName = eventName;
    }

    const ctx = { userId, funnelId: funnel.id };
    const { workspacePath, snapshot } = await prepareWorkspaceAndSnapshot(userId, funnel.id, funnel.name, connection);

    const plan = buildFunnelPlan(
      funnel.name,
      funnel.steps.map((s) => ({
        id: s.id,
        order: s.order,
        label: s.label,
        triggerType: s.triggerType,
        urlPattern: s.urlPattern,
        selector: s.selector,
        gtmTriggerId: s.gtmTriggerId,
        gtmTagId: s.gtmTagId,
        ga4EventName: s.ga4EventName,
      })),
      snapshot,
      funnel.ga4MeasurementId,
    );

    if (plan.blockedReason) {
      return NextResponse.json({ error: plan.blockedReason }, { status: 400 });
    }

    // Resolve (or create) the shared GA4 Configuration tag every event tag
    // will reference by name.
    let ga4ConfigTagName = plan.ga4Config.tagName;
    if (plan.ga4Config.outcome === 'new') {
      let allPagesTrigger = snapshot.existingTriggers.find((t) => t.name === 'All Pages');
      let allPagesTriggerId = allPagesTrigger?.id;
      if (!allPagesTriggerId) {
        const created = await createTrigger(ctx, connection.refreshToken, workspacePath, { name: 'All Pages', type: 'PAGEVIEW' });
        allPagesTriggerId = created.triggerId!;
      }
      const configTag = await createTag(
        ctx,
        connection.refreshToken,
        workspacePath,
        buildGa4ConfigTagResource(ga4ConfigTagName, plan.ga4Config.measurementId!, allPagesTriggerId!),
      );
      ga4ConfigTagName = configTag.name!;
    }
    await prisma.funnel.update({ where: { id: funnel.id }, data: { ga4ConfigTagName } });

    const results: StepResult[] = [];

    for (const stepPlan of plan.steps) {
      const step = funnel.steps.find((s) => s.id === stepPlan.stepId)!;
      const result: StepResult = { stepId: step.id, label: step.label, trigger: 'skipped', tag: 'skipped' };

      try {
        let triggerId: string | null = step.gtmTriggerId;
        if (stepPlan.trigger.outcome === 'conflict') {
          result.trigger = 'skipped';
        } else if (stepPlan.trigger.outcome === 'reuse') {
          result.trigger = 'reused';
        } else {
          const created = await createTrigger(
            ctx,
            connection.refreshToken,
            workspacePath,
            buildTriggerResource({ triggerType: step.triggerType, urlPattern: step.urlPattern, selector: step.selector, label: step.label }),
          );
          triggerId = created.triggerId!;
          result.trigger = 'created';
        }

        if (stepPlan.tag.outcome === 'conflict' || !triggerId) {
          result.tag = 'skipped';
        } else if (stepPlan.tag.outcome === 'reuse') {
          result.tag = 'reused';
        } else {
          const createdTag = await createTag(
            ctx,
            connection.refreshToken,
            workspacePath,
            buildTagResource(
              { triggerType: step.triggerType, urlPattern: step.urlPattern, selector: step.selector, label: step.label },
              stepPlan.eventName,
              ga4ConfigTagName,
              triggerId,
            ),
          );
          result.tag = 'created';
          await prisma.funnelStep.update({
            where: { id: step.id },
            data: {
              gtmTriggerId: triggerId,
              gtmTagId: createdTag.tagId,
              ga4EventName: stepPlan.eventName,
              gtmStatus: 'created',
              ga4Status: 'created',
            },
          });
        }

        if (result.tag !== 'created' && triggerId && triggerId !== step.gtmTriggerId) {
          await prisma.funnelStep.update({ where: { id: step.id }, data: { gtmTriggerId: triggerId } });
        }
      } catch (err) {
        const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
        result.error = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
        if (result.trigger === 'skipped') result.trigger = 'error';
        else result.tag = 'error';
      }

      results.push(result);
    }

    const workspaceUrl = connection.gtmAccountId && connection.gtmContainerId && funnel.gtmWorkspaceId
      ? `https://tagmanager.google.com/#/container/accounts/${connection.gtmAccountId}/containers/${connection.gtmContainerId}/workspaces/${funnel.gtmWorkspaceId}`
      : 'https://tagmanager.google.com/';

    return NextResponse.json({ results, ga4ConfigTagName, workspaceUrl });
  } catch (err) {
    if (err instanceof SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
