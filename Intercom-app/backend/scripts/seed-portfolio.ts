import { eq } from 'drizzle-orm';
import { db } from '../src/database/connection.js';
import { companies } from '../src/database/schema/companies.js';
import { companyFixedContacts } from '../src/database/schema/company_fixed_contacts.js';
import { storeDirectory } from '../src/database/schema/store_directory.js';
import { employeeIdentities } from '../src/database/schema/employee_identities.js';
import { conversations } from '../src/database/schema/conversations.js';
import { conversationMessages } from '../src/database/schema/conversation_messages.js';

const seedCompanies = [
  {
    slug: 'northwind-bakery',
    name: 'Northwind Bakery',
    sheetName: 'Northwind Bakery - Store Directory',
    stores: [
      {
        storeNumber: '1042',
        storeName: 'Harbor West',
        vpName: 'Pat Quinn',
        vpEmail: 'pat.quinn@northwind.co',
        directorName: 'Riley Ames',
        directorEmail: 'riley.ames@northwind.co',
        districtManagerName: 'Casey Cole',
        districtManagerEmail: 'casey.cole@northwind.co'
      }
    ],
    contacts: [{ name: 'HR Group', email: 'hr@northwind.co', role: 'HR' }]
  },
  {
    slug: 'helix-hospitality',
    name: 'Helix Hospitality',
    sheetName: 'Helix Hospitality - Store Directory',
    stores: [
      {
        storeNumber: '2218',
        storeName: 'Midtown Inn',
        districtManagerName: 'Morgan Blake DM',
        districtManagerEmail: 'dm.2218@helix.co'
      }
    ],
    contacts: [
      { name: 'HR Group', email: 'hr@helix.co', role: 'HR' },
      { name: 'Leave Desk', email: 'leave@helix.co', role: 'Leave Team' }
    ]
  },
  {
    slug: 'meridian-holdings',
    name: 'Meridian Holdings',
    sheetName: 'Meridian Holdings - Store Directory',
    stores: [
      {
        storeNumber: '3301',
        storeName: 'River Plaza',
        ownerName: 'Avery Dahl',
        ownerEmail: 'avery.dahl@meridian.co'
      }
    ],
    contacts: []
  }
];

const upsertCompany = async (slug: string, name: string, sheetName: string) => {
  const existing = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db.insert(companies).values({ slug, name, sheetName }).returning();
  return created;
};

const main = async (): Promise<void> => {
  for (const company of seedCompanies) {
    const row = await upsertCompany(company.slug, company.name, company.sheetName);
    for (const contact of company.contacts) {
      await db.insert(companyFixedContacts).values({
        companyId: row.id,
        name: contact.name,
        email: contact.email,
        role: contact.role,
        sortOrder: 0
      });
    }

    for (const store of company.stores) {
      await db.insert(storeDirectory).values({
        companyId: row.id,
        storeNumber: store.storeNumber,
        storeName: store.storeName,
        vpName: store.vpName ?? null,
        vpEmail: store.vpEmail ?? null,
        directorName: store.directorName ?? null,
        directorEmail: store.directorEmail ?? null,
        districtManagerName: store.districtManagerName ?? null,
        districtManagerEmail: store.districtManagerEmail ?? null,
        ownerName: store.ownerName ?? null,
        ownerEmail: store.ownerEmail ?? null
      });
    }
  }

  const [jordan] = await db
    .insert(employeeIdentities)
    .values({
      canonicalName: 'Jordan Hale',
      email: 'jordan.hale@northwind.co',
      storeNumber: '1042',
      companyDomain: 'northwind.co'
    })
    .returning();

  await db.insert(employeeIdentities).values({
    canonicalName: 'Riley Chen',
    email: 'riley.chen@northwind.co',
    storeNumber: '1042',
    companyDomain: 'northwind.co'
  });

  const [historical] = await db
    .insert(conversations)
    .values({
      intercomId: 'demo:seed-related-jordan-hale',
      source: 'demo',
      subject: 'Attendance warning — Jordan Hale',
      status: 'closed',
      reporterName: 'Store 1042 Manager',
      reporterEmail: '1042@northwind.co',
      reporterStoreNumber: '1042',
      reporterCompanyDomain: 'northwind.co',
      caseType: 'attendance',
      employeeIdentityId: jordan.id,
      intelligenceStatus: 'ready',
      processingMode: 'fixture'
    })
    .returning();

  await db.insert(conversationMessages).values({
    conversationId: historical.id,
    intercomPartId: 'demo:seed-related-jordan-hale-initial',
    senderType: 'user',
    messageBody: 'Jordan Hale received a written attendance warning last month at store 1042.'
  });

  console.log('Portfolio seed data loaded');
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
