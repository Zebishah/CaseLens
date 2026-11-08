import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import { authRoutes } from '../../../src/modules/auth/auth.routes.js';
import { authRepository } from '../../../src/modules/auth/auth.repository.js';
import { refreshSessionRepository } from '../../../src/modules/auth/refresh-session.repository.js';
import { workspaceInviteRepository } from '../../../src/modules/auth/workspace-invite.repository.js';
import { accessRequestRepository } from '../../../src/modules/access-request/access-request.repository.js';
import { authMiddleware } from '../../../src/middlewares/auth.middleware.js';
import { optionalAuthMiddleware } from '../../../src/middlewares/optional-auth.middleware.js';
import { errorHandler } from '../../../src/middlewares/error.middleware.js';
import { env } from '../../../src/config/env.config.js';
import { generateRefreshToken, generateToken, verifyToken } from '../../../src/services/jwt.service.js';

const app = express();
app.set('trust proxy', false);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/protected', authMiddleware, (_req, res) => res.json({ ok: true }));
app.get('/optional', optionalAuthMiddleware, (_req, res) => res.json({ ok: true }));
app.use(errorHandler);

const originalPassword = 'original-password-123';
let passwordHash: string;
let account: NonNullable<Awaited<ReturnType<typeof authRepository.findUserByEmail>>>;
const claims = (overrides = {}) => ({ sub: 1, email: 'admin@example.com', role: 'admin', authVersion: 0, ...overrides });
const change = (token: string, body = { currentPassword: originalPassword, newPassword: 'replacement-password-456' }) =>
  request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);
const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

beforeAll(async () => { passwordHash = await bcrypt.hash(originalPassword, 4); });
beforeEach(() => {
  account = { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin', password: passwordHash,
    authVersion: 0, emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
  jest.spyOn(authRepository, 'findUserById').mockImplementation(async () => account);
  jest.spyOn(authRepository, 'findUserByEmail').mockImplementation(async () => account);
  jest.spyOn(refreshSessionRepository, 'create').mockResolvedValue();
  jest.spyOn(refreshSessionRepository, 'rotate').mockResolvedValue(true);
  jest.spyOn(refreshSessionRepository, 'revoke').mockResolvedValue();
  jest.spyOn(authRepository, 'changeAdminPassword').mockImplementation(async (_id, _old, password) => {
    account = { ...account, password, authVersion: account.authVersion + 1 };
    return account;
  });
  env.RESEND_AUTH_EMAIL_ENABLED = true;
  env.RESEND_API_KEY = 'test-resend-key';
  env.RESEND_FROM_EMAIL = 'access@example.com';
});
afterEach(() => {
  jest.restoreAllMocks();
  env.RESEND_AUTH_EMAIL_ENABLED = false;
});

describe('account security API', () => {
  test('password changes require authentication and reject viewer, ordinary user, and demo accounts', async () => {
    expect((await request(app).post('/api/auth/change-password').send({})).status).toBe(401);
    for (const role of ['viewer', 'user']) {
      account.role = role;
      expect((await change(generateToken(claims({ role })))).status).toBe(403);
    }
    expect((await change(generateToken(claims({ role: 'viewer', demo: true })))).status).toBe(403);
    expect(authRepository.changeAdminPassword).not.toHaveBeenCalled();
  });

  test('requires the current password and rejects reusing it', async () => {
    const token = generateToken(claims());
    const incorrect = await change(token, { currentPassword: 'wrong', newPassword: 'replacement-password-456' });
    expect(incorrect.status).toBe(400);
    expect(incorrect.body.message).toContain('current password');
    expect((await change(token, { currentPassword: originalPassword, newPassword: originalPassword })).status).toBe(400);
    expect(authRepository.changeAdminPassword).not.toHaveBeenCalled();
  });

  test('rejects short passwords and bcrypt truncation, including multibyte passwords', async () => {
    for (const newPassword of ['short', 'a'.repeat(73), '🔐'.repeat(19)]) {
      expect((await change(generateToken(claims()), { currentPassword: originalPassword, newPassword })).status).toBe(400);
    }
    expect(authRepository.changeAdminPassword).not.toHaveBeenCalled();
  });

  test('hashes the new password, clears cookies, invalidates old access/refresh tokens, and permits a new login', async () => {
    const token = generateToken(claims());
    const refreshToken = generateRefreshToken(claims());
    const response = await change(token);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.join(';')).toContain('caseops_session=;');
    expect(account.password).not.toBe('replacement-password-456');
    expect(await bcrypt.compare('replacement-password-456', account.password)).toBe(true);
    expect(response.body.data).toEqual({ changed: true });
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get('/optional').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    const refresh = await request(app).post('/api/auth/refresh-token').set('Cookie', `caseops_session=${refreshToken}`).send({});
    expect(refresh.status).toBe(401);
    expect(refreshSessionRepository.rotate).not.toHaveBeenCalled();
    expect((await request(app).post('/api/auth/login').send({ email: account.email, password: originalPassword })).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: account.email, password: 'replacement-password-456' });
    expect(login.status).toBe(200);
    expect(verifyToken(login.body.data.token).authVersion).toBe(1);
    expect(login.body.data.user).not.toHaveProperty('password');
    expect(login.body.data).not.toHaveProperty('refreshToken');
    expect(login.headers['set-cookie']?.join(';')).toContain('HttpOnly');
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${login.body.data.token}`)).status).toBe(200);
  });

  test('enforces current account state for deleted accounts, role changes, and missing token versions', async () => {
    const token = generateToken(claims());
    account.role = 'viewer';
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    account.role = 'admin';
    const legacy = generateToken({ sub: 1, email: account.email, role: 'admin' });
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${legacy}`)).status).toBe(401);
    jest.spyOn(authRepository, 'findUserById').mockResolvedValue(undefined);
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  test('blocks login and token refresh until the account email is verified', async () => {
    account.emailVerifiedAt = null;
    const login = await request(app).post('/api/auth/login').send({ email: account.email, password: originalPassword });
    expect(login.status).toBe(403);
    expect(login.body.details.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(login.headers['set-cookie']).toBeUndefined();
    expect(refreshSessionRepository.create).not.toHaveBeenCalled();
    const refresh = await request(app).post('/api/auth/refresh-token')
      .set('Cookie', `caseops_session=${generateRefreshToken(claims())}`).send({});
    expect(refresh.status).toBe(401);
  });

  test('sends verification through Resend with only a hashed token persisted', async () => {
    account.emailVerifiedAt = null;
    const create = jest.spyOn(authRepository, 'createVerification').mockResolvedValue(true);
    const send = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    const response = await request(app).post('/api/auth/email-verification/resend')
      .send({ email: account.email, password: originalPassword });
    expect(response.status).toBe(200);
    expect(send.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    const init = send.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-resend-key' }));
    const email = JSON.parse(init.body as string);
    expect(email.to).toEqual([account.email]);
    const code = /verification code is: (\d{6})/.exec(email.text)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    const persisted = create.mock.calls[0]?.[0];
    expect(persisted?.kind).toBe('otp');
    expect(persisted?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted?.tokenHash).not.toBe(code);
    expect(persisted?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(response.body)).not.toContain(code!);
  });

  test('does not send during the per-account cooldown or for incorrect credentials', async () => {
    account.emailVerifiedAt = null;
    jest.spyOn(authRepository, 'createVerification').mockResolvedValue(false);
    const send = jest.spyOn(globalThis, 'fetch');
    const endpoint = '/api/auth/email-verification/resend';
    expect((await request(app).post(endpoint).send({ email: account.email, password: originalPassword })).status).toBe(200);
    expect((await request(app).post(endpoint).send({ email: account.email, password: 'wrong' })).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  test('reports provider failure and discards the unsent token so delivery can be retried', async () => {
    account.emailVerifiedAt = null;
    jest.spyOn(authRepository, 'createVerification').mockResolvedValue(true);
    const discard = jest.spyOn(authRepository, 'discardVerification').mockResolvedValue();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    const response = await request(app).post('/api/auth/email-verification/resend').send({ email: account.email, password: originalPassword });
    expect(response.status).toBe(503);
    expect(response.body.message).toContain('Email delivery');
    expect(discard).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
  });

  test('validates six-digit verification codes with account password and rejects reuse or incorrect codes', async () => {
    account.emailVerifiedAt = null;
    const verify = jest.spyOn(authRepository, 'verifyEmailCode').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const endpoint = '/api/auth/email-verification/verify-code';
    expect((await request(app).post(endpoint).send({ email: account.email, password: 'wrong', code: '123456' })).status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
    expect((await request(app).post(endpoint).send({ email: account.email, password: originalPassword, code: '12345' })).status).toBe(400);
    expect((await request(app).post(endpoint).send({ email: account.email, password: originalPassword, code: '123456' })).status).toBe(400);
    const success = await request(app).post(endpoint).send({ email: account.email, password: originalPassword, code: '123456' });
    expect(success.status).toBe(200);
    expect(success.body.data).toEqual({ verified: true });
    expect(success.headers['set-cookie']).toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  test('hashes submitted verification links and rejects expired, invalid, or used links', async () => {
    const verify = jest.spyOn(authRepository, 'verifyEmail').mockResolvedValueOnce(true).mockResolvedValue(false);
    const token = 'a'.repeat(64);
    const first = await request(app).post('/api/auth/email-verification/verify').send({ token });
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ verified: true });
    expect(first.headers['set-cookie']).toBeUndefined();
    expect(verify).toHaveBeenCalledWith(sha256(token));
    expect((await request(app).post('/api/auth/email-verification/verify').send({ token })).status).toBe(400);
  });

  test('invitation acceptance uses the atomic password and verification update', async () => {
    const invite = { id: 10, accessRequestId: 20, userId: 1, email: account.email, name: 'Reviewer',
      tokenHash: sha256('a'.repeat(64)), expiresAt: new Date(Date.now() + 60_000), usedAt: null, createdAt: new Date() };
    jest.spyOn(workspaceInviteRepository, 'findUsableByHash').mockResolvedValue(invite);
    const accept = jest.spyOn(authRepository, 'acceptInvite').mockResolvedValue({ user: { ...account, role: 'viewer', authVersion: 1 }, accessRequestId: 20 });
    jest.spyOn(accessRequestRepository, 'updateStatus').mockResolvedValue(undefined);
    const response = await request(app).post('/api/auth/invite/accept').send({ token: 'a'.repeat(64), password: 'invited-password-123' });
    expect(response.status).toBe(200);
    expect(accept.mock.calls[0]?.[0]).toBe(invite.tokenHash);
    expect(await bcrypt.compare('invited-password-123', accept.mock.calls[0]?.[1] as string)).toBe(true);
    expect(response.body.data.user.role).toBe('viewer');
  });
  test('password recovery returns a generic response and sends only a hashed 30-minute link', async () => {
    const create = jest.spyOn(authRepository, 'createPasswordReset').mockResolvedValue(true);
    const send = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    const response = await request(app).post('/api/auth/password-reset/request').send({ email: account.email });
    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatch(/If an eligible account exists/);
    expect(send.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    const mail = JSON.parse((send.mock.calls[0]?.[1] as RequestInit).body as string);
    const token = /#token=([a-f0-9]{64})/.exec(mail.text)?.[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      userId: account.id,
      tokenHash: sha256(token!)
    });
    expect(JSON.stringify(response.body)).not.toContain(token!);
  });

  test('password recovery remains generic for unknown accounts and within cooldown', async () => {
    const create = jest.spyOn(authRepository, 'createPasswordReset').mockResolvedValue(false);
    const send = jest.spyOn(globalThis, 'fetch');
    const known = await request(app).post('/api/auth/password-reset/request').send({ email: account.email });
    jest.spyOn(authRepository, 'findUserByEmail').mockResolvedValue(undefined);
    const unknown = await request(app).post('/api/auth/password-reset/request').send({ email: 'unknown@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data).toEqual(unknown.body.data);
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  test('password reset rejects invalid or used token and accepts a one-time valid token', async () => {
    const reset = jest.spyOn(authRepository, 'resetPassword')
      .mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const token = 'a'.repeat(64);
    const invalid = await request(app).post('/api/auth/password-reset/confirm')
      .send({ token, password: 'replacement-password-456' });
    expect(invalid.status).toBe(400);
    const valid = await request(app).post('/api/auth/password-reset/confirm')
      .send({ token, password: 'replacement-password-456' });
    expect(valid.status).toBe(200);
    expect(valid.body.data).toEqual({ reset: true });
    expect(reset.mock.calls[1]?.[0]).toBe(sha256(token));
    expect(await bcrypt.compare('replacement-password-456', reset.mock.calls[1]?.[1] as string)).toBe(true);
  });

});
