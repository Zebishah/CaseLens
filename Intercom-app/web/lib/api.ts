import { getAdminToken } from './auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

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

export const api = {
  async ready() {
    const response = await fetch(`${API_URL}/ready`, { cache: 'no-store' });
    return parse<{ status: 'ready' | 'starting' }>(response);
  },
  async health() {
    const response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    return parse<{ status: string }>(response);
  },
  async get<T = Record<string, unknown>>(path: string, token?: string) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: headersFor(token),
      credentials: 'include'
    });
    return parse<T>(response);
  },
  async post<T = Record<string, unknown>>(path: string, body: unknown, token?: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: headersFor(token, true),
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return parse<T>(response);
  }
};
