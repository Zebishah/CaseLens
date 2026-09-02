import { CANVAS_COPY } from '../../constants/canvas.constants.js';
import { isQuotaExhaustedError } from '../intelligence/intelligence-attempt.util.js';
import { isTransientNetworkError } from '../../utils/retry.util.js';

const toErrorText = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
};

const looksLikeDatabaseError = (message: string): boolean =>
  /database|could not reach|ECONNREFUSED|ENOTFOUND|connection terminated/i.test(message);

/** Client-facing error copy only — never surface Gemini, SQL, or stack text in Intercom. */
export const toPublicCanvasErrorMessage = (error?: unknown): string => {
  const raw = toErrorText(error).trim();
  if (!raw) {
    return CANVAS_COPY.FAILED_DETAIL;
  }

  if (isQuotaExhaustedError(raw)) {
    return CANVAS_COPY.FAILED_BUSY;
  }

  if (error instanceof Error && isTransientNetworkError(error)) {
    return CANVAS_COPY.DB_UNAVAILABLE;
  }

  if (looksLikeDatabaseError(raw) || isTransientNetworkError(new Error(raw))) {
    return CANVAS_COPY.DB_UNAVAILABLE;
  }

  return CANVAS_COPY.FAILED_DETAIL;
};
