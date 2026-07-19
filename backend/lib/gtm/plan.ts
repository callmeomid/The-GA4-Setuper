import type { tagmanager_v2 } from 'googleapis';
import { deriveEventName } from './event-name';
import { buildTagName, buildTriggerName, buildWorkspaceName, triggerTypeLabel, type StepInput } from './resources';

export type PlanOutcome = 'new' | 'reuse' | 'conflict';

export type SetupMode = 'client' | 'server';

export type StepForPlan = StepInput & {
  id: string;
  order: number;
  gtmTriggerId: string | null;
  gtmTagId: string | null;
  ga4EventName: string | null;
};

export type GtmSnapshot = {
  existingTriggers: { id: string; name: string }[];
  existingTags: { id: string; name: string }[];
  liveGa4ConfigTag: { name: string; measurementId: string } | null;
  // A GA4 Configuration tag already sitting in *our* draft workspace — i.e.
  // one this app created on a previous run. Distinct from liveGa4ConfigTag
  // (published, read-only reference) because this one we can safely edit in
  // place, which is what makes the client→server upgrade path possible.
  draftGa4ConfigTag: {
    id: string;
    name: string;
    measurementId: string;
    hasServerContainerUrl: boolean;
    raw: tagmanager_v2.Schema$Tag;
  } | null;
};

export type StepPlan = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  trigger: { outcome: PlanOutcome; name: string; description: string; conflictReason?: string };
  tag: { outcome: PlanOutcome; name: string; description: string; conflictReason?: string };
  warnings: string[];
};

export type Ga4ConfigPlan = {
  outcome: 'new' | 'reuse' | 'upgrade';
  tagName: string;
  measurementId: string | null;
  tagId: string | null;
  description: string;
};

export type FunnelPlan = {
  workspaceName: string;
  setupMode: SetupMode;
  ga4Config: Ga4ConfigPlan;
  steps: StepPlan[];
  blockedReason: string | null;
};

export function buildFunnelPlan(
  funnelName: string,
  steps: StepForPlan[],
  snapshot: GtmSnapshot,
  providedMeasurementId: string | null,
  setupMode: SetupMode,
): FunnelPlan {
  const workspaceName = buildWorkspaceName(funnelName);

  const ga4Config = buildGa4ConfigPlan(snapshot, providedMeasurementId, setupMode);

  const blockedReason = ga4Config.outcome === 'new' && !ga4Config.measurementId
    ? 'No GA4 Configuration tag was found live in this container, and no GA4 Measurement ID was provided. Enter one before pushing.'
    : null;

  const triggerByName = new Map(snapshot.existingTriggers.map((t) => [t.name, t]));
  const triggerById = new Map(snapshot.existingTriggers.map((t) => [t.id, t]));
  const tagByName = new Map(snapshot.existingTags.map((t) => [t.name, t]));
  const tagById = new Map(snapshot.existingTags.map((t) => [t.id, t]));

  const stepPlans: StepPlan[] = steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const eventName = step.ga4EventName ?? deriveEventName(step.label);
      const triggerName = buildTriggerName(step);
      const tagName = buildTagName(eventName);
      const warnings: string[] = [];

      let trigger: StepPlan['trigger'];
      if (step.gtmTriggerId && triggerById.has(step.gtmTriggerId)) {
        trigger = {
          outcome: 'reuse',
          name: triggerName,
          description: `Already created in a previous run — will reuse the existing "${triggerName}" trigger.`,
        };
      } else {
        const collision = triggerByName.get(triggerName);
        if (collision) {
          trigger = {
            outcome: 'conflict',
            name: triggerName,
            description: `A trigger named "${triggerName}" already exists in this container.`,
            conflictReason: 'Rename this step (edit the event name below) or resolve the existing trigger in GTM directly, then try again.',
          };
        } else {
          trigger = {
            outcome: 'new',
            name: triggerName,
            description: describeTrigger(step),
          };
        }
      }

      let tag: StepPlan['tag'];
      if (step.gtmTagId && tagById.has(step.gtmTagId)) {
        tag = {
          outcome: 'reuse',
          name: tagName,
          description: `Already created in a previous run — will reuse the existing "${tagName}" tag.`,
        };
      } else {
        const collision = tagByName.get(tagName);
        if (collision) {
          tag = {
            outcome: 'conflict',
            name: tagName,
            description: `A tag named "${tagName}" already exists in this container.`,
            conflictReason: 'Edit the event name below to generate a differently-named tag, or resolve the existing one in GTM directly.',
          };
        } else {
          tag = {
            outcome: 'new',
            name: tagName,
            description:
              setupMode === 'server'
                ? `Sends a "${eventName}" event to GA4 when the trigger above fires, via your server container.`
                : `Sends a "${eventName}" event to GA4 when the trigger above fires.`,
          };
        }
      }

      if (step.triggerType === 'formSubmit') {
        warnings.push(
          'Scoped to this page only — matching the specific form element isn\'t supported yet, so this fires on any form submission on this page.',
        );
      }

      return { stepId: step.id, order: step.order, label: step.label, eventName, trigger, tag, warnings };
    });

  return { workspaceName, setupMode, ga4Config, steps: stepPlans, blockedReason };
}

function buildGa4ConfigPlan(snapshot: GtmSnapshot, providedMeasurementId: string | null, setupMode: SetupMode): Ga4ConfigPlan {
  const draft = snapshot.draftGa4ConfigTag;
  if (draft) {
    if (setupMode === 'server' && !draft.hasServerContainerUrl) {
      return {
        outcome: 'upgrade',
        tagName: draft.name,
        measurementId: draft.measurementId,
        tagId: draft.id,
        description: `Found the GA4 Configuration tag from a previous client-side run — adding your server container as its transport instead of creating a duplicate.`,
      };
    }
    return {
      outcome: 'reuse',
      tagName: draft.name,
      measurementId: draft.measurementId,
      tagId: draft.id,
      description: `Already created in a previous run — reusing the existing "${draft.name}" tag.`,
    };
  }

  if (snapshot.liveGa4ConfigTag) {
    return {
      outcome: 'reuse',
      tagName: snapshot.liveGa4ConfigTag.name,
      measurementId: snapshot.liveGa4ConfigTag.measurementId,
      tagId: null,
      description: `Found an existing GA4 Configuration tag live in this container — reusing it instead of creating a duplicate.`,
    };
  }

  return {
    outcome: 'new',
    tagName: 'GA4 Configuration',
    measurementId: providedMeasurementId,
    tagId: null,
    description:
      setupMode === 'server'
        ? "No GA4 Configuration tag found live in this container — we'll create one, routed through your server container."
        : "No GA4 Configuration tag found live in this container — we'll create one.",
  };
}

function describeTrigger(step: StepForPlan): string {
  const pageDescription = describePage(step.urlPattern);
  if (step.triggerType === 'click') {
    return `Fires when someone clicks the element matching \`${step.selector}\` on ${pageDescription}.`;
  }
  if (step.triggerType === 'formSubmit') {
    return `Fires when any form is submitted on ${pageDescription}.`;
  }
  return `Fires when someone lands on ${pageDescription}.`;
}

function describePage(urlPattern: string): string {
  try {
    const url = new URL(urlPattern);
    return url.pathname.includes(':id') ? `pages matching ${url.pathname}` : url.pathname || '/';
  } catch {
    return urlPattern;
  }
}

export { triggerTypeLabel };
