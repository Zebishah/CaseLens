import type { Request, Response } from 'express';
import { logger } from '../../config/logger.config.js';
import { parseCanvasInitialize, parseCanvasSubmit } from '../intercom/intercom.types.js';
import { canvasService } from './canvas.service.js';
import { canvasWorkspaceMatches } from '../intercom/intercom.workspace.util.js';
import { AppError } from '../../utils/error.util.js';

export const canvasController = {
  async initialize(req: Request, res: Response): Promise<void> {
    const payload = parseCanvasInitialize(req.body);
    if (!canvasWorkspaceMatches(payload.workspace_id)) {
      throw AppError.unauthorized('Intercom canvas workspace does not match this application');
    }
    logger.info('[canvas] Controller initialize', {
      conversationId: payload.conversation_id
    });

    const canvas = await canvasService.initialize(payload);
    res.status(200).json(canvas);
  },

  async submit(req: Request, res: Response): Promise<void> {
    const payload = parseCanvasSubmit(req.body);
    if (!canvasWorkspaceMatches(payload.workspace_id)) {
      throw AppError.unauthorized('Intercom canvas workspace does not match this application');
    }
    logger.info('[canvas] Controller submit', {
      conversationId: payload.conversation_id,
      componentId: payload.component_id ?? null
    });

    const canvas = await canvasService.submit(payload);
    res.status(200).json(canvas);
  },

  async configure(_req: Request, res: Response): Promise<void> {
    logger.info('[canvas] Controller configure');
    const canvas = canvasService.configure();
    res.status(200).json(canvas);
  }
};
