import { relations } from 'drizzle-orm';
import { conversationEmployees } from './conversation_employees.js';
import { conversationMessages } from './conversation_messages.js';
import { conversations } from './conversations.js';
import { employeeAliases } from './employee_aliases.js';
import { employeeIdentities } from './employee_identities.js';

export const employeeIdentitiesRelations = relations(employeeIdentities, ({ many }) => ({
  aliases: many(employeeAliases),
  conversations: many(conversations)
}));

export const employeeAliasesRelations = relations(employeeAliases, ({ one }) => ({
  employeeIdentity: one(employeeIdentities, {
    fields: [employeeAliases.employeeIdentityId],
    references: [employeeIdentities.id]
  })
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  employeeIdentity: one(employeeIdentities, {
    fields: [conversations.employeeIdentityId],
    references: [employeeIdentities.id]
  }),
  messages: many(conversationMessages),
  conversationEmployees: many(conversationEmployees)
}));

export const conversationEmployeesRelations = relations(conversationEmployees, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationEmployees.conversationId],
    references: [conversations.id]
  }),
  employeeIdentity: one(employeeIdentities, {
    fields: [conversationEmployees.employeeIdentityId],
    references: [employeeIdentities.id]
  })
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id]
  })
}));
