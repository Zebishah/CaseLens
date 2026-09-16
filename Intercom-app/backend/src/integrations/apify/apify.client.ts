import { env } from '../../config/env.config.js';

export type ApifyClientErrorCode =
  | 'credential_error'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'transport_error'
  | 'contract_error';

export class ApifyClientError extends Error {
  constructor(
    public readonly code: ApifyClientErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'ApifyClientError';
  }
}

export type ApifyRunStart = { id: string; status?: string };
export type ApifyClientConfig = {
  token: string;
  actorId: string;
  baseUrl: string;
  requestTimeoutMs: number;
  memoryMbytes?: number;
  runTimeoutSeconds?: number;
  fetchImpl?: typeof fetch;
};

const responseError = (status: number): ApifyClientError => {
  if (status === 401 || status === 403) {
    return new ApifyClientError('credential_error', 'Apify rejected the configured credentials.', status);
  }
  if (status === 404) {
    return new ApifyClientError('not_found', 'The configured Apify Actor or run was not found.', status);
  }
  if (status === 429) {
    return new ApifyClientError('rate_limited', 'Apify rate limited the run request.', status);
  }
  if (status >= 500) {
    return new ApifyClientError('upstream_unavailable', 'Apify is temporarily unavailable.', status);
  }
  return new ApifyClientError('contract_error', 'Apify rejected the run request.', status);
};

export const createApifyClient = (config: ApifyClientConfig) => {
  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      return await (config.fetchImpl ?? fetch)(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.token}`,
          ...init?.headers
        }
      });
    } catch (_error) {
      const timedOut = controller.signal.aborted;
      throw new ApifyClientError(
        'transport_error',
        timedOut ? 'Apify request timed out.' : 'Apify request could not be completed.'
      );
    } finally {
      clearTimeout(timer);
    }
  };

  return {
  async startActorRun(input: unknown): Promise<ApifyRunStart> {
      let response: Response;
      try {
        const query = new URLSearchParams();
        if (config.memoryMbytes) query.set('memory', String(config.memoryMbytes));
        if (config.runTimeoutSeconds) query.set('timeout', String(config.runTimeoutSeconds));
        response = await request(`/acts/${encodeURIComponent(config.actorId)}/runs?${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
      } catch (error) {
        if (error instanceof ApifyClientError) throw error;
        throw new ApifyClientError('transport_error', 'Apify request could not be completed.');
      }
      if (!response.ok) throw responseError(response.status);

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApifyClientError('contract_error', 'Apify returned an invalid run response.', response.status);
      }
      const data = (body as { data?: unknown } | null)?.data as { id?: unknown; status?: unknown } | undefined;
      if (typeof data?.id !== 'string' || !data.id.trim()) {
        throw new ApifyClientError('contract_error', 'Apify returned a run response without an id.', response.status);
      }
      return {
        id: data.id,
        ...(typeof data.status === 'string' ? { status: data.status } : {})
      };
    },

    async getActorRun(runId: string): Promise<ApifyRunStart> {
      const response = await request(`/actor-runs/${encodeURIComponent(runId)}`);
      if (!response.ok) throw responseError(response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApifyClientError('contract_error', 'Apify returned an invalid run response.', response.status);
      }
      const data = (body as { data?: unknown } | null)?.data as { id?: unknown; status?: unknown } | undefined;
      if (typeof data?.id !== 'string' || typeof data.status !== 'string') {
        throw new ApifyClientError('contract_error', 'Apify returned a malformed run response.', response.status);
      }
      return { id: data.id, status: data.status };
    }
  };
};

export const apifyClient = () => {
  if (!env.APIFY_API_TOKEN || !env.APIFY_ACTOR_ID) {
    throw new ApifyClientError('credential_error', 'Apify dispatch is not configured.');
  }
  return createApifyClient({
    token: env.APIFY_API_TOKEN,
    actorId: env.APIFY_ACTOR_ID,
    baseUrl: env.APIFY_API_BASE_URL,
    requestTimeoutMs: env.APIFY_REQUEST_TIMEOUT_MS,
    memoryMbytes: env.APIFY_DEFAULT_MEMORY_MBYTES,
    runTimeoutSeconds: env.APIFY_RUN_TIMEOUT_SECONDS
  });
};
