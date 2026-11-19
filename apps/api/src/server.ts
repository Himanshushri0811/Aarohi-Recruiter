import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Bootstrap — validate config → create app → start HTTP server
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  const [{ env }, { logger }, { createApp }, { disconnectPrisma }] = await Promise.all([
    import('./config/env.js'),
    import('./config/logger.js'),
    import('./app.js'),
    import('./config/database.js'),
  ]);

  // env is validated at import time; if we reach here config is valid.
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      prefix: env.API_PREFIX,
      aiServiceAuthConfigured: Boolean(env.AI_SERVICE_SECRET),
    },
    'Starting AI Recruiter API...',
  );

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        apiDocs:
          env.NODE_ENV === 'development' ? `http://localhost:${env.PORT}${env.API_PREFIX}/docs` : null,
        health: `http://localhost:${env.PORT}${env.API_PREFIX}/health/live`,
      },
      `AI Recruiter API ready on port ${env.PORT}`,
    );
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received. Closing gracefully...');

    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await disconnectPrisma();
      } catch (err) {
        logger.error({ err }, 'Error disconnecting Prisma during shutdown');
      }

      logger.info('Graceful shutdown complete.');
      process.exit(0);
    });

    // Force exit after 10 seconds if shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
