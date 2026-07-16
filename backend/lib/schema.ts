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
