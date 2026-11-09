import {
  clearAdminToken,
  clearDemoRecruiter,
  getAdminToken,
  getAdminUser,
  isAccessTokenUsable,
  setDemoRecruiter,
  setAdminToken,
  type AdminUser
} from './auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
const DEFAULT_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 15_000;

export type AuthSession = {
  token: string;
  user: AdminUser;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly sleeping = false,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new ApiError('The service took too long to respond. Please try again.', 408);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
};

const parse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
    errors?: { code?: string };
    details?: { code?: string };
  };

  if (response.status === 503) {
    throw new ApiError(body.message ?? 'Starting demo service', 503, !body.message);
  }

  if (!response.ok) {
    throw new ApiError(body.message ?? 'Request failed', response.status, false, body.errors?.code ?? body.details?.code);
  }

  return (body.data ?? body) as T;
};

const headersFor = (token?: string, json = false): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }

  const admin = token ?? getAdminToken();
  if (admin) {
    headers.Authorization = `Bearer ${admin}`;
  }

  const demo = typeof window !== 'undefined' ? sessionStorage.getItem('demoToken') : null;
  if (demo) {
    headers['x-demo-session'] = demo;
  }

  return headers;
};

let refreshInFlight: Promise<AuthSession | null> | null = null;

const refreshSession = (): Promise<AuthSession | null> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: '{}'
    });

    if (response.status === 401) {
      clearAdminToken();
      return null;
    }

    const session = await parse<AuthSession>(response);
    clearDemoRecruiter();
    setAdminToken(session.token, session.user);
    return session;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

const expireSession = (): void => {
  clearAdminToken();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login?reason=session-expired');
  }
};

const request = async <T>(
  path: string,
  init: RequestInit,
  token?: string,
  retryAfterRefresh = true
): Promise<T> => {
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...headersFor(token, Boolean(init.body)),
      ...(init.headers ?? {})
    },
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401 && retryAfterRefresh && !token) {
    const session = await refreshSession();
    if (session) {
      return request<T>(path, init, session.token, false);
    }
    expireSession();
  }

  return parse<T>(response);
};

export const api = {
  async ready() {
    const response = await fetchWithTimeout(`${API_URL}/ready`, { cache: 'no-store' }, HEALTH_TIMEOUT_MS);
    return parse<{ status: 'ready' | 'starting' }>(response);
  },

  async health() {
    const response = await fetchWithTimeout(`${API_URL}/health`, { cache: 'no-store' }, HEALTH_TIMEOUT_MS);
    return parse<{ status: string }>(response);
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ email, password })
    });
    const session = await parse<AuthSession>(response);
    clearDemoRecruiter();
    setAdminToken(session.token, session.user);
    return session;
  },

  async resendVerification(email: string, password: string): Promise<{ message: string }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/email-verification/resend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ email, password })
    });
    return parse(response);
  },

  async verifyEmailCode(email: string, code: string): Promise<{ verified: boolean }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/email-verification/verify-code`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ email, code })
    });
    return parse(response);
  },

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/email-verification/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ token })
    });
    return parse(response);
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/password-reset/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ email })
    });
    return parse(response);
  },

  async confirmPasswordReset(token: string, password: string): Promise<{ reset: true }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/password-reset/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ token, password })
    });
    return parse(response);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request('/api/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword })
    });
    clearAdminToken();
  },

  async inspectInvite(token: string): Promise<{ email: string; name: string; expiresAt: string }> {
    return request(`/api/auth/invite?token=${encodeURIComponent(token)}`, { method: 'GET' }, undefined, false);
  },

  async acceptInvite(token: string, password: string): Promise<AuthSession> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ token, password })
    });
    const session = await parse<AuthSession>(response);
    clearDemoRecruiter();
    setAdminToken(session.token, session.user);
    return session;
  },

  async enterDemo(): Promise<AuthSession & { expiresAt: string; access: string }> {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: '{}'
    });
    const session = await parse<AuthSession & { expiresAt: string; access: string }>(response);
    setDemoRecruiter();
    setAdminToken(session.token, session.user);
    return session;
  },

  async restoreSession(): Promise<AuthSession | null> {
    const token = getAdminToken();
    const user = getAdminUser();
    if (isAccessTokenUsable(token) && user) {
      return { token: token as string, user };
    }
    return refreshSession();
  },

  async logout(): Promise<void> {
    try {
      await fetchWithTimeout(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
    } finally {
      clearAdminToken();
    }
  },

  async get<T = Record<string, unknown>>(path: string, token?: string) {
    return request<T>(path, { method: 'GET' }, token);
  },

  async post<T = Record<string, unknown>>(path: string, body: unknown, token?: string) {
    return request<T>(
      path,
      {
        method: 'POST',
        body: JSON.stringify(body)
      },
      token
    );
  },

  async patch<T = Record<string, unknown>>(path: string, body: unknown, token?: string) {
    return request<T>(
      path,
      {
        method: 'PATCH',
        body: JSON.stringify(body)
      },
      token
    );
  }
};
