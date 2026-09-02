import { z } from 'zod';

/**
 * @swagger
 * components:
 *   schemas:
 *     ExampleRequest:
 *       type: object
 *       required: [message]
 *       properties:
 *         message:
 *           type: string
 */
export const createExampleSchema = z.object({
  body: z.object({
    message: z.string().min(1)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
