/**
 * Utils Tests
 */

import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatRelativeTime, formatBytes } from '@/lib/utils'

describe('cn (className merge)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'disabled')).toBe('base active')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra')
  })
})

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z')
    expect(result).toMatch(/Jan 15, 2024/)
  })

  it('formats Date object', () => {
    // Use a specific timestamp to avoid timezone issues
    const result = formatDate(new Date('2024-06-20T12:00:00'))
    expect(result).toMatch(/Jun 20, 2024/)
  })
})

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent dates', () => {
    const now = new Date()
    const result = formatRelativeTime(now)
    expect(result).toBe('Just now')
  })

  it('returns minutes ago for recent dates', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000)
    const result = formatRelativeTime(date)
    expect(result).toBe('5 minutes ago')
  })

  it('returns hours ago for today', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const result = formatRelativeTime(date)
    expect(result).toBe('3 hours ago')
  })

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = formatRelativeTime(yesterday)
    expect(result).toBe('Yesterday')
  })

  it('returns days ago for recent past', () => {
    const date = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    const result = formatRelativeTime(date)
    expect(result).toBe('4 days ago')
  })

  it('returns weeks ago for older dates', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const result = formatRelativeTime(date)
    expect(result).toBe('2 weeks ago')
  })
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('respects decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB')
    expect(formatBytes(1536, 3)).toBe('1.5 KB')
  })
})














