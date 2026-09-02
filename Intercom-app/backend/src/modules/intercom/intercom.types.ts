import { z } from 'zod';

/** Intercom sends null (not undefined) on some fields — e.g. ping test has id: null. */
export const intercomWebhookEnvelopeSchema = z.object({
  type: z.string().nullish(),
  topic: z.string(),
  id: z.string().nullish(),
  app_id: z.string().nullish(),
  data: z.object({
    type: z.string().nullish(),
    item: z.record(z.unknown())
  })
});

export type IntercomWebhookEnvelope = z.infer<typeof intercomWebhookEnvelopeSchema>;

const canvasIdSchema = z.union([z.string(), z.number()]);

/** Inbox apps send conversation.id; Messenger apps use context.conversation_id. */
const canvasRequestEnvelopeSchema = z
  .object({
    workspace_id: canvasIdSchema.optional(),
    admin: z
      .object({
        id: canvasIdSchema.optional()
      })
      .passthrough()
      .optional(),
    conversation: z
      .object({
        id: canvasIdSchema
      })
      .passthrough()
      .optional(),
    canvas: z
      .object({
        stored_data: z.record(z.unknown()).optional()
      })
      .passthrough()
      .optional(),
    context: z
      .object({
        conversation_id: canvasIdSchema.optional(),
        location: z.string().optional()
      })
      .passthrough()
      .optional(),
    conversation_id: canvasIdSchema.optional(),
    admin_id: canvasIdSchema.optional(),
    component_id: z.string().optional(),
    input_values: z.record(z.unknown()).optional(),
    current_canvas: z.record(z.unknown()).optional()
  })
  .passthrough();

export type CanvasInitializePayload = {
  conversation_id: string | number;
  admin_id?: string | number;
  workspace_id?: string | number;
  component_id?: string;
  input_values?: Record<string, unknown>;
  /** Inbox initialize sends the live conversation object (title, custom_attributes, etc.). */
  intercomConversation?: Record<string, unknown> | null;
};

export type CanvasSubmitPayload = CanvasInitializePayload;

const extractCanvasConversationId = (
  payload: z.infer<typeof canvasRequestEnvelopeSchema>
): string | number | undefined =>
  payload.conversation_id ??
  payload.conversation?.id ??
  payload.context?.conversation_id;

const normalizeCanvasPayload = (
  payload: z.infer<typeof canvasRequestEnvelopeSchema>
): CanvasInitializePayload => {
  const conversationId = extractCanvasConversationId(payload);

  if (conversationId === undefined) {
    throw new z.ZodError([
      {
        code: 'custom',
        message: 'conversation id is required (conversation.id or context.conversation_id)',
        path: ['conversation_id']
      }
    ]);
  }

  return {
    conversation_id: conversationId,
    admin_id: payload.admin_id ?? payload.admin?.id,
    workspace_id: payload.workspace_id,
    component_id: payload.component_id,
    input_values: payload.input_values,
    intercomConversation: payload.conversation ?? null
  };
};

const intercomAdminSchema = z
  .object({
    type: z.string().optional(),
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    email: z.string().optional()
  })
  .passthrough();

export type IntercomAdmin = z.infer<typeof intercomAdminSchema>;

const intercomConversationSchema = z
  .object({
    type: z.string().optional(),
    id: z.union([z.string(), z.number()]),
    title: z.string().nullable().optional(),
    state: z.string().optional(),
    source: z.record(z.unknown()).optional(),
    contacts: z
      .object({
        type: z.string().optional(),
        contacts: z.array(z.record(z.unknown())).optional()
      })
      .optional(),
    tags: z
      .object({
        type: z.string().optional(),
        tags: z.array(z.record(z.unknown())).optional()
      })
      .optional(),
    assignee: z.record(z.unknown()).optional(),
    admin_assignee_id: z.union([z.string(), z.number()]).nullable().optional(),
    team_assignee_id: z.union([z.string(), z.number()]).nullable().optional(),
    conversation_parts: z.record(z.unknown()).optional()
  })
  .passthrough();

export type IntercomConversation = z.infer<typeof intercomConversationSchema>;

export const parseIntercomWebhook = (payload: unknown): IntercomWebhookEnvelope =>
  intercomWebhookEnvelopeSchema.parse(payload);

export const parseCanvasInitialize = (payload: unknown): CanvasInitializePayload =>
  normalizeCanvasPayload(canvasRequestEnvelopeSchema.parse(payload));

export const parseCanvasSubmit = (payload: unknown): CanvasSubmitPayload =>
  normalizeCanvasPayload(canvasRequestEnvelopeSchema.parse(payload));

export const parseIntercomAdmin = (payload: unknown): IntercomAdmin => intercomAdminSchema.parse(payload);

export const parseIntercomConversation = (payload: unknown): IntercomConversation =>
  intercomConversationSchema.parse(payload);
