import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { exampleController } from './example.controller.js';
import { createExampleSchema } from './example.validation.js';

export const exampleRoutes = Router();

exampleRoutes.get('/', asyncHandler(exampleController.getExamples));
exampleRoutes.post('/', validate(createExampleSchema), asyncHandler(exampleController.createExample));
