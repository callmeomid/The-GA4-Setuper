import { deriveEventName } from '@/lib/gtm/event-name';

export type Ga4PlanOutcome = 'new' | 'reuse' | 'conflict';

export type StepForGa4Plan = {
  id: string;
  order: number;
  label: string;
  ga4EventName: string | null;
  ga4ConversionEventResourceName: string | null;
};

export type ExistingConversionEvent = { resourceName: string; eventName: string; custom: boolean };

export type Ga4StepPlan = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  outcome: Ga4PlanOutcome;
  description: string;
  conflictReason?: string;
};

export type Ga4FunnelPlan = {
  propertyId: string;
  propertyDisplayName: string;
  steps: Ga4StepPlan[];
  // Conversion events already live on this property that AREN'T one of this
  // funnel's steps — shown so the user can spot a naming collision or a
  // stale event before we add more, per the "surface conflicts first" ask.
  otherExistingConversionEvents: { eventName: string; custom: boolean }[];
  existingConversionEventCount: number;
  nearCapWarning: string | null;
};

// GA4 Admin API has no formal "list the cap" endpoint — the real limit is
// only surfaced when conversionEvents.create actually fails (translated in
// lib/ga4/client.ts). 30 is Google's documented default for standard
// properties as of this writing; treated here as a soft heads-up, not a
// hard block, since we can't confirm it live without attempting the write.
const SOFT_CAP_HEADS_UP_THRESHOLD = 25;

export function buildGa4Plan(
  propertyId: string,
  propertyDisplayName: string,
  steps: StepForGa4Plan[],
  existingEvents: ExistingConversionEvent[],
): Ga4FunnelPlan {
  const byEventName = new Map(existingEvents.map((e) => [e.eventName, e]));
  const claimedNames = new Set<string>();

  const stepPlans: Ga4StepPlan[] = steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const eventName = step.ga4EventName ?? deriveEventName(step.label);
      claimedNames.add(eventName);
      const existing = byEventName.get(eventName);

      let outcome: Ga4PlanOutcome;
      let description: string;
      let conflictReason: string | undefined;

      if (existing) {
        outcome = 'reuse';
        description = existing.custom
          ? `"${eventName}" is already marked as a conversion event in this property — nothing to create.`
          : `"${eventName}" is one of GA4's automatically-collected events and is already marked as a conversion — nothing to create.`;
      } else {
        outcome = 'new';
        description = `Will mark "${eventName}" as a conversion event in this property. Takes effect immediately once you push — GA4 has no draft mode.`;
      }

      return { stepId: step.id, order: step.order, label: step.label, eventName, outcome, description, conflictReason };
    });

  const otherExistingConversionEvents = existingEvents
    .filter((e) => !claimedNames.has(e.eventName))
    .map((e) => ({ eventName: e.eventName, custom: e.custom }));

  const nearCapWarning =
    existingEvents.length >= SOFT_CAP_HEADS_UP_THRESHOLD
      ? `This property already has ${existingEvents.length} conversion events. Google caps standard GA4 properties at around 30 — if you're near that, creating new ones below may fail; we'll show the real error if it does.`
      : null;

  return {
    propertyId,
    propertyDisplayName,
    steps: stepPlans,
    otherExistingConversionEvents,
    existingConversionEventCount: existingEvents.length,
    nearCapWarning,
  };
}
