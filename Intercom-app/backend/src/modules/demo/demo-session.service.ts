import { randomBytes, createHash } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
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
    const eligibility = [
      eq(demoSessions.id, session.id),
      eq(demoSessions.active, true),
      eq(demoSessions.revoked, false),
      lt(demoSessions.expiresAt, new Date()) // replaced below with a current-time-safe predicate
    ];

    // Replace the expiry placeholder: the session must expire after the current time.
    eligibility[3] = sql`${demoSessions.expiresAt} > now()`;

    if (liveLlm) {
      eligibility.push(sql`${demoSessions.liveLlmCount} < ${demoSessions.maxLiveLlm}`);
    }

    const updated = await db
      .update(demoSessions)
      .set({
        caseSubmissionCount: sql`${demoSessions.caseSubmissionCount} + 1`,
        liveLlmCount: liveLlm
          ? sql`${demoSessions.liveLlmCount} + 1`
          : demoSessions.liveLlmCount
      })
      .where(
        and(
          ...eligibility,
          sql`${demoSessions.caseSubmissionCount} < ${demoSessions.maxCaseSubmissions}`
        )
      )
      .returning({ id: demoSessions.id });

    if (updated.length === 0) {
      throw AppError.badRequest(
        liveLlm
          ? 'This demo session is expired or has reached its case/live AI limit'
          : 'This demo session is expired or has reached its case submission limit'
      );
    }
  },

  async incrementEmail(sessionId: number): Promise<boolean> {
    const updated = await db
      .update(demoSessions)
      .set({ emailCount: sql`${demoSessions.emailCount} + 1` })
      .where(
        and(
          eq(demoSessions.id, sessionId),
          eq(demoSessions.active, true),
          eq(demoSessions.revoked, false),
          sql`${demoSessions.expiresAt} > now()`,
          sql`${demoSessions.emailCount} < ${demoSessions.maxEmails}`
        )
      )
      .returning({ id: demoSessions.id });

    return updated.length === 1;
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
