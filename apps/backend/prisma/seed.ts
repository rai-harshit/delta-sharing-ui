import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import { createSampleDeltaTables } from '../src/delta/sample-data.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample Delta tables first
  console.log('📊 Creating sample Delta tables...');
  await createSampleDeltaTables();

  // Create default admin user
  const defaultPassword = 'changeme';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@localhost' },
    update: {
      // Reset password to default on re-seed
      passwordHash,
      mustChangePassword: true,
    },
    create: {
      email: 'admin@localhost',
      passwordHash,
      name: 'Administrator',
      role: 'admin',
      mustChangePassword: true,
    },
  });

  console.log('✅ Created default admin user:');
  console.log('   Email:    admin@localhost');
  console.log('   Password: changeme');
  console.log('   (You will be prompted to change this on first login)');

  // Create test admin user for E2E tests (with known credentials)
  const testPassword = 'admin123';
  const testPasswordHash = await bcrypt.hash(testPassword, 12);
  
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash: testPasswordHash,
      mustChangePassword: false, // Don't require password change for test user
    },
    create: {
      email: 'admin@example.com',
      passwordHash: testPasswordHash,
      name: 'Test Admin',
      role: 'admin',
      mustChangePassword: false,
    },
  });

  console.log('✅ Created test admin user (for E2E tests):');
  console.log('   Email:    admin@example.com');
  console.log('   Password: admin123');

  // Get absolute path to data directory
  const dataDir = path.resolve(process.cwd(), 'data');

  // Create sample shares with real Delta tables
  const salesShare = await prisma.share.upsert({
    where: { name: 'sales_data' },
    update: {},
    create: {
      name: 'sales_data',
      comment: 'Sales transactions and customer data',
      createdBy: admin.email,
    },
  });

  const analyticsShare = await prisma.share.upsert({
    where: { name: 'product_analytics' },
    update: {},
    create: {
      name: 'product_analytics',
      comment: 'Product catalog and inventory data',
      createdBy: admin.email,
    },
  });

  console.log('✅ Created shares:', salesShare.name, analyticsShare.name);

  // Create schemas for sales_data
  const salesSchema = await prisma.schema.upsert({
    where: { shareId_name: { shareId: salesShare.id, name: 'transactions' } },
    update: {},
    create: {
      name: 'transactions',
      shareId: salesShare.id,
    },
  });

  const customersSchema = await prisma.schema.upsert({
    where: { shareId_name: { shareId: salesShare.id, name: 'customers' } },
    update: {},
    create: {
      name: 'customers',
      shareId: salesShare.id,
    },
  });

  // Create schemas for product_analytics
  const catalogSchema = await prisma.schema.upsert({
    where: { shareId_name: { shareId: analyticsShare.id, name: 'catalog' } },
    update: {},
    create: {
      name: 'catalog',
      shareId: analyticsShare.id,
    },
  });

  console.log('✅ Created schemas');

  // Create tables pointing to real Delta tables
  await prisma.table.upsert({
    where: { schemaId_name: { schemaId: salesSchema.id, name: 'sales_transactions' } },
    update: { location: path.join(dataDir, 'sales_transactions') },
    create: {
      name: 'sales_transactions',
      schemaId: salesSchema.id,
      location: path.join(dataDir, 'sales_transactions'),
      comment: '1500 sales transaction records',
    },
  });

  await prisma.table.upsert({
    where: { schemaId_name: { schemaId: customersSchema.id, name: 'customer_info' } },
    update: { location: path.join(dataDir, 'customer_info') },
    create: {
      name: 'customer_info',
      schemaId: customersSchema.id,
      location: path.join(dataDir, 'customer_info'),
      comment: '1000 customer records',
    },
  });

  await prisma.table.upsert({
    where: { schemaId_name: { schemaId: catalogSchema.id, name: 'product_catalog' } },
    update: { location: path.join(dataDir, 'product_catalog') },
    create: {
      name: 'product_catalog',
      schemaId: catalogSchema.id,
      location: path.join(dataDir, 'product_catalog'),
      comment: '500 product records',
    },
  });

  console.log('✅ Created tables with real Delta Lake data');

  // Create a sample recipient
  const recipient = await prisma.recipient.upsert({
    where: { name: 'demo_recipient' },
    update: {},
    create: {
      name: 'demo_recipient',
      email: 'demo@example.com',
      comment: 'Demo recipient with access to sales data',
    },
  });

  // Grant access to sales_data share
  await prisma.accessGrant.upsert({
    where: { recipientId_shareId: { recipientId: recipient.id, shareId: salesShare.id } },
    update: {},
    create: {
      shareId: salesShare.id,
      recipientId: recipient.id,
      grantedBy: admin.email,
    },
  });

  console.log('✅ Created demo recipient with access to sales_data');

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('📁 Sample Delta tables created in:', dataDir);
  console.log('   - sales_transactions (1500 rows)');
  console.log('   - customer_info (1000 rows)');
  console.log('   - product_catalog (500 rows)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
