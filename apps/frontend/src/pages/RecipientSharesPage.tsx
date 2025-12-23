import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useRecipientShares,
  useRecipientTableMetadata,
  useRecipientTablePreview,
  useRecipientTableChanges,
} from '@/hooks/useRecipientShares'
import { useRecipient } from '@/context/RecipientContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
  Search,
  FolderTree,
  Database,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  Code,
  Copy,
  Check,
  FileJson,
  TableIcon,
  Download,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'
import { VersionTimestampSelector, TimeTravelBadge } from '@/components/table/VersionTimestampSelector'
import { ChangesTab } from '@/components/table/ChangesTab'

interface TableInfo {
  share: string
  schema: string
  table: string
}

export function RecipientSharesPage() {
  const navigate = useNavigate()
  const { isConnected, isLoading: authLoading, endpoint, disconnect } = useRecipient()
  const { data: shares, isLoading, error } = useRecipientShares()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedShares, setExpandedShares] = useState<string[]>([])
  const [expandedSchemas, setExpandedSchemas] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)

  // Redirect to login if not connected
  useEffect(() => {
    if (!authLoading && !isConnected) {
      navigate('/recipient', { replace: true })
    }
  }, [isConnected, authLoading, navigate])

  const filteredShares = shares?.filter(share =>
    share.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleShare = (shareName: string) => {
    setExpandedShares(prev =>
      prev.includes(shareName)
        ? prev.filter(s => s !== shareName)
        : [...prev, shareName]
    )
  }

  const toggleSchema = (key: string) => {
    setExpandedSchemas(prev =>
      prev.includes(key)
        ? prev.filter(s => s !== key)
        : [...prev, key]
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Available Shares</h1>
          <p className="text-muted-foreground">
            Browse and explore the data shares you have access to
          </p>
          {endpoint && (
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate max-w-md">
              Connected to: {endpoint}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error instanceof Error ? error.message : 'Failed to load shares'}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search shares..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-muted/50 pl-9"
        />
      </div>

      {/* Shares browser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-delta-purple" />
            Data Catalog
          </CardTitle>
          <CardDescription>
            Click on a share to explore its schemas and tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredShares && filteredShares.length > 0 ? (
            <div className="space-y-2">
              {filteredShares.map((share) => (
                <ShareItem
                  key={share.id || share.name}
                  share={share}
                  isExpanded={expandedShares.includes(share.name)}
                  onToggle={() => toggleShare(share.name)}
                  expandedSchemas={expandedSchemas}
                  onToggleSchema={toggleSchema}
                  onSelectTable={setSelectedTable}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderTree className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No shares found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'You don\'t have access to any shares yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Preview Modal */}
      {selectedTable && (
        <TablePreviewModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  )
}

// Share item component
function ShareItem({
  share,
  isExpanded,
  onToggle,
  expandedSchemas,
  onToggleSchema,
  onSelectTable,
}: {
  share: { id?: string; name: string; comment?: string; schemas?: Array<{ name: string; tables: Array<{ name: string }> }> }
  isExpanded: boolean
  onToggle: () => void
  expandedSchemas: string[]
  onToggleSchema: (key: string) => void
  onSelectTable: (table: TableInfo) => void
}) {
  const schemas = share.schemas

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-purple/10">
            <FolderTree className="h-5 w-5 text-delta-purple" />
          </div>
          <div>
            <span className="font-medium">{share.name}</span>
            <p className="text-xs text-muted-foreground">
              {`${schemas?.length || 0} schemas`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/20">
          {schemas && schemas.length > 0 ? (
            <div className="divide-y divide-border">
              {schemas.map((schema) => {
                const key = `${share.name}:${schema.name}`
                return (
                  <SchemaItem
                    key={key}
                    shareName={share.name}
                    schema={schema}
                    isExpanded={expandedSchemas.includes(key)}
                    onToggle={() => onToggleSchema(key)}
                    onSelectTable={onSelectTable}
                  />
                )
              })}
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No schemas in this share
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Schema item component
function SchemaItem({
  shareName,
  schema,
  isExpanded,
  onToggle,
  onSelectTable,
}: {
  shareName: string
  schema: { name: string; tables?: Array<{ name: string }> }
  isExpanded: boolean
  onToggle: () => void
  onSelectTable: (table: TableInfo) => void
}) {
  const tables = schema.tables

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 pl-8 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-delta-cyan" />
          <span className="text-sm font-medium">{schema.name}</span>
          <Badge variant="outline" className="text-xs">
            {`${tables?.length || 0} tables`}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="bg-muted/30 py-2">
          {tables && tables.length > 0 ? (
            <div className="space-y-1 px-4">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => onSelectTable({
                    share: shareName,
                    schema: schema.name,
                    table: table.name,
                  })}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-2 text-left hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{table.name}</span>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-8 py-2 text-sm text-muted-foreground">
              No tables in this schema
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Table preview modal with data viewing
function TablePreviewModal({
  table,
  onClose,
}: {
  table: TableInfo
  onClose: () => void
}) {
  const { data: metadata, isLoading: metadataLoading } = useRecipientTableMetadata(
    table.share,
    table.schema,
    table.table
  )
  const [copied, setCopied] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 50
  
  // Time-travel state
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | undefined>(undefined)

  const { data: previewData, isLoading: previewLoading } = useRecipientTablePreview(
    table.share,
    table.schema,
    table.table,
    pageSize,
    page * pageSize,
    { version: selectedVersion, timestamp: selectedTimestamp }
  )
  
  // CDF (Changes) state
  const [changesStartVersion, setChangesStartVersion] = useState(0)
  const [changesEndVersion, setChangesEndVersion] = useState(metadata?.version ?? 0)
  
  // Update end version when metadata loads
  if (metadata?.version !== undefined && changesEndVersion === 0 && metadata.version > 0) {
    setChangesEndVersion(metadata.version)
  }
  
  const { data: changesData, isLoading: changesLoading, error: changesError } = useRecipientTableChanges(
    table.share,
    table.schema,
    table.table,
    { startingVersion: changesStartVersion, endingVersion: changesEndVersion }
  )
  
  // Reset page when time-travel parameters change
  const handleVersionChange = (version: number | undefined) => {
    setSelectedVersion(version)
    setSelectedTimestamp(undefined)
    setPage(0)
  }
  
  const handleTimestampChange = (timestamp: string | undefined) => {
    setSelectedTimestamp(timestamp)
    setSelectedVersion(undefined)
    setPage(0)
  }
  
  const handleVersionRangeChange = (start: number, end: number) => {
    setChangesStartVersion(start)
    setChangesEndVersion(end)
  }

  const fullTableName = `${table.share}.${table.schema}.${table.table}`

  const pythonCode = `import delta_sharing

# Load the credential file
profile_file = "path/to/credential.json"

# Create a sharing client
client = delta_sharing.SharingClient(profile_file)

# Load table as Pandas DataFrame
df = delta_sharing.load_as_pandas(
    f"{profile_file}#${fullTableName}"
)

# Preview data
print(df.head())`

  const pysparkCode = `from pyspark.sql import SparkSession

# Initialize Spark with Delta Sharing
spark = SparkSession.builder \\
    .appName("DeltaSharing") \\
    .config("spark.jars.packages", "io.delta:delta-sharing-spark_2.12:1.0.0") \\
    .getOrCreate()

# Load table
df = spark.read.format("deltaSharing") \\
    .load("path/to/credential.json#${fullTableName}")

# Preview data
df.show()`

  const handleCopy = async (code: string, key: string) => {
    await copyToClipboard(code)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // Export data as CSV
  const exportToCSV = () => {
    if (!previewData?.rows || previewData.rows.length === 0) return

    const headers = Object.keys(previewData.rows[0])
    const csvContent = [
      headers.join(','),
      ...previewData.rows.map(row => 
        headers.map(h => {
          const val = row[h]
          // Escape commas and quotes
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table.table}_preview.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Parse schema from schemaString
  let columns: { name: string; type: string; nullable: boolean }[] = []
  if (metadata?.schemaString) {
    try {
      const schema = JSON.parse(metadata.schemaString)
      columns = schema.fields || []
    } catch {
      // Invalid schema
    }
  }

  // Get column names from preview data if schema is unavailable
  const dataColumns = previewData?.rows?.[0] ? Object.keys(previewData.rows[0]) : []

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-delta-cyan" />
              {table.table}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <TimeTravelBadge
                version={selectedVersion}
                timestamp={selectedTimestamp}
                latestVersion={metadata?.version ?? 0}
              />
              {previewData && (
                <Badge variant="outline">
                  {previewData.totalRows.toLocaleString()} rows
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription>
            <span>{fullTableName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Time-travel selector */}
        {metadata?.version !== undefined && metadata.version > 0 && (
          <div className="border-b pb-4 mb-2">
            <VersionTimestampSelector
              latestVersion={metadata.version}
              currentVersion={selectedVersion}
              currentTimestamp={selectedTimestamp}
              onVersionChange={handleVersionChange}
              onTimestampChange={handleTimestampChange}
            />
          </div>
        )}

        <Tabs defaultValue="data" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="data" className="flex items-center gap-1">
              <TableIcon className="h-3.5 w-3.5" />
              Data Preview
            </TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            {(metadata?.version ?? 0) > 0 && (
              <TabsTrigger value="changes" className="flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Changes
              </TabsTrigger>
            )}
            <TabsTrigger value="code">Access Code</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          {/* Data Preview Tab */}
          <TabsContent value="data" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {previewLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading data...
                  </span>
                ) : previewData ? (
                  <span>
                    Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, previewData.totalRows)} of {previewData.totalRows.toLocaleString()}
                  </span>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!previewData?.rows?.length}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              {previewLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewData?.rows && previewData.rows.length > 0 ? (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      {dataColumns.map(col => (
                        <TableHead key={col} className="font-mono text-xs whitespace-nowrap">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {page * pageSize + idx + 1}
                        </TableCell>
                        {dataColumns.map(col => (
                          <TableCell key={col} className="font-mono text-xs max-w-[200px] truncate">
                            {formatCellValue(row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <TableIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No data available</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {previewData && previewData.totalRows > pageSize && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {Math.ceil(previewData.totalRows / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!previewData.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="schema" className="flex-1 overflow-auto">
            {metadataLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : columns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Nullable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((col) => (
                    <TableRow key={col.name}>
                      <TableCell className="font-mono text-sm">{col.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{col.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {col.nullable ? (
                          <Badge variant="outline" className="text-muted-foreground">Yes</Badge>
                        ) : (
                          <Badge variant="default">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileJson className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Schema information unavailable</p>
              </div>
            )}
          </TabsContent>

          {/* Changes Tab (CDF) */}
          {(metadata?.version ?? 0) > 0 && (
            <TabsContent value="changes" className="flex-1 overflow-auto p-1">
              <ChangesTab
                changes={changesData?.changes}
                isLoading={changesLoading}
                error={changesError as Error | null}
                latestVersion={metadata?.version ?? 0}
                startVersion={changesStartVersion}
                endVersion={changesEndVersion}
                onVersionRangeChange={handleVersionRangeChange}
              />
            </TabsContent>
          )}

          <TabsContent value="code" className="flex-1 overflow-auto space-y-4 p-1">
            {/* Python code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Python (Pandas)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(pythonCode, 'python')}
                >
                  {copied === 'python' ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-auto">
                {pythonCode}
              </pre>
            </div>

            {/* PySpark code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  PySpark
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(pysparkCode, 'pyspark')}
                >
                  {copied === 'pyspark' ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono overflow-auto">
                {pysparkCode}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="info" className="flex-1 overflow-auto">
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Format</p>
                    <p className="text-lg font-medium">{metadata?.format?.provider || 'Delta'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Version</p>
                    <p className="text-lg font-medium">{metadata?.version ?? 'N/A'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Records</p>
                    <p className="text-lg font-medium">{metadata?.numRecords?.toLocaleString() ?? 'N/A'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Size</p>
                    <p className="text-lg font-medium">
                      {metadata?.size ? `${(metadata.size / 1024).toFixed(1)} KB` : 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {metadata?.partitionColumns && metadata.partitionColumns.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-2">Partition Columns</p>
                    <div className="flex flex-wrap gap-2">
                      {metadata.partitionColumns.map((col) => (
                        <Badge key={col} variant="outline">{col}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// Helper to format cell values for display
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

