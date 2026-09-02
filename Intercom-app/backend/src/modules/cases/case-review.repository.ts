import { db } from '../../database/connection.js';
import { caseCorrections, caseFeedback } from '../../database/schema/case_review.js';
import { eq } from 'drizzle-orm';

export const caseReviewRepository = {
  async insertFeedback(input: { conversationId: number; rating: string; comment: string | null }) {
    const [saved] = await db
      .insert(caseFeedback)
      .values({
        conversationId: input.conversationId,
        rating: input.rating,
        comment: input.comment
      })
      .returning();
    return saved;
  },

  async insertCorrection(input: {
    conversationId: number;
    fieldName: string;
    originalValue: string | null;
    correctedValue: string;
    actorRole: string;
  }) {
    const [saved] = await db.insert(caseCorrections).values(input).returning();
    return saved;
  },

  async listFeedback(conversationId: number) {
    return db.select().from(caseFeedback).where(eq(caseFeedback.conversationId, conversationId));
  },

  async listCorrections(conversationId: number) {
    return db.select().from(caseCorrections).where(eq(caseCorrections.conversationId, conversationId));
  }
};
