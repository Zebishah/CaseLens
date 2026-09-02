import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { publicDemoRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { demoController } from './demo.controller.js';

export const demoRoutes = Router();

demoRoutes.post('/sessions', publicDemoRateLimit, asyncHandler(demoController.createSession));
demoRoutes.get('/sessions/current', publicDemoRateLimit, asyncHandler(demoController.getSession));
demoRoutes.post('/sample', publicDemoRateLimit, asyncHandler(demoController.submitSample));
demoRoutes.post('/custom', publicDemoRateLimit, asyncHandler(demoController.submitCustom));
demoRoutes.get('/cases', publicDemoRateLimit, asyncHandler(demoController.listSessionCases));
demoRoutes.get('/cases/:id', publicDemoRateLimit, asyncHandler(demoController.getSessionCase));
demoRoutes.post('/cases/:id/process', publicDemoRateLimit, asyncHandler(demoController.processCase));
demoRoutes.post('/cases/:id/feedback', publicDemoRateLimit, asyncHandler(demoController.feedback));
