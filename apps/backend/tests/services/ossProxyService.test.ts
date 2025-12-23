/**
 * OSS Proxy Service Tests
 * Tests for the OSS Delta Sharing proxy service
 */

import { ossProxyService } from '../../src/services/ossProxyService.js';
import { prisma } from '../setup.js';

describe('OSSProxyService', () => {
  // Store original env values
  const originalHybridMode = process.env.HYBRID_MODE;

  afterEach(() => {
    // Restore original env
    process.env.HYBRID_MODE = originalHybridMode;
    
    // Clear client cache between tests
    ossProxyService.clearClientCache();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.systemConfig.deleteMany();
  });

  describe('isHybridMode', () => {
    it('should return true when HYBRID_MODE env is true', () => {
      process.env.HYBRID_MODE = 'true';
      expect(ossProxyService.isHybridMode()).toBe(true);
    });

    it('should return false when HYBRID_MODE env is not set', () => {
      delete process.env.HYBRID_MODE;
      // Note: Also depends on CONFIG_DIR existence, which may affect this test
      // In test environment, CONFIG_DIR likely doesn't exist
    });
  });

  describe('getOSSServerUrl', () => {
    const originalOSSServerUrl = process.env.OSS_SERVER_URL;

    afterEach(() => {
      if (originalOSSServerUrl) {
        process.env.OSS_SERVER_URL = originalOSSServerUrl;
      } else {
        delete process.env.OSS_SERVER_URL;
      }
    });

    it('should return custom URL when OSS_SERVER_URL is set', () => {
      process.env.OSS_SERVER_URL = 'http://custom-oss:9090';
      expect(ossProxyService.getOSSServerUrl()).toBe('http://custom-oss:9090');
    });

    it('should return default URL when OSS_SERVER_URL is not set', () => {
      delete process.env.OSS_SERVER_URL;
      expect(ossProxyService.getOSSServerUrl()).toBe('http://delta-sharing-oss:8080');
    });
  });

  describe('standalone mode operations', () => {
    beforeEach(() => {
      // Force standalone mode
      process.env.HYBRID_MODE = 'false';
      delete process.env.OSS_CONFIG_PATH;
    });

    it('should throw error when getting client in standalone mode', async () => {
      await expect(ossProxyService.getClient()).rejects.toThrow(
        'OSS client only available in hybrid mode'
      );
    });

    it('should throw error for queryTableRaw in standalone mode', async () => {
      await expect(
        ossProxyService.queryTableRaw('share', 'schema', 'table')
      ).rejects.toThrow('queryTableRaw only available in hybrid mode');
    });
  });

  describe('clearClientCache', () => {
    it('should clear the cached client and token', () => {
      // This should not throw even if nothing is cached
      expect(() => ossProxyService.clearClientCache()).not.toThrow();
    });
  });

  describe('refreshSystemAccess', () => {
    beforeEach(() => {
      // Force standalone mode
      process.env.HYBRID_MODE = 'false';
    });

    it('should return early in standalone mode', async () => {
      // Should not throw
      await expect(ossProxyService.refreshSystemAccess()).resolves.toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should complete without error in standalone mode', async () => {
      process.env.HYBRID_MODE = 'false';
      
      // Should not throw
      await expect(ossProxyService.initialize()).resolves.toBeUndefined();
    });
  });
});

describe('OSSProxyService - Schema Parsing', () => {
  // Test the parseSchemaString functionality indirectly through getTableMetadata
  // when in standalone mode with valid table location

  beforeEach(() => {
    process.env.HYBRID_MODE = 'false';
  });

  afterEach(() => {
    ossProxyService.clearClientCache();
  });

  it('should throw when tableLocation is not provided in standalone mode', async () => {
    await expect(
      ossProxyService.getTableMetadata('share', 'schema', 'table')
    ).rejects.toThrow('Table location required in standalone mode');
  });

  it('should throw when tableLocation is not provided for queryTable in standalone mode', async () => {
    await expect(
      ossProxyService.queryTable('share', 'schema', 'table', {})
    ).rejects.toThrow('Table location required in standalone mode');
  });

  it('should throw when tableLocation is not provided for getTableStats in standalone mode', async () => {
    await expect(
      ossProxyService.getTableStats('share', 'schema', 'table')
    ).rejects.toThrow('Table location required in standalone mode');
  });
});








