import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { GtmError } from '@/lib/gtm/client';
import { buildFunnelPlan } from '@/lib/gtm/plan';
import { buildGa4ConfigTagResource, buildTagResource, buildTriggerResource } from '@/lib/gtm/resources';
import { loadFunnelForGtm, loadGtmConnection, prepareWorkspaceAndSnapshot, SetupError } from '@/lib/gtm/setup';
import { logError } from '@/lib/log';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForGtm(userId, params.id);
    const connection = await loadGtmConnection(userId);
    const { workspace, snapshot } = await prepareWorkspaceAndSnapshot(userId, funnel.id, funnel.name, connection);

    if (workspace.workspaceId && workspace.workspaceId !== funnel.gtmWorkspaceId) {
      await prisma.funnel.update({ where: { id: funnel.id }, data: { gtmWorkspaceId: workspace.workspaceId } });
    }

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

    // Technical detail shown only in the preview's collapsed "technical
    // details" panel — computed with the same builder functions push uses,
    // so what's shown can never drift from what would actually be sent.
    const technicalSteps = funnel.steps.map((s) => {
      const stepInput = { triggerType: s.triggerType, urlPattern: s.urlPattern, selector: s.selector, label: s.label };
      const eventName = s.ga4EventName ?? plan.steps.find((p) => p.stepId === s.id)?.eventName ?? s.label;
      return {
        stepId: s.id,
        triggerResource: buildTriggerResource(stepInput),
        tagResource: buildTagResource(stepInput, eventName, plan.ga4Config.tagName, '<trigger-id>'),
      };
    });
    const ga4ConfigResource =
      plan.ga4Config.outcome === 'new' && plan.ga4Config.measurementId
        ? buildGa4ConfigTagResource(plan.ga4Config.tagName, plan.ga4Config.measurementId, '<all-pages-trigger-id>')
        : null;

    return NextResponse.json({ plan, technicalSteps, ga4ConfigResource });
  } catch (err) {
    if (err instanceof SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    // GtmError is already logged with full request/response context inside
    // callGtmLogged — logging it again here would just duplicate the Sentry
    // event. Anything else reaching this catch is a genuine unhandled bug
    // (not a translated API error), so that's the case worth reporting here.
    if (!(err instanceof GtmError)) logError('gtm-plan failed unexpectedly', err, { userId, funnelId: params.id });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
