import { describe, it, expect } from '@jest/globals';
import { DeltaSharingClient } from '../../src/services/deltaClient.js';

describe('DeltaSharingClient', () => {
  describe('parseNDJSON', () => {
    const client = new DeltaSharingClient('http://localhost:8080', 'test-token');

    it('should parse protocol action', () => {
      const ndjson = '{"protocol":{"minReaderVersion":1}}\n';
      const result = client.parseNDJSON(ndjson);
      
      expect(result.protocol).toEqual({ minReaderVersion: 1 });
      expect(result.metadata).toBeNull();
      expect(result.files).toEqual([]);
    });

    it('should parse metadata action', () => {
      const ndjson = '{"metaData":{"id":"test","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}\n';
      const result = client.parseNDJSON(ndjson);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.id).toBe('test');
      expect(result.metadata?.format.provider).toBe('parquet');
    });

    it('should parse file actions', () => {
      const ndjson = '{"file":{"url":"https://example.com/file.parquet","id":"file1","size":1000}}\n{"file":{"url":"https://example.com/file2.parquet","id":"file2","size":2000}}\n';
      const result = client.parseNDJSON(ndjson);
      
      expect(result.files.length).toBe(2);
      expect(result.files[0].url).toBe('https://example.com/file.parquet');
      expect(result.files[0].id).toBe('file1');
      expect(result.files[1].size).toBe(2000);
    });

    it('should parse complete NDJSON response', () => {
      const ndjson = 
        '{"protocol":{"minReaderVersion":1}}\n' +
        '{"metaData":{"id":"test-table","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}\n' +
        '{"file":{"url":"https://example.com/data.parquet","id":"part-001","size":5000}}\n';
      
      const result = client.parseNDJSON(ndjson);
      
      expect(result.protocol?.minReaderVersion).toBe(1);
      expect(result.metadata?.id).toBe('test-table');
      expect(result.files.length).toBe(1);
    });

    it('should handle empty input', () => {
      const result = client.parseNDJSON('');
      
      expect(result.protocol).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.files).toEqual([]);
    });

    it('should skip malformed lines', () => {
      const ndjson = '{"protocol":{"minReaderVersion":1}}\nnot-valid-json\n{"file":{"url":"https://example.com/file.parquet","id":"file1","size":1000}}\n';
      const result = client.parseNDJSON(ndjson);
      
      expect(result.protocol?.minReaderVersion).toBe(1);
      expect(result.files.length).toBe(1);
    });
  });

  describe('parseCDFNDJSON', () => {
    const client = new DeltaSharingClient('http://localhost:8080', 'test-token');

    it('should parse CDF add actions', () => {
      const ndjson = 
        '{"protocol":{"minReaderVersion":1}}\n' +
        '{"metaData":{"id":"test","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}\n' +
        '{"add":{"url":"https://example.com/data.parquet","id":"part-001","size":5000,"version":1}}\n';
      
      const result = client.parseCDFNDJSON(ndjson);
      
      expect(result.protocol?.minReaderVersion).toBe(1);
      expect(result.metadata?.id).toBe('test');
      expect(result.actions.length).toBe(1);
      expect(result.actions[0].add).toBeDefined();
      expect(result.actions[0].add?.version).toBe(1);
    });

    it('should parse CDF remove actions', () => {
      const ndjson = '{"remove":{"url":"https://example.com/old.parquet","id":"part-old","size":3000,"version":2}}\n';
      const result = client.parseCDFNDJSON(ndjson);
      
      expect(result.actions.length).toBe(1);
      expect(result.actions[0].remove).toBeDefined();
      expect(result.actions[0].remove?.version).toBe(2);
    });

    it('should parse CDF cdf actions', () => {
      const ndjson = '{"cdf":{"url":"https://example.com/cdf.parquet","id":"cdf-001","size":1000,"version":3}}\n';
      const result = client.parseCDFNDJSON(ndjson);
      
      expect(result.actions.length).toBe(1);
      expect(result.actions[0].cdf).toBeDefined();
    });

    it('should parse mixed CDF actions', () => {
      const ndjson = 
        '{"add":{"url":"https://example.com/add.parquet","id":"add-1","size":1000,"version":1}}\n' +
        '{"remove":{"url":"https://example.com/remove.parquet","id":"rem-1","size":500,"version":2}}\n' +
        '{"add":{"url":"https://example.com/add2.parquet","id":"add-2","size":2000,"version":2}}\n';
      
      const result = client.parseCDFNDJSON(ndjson);
      
      expect(result.actions.length).toBe(3);
      expect(result.actions[0].add).toBeDefined();
      expect(result.actions[1].remove).toBeDefined();
      expect(result.actions[2].add).toBeDefined();
    });
  });

  describe('buildPaginationQuery', () => {
    const client = new DeltaSharingClient('http://localhost:8080', 'test-token');
    // Access private method for testing
    const buildQuery = (client as any).buildPaginationQuery.bind(client);

    it('should return empty string for undefined options', () => {
      expect(buildQuery(undefined)).toBe('');
    });

    it('should return empty string for empty options', () => {
      expect(buildQuery({})).toBe('');
    });

    it('should build query with maxResults', () => {
      const query = buildQuery({ maxResults: 50 });
      expect(query).toBe('?maxResults=50');
    });

    it('should build query with pageToken', () => {
      const query = buildQuery({ pageToken: 'abc123' });
      expect(query).toBe('?pageToken=abc123');
    });

    it('should build query with both params', () => {
      const query = buildQuery({ maxResults: 50, pageToken: 'abc123' });
      expect(query).toContain('maxResults=50');
      expect(query).toContain('pageToken=abc123');
    });
  });
});
