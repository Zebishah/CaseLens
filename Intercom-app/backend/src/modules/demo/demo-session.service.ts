import { randomBytes, createHash } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { env } from '../../config/env.config.js';
import { db } from '../../database/connection.js';
import { demoSessions, type DemoSessionRow } from '../../database/schema/demo_sessions.js';
import { AppError } from '../../utils/error.util.js';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const receivingDomain = (): string => env.RESEND_RECEIVING_DOMAIN ?? 'inbox.caseops.example';

export const demoSessionService = {
  hashToken,

  async create(): Promise<{ token: string; session: DemoSessionRow; receivingAddress: string }> {
    const token = randomBytes(24).toString('hex');
    const receivingAddress = `case-${token}@${receivingDomain()}`.toLowerCase();
    const expiresAt = new Date(Date.now() + env.DEMO_SESSION_TTL_HOURS * 60 * 60 * 1000);

    const [session] = await db
      .insert(demoSessions)
      .values({
        tokenHash: hashToken(token),
        receivingAddress,
        maxEmails: env.DEMO_MAX_EMAILS,
        maxCaseSubmissions: env.DEMO_MAX_SAMPLE_CASES,
        maxLiveLlm: env.DEMO_MAX_LIVE_LLM,
        expiresAt
      })
      .returning();

    return { token, session, receivingAddress };
  },

  async requireActive(token: string): Promise<DemoSessionRow> {
    const [session] = await db
      .select()
      .from(demoSessions)
      .where(eq(demoSessions.tokenHash, hashToken(token)))
      .limit(1);

    if (!session || session.revoked || !session.active || session.expiresAt.getTime() < Date.now()) {
      throw AppError.unauthorized('Demo session is missing, expired, or revoked');
    }

    return session;
  },

  publicView(session: DemoSessionRow, token?: string) {
    return {
      token: token ?? undefined,
      receivingAddress: session.receivingAddress,
      expiresAt: session.expiresAt.toISOString(),
      emailCount: session.emailCount,
      maxEmails: session.maxEmails,
      caseSubmissionCount: session.caseSubmissionCount,
      maxCaseSubmissions: session.maxCaseSubmissions,
      liveLlmCount: session.liveLlmCount,
      maxLiveLlm: session.maxLiveLlm,
      remainingEmails: Math.max(0, session.maxEmails - session.emailCount),
      remainingCases: Math.max(0, session.maxCaseSubmissions - session.caseSubmissionCount),
      remainingLiveLlm: Math.max(0, session.maxLiveLlm - session.liveLlmCount)
    };
  },

  async incrementCaseSubmission(session: DemoSessionRow, liveLlm: boolean): Promise<void> {
    if (session.caseSubmissionCount >= session.maxCaseSubmissions) {
      throw AppError.badRequest('This demo session has reached its case submission limit');
    }

    if (liveLlm && session.liveLlmCount >= session.maxLiveLlm) {
      throw AppError.badRequest('This demo session has reached its live LLM limit');
    }

    await db
      .update(demoSessions)
      .set({
        caseSubmissionCount: session.caseSubmissionCount + 1,
        liveLlmCount: liveLlm ? session.liveLlmCount + 1 : session.liveLlmCount
      })
      .where(eq(demoSessions.id, session.id));
  },

  async incrementEmail(sessionId: number): Promise<boolean> {
    const [session] = await db
      .select()
      .from(demoSessions)
      .where(eq(demoSessions.id, sessionId))
      .limit(1);
    if (!session || session.emailCount >= session.maxEmails) {
      return false;
    }

    await db
      .update(demoSessions)
      .set({ emailCount: session.emailCount + 1 })
      .where(eq(demoSessions.id, session.id));
    return true;
  },

  async findByReceivingAddress(address: string): Promise<DemoSessionRow | undefined> {
    const [session] = await db
      .select()
      .from(demoSessions)
      .where(eq(demoSessions.receivingAddress, address.trim().toLowerCase()))
      .limit(1);
    return session;
  },

  async purgeExpired(): Promise<number> {
    const expired = await db
      .update(demoSessions)
      .set({ active: false })
      .where(and(eq(demoSessions.active, true), lt(demoSessions.expiresAt, new Date())))
      .returning({ id: demoSessions.id });
    return expired.length;
  }
};
