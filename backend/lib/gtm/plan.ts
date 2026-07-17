import { deriveEventName } from './event-name';
import { buildTagName, buildTriggerName, triggerTypeLabel, type StepInput } from './resources';

export type PlanOutcome = 'new' | 'reuse' | 'conflict';

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

export type FunnelPlan = {
  workspaceName: string;
  ga4Config: { outcome: 'new' | 'reuse'; tagName: string; measurementId: string | null };
  steps: StepPlan[];
  blockedReason: string | null;
};

export function buildFunnelPlan(
  funnelName: string,
  steps: StepForPlan[],
  snapshot: GtmSnapshot,
  providedMeasurementId: string | null,
): FunnelPlan {
  const workspaceName = `Funnel Setuper: ${funnelName}`;

  const ga4Config = snapshot.liveGa4ConfigTag
    ? { outcome: 'reuse' as const, tagName: snapshot.liveGa4ConfigTag.name, measurementId: snapshot.liveGa4ConfigTag.measurementId }
    : { outcome: 'new' as const, tagName: 'GA4 Configuration', measurementId: providedMeasurementId };

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
            description: `Sends a "${eventName}" event to GA4 when the trigger above fires.`,
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

  return { workspaceName, ga4Config, steps: stepPlans, blockedReason };
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
