import { PrismaClient } from '@prisma/client';
import { createQueryLoggingMiddleware, logMetricsSummary } from '../middleware/query-logger.js';

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Apply query logging middleware (controlled by ENABLE_QUERY_LOGGING env var)
prisma.$use(createQueryLoggingMiddleware());

// Log metrics summary on graceful shutdown
process.on('SIGTERM', () => {
  logMetricsSummary();
});

process.on('SIGINT', () => {
  logMetricsSummary();
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
