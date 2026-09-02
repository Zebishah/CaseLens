import 'dotenv/config';
import { eq } from 'drizzle-orm';
import {
  EMPLOYEE_MATCH_METHOD,
  INTELLIGENCE_STATUS
} from '../src/constants/intelligence.constants.js';
import { INTERCOM_CASE_TYPES } from '../src/constants/intercom.constants.js';
import { db } from '../src/database/connection.js';
import {
  conversationMessages,
  conversations,
  employeeAliases,
  employeeIdentities
} from '../src/database/schema/index.js';

const seed = async (): Promise<void> => {
  const existing = await db.query.employeeIdentities.findFirst({
    where: eq(employeeIdentities.canonicalName, 'Jonathan Fritz')
  });

  if (existing) {
    console.info('Milestone 1 seed already applied (Jonathan Fritz identity exists). Skipping.');
    return;
  }

  const [identity] = await db
    .insert(employeeIdentities)
    .values({
      canonicalName: 'Jonathan Fritz',
      email: 'jonathan.fritz@example.com',
      intercomContactId: 'seed-contact-145'
    })
    .returning();

  await db.insert(employeeAliases).values([
    {
      employeeIdentityId: identity.id,
      alias: 'Jonathan Fritz',
      confidenceScore: '100',
      matchMethod: EMPLOYEE_MATCH_METHOD.EXACT
    },
    {
      employeeIdentityId: identity.id,
      alias: 'Jon Fritz',
      confidenceScore: '93',
      matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
    },
    {
      employeeIdentityId: identity.id,
      alias: 'Johnathan Fritz',
      confidenceScore: '88',
      matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
    }
  ]);

  const historicalCases = [
    {
      intercomId: 'seed-conv-001',
      subject: 'Misconduct — workplace behavior',
      status: 'closed',
      caseType: INTERCOM_CASE_TYPES.MISCONDUCT,
      daysAgo: 90,
      advisorName: 'Crystal'
    },
    {
      intercomId: 'seed-conv-002',
      subject: 'Attendance warning — late arrivals',
      status: 'closed',
      caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
      daysAgo: 14,
      advisorName: 'Phoebe'
    },
    {
      intercomId: 'seed-conv-003',
      subject: 'Coaching check-in',
      status: 'closed',
      caseType: INTERCOM_CASE_TYPES.COACHING,
      daysAgo: 45,
      advisorName: 'Crystal'
    }
  ] as const;

  for (const item of historicalCases) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - item.daysAgo);

    const [conversation] = await db
      .insert(conversations)
      .values({
        intercomId: item.intercomId,
        subject: item.subject,
        status: item.status,
        reporterName: 'Jon Fritz',
        reporterEmail: 'jonathan.fritz@example.com',
        companyName: 'Acme Corp',
        intercomContactId: 'seed-contact-145',
        employeeIdentityId: identity.id,
        intelligenceStatus: INTELLIGENCE_STATUS.READY,
        intelligenceSnapshot: {
          employeeMatches: [
            {
              employeeIdentityId: identity.id,
              canonicalName: identity.canonicalName,
              confidenceScore: 93,
              matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
            }
          ],
          relatedCases: [],
          processedAt: new Date().toISOString()
        },
        rawPayload: {
          tags: [{ name: item.caseType }],
          assigned_admin: { name: item.advisorName }
        },
        createdAt,
        updatedAt: createdAt
      })
      .returning();

    await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      intercomPartId: `${item.intercomId}-part-1`,
      senderType: 'user',
      messageBody: `Seed message for ${item.subject}`,
      createdAt
    });
  }

  const [activeConversation] = await db
    .insert(conversations)
    .values({
      intercomId: 'seed-conv-active',
      subject: 'New attendance concern',
      status: 'open',
      reporterName: 'Jon Fritz',
      reporterEmail: 'jonathan.fritz@example.com',
      companyName: 'Acme Corp',
      intercomContactId: 'seed-contact-145',
      employeeIdentityId: identity.id,
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      rawPayload: { source: 'seed' },
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();

  console.info('Milestone 1 seed complete:', {
    employeeIdentityId: identity.id,
    historicalConversations: historicalCases.length,
    activeConversationId: activeConversation.id
  });
};

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
