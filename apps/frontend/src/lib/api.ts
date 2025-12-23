const API_URL = import.meta.env.VITE_API_URL || '';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
  mock?: boolean;
}

class ApiClient {
  private csrfToken: string | null = null;

  /**
   * @deprecated Token is now stored in HttpOnly cookie
   * This method is kept for backward compatibility but is a no-op
   */
  setToken(_token: string | null) {
    // No-op: Token is now stored in HttpOnly cookie set by the server
    // This method is kept for backward compatibility
  }

  /**
   * Fetch a new CSRF token from the server
   * Should be called after login to enable state-changing requests
   */
  async fetchCsrfToken(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrfToken;
      }
    } catch {
      // Ignore errors - CSRF token will be fetched on next attempt
    }
  }

  /**
   * Clear the stored CSRF token (call on logout)
   */
  clearCsrfToken(): void {
    this.csrfToken = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Include CSRF token for state-changing requests
    const method = options.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && this.csrfToken) {
      (headers as Record<string, string>)['x-csrf-token'] = this.csrfToken;
    }

    // Cookies are sent automatically with credentials: 'include'
    // No need to manually set Authorization header
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Send HttpOnly cookies with every request
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  }

  // Auth - Admin login with email/password
  async login(email: string, password: string) {
    return this.request<{ 
      token: string; 
      user: { 
        id: string;
        email: string;
        name?: string;
        role: string;
        mustChangePassword: boolean;
      } 
    }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    );
  }

  async getCurrentUser() {
    return this.request<{ 
      id: string;
      email: string;
      name?: string;
      role: string;
      mustChangePassword: boolean;
    }>('/api/auth/me');
  }

  async recipientLogin(endpoint: string, bearerToken: string) {
    return this.request<{ 
      token: string; 
      user: { 
        serverUrl: string; 
        recipientId: string;
        recipientName: string;
        role: string;
      } 
    }>(
      '/api/auth/recipient/login',
      {
        method: 'POST',
        body: JSON.stringify({ endpoint, bearerToken }),
      }
    );
  }

  async validateToken() {
    return this.request<{ 
      valid: boolean; 
      user: { 
        id?: string;
        email?: string;
        name?: string;
        role: string;
        mustChangePassword?: boolean;
        serverUrl?: string;
        recipientId?: string;
        recipientName?: string;
      } 
    }>(
      '/api/auth/validate'
    );
  }

  // Shares
  async getShares() {
    return this.request<Share[]>('/api/shares');
  }

  async getShare(shareId: string) {
    return this.request<Share>(`/api/shares/${shareId}`);
  }

  async getShareSchemas(shareId: string) {
    return this.request<Schema[]>(`/api/shares/${shareId}/schemas`);
  }

  async getSchemaTables(shareId: string, schemaName: string) {
    return this.request<Table[]>(`/api/shares/${shareId}/schemas/${schemaName}/tables`);
  }

  async getAllTables(shareId: string) {
    return this.request<Table[]>(`/api/shares/${shareId}/all-tables`);
  }

  // Shared Assets - all tables and schemas across all shares
  async getSharedAssets() {
    return this.request<{
      summary: {
        totalTables: number;
        totalSchemas: number;
        totalShares: number;
      };
      tables: Array<{
        id: string;
        name: string;
        alias: string | null;
        location: string;
        schemaName: string;
        schemaId: string;
        shareName: string;
        shareId: string;
        recipientCount: number;
        createdAt: string;
      }>;
      schemas: Array<{
        id: string;
        name: string;
        shareName: string;
        shareId: string;
        tableCount: number;
      }>;
    }>('/api/shares/assets/all');
  }

  async getTableMetadata(shareId: string, schemaName: string, tableName: string) {
    return this.request<TableMetadata>(
      `/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}/metadata`
    );
  }

  async createShare(name: string, comment?: string) {
    return this.request<Share>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ name, comment }),
    });
  }

  async deleteShare(shareId: string) {
    return this.request<{ message: string }>(`/api/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  // Schema operations
  async createSchema(shareId: string, name: string) {
    return this.request<Schema>(`/api/shares/${shareId}/schemas`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteSchema(shareId: string, schemaName: string) {
    return this.request<{ message: string }>(`/api/shares/${shareId}/schemas/${schemaName}`, {
      method: 'DELETE',
    });
  }

  // Table operations
  async createTable(shareId: string, schemaName: string, name: string, location: string, comment?: string) {
    return this.request<Table>(`/api/shares/${shareId}/schemas/${schemaName}/tables`, {
      method: 'POST',
      body: JSON.stringify({ name, location, comment }),
    });
  }

  async deleteTable(shareId: string, schemaName: string, tableName: string) {
    return this.request<{ message: string }>(`/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}`, {
      method: 'DELETE',
    });
  }

  async getTableStats(shareId: string, schemaName: string, tableName: string) {
    return this.request<{
      numRecords: number;
      numFiles: number;
      totalSize: number;
    }>(`/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}/stats`);
  }

  // Recipients
  async getRecipients() {
    return this.request<Recipient[]>('/api/recipients');
  }

  async getRecipient(recipientId: string) {
    return this.request<Recipient>(`/api/recipients/${recipientId}`);
  }

  async createRecipient(name: string, email?: string, shares?: string[]) {
    return this.request<{ recipient: Recipient; credential: Credential }>(
      '/api/recipients',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, shares }),
      }
    );
  }

  async updateRecipient(recipientId: string, updates: { email?: string; shares?: string[] }) {
    return this.request<Recipient>(`/api/recipients/${recipientId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async rotateRecipientToken(recipientId: string) {
    return this.request<{ recipient: Recipient; credential: Credential }>(
      `/api/recipients/${recipientId}/token/rotate`,
      { method: 'POST' }
    );
  }

  async getRecipientCredential(recipientId: string) {
    return this.request<Credential>(`/api/recipients/${recipientId}/credential`);
  }

  async deleteRecipient(recipientId: string) {
    return this.request<{ message: string }>(`/api/recipients/${recipientId}`, {
      method: 'DELETE',
    });
  }

  async grantRecipientAccess(recipientId: string, options: AccessGrantOptions) {
    return this.request<{ shares: AccessGrant[] }>(`/api/recipients/${recipientId}/access`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async updateRecipientAccess(recipientId: string, shareId: string, options: Omit<AccessGrantOptions, 'shareId'>) {
    return this.request<{ grant: AccessGrant }>(`/api/recipients/${recipientId}/access/${shareId}`, {
      method: 'PUT',
      body: JSON.stringify(options),
    });
  }

  async revokeRecipientAccess(recipientId: string, shareId: string) {
    return this.request<{ message: string }>(`/api/recipients/${recipientId}/access/${shareId}`, {
      method: 'DELETE',
    });
  }

  // Recipient Portal - shares accessible to current recipient
  async getRecipientShares() {
    return this.request<RecipientShare[]>('/api/recipient/shares');
  }

  async getRecipientShareSchemas(shareName: string) {
    return this.request<Schema[]>(`/api/recipient/shares/${shareName}/schemas`);
  }

  async getRecipientSchemaTables(shareName: string, schemaName: string) {
    return this.request<Table[]>(`/api/recipient/shares/${shareName}/schemas/${schemaName}/tables`);
  }

  async getRecipientTableMetadata(shareName: string, schemaName: string, tableName: string) {
    return this.request<TableMetadata>(
      `/api/recipient/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`
    );
  }

  // Table data preview with time-travel support
  async getTablePreview(
    shareId: string, 
    schemaName: string, 
    tableName: string, 
    limit = 100, 
    offset = 0,
    options?: { version?: number; timestamp?: string }
  ) {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (options?.version !== undefined) params.set('version', options.version.toString());
    if (options?.timestamp) params.set('timestamp', options.timestamp);
    return this.request<TablePreviewResponse>(
      `/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}/preview?${params.toString()}`
    );
  }

  async getRecipientTablePreview(
    shareName: string, 
    schemaName: string, 
    tableName: string, 
    limit = 100, 
    offset = 0,
    options?: { version?: number; timestamp?: string }
  ) {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (options?.version !== undefined) params.set('version', options.version.toString());
    if (options?.timestamp) params.set('timestamp', options.timestamp);
    return this.request<TablePreviewResponse>(
      `/api/recipient/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/preview?${params.toString()}`
    );
  }

  // Change Data Feed (CDF) - get table changes between versions
  async getTableChanges(
    shareId: string,
    schemaName: string,
    tableName: string,
    options: {
      startingVersion?: number;
      endingVersion?: number;
      startingTimestamp?: string;
      endingTimestamp?: string;
    }
  ) {
    const params = new URLSearchParams();
    if (options.startingVersion !== undefined) params.set('startingVersion', options.startingVersion.toString());
    if (options.endingVersion !== undefined) params.set('endingVersion', options.endingVersion.toString());
    if (options.startingTimestamp) params.set('startingTimestamp', options.startingTimestamp);
    if (options.endingTimestamp) params.set('endingTimestamp', options.endingTimestamp);
    return this.request<TableChangesResponse>(
      `/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}/changes?${params.toString()}`
    );
  }

  async getRecipientTableChanges(
    shareName: string,
    schemaName: string,
    tableName: string,
    options: {
      startingVersion?: number;
      endingVersion?: number;
      startingTimestamp?: string;
      endingTimestamp?: string;
    }
  ) {
    const params = new URLSearchParams();
    if (options.startingVersion !== undefined) params.set('startingVersion', options.startingVersion.toString());
    if (options.endingVersion !== undefined) params.set('endingVersion', options.endingVersion.toString());
    if (options.startingTimestamp) params.set('startingTimestamp', options.startingTimestamp);
    if (options.endingTimestamp) params.set('endingTimestamp', options.endingTimestamp);
    return this.request<TableChangesResponse>(
      `/api/recipient/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/changes?${params.toString()}`
    );
  }

  // Validate Delta table location
  async validateTableLocation(location: string) {
    return this.request<{
      valid: boolean;
      error?: string;
      metadata?: {
        name: string;
        numFiles: number;
        numRecords: number;
        schema: { name: string; type: string; nullable: boolean }[];
      };
    }>('/api/shares/validate-location', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
  }

  // Admin - Audit Logs
  async getAuditLogs(filters: AuditLogFilters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.recipientId) params.set('recipientId', filters.recipientId);
    if (filters.shareName) params.set('shareName', filters.shareName);
    if (filters.action) params.set('action', filters.action);
    if (filters.status) params.set('status', filters.status);
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.offset) params.set('offset', filters.offset.toString());

    return this.request<AuditLogsResponse>(`/api/admin/audit-logs?${params.toString()}`);
  }

  async getAuditSummary(days: number = 30) {
    return this.request<AuditSummary>(`/api/admin/audit-logs/summary?days=${days}`);
  }

  async getAuditActivity(days: number = 30) {
    return this.request<{ date: string; count: number }[]>(`/api/admin/audit-logs/activity?days=${days}`);
  }

  async getTopTables(days: number = 30, limit: number = 10) {
    return this.request<TopTable[]>(`/api/admin/audit-logs/top-tables?days=${days}&limit=${limit}`);
  }

  async getTopRecipients(days: number = 30, limit: number = 10) {
    return this.request<TopRecipient[]>(`/api/admin/audit-logs/top-recipients?days=${days}&limit=${limit}`);
  }

  async exportAuditLogs(filters: AuditLogFilters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.recipientId) params.set('recipientId', filters.recipientId);
    if (filters.shareName) params.set('shareName', filters.shareName);
    if (filters.action) params.set('action', filters.action);
    if (filters.status) params.set('status', filters.status);

    const response = await fetch(`${API_URL}/api/admin/audit-logs/export?${params.toString()}`, {
      credentials: 'include', // Send HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }

    return response.blob();
  }

  // Notifications
  async getNotifications() {
    return this.request<NotificationsResponse>('/api/admin/notifications');
  }

  async getNotificationCounts() {
    return this.request<NotificationCounts>('/api/admin/notifications/counts');
  }

  // Admin User Management
  async getAdminUsers() {
    return this.request<AdminUser[]>('/api/admin/users');
  }

  async createAdminUser(data: CreateAdminUserInput) {
    return this.request<AdminUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminUser(userId: string) {
    return this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Webhooks
  async getWebhooks() {
    return this.request<WebhookData[]>('/api/webhooks');
  }

  async getWebhook(id: string) {
    return this.request<WebhookData>(`/api/webhooks/${id}`);
  }

  async getWebhookEventTypes() {
    return this.request<string[]>('/api/webhooks/event-types');
  }

  async createWebhook(data: CreateWebhookInput) {
    return this.request<WebhookData>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWebhook(id: string, data: Partial<CreateWebhookInput>) {
    return this.request<WebhookData>(`/api/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWebhook(id: string) {
    return this.request<{ message: string }>(`/api/webhooks/${id}`, {
      method: 'DELETE',
    });
  }

  async testWebhook(id: string) {
    return this.request<WebhookTestResult>(`/api/webhooks/${id}/test`, {
      method: 'POST',
    });
  }

  async getWebhookDeliveries(id: string, limit = 50) {
    return this.request<WebhookDelivery[]>(`/api/webhooks/${id}/deliveries?limit=${limit}`);
  }

  // Storage Configuration
  async getStorageConfigs() {
    return this.request<StorageConfig[]>('/api/storage/configs');
  }

  async getStorageConfig(id: string) {
    return this.request<StorageConfig>(`/api/storage/configs/${id}`);
  }

  async createStorageConfig(data: CreateStorageConfigInput) {
    return this.request<StorageConfig>('/api/storage/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStorageConfig(id: string, data: Partial<CreateStorageConfigInput>) {
    return this.request<StorageConfig>(`/api/storage/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStorageConfig(id: string) {
    return this.request<{ message: string }>(`/api/storage/configs/${id}`, {
      method: 'DELETE',
    });
  }

  async testStorageConnection(id: string) {
    return this.request<StorageConnectionTestResult>(`/api/storage/configs/${id}/test`, {
      method: 'POST',
    });
  }

  // Storage Browser
  async listBuckets(configId: string) {
    return this.request<BucketInfo[]>(`/api/storage/browse/${configId}/buckets`);
  }

  async listStoragePath(configId: string, bucket: string, path?: string) {
    const params = new URLSearchParams({ bucket });
    if (path) params.set('path', path);
    return this.request<FileInfo[]>(`/api/storage/browse/${configId}/list?${params.toString()}`);
  }

  async detectDeltaTables(configId: string, bucket: string, path?: string, maxDepth: number = 3) {
    const params = new URLSearchParams({ bucket, maxDepth: maxDepth.toString() });
    if (path) params.set('path', path);
    return this.request<DeltaTableInfo[]>(`/api/storage/browse/${configId}/detect?${params.toString()}`);
  }

  async previewStorageTable(configId: string, location: string, limit: number = 10) {
    const params = new URLSearchParams({ location, limit: limit.toString() });
    return this.request<StorageTablePreview>(`/api/storage/browse/${configId}/preview?${params.toString()}`);
  }
}

// Types
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
}

export interface TableMetadata {
  format: { provider: string };
  schema?: { name: string; type: string; nullable: boolean }[];
  schemaString: string;
  partitionColumns: string[];
  numFiles?: number;
  numRecords?: number;
  size?: number;
  version?: number;
  name?: string;
}

export interface TablePreviewResponse {
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  version?: number;
}

export type CDFAction = 'insert' | 'update_preimage' | 'update_postimage' | 'delete';

export interface ChangeRow {
  _change_type: CDFAction;
  _commit_version: number;
  _commit_timestamp?: number;
  [key: string]: unknown;
}

export interface TableChangesResponse {
  changes: ChangeRow[];
  startVersion: number;
  endVersion: number;
  hasMore: boolean;
}

export interface AccessGrantOptions {
  shareId: string;
  expiresAt?: string;
  canDownload?: boolean;
  canQuery?: boolean;
  maxRowsPerQuery?: number;
}

export interface AccessGrant {
  shareId: string;
  shareName: string;
  grantedAt?: string;
  expiresAt?: string | null;
  canDownload?: boolean;
  canQuery?: boolean;
  maxRowsPerQuery?: number | null;
}

export interface Recipient {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
  shares?: string[];
  accessGrants?: AccessGrant[];
  token?: string;
}

export interface Credential {
  shareCredentialsVersion: number;
  endpoint: string;
  bearerToken: string;
  expirationTime: string;
  tokenHint?: string;
}

export interface RecipientShare {
  id: string;
  name: string;
  comment?: string;
  schemas: {
    name: string;
    tables: {
      name: string;
      share: string;
      schema: string;
    }[];
  }[];
}

// Audit Log Types
export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  recipientId?: string;
  shareName?: string;
  action?: string;
  status?: 'success' | 'error';
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  recipient: { id: string; name: string } | null;
  shareName: string | null;
  schemaName: string | null;
  tableName: string | null;
  status: 'success' | 'error';
  errorMessage: string | null;
  rowsAccessed: number | null;
  bytesRead: number | null;
  durationMs: number | null;
  ipAddress: string | null;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface AuditSummary {
  totalQueries: number;
  totalRowsAccessed: number;
  totalBytesRead: number;
  uniqueRecipients: number;
  uniqueShares: number;
  successRate: number;
  recentActivity: { date: string; count: number }[];
  topTables: TopTable[];
  topRecipients: TopRecipient[];
}

export interface TopTable {
  shareName: string;
  schemaName: string;
  tableName: string;
  accessCount: number;
}

export interface TopRecipient {
  recipientId: string;
  recipientName: string;
  accessCount: number;
}

// Storage Configuration Types
export interface StorageConfig {
  id: string;
  name: string;
  type: 's3' | 'azure' | 'gcs';
  isDefault: boolean;
  s3Region?: string | null;
  s3AccessKeyId?: string | null;
  s3Endpoint?: string | null;
  azureAccount?: string | null;
  gcsProjectId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export interface CreateStorageConfigInput {
  name: string;
  type: 's3' | 'azure' | 'gcs';
  isDefault?: boolean;
  // S3
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
  // Azure
  azureAccount?: string;
  azureAccessKey?: string;
  azureConnectionStr?: string;
  // GCS
  gcsProjectId?: string;
  gcsKeyFile?: string;
}

export interface StorageConnectionTestResult {
  success: boolean;
  message: string;
  buckets?: string[];
}

export interface BucketInfo {
  name: string;
  createdAt?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: string;
}

export interface DeltaTableInfo {
  name: string;
  location: string;
  version: number;
  numFiles: number;
  sizeBytes: number;
}

export interface StorageTablePreview {
  metadata: TableMetadata;
  rows: Record<string, unknown>[];
  totalRows: number;
}

// Notification Types
export type NotificationType = 
  | 'token_expiring'
  | 'token_expired'
  | 'access_expiring'
  | 'access_expired'
  | 'failed_access'
  | 'storage_error';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationCounts {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

// Admin User Types
export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  name?: string;
  role?: 'admin' | 'viewer';
}

// Webhook Types
export interface WebhookData {
  id: string;
  name: string;
  url: string;
  secret?: string | null;
  hasSecret: boolean;
  enabled: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  deliveryCount: number;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  secret?: string;
  enabled?: boolean;
  events: string[];
}

export interface WebhookDelivery {
  id: string;
  event: string;
  statusCode?: number;
  success: boolean;
  error?: string;
  durationMs: number;
  createdAt: string;
}

export interface WebhookTestResult {
  delivered: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

export const api = new ApiClient();

