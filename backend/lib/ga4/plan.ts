import { deriveEventName } from '@/lib/gtm/event-name';

// GA4's recommended/reserved event names carry special meaning (e-commerce
// parameter schemas, automatically-enhanced measurement, etc). Marking one of
// these as a conversion event is legal and often correct, but if the
// funnel step's semantics don't obviously match the name, it's worth a nudge
// to double check the event actually sends the parameters GA4 expects for it —
// hence a warning, not a hard conflict.
const RESERVED_EVENT_NAMES = new Set([
  'purchase',
  'refund',
  'add_to_cart',
  'remove_from_cart',
  'view_item',
  'view_item_list',
  'view_cart',
  'begin_checkout',
  'add_payment_info',
  'add_shipping_info',
  'select_item',
  'select_promotion',
  'view_promotion',
  'add_to_wishlist',
  'sign_up',
  'login',
  'search',
  'view_search_results',
  'share',
  'generate_lead',
  'first_visit',
  'session_start',
  'page_view',
  'scroll',
  'click',
  'file_download',
  'video_start',
  'video_progress',
  'video_complete',
]);

export type Ga4PlanOutcome = 'new' | 'reuse';

export type Ga4StepInput = {
  id: string;
  order: number;
  label: string;
  ga4EventName: string | null;
};

export type Ga4StepPlan = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  outcome: Ga4PlanOutcome;
  description: string;
  warnings: string[];
};

export function buildGa4Plan(steps: Ga4StepInput[], existingConversionEvents: { eventName: string }[]): Ga4StepPlan[] {
  const existingNames = new Set(existingConversionEvents.map((e) => e.eventName));

  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const eventName = step.ga4EventName ?? deriveEventName(step.label);
      const warnings: string[] = [];
      const outcome: Ga4PlanOutcome = existingNames.has(eventName) ? 'reuse' : 'new';

      const description =
        outcome === 'reuse'
          ? `"${eventName}" is already marked as a conversion event on this property — nothing to create.`
          : `Will mark "${eventName}" as a conversion event on this property.`;

      if (RESERVED_EVENT_NAMES.has(eventName) && outcome === 'new') {
        warnings.push(
          `"${eventName}" is one of GA4's recommended event names, which has an expected parameter schema. Make sure the event this step actually sends matches it — GA4 won't validate that for you.`,
        );
      }

      return { stepId: step.id, order: step.order, label: step.label, eventName, outcome, description, warnings };
    });
}
