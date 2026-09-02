export const ROLES = {
  ADMIN: 'admin',
  VIEWER: 'viewer',
  USER: 'user'
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
