/**
 * Jest Test Setup
 * Runs before each test file
 */

import { PrismaClient } from '@prisma/client';

// Set test database URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/delta_ui_test';
}

// Create a test database client
const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from database
  await prisma.$disconnect();
});

// Clean up test data between tests if needed
afterEach(async () => {
  // Reset any test state here if needed
});

// Export prisma for use in tests
export { prisma };






