import { eq, inArray } from 'drizzle-orm';
import type { EmployeeMatchMethod } from '../../constants/intelligence.constants.js';
import { db } from '../../database/connection.js';
import { conversationEmployees } from '../../database/schema/conversation_employees.js';

export type ConversationEmployeeRecord = typeof conversationEmployees.$inferSelect;

export const conversationEmployeesRepository = {
  async replaceForConversation(
    conversationId: number,
    rows: Array<{
      employeeIdentityId: number;
      extractedName: string;
      confidenceScore: number;
      matchMethod: EmployeeMatchMethod;
    }>
  ): Promise<void> {
    await db.delete(conversationEmployees).where(eq(conversationEmployees.conversationId, conversationId));

    if (rows.length === 0) {
      return;
    }

    await db.insert(conversationEmployees).values(
      rows.map((row) => ({
        conversationId,
        employeeIdentityId: row.employeeIdentityId,
        extractedName: row.extractedName,
        confidenceScore: row.confidenceScore,
        matchMethod: row.matchMethod
      }))
    );
  },

  async findByConversationId(conversationId: number): Promise<ConversationEmployeeRecord[]> {
    return db.query.conversationEmployees.findMany({
      where: eq(conversationEmployees.conversationId, conversationId)
    });
  },

  async findMentionsByEmployeeIdentityIds(
    employeeIdentityIds: number[]
  ): Promise<ConversationEmployeeRecord[]> {
    if (employeeIdentityIds.length === 0) {
      return [];
    }

    return db.query.conversationEmployees.findMany({
      where: inArray(conversationEmployees.employeeIdentityId, employeeIdentityIds)
    });
  }
};
