import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Share, Schema, Table, TableMetadata } from '@/lib/api'
import { toast } from '@/hooks/useToast'

export function useShares() {
  return useQuery({
    queryKey: ['shares'],
    queryFn: async () => {
      const response = await api.getShares()
      return response.data || []
    },
  })
}

export function useShare(shareId: string) {
  return useQuery({
    queryKey: ['shares', shareId],
    queryFn: async () => {
      const response = await api.getShare(shareId)
      return response.data
    },
    enabled: !!shareId,
  })
}

export function useShareSchemas(shareId: string) {
  return useQuery({
    queryKey: ['shares', shareId, 'schemas'],
    queryFn: async () => {
      const response = await api.getShareSchemas(shareId)
      return response.data || []
    },
    enabled: !!shareId,
  })
}

export function useSchemaTables(shareId: string, schemaName: string) {
  return useQuery({
    queryKey: ['shares', shareId, 'schemas', schemaName, 'tables'],
    queryFn: async () => {
      const response = await api.getSchemaTables(shareId, schemaName)
      return response.data || []
    },
    enabled: !!shareId && !!schemaName,
  })
}

export function useAllTables(shareId: string) {
  return useQuery({
    queryKey: ['shares', shareId, 'all-tables'],
    queryFn: async () => {
      const response = await api.getAllTables(shareId)
      return response.data || []
    },
    enabled: !!shareId,
  })
}

export function useTableMetadata(
  shareId: string,
  schemaName: string,
  tableName: string
) {
  return useQuery({
    queryKey: ['shares', shareId, 'schemas', schemaName, 'tables', tableName, 'metadata'],
    queryFn: async () => {
      const response = await api.getTableMetadata(shareId, schemaName, tableName)
      return response.data
    },
    enabled: !!shareId && !!schemaName && !!tableName,
  })
}

export function useTablePreview(
  shareId: string,
  schemaName: string,
  tableName: string,
  limit: number = 100,
  offset: number = 0,
  options?: { version?: number; timestamp?: string },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['shares', shareId, 'schemas', schemaName, 'tables', tableName, 'preview', limit, offset, options?.version, options?.timestamp],
    queryFn: async () => {
      const response = await api.getTablePreview(shareId, schemaName, tableName, limit, offset, options)
      return response.data
    },
    enabled: enabled && !!shareId && !!schemaName && !!tableName,
  })
}

export function useTableChanges(
  shareId: string,
  schemaName: string,
  tableName: string,
  options: {
    startingVersion?: number;
    endingVersion?: number;
    startingTimestamp?: string;
    endingTimestamp?: string;
  },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['shares', shareId, 'schemas', schemaName, 'tables', tableName, 'changes', options],
    queryFn: async () => {
      const response = await api.getTableChanges(shareId, schemaName, tableName, options)
      return response.data
    },
    enabled: enabled && !!shareId && !!schemaName && !!tableName && 
             (options.startingVersion !== undefined || options.startingTimestamp !== undefined),
  })
}

export function useSharedAssets() {
  return useQuery({
    queryKey: ['shared-assets'],
    queryFn: async () => {
      const response = await api.getSharedAssets()
      return response.data
    },
  })
}

export function useCreateShare() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, comment }: { name: string; comment?: string }) => {
      const response = await api.createShare(name, comment)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      toast({
        title: 'Share created',
        description: 'The share has been created successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating share',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteShare() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (shareId: string) => {
      const response = await api.deleteShare(shareId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      toast({
        title: 'Share deleted',
        description: 'The share has been deleted successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting share',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}



