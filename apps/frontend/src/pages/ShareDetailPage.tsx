import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useShare, useShareSchemas, useSchemaTables, useAllTables, useTablePreview, useTableMetadata, useTableChanges } from '@/hooks/useShares'
import { useRecipients } from '@/hooks/useRecipients'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Share2,
  Database,
  FolderTree,
  Users,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cloud,
  Eye,
  ChevronLeft,
  Download,
  History,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { StorageBrowser } from '@/components/storage/StorageBrowser'
import { VersionTimestampSelector, TimeTravelBadge } from '@/components/table/VersionTimestampSelector'
import { ChangesTab } from '@/components/table/ChangesTab'

export function ShareDetailPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const { data: share, isLoading: shareLoading } = useShare(shareId || '')
  const { data: schemas, isLoading: schemasLoading } = useShareSchemas(shareId || '')
  const { data: allTables } = useAllTables(shareId || '')
  const { data: allRecipients } = useRecipients()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  // Filter recipients that have access to this share
  const shareRecipients = allRecipients?.filter(
    recipient => recipient.shares?.includes(shareId || '') || recipient.shares?.includes(share?.name || '')
  ) || []
  
  const [expandedSchemas, setExpandedSchemas] = useState<string[]>([])
  
  // Schema dialog state
  const [isSchemaDialogOpen, setIsSchemaDialogOpen] = useState(false)
  const [newSchemaName, setNewSchemaName] = useState('')
  
  // Table dialog state
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [selectedSchemaForTable, setSelectedSchemaForTable] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState('')
  const [newTableAlias, setNewTableAlias] = useState('')
  const [newTableLocation, setNewTableLocation] = useState('')
  const [locationValidation, setLocationValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid'
    error?: string
    metadata?: { 
      name: string | null
      columns: { name: string; type: string; nullable: boolean }[]
      rowCount: number 
    }
  }>({ status: 'idle' })
  
  // Delete confirmation state
  const [deleteSchemaConfirm, setDeleteSchemaConfirm] = useState<string | null>(null)
  const [deleteTableConfirm, setDeleteTableConfirm] = useState<{ schema: string; table: string } | null>(null)
  
  // Storage browser dialog state
  const [isStorageBrowserOpen, setIsStorageBrowserOpen] = useState(false)
  
  // Table preview state
  const [previewTable, setPreviewTable] = useState<{ schema: string; table: string } | null>(null)

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas(prev =>
      prev.includes(schemaName)
        ? prev.filter(s => s !== schemaName)
        : [...prev, schemaName]
    )
  }

  // Create schema mutation
  const createSchema = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/shares/${shareId}/schemas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('delta_sharing_token')}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to create schema')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId] })
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      setIsSchemaDialogOpen(false)
      setNewSchemaName('')
      toast({
        title: 'Schema created',
        description: 'The schema has been created successfully.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Create table mutation
  const createTable = useMutation({
    mutationFn: async ({ schemaName, name, location, alias }: { schemaName: string; name: string; location: string; alias?: string }) => {
      const response = await fetch(`/api/shares/${shareId}/schemas/${schemaName}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('delta_sharing_token')}`,
        },
        body: JSON.stringify({ name, location, alias: alias || undefined }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to create table')
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate all relevant queries - use the schemaName from variables
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas', variables.schemaName, 'tables'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId] })
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      setIsTableDialogOpen(false)
      setNewTableName('')
      setNewTableAlias('')
      setNewTableLocation('')
      setLocationValidation({ status: 'idle' })
      setSelectedSchemaForTable(null)
      toast({
        title: 'Table created',
        description: 'The table has been added to the schema.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete schema mutation
  const deleteSchema = useMutation({
    mutationFn: async (schemaName: string) => {
      const response = await fetch(`/api/shares/${shareId}/schemas/${schemaName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('delta_sharing_token')}`,
        },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to delete schema')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId] })
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      setDeleteSchemaConfirm(null)
      toast({
        title: 'Schema deleted',
        description: 'The schema and all its tables have been deleted.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete table mutation
  const deleteTable = useMutation({
    mutationFn: async ({ schemaName, tableName }: { schemaName: string; tableName: string }) => {
      const response = await fetch(`/api/shares/${shareId}/schemas/${schemaName}/tables/${tableName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('delta_sharing_token')}`,
        },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to delete table')
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas', variables.schemaName, 'tables'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId, 'schemas'] })
      queryClient.invalidateQueries({ queryKey: ['shares', shareId] })
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      setDeleteTableConfirm(null)
      toast({
        title: 'Table deleted',
        description: 'The table has been removed from the schema.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleCreateSchema = () => {
    if (newSchemaName.trim()) {
      createSchema.mutate(newSchemaName.trim())
    }
  }

  const handleCreateTable = () => {
    if (selectedSchemaForTable && newTableName.trim() && newTableLocation.trim()) {
      createTable.mutate({
        schemaName: selectedSchemaForTable,
        name: newTableName.trim(),
        location: newTableLocation.trim(),
        alias: newTableAlias.trim() || undefined,
      })
    }
  }

  const openAddTableDialog = (schemaName: string) => {
    setSelectedSchemaForTable(schemaName)
    setNewTableName('')
    setNewTableAlias('')
    setNewTableLocation('')
    setLocationValidation({ status: 'idle' })
    setIsTableDialogOpen(true)
  }

  // Validate Delta table location
  const validateLocation = async (location: string) => {
    if (!location.trim()) {
      setLocationValidation({ status: 'idle' })
      return
    }

    setLocationValidation({ status: 'validating' })

    try {
      const response = await api.validateTableLocation(location.trim())
      if (response.data?.valid && response.data.metadata) {
        // Map API response to component format
        setLocationValidation({
          status: 'valid',
          metadata: {
            name: response.data.metadata.name,
            columns: response.data.metadata.schema,
            rowCount: response.data.metadata.numRecords,
          },
        })
      } else {
        setLocationValidation({
          status: 'invalid',
          error: response.data?.error || 'Invalid Delta table location',
        })
      }
    } catch (error) {
      setLocationValidation({
        status: 'invalid',
        error: error instanceof Error ? error.message : 'Validation failed',
      })
    }
  }

  if (shareLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/shares" className="hover:text-foreground">
          Shares
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{shareId}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-delta-cyan to-delta-purple shadow-lg">
            <Share2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{shareId}</h1>
            <p className="text-muted-foreground">
              Created {share?.createdAt ? formatDate(share.createdAt) : 'N/A'}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/shares">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shares
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-cyan/10">
              <FolderTree className="h-5 w-5 text-delta-cyan" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Schemas</p>
              <p className="text-2xl font-bold">{schemas?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-purple/10">
              <Database className="h-5 w-5 text-delta-purple" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tables</p>
              <p className="text-2xl font-bold">{allTables?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recipients</p>
              <p className="text-2xl font-bold">{shareRecipients.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schemas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schemas">Schemas & Tables</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="schemas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Schemas & Tables</CardTitle>
              <Button onClick={() => setIsSchemaDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Schema
              </Button>
            </CardHeader>
            <CardContent>
              {schemasLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : schemas && schemas.length > 0 ? (
                <div className="space-y-2">
                  {schemas.map((schema) => (
                    <SchemaItem
                      key={schema.name}
                      schema={schema}
                      shareId={shareId || ''}
                      isExpanded={expandedSchemas.includes(schema.name)}
                      onToggle={() => toggleSchema(schema.name)}
                      onAddTable={() => openAddTableDialog(schema.name)}
                      onDeleteSchema={() => setDeleteSchemaConfirm(schema.name)}
                      onDeleteTable={(tableName) => setDeleteTableConfirm({ schema: schema.name, table: tableName })}
                      onPreviewTable={(tableName) => setPreviewTable({ schema: schema.name, table: tableName })}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderTree className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">No schemas found</h3>
                  <p className="mt-2 text-muted-foreground">
                    Add a schema to start organizing your tables
                  </p>
                  <Button className="mt-4" onClick={() => setIsSchemaDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Schema
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recipients with Access</CardTitle>
              <Button asChild>
                <Link to="/recipients">
                  <Plus className="mr-2 h-4 w-4" />
                  Manage Recipients
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {shareRecipients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareRecipients.map((recipient) => (
                      <TableRow key={recipient.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-delta-purple/10">
                              <Users className="h-4 w-4 text-delta-purple" />
                            </div>
                            <span className="font-medium">{recipient.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {recipient.email || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {recipient.createdAt ? formatDate(recipient.createdAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/recipients/${recipient.id}`}>
                              View
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">No recipients</h3>
                  <p className="mt-2 text-muted-foreground">
                    Grant access to recipients to share this data
                  </p>
                  <Button className="mt-4" asChild>
                    <Link to="/recipients">Manage Recipients</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Share Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Share Name</p>
                  <p className="text-sm text-muted-foreground">{shareId}</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">Share status</p>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {share?.createdAt ? formatDate(share.createdAt) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Schema Dialog */}
      <Dialog open={isSchemaDialogOpen} onOpenChange={setIsSchemaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Schema</DialogTitle>
            <DialogDescription>
              Create a new schema to organize tables within this share.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schemaName">Schema Name</Label>
              <Input
                id="schemaName"
                placeholder="e.g., default, staging, production"
                value={newSchemaName}
                onChange={(e) => setNewSchemaName(e.target.value)}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Use alphanumeric characters and underscores only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSchemaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSchema}
              disabled={!newSchemaName.trim() || createSchema.isPending}
            >
              {createSchema.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Schema'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Table Dialog */}
      <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
            <DialogDescription>
              Add a Delta table to the "{selectedSchemaForTable}" schema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name (Internal)</Label>
              <Input
                id="tableName"
                placeholder="e.g., customers_external_v2"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Internal reference name. Use alphanumeric and underscores.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableAlias">Display Name (Alias)</Label>
              <Input
                id="tableAlias"
                placeholder="e.g., customers"
                value={newTableAlias}
                onChange={(e) => setNewTableAlias(e.target.value)}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Optional. The name recipients will see. If empty, internal name is used.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableLocation">Table Location</Label>
              <div className="flex gap-2">
                <Input
                  id="tableLocation"
                  placeholder="./data/my_table or s3://bucket/path"
                  value={newTableLocation}
                  onChange={(e) => {
                    setNewTableLocation(e.target.value)
                    setLocationValidation({ status: 'idle' })
                  }}
                  className="bg-muted/50 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStorageBrowserOpen(true)}
                  title="Browse cloud storage"
                >
                  <Cloud className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateLocation(newTableLocation)}
                  disabled={!newTableLocation.trim() || locationValidation.status === 'validating'}
                >
                  {locationValidation.status === 'validating' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Validate'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Path to the Delta table. Use the cloud icon to browse S3/Azure/GCS storage.
              </p>
              
              {/* Validation status */}
              {locationValidation.status === 'valid' && locationValidation.metadata && (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid Delta Table
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {locationValidation.metadata.name && (
                      <p>Name: {locationValidation.metadata.name}</p>
                    )}
                    {locationValidation.metadata.columns && (
                      <p>Columns: {locationValidation.metadata.columns.length}</p>
                    )}
                    {locationValidation.metadata.rowCount !== undefined && (
                      <p>Rows: {locationValidation.metadata.rowCount.toLocaleString()}</p>
                    )}
                    {locationValidation.metadata.columns && locationValidation.metadata.columns.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {locationValidation.metadata.columns.slice(0, 5).map(col => (
                          <Badge key={col.name} variant="outline" className="text-xs">
                            {col.name}: {col.type}
                          </Badge>
                        ))}
                        {locationValidation.metadata.columns.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{locationValidation.metadata.columns.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {locationValidation.status === 'invalid' && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                    <XCircle className="h-4 w-4" />
                    Invalid Location
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locationValidation.error}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTableDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTable}
              disabled={
                !newTableName.trim() || 
                !newTableLocation.trim() || 
                createTable.isPending ||
                locationValidation.status === 'validating'
              }
            >
              {createTable.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : locationValidation.status !== 'valid' ? (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Add Without Validation
                </>
              ) : (
                'Add Table'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Schema Confirmation Dialog */}
      <Dialog open={!!deleteSchemaConfirm} onOpenChange={() => setDeleteSchemaConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schema</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the schema "{deleteSchemaConfirm}"? 
              This will also delete all tables within it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSchemaConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSchemaConfirm && deleteSchema.mutate(deleteSchemaConfirm)}
              disabled={deleteSchema.isPending}
            >
              {deleteSchema.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Schema'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Confirmation Dialog */}
      <Dialog open={!!deleteTableConfirm} onOpenChange={() => setDeleteTableConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the table "{deleteTableConfirm?.table}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTableConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTableConfirm && deleteTable.mutate({ 
                schemaName: deleteTableConfirm.schema, 
                tableName: deleteTableConfirm.table 
              })}
              disabled={deleteTable.isPending}
            >
              {deleteTable.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Table'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storage Browser Dialog */}
      <Dialog open={isStorageBrowserOpen} onOpenChange={setIsStorageBrowserOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Browse Cloud Storage</DialogTitle>
            <DialogDescription>
              Select a Delta table from your configured cloud storage.
            </DialogDescription>
          </DialogHeader>
          <StorageBrowser
            onSelectTable={(location, tableName) => {
              setNewTableLocation(location)
              if (!newTableName) {
                setNewTableName(tableName)
              }
              setIsStorageBrowserOpen(false)
              setLocationValidation({ status: 'idle' })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Table Preview Dialog */}
      {previewTable && (
        <TablePreviewDialog
          shareId={shareId || ''}
          schemaName={previewTable.schema}
          tableName={previewTable.table}
          onClose={() => setPreviewTable(null)}
        />
      )}
    </div>
  )
}

// Schema item component with expandable tables
function SchemaItem({
  schema,
  shareId,
  isExpanded,
  onToggle,
  onAddTable,
  onDeleteSchema,
  onDeleteTable,
  onPreviewTable,
}: {
  schema: { name: string; share: string }
  shareId: string
  isExpanded: boolean
  onToggle: () => void
  onAddTable: () => void
  onDeleteSchema: () => void
  onDeleteTable: (tableName: string) => void
  onPreviewTable: (tableName: string) => void
}) {
  const { data: tables, isLoading } = useSchemaTables(shareId, schema.name)

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 hover:bg-muted/50">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <FolderTree className="h-5 w-5 text-delta-cyan" />
          <span className="font-medium">{schema.name}</span>
          <Badge variant="outline" className="text-xs">
            {isLoading ? '...' : `${tables?.length || 0} tables`}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onAddTable()
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Table
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteSchema()
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-border bg-muted/20 p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : tables && tables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Display Name (Alias)</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table: { name: string; alias?: string | null; displayName?: string }) => (
                  <TableRow key={table.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{table.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {table.alias ? (
                        <span className="font-medium text-delta-cyan">{table.alias}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Delta</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPreviewTable(table.name)}
                          className="h-8 w-8 p-0 hover:bg-delta-cyan/10 hover:text-delta-cyan"
                          title="Preview data"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteTable(table.name)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete table"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Database className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No tables in this schema
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onAddTable}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Table
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Table Preview Dialog Component
function TablePreviewDialog({
  shareId,
  schemaName,
  tableName,
  onClose,
}: {
  shareId: string
  schemaName: string
  tableName: string
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const pageSize = 50
  
  // Time-travel state
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | undefined>(undefined)

  const { data: metadata, isLoading: metadataLoading } = useTableMetadata(shareId, schemaName, tableName)
  const { data: preview, isLoading: previewLoading } = useTablePreview(
    shareId,
    schemaName,
    tableName,
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
  
  const { data: changesData, isLoading: changesLoading, error: changesError } = useTableChanges(
    shareId,
    schemaName,
    tableName,
    { startingVersion: changesStartVersion, endingVersion: changesEndVersion },
    changesStartVersion < changesEndVersion
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

  // Get column names from preview data
  const dataColumns = preview?.rows?.[0] ? Object.keys(preview.rows[0]) : []

  // Export data as CSV
  const exportToCSV = () => {
    if (!preview?.rows || preview.rows.length === 0) return

    const headers = Object.keys(preview.rows[0])
    const csvContent = [
      headers.join(','),
      ...preview.rows.map((row: Record<string, unknown>) =>
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
    a.download = `${tableName}_preview.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-delta-cyan" />
              {tableName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <TimeTravelBadge
                version={selectedVersion}
                timestamp={selectedTimestamp}
                latestVersion={metadata?.version ?? 0}
              />
              {preview && (
                <Badge variant="outline">
                  {preview.totalRows?.toLocaleString() || 0} rows
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription>
            <span className="font-mono text-xs">{schemaName}.{tableName}</span>
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
              <Database className="h-3.5 w-3.5" />
              Data Preview
            </TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            {(metadata?.version ?? 0) > 0 && (
              <TabsTrigger value="changes" className="flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Changes
              </TabsTrigger>
            )}
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
                ) : preview ? (
                  <span>
                    Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, preview.totalRows || 0)} of {preview.totalRows?.toLocaleString() || 0}
                  </span>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!preview?.rows?.length}
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
              ) : preview?.rows && preview.rows.length > 0 ? (
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
                    {preview.rows.map((row: Record<string, unknown>, idx: number) => (
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
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No data available</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {preview && (preview.totalRows || 0) > pageSize && (
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
                  Page {page + 1} of {Math.ceil((preview.totalRows || 0) / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!preview.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Schema Tab */}
          <TabsContent value="schema" className="flex-1 overflow-auto">
            {metadataLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : metadata?.schema && metadata.schema.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Nullable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadata.schema.map((col: { name: string; type: string; nullable: boolean }) => (
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
                <Database className="h-12 w-12 text-muted-foreground/30" />
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
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
