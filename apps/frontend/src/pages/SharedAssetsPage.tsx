import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSharedAssets } from '@/hooks/useShares'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Database,
  FolderTree,
  Share2,
  Search,
  Users,
  ArrowRight,
  Package,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

export function SharedAssetsPage() {
  const { data: assets, isLoading } = useSharedAssets()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Get initial tab from URL or default to 'tables'
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'schemas' ? 'schemas' : 'tables')

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Sync with URL if it changes externally
  useEffect(() => {
    const newTab = searchParams.get('tab')
    if (newTab === 'schemas' || newTab === 'tables') {
      setActiveTab(newTab)
    }
  }, [searchParams])

  // Filter tables based on search
  const filteredTables = assets?.tables.filter(table =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.alias?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.shareName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.schemaName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Filter schemas based on search
  const filteredSchemas = assets?.schemas.filter(schema =>
    schema.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    schema.shareName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const summaryStats = [
    {
      title: 'Tables',
      value: assets?.summary.totalTables || 0,
      icon: Database,
      color: 'from-emerald-500 to-emerald-400',
    },
    {
      title: 'Schemas',
      value: assets?.summary.totalSchemas || 0,
      icon: FolderTree,
      color: 'from-amber-500 to-amber-400',
    },
    {
      title: 'Shares',
      value: assets?.summary.totalShares || 0,
      icon: Share2,
      color: 'from-delta-cyan to-cyan-400',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-delta-purple" />
            Shared Assets
          </h1>
          <p className="text-muted-foreground">
            All schemas and tables you're sharing with recipients
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{stat.value}</p>
                  )}
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tables, schemas, or shares..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-muted/50 pl-9"
        />
      </div>

      {/* Tabs for Tables and Schemas */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Tables ({filteredTables.length})
          </TabsTrigger>
          <TabsTrigger value="schemas" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Schemas ({filteredSchemas.length})
          </TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Shared Tables</CardTitle>
              <CardDescription>
                Tables being shared across all your shares
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredTables.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Share / Schema</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.map((table) => (
                      <TableRow key={table.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                              <Database className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                              <p className="font-medium">{table.alias || table.name}</p>
                              {table.alias && table.alias !== table.name && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {table.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/shares/${table.shareName}`}
                              className="text-delta-cyan hover:underline"
                            >
                              {table.shareName}
                            </Link>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">{table.schemaName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{table.recipientCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(table.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/shares/${table.shareName}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">No tables found</h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Create shares and add tables to start sharing data'}
                  </p>
                  {!searchQuery && (
                    <Button className="mt-4" asChild>
                      <Link to="/shares">Go to Shares</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schemas Tab */}
        <TabsContent value="schemas">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Schemas</CardTitle>
              <CardDescription>
                Schemas organizing your shared tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredSchemas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schema</TableHead>
                      <TableHead>Share</TableHead>
                      <TableHead>Tables</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchemas.map((schema) => (
                      <TableRow key={schema.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                              <FolderTree className="h-4 w-4 text-amber-500" />
                            </div>
                            <span className="font-medium">{schema.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/shares/${schema.shareName}`}
                            className="flex items-center gap-2 text-delta-cyan hover:underline"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {schema.shareName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {schema.tableCount} {schema.tableCount === 1 ? 'table' : 'tables'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/shares/${schema.shareName}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderTree className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">No schemas found</h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Create shares and add schemas to organize your tables'}
                  </p>
                  {!searchQuery && (
                    <Button className="mt-4" asChild>
                      <Link to="/shares">Go to Shares</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

