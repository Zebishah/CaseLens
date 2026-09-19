const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_USER_KEY = 'adminUser';
const DEMO_MODE_KEY = 'demoMode';
export const AUTH_STATE_EVENT = 'caseops:auth-state';

export type AdminUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
};

export const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
};

export const getAdminUser = (): AdminUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    sessionStorage.removeItem(ADMIN_USER_KEY);
    return null;
  }
};

export const isDemoRecruiter = (): boolean =>
  typeof window !== 'undefined' && sessionStorage.getItem(DEMO_MODE_KEY) === 'recruiter';

export const setDemoRecruiter = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEMO_MODE_KEY, 'recruiter');
};

export const clearDemoRecruiter = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DEMO_MODE_KEY);
};

const notify = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATE_EVENT));
  }
};

export const isAccessTokenUsable = (token: string | null, clockSkewSeconds = 30): boolean => {
  if (!token) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + clockSkewSeconds * 1000;
  } catch {
    return false;
  }
};

export const setAdminToken = (token: string, user?: AdminUser | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (user) {
    sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  }
  notify();
};

export const clearAdminToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
  clearDemoRecruiter();
  notify();
};
