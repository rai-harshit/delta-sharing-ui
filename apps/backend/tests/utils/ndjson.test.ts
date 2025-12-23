import { describe, it, expect } from '@jest/globals';
import { wantsNDJSON } from '../../src/utils/ndjson.js';

describe('NDJSON Utilities', () => {
  describe('wantsNDJSON', () => {
    it('should return true for application/x-ndjson', () => {
      expect(wantsNDJSON('application/x-ndjson')).toBe(true);
    });

    it('should return true for application/x-ndjson+json', () => {
      expect(wantsNDJSON('application/x-ndjson+json')).toBe(true);
    });

    it('should return true for application/json-seq', () => {
      expect(wantsNDJSON('application/json-seq')).toBe(true);
    });

    it('should return false for application/json', () => {
      expect(wantsNDJSON('application/json')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(wantsNDJSON(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(wantsNDJSON('')).toBe(false);
    });

    it('should handle mixed content types', () => {
      expect(wantsNDJSON('application/json, application/x-ndjson')).toBe(true);
    });
  });
});

