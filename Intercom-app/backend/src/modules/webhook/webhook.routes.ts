import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import {
  intercomWebhookRawBody,
  verifyIntercomWebhook
} from '../../middlewares/intercomWebhook.middleware.js';
import { webhookController } from './webhook.controller.js';

export const webhookRoutes = Router();

/** Intercom sends HEAD to validate the endpoint URL when you click Save. */
webhookRoutes.head('/intercom', (_req: Request, res: Response) => {
  res.sendStatus(200);
});

webhookRoutes.post(
  '/intercom',
  intercomWebhookRawBody,
  verifyIntercomWebhook,
  asyncHandler(webhookController.handleIntercomWebhook)
);
