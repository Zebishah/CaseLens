import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    req.body = parsed.data.body;
    req.params = parsed.data.params;
    Object.defineProperty(req, 'query', {
      configurable: true,
      enumerable: true,
      value: parsed.data.query,
      writable: true
    });
    next();
  };
};
