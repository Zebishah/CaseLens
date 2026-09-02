import { MESSAGES } from '../constants/messages.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(STATUS_CODES.BAD_REQUEST, message, details);
  }

  static unauthorized(message: string = MESSAGES.UNAUTHORIZED): AppError {
    return new AppError(STATUS_CODES.UNAUTHORIZED, message);
  }

  static notFound(message: string = MESSAGES.USER_NOT_FOUND): AppError {
    return new AppError(STATUS_CODES.NOT_FOUND, message);
  }

  static conflict(message: string): AppError {
    return new AppError(STATUS_CODES.CONFLICT, message);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(STATUS_CODES.FORBIDDEN, message);
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(STATUS_CODES.SERVICE_UNAVAILABLE, message);
  }
}
