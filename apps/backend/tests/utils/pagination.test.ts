import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  encodePageToken, 
  decodePageToken, 
  paginate, 
  parsePaginationParams 
} from '../../src/utils/pagination.js';

describe('Pagination Utilities', () => {
  describe('encodePageToken / decodePageToken', () => {
    it('should encode and decode a page token correctly', () => {
      const offset = 100;
      const token = encodePageToken(offset);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      const decodedOffset = decodePageToken(token);
      expect(decodedOffset).toBe(offset);
    });

    it('should return null for invalid token', () => {
      expect(decodePageToken('invalid-token')).toBeNull();
      expect(decodePageToken('')).toBeNull();
    });

    it('should return null for malformed base64', () => {
      expect(decodePageToken('!!!not-base64!!!')).toBeNull();
    });

    it('should handle zero offset', () => {
      const token = encodePageToken(0);
      const decoded = decodePageToken(token);
      expect(decoded).toBe(0);
    });

    it('should handle large offset', () => {
      const offset = 1000000;
      const token = encodePageToken(offset);
      const decoded = decodePageToken(token);
      expect(decoded).toBe(offset);
    });
  });

  describe('paginate', () => {
    const testItems = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should return first page with default maxResults', () => {
      const result = paginate(testItems, {});
      
      expect(result.items.length).toBe(100); // Default maxResults
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should paginate with custom maxResults', () => {
      const result = paginate(testItems, { maxResults: 10 });
      
      expect(result.items.length).toBe(10);
      expect(result.items[0]).toEqual({ id: 1 });
      expect(result.items[9]).toEqual({ id: 10 });
      expect(result.nextPageToken).toBeDefined();
    });

    it('should use pageToken to get next page', () => {
      const firstPage = paginate(testItems, { maxResults: 10 });
      const secondPage = paginate(testItems, { 
        maxResults: 10, 
        pageToken: firstPage.nextPageToken 
      });
      
      expect(secondPage.items.length).toBe(10);
      expect(secondPage.items[0]).toEqual({ id: 11 });
      expect(secondPage.items[9]).toEqual({ id: 20 });
    });

    it('should not include nextPageToken on last page', () => {
      const result = paginate(testItems, { maxResults: 100 });
      
      expect(result.items.length).toBe(100);
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = paginate([], { maxResults: 10 });
      
      expect(result.items.length).toBe(0);
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should handle invalid pageToken by starting from beginning', () => {
      const result = paginate(testItems, { 
        maxResults: 10, 
        pageToken: 'invalid' 
      });
      
      expect(result.items[0]).toEqual({ id: 1 });
    });
  });

  describe('parsePaginationParams', () => {
    it('should return defaults for empty query', () => {
      const result = parsePaginationParams({});
      
      expect(result.maxResults).toBe(100);
      expect(result.pageToken).toBeUndefined();
    });

    it('should parse maxResults', () => {
      const result = parsePaginationParams({ maxResults: '50' });
      
      expect(result.maxResults).toBe(50);
    });

    it('should cap maxResults at 1000', () => {
      const result = parsePaginationParams({ maxResults: '5000' });
      
      expect(result.maxResults).toBe(1000);
    });

    it('should handle invalid maxResults', () => {
      const result = parsePaginationParams({ maxResults: 'invalid' });
      
      expect(result.maxResults).toBe(100);
    });

    it('should handle negative maxResults', () => {
      const result = parsePaginationParams({ maxResults: '-10' });
      
      expect(result.maxResults).toBe(100);
    });

    it('should parse pageToken', () => {
      const result = parsePaginationParams({ pageToken: 'some-token' });
      
      expect(result.pageToken).toBe('some-token');
    });
  });
});







