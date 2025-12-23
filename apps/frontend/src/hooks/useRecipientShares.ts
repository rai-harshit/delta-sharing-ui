/**
 * Recipient Shares Hooks
 * 
 * React Query hooks for fetching data from the Delta Sharing server.
 * These use the DeltaSharingClient from RecipientContext.
 */

import { useQuery } from '@tanstack/react-query'
import { useRecipient } from '@/context/RecipientContext'
import type { Share, Schema, Table, TableMetadata, QueryResult } from '@/lib/delta-sharing-client'

/**
 * Fetch all shares with their full hierarchy (schemas and tables)
 */
export function useRecipientShares() {
  const { client, isConnected } = useRecipient()
  
  return useQuery({
    queryKey: ['recipient-shares'],
    queryFn: async () => {
      if (!client) throw new Error('Not connected')
      return client.getSharesWithHierarchy()
    },
    enabled: isConnected && !!client,
  })
}

/**
 * Fetch table metadata
 */
export function useRecipientTableMetadata(
  shareName: string,
  schemaName: string,
  tableName: string
) {
  const { client, isConnected } = useRecipient()
  
  return useQuery({
    queryKey: ['recipient-table-metadata', shareName, schemaName, tableName],
    queryFn: async () => {
      if (!client) throw new Error('Not connected')
      const metadata = await client.getTableMetadata(shareName, schemaName, tableName)
      
      // Transform to match expected format in components
      return {
        format: metadata.metadata.format,
        schemaString: metadata.metadata.schemaString,
        partitionColumns: metadata.metadata.partitionColumns,
        numRecords: undefined as number | undefined, // Not in standard protocol
        numFiles: metadata.metadata.numFiles,
        size: metadata.metadata.size,
        version: metadata.metadata.version,
        name: metadata.metadata.name,
      }
    },
    enabled: isConnected && !!client && !!shareName && !!schemaName && !!tableName,
  })
}

/**
 * Fetch table data preview with pagination and time-travel
 */
export function useRecipientTablePreview(
  shareName: string,
  schemaName: string,
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  options?: { version?: number; timestamp?: string }
) {
  const { client, isConnected } = useRecipient()
  
  return useQuery({
    queryKey: ['recipient-table-preview', shareName, schemaName, tableName, limit, offset, options?.version, options?.timestamp],
    queryFn: async () => {
      if (!client) throw new Error('Not connected')
      const result = await client.queryTable(shareName, schemaName, tableName, { 
        limit, 
        offset,
        version: options?.version,
        timestamp: options?.timestamp,
      })
      
      // Transform to match expected format
      return {
        rows: result.rows,
        totalRows: result.rowCount,
        hasMore: result.hasMore,
        version: result.version,
      }
    },
    enabled: isConnected && !!client && !!shareName && !!schemaName && !!tableName,
  })
}

/**
 * Fetch table changes (CDF) between versions
 */
export function useRecipientTableChanges(
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
  const { client, isConnected } = useRecipient()
  
  return useQuery({
    queryKey: ['recipient-table-changes', shareName, schemaName, tableName, options],
    queryFn: async () => {
      if (!client) throw new Error('Not connected')
      return client.queryTableChanges(shareName, schemaName, tableName, options)
    },
    enabled: isConnected && !!client && !!shareName && !!schemaName && !!tableName &&
             (options.startingVersion !== undefined || options.startingTimestamp !== undefined),
  })
}

// Re-export types for convenience
export type { Share, Schema, Table, TableMetadata, QueryResult }
