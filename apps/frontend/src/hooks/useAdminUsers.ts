import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, CreateAdminUserInput } from '@/lib/api';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const response = await api.getAdminUsers();
      if (!response.success) {
        throw new Error('Failed to fetch admin users');
      }
      return response.data!;
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdminUserInput) => {
      const response = await api.createAdminUser(data);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create user');
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.deleteAdminUser(userId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete user');
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
}





