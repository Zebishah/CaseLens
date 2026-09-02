/**
 * Inspect and optionally unlink the false "First Intercom" employee created by
 * automatic AI identity creation.
 *
 * Dry run (default):
 *   npm run db:cleanup-first-intercom
 *
 * Apply unlink + delete only when the identity has no remaining legitimate refs:
 *   npm run db:cleanup-first-intercom -- --confirm
 */
import { withScriptPgClient } from './pg-script-client.js';

const CONFIRM = process.argv.includes('--confirm');
const TARGET_NAME = 'First Intercom';

type IdentityRow = {
  id: number;
  canonical_name: string;
  email: string | null;
  store_number: string | null;
  company_domain: string | null;
  created_at: Date;
};

type ConversationRef = {
  id: number;
  intercom_id: string;
  subject: string | null;
  employee_identity_id: number | null;
  intelligence_status: string;
};

const looksLikeAutoCreatedTestIdentity = (identity: IdentityRow): boolean =>
  identity.canonical_name.trim().toLowerCase() === TARGET_NAME.toLowerCase() &&
  !identity.email;

await withScriptPgClient(async (client) => {
  const identities = await client.query<IdentityRow>(
    `SELECT id, canonical_name, email, store_number, company_domain, created_at
     FROM employee_identities
     WHERE lower(canonical_name) = lower($1)
     ORDER BY id`,
    [TARGET_NAME]
  );

  if (identities.rows.length === 0) {
    console.info(`No employee identity named "${TARGET_NAME}" was found.`);
    return;
  }

  for (const identity of identities.rows) {
    const conversationLinks = await client.query<ConversationRef>(
      `SELECT id, intercom_id, subject, employee_identity_id, intelligence_status
       FROM conversations
       WHERE employee_identity_id = $1
       ORDER BY id`,
      [identity.id]
    );
    const mentionLinks = await client.query<{ conversation_id: number; extracted_name: string | null }>(
      `SELECT conversation_id, extracted_name
       FROM conversation_employees
       WHERE employee_identity_id = $1`,
      [identity.id]
    );
    const aliases = await client.query<{ alias: string }>(
      `SELECT alias FROM employee_aliases WHERE employee_identity_id = $1`,
      [identity.id]
    );

    console.info('---');
    console.info('Identity:', identity);
    console.info('Auto-created test candidate:', looksLikeAutoCreatedTestIdentity(identity));
    console.info('Conversations.employee_identity_id refs:', conversationLinks.rows);
    console.info('conversation_employees refs:', mentionLinks.rows);
    console.info('Aliases:', aliases.rows.map((row) => row.alias));

    if (!CONFIRM) {
      console.info('Dry run only. Re-run with --confirm to unlink and delete if safe.');
      continue;
    }

    if (!looksLikeAutoCreatedTestIdentity(identity)) {
      console.info('Skipping delete — identity does not look like the auto-created test record.');
      continue;
    }

    await client.query('BEGIN');
    try {
      const affectedConversationIds = [
        ...new Set([
          ...conversationLinks.rows.map((row) => row.id),
          ...mentionLinks.rows.map((row) => row.conversation_id)
        ])
      ];

      await client.query(
        `UPDATE conversations
         SET employee_identity_id = NULL,
             intelligence_status = 'pending'
         WHERE employee_identity_id = $1`,
        [identity.id]
      );

      await client.query(
        `DELETE FROM conversation_employees WHERE employee_identity_id = $1`,
        [identity.id]
      );

      for (const conversationId of affectedConversationIds) {
        const snapshotResult = await client.query<{ intelligence_snapshot: unknown }>(
          `SELECT intelligence_snapshot FROM conversations WHERE id = $1`,
          [conversationId]
        );
        const snapshot = snapshotResult.rows[0]?.intelligence_snapshot;
        if (!snapshot || typeof snapshot !== 'object') {
          continue;
        }

        const nextSnapshot = {
          ...(snapshot as Record<string, unknown>),
          employeeMatches: [],
          mentionedInReport: [],
          relatedCases: [],
          employeeMentionStatus: 'no_employee_mentioned',
          unresolvedEmployeeMention: null,
          employeeMatchConfidence: 0,
          employeeSearchNotices: []
        };

        await client.query(
          `UPDATE conversations
           SET intelligence_snapshot = $2::jsonb,
               extracted_names = '[]'::jsonb,
               intelligence_status = 'pending'
           WHERE id = $1`,
          [conversationId, JSON.stringify(nextSnapshot)]
        );
      }

      const remainingConversations = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM conversations WHERE employee_identity_id = $1`,
        [identity.id]
      );
      const remainingMentions = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM conversation_employees WHERE employee_identity_id = $1`,
        [identity.id]
      );
      const remainingCount =
        Number(remainingConversations.rows[0]?.n ?? '0') + Number(remainingMentions.rows[0]?.n ?? '0');

      if (remainingCount === 0) {
        await client.query(`DELETE FROM employee_aliases WHERE employee_identity_id = $1`, [
          identity.id
        ]);
        await client.query(`DELETE FROM employee_identities WHERE id = $1`, [identity.id]);
        console.info(`Deleted auto-created identity ${identity.id} and marked cases for re-analysis.`);
      } else {
        console.info(
          `Unlinked false associations for identity ${identity.id} but did not delete it because references remain.`
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
});
