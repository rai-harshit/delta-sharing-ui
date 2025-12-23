/**
 * Pagination Utilities
 * 
 * Implements cursor-based pagination using nextPageToken per the Delta Sharing protocol.
 * Tokens are base64-encoded JSON containing offset and expiry information.
 */

interface PaginationToken {
  offset: number;
  timestamp: number; // Token creation time for expiry check
}

// Token expiry time (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Encode pagination state into a page token
 */
export function encodePageToken(offset: number): string {
  const token: PaginationToken = {
    offset,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(token)).toString('base64');
}

/**
 * Decode a page token back to an offset
 * Returns null if token is invalid or expired
 */
export function decodePageToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed: PaginationToken = JSON.parse(decoded);
    
    // Validate token structure
    if (typeof parsed.offset !== 'number' || typeof parsed.timestamp !== 'number') {
      return null;
    }
    
    // Check if token is expired
    if (Date.now() - parsed.timestamp > TOKEN_EXPIRY_MS) {
      return null;
    }
    
    return parsed.offset;
  } catch {
    return null;
  }
}

/**
 * Apply pagination to an array of items
 * Returns the paginated items and optional next page token
 */
export function paginate<T>(
  items: T[],
  options: {
    maxResults?: number;
    pageToken?: string;
  }
): {
  items: T[];
  nextPageToken?: string;
} {
  const maxResults = options.maxResults ?? 100;
  
  // Decode offset from token or start from 0
  let offset = 0;
  if (options.pageToken) {
    const decodedOffset = decodePageToken(options.pageToken);
    if (decodedOffset === null) {
      // Invalid or expired token - start from beginning
      offset = 0;
    } else {
      offset = decodedOffset;
    }
  }
  
  // Apply pagination
  const paginatedItems = items.slice(offset, offset + maxResults);
  
  // Generate next page token if there are more items
  const hasMore = offset + maxResults < items.length;
  const nextPageToken = hasMore ? encodePageToken(offset + maxResults) : undefined;
  
  return {
    items: paginatedItems,
    nextPageToken,
  };
}

/**
 * Parse pagination parameters from request query
 */
export function parsePaginationParams(query: Record<string, unknown>): {
  maxResults: number;
  pageToken?: string;
} {
  let maxResults = 100; // Default
  
  if (query.maxResults) {
    const parsed = parseInt(String(query.maxResults), 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxResults = Math.min(parsed, 1000); // Cap at 1000
    }
  }
  
  return {
    maxResults,
    pageToken: query.pageToken as string | undefined,
  };
}







