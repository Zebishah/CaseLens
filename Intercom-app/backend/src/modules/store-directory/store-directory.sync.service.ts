import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { boxClient, isBoxStoreDirectoryConfigured } from '../box/box.client.js';
import { parseStoreDirectoryWorkbook } from './store-directory.parser.js';
import { storeDirectoryRepository } from './store-directory.repository.js';
import { seedDevStoreDirectoryTestStores } from './store-directory.test-seed.js';

export type StoreDirectorySyncResult = {
  ok: boolean;
  skipped?: boolean;
  storesUpserted: number;
  missingSheets: string[];
  sheetStats: Array<{ sheetName: string; companySlug: string; rowCount: number }>;
  errorMessage?: string;
};

export const syncStoreDirectoryFromBox = async (
  source = 'manual'
): Promise<StoreDirectorySyncResult> => {
  if (!isBoxStoreDirectoryConfigured()) {
    logger.info('[store-directory] Sync skipped — Box env not configured');
    return {
      ok: true,
      skipped: true,
      storesUpserted: 0,
      missingSheets: [],
      sheetStats: []
    };
  }

  const boxFileId = env.BOX_FILE_ID!;
  const runId = await storeDirectoryRepository.startSyncRun({ source, boxFileId });

  try {
    const buffer = await boxClient.downloadFile(boxFileId);
    const parsed = await parseStoreDirectoryWorkbook(buffer);
    const storesUpserted = await storeDirectoryRepository.replaceDirectoryData(
      parsed.stores,
      parsed.fixedContacts
    );

    // Keep developer Intercom test store inboxes (10206 / dd1976) after Excel replace.
    if (env.NODE_ENV === 'development' || env.SEED_STORE_DIRECTORY_TEST) {
      await seedDevStoreDirectoryTestStores();
    }

    await storeDirectoryRepository.finishSyncRun({
      id: runId,
      status: 'succeeded',
      storesUpserted,
      meta: {
        sheetStats: parsed.sheetStats,
        missingSheets: parsed.missingSheets
      }
    });

    logger.info('[store-directory] Sync succeeded', {
      storesUpserted,
      sheetStats: parsed.sheetStats,
      missingSheets: parsed.missingSheets,
      source
    });

    return {
      ok: true,
      storesUpserted,
      missingSheets: parsed.missingSheets,
      sheetStats: parsed.sheetStats
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await storeDirectoryRepository.finishSyncRun({
      id: runId,
      status: 'failed',
      errorMessage
    });

    logger.error('[store-directory] Sync failed', { errorMessage, source });

    return {
      ok: false,
      storesUpserted: 0,
      missingSheets: [],
      sheetStats: [],
      errorMessage
    };
  }
};
