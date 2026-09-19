import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { ROLES } from '../../../src/constants/roles.js';
import { requireRole, requireRoleOrDemo } from '../../../src/middlewares/requireRole.middleware.js';

const requestFor = (role?: string, demo = false): Request =>
  ({ user: role ? { id: 1, email: 'reviewer@example.com', role, ...(demo ? { demo: true } : {}) } : undefined }) as unknown as Request;

describe('requireRole', () => {
  it('allows a viewer through an explicitly readable route', () => {
    const next = jest.fn();
    requireRole(ROLES.ADMIN, ROLES.VIEWER)(
      requestFor(ROLES.VIEWER),
      {} as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks a viewer from an admin-only route', () => {
    const next = jest.fn();
    requireRole(ROLES.ADMIN)(
      requestFor(ROLES.VIEWER),
      {} as Response,
      next as NextFunction
    );

    const error = next.mock.calls[0]?.[0] as { statusCode?: number };
    expect(error.statusCode).toBe(403);
  });

  it('retains the admin override for readable routes', () => {
    const next = jest.fn();
    requireRole(ROLES.VIEWER)(
      requestFor(ROLES.ADMIN),
      {} as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('allows the explicitly marked recruiter demo on a read-only route', () => {
    const next = jest.fn();
    requireRoleOrDemo(ROLES.VIEWER)(
      requestFor(ROLES.VIEWER, true),
      {} as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks a normal viewer from a demo-only read route', () => {
    const next = jest.fn();
    requireRoleOrDemo(ROLES.VIEWER)(
      requestFor(ROLES.VIEWER),
      {} as Response,
      next as NextFunction
    );

    const error = next.mock.calls[0]?.[0] as { statusCode?: number };
    expect(error.statusCode).toBe(403);
  });
});
