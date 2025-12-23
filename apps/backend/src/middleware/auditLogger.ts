/**
 * Audit Logging Middleware
 * Logs API access for recipient endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { DeltaAuthenticatedRequest } from './deltaAuth.js';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

// Combined request type that can be either auth type
type AuditableRequest = AuthenticatedRequest | DeltaAuthenticatedRequest;

// Map of route patterns to action types
// Supports: /api/recipient/*, /api/delta/*, and /api/shares/* routes
const ACTION_PATTERNS: { pattern: RegExp; action: string; method?: string }[] = [
  // Legacy /api/recipient/* routes
  { pattern: /^\/api\/recipient\/shares$/, action: 'list_shares' },
  { pattern: /^\/api\/recipient\/shares\/[^/]+$/, action: 'get_share' },
  { pattern: /^\/api\/recipient\/shares\/[^/]+\/schemas$/, action: 'list_schemas' },
  { pattern: /^\/api\/recipient\/shares\/[^/]+\/schemas\/[^/]+\/tables$/, action: 'list_tables' },
  { pattern: /^\/api\/recipient\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/metadata$/, action: 'table_metadata' },
  { pattern: /^\/api\/recipient\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/preview$/, action: 'table_preview' },
  
  // Standard Delta Sharing protocol /api/delta/* routes
  { pattern: /^\/api\/delta\/shares$/, action: 'list_shares' },
  { pattern: /^\/api\/delta\/shares\/[^/]+$/, action: 'get_share' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/schemas$/, action: 'list_schemas' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/schemas\/[^/]+\/tables$/, action: 'list_tables' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/all-tables$/, action: 'list_all_tables' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/version$/, action: 'table_version' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/metadata$/, action: 'table_metadata' },
  { pattern: /^\/api\/delta\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/query$/, action: 'table_query', method: 'POST' },
  
  // Admin /api/shares/* routes
  { pattern: /^\/api\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/preview$/, action: 'table_preview' },
  { pattern: /^\/api\/shares\/[^/]+\/schemas\/[^/]+\/tables\/[^/]+\/metadata$/, action: 'table_metadata' },
];

/**
 * Extract share/schema/table names from URL
 */
function extractPathInfo(path: string): {
  shareName?: string;
  schemaName?: string;
  tableName?: string;
} {
  // Pattern: /api/recipient/shares/:shareName/schemas/:schemaName/tables/:tableName/...
  const recipientMatch = path.match(
    /\/api\/recipient\/shares\/([^/]+)(?:\/schemas\/([^/]+)(?:\/tables\/([^/]+))?)?/
  );
  
  if (recipientMatch) {
    return {
      shareName: recipientMatch[1] ? decodeURIComponent(recipientMatch[1]) : undefined,
      schemaName: recipientMatch[2] ? decodeURIComponent(recipientMatch[2]) : undefined,
      tableName: recipientMatch[3] ? decodeURIComponent(recipientMatch[3]) : undefined,
    };
  }

  // Pattern: /api/delta/shares/:shareName/schemas/:schemaName/tables/:tableName/...
  // Standard Delta Sharing protocol routes
  const deltaMatch = path.match(
    /\/api\/delta\/shares\/([^/]+)(?:\/schemas\/([^/]+)(?:\/tables\/([^/]+))?)?/
  );

  if (deltaMatch) {
    return {
      shareName: deltaMatch[1] ? decodeURIComponent(deltaMatch[1]) : undefined,
      schemaName: deltaMatch[2] ? decodeURIComponent(deltaMatch[2]) : undefined,
      tableName: deltaMatch[3] ? decodeURIComponent(deltaMatch[3]) : undefined,
    };
  }

  // Pattern: /api/shares/:shareId/schemas/:schemaName/tables/:tableName/...
  const adminMatch = path.match(
    /\/api\/shares\/([^/]+)(?:\/schemas\/([^/]+)(?:\/tables\/([^/]+))?)?/
  );

  if (adminMatch) {
    return {
      shareName: adminMatch[1] ? decodeURIComponent(adminMatch[1]) : undefined,
      schemaName: adminMatch[2] ? decodeURIComponent(adminMatch[2]) : undefined,
      tableName: adminMatch[3] ? decodeURIComponent(adminMatch[3]) : undefined,
    };
  }

  return {};
}

/**
 * Determine the action type from the request
 */
function getActionType(method: string, path: string): string | null {
  for (const { pattern, action, method: requiredMethod } of ACTION_PATTERNS) {
    // If pattern specifies a method, check it matches
    if (requiredMethod && requiredMethod !== method) {
      continue;
    }
    // Default to GET if no method specified
    if (!requiredMethod && method !== 'GET') {
      continue;
    }
    
    if (pattern.test(path)) {
      return action;
    }
  }

  return null;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: AuditableRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

/**
 * Extract recipient ID from request (handles both auth types)
 */
function getRecipientId(req: AuditableRequest): string | undefined {
  // Check for delta protocol auth (req.recipient)
  if ('recipient' in req && req.recipient?.id) {
    return req.recipient.id;
  }
  // Check for legacy auth (req.user.recipientId)
  if ('user' in req && req.user?.recipientId) {
    return req.user.recipientId;
  }
  return undefined;
}

/**
 * Audit logging middleware
 * Logs recipient API access to the audit log
 * Supports both /api/recipient/* and /api/delta/* routes
 */
export function auditLogger(
  req: AuditableRequest,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  // Use originalUrl to get the full path including router prefixes
  const fullPath = req.originalUrl.split('?')[0]; // Remove query string
  const action = getActionType(req.method, fullPath);

  // Skip if not a loggable action
  if (!action) {
    return next();
  }

  // Capture response data
  const originalJson = res.json.bind(res);
  let responseData: any = null;

  res.json = function(data: any) {
    responseData = data;
    return originalJson(data);
  };

  // Log after response is sent
  res.on('finish', async () => {
    try {
      const durationMs = Date.now() - startTime;
      const pathInfo = extractPathInfo(fullPath);
      const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

      // Extract rows accessed from response data
      // Handle both wrapped responses ({data: {rows}}) and direct responses ({rows})
      let rowsAccessed: number | undefined;
      if (responseData?.data?.rows) {
        rowsAccessed = Array.isArray(responseData.data.rows)
          ? responseData.data.rows.length
          : undefined;
      } else if (responseData?.rows) {
        rowsAccessed = Array.isArray(responseData.rows)
          ? responseData.rows.length
          : undefined;
      } else if (responseData?.data?.totalRows) {
        rowsAccessed = responseData.data.totalRows;
      } else if (responseData?.rowCount) {
        rowsAccessed = responseData.rowCount;
      }

      await auditService.log({
        action,
        recipientId: getRecipientId(req),
        shareName: pathInfo.shareName,
        schemaName: pathInfo.schemaName,
        tableName: pathInfo.tableName,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: isSuccess ? 'success' : 'error',
        errorMessage: !isSuccess ? (responseData?.error?.message || responseData?.error) : undefined,
        rowsAccessed,
        durationMs,
      });
    } catch (error) {
      logger.error('Failed to log audit entry', error as Error);
    }
  });

  next();
}

/**
 * Log a custom audit event (for manual logging)
 */
export async function logAuditEvent(
  req: AuditableRequest,
  action: string,
  details: {
    shareName?: string;
    schemaName?: string;
    tableName?: string;
    status: 'success' | 'error';
    errorMessage?: string;
    rowsAccessed?: number;
    bytesRead?: number;
  }
) {
  try {
    await auditService.log({
      action,
      recipientId: getRecipientId(req),
      shareName: details.shareName,
      schemaName: details.schemaName,
      tableName: details.tableName,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: details.status,
      errorMessage: details.errorMessage,
      rowsAccessed: details.rowsAccessed,
      bytesRead: details.bytesRead,
    });
  } catch (error) {
    logger.error('Failed to log audit event', error as Error);
  }
}

