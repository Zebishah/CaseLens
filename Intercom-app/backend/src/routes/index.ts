import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { userRoutes } from '../modules/user/user.routes.js';
import { exampleRoutes } from '../modules/example/example.routes.js';
import { demoRoutes } from '../modules/demo/demo.routes.js';
import { casesRoutes } from '../modules/cases/cases.routes.js';
import { operationsRoutes } from '../modules/operations/operations.routes.js';
import { directoryRoutes } from '../modules/directory/directory.routes.js';
import { evaluationRoutes } from '../modules/evaluation/evaluation.routes.js';
import { env } from '../config/env.config.js';
import { accessRequestRoutes } from '../modules/access-request/access-request.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/access-requests', accessRequestRoutes);
apiRouter.use('/users', userRoutes);
if (env.NODE_ENV !== 'production') {
  apiRouter.use('/example', exampleRoutes);
}
apiRouter.use('/demo', demoRoutes);
apiRouter.use('/cases', casesRoutes);
apiRouter.use('/operations', operationsRoutes);
apiRouter.use('/directory', directoryRoutes);
apiRouter.use('/evaluation', evaluationRoutes);
