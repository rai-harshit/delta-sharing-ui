import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export interface Share {
  id: string;
  name: string;
  createdAt?: string;
  createdBy?: string;
}

export interface Schema {
  name: string;
  share: string;
}

export interface Table {
  name: string;
  schema: string;
  share: string;
  shareId?: string;
  id?: string;
}

export interface TableMetadata {
  format: {
    provider: string;
  };
  schemaString: string;
  partitionColumns: string[];
  numFiles?: number;
  size?: number;
  version?: number;
}

// NDJSON response types from OSS Delta Sharing server query endpoint
export interface ProtocolAction {
  protocol: {
    minReaderVersion: number;
    minWriterVersion?: number;
  };
}

export interface MetadataAction {
  metaData: {
    id: string;
    format: {
      provider: string;
      options?: Record<string, string>;
    };
    schemaString: string;
    partitionColumns: string[];
    configuration?: Record<string, string>;
    createdTime?: number;
  };
}

export interface FileAction {
  file: {
    url: string;
    id: string;
    size: number;
    partitionValues?: Record<string, string>;
    stats?: string;
    expirationTimestamp?: number;
  };
}

export type NDJSONAction = ProtocolAction | MetadataAction | FileAction;

export interface QueryTableResult {
  protocol: ProtocolAction['protocol'] | null;
  metadata: MetadataAction['metaData'] | null;
  files: FileAction['file'][];
}

/**
 * CDF (Change Data Feed) query options
 */
export interface CDFQueryOptions {
  startingVersion?: number;
  endingVersion?: number;
  startingTimestamp?: string;
  endingTimestamp?: string;
}

/**
 * CDF action types (add, remove, cdf)
 */
export interface CDFAction {
  add?: {
    url: string;
    id: string;
    size: number;
    version?: number;
    timestamp?: number;
    partitionValues?: Record<string, string>;
    stats?: string;
    expirationTimestamp?: number;
  };
  remove?: {
    url: string;
    id: string;
    size: number;
    version?: number;
    timestamp?: number;
    partitionValues?: Record<string, string>;
    expirationTimestamp?: number;
  };
  cdf?: {
    url: string;
    id: string;
    size: number;
    version?: number;
    timestamp?: number;
    partitionValues?: Record<string, string>;
    expirationTimestamp?: number;
  };
}

/**
 * CDF query result
 */
export interface CDFResult {
  protocol: ProtocolAction['protocol'] | null;
  metadata: MetadataAction['metaData'] | null;
  actions: CDFAction[];
}

export interface Recipient {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
  shares?: string[];
  token?: string;
}

/**
 * Pagination options for list requests
 */
export interface PaginationOptions {
  maxResults?: number;
  pageToken?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextPageToken?: string;
}

export class DeltaSharingClient {
  private serverUrl: string;
  private bearerToken: string;

  constructor(serverUrl: string, bearerToken: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.bearerToken = bearerToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createError(
        `Delta Sharing API error: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    
    return {} as T;
  }

  /**
   * Make a request that returns NDJSON (newline-delimited JSON)
   * Used for the query endpoint which returns protocol, metadata, and file actions
   */
  private async requestNDJSON(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<QueryTableResult> {
    const url = `${this.serverUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createError(
        `Delta Sharing API error: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const text = await response.text();
    return this.parseNDJSON(text);
  }

  /**
   * Parse NDJSON response from Delta Sharing server
   * Format: Each line is a JSON object with one of: protocol, metaData, or file
   */
  parseNDJSON(text: string): QueryTableResult {
    const result: QueryTableResult = {
      protocol: null,
      metadata: null,
      files: [],
    };

    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const action = JSON.parse(line) as NDJSONAction;
        
        if ('protocol' in action) {
          result.protocol = action.protocol;
        } else if ('metaData' in action) {
          result.metadata = action.metaData;
        } else if ('file' in action) {
          result.files.push(action.file);
        }
      } catch (e) {
        logger.warn('Failed to parse NDJSON line', { line, error: e });
      }
    }

    return result;
  }

  /**
   * Build query string from pagination options
   */
  private buildPaginationQuery(options?: PaginationOptions): string {
    if (!options) return '';
    const params = new URLSearchParams();
    if (options.maxResults) params.set('maxResults', String(options.maxResults));
    if (options.pageToken) params.set('pageToken', options.pageToken);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  // Share operations
  async listShares(options?: PaginationOptions): Promise<PaginatedResponse<Share>> {
    const query = this.buildPaginationQuery(options);
    return this.request<PaginatedResponse<Share>>(`/shares${query}`);
  }

  async getShare(shareName: string): Promise<{ share: Share }> {
    return this.request<{ share: Share }>(`/shares/${shareName}`);
  }

  async listSchemas(shareName: string, options?: PaginationOptions): Promise<PaginatedResponse<Schema>> {
    const query = this.buildPaginationQuery(options);
    return this.request<PaginatedResponse<Schema>>(`/shares/${shareName}/schemas${query}`);
  }

  async listTables(
    shareName: string,
    schemaName: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Table>> {
    const query = this.buildPaginationQuery(options);
    return this.request<PaginatedResponse<Table>>(
      `/shares/${shareName}/schemas/${schemaName}/tables${query}`
    );
  }

  async listAllTables(shareName: string, options?: PaginationOptions): Promise<PaginatedResponse<Table>> {
    const query = this.buildPaginationQuery(options);
    return this.request<PaginatedResponse<Table>>(
      `/shares/${shareName}/all-tables${query}`
    );
  }

  async getTableMetadata(
    shareName: string,
    schemaName: string,
    tableName: string
  ): Promise<TableMetadata> {
    return this.request<TableMetadata>(
      `/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`
    );
  }

  async getTableVersion(
    shareName: string,
    schemaName: string,
    tableName: string
  ): Promise<{ version: number }> {
    return this.request<{ version: number }>(
      `/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/version`
    );
  }

  /**
   * Query table and get raw NDJSON response with protocol, metadata, and file URLs
   * This is the OSS-compliant method that returns file URLs for downloading
   * Supports time-travel via version or timestamp parameters
   */
  async queryTableRaw(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: {
      limitHint?: number;
      predicateHints?: string[];
      jsonPredicateHints?: string;
      version?: number;
      timestamp?: string;
    } = {}
  ): Promise<QueryTableResult> {
    return this.requestNDJSON(
      `/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          limitHint: options.limitHint ?? 1000,
          predicateHints: options.predicateHints ?? [],
          ...(options.jsonPredicateHints && { jsonPredicateHints: options.jsonPredicateHints }),
          ...(options.version !== undefined && { version: options.version }),
          ...(options.timestamp && { timestamp: options.timestamp }),
        }),
      }
    );
  }

  /**
   * Query table changes (Change Data Feed)
   * Returns changes between versions with pre-signed URLs
   */
  async queryTableChanges(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: CDFQueryOptions = {}
  ): Promise<CDFResult> {
    const url = `${this.serverUrl}/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/changes`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(options.startingVersion !== undefined && { startingVersion: options.startingVersion }),
        ...(options.endingVersion !== undefined && { endingVersion: options.endingVersion }),
        ...(options.startingTimestamp && { startingTimestamp: options.startingTimestamp }),
        ...(options.endingTimestamp && { endingTimestamp: options.endingTimestamp }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createError(
        `Delta Sharing API error: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const text = await response.text();
    return this.parseCDFNDJSON(text);
  }

  /**
   * Parse CDF NDJSON response
   * Returns protocol, metadata, and change actions
   */
  parseCDFNDJSON(text: string): CDFResult {
    const result: CDFResult = {
      protocol: null,
      metadata: null,
      actions: [],
    };

    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const action = JSON.parse(line);
        
        if ('protocol' in action) {
          result.protocol = action.protocol;
        } else if ('metaData' in action) {
          result.metadata = action.metaData;
        } else if ('add' in action || 'remove' in action || 'cdf' in action) {
          result.actions.push(action as CDFAction);
        }
      } catch (e) {
        logger.warn('Failed to parse CDF NDJSON line', { line, error: e });
      }
    }

    return result;
  }

  // Validate connection
  async validateConnection(): Promise<boolean> {
    try {
      await this.listShares();
      return true;
    } catch {
      return false;
    }
  }
}




