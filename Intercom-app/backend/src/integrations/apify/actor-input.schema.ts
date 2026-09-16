import { z } from 'zod';

const conversationFields = {
  conversationId: z.number().int().positive(),
  intercomId: z.string().min(1).max(255),
  sourceRevision: z.string().max(160).optional(),
  executionId: z.number().int().positive().optional(),
  attempt: z.number().int().positive().max(5).optional()
};

const scopeSchema = z
  .object({
    mode: z.enum(['store', 'domain', 'store-and-domain', 'none']),
    storeNumber: z.string().nullable(),
    domain: z.string().nullable()
  })
  .strict();

export const actorInputSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('intelligence'),
      ...conversationFields,
      skipSync: z.boolean().default(false),
      forceReprocess: z.boolean().default(false),
      skipPeerRefresh: z.boolean().default(false)
    })
    .strict(),
  z
    .object({
      type: z.literal('peer-refresh'),
      ...conversationFields,
      caseType: z.string().max(100),
      employeeIdentityIds: z.array(z.number().int().positive()).max(100),
      relatedCaseSearchScope: scopeSchema.nullable(),
      enqueueSiblingReprocess: z.boolean().default(false)
    })
    .strict(),
  z.object({ type: z.literal('recover-pending-outbox'), limit: z.number().int().min(1).max(20).default(20) }).strict(),
  z.object({ type: z.literal('store-directory-sync'), source: z.literal('apify-schedule').default('apify-schedule') }).strict()
]);

export type ActorInput = z.infer<typeof actorInputSchema>;
