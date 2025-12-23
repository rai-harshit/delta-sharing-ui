import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, AccessGrantOptions } from '@/lib/api'
import { toast } from '@/hooks/useToast'

export function useRecipients() {
  return useQuery({
    queryKey: ['recipients'],
    queryFn: async () => {
      const response = await api.getRecipients()
      return response.data || []
    },
  })
}

export function useRecipient(recipientId: string) {
  return useQuery({
    queryKey: ['recipients', recipientId],
    queryFn: async () => {
      const response = await api.getRecipient(recipientId)
      return response.data
    },
    enabled: !!recipientId,
  })
}

export function useRecipientCredential(recipientId: string) {
  return useQuery({
    queryKey: ['recipients', recipientId, 'credential'],
    queryFn: async () => {
      const response = await api.getRecipientCredential(recipientId)
      return response.data
    },
    enabled: !!recipientId,
  })
}

export function useCreateRecipient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      email,
      shares,
    }: {
      name: string
      email?: string
      shares?: string[]
    }) => {
      const response = await api.createRecipient(name, email, shares)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Recipient created',
        description: 'The recipient has been created successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating recipient',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateRecipient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipientId,
      updates,
    }: {
      recipientId: string
      updates: { email?: string; shares?: string[] }
    }) => {
      const response = await api.updateRecipient(recipientId, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Recipient updated',
        description: 'The recipient has been updated successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating recipient',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useRotateRecipientToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await api.rotateRecipientToken(recipientId)
      return response.data
    },
    onSuccess: (_, recipientId) => {
      queryClient.invalidateQueries({ queryKey: ['recipients', recipientId] })
      toast({
        title: 'Token rotated',
        description: 'A new token has been generated. Please share the new credential.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error rotating token',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteRecipient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await api.deleteRecipient(recipientId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Recipient deleted',
        description: 'The recipient has been deleted successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting recipient',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useGrantAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipientId,
      options,
    }: {
      recipientId: string
      options: AccessGrantOptions
    }) => {
      const response = await api.grantRecipientAccess(recipientId, options)
      return response.data
    },
    onSuccess: (_, { recipientId }) => {
      queryClient.invalidateQueries({ queryKey: ['recipients', recipientId] })
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Access granted',
        description: 'Share access has been configured successfully.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error granting access',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipientId,
      shareId,
      options,
    }: {
      recipientId: string
      shareId: string
      options: Omit<AccessGrantOptions, 'shareId'>
    }) => {
      const response = await api.updateRecipientAccess(recipientId, shareId, options)
      return response.data
    },
    onSuccess: (_, { recipientId }) => {
      queryClient.invalidateQueries({ queryKey: ['recipients', recipientId] })
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Access updated',
        description: 'Share access configuration has been updated.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating access',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useRevokeAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipientId,
      shareId,
    }: {
      recipientId: string
      shareId: string
    }) => {
      const response = await api.revokeRecipientAccess(recipientId, shareId)
      return response.data
    },
    onSuccess: (_, { recipientId }) => {
      queryClient.invalidateQueries({ queryKey: ['recipients', recipientId] })
      queryClient.invalidateQueries({ queryKey: ['recipients'] })
      toast({
        title: 'Access revoked',
        description: 'Share access has been revoked.',
        variant: 'default',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error revoking access',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}









