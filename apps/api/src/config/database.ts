import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger.js';
import { isDevelopment } from './env.js';

// ---------------------------------------------------------------------------
// Singleton PrismaClient — clean ESM instantiation
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (_prisma) return _prisma;

  const logConfig: Prisma.PrismaClientOptions = isDevelopment()
    ? { log: ['warn', 'error'] }
    : { log: ['error'] };

  _prisma = new PrismaClient(logConfig);
  return _prisma;
}

// ---------------------------------------------------------------------------
// Graceful disconnect — called by server shutdown handler
// ---------------------------------------------------------------------------

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    logger.info('Disconnecting Prisma client...');
    await _prisma.$disconnect();
    _prisma = null;
    logger.info('Prisma disconnected.');
  }
}
