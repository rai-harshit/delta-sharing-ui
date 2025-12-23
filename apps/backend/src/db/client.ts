import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Create a singleton Prisma client with connection pooling
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection pool configuration via DATABASE_URL query params or defaults
// Example: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
const prismaClientOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] as const
    : ['error'] as const,
  // Datasource configuration is handled via DATABASE_URL
  // For connection pooling, append to DATABASE_URL:
  // ?connection_limit=10&pool_timeout=30
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Health check for database connection
export async function checkDatabaseHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Handle SIGTERM for container environments
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections...');
  await prisma.$disconnect();
  process.exit(0);
});














