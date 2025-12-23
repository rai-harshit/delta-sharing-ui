import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useRecipient,
  useRecipientCredential,
  useRotateRecipientToken,
  useUpdateRecipient,
  useGrantAccess,
  useUpdateAccess,
} from '@/hooks/useRecipients'
import { useShares } from '@/hooks/useShares'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Users,
  Mail,
  Calendar,
  Key,
  Share2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Copy,
  Download,
  Check,
  Loader2,
  Shield,
  Settings,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { formatDate, copyToClipboard, downloadAsJson, cn } from '@/lib/utils'
import type { AccessGrantOptions } from '@/lib/api'

export function RecipientDetailPage() {
  const { recipientId } = useParams<{ recipientId: string }>()
  const { data: recipient, isLoading: recipientLoading } = useRecipient(recipientId || '')
  const { data: credential, isLoading: credentialLoading } = useRecipientCredential(recipientId || '')
  const { data: allShares } = useShares()
  const rotateToken = useRotateRecipientToken()
  const updateRecipient = useUpdateRecipient()

  const [newCredentialCopied, setNewCredentialCopied] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [newCredential, setNewCredential] = useState<typeof credential | null>(null)
  const [editingShares, setEditingShares] = useState(false)
  const [selectedShares, setSelectedShares] = useState<string[]>([])
  
  // Enhanced access editing state
  const [configureShareId, setConfigureShareId] = useState<string | null>(null)
  const [accessConfig, setAccessConfig] = useState<{
    expiresAt: string
    canDownload: boolean
    canQuery: boolean
    maxRowsPerQuery: string
  }>({
    expiresAt: '',
    canDownload: true,
    canQuery: true,
    maxRowsPerQuery: '',
  })
  const [expandedShares, setExpandedShares] = useState<string[]>([])
  
  const grantAccess = useGrantAccess()
  const updateAccess = useUpdateAccess()

  const handleRotateToken = async () => {
    if (!recipientId) return
    const result = await rotateToken.mutateAsync(recipientId)
    if (result?.credential) {
      setNewCredential(result.credential)
    }
    setRotateConfirm(false)
  }

  const handleUpdateShares = async () => {
    if (!recipientId) return
    await updateRecipient.mutateAsync({
      recipientId,
      updates: { shares: selectedShares },
    })
    setEditingShares(false)
  }

  const startEditingShares = () => {
    setSelectedShares(recipient?.shares || [])
    setExpandedShares([])
    setEditingShares(true)
  }

  const toggleShare = (shareName: string) => {
    const isCurrentlySelected = selectedShares.includes(shareName)
    if (isCurrentlySelected) {
      setSelectedShares(prev => prev.filter(s => s !== shareName))
      setExpandedShares(prev => prev.filter(s => s !== shareName))
    } else {
      setSelectedShares(prev => [...prev, shareName])
    }
  }

  const toggleExpandShare = (shareName: string) => {
    setExpandedShares(prev =>
      prev.includes(shareName)
        ? prev.filter(s => s !== shareName)
        : [...prev, shareName]
    )
  }

  const openConfigureAccess = (shareName: string) => {
    const grant = recipient?.accessGrants?.find(g => g.shareName === shareName)
    setAccessConfig({
      expiresAt: grant?.expiresAt ? grant.expiresAt.split('T')[0] : '',
      canDownload: grant?.canDownload ?? true,
      canQuery: grant?.canQuery ?? true,
      maxRowsPerQuery: grant?.maxRowsPerQuery?.toString() || '',
    })
    setConfigureShareId(shareName)
  }

  const handleSaveAccessConfig = async () => {
    if (!recipientId || !configureShareId) return
    
    const share = allShares?.find(s => s.name === configureShareId)
    if (!share) return

    const options: Omit<AccessGrantOptions, 'shareId'> = {
      expiresAt: accessConfig.expiresAt ? new Date(accessConfig.expiresAt).toISOString() : undefined,
      canDownload: accessConfig.canDownload,
      canQuery: accessConfig.canQuery,
      maxRowsPerQuery: accessConfig.maxRowsPerQuery ? parseInt(accessConfig.maxRowsPerQuery) : undefined,
    }

    // Check if this is an existing grant or a new one
    const existingGrant = recipient?.accessGrants?.find(g => g.shareName === configureShareId)
    
    if (existingGrant) {
      await updateAccess.mutateAsync({ recipientId, shareId: share.id, options })
    } else {
      await grantAccess.mutateAsync({ recipientId, options: { ...options, shareId: share.id } })
    }
    
    setConfigureShareId(null)
  }

  if (recipientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Token is stored as a hash - we only have the hint (first 8 chars)
  const tokenHint = credential?.tokenHint || credential?.bearerToken?.slice(0, 8) || '********'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/recipients" className="hover:text-foreground">
          Recipients
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{recipient?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-delta-purple to-purple-400 shadow-lg">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{recipient?.name}</h1>
            <p className="text-muted-foreground">
              {recipient?.email || 'No email provided'}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/recipients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Recipients
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recipient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recipient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{recipient?.name}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{recipient?.email || '—'}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {recipient?.createdAt ? formatDate(recipient.createdAt) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credential Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Access Credential
            </CardTitle>
            <CardDescription>
              Share this credential with the recipient to grant access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {credentialLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Token Identifier</span>
                  <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-sm">
                    {tokenHint}...
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For security, the full token is only shown when first created or rotated.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setRotateConfirm(true)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate New Credential
                  </Button>
                </div>

                {credential?.expirationTime && (
                  <p className="text-xs text-muted-foreground">
                    Expires: {formatDate(credential.expirationTime)}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Shares Access */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Share Access
              </CardTitle>
              <CardDescription>
                Shares this recipient can access
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={startEditingShares}>
              Edit Access
            </Button>
          </CardHeader>
          <CardContent>
            {recipient?.shares && recipient.shares.length > 0 ? (
              <div className="space-y-3">
                {recipient.shares.map((share) => {
                  const grant = recipient.accessGrants?.find(g => g.shareName === share)
                  const isExpired = grant?.expiresAt && new Date(grant.expiresAt) < new Date()
                  const isExpiringSoon = grant?.expiresAt && !isExpired && 
                    new Date(grant.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  const hasRestrictions = grant?.maxRowsPerQuery || !grant?.canDownload || !grant?.canQuery
                  
                  return (
                    <div
                      key={share}
                      className={cn(
                        "rounded-lg border transition-colors",
                        isExpired 
                          ? "border-destructive/50 bg-destructive/5" 
                          : isExpiringSoon 
                            ? "border-amber-500/50 bg-amber-500/5"
                            : "border-border"
                      )}
                    >
                      {/* Main row */}
                      <div className="flex items-center justify-between p-3">
                        <Link
                          to={`/shares/${share}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-delta-cyan/10">
                            <Share2 className="h-4 w-4 text-delta-cyan" />
                          </div>
                          <span className="font-medium">{share}</span>
                        </Link>
                        <div className="flex items-center gap-2">
                          {hasRestrictions && (
                            <Badge variant="outline" className="text-xs gap-1 bg-amber-500/10 border-amber-500/30 text-amber-600">
                              <Shield className="h-3 w-3" />
                              Restricted
                            </Badge>
                          )}
                          {grant?.expiresAt ? (
                            <Badge 
                              variant={isExpired ? "destructive" : isExpiringSoon ? "warning" : "outline"}
                              className="text-xs gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              {isExpired 
                                ? "Expired" 
                                : formatDate(grant.expiresAt)
                              }
                            </Badge>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.preventDefault()
                              openConfigureAccess(share)
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Security details (if any) */}
                      {hasRestrictions && (
                        <div className="border-t border-border/50 bg-muted/30 px-3 py-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            {grant?.maxRowsPerQuery && (
                              <span className="text-muted-foreground">
                                Max {grant.maxRowsPerQuery.toLocaleString()} rows/query
                              </span>
                            )}
                            {!grant?.canDownload && (
                              <span className="text-amber-600">Download disabled</span>
                            )}
                            {!grant?.canQuery && (
                              <span className="text-amber-600">Query disabled</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Share2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  No shares assigned to this recipient
                </p>
                <Button className="mt-4" size="sm" onClick={startEditingShares}>
                  Assign Shares
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rotate Token Confirmation Dialog */}
      <Dialog open={rotateConfirm} onOpenChange={setRotateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Token</DialogTitle>
            <DialogDescription>
              This will generate a new token and invalidate the current one. The recipient will need to update their credentials.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRotateToken}
              disabled={rotateToken.isPending}
            >
              {rotateToken.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rotating...
                </>
              ) : (
                'Rotate Token'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Credential Dialog */}
      <Dialog open={!!newCredential} onOpenChange={() => {
        setNewCredential(null)
        setNewCredentialCopied(false)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Credential Generated</DialogTitle>
            <DialogDescription>
              Share this new credential with the recipient. The old token is now invalid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4 overflow-hidden">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(newCredential, null, 2)}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  if (newCredential) {
                    await copyToClipboard(JSON.stringify(newCredential, null, 2))
                    setNewCredentialCopied(true)
                    setTimeout(() => setNewCredentialCopied(false), 2000)
                  }
                }}
              >
                {newCredentialCopied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (newCredential) {
                    downloadAsJson(newCredential, `${recipient?.name}-credential.json`)
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewCredential(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shares Dialog */}
      <Dialog open={editingShares} onOpenChange={setEditingShares}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Share Access</DialogTitle>
            <DialogDescription>
              Select shares and configure access permissions for this recipient.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-4">
            {allShares && allShares.length > 0 ? (
              <div className="space-y-2">
                {allShares.map((share) => {
                  const isSelected = selectedShares.includes(share.name)
                  const isExpanded = expandedShares.includes(share.name)
                  const existingGrant = recipient?.accessGrants?.find(g => g.shareName === share.name)
                  
                  return (
                    <div
                      key={share.id}
                      className={cn(
                        "rounded-lg border transition-colors",
                        isSelected
                          ? "bg-primary/5 border-primary/50"
                          : "border-border hover:bg-muted/30"
                      )}
                    >
                      {/* Share row */}
                      <div className="flex items-center justify-between p-3">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleShare(share.name)}
                            className="rounded border-border"
                          />
                          <Share2 className="h-4 w-4 text-delta-cyan" />
                          <span className="font-medium">{share.name}</span>
                        </label>
                        {isSelected && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpandShare(share.name)}
                            className="h-8 gap-1"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Configure
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {/* Expanded configuration */}
                      {isSelected && isExpanded && (
                        <div className="border-t border-border/50 bg-muted/30 p-4 space-y-4">
                          {/* Quick summary of existing config */}
                          {existingGrant && (
                            <div className="flex flex-wrap gap-2 text-xs mb-3">
                              {existingGrant.expiresAt && (
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires {formatDate(existingGrant.expiresAt)}
                                </Badge>
                              )}
                              {existingGrant.maxRowsPerQuery && (
                                <Badge variant="outline">
                                  Max {existingGrant.maxRowsPerQuery} rows
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfigureAccess(share.name)}
                            className="w-full"
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Open Advanced Configuration
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No shares available
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShares(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateShares}
              disabled={updateRecipient.isPending}
            >
              {updateRecipient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Access Dialog */}
      <Dialog open={!!configureShareId} onOpenChange={() => setConfigureShareId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-delta-cyan" />
              Configure Access: {configureShareId}
            </DialogTitle>
            <DialogDescription>
              Set expiration and permission limits for this share.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 px-1 -mx-1 space-y-6">
            {/* Expiration */}
            <div className="space-y-2">
              <Label htmlFor="access-expires" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Expiration Date
              </Label>
              <Input
                id="access-expires"
                type="date"
                value={accessConfig.expiresAt}
                onChange={(e) => setAccessConfig(prev => ({ ...prev, expiresAt: e.target.value }))}
                className="bg-muted/50 border-border"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration. Access will be revoked after this date.
              </p>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Permissions
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={accessConfig.canQuery}
                    onChange={(e) => setAccessConfig(prev => ({ ...prev, canQuery: e.target.checked }))}
                    className="styled-checkbox"
                  />
                  <div>
                    <p className="font-medium text-sm">Allow Query</p>
                    <p className="text-xs text-muted-foreground">Recipient can query table data</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={accessConfig.canDownload}
                    onChange={(e) => setAccessConfig(prev => ({ ...prev, canDownload: e.target.checked }))}
                    className="styled-checkbox"
                  />
                  <div>
                    <p className="font-medium text-sm">Allow Download</p>
                    <p className="text-xs text-muted-foreground">Recipient can download files directly</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Max rows per query */}
            <div className="space-y-2">
              <Label htmlFor="max-rows" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Max Rows Per Query
              </Label>
              <Input
                id="max-rows"
                type="number"
                placeholder="Unlimited"
                value={accessConfig.maxRowsPerQuery}
                onChange={(e) => setAccessConfig(prev => ({ ...prev, maxRowsPerQuery: e.target.value }))}
                className="bg-muted/50 border-border"
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                Limit the number of rows returned per query. Leave empty for unlimited.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setConfigureShareId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAccessConfig}
              disabled={grantAccess.isPending || updateAccess.isPending}
            >
              {(grantAccess.isPending || updateAccess.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


