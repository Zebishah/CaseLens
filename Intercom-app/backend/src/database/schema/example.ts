import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * @swagger
 * components:
 *   schemas:
 *     Example:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         message:
 *           type: string
 */
export const examples = pgTable('examples', {
  id: serial('id').primaryKey(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
