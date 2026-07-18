import { z } from 'zod';

export const TriggerTypeSchema = z.enum(['click', 'pageview', 'formSubmit']);

export const FunnelStepSchema = z.object({
  order: z.number().int().positive(),
  label: z.string().min(1).max(200),
  urlPattern: z.string().min(1).max(2000),
  trigger: z.object({
    type: TriggerTypeSchema,
    selector: z.string().max(2000).nullable(),
  }),
  formFields: z.array(z.string().max(200)).max(50).optional(),
});

export const FunnelSpecSchema = z.object({
  funnelName: z.string().min(1).max(200),
  steps: z.array(FunnelStepSchema).min(1).max(200),
});

export type FunnelSpec = z.infer<typeof FunnelSpecSchema>;

// --- Template layer -----------------------------------------------------
// A template is a FunnelSpec pre-loaded with real-world default steps for a
// given vertical, plus the metadata needed to confirm/adjust those steps
// against a user's own site instead of recording them from zero. Every
// TemplateStep is a FunnelStepSchema step first — templateToFunnelSpec()
// strips the template-only fields back down to a wire-compatible FunnelSpec.

export const TemplateVerticalSchema = z.enum(['shopify_checkout', 'saas_trial_signup', 'lead_gen_form']);

export const TemplateStepSchema = FunnelStepSchema.extend({
  // Shown to the user in the confirm/adjust UI: where to find this step on their own site.
  hint: z.string().min(1).max(300),
  // Alternate selectors common to this vertical's popular platforms/themes/builders,
  // tried in order against the user's live page before falling back to a manual pick.
  selectorCandidates: z.array(z.string().max(2000)).max(5).optional(),
});

export const FunnelTemplateSchema = z.object({
  templateId: z.string().min(1).max(100),
  vertical: TemplateVerticalSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  funnelName: z.string().min(1).max(200),
  steps: z.array(TemplateStepSchema).min(1).max(200),
});

export type TemplateStep = z.infer<typeof TemplateStepSchema>;
export type FunnelTemplate = z.infer<typeof FunnelTemplateSchema>;

// Drops template-only fields (hint, selectorCandidates) so a confirmed
// template produces exactly the same shape a from-scratch recording does.
export function templateToFunnelSpec(template: FunnelTemplate): FunnelSpec {
  return FunnelSpecSchema.parse({
    funnelName: template.funnelName,
    steps: template.steps.map(({ order, label, urlPattern, trigger, formFields }) => ({
      order,
      label,
      urlPattern,
      trigger,
      ...(formFields && formFields.length ? { formFields } : {}),
    })),
  });
}
