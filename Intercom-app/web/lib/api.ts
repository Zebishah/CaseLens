import {
  clearAdminToken,
  getAdminToken,
  getAdminUser,
  isAccessTokenUsable,
  setAdminToken,
  type AdminUser
} from './auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export type AuthSession = {
  token: string;
  user: AdminUser;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly sleeping = false
  ) {
    super(message);
  }
}

const parse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
  };

  if (response.status === 503) {
    throw new ApiError('Starting demo service', 503, true);
  }

  if (!response.ok) {
    throw new ApiError(body.message ?? 'Request failed', response.status);
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
    const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
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
    window.location.assign('/login?reason=session-expired');
  }
};

const request = async <T>(
  path: string,
  init: RequestInit,
  token?: string,
  retryAfterRefresh = true
): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
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
    const response = await fetch(`${API_URL}/ready`, { cache: 'no-store' });
    return parse<{ status: 'ready' | 'starting' }>(response);
  },

  async health() {
    const response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    return parse<{ status: string }>(response);
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ email, password })
    });
    const session = await parse<AuthSession>(response);
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
      await fetch(`${API_URL}/api/auth/logout`, {
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
