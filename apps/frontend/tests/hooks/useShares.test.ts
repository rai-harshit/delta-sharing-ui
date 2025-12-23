/**
 * useShares Hook Tests
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getShares: vi.fn(),
    createShare: vi.fn(),
    deleteShare: vi.fn(),
    getShare: vi.fn(),
  },
}))

// Import after mocking
import { useShares, useShare, useCreateShare, useDeleteShare } from '@/hooks/useShares'
import { api } from '@/lib/api'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useShares Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useShares', () => {
    it('should fetch shares successfully', async () => {
      const mockShares = [
        { id: '1', name: 'share1', comment: 'First share' },
        { id: '2', name: 'share2', comment: 'Second share' },
      ]
      
      vi.mocked(api.getShares).mockResolvedValue({ data: mockShares })

      const { result } = renderHook(() => useShares(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockShares)
      expect(api.getShares).toHaveBeenCalledTimes(1)
    })

    it('should handle error when fetching shares', async () => {
      vi.mocked(api.getShares).mockRejectedValue(new Error('Failed to fetch'))

      const { result } = renderHook(() => useShares(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBeDefined()
    })
  })

  describe('useShare', () => {
    it('should fetch a single share by ID', async () => {
      const mockShare = {
        id: '1',
        name: 'share1',
        comment: 'Test share',
        schemas: [],
      }

      vi.mocked(api.getShare).mockResolvedValue({ data: mockShare })

      const { result } = renderHook(() => useShare('1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockShare)
      expect(api.getShare).toHaveBeenCalledWith('1')
    })

    it('should not fetch when shareId is undefined', async () => {
      const { result } = renderHook(() => useShare(undefined), {
        wrapper: createWrapper(),
      })

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false)
      expect(api.getShare).not.toHaveBeenCalled()
    })
  })

  describe('useCreateShare', () => {
    it('should create a share successfully', async () => {
      const newShare = { id: '3', name: 'new_share', comment: 'New share' }
      vi.mocked(api.createShare).mockResolvedValue({ data: newShare })

      const { result } = renderHook(() => useCreateShare(), {
        wrapper: createWrapper(),
      })

      result.current.mutate({ name: 'new_share', comment: 'New share' })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.createShare).toHaveBeenCalledWith('new_share', 'New share')
    })
  })

  describe('useDeleteShare', () => {
    it('should delete a share successfully', async () => {
      vi.mocked(api.deleteShare).mockResolvedValue({ data: undefined })

      const { result } = renderHook(() => useDeleteShare(), {
        wrapper: createWrapper(),
      })

      result.current.mutate('share-id-to-delete')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.deleteShare).toHaveBeenCalledWith('share-id-to-delete')
    })
  })
})


