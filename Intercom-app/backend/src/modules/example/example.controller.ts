import type { Request, Response } from 'express';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import { addExampleJob } from '../../queues/example.queue.js';
import { exampleService } from './example.service.js';

export const exampleController = {
  /**
   * @swagger
   * /api/example:
   *   get:
   *     summary: Get examples
   *     tags: [Example]
   */
  async getExamples(_req: Request, res: Response): Promise<void> {
    const data = await exampleService.getAll();
    sendSuccess(res, data);
  },

  /**
   * @swagger
   * /api/example:
   *   post:
   *     summary: Create example item
   *     tags: [Example]
   */
  async createExample(req: Request, res: Response): Promise<void> {
    const item = await exampleService.create(req.body.message);
    await addExampleJob({ message: req.body.message });
    sendSuccess(res, item, STATUS_CODES.CREATED);
  }
};
