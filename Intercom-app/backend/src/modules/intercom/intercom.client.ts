import { INTERCOM_API } from '../../constants/intercom.constants.js';
import { intercomConfig } from '../../config/intercom.config.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../../utils/error.util.js';
import { isTransientNetworkError } from '../../utils/retry.util.js';
import {
  parseIntercomAdmin,
  parseIntercomConversation,
  type IntercomAdmin,
  type IntercomConversation
} from './intercom.types.js';

type IntercomRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (): HeadersInit => ({
  Authorization: `Bearer ${intercomConfig.accessToken}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'Intercom-Version': intercomConfig.apiVersion
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const conversationParts = (conversation: IntercomConversation): Array<Record<string, unknown>> => {
  const wrapper = asRecord(conversation.conversation_parts);
  const parts = wrapper?.conversation_parts;
  return Array.isArray(parts) ? parts.filter((part): part is Record<string, unknown> => Boolean(asRecord(part))) : [];
};

const intercomFetch = async <T>(path: string, options: IntercomRequestOptions = {}): Promise<T> => {
  const url = `${intercomConfig.apiBaseUrl}${path}`;
  const attempts = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      logger.debug('[intercom-api] Request', { method: options.method ?? 'GET', path, attempt });

      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: buildHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(INTERCOM_API.REQUEST_TIMEOUT_MS)
      });

      if (response.status === 401) {
        throw AppError.unauthorized('Intercom credentials were rejected');
      }

      if (response.status === 403) {
        throw AppError.forbidden('Intercom request is not allowed for this token');
      }

      if (response.status === 404) {
        throw AppError.notFound('Intercom resource not found');
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfterHeader = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 1000 * attempt;
        lastError = AppError.serviceUnavailable(`Intercom API error (${response.status}): rate or upstream failure`);
        if (attempt === attempts) {
          throw lastError;
        }
        logger.warn('[intercom-api] Retryable Intercom status — backing off', {
          path,
          status: response.status,
          attempt
        });
        await sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        const errorBody = (await response.text()).slice(0, 180);
        logger.warn('[intercom-api] Request failed', { path, status: response.status, errorBody });
        throw AppError.badRequest(`Intercom API error (${response.status}): ${errorBody}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      logger.debug('[intercom-api] Request succeeded', { path, status: response.status });
      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.statusCode === 404 ||
          error.statusCode === 400 ||
          error.statusCode === 401 ||
          error.statusCode === 403)
      ) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      const timeout = lastError.name === 'TimeoutError' || lastError.name === 'AbortError';
      const retryable = timeout || isTransientNetworkError(lastError) || lastError.message.includes('(429)') || lastError.message.includes('(5');

      if (attempt === attempts || !retryable) {
        throw lastError;
      }

      logger.warn('[intercom-api] Transient Intercom error — retrying', {
        path,
        attempt,
        message: lastError.message
      });
      await sleep(1000 * attempt);
    }
  }

  throw lastError ?? new Error('Intercom request failed');
};

export const intercomClient = {
  async getConversation(intercomConversationId: string): Promise<IntercomConversation> {
    logger.info('[intercom-api] Fetching conversation', { intercomConversationId });
    const payload = await intercomFetch<unknown>(`/conversations/${intercomConversationId}`);
    const conversation = parseIntercomConversation(payload);
    logger.info('[intercom-api] Conversation fetched', {
      intercomConversationId,
      title: conversation.title,
      state: conversation.state
    });
    return conversation;
  },

  async getAdmin(intercomAdminId: string): Promise<IntercomAdmin> {
    const payload = await intercomFetch<unknown>(`/admins/${intercomAdminId}`);
    return parseIntercomAdmin(payload);
  },

  async getMe(): Promise<{
    adminId: string;
    name: string | null;
    email: string | null;
    appId: string | null;
    appName: string | null;
    regionHint: string;
    apiVersion: string;
  }> {
    const payload = await intercomFetch<Record<string, unknown>>('/me');
    const app = payload.app && typeof payload.app === 'object' ? (payload.app as Record<string, unknown>) : null;
    const adminId = payload.id != null ? String(payload.id) : '';
    return {
      adminId,
      name: typeof payload.name === 'string' ? payload.name : null,
      email: typeof payload.email === 'string' ? payload.email : null,
      appId:
        app && (app.id_code != null || app.id != null)
          ? String(app.id_code ?? app.id)
          : null,
      appName: app && typeof app.name === 'string' ? app.name : null,
      regionHint: intercomConfig.apiBaseUrl,
      apiVersion: intercomConfig.apiVersion
    };
  },

  async replyWithNote(intercomConversationId: string, body: string): Promise<{ noteId: string | null }> {
    const payload = await intercomFetch<unknown>(`/conversations/${intercomConversationId}/reply`, {
      method: 'POST',
      body: {
        type: 'admin',
        message_type: 'note',
        admin_id: intercomConfig.botAdminId,
        body
      }
    });

    const conversation = parseIntercomConversation(payload);
    const notes = conversationParts(conversation).filter((part) => part.part_type === 'note' || part.message_type === 'note');
    const last = notes.at(-1);
    return { noteId: last?.id != null ? String(last.id) : conversation.id != null ? String(conversation.id) : null };
  },

  async findNoteIdByMarker(intercomConversationId: string, marker: string): Promise<string | null> {
    const conversation = await this.getConversation(intercomConversationId);
    const match = conversationParts(conversation).find((part) => {
      const body = typeof part.body === 'string' ? part.body : '';
      return body.includes(marker);
    });
    return match?.id != null ? String(match.id) : null;
  },

  async ensureConversationTag(intercomConversationId: string, tagName: string): Promise<void> {
    const created = await intercomFetch<{ id?: string | number }>(`/tags`, {
      method: 'POST',
      body: { name: tagName }
    });
    const tagId = created.id != null ? String(created.id) : null;
    if (!tagId) {
      throw AppError.badRequest('Intercom API error: tag create did not return an id');
    }

    await intercomFetch(`/conversations/${intercomConversationId}/tags`, {
      method: 'POST',
      body: {
        id: tagId,
        admin_id: intercomConfig.botAdminId
      }
    });
  }
};
