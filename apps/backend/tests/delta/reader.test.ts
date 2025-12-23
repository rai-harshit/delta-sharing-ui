/**
 * Delta Reader Tests
 */

import path from 'path';
import { 
  getTableMetadata, 
  getTableStats, 
  queryTable,
  validateDeltaTable,
} from '../../src/delta/reader.js';

describe('DeltaReader', () => {
  const dataDir = path.resolve(__dirname, '../../data');

  describe('validateDeltaTable', () => {
    it('should validate a valid Delta table', async () => {
      const result = await validateDeltaTable(`${dataDir}/customer_info`);

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.columns.length).toBeGreaterThan(0);
    });

    it('should return invalid for non-existent path', async () => {
      const result = await validateDeltaTable('/non/existent/path');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid for path without _delta_log', async () => {
      const result = await validateDeltaTable(dataDir);

      expect(result.valid).toBe(false);
    });
  });

  describe('getTableMetadata', () => {
    it('should read table metadata', async () => {
      const metadata = await getTableMetadata(`${dataDir}/customer_info`);

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.columns).toBeInstanceOf(Array);
      expect(metadata.version).toBeGreaterThanOrEqual(0);
    });

    it('should include column schema', async () => {
      const metadata = await getTableMetadata(`${dataDir}/customer_info`);

      expect(metadata.columns.length).toBeGreaterThan(0);
      expect(metadata.columns[0]).toHaveProperty('name');
      expect(metadata.columns[0]).toHaveProperty('type');
      expect(metadata.columns[0]).toHaveProperty('nullable');
    });
  });

  describe('getTableStats', () => {
    it('should return table statistics', async () => {
      const stats = await getTableStats(`${dataDir}/customer_info`);

      expect(stats).toBeDefined();
      expect(typeof stats.numRecords).toBe('number');
      expect(typeof stats.numFiles).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
      expect(stats.numFiles).toBeGreaterThan(0);
    });
  });

  describe('queryTable', () => {
    it('should read table data', async () => {
      const result = await queryTable(`${dataDir}/customer_info`, { limit: 10 });

      expect(result.columns).toBeInstanceOf(Array);
      expect(result.rows).toBeInstanceOf(Array);
      expect(typeof result.totalRows).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should respect limit parameter', async () => {
      const result = await queryTable(`${dataDir}/customer_info`, { limit: 2 });

      expect(result.rows.length).toBeLessThanOrEqual(2);
    });

    it('should handle pagination with offset', async () => {
      const page1 = await queryTable(`${dataDir}/customer_info`, { limit: 2, offset: 0 });
      const page2 = await queryTable(`${dataDir}/customer_info`, { limit: 2, offset: 2 });

      // Pages should have different data (if there are enough rows)
      if (page1.rows.length > 0 && page2.rows.length > 0) {
        expect(JSON.stringify(page1.rows[0])).not.toBe(JSON.stringify(page2.rows[0]));
      }
    });
  });
});








