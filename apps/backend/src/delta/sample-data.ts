/**
 * Sample Delta Table Generator
 * Creates realistic test data in Delta Lake format
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { DeltaTableMetadata, DeltaProtocol, DeltaAddAction, DeltaCommitInfo, DeltaSchema } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

// Sample data generators
function generateSalesTransactions(count: number): Record<string, unknown>[] {
  const products = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Webcam', 'Speaker', 'Charger'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const channels = ['Online', 'Retail', 'Wholesale', 'Partner'];
  
  return Array.from({ length: count }, (_, i) => ({
    transaction_id: `TXN-${String(i + 1).padStart(8, '0')}`,
    timestamp: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    product_name: products[Math.floor(Math.random() * products.length)],
    quantity: Math.floor(Math.random() * 10) + 1,
    unit_price: Math.round((Math.random() * 500 + 10) * 100) / 100,
    total_amount: 0, // Will be calculated
    region: regions[Math.floor(Math.random() * regions.length)],
    channel: channels[Math.floor(Math.random() * channels.length)],
    customer_id: `CUST-${String(Math.floor(Math.random() * 1000) + 1).padStart(5, '0')}`,
  })).map(row => ({
    ...row,
    total_amount: Math.round((row.quantity as number) * (row.unit_price as number) * 100) / 100,
  }));
}

function generateCustomerInfo(count: number): Record<string, unknown>[] {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'William', 'Jennifer'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'];
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  
  return Array.from({ length: count }, (_, i) => ({
    customer_id: `CUST-${String(i + 1).padStart(5, '0')}`,
    first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
    last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
    email: `user${i + 1}@example.com`,
    phone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    city: cities[Math.floor(Math.random() * cities.length)],
    registration_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    loyalty_tier: tiers[Math.floor(Math.random() * tiers.length)],
    total_purchases: Math.floor(Math.random() * 100),
    lifetime_value: Math.round(Math.random() * 10000 * 100) / 100,
  }));
}

function generateProductCatalog(count: number): Record<string, unknown>[] {
  const categories = ['Electronics', 'Accessories', 'Audio', 'Computing', 'Gaming'];
  const brands = ['TechPro', 'ElectroMax', 'DigiCore', 'SmartTech', 'PowerPlus'];
  const productTypes = [
    { name: 'Laptop', basePrice: 800 },
    { name: 'Phone', basePrice: 600 },
    { name: 'Tablet', basePrice: 400 },
    { name: 'Monitor', basePrice: 300 },
    { name: 'Keyboard', basePrice: 80 },
    { name: 'Mouse', basePrice: 50 },
    { name: 'Headphones', basePrice: 150 },
    { name: 'Webcam', basePrice: 100 },
    { name: 'Speaker', basePrice: 200 },
    { name: 'Charger', basePrice: 30 },
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const product = productTypes[i % productTypes.length];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    return {
      product_id: `PROD-${String(i + 1).padStart(6, '0')}`,
      product_name: `${brand} ${product.name} ${['Pro', 'Plus', 'Max', 'Ultra', 'Basic'][Math.floor(Math.random() * 5)]}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      brand,
      price: Math.round((product.basePrice * (0.8 + Math.random() * 0.6)) * 100) / 100,
      cost: Math.round((product.basePrice * 0.5 * (0.8 + Math.random() * 0.4)) * 100) / 100,
      stock_quantity: Math.floor(Math.random() * 500),
      reorder_level: Math.floor(Math.random() * 50) + 10,
      is_active: Math.random() > 0.1,
      created_at: new Date(Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

// Schema definitions for each table
const SCHEMAS: Record<string, DeltaSchema> = {
  sales_transactions: {
    type: 'struct',
    fields: [
      { name: 'transaction_id', type: 'string', nullable: false, metadata: {} },
      { name: 'timestamp', type: 'string', nullable: false, metadata: {} },
      { name: 'product_name', type: 'string', nullable: false, metadata: {} },
      { name: 'quantity', type: 'integer', nullable: false, metadata: {} },
      { name: 'unit_price', type: 'double', nullable: false, metadata: {} },
      { name: 'total_amount', type: 'double', nullable: false, metadata: {} },
      { name: 'region', type: 'string', nullable: true, metadata: {} },
      { name: 'channel', type: 'string', nullable: true, metadata: {} },
      { name: 'customer_id', type: 'string', nullable: true, metadata: {} },
    ],
  },
  customer_info: {
    type: 'struct',
    fields: [
      { name: 'customer_id', type: 'string', nullable: false, metadata: {} },
      { name: 'first_name', type: 'string', nullable: false, metadata: {} },
      { name: 'last_name', type: 'string', nullable: false, metadata: {} },
      { name: 'email', type: 'string', nullable: false, metadata: {} },
      { name: 'phone', type: 'string', nullable: true, metadata: {} },
      { name: 'city', type: 'string', nullable: true, metadata: {} },
      { name: 'registration_date', type: 'string', nullable: false, metadata: {} },
      { name: 'loyalty_tier', type: 'string', nullable: true, metadata: {} },
      { name: 'total_purchases', type: 'integer', nullable: false, metadata: {} },
      { name: 'lifetime_value', type: 'double', nullable: false, metadata: {} },
    ],
  },
  product_catalog: {
    type: 'struct',
    fields: [
      { name: 'product_id', type: 'string', nullable: false, metadata: {} },
      { name: 'product_name', type: 'string', nullable: false, metadata: {} },
      { name: 'category', type: 'string', nullable: true, metadata: {} },
      { name: 'brand', type: 'string', nullable: true, metadata: {} },
      { name: 'price', type: 'double', nullable: false, metadata: {} },
      { name: 'cost', type: 'double', nullable: false, metadata: {} },
      { name: 'stock_quantity', type: 'integer', nullable: false, metadata: {} },
      { name: 'reorder_level', type: 'integer', nullable: false, metadata: {} },
      { name: 'is_active', type: 'boolean', nullable: false, metadata: {} },
      { name: 'created_at', type: 'string', nullable: false, metadata: {} },
    ],
  },
};

function createDeltaLogEntry(
  tableName: string,
  schema: DeltaSchema,
  dataFileName: string,
  fileSize: number,
  numRecords: number
): string[] {
  const tableId = uuidv4();
  const timestamp = Date.now();

  const protocol: { protocol: DeltaProtocol } = {
    protocol: {
      minReaderVersion: 1,
      minWriterVersion: 2,
    },
  };

  const metadata: { metaData: DeltaTableMetadata } = {
    metaData: {
      id: tableId,
      name: tableName,
      description: `Sample ${tableName.replace(/_/g, ' ')} table for testing`,
      format: {
        provider: 'parquet',
        options: {},
      },
      schemaString: JSON.stringify(schema),
      partitionColumns: [],
      configuration: {},
      createdTime: timestamp,
    },
  };

  const addFile: { add: DeltaAddAction } = {
    add: {
      path: dataFileName,
      partitionValues: {},
      size: fileSize,
      modificationTime: timestamp,
      dataChange: true,
      stats: JSON.stringify({
        numRecords,
        minValues: {},
        maxValues: {},
        nullCount: {},
      }),
    },
  };

  const commitInfo: { commitInfo: DeltaCommitInfo } = {
    commitInfo: {
      timestamp,
      operation: 'WRITE',
      operationParameters: {
        mode: 'Overwrite',
        partitionBy: '[]',
      },
      isBlindAppend: true,
      operationMetrics: {
        numFiles: '1',
        numOutputRows: String(numRecords),
        numOutputBytes: String(fileSize),
      },
      engineInfo: 'delta-sharing-ui-sample-generator',
    },
  };

  return [
    JSON.stringify(protocol),
    JSON.stringify(metadata),
    JSON.stringify(addFile),
    JSON.stringify(commitInfo),
  ];
}

async function createDeltaTable(
  tableName: string,
  data: Record<string, unknown>[],
  schema: DeltaSchema
): Promise<void> {
  const tableDir = path.join(DATA_DIR, tableName);
  const deltaLogDir = path.join(tableDir, '_delta_log');

  // Create directories
  fs.mkdirSync(deltaLogDir, { recursive: true });

  // Write data as JSON (simulating parquet for now - we'll read it with our reader)
  const dataFileName = `part-00000-${uuidv4()}.json`;
  const dataFilePath = path.join(tableDir, dataFileName);
  const dataContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(dataFilePath, dataContent);

  // Create delta log entry
  const logEntries = createDeltaLogEntry(
    tableName,
    schema,
    dataFileName,
    Buffer.byteLength(dataContent),
    data.length
  );

  // Write commit file (00000000000000000000.json)
  const commitFileName = '00000000000000000000.json';
  const commitFilePath = path.join(deltaLogDir, commitFileName);
  fs.writeFileSync(commitFilePath, logEntries.join('\n'));

  // eslint-disable-next-line no-console
  console.log(`✅ Created Delta table: ${tableName} (${data.length} rows)`);
}

export async function generateSampleData(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🔄 Generating sample Delta tables...\n');

  // Ensure data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Generate and write each table
  const salesData = generateSalesTransactions(1500);
  await createDeltaTable('sales_transactions', salesData, SCHEMAS.sales_transactions);

  const customerData = generateCustomerInfo(1000);
  await createDeltaTable('customer_info', customerData, SCHEMAS.customer_info);

  const productData = generateProductCatalog(500);
  await createDeltaTable('product_catalog', productData, SCHEMAS.product_catalog);

  // eslint-disable-next-line no-console
  console.log('\n🎉 Sample data generation complete!');
  // eslint-disable-next-line no-console
  console.log(`📁 Data location: ${DATA_DIR}`);
}

// Alias for seed script
export const createSampleDeltaTables = generateSampleData;

// Run if executed directly
if (process.argv[1]?.includes('sample-data')) {
  // eslint-disable-next-line no-console
  generateSampleData().catch(console.error);
}
