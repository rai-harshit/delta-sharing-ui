import { useQuery } from '@tanstack/react-query'
import { api, AuditLogFilters } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { isAuthenticated, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const response = await api.getAuditLogs(filters)
      return response.data
    },
    enabled: isAuthenticated && !isLoading,
    retry: 1,
    staleTime: 30000, // 30 seconds
  })
}

export function useAuditSummary(days: number = 30) {
  const { isAuthenticated, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['audit-summary', days],
    queryFn: async () => {
      const response = await api.getAuditSummary(days)
      return response.data
    },
    enabled: isAuthenticated && !isLoading,
    retry: 1,
    staleTime: 30000,
  })
}

export function useAuditActivity(days: number = 30) {
  const { isAuthenticated, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['audit-activity', days],
    queryFn: async () => {
      const response = await api.getAuditActivity(days)
      return response.data
    },
    enabled: isAuthenticated && !isLoading,
    retry: 1,
    staleTime: 30000,
  })
}

export function useTopTables(days: number = 30, limit: number = 10) {
  const { isAuthenticated, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['top-tables', days, limit],
    queryFn: async () => {
      const response = await api.getTopTables(days, limit)
      return response.data
    },
    enabled: isAuthenticated && !isLoading,
    retry: 1,
    staleTime: 30000,
  })
}

export function useTopRecipients(days: number = 30, limit: number = 10) {
  const { isAuthenticated, isLoading } = useAuth()
  
  return useQuery({
    queryKey: ['top-recipients', days, limit],
    queryFn: async () => {
      const response = await api.getTopRecipients(days, limit)
      return response.data
    },
    enabled: isAuthenticated && !isLoading,
    retry: 1,
    staleTime: 30000,
  })
}

