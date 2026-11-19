import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseHealth } from '../database/database-health.js';
import { asyncHandler } from '../common/utils/async-handler.js';

const router = Router();

// GET /live — liveness probe (always responds if process is running)
router.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'ai-recruiter-api',
    },
  });
});

// GET /ready — readiness probe (checks downstream dependencies)
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();

    const isReady = dbHealth.status === 'healthy';

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      data: {
        status: isReady ? 'ready' : 'degraded',
        version: '0.1.0',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth,
        },
      },
    });
  }),
);

export default router;
