import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildFunnelPlan } from '@/lib/gtm/plan';
import { buildGa4ConfigTagResource, buildTagResource, buildTriggerResource } from '@/lib/gtm/resources';
import { loadFunnelForGtm, loadGtmConnection, prepareWorkspaceAndSnapshot, SetupError } from '@/lib/gtm/setup';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForGtm(userId, params.id);
    const setupMode = funnel.setupMode as 'client' | 'server';
    const connection = await loadGtmConnection(userId);
    const { workspace, snapshot } = await prepareWorkspaceAndSnapshot(
      userId,
      funnel.id,
      funnel.name,
      connection,
      funnel.ga4ConfigTagName,
    );

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
      setupMode,
    );

    // Only present for server mode — the client-side preview omits this
    // section entirely rather than rendering it blank.
    const stape =
      setupMode === 'server'
        ? {
            subdomain: funnel.stapeSubdomain,
            containerUrl: funnel.stapeContainerUrl,
            status: funnel.stapeContainerStatus,
          }
        : null;

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
        ? buildGa4ConfigTagResource(plan.ga4Config.tagName, plan.ga4Config.measurementId, '<all-pages-trigger-id>', stape?.containerUrl ?? null)
        : null;

    return NextResponse.json({ plan, technicalSteps, ga4ConfigResource, stape });
  } catch (err) {
    if (err instanceof SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
