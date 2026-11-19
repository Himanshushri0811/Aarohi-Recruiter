import { HealthCheckResult } from '../common/types/index.js';

// ---------------------------------------------------------------------------
// Database health probe
// Performs a lightweight SELECT 1 with a 3-second timeout guard.
// All failures are caught and returned as { status: 'unhealthy' }.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 3000;

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Lazy-import Prisma client so an un-generated client only fails here, not at startup
    const { getPrismaClient } = await import('../config/database.js');
    const prisma = getPrismaClient();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database health check timed out')), TIMEOUT_MS),
    );

    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);

    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
