import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  Download,
  Loader2,
  History,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChangeRow, CDFAction } from '@/lib/api'

interface ChangesTabProps {
  changes?: ChangeRow[]
  isLoading: boolean
  error?: Error | null
  latestVersion: number
  startVersion: number
  endVersion: number
  onVersionRangeChange: (start: number, end: number) => void
}

const ACTION_CONFIG: Record<CDFAction, { icon: typeof Plus; label: string; color: string }> = {
  insert: { icon: Plus, label: 'Insert', color: 'text-emerald-500 bg-emerald-500/10' },
  delete: { icon: Minus, label: 'Delete', color: 'text-red-500 bg-red-500/10' },
  update_preimage: { icon: RefreshCw, label: 'Update (before)', color: 'text-amber-500 bg-amber-500/10' },
  update_postimage: { icon: RefreshCw, label: 'Update (after)', color: 'text-blue-500 bg-blue-500/10' },
}

export function ChangesTab({
  changes,
  isLoading,
  error,
  latestVersion,
  startVersion,
  endVersion,
  onVersionRangeChange,
}: ChangesTabProps) {
  // Generate version options
  const versionOptions = Array.from({ length: latestVersion + 1 }, (_, i) => i)

  // Get unique columns from changes (excluding CDF metadata columns)
  const dataColumns = changes?.[0]
    ? Object.keys(changes[0]).filter(k => !k.startsWith('_'))
    : []

  // Calculate change summary
  const summary = changes?.reduce(
    (acc, change) => {
      if (change._change_type === 'insert') acc.inserts++
      else if (change._change_type === 'delete') acc.deletes++
      else if (change._change_type === 'update_postimage') acc.updates++
      return acc
    },
    { inserts: 0, deletes: 0, updates: 0 }
  ) || { inserts: 0, deletes: 0, updates: 0 }

  // Export changes as CSV
  const exportToCSV = () => {
    if (!changes || changes.length === 0) return

    const headers = ['_change_type', '_commit_version', ...dataColumns]
    const csvContent = [
      headers.join(','),
      ...changes.map(row =>
        headers.map(h => {
          const val = row[h]
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val ?? ''
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `changes_v${startVersion}_to_v${endVersion}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format cell value
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // No history available
  if (latestVersion === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">No Change History</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This table is at version 0 (initial version).
          <br />
          Changes will appear here after table updates.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Version range selector */}
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">From version:</Label>
          <Select
            value={startVersion.toString()}
            onValueChange={(v) => onVersionRangeChange(parseInt(v), endVersion)}
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versionOptions.map((v) => (
                <SelectItem key={v} value={v.toString()} disabled={v >= endVersion}>
                  v{v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">To version:</Label>
          <Select
            value={endVersion.toString()}
            onValueChange={(v) => onVersionRangeChange(startVersion, parseInt(v))}
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versionOptions.map((v) => (
                <SelectItem key={v} value={v.toString()} disabled={v <= startVersion}>
                  v{v} {v === latestVersion && '(latest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={exportToCSV}
          disabled={!changes || changes.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error.message}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Changes table */}
      {!isLoading && !error && changes && changes.length > 0 && (
        <>
          {/* Summary */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-600">
              <Plus className="h-3 w-3" />
              {summary.inserts} inserted
            </Badge>
            <Badge variant="outline" className="gap-1 bg-red-500/10 border-red-500/30 text-red-600">
              <Minus className="h-3 w-3" />
              {summary.deletes} deleted
            </Badge>
            <Badge variant="outline" className="gap-1 bg-blue-500/10 border-blue-500/30 text-blue-600">
              <RefreshCw className="h-3 w-3" />
              {summary.updates} updated
            </Badge>
          </div>

          {/* Changes data */}
          <div className="border rounded-lg overflow-auto max-h-96">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-32">Action</TableHead>
                  <TableHead className="w-20">Version</TableHead>
                  {dataColumns.map(col => (
                    <TableHead key={col} className="font-mono text-xs whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((row, idx) => {
                  const config = ACTION_CONFIG[row._change_type] || ACTION_CONFIG.insert
                  const Icon = config.icon
                  
                  return (
                    <TableRow key={idx} className={cn(
                      row._change_type === 'delete' && 'bg-red-500/5',
                      row._change_type === 'insert' && 'bg-emerald-500/5',
                      row._change_type === 'update_preimage' && 'bg-amber-500/5',
                      row._change_type === 'update_postimage' && 'bg-blue-500/5',
                    )}>
                      <TableCell>
                        <Badge variant="outline" className={cn('gap-1', config.color)}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        v{row._commit_version}
                      </TableCell>
                      {dataColumns.map(col => (
                        <TableCell key={col} className="font-mono text-xs max-w-[200px] truncate">
                          {formatCellValue(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !error && (!changes || changes.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GitCommit className="h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">No Changes Found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No changes between version {startVersion} and version {endVersion}.
            <br />
            Try selecting a different version range.
          </p>
        </div>
      )}
    </div>
  )
}







