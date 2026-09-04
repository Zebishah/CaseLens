import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.util.js';
import { db } from '../../database/connection.js';
import { companies } from '../../database/schema/companies.js';
import { employeeIdentities } from '../../database/schema/employee_identities.js';
import { storeDirectory } from '../../database/schema/store_directory.js';
import { companyFixedContacts } from '../../database/schema/company_fixed_contacts.js';
import { storeDirectorySyncRuns } from '../../database/schema/store_directory_sync_runs.js';
import { desc } from 'drizzle-orm';
import { AppError } from '../../utils/error.util.js';
import { enqueueStoreDirectorySync } from '../../queues/store-directory-sync.queue.js';
import { isBoxStoreDirectoryConfigured } from '../box/box.client.js';
import { storeDirectoryRepository } from '../store-directory/store-directory.repository.js';
import { parseDirectoryUpload } from './directory.import.js';
import { ROLES } from '../../constants/roles.js';

export const directoryController = {
  async list(req: Request, res: Response): Promise<void> {
    const isAdmin = req.user?.role === ROLES.ADMIN;
    const companyRows = await db.select().from(companies);
    const stores = await db.select().from(storeDirectory);
    const contacts = await db.select().from(companyFixedContacts);
    const employees = await db
      .select({
        id: employeeIdentities.id,
        canonicalName: employeeIdentities.canonicalName,
        storeNumber: employeeIdentities.storeNumber,
        companyDomain: employeeIdentities.companyDomain
      })
      .from(employeeIdentities)
      .limit(100);
    const runs = isAdmin
      ? await db
          .select()
          .from(storeDirectorySyncRuns)
          .orderBy(desc(storeDirectorySyncRuns.startedAt))
          .limit(10)
      : [];

    sendSuccess(res, {
      companies: companyRows,
      stores,
      employees,
      fixedContacts: contacts,
      importHistory: runs.map((run) => ({
        id: run.id,
        status: run.status,
        source: run.source,
        storesUpserted: run.storesUpserted,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt
      })),
      boxConfigured: isAdmin && isBoxStoreDirectoryConfigured()
    });
  },

  async replayBox(_req: Request, res: Response): Promise<void> {
    if (!isBoxStoreDirectoryConfigured()) {
      throw AppError.badRequest('Box sync is disabled or not configured');
    }

    await enqueueStoreDirectorySync('manual-replay');
    sendSuccess(res, { queued: true });
  },

  async importFile(req: Request, res: Response): Promise<void> {
    const running = await storeDirectoryRepository.findRunningSync();
    if (running) {
      throw AppError.conflict('A directory synchronization job is already running');
    }

    const body = req.body as { csv?: string; xlsxBase64?: string };
    const stores = await parseDirectoryUpload(body);
    const runId = await storeDirectoryRepository.startSyncRun({ source: body.csv ? 'csv-import' : 'xlsx-import' });

    try {
      const storesUpserted = await storeDirectoryRepository.replaceDirectoryData(stores, []);
      await storeDirectoryRepository.finishSyncRun({
        id: runId,
        status: 'succeeded',
        storesUpserted,
        meta: { rowCount: stores.length }
      });
      sendSuccess(res, { storesUpserted, runId });
    } catch (error) {
      await storeDirectoryRepository.finishSyncRun({
        id: runId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message.slice(0, 280) : 'Import failed'
      });
      throw error;
    }
  }
};
