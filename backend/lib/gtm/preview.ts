import { deriveEventName } from './event-name';
import { triggerTypeLabel, type StepInput } from './resources';

export type StepDryRun = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  triggerDescription: string;
  tagDescription: string;
};

// Pre-connection dry run: no GTM/GA4/Stape account is linked yet, so unlike
// lib/gtm/plan.ts there's no live snapshot to diff against and no
// new/reuse/conflict outcome — just a plain description of what each step
// will become, from the recording alone. Shown before any OAuth prompt so
// the user can judge the shape of the change before granting access to it.
export function buildDryRunPreview(steps: (StepInput & { id: string; order: number })[]): StepDryRun[] {
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const eventName = deriveEventName(step.label);
      return {
        stepId: step.id,
        order: step.order,
        label: step.label,
        eventName,
        triggerDescription: describeTrigger(step),
        tagDescription: `Sends a "${eventName}" event to GA4 when the trigger above fires, routed through your Stape relay.`,
      };
    });
}

function describeTrigger(step: StepInput): string {
  const pageDescription = describePage(step.urlPattern);
  const kind = triggerTypeLabel(step.triggerType).toLowerCase();
  if (step.triggerType === 'click') {
    return `A new ${kind} trigger that fires when someone clicks the recorded element on ${pageDescription}.`;
  }
  if (step.triggerType === 'formSubmit') {
    return `A new ${kind} trigger that fires when a form is submitted on ${pageDescription}.`;
  }
  return `A new ${kind} trigger that fires when someone lands on ${pageDescription}.`;
}

function describePage(urlPattern: string): string {
  try {
    const url = new URL(urlPattern);
    return url.pathname || '/';
  } catch {
    return urlPattern;
  }
}
