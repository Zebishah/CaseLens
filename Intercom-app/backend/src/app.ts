import compression from 'compression';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { corsAllowlist, env } from './config/env.config.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './utils/response.util.js';
import { apiRateLimit } from './middlewares/rateLimit.middleware.js';
import { requestContext } from './middlewares/requestContext.middleware.js';
import { apiRouter } from './routes/index.js';
import { intercomRoutes } from './routes/intercom.routes.js';
import { resendWebhookRoutes } from './modules/resend/resend.webhook.routes.js';
import { healthService } from './modules/health/health.service.js';
import { AppError } from './utils/error.util.js';
import { STATUS_CODES } from './constants/statusCodes.js';

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HR Case Operations API',
      version: '1.0.0'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/**/*.ts']
});

export const app = express();

/** Explicit proxy trust prevents spoofed client IPs while supporting Render/ngrok. */
app.set('trust proxy', env.TRUST_PROXY);

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowlist = corsAllowlist();
      if (!origin || allowlist.includes(origin) || env.NODE_ENV === 'test') {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(compression());
app.use(requestContext);

/** Provider webhooks use unmodified raw bodies — must register before express.json(). */
app.use(resendWebhookRoutes);
app.use(intercomRoutes);

app.use('/api/directory/import', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '256kb' }));

if (env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use('/api', apiRateLimit, apiRouter);

app.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, healthService.liveness());
});

app.get('/ready', async (_req: Request, res: Response) => {
  const readiness = await healthService.readiness();
  res.status(readiness.status === 'ready' ? STATUS_CODES.OK : STATUS_CODES.SERVICE_UNAVAILABLE).json({
    success: true,
    data: {
      ...readiness,
      process: healthService.processFlags()
    }
  });
});

app.use((_req: Request, _res: Response, next) => {
  next(AppError.notFound('Route not found'));
});

app.use(errorHandler);
