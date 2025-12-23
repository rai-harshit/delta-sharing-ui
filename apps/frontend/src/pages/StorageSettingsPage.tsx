import { useState } from 'react'
import { Cloud, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Loader2, Star, StarOff, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import {
  useStorageConfigs,
  useCreateStorageConfig,
  useUpdateStorageConfig,
  useDeleteStorageConfig,
  useTestStorageConnection,
} from '@/hooks/useStorageConfigs'
import { StorageConfig, CreateStorageConfigInput } from '@/lib/api'

type StorageType = 's3' | 'azure' | 'gcs'

const storageTypeInfo: Record<StorageType, { name: string; icon: string; color: string; description: string }> = {
  s3: {
    name: 'Amazon S3',
    icon: '🪣',
    color: 'text-orange-500',
    description: 'AWS S3-compatible storage',
  },
  azure: {
    name: 'Azure Blob',
    icon: '☁️',
    color: 'text-blue-500',
    description: 'Azure Blob Storage',
  },
  gcs: {
    name: 'Google Cloud',
    icon: '🔷',
    color: 'text-yellow-500',
    description: 'Google Cloud Storage',
  },
}

interface AddStorageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editConfig?: StorageConfig | null
}

function AddStorageDialog({ open, onOpenChange, editConfig }: AddStorageDialogProps) {
  const [formData, setFormData] = useState<CreateStorageConfigInput>({
    name: editConfig?.name || '',
    type: editConfig?.type || 's3',
    isDefault: editConfig?.isDefault || false,
    s3Region: editConfig?.s3Region || '',
    s3AccessKeyId: '',
    s3SecretKey: '',
    s3Endpoint: editConfig?.s3Endpoint || '',
    azureAccount: editConfig?.azureAccount || '',
    azureAccessKey: '',
    azureConnectionStr: '',
    gcsProjectId: editConfig?.gcsProjectId || '',
    gcsKeyFile: '',
  })

  const { toast } = useToast()
  const createMutation = useCreateStorageConfig()
  const updateMutation = useUpdateStorageConfig()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editConfig) {
        await updateMutation.mutateAsync({ id: editConfig.id, data: formData })
        toast({
          title: 'Configuration updated',
          description: `Storage configuration "${formData.name}" has been updated.`,
        })
      } else {
        await createMutation.mutateAsync(formData)
        toast({
          title: 'Configuration created',
          description: `Storage configuration "${formData.name}" has been created.`,
        })
      }
      onOpenChange(false)
      setFormData({
        name: '',
        type: 's3',
        isDefault: false,
        s3Region: '',
        s3AccessKeyId: '',
        s3SecretKey: '',
        s3Endpoint: '',
        azureAccount: '',
        azureAccessKey: '',
        azureConnectionStr: '',
        gcsProjectId: '',
        gcsKeyFile: '',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editConfig ? 'Edit Storage Configuration' : 'Add Storage Configuration'}</DialogTitle>
          <DialogDescription>
            Configure a cloud storage connection to browse and import Delta tables.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              placeholder="e.g., production-s3, analytics-azure"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Storage Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: StorageType) => setFormData({ ...formData, type: value })}
              disabled={!!editConfig}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">
                  <span className="flex items-center gap-2">
                    <span>🪣</span>
                    <span>Amazon S3</span>
                  </span>
                </SelectItem>
                <SelectItem value="azure">
                  <span className="flex items-center gap-2">
                    <span>☁️</span>
                    <span>Azure Blob Storage</span>
                  </span>
                </SelectItem>
                <SelectItem value="gcs">
                  <span className="flex items-center gap-2">
                    <span>🔷</span>
                    <span>Google Cloud Storage</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="isDefault" className="text-sm font-normal">
              Set as default for {storageTypeInfo[formData.type].name}
            </Label>
          </div>

          {/* S3 Fields */}
          {formData.type === 's3' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span>🪣</span> S3 Configuration
              </h4>
              <div className="space-y-2">
                <Label htmlFor="s3Region">Region</Label>
                <Input
                  id="s3Region"
                  placeholder="us-east-1"
                  value={formData.s3Region}
                  onChange={(e) => setFormData({ ...formData, s3Region: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s3AccessKeyId">Access Key ID</Label>
                <Input
                  id="s3AccessKeyId"
                  placeholder="AKIA..."
                  value={formData.s3AccessKeyId}
                  onChange={(e) => setFormData({ ...formData, s3AccessKeyId: e.target.value })}
                />
                {editConfig?.s3AccessKeyId && (
                  <p className="text-xs text-muted-foreground">Current: {editConfig.s3AccessKeyId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s3SecretKey">Secret Access Key</Label>
                <PasswordInput
                  id="s3SecretKey"
                  placeholder="Enter secret key"
                  value={formData.s3SecretKey}
                  onChange={(e) => setFormData({ ...formData, s3SecretKey: e.target.value })}
                />
                {editConfig && (
                  <p className="text-xs text-muted-foreground">Leave blank to keep current value</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s3Endpoint">Custom Endpoint (Optional)</Label>
                <Input
                  id="s3Endpoint"
                  placeholder="http://localhost:9000 (for MinIO/LocalStack)"
                  value={formData.s3Endpoint}
                  onChange={(e) => setFormData({ ...formData, s3Endpoint: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Azure Fields */}
          {formData.type === 'azure' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span>☁️</span> Azure Configuration
              </h4>
              <div className="space-y-2">
                <Label htmlFor="azureAccount">Storage Account Name</Label>
                <Input
                  id="azureAccount"
                  placeholder="mystorageaccount"
                  value={formData.azureAccount}
                  onChange={(e) => setFormData({ ...formData, azureAccount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="azureAccessKey">Access Key</Label>
                <PasswordInput
                  id="azureAccessKey"
                  placeholder="Enter access key"
                  value={formData.azureAccessKey}
                  onChange={(e) => setFormData({ ...formData, azureAccessKey: e.target.value })}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground py-2">- OR -</div>
              <div className="space-y-2">
                <Label htmlFor="azureConnectionStr">Connection String</Label>
                <PasswordInput
                  id="azureConnectionStr"
                  placeholder="DefaultEndpointsProtocol=..."
                  value={formData.azureConnectionStr}
                  onChange={(e) => setFormData({ ...formData, azureConnectionStr: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* GCS Fields */}
          {formData.type === 'gcs' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span>🔷</span> GCS Configuration
              </h4>
              <div className="space-y-2">
                <Label htmlFor="gcsProjectId">Project ID</Label>
                <Input
                  id="gcsProjectId"
                  placeholder="my-gcp-project"
                  value={formData.gcsProjectId}
                  onChange={(e) => setFormData({ ...formData, gcsProjectId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcsKeyFile">Service Account Key (JSON)</Label>
                <textarea
                  id="gcsKeyFile"
                  className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  placeholder='{"type": "service_account", ...}'
                  value={formData.gcsKeyFile}
                  onChange={(e) => setFormData({ ...formData, gcsKeyFile: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editConfig ? 'Save Changes' : 'Create Configuration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StorageConfigCard({ config }: { config: StorageConfig }) {
  const { canEdit, canDelete } = useAuth()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  
  const deleteMutation = useDeleteStorageConfig()
  const testMutation = useTestStorageConnection()
  const updateMutation = useUpdateStorageConfig()

  const typeInfo = storageTypeInfo[config.type as StorageType]

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync(config.id)
      if (result?.success) {
        toast({
          title: 'Connection successful',
          description: result.message,
        })
      } else {
        toast({
          title: 'Connection failed',
          description: result?.message || 'Unknown error',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMutation.mutateAsync(config.id)
      toast({
        title: 'Configuration deleted',
        description: `"${config.name}" has been removed.`,
      })
      setDeleteConfirmOpen(false)
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleDefault = async () => {
    try {
      await updateMutation.mutateAsync({
        id: config.id,
        data: { isDefault: !config.isDefault },
      })
      toast({
        title: config.isDefault ? 'Removed default' : 'Set as default',
        description: `"${config.name}" ${config.isDefault ? 'is no longer' : 'is now'} the default for ${typeInfo.name}.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="relative overflow-hidden border-border/50 hover:border-delta-cyan/30 transition-colors">
        {config.isDefault && (
          <div className="absolute top-0 right-0 px-2 py-1 bg-delta-cyan/20 text-delta-cyan text-xs font-medium rounded-bl-lg">
            Default
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{typeInfo.icon}</span>
              <div>
                <CardTitle className="text-lg">{config.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={typeInfo.color}>
                    {typeInfo.name}
                  </Badge>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {config.type === 's3' && (
              <>
                {config.s3Region && <p>Region: {config.s3Region}</p>}
                {config.s3AccessKeyId && <p>Access Key: {config.s3AccessKeyId}</p>}
                {config.s3Endpoint && <p>Endpoint: {config.s3Endpoint}</p>}
              </>
            )}
            {config.type === 'azure' && (
              <>
                {config.azureAccount && <p>Account: {config.azureAccount}</p>}
              </>
            )}
            {config.type === 'gcs' && (
              <>
                {config.gcsProjectId && <p>Project: {config.gcsProjectId}</p>}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testMutation.isSuccess && testMutation.data?.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : testMutation.isError || (testMutation.data && !testMutation.data.success) ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Test</span>
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleDefault}
                disabled={updateMutation.isPending}
              >
                {config.isDefault ? (
                  <StarOff className="h-4 w-4" />
                ) : (
                  <Star className="h-4 w-4" />
                )}
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AddStorageDialog 
        open={isEditing} 
        onOpenChange={setIsEditing} 
        editConfig={config}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Storage Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{config.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function StorageSettingsPage() {
  const { canCreate } = useAuth()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { data: configs, isLoading, error } = useStorageConfigs()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-delta-cyan to-delta-purple bg-clip-text text-transparent">
            Cloud Storage
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure connections to S3, Azure, and GCS for browsing Delta tables
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Storage
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="text-destructive">Failed to load storage configurations</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
                <Skeleton className="h-8 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && configs?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Cloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No storage configurations</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Add a cloud storage configuration to browse S3 buckets, Azure containers, or GCS buckets for Delta tables.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Storage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configs grid */}
      {!isLoading && configs && configs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <StorageConfigCard key={config.id} config={config} />
          ))}
        </div>
      )}

      {/* Quick info cards */}
      <div className="grid gap-4 md:grid-cols-3 mt-8">
        <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🪣</span>
              Amazon S3
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Connect to AWS S3 or S3-compatible storage like MinIO, LocalStack, or Cloudflare R2.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">☁️</span>
              Azure Blob
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Connect to Azure Blob Storage containers using access keys or connection strings.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🔷</span>
              Google Cloud
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Connect to GCS buckets using a service account JSON key file.
            </p>
          </CardContent>
        </Card>
      </div>

      <AddStorageDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  )
}

