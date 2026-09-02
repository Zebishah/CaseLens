import { and, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { companies } from '../../database/schema/companies.js';
import { companyFixedContacts } from '../../database/schema/company_fixed_contacts.js';
import { storeDirectory } from '../../database/schema/store_directory.js';
import { logger } from '../../config/logger.config.js';

type DevTestStore = {
  companySlug: 'northwind-bakery' | 'helix-hospitality' | 'meridian-holdings';
  storeNumber: string;
  storeName: string;
  vpName?: string | null;
  vpEmail?: string | null;
  directorName?: string | null;
  directorEmail?: string | null;
  districtManagerName?: string | null;
  districtManagerEmail?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
};

/**
 * Maps our Intercom test store inboxes → company CC rules so developers can
 * open existing test conversations and see the CC section.
 *
 * Store emails already used in this workspace:
 * - 10206@demoops.co  → Northwind Bakery (also has a CHC duplicate decoy)
 * - dd1976@demoops.co → Helix Hospitality (also has a Premium duplicate decoy)
 *
 * Duplicate rows intentionally use different work-email domains so the
 * sender-domain tie-breaker can be UAT'd with real Intercom conversations.
 */
const DEV_TEST_STORES: DevTestStore[] = [
  // 10206 — Premium should win for sender 10206@demoops.co
  {
    companySlug: 'northwind-bakery',
    storeNumber: '10206',
    storeName: 'DEV TEST — Demo store 10206 (Northwind)',
    vpName: 'Dev VP (test)',
    vpEmail: 'vp@demoops.co',
    directorName: 'Dev Director (test)',
    directorEmail: 'director@demoops.co',
    districtManagerName: 'Dev District Manager (test)',
    districtManagerEmail: '10206@demoops.co'
  },
  // 10206 decoy — CHC row with @helix.co (must NOT win for demoops sender)
  {
    companySlug: 'helix-hospitality',
    storeNumber: '10206',
    storeName: 'DEV TEST — duplicate store 10206 (CHC decoy)',
    districtManagerName: 'CHC Decoy DM',
    districtManagerEmail: '10206-decoy@helix.co'
  },
  // dd1976 — CHC should win for sender dd1976@demoops.co
  {
    companySlug: 'helix-hospitality',
    storeNumber: 'dd1976',
    storeName: 'DEV TEST — Demo store dd1976 (Helix)',
    districtManagerName: 'Dev CHC DM (test)',
    districtManagerEmail: 'dd1976@demoops.co'
  },
  // dd1976 decoy — Premium row with @northwind.co (must NOT win for demoops sender)
  {
    companySlug: 'northwind-bakery',
    storeNumber: 'dd1976',
    storeName: 'DEV TEST — duplicate store dd1976 (Premium decoy)',
    vpName: 'Premium Decoy VP',
    vpEmail: 'vp-decoy@northwind.co',
    directorName: 'Premium Decoy Director',
    directorEmail: 'dir-decoy@northwind.co',
    districtManagerName: 'Premium Decoy DM',
    districtManagerEmail: 'dd1976-decoy@northwind.co'
  }
];

export const seedDevStoreDirectoryTestStores = async (): Promise<{
  upserted: number;
  storeNumbers: string[];
}> => {
  const companyRows = await db
    .select({ id: companies.id, slug: companies.slug })
    .from(companies);

  const companyIdBySlug = new Map(companyRows.map((row) => [row.slug, row.id]));
  let upserted = 0;
  const storeNumbers: string[] = [];

  for (const store of DEV_TEST_STORES) {
    const companyId = companyIdBySlug.get(store.companySlug);
    if (!companyId) {
      logger.warn('[store-directory] Skipping test seed — company missing (run Box sync first)', {
        companySlug: store.companySlug,
        storeNumber: store.storeNumber
      });
      continue;
    }

    const existing = await db
      .select({ id: storeDirectory.id })
      .from(storeDirectory)
      .where(
        and(
          eq(storeDirectory.companyId, companyId),
          eq(storeDirectory.storeNumber, store.storeNumber)
        )
      )
      .limit(1);

    const values = {
      companyId,
      storeNumber: store.storeNumber,
      storeName: store.storeName,
      vpName: store.vpName ?? null,
      vpEmail: store.vpEmail ?? null,
      directorName: store.directorName ?? null,
      directorEmail: store.directorEmail ?? null,
      districtManagerName: store.districtManagerName ?? null,
      districtManagerEmail: store.districtManagerEmail ?? null,
      ownerName: store.ownerName ?? null,
      ownerEmail: store.ownerEmail ?? null,
      rawRow: { source: 'dev-test-seed', duplicateDomainTest: 'true' },
      updatedAt: new Date()
    };

    if (existing[0]) {
      await db
        .update(storeDirectory)
        .set(values)
        .where(eq(storeDirectory.id, existing[0].id));
    } else {
      await db.insert(storeDirectory).values(values);
    }

    upserted += 1;
    storeNumbers.push(`${store.storeNumber}@${store.companySlug}`);
  }

  // Ensure CHC fixed HR contact exists (needed for dd1976 CC list).
  const chcId = companyIdBySlug.get('helix-hospitality');
  if (chcId) {
    const fixed = await db
      .select({ id: companyFixedContacts.id })
      .from(companyFixedContacts)
      .where(eq(companyFixedContacts.companyId, chcId))
      .limit(1);

    if (fixed.length === 0) {
      await db.insert(companyFixedContacts).values({
        companyId: chcId,
        name: 'HR Group',
        email: 'hr@helix.co',
        role: 'HR',
        sortOrder: 0
      });
    }
  }

  logger.info('[store-directory] Dev test stores seeded', { upserted, storeNumbers });
  return { upserted, storeNumbers };
};
