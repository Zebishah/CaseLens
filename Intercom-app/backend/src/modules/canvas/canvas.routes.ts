import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import {
  intercomCanvasRawBody,
  verifyIntercomCanvas
} from '../../middlewares/intercomCanvas.middleware.js';
import { canvasController } from './canvas.controller.js';

export const canvasRoutes = Router();

canvasRoutes.post(
  '/initialize',
  intercomCanvasRawBody,
  verifyIntercomCanvas,
  asyncHandler(canvasController.initialize)
);

canvasRoutes.post(
  '/submit',
  intercomCanvasRawBody,
  verifyIntercomCanvas,
  asyncHandler(canvasController.submit)
);

canvasRoutes.post(
  '/configure',
  intercomCanvasRawBody,
  verifyIntercomCanvas,
  asyncHandler(canvasController.configure)
);
