import { ZodError } from 'zod';

type SafeActorErrorDetails = {
  errorType: string;
  errorCode?: string;
  validationIssues?: Array<{
    path: Array<string | number>;
    code: string;
    message: string;
  }>;
};

export const safeActorErrorDetails = (
  error: unknown,
): SafeActorErrorDetails => {
  const errorType = error instanceof Error ? error.name : 'UnknownError';

  if (error instanceof ZodError) {
    return {
      errorType,
      validationIssues: error.issues.map(({ path, code, message }) => ({
        path,
        code,
        message,
      })),
    };
  }

  const rawCode =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const errorCode =
    typeof rawCode === 'string' && /^[A-Z0-9_-]{2,32}$/.test(rawCode)
      ? rawCode
      : undefined;
  const statusCode =
    error && typeof error === 'object' && 'statusCode' in error
      ? error.statusCode
      : undefined;
  const safeStatusCode =
    errorCode === undefined &&
    typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
      ? `HTTP_${statusCode}`
      : undefined;

  return {
    errorType,
    ...((errorCode ?? safeStatusCode)
      ? { errorCode: errorCode ?? safeStatusCode }
      : {}),
  };
};
