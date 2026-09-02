import { Router } from 'express';
import express from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { webhookRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { resendWebhookController } from './resend.webhook.controller.js';

export const resendWebhookRoutes = Router();

resendWebhookRoutes.post(
  '/webhooks/resend',
  webhookRateLimit,
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(resendWebhookController.handle)
);
