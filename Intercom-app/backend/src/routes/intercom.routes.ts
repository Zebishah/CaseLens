import { Router } from 'express';
import { canvasRoutes } from '../modules/canvas/canvas.routes.js';
import { webhookRoutes } from '../modules/webhook/webhook.routes.js';

export const intercomRoutes = Router();

intercomRoutes.use('/webhooks', webhookRoutes);
intercomRoutes.use('/canvas', canvasRoutes);
/** Developer Hub often prefixes Canvas URLs with /intercom. */
intercomRoutes.use('/intercom/canvas', canvasRoutes);
