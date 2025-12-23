import { useState } from 'react'
import { 
  Webhook, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Pencil, 
  Send,
  Clock,
  AlertCircle,
  Power,
  PowerOff,
  History
} from 'lucide-react'
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
import { useToast } from '@/hooks/useToast'
import {
  useWebhooks,
  useWebhookEventTypes,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookDeliveries,
  WebhookData,
  CreateWebhookInput,
} from '@/hooks/useWebhooks'

// Webhook event type labels
const eventTypeLabels: Record<string, string> = {
  'share.created': 'Share Created',
  'share.updated': 'Share Updated',
  'share.deleted': 'Share Deleted',
  'recipient.created': 'Recipient Created',
  'recipient.updated': 'Recipient Updated',
  'recipient.deleted': 'Recipient Deleted',
  'access.granted': 'Access Granted',
  'access.revoked': 'Access Revoked',
  'token.rotated': 'Token Rotated',
  'user.login': 'User Login',
  'user.sso_login': 'SSO Login',
}

interface AddWebhookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editWebhook?: WebhookData | null
}

function AddWebhookDialog({ open, onOpenChange, editWebhook }: AddWebhookDialogProps) {
  const [formData, setFormData] = useState<CreateWebhookInput>({
    name: editWebhook?.name || '',
    url: editWebhook?.url || '',
    secret: '',
    enabled: editWebhook?.enabled ?? true,
    events: editWebhook?.events || [],
  })

  const { toast } = useToast()
  const { data: eventTypes } = useWebhookEventTypes()
  const createMutation = useCreateWebhook()
  const updateMutation = useUpdateWebhook()

  // Reset form when dialog opens with new data
  useState(() => {
    if (open) {
      setFormData({
        name: editWebhook?.name || '',
        url: editWebhook?.url || '',
        secret: '',
        enabled: editWebhook?.enabled ?? true,
        events: editWebhook?.events || [],
      })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editWebhook) {
        await updateMutation.mutateAsync({ id: editWebhook.id, data: formData })
        toast({
          title: 'Webhook updated',
          description: `Webhook "${formData.name}" has been updated.`,
        })
      } else {
        await createMutation.mutateAsync(formData)
        toast({
          title: 'Webhook created',
          description: `Webhook "${formData.name}" has been created.`,
        })
      }
      onOpenChange(false)
      setFormData({
        name: '',
        url: '',
        secret: '',
        enabled: true,
        events: [],
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save webhook',
        variant: 'destructive',
      })
    }
  }

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }))
  }

  const selectAllEvents = () => {
    setFormData(prev => ({
      ...prev,
      events: eventTypes || [],
    }))
  }

  const clearAllEvents = () => {
    setFormData(prev => ({
      ...prev,
      events: [],
    }))
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editWebhook ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
          <DialogDescription>
            Configure a webhook to receive notifications when events occur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Slack Notifications, Security Alerts"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Webhook URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">Secret (Optional)</Label>
            <PasswordInput
              id="secret"
              placeholder="Used for HMAC signature verification"
              value={formData.secret || ''}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              If provided, requests will be signed with X-Webhook-Signature header
            </p>
            {editWebhook?.hasSecret && !formData.secret && (
              <p className="text-xs text-muted-foreground">
                Leave blank to keep existing secret
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="enabled" className="text-sm font-normal">
              Enabled
            </Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Events</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={selectAllEvents}
                >
                  Select All
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={clearAllEvents}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/20 p-3 max-h-48 overflow-y-auto">
              {(eventTypes || []).map((event) => (
                <label 
                  key={event} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-border"
                  />
                  <span className="truncate">
                    {eventTypeLabels[event] || event}
                  </span>
                </label>
              ))}
            </div>
            {formData.events.length === 0 && (
              <p className="text-xs text-destructive">
                Select at least one event
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || formData.events.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editWebhook ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeliveryHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhookId: string
  webhookName: string
}

function DeliveryHistoryDialog({ open, onOpenChange, webhookId, webhookName }: DeliveryHistoryDialogProps) {
  const { data: deliveries, isLoading } = useWebhookDeliveries(webhookId, open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delivery History - {webhookName}</DialogTitle>
          <DialogDescription>
            Recent webhook delivery attempts (last 50)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No delivery history yet</p>
            </div>
          ) : (
            deliveries.map((delivery) => (
              <div 
                key={delivery.id}
                className={`rounded-lg border p-3 ${
                  delivery.success 
                    ? 'border-green-500/20 bg-green-500/5' 
                    : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {delivery.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant="outline">{delivery.event}</Badge>
                    {delivery.statusCode && (
                      <Badge variant="secondary">{delivery.statusCode}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {delivery.durationMs}ms
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(delivery.createdAt).toLocaleString()}
                  </span>
                </div>
                {delivery.error && (
                  <p className="mt-2 text-sm text-red-500">{delivery.error}</p>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WebhookCard({ webhook }: { webhook: WebhookData }) {
  const { canEdit, canDelete } = useAuth()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  
  const deleteMutation = useDeleteWebhook()
  const testMutation = useTestWebhook()
  const updateMutation = useUpdateWebhook()

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync(webhook.id)
      if (result?.delivered) {
        toast({
          title: 'Test delivered',
          description: `Status: ${result.statusCode}, Duration: ${result.durationMs}ms`,
        })
      } else {
        toast({
          title: 'Test failed',
          description: result?.error || 'Unknown error',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Test failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMutation.mutateAsync(webhook.id)
      toast({
        title: 'Webhook deleted',
        description: `"${webhook.name}" has been removed.`,
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

  const handleToggleEnabled = async () => {
    try {
      await updateMutation.mutateAsync({
        id: webhook.id,
        data: { enabled: !webhook.enabled },
      })
      toast({
        title: webhook.enabled ? 'Webhook disabled' : 'Webhook enabled',
        description: `"${webhook.name}" is now ${webhook.enabled ? 'disabled' : 'enabled'}.`,
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
      <Card className={`relative overflow-hidden transition-colors ${
        webhook.enabled 
          ? 'border-border/50 hover:border-delta-cyan/30' 
          : 'border-border/30 opacity-60 hover:opacity-80'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${webhook.enabled ? 'bg-delta-cyan/10' : 'bg-muted'}`}>
                <Webhook className={`h-5 w-5 ${webhook.enabled ? 'text-delta-cyan' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {webhook.name}
                  {!webhook.enabled && (
                    <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1 truncate max-w-[200px]">
                  {webhook.url}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {webhook.events.slice(0, 4).map((event) => (
                <Badge key={event} variant="secondary" className="text-xs">
                  {eventTypeLabels[event] || event}
                </Badge>
              ))}
              {webhook.events.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{webhook.events.length - 4} more
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {webhook.hasSecret && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Signed
                </span>
              )}
              <span>
                {webhook.deliveryCount} deliveries
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testMutation.isPending || !webhook.enabled}
              title={webhook.enabled ? 'Send test webhook' : 'Enable webhook to test'}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Test</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleEnabled}
                disabled={updateMutation.isPending}
                title={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
              >
                {webhook.enabled ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
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

      <AddWebhookDialog 
        open={isEditing} 
        onOpenChange={setIsEditing} 
        editWebhook={webhook}
      />

      <DeliveryHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        webhookId={webhook.id}
        webhookName={webhook.name}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{webhook.name}"? This will also delete all delivery history. This action cannot be undone.
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

export function WebhooksPage() {
  const { canCreate } = useAuth()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { data: webhooks, isLoading, error } = useWebhooks()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-delta-cyan to-delta-purple bg-clip-text text-transparent">
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure webhooks to receive notifications when events occur
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="text-destructive">Failed to load webhooks</p>
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
                <Skeleton className="h-4 w-48 mt-2" />
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
      {!isLoading && !error && webhooks?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Webhook className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Add a webhook to receive notifications when shares are created, recipients are added, or other events occur.
            </p>
            {canCreate && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Webhook
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhooks grid */}
      {!isLoading && webhooks && webhooks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} />
          ))}
        </div>
      )}

      {/* Info card */}
      <Card className="bg-gradient-to-br from-delta-cyan/5 to-delta-purple/5 border-delta-cyan/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Webhook Payloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Webhooks are sent as HTTP POST requests with JSON payloads. Each request includes:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• <code className="text-xs bg-muted px-1 rounded">X-Webhook-Event</code> - Event type header</li>
            <li>• <code className="text-xs bg-muted px-1 rounded">X-Webhook-ID</code> - Unique event ID</li>
            <li>• <code className="text-xs bg-muted px-1 rounded">X-Webhook-Signature</code> - HMAC signature (if secret configured)</li>
          </ul>
        </CardContent>
      </Card>

      <AddWebhookDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  )
}

