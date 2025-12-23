import { useState, useEffect } from 'react'
import { 
  Folder, 
  File, 
  ChevronRight, 
  Database,
  Loader2,
  Search,
  ArrowLeft,
  HardDrive,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  useBuckets,
  useStoragePath,
  useDetectDeltaTables,
} from '@/hooks/useStorageConfigs'
import { cn } from '@/lib/utils'
import { DeltaTableInfo, FileInfo } from '@/lib/api'

interface StorageBrowserProps {
  onSelectTable?: (location: string, tableName: string) => void
}

interface BreadcrumbItem {
  name: string
  path: string
}

export function StorageBrowser({ onSelectTable }: StorageBrowserProps) {
  const { toast } = useToast()
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedTables, setDetectedTables] = useState<DeltaTableInfo[]>([])

  const { data: configs, isLoading: configsLoading } = useStorageConfigs()
  const { data: buckets, isLoading: bucketsLoading } = useBuckets(selectedConfigId)
  const { data: files, isLoading: filesLoading, refetch: refetchFiles } = useStoragePath(
    selectedConfigId,
    selectedBucket,
    currentPath
  )

  const { data: tables, isLoading: detectLoading, refetch: refetchDetect } = useDetectDeltaTables(
    selectedConfigId,
    selectedBucket,
    currentPath,
    isDetecting
  )

  // Update detected tables when detection completes
  useEffect(() => {
    if (tables && isDetecting) {
      setDetectedTables(tables)
      setIsDetecting(false)
      if (tables.length > 0) {
        toast({
          title: 'Delta tables found',
          description: `Found ${tables.length} Delta table(s) in this location.`,
        })
      } else {
        toast({
          title: 'No Delta tables found',
          description: 'No Delta tables were detected in this location. Try browsing deeper.',
        })
      }
    }
  }, [tables, isDetecting, toast])

  // Auto-select first config
  useEffect(() => {
    if (configs && configs.length > 0 && !selectedConfigId) {
      setSelectedConfigId(configs[0].id)
    }
  }, [configs, selectedConfigId])

  // Parse current path into breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Root', path: '' },
    ...currentPath.split('/').filter(Boolean).map((part, index, arr) => ({
      name: part,
      path: arr.slice(0, index + 1).join('/'),
    })),
  ]

  const handleBucketSelect = (bucket: string) => {
    setSelectedBucket(bucket)
    setCurrentPath('')
    setDetectedTables([])
  }

  const handleNavigate = (item: FileInfo) => {
    if (item.type === 'folder') {
      setCurrentPath(item.path.replace(/\/$/, ''))
      setDetectedTables([])
    }
  }

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path)
    setDetectedTables([])
  }

  const handleDetectTables = () => {
    setIsDetecting(true)
    setDetectedTables([])
    refetchDetect()
  }

  const handleSelectTable = (table: DeltaTableInfo) => {
    if (onSelectTable) {
      onSelectTable(table.location, table.name)
    }
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  if (configsLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading storage configurations...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!configs || configs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <HardDrive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Storage Configured</h3>
            <p className="text-muted-foreground mb-4">
              Configure a cloud storage connection first to browse for Delta tables.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/storage'}>
              Configure Storage
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Storage Selection */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedConfigId || ''} onValueChange={setSelectedConfigId}>
            <SelectTrigger>
              <SelectValue placeholder="Select storage configuration" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  <span className="flex items-center gap-2">
                    <span>{config.type === 's3' ? '🪣' : config.type === 'azure' ? '☁️' : '🔷'}</span>
                    <span>{config.name}</span>
                    {config.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedConfigId && (
          <div className="flex-1">
            <Select value={selectedBucket || ''} onValueChange={handleBucketSelect}>
              <SelectTrigger>
                <SelectValue placeholder={bucketsLoading ? 'Loading buckets...' : 'Select bucket'} />
              </SelectTrigger>
              <SelectContent>
                {buckets?.map((bucket) => (
                  <SelectItem key={bucket.name} value={bucket.name}>
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span>{bucket.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedBucket && (
          <Button
            variant="outline"
            onClick={handleDetectTables}
            disabled={detectLoading || isDetecting}
          >
            {detectLoading || isDetecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Detect Delta Tables
          </Button>
        )}
      </div>

      {/* Breadcrumbs */}
      {selectedBucket && (
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setSelectedBucket(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground">/</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-medium"
            onClick={() => handleBreadcrumbClick('')}
          >
            {selectedBucket}
          </Button>
          {breadcrumbs.slice(1).map((crumb) => (
            <span key={crumb.path} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => handleBreadcrumbClick(crumb.path)}
              >
                {crumb.name}
              </Button>
            </span>
          ))}
        </div>
      )}

      {/* Detected Delta Tables */}
      {detectedTables.length > 0 && (
        <Card className="border-delta-cyan/30 bg-delta-cyan/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-delta-cyan" />
              Detected Delta Tables ({detectedTables.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="space-y-2">
              {detectedTables.map((table) => (
                <div
                  key={table.location}
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-border/50 bg-background p-3 hover:border-delta-cyan/50 transition-colors",
                    onSelectTable && "cursor-pointer"
                  )}
                  onClick={() => onSelectTable && handleSelectTable(table)}
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-delta-cyan" />
                    <div>
                      <p className="font-medium">{table.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {table.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>v{table.version}</span>
                    <span>{table.numFiles} files</span>
                    {onSelectTable && (
                      <Button size="sm" variant="outline">
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Browser */}
      {selectedBucket && (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Files & Folders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchFiles()}
              disabled={filesLoading}
            >
              <RefreshCw className={cn("h-4 w-4", filesLoading && "animate-spin")} />
            </Button>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            {filesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : files && files.length > 0 ? (
              <div className="space-y-1">
                {files.map((item) => (
                  <div
                    key={item.path}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors",
                      item.type === 'folder' && "cursor-pointer"
                    )}
                    onClick={() => handleNavigate(item)}
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'folder' ? (
                        <Folder className="h-5 w-5 text-yellow-500" />
                      ) : item.name === '_delta_log' ? (
                        <Database className="h-5 w-5 text-delta-cyan" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className={cn(
                        "text-sm",
                        item.name === '_delta_log' && "text-delta-cyan font-medium"
                      )}>
                        {item.name}
                        {item.name === '_delta_log' && (
                          <Badge variant="outline" className="ml-2 text-xs">Delta Table</Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {item.type === 'file' && <span>{formatSize(item.size)}</span>}
                      {item.type === 'folder' && <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>This folder is empty</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No bucket selected */}
      {!selectedBucket && selectedConfigId && (
        <Card>
          <CardContent className="py-8 text-center">
            <HardDrive className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Select a bucket to browse files and detect Delta tables
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

