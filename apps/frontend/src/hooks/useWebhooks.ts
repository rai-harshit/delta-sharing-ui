import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WebhookData, CreateWebhookInput, WebhookDelivery, WebhookTestResult } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export type { WebhookData, CreateWebhookInput, WebhookDelivery, WebhookTestResult }

export function useWebhooks() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await api.getWebhooks()
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading,
  })
}

export function useWebhook(id: string) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['webhooks', id],
    queryFn: async () => {
      const response = await api.getWebhook(id)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!id,
  })
}

export function useWebhookEventTypes() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['webhook-event-types'],
    queryFn: async () => {
      const response = await api.getWebhookEventTypes()
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - event types don't change
  })
}

export function useCreateWebhook() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateWebhookInput) => {
      const response = await api.createWebhook(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateWebhookInput> }) => {
      const response = await api.updateWebhook(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.deleteWebhook(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })
}

export function useTestWebhook() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.testWebhook(id)
      return response.data
    },
    onSuccess: () => {
      // Refresh deliveries after test
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] })
    },
  })
}

export function useWebhookDeliveries(webhookId: string, enabled = true) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: async () => {
      const response = await api.getWebhookDeliveries(webhookId)
      return response.data
    },
    enabled: isAuthenticated && isAdmin && !isLoading && !!webhookId && enabled,
  })
}

