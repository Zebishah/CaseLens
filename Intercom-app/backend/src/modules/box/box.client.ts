import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { retryAsync } from '../../utils/retry.util.js';

const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token';
const BOX_API_BASE = 'https://api.box.com/2.0';

export const isBoxStoreDirectoryConfigured = (): boolean =>
  Boolean(
    env.BOX_SYNC_ENABLED &&
      env.BOX_CLIENT_ID?.trim() &&
      env.BOX_CLIENT_SECRET?.trim() &&
      env.BOX_ENTERPRISE_ID?.trim() &&
      env.BOX_FILE_ID?.trim()
  );

type BoxTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const formatFetchError = (error: unknown, context: string): Error => {
  if (!(error instanceof Error)) {
    return new Error(`${context}: ${String(error)}`);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage =
    cause instanceof Error
      ? `${cause.message}${(cause as NodeJS.ErrnoException).code ? ` (${(cause as NodeJS.ErrnoException).code})` : ''}`
      : null;

  if (causeMessage && error.message === 'fetch failed') {
    return new Error(`${context}: ${causeMessage}`);
  }

  return error;
};

const fetchAccessToken = async (): Promise<string> => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.BOX_CLIENT_ID!,
    client_secret: env.BOX_CLIENT_SECRET!,
    box_subject_type: 'enterprise',
    box_subject_id: env.BOX_ENTERPRISE_ID!
  });

  const response = await retryAsync(
    () =>
      fetch(BOX_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      }),
    {
      onRetry: (error, attempt) => {
        logger.warn('[box] Token request failed — retrying', {
          attempt,
          message: error.message
        });
      }
    }
  ).catch((error) => {
    throw formatFetchError(error, 'Box token request failed');
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Box token request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as BoxTokenResponse;
  if (!json.access_token) {
    throw new Error('Box token response missing access_token');
  }

  return json.access_token;
};

const downloadWithToken = async (accessToken: string, fileId: string): Promise<Buffer> => {
  const response = await retryAsync(
    () =>
      fetch(`${BOX_API_BASE}/files/${fileId}/content`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: 'follow'
      }),
    {
      onRetry: (error, attempt) => {
        logger.warn('[box] File download failed — retrying', {
          attempt,
          fileId,
          message: error.message
        });
      }
    }
  ).catch((error) => {
    throw formatFetchError(error, 'Box file download failed');
  });

  if (response.status === 401) {
    const err = new Error('Box download unauthorized') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Box file download failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Client Credentials Grant — fresh token per call (tokens ~60 min; no refresh token).
 * Retries once on 401 with a new token.
 */
export const downloadBoxFile = async (fileId = env.BOX_FILE_ID!): Promise<Buffer> => {
  if (!isBoxStoreDirectoryConfigured()) {
    throw new Error('Box store-directory env vars are not configured');
  }

  let token = await fetchAccessToken();

  try {
    return await downloadWithToken(token, fileId);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 401) {
      throw error;
    }

    logger.warn('[box] Download returned 401 — requesting new access token and retrying');
    token = await fetchAccessToken();
    return downloadWithToken(token, fileId);
  }
};

export const boxClient = {
  isConfigured: isBoxStoreDirectoryConfigured,
  downloadFile: downloadBoxFile
};
