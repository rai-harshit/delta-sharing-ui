import { useState } from 'react'
import { useAuditLogs, useAuditSummary } from '@/hooks/useAuditLogs'
import { api, AuditLogFilters } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Database,
  Users,
  TrendingUp,
  Clock,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileText,
} from 'lucide-react'
import { formatRelativeTime, formatBytes } from '@/lib/utils'

export function AuditDashboardPage() {
  const [days, setDays] = useState(30)
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')

  const { data: summary, isLoading: summaryLoading } = useAuditSummary(days)
  const { data: logsData, isLoading: logsLoading } = useAuditLogs(filters)

  const handleExport = async () => {
    try {
      const blob = await api.exportAuditLogs(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Export failed silently - user can retry
    }
  }

  const handleFilterChange = (key: keyof AuditLogFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset pagination on filter change
    }))
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    const limit = filters.limit || 20
    setFilters(prev => ({
      ...prev,
      offset: direction === 'next' 
        ? (prev.offset || 0) + limit 
        : Math.max(0, (prev.offset || 0) - limit),
    }))
  }

  const stats = [
    {
      title: 'Total Queries',
      value: summary?.totalQueries || 0,
      icon: Activity,
      color: 'from-delta-cyan to-cyan-400',
      subtitle: `Last ${days} days`,
    },
    {
      title: 'Rows Accessed',
      value: summary?.totalRowsAccessed?.toLocaleString() || '0',
      icon: Database,
      color: 'from-delta-purple to-purple-400',
      subtitle: 'Total data read',
    },
    {
      title: 'Unique Recipients',
      value: summary?.uniqueRecipients || 0,
      icon: Users,
      color: 'from-emerald-500 to-emerald-400',
      subtitle: 'Active users',
    },
    {
      title: 'Success Rate',
      value: `${(summary?.successRate || 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'from-amber-500 to-amber-400',
      subtitle: 'Query success',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-delta-cyan" />
            Audit Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor data access patterns and usage
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stat.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Chart and Top Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-delta-cyan" />
              Daily Activity
            </CardTitle>
            <CardDescription>Query volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : summary?.recentActivity ? (
              (() => {
                const slicedData = summary.recentActivity.slice(-14)
                const maxCount = Math.max(...slicedData.map(d => d.count), 1)
                const maxBarHeight = 130 // pixels
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                return (
                  <div className="h-48 flex">
                    {/* Y-axis */}
                    <div className="w-8 h-36 flex flex-col justify-between text-[10px] text-muted-foreground pr-1">
                      <span className="text-right">{maxCount}</span>
                      <span className="text-right">{Math.round(maxCount / 2)}</span>
                      <span className="text-right">0</span>
                    </div>
                    {/* Chart area */}
                    <div className="flex-1 flex flex-col">
                      {/* Bar chart */}
                      <div className="h-36 flex items-end gap-1 border-l border-b border-border/50">
                        {slicedData.map((day) => {
                          const barHeight = Math.max((day.count / maxCount) * maxBarHeight, day.count > 0 ? 8 : 2)
                          return (
                            <div
                              key={day.date}
                              className="flex-1 flex flex-col items-center justify-end group cursor-pointer"
                            >
                              {/* Value label on hover */}
                              {day.count > 0 && (
                                <span className="text-[10px] text-delta-cyan font-medium mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {day.count}
                                </span>
                              )}
                              <div
                                className="w-full bg-gradient-to-t from-delta-cyan to-delta-purple rounded-t transition-all group-hover:from-delta-cyan/80 group-hover:to-delta-purple/80"
                                style={{ height: `${barHeight}px` }}
                              />
                            </div>
                          )
                        })}
                      </div>
                      {/* X-axis labels */}
                      <div className="h-10 flex gap-1 pt-1">
                        {slicedData.map((day, idx) => {
                          const dateParts = day.date.split('-')
                          const monthIdx = parseInt(dateParts[1], 10) - 1
                          const dayNum = parseInt(dateParts[2], 10)
                          return (
                            <div key={day.date} className="flex-1 text-center">
                              {idx % 3 === 0 && (
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground">{months[monthIdx]} {dayNum}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No activity data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tables */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-delta-purple" />
              Most Accessed Tables
            </CardTitle>
            <CardDescription>Top tables by query count</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : summary?.topTables && summary.topTables.length > 0 ? (
              <div className="space-y-2">
                {summary.topTables.slice(0, 5).map((table, idx) => {
                  const maxCount = summary.topTables[0]?.accessCount || 1
                  const width = (table.accessCount / maxCount) * 100
                  return (
                    <div key={`${table.shareName}.${table.schemaName}.${table.tableName}`} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-4">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate">
                            {table.shareName}.{table.schemaName}.{table.tableName}
                          </span>
                          <span className="text-muted-foreground">{table.accessCount}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-delta-purple to-delta-cyan rounded-full"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No table access data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs Table */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Access Logs
          </TabsTrigger>
          <TabsTrigger value="recipients" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Top Recipients
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Access Logs</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter by share..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        handleFilterChange('shareName', e.target.value || undefined)
                      }}
                      className="pl-9 w-48"
                    />
                  </div>
                  <Select
                    value={filters.action || 'all'}
                    onValueChange={(v) => handleFilterChange('action', v === 'all' ? undefined : v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="table_preview">Table Preview</SelectItem>
                      <SelectItem value="table_metadata">Table Metadata</SelectItem>
                      <SelectItem value="list_shares">List Shares</SelectItem>
                      <SelectItem value="list_tables">List Tables</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(v) => handleFilterChange('status', v === 'all' ? undefined : v)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logsData?.logs && logsData.logs.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsData.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {formatRelativeTime(log.timestamp)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.recipient ? (
                              <span className="font-medium">{log.recipient.name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.tableName ? (
                              <span className="font-mono text-xs">
                                {log.shareName}.{log.schemaName}.{log.tableName}
                              </span>
                            ) : log.shareName ? (
                              <span className="font-mono text-xs">{log.shareName}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.status === 'success' ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {log.durationMs ? `${log.durationMs}ms` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(filters.offset || 0) + 1}-{Math.min((filters.offset || 0) + (filters.limit || 20), logsData.total)} of {logsData.total}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange('prev')}
                        disabled={(filters.offset || 0) === 0}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange('next')}
                        disabled={!logsData.hasMore}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <h3 className="mt-4 font-medium">No audit logs found</h3>
                  <p className="text-muted-foreground text-sm">
                    Access logs will appear here when recipients query shared data
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Recipients</CardTitle>
              <CardDescription>Most active data consumers</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : summary?.topRecipients && summary.topRecipients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="text-right">Access Count</TableHead>
                      <TableHead className="w-48">Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.topRecipients.map((recipient, idx) => {
                      const maxCount = summary.topRecipients[0]?.accessCount || 1
                      const width = (recipient.accessCount / maxCount) * 100
                      return (
                        <TableRow key={recipient.recipientId}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-delta-purple/10">
                                <Users className="h-4 w-4 text-delta-purple" />
                              </div>
                              <span className="font-medium">{recipient.recipientName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {recipient.accessCount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-delta-cyan to-delta-purple rounded-full"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <h3 className="mt-4 font-medium">No recipient data</h3>
                  <p className="text-muted-foreground text-sm">
                    Recipient activity will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

