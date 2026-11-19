import { Application, Router } from 'express';
import { env, isDevelopment } from '../config/env.js';
import healthRouter from './health.routes.js';
import authRouter from '../modules/auth/auth.routes.js';
import organizationsRouter from '../modules/organizations/organizations.routes.js';
import jobsRouter from '../modules/jobs/jobs.routes.js';
import candidatesRouter from '../modules/candidates/candidates.routes.js';
import applicationsRouter from '../modules/applications/applications.routes.js';
import interviewsRouter from '../modules/interviews/interviews.routes.js';
import interviewAccessRouter from '../modules/interviews/interview-access.routes.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { Permission } from '../modules/rbac/permissions.js';
import { asyncHandler } from '../common/utils/async-handler.js';
import { getPrismaClient } from '../config/database.js';

// ---------------------------------------------------------------------------
// Root router — mounts all versioned route groups
// ---------------------------------------------------------------------------

export function mountRoutes(app: Application): void {
  const v1 = Router();

  // Health
  v1.use('/health', healthRouter);

  // Authentication & Onboarding
  v1.use('/auth', authRouter);
  v1.use('/organizations', organizationsRouter);

  // Organization-scoped recruitment modules
  v1.use('/organizations/:orgId/jobs', jobsRouter);
  v1.use('/organizations/:orgId/candidates', candidatesRouter);
  v1.use('/organizations/:orgId/applications', applicationsRouter);
  v1.use('/organizations/:orgId/interviews', interviewsRouter);
  v1.use('/interview', interviewAccessRouter);

  // Organization Stats endpoint (dashboard)
  v1.get(
    '/organizations/:orgId/stats',
    authenticate,
    authorize(Permission.ORG_READ),
    asyncHandler(async (req, res) => {
      const prisma = getPrismaClient();
      const orgId = req.params.orgId;
      const [jobs, candidates, applications] = await Promise.all([
        prisma.job.count({
          where: { organizationId: orgId, status: { not: 'ARCHIVED' } },
        }),
        prisma.candidate.count({
          where: { organizationId: orgId, status: { not: 'ARCHIVED' } },
        }),
        prisma.application.count({
          where: { organizationId: orgId },
        }),
      ]);
      res.status(200).json({
        success: true,
        data: { jobs, candidates, applications },
      });
    }),
  );

  // Mount versioned router
  app.use(env.API_PREFIX, v1);

  // Swagger UI (development only)
  if (isDevelopment()) {
    // Lazy import — swagger-ui-express not needed in production
    import('swagger-ui-express')
      .then((swaggerUi) => {
        const openApiSpec = {
          openapi: '3.0.3',
          info: {
            title: 'AI Recruiter API',
            description: 'Enterprise AI Recruitment Platform — Backend API',
            version: '0.1.0',
            contact: { name: 'Aarohi Platform Team' },
          },
          servers: [{ url: env.API_PREFIX, description: 'Current server' }],
          paths: {
            '/health/live': {
              get: {
                tags: ['Health'],
                summary: 'Liveness probe',
                responses: { '200': { description: 'Service is alive' } },
              },
            },
            '/health/ready': {
              get: {
                tags: ['Health'],
                summary: 'Readiness probe',
                responses: {
                  '200': { description: 'Service is ready' },
                  '503': { description: 'Service is degraded' },
                },
              },
            },
          },
        };

        app.use(
          `${env.API_PREFIX}/docs`,
          swaggerUi.serve,
          swaggerUi.setup(openApiSpec, {
            customSiteTitle: 'AI Recruiter API Docs',
          }),
        );
      })
      .catch(() => {
        // Non-fatal: Swagger is a dev convenience, not a requirement
      });
  }
}
