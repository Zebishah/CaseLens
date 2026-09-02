import { integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { conversations } from './conversations.js';
import { vector1536 } from './pg-vector.js';

export const conversationMessages = pgTable('conversation_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  intercomPartId: varchar('intercom_part_id', { length: 100 }).unique(),
  senderType: varchar('sender_type', { length: 50 }),
  senderId: varchar('sender_id', { length: 100 }),
  messageBody: text('message_body'),
  embeddingVector: vector1536('embedding_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
