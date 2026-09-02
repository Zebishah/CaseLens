/**
 * Unlink a false "Si" employee mention created from the typo subject
 * "this si the issue that is faced and test workspace".
 *
 * Dry run:
 *   npm run db:cleanup-si
 *
 * Apply:
 *   npm run db:cleanup-si -- --confirm
 */
import { withScriptPgClient } from './pg-script-client.js';

const CONFIRM = process.argv.includes('--confirm');
const TARGET_NAME = 'Si';
const TARGET_INTERCOM_ID = '215475747341731';

type IdentityRow = {
  id: number;
  canonical_name: string;
  email: string | null;
};

type ConversationRef = {
  id: number;
  intercom_id: string;
  subject: string | null;
  employee_identity_id: number | null;
};

await withScriptPgClient(async (client) => {
  const conversations = await client.query<ConversationRef>(
    `SELECT id, intercom_id, subject, employee_identity_id
     FROM conversations
     WHERE intercom_id = $1
        OR subject ILIKE '%this si the issue%'
     ORDER BY id`,
    [TARGET_INTERCOM_ID]
  );

  const identities = await client.query<IdentityRow>(
    `SELECT id, canonical_name, email
     FROM employee_identities
     WHERE lower(canonical_name) = lower($1)
     ORDER BY id`,
    [TARGET_NAME]
  );

  const mentionLinks = await client.query<{
    conversation_id: number;
    extracted_name: string | null;
    employee_identity_id: number;
  }>(
    `SELECT conversation_id, extracted_name, employee_identity_id
     FROM conversation_employees
     WHERE lower(extracted_name) = lower($1)
        OR employee_identity_id = ANY($2::int[])`,
    [TARGET_NAME, identities.rows.map((row) => row.id)]
  );

  console.info('Conversations:', conversations.rows);
  console.info('Si identities:', identities.rows);
  console.info('Si mention links:', mentionLinks.rows);

  if (!CONFIRM) {
    console.info('Dry run only. Re-run with --confirm to unlink Si and clear the false mention.');
    return;
  }

  await client.query('BEGIN');
  try {
    for (const conversation of conversations.rows) {
      await client.query(
        `UPDATE conversations
         SET employee_identity_id = NULL
         WHERE id = $1 AND employee_identity_id IS NOT NULL`,
        [conversation.id]
      );

      const snapshotResult = await client.query<{ intelligence_snapshot: unknown }>(
        `SELECT intelligence_snapshot FROM conversations WHERE id = $1`,
        [conversation.id]
      );
      const snapshot = snapshotResult.rows[0]?.intelligence_snapshot;
      if (snapshot && typeof snapshot === 'object') {
        const nextSnapshot = {
          ...(snapshot as Record<string, unknown>),
          employeeMatches: [],
          mentionedInReport: [],
          relatedCases: [],
          employeeMentionStatus: 'no_employee_mentioned',
          unresolvedEmployeeMention: null,
          employeeMatchConfidence: 0,
          requiresManualReview: false
        };
        await client.query(
          `UPDATE conversations
           SET intelligence_snapshot = $2::jsonb,
               extracted_names = '[]'::jsonb,
               case_type = 'general'
           WHERE id = $1`,
          [conversation.id, JSON.stringify(nextSnapshot)]
        );
      }
    }

    await client.query(
      `DELETE FROM conversation_employees
       WHERE lower(extracted_name) = lower($1)
          OR employee_identity_id = ANY($2::int[])`,
      [TARGET_NAME, identities.rows.map((row) => row.id)]
    );

    for (const identity of identities.rows) {
      if (identity.email) {
        console.info(`Keeping identity ${identity.id} because it has an email.`);
        continue;
      }

      const remaining = await client.query<{ n: string }>(
        `SELECT (
           (SELECT COUNT(*) FROM conversations WHERE employee_identity_id = $1) +
           (SELECT COUNT(*) FROM conversation_employees WHERE employee_identity_id = $1)
         )::text AS n`,
        [identity.id]
      );
      if (Number(remaining.rows[0]?.n ?? '0') === 0) {
        await client.query(`DELETE FROM employee_aliases WHERE employee_identity_id = $1`, [
          identity.id
        ]);
        await client.query(`DELETE FROM employee_identities WHERE id = $1`, [identity.id]);
        console.info(`Deleted identity ${identity.id}.`);
      }
    }

    await client.query('COMMIT');
    console.info('Si associations removed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
});
