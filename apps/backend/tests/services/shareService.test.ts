/**
 * Share Service Tests
 */

import { shareService } from '../../src/services/shareService.js';
import { prisma } from '../setup.js';

describe('ShareService', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.accessGrant.deleteMany();
    await prisma.table.deleteMany();
    await prisma.schema.deleteMany();
    await prisma.share.deleteMany();
  });

  describe('createShare', () => {
    it('should create a new share', async () => {
      const share = await shareService.createShare({
        name: 'test_share',
        comment: 'Test share description',
        createdBy: 'admin',
      });

      expect(share).toBeDefined();
      expect(share.id).toBeDefined();
      expect(share.name).toBe('test_share');
      expect(share.comment).toBe('Test share description');
      expect(share.createdBy).toBe('admin');
    });

    it('should throw error for duplicate share name', async () => {
      await shareService.createShare({ name: 'duplicate_share' });

      await expect(
        shareService.createShare({ name: 'duplicate_share' })
      ).rejects.toThrow();
    });
  });

  describe('getShare', () => {
    it('should get share by ID', async () => {
      const created = await shareService.createShare({ name: 'get_test' });
      const fetched = await shareService.getShare(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('get_test');
    });

    it('should get share by name', async () => {
      await shareService.createShare({ name: 'name_lookup' });
      const fetched = await shareService.getShare('name_lookup');

      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('name_lookup');
    });

    it('should return null for non-existent share', async () => {
      const fetched = await shareService.getShare('non_existent');
      expect(fetched).toBeNull();
    });
  });

  describe('listShares', () => {
    it('should list all shares', async () => {
      await shareService.createShare({ name: 'share_1' });
      await shareService.createShare({ name: 'share_2' });
      await shareService.createShare({ name: 'share_3' });

      const shares = await shareService.listShares();

      expect(shares.length).toBe(3);
      expect(shares.map(s => s.name)).toContain('share_1');
      expect(shares.map(s => s.name)).toContain('share_2');
      expect(shares.map(s => s.name)).toContain('share_3');
    });

    it('should return empty array when no shares exist', async () => {
      const shares = await shareService.listShares();
      expect(shares).toEqual([]);
    });
  });

  describe('deleteShare', () => {
    it('should delete a share', async () => {
      const share = await shareService.createShare({ name: 'to_delete' });
      await shareService.deleteShare(share.id);

      const fetched = await shareService.getShare(share.id);
      expect(fetched).toBeNull();
    });
  });

  describe('createSchema', () => {
    it('should create a schema in a share', async () => {
      const share = await shareService.createShare({ name: 'schema_test' });
      const schema = await shareService.createSchema({
        shareId: share.id,
        name: 'default',
      });

      expect(schema).toBeDefined();
      expect(schema.name).toBe('default');
      expect(schema.shareId).toBe(share.id);
    });
  });

  describe('createTable', () => {
    it('should create a table in a schema', async () => {
      const share = await shareService.createShare({ name: 'table_test' });
      const schema = await shareService.createSchema({
        shareId: share.id,
        name: 'default',
      });
      const table = await shareService.createTable({
        schemaId: schema.id,
        name: 'customers',
        location: './data/customers',
      });

      expect(table).toBeDefined();
      expect(table.name).toBe('customers');
      expect(table.location).toBe('./data/customers');
    });
  });
});














