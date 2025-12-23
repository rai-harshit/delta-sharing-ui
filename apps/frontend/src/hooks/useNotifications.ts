import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.getNotifications();
      if (!response.success) {
        throw new Error('Failed to fetch notifications');
      }
      return response.data!;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

export function useNotificationCounts() {
  return useQuery({
    queryKey: ['notificationCounts'],
    queryFn: async () => {
      const response = await api.getNotificationCounts();
      if (!response.success) {
        throw new Error('Failed to fetch notification counts');
      }
      return response.data!;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}





