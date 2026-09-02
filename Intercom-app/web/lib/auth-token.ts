const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_USER_KEY = 'adminUser';

export type AdminUser = {
  name?: string;
  email?: string;
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
    return null;
  }
};

export const setAdminToken = (token: string, user?: AdminUser | null): void => {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (user?.email || user?.name) {
    sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  }
};

export const clearAdminToken = (): void => {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
};
