import type { Response } from 'express';
import { STATUS_CODES } from '../constants/statusCodes.js';

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  message: string;
  details?: unknown;
};

export const successResponse = <T>(data: T): ApiSuccess<T> => ({
  success: true,
  data
});

export const errorResponse = (message: string, details?: unknown): ApiErrorBody => ({
  success: false,
  message,
  ...(details !== undefined ? { details } : {})
});

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = STATUS_CODES.OK
): void => {
  res.status(statusCode).json(successResponse(data));
};
