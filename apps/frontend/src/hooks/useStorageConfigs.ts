import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CreateStorageConfigInput } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function useStorageConfigs() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['storage-configs'],
    queryFn: async () => {
      const response = await api.getStorageConfigs()
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading,
  })
}

export function useStorageConfig(id: string) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['storage-configs', id],
    queryFn: async () => {
      const response = await api.getStorageConfig(id)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!id,
  })
}

export function useCreateStorageConfig() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateStorageConfigInput) => {
      const response = await api.createStorageConfig(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
    },
  })
}

export function useUpdateStorageConfig() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateStorageConfigInput> }) => {
      const response = await api.updateStorageConfig(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
    },
  })
}

export function useDeleteStorageConfig() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.deleteStorageConfig(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
    },
  })
}

export function useTestStorageConnection() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.testStorageConnection(id)
      return response.data
    },
  })
}

// Storage Browser hooks
export function useBuckets(configId: string | null) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['storage-buckets', configId],
    queryFn: async () => {
      if (!configId) return []
      const response = await api.listBuckets(configId)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!configId,
  })
}

export function useStoragePath(configId: string | null, bucket: string | null, path?: string) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['storage-path', configId, bucket, path],
    queryFn: async () => {
      if (!configId || !bucket) return []
      const response = await api.listStoragePath(configId, bucket, path)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!configId && !!bucket,
  })
}

export function useDetectDeltaTables(configId: string | null, bucket: string | null, path?: string, enabled: boolean = false) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['storage-detect', configId, bucket, path],
    queryFn: async () => {
      if (!configId || !bucket) return []
      const response = await api.detectDeltaTables(configId, bucket, path)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!configId && !!bucket && enabled,
  })
}














