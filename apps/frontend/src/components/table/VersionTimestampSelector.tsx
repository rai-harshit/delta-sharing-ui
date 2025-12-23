import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { History, Clock, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type TimeTravelMode = 'latest' | 'version' | 'timestamp'

interface VersionTimestampSelectorProps {
  latestVersion: number
  currentVersion?: number
  currentTimestamp?: string
  onVersionChange: (version: number | undefined) => void
  onTimestampChange: (timestamp: string | undefined) => void
  className?: string
  disabled?: boolean
}

export function VersionTimestampSelector({
  latestVersion,
  currentVersion,
  currentTimestamp,
  onVersionChange,
  onTimestampChange,
  className,
  disabled = false,
}: VersionTimestampSelectorProps) {
  // Determine current mode
  const determineMode = (): TimeTravelMode => {
    if (currentVersion !== undefined) return 'version'
    if (currentTimestamp) return 'timestamp'
    return 'latest'
  }

  const [mode, setMode] = useState<TimeTravelMode>(determineMode())
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion ?? latestVersion)
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>(
    currentTimestamp || new Date().toISOString().slice(0, 16)
  )

  const handleModeChange = (newMode: TimeTravelMode) => {
    setMode(newMode)
    if (newMode === 'latest') {
      onVersionChange(undefined)
      onTimestampChange(undefined)
    } else if (newMode === 'version') {
      onVersionChange(selectedVersion)
      onTimestampChange(undefined)
    } else if (newMode === 'timestamp') {
      onVersionChange(undefined)
      onTimestampChange(selectedTimestamp)
    }
  }

  const handleVersionSelect = (version: string) => {
    const v = parseInt(version)
    setSelectedVersion(v)
    if (mode === 'version') {
      onVersionChange(v)
    }
  }

  const handleTimestampChange = (timestamp: string) => {
    setSelectedTimestamp(timestamp)
    if (mode === 'timestamp') {
      onTimestampChange(timestamp)
    }
  }

  const handleReset = () => {
    setMode('latest')
    setSelectedVersion(latestVersion)
    onVersionChange(undefined)
    onTimestampChange(undefined)
  }

  // Generate version options (0 to latestVersion)
  const versionOptions = Array.from({ length: latestVersion + 1 }, (_, i) => i)

  // Only show time-travel if table has history
  if (latestVersion === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <History className="h-3.5 w-3.5" />
        <span>Version 0 (initial version, no history)</span>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-delta-purple" />
          Time Travel
        </Label>
        {mode !== 'latest' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs"
            disabled={disabled}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset to latest
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {/* Latest version button */}
        <button
          type="button"
          onClick={() => handleModeChange('latest')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
            mode === 'latest'
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "h-4 w-4 rounded-full border-2",
            mode === 'latest' ? "border-primary bg-primary" : "border-muted-foreground/30"
          )}>
            {mode === 'latest' && (
              <div className="h-full w-full flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Latest</p>
            <p className="text-xs text-muted-foreground">v{latestVersion}</p>
          </div>
        </button>

        {/* Specific version button */}
        <button
          type="button"
          onClick={() => handleModeChange('version')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
            mode === 'version'
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "h-4 w-4 rounded-full border-2",
            mode === 'version' ? "border-primary bg-primary" : "border-muted-foreground/30"
          )}>
            {mode === 'version' && (
              <div className="h-full w-full flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Version</p>
            <p className="text-xs text-muted-foreground">Select specific</p>
          </div>
        </button>

        {/* Timestamp button */}
        <button
          type="button"
          onClick={() => handleModeChange('timestamp')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
            mode === 'timestamp'
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "h-4 w-4 rounded-full border-2",
            mode === 'timestamp' ? "border-primary bg-primary" : "border-muted-foreground/30"
          )}>
            {mode === 'timestamp' && (
              <div className="h-full w-full flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Timestamp</p>
            <p className="text-xs text-muted-foreground">Point in time</p>
          </div>
        </button>
      </div>

      {/* Version selector */}
      {mode === 'version' && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Label htmlFor="version-select" className="text-sm whitespace-nowrap">
            Version:
          </Label>
          <Select
            value={selectedVersion.toString()}
            onValueChange={handleVersionSelect}
            disabled={disabled}
          >
            <SelectTrigger id="version-select" className="w-32 h-9">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versionOptions.reverse().map((v) => (
                <SelectItem key={v} value={v.toString()}>
                  v{v} {v === latestVersion && '(latest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentVersion !== undefined && currentVersion < latestVersion && (
            <Badge variant="outline" className="gap-1 text-xs bg-amber-500/10 border-amber-500/30 text-amber-600">
              <Clock className="h-3 w-3" />
              Historical
            </Badge>
          )}
        </div>
      )}

      {/* Timestamp selector */}
      {mode === 'timestamp' && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Label htmlFor="timestamp-input" className="text-sm whitespace-nowrap">
            As of:
          </Label>
          <Input
            id="timestamp-input"
            type="datetime-local"
            value={selectedTimestamp}
            onChange={(e) => handleTimestampChange(e.target.value)}
            className="w-auto h-9"
            disabled={disabled}
          />
          <Badge variant="outline" className="gap-1 text-xs bg-delta-purple/10 border-delta-purple/30 text-delta-purple">
            <Clock className="h-3 w-3" />
            Time Travel
          </Badge>
        </div>
      )}
    </div>
  )
}

/**
 * Compact display showing current time-travel state
 */
export function TimeTravelBadge({
  version,
  timestamp,
  latestVersion,
  className,
}: {
  version?: number
  timestamp?: string
  latestVersion: number
  className?: string
}) {
  if (version === undefined && !timestamp) {
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        v{latestVersion} (latest)
      </Badge>
    )
  }

  if (version !== undefined) {
    const isHistorical = version < latestVersion
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs gap-1",
          isHistorical && "bg-amber-500/10 border-amber-500/30 text-amber-600",
          className
        )}
      >
        {isHistorical && <History className="h-3 w-3" />}
        v{version} {version === latestVersion && '(latest)'}
      </Badge>
    )
  }

  if (timestamp) {
    const displayDate = new Date(timestamp).toLocaleString()
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs gap-1 bg-delta-purple/10 border-delta-purple/30 text-delta-purple",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        {displayDate}
      </Badge>
    )
  }

  return null
}







