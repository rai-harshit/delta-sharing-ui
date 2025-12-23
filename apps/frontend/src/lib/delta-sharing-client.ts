/**
 * Delta Sharing Client
 * 
 * A standalone client that communicates with ANY Delta Sharing server
 * using the standard Delta Sharing REST protocol.
 * 
 * This client does not require the custom backend - it talks directly
 * to the Delta Sharing endpoint using the bearer token from the credential file.
 */

// Types matching the Delta Sharing protocol
export interface Share {
  name: string;
  id?: string;
}

export interface Schema {
  name: string;
  share: string;
}

export interface Table {
  name: string;
  schema: string;
  share: string;
  id?: string;
}

export interface TableMetadata {
  protocol: {
    minReaderVersion: number;
  };
  metadata: {
    id: string;
    name?: string;
    format: { provider: string };
    schemaString: string;
    partitionColumns: string[];
    numFiles?: number;
    size?: number;
    version?: number;
  };
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  hasMore: boolean;
  version?: number;
}

export type CDFAction = 'insert' | 'update_preimage' | 'update_postimage' | 'delete';

export interface ChangeRow {
  _change_type: CDFAction;
  _commit_version: number;
  _commit_timestamp?: number;
  [key: string]: unknown;
}

export interface TableChangesResult {
  changes: ChangeRow[];
  startVersion: number;
  endVersion: number;
  hasMore: boolean;
}

export interface DeltaSharingCredential {
  shareCredentialsVersion?: number;
  endpoint: string;
  bearerToken: string;
  expirationTime?: string;
}

/**
 * Sanitize a string to remove non-ASCII characters that can cause issues with HTTP headers
 * This handles smart quotes, special spaces, and other problematic Unicode characters
 */
function sanitizeForHttp(str: string): string {
  return str
    // Replace smart/curly quotes with straight quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Replace various Unicode spaces with regular space
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    // Replace em/en dashes with regular hyphen
    .replace(/[\u2013\u2014]/g, '-')
    // Replace bullet points with asterisks
    .replace(/[\u2022\u2023\u2043]/g, '*')
    // Remove other non-printable/control characters except newlines and tabs
    .replace(/[^\x20-\x7E\n\t]/g, '')
    .trim();
}

/**
 * Parse and validate a Delta Sharing credential
 */
export function parseCredential(json: string): DeltaSharingCredential | null {
  try {
    // First sanitize the JSON string to handle smart quotes etc.
    const sanitizedJson = json
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
    
    const parsed = JSON.parse(sanitizedJson);
    if (!parsed.endpoint || !parsed.bearerToken) {
      return null;
    }
    
    // Sanitize the bearer token specifically to ensure it's HTTP-header safe
    return {
      ...parsed,
      endpoint: parsed.endpoint.trim(),
      bearerToken: sanitizeForHttp(parsed.bearerToken),
    } as DeltaSharingCredential;
  } catch {
    return null;
  }
}

/**
 * Check if a credential is expired
 */
export function isCredentialExpired(credential: DeltaSharingCredential): boolean {
  if (!credential.expirationTime) {
    return false;
  }
  return new Date(credential.expirationTime) < new Date();
}

/**
 * Delta Sharing Client
 * 
 * Communicates with any Delta Sharing server using the standard protocol.
 */
export class DeltaSharingClient {
  private endpoint: string;
  private bearerToken: string;

  constructor(endpoint: string, bearerToken: string) {
    // Ensure endpoint doesn't have trailing slash
    this.endpoint = endpoint.replace(/\/$/, '').trim();
    // Sanitize bearer token to ensure it only contains ASCII characters valid for HTTP headers
    this.bearerToken = bearerToken
      .replace(/[^\x20-\x7E]/g, '') // Remove any non-printable ASCII characters
      .trim();
  }

  /**
   * Create a client from a credential object
   */
  static fromCredential(credential: DeltaSharingCredential): DeltaSharingClient {
    return new DeltaSharingClient(credential.endpoint, credential.bearerToken);
  }

  /**
   * Make an authenticated request to the Delta Sharing server
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.endpoint}${path}`;
    
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
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        // Handle nested error object: { error: { message: "..." } }
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        } else {
          errorMessage = `Request failed: ${response.status}`;
        }
      } catch {
        errorMessage = errorText || `Request failed: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * List all shares accessible with this credential
   */
  async listShares(): Promise<Share[]> {
    const response = await this.request<{ items: Share[] }>('/shares');
    return response.items || [];
  }

  /**
   * Get a specific share by name
   */
  async getShare(shareName: string): Promise<Share> {
    const response = await this.request<{ share: Share }>(`/shares/${encodeURIComponent(shareName)}`);
    return response.share;
  }

  /**
   * List all schemas in a share
   */
  async listSchemas(shareName: string): Promise<Schema[]> {
    const response = await this.request<{ items: Schema[] }>(
      `/shares/${encodeURIComponent(shareName)}/schemas`
    );
    return response.items || [];
  }

  /**
   * List all tables in a schema
   */
  async listTables(shareName: string, schemaName: string): Promise<Table[]> {
    const response = await this.request<{ items: Table[] }>(
      `/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables`
    );
    return response.items || [];
  }

  /**
   * List all tables across all schemas in a share
   */
  async listAllTables(shareName: string): Promise<Table[]> {
    const response = await this.request<{ items: Table[] }>(
      `/shares/${encodeURIComponent(shareName)}/all-tables`
    );
    return response.items || [];
  }

  /**
   * Get table metadata including schema
   */
  async getTableMetadata(
    shareName: string,
    schemaName: string,
    tableName: string
  ): Promise<TableMetadata> {
    return this.request<TableMetadata>(
      `/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/metadata`
    );
  }

  /**
   * Get table version
   */
  async getTableVersion(
    shareName: string,
    schemaName: string,
    tableName: string
  ): Promise<number> {
    const response = await this.request<{ version: number }>(
      `/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/version`
    );
    return response.version;
  }

  /**
   * Query table data with optional time-travel
   */
  async queryTable(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: { 
      limit?: number; 
      offset?: number; 
      version?: number; 
      timestamp?: string;
    } = {}
  ): Promise<QueryResult> {
    const body: Record<string, unknown> = {
      limitHint: options.limit || 100,
      offset: options.offset || 0,
    };
    
    // Add time-travel parameters
    if (options.version !== undefined) {
      body.version = options.version;
    }
    if (options.timestamp) {
      body.timestamp = options.timestamp;
    }

    return this.request<QueryResult>(
      `/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/query`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Query table changes (Change Data Feed)
   */
  async queryTableChanges(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: {
      startingVersion?: number;
      endingVersion?: number;
      startingTimestamp?: string;
      endingTimestamp?: string;
    }
  ): Promise<TableChangesResult> {
    const body: Record<string, unknown> = {};
    
    if (options.startingVersion !== undefined) {
      body.startingVersion = options.startingVersion;
    }
    if (options.endingVersion !== undefined) {
      body.endingVersion = options.endingVersion;
    }
    if (options.startingTimestamp) {
      body.startingTimestamp = options.startingTimestamp;
    }
    if (options.endingTimestamp) {
      body.endingTimestamp = options.endingTimestamp;
    }

    return this.request<TableChangesResult>(
      `/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/changes`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Get shares with full hierarchy (schemas and tables)
   * This is a convenience method that fetches the full tree
   */
  async getSharesWithHierarchy(): Promise<Array<Share & { schemas: Array<Schema & { tables: Table[] }> }>> {
    const shares = await this.listShares();
    
    const results = await Promise.all(
      shares.map(async (share) => {
        const schemas = await this.listSchemas(share.name);
        const schemasWithTables = await Promise.all(
          schemas.map(async (schema) => {
            const tables = await this.listTables(share.name, schema.name);
            return { ...schema, tables };
          })
        );
        return { ...share, schemas: schemasWithTables };
      })
    );

    return results;
  }
}








