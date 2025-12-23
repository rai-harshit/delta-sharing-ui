import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecipients, useCreateRecipient, useDeleteRecipient } from '@/hooks/useRecipients'
import { useShares } from '@/hooks/useShares'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Users,
  Eye,
  Trash2,
  Loader2,
  Copy,
  Download,
  Check,
} from 'lucide-react'
import { formatRelativeTime, copyToClipboard, downloadAsJson } from '@/lib/utils'
import { Credential } from '@/lib/api'

export function RecipientsPage() {
  const { canCreate, canDelete } = useAuth()
  const { data: recipients, isLoading } = useRecipients()
  const { data: shares } = useShares()
  const createRecipient = useCreateRecipient()
  const deleteRecipient = useDeleteRecipient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')
  const [selectedShares, setSelectedShares] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [newCredential, setNewCredential] = useState<Credential | null>(null)
  const [copied, setCopied] = useState(false)

  const filteredRecipients = recipients?.filter(recipient =>
    recipient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipient.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateRecipient = async () => {
    if (!newRecipientName.trim()) return
    
    const result = await createRecipient.mutateAsync({
      name: newRecipientName.trim(),
      email: newRecipientEmail.trim() || undefined,
      shares: selectedShares,
    })
    
    if (result?.credential) {
      setNewCredential(result.credential)
    }
    
    setNewRecipientName('')
    setNewRecipientEmail('')
    setSelectedShares([])
  }

  const handleDeleteRecipient = async (recipientId: string) => {
    await deleteRecipient.mutateAsync(recipientId)
    setDeleteConfirm(null)
  }

  const handleCopyCredential = async () => {
    if (newCredential) {
      await copyToClipboard(JSON.stringify(newCredential, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadCredential = () => {
    if (newCredential) {
      downloadAsJson(newCredential, 'delta-sharing-credential.json')
    }
  }

  const handleCloseCreateDialog = () => {
    setIsCreateOpen(false)
    setNewCredential(null)
    setNewRecipientName('')
    setNewRecipientEmail('')
    setSelectedShares([])
  }

  const toggleShare = (shareName: string) => {
    setSelectedShares(prev =>
      prev.includes(shareName)
        ? prev.filter(s => s !== shareName)
        : [...prev, shareName]
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recipients</h2>
          <p className="text-muted-foreground">
            Manage access for data consumers
          </p>
        </div>
        
        {canCreate && (
          <Dialog open={isCreateOpen} onOpenChange={(open) => open ? setIsCreateOpen(true) : handleCloseCreateDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Recipient
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[90vw] max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {newCredential ? 'Recipient Created!' : 'Add New Recipient'}
              </DialogTitle>
              <DialogDescription>
                {newCredential
                  ? 'Share the credential below with your recipient.'
                  : 'Create a recipient and grant them access to shares.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {newCredential ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-emerald-500 mb-3">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">Credential Generated</span>
                  </div>
                  <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Endpoint:</span>
                    <span>{newCredential.endpoint}</span>
                    <span className="text-muted-foreground">Expires:</span>
                    <span>{new Date(newCredential.expirationTime).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(newCredential, null, 2)}</pre>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant={copied ? "default" : "outline"}
                    onClick={handleCopyCredential}
                    className={`flex-1 ${copied ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
                  >
                    {copied ? <><Check className="mr-2 h-4 w-4" />Copied!</> : <><Copy className="mr-2 h-4 w-4" />Copy JSON</>}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCredential} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
                
                <div className="text-sm text-amber-500 text-center bg-amber-500/10 border border-amber-500/20 rounded-lg py-2.5 px-4">
                  ⚠️ Save this now — it won't be shown again.
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Recipient Name</Label>
                  <Input
                    id="name"
                    placeholder="partner_company"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="data@partner.com"
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                {shares && shares.length > 0 && (
                  <div className="space-y-2">
                    <Label>Grant Access to Shares</Label>
                    <div className="space-y-2 max-h-40 overflow-auto rounded-lg border border-border p-2">
                      {shares.map((share) => (
                        <label
                          key={share.id}
                          className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedShares.includes(share.name)}
                            onChange={() => toggleShare(share.name)}
                            className="rounded border-border"
                          />
                          <span className="text-sm">{share.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter className="sm:justify-end">
              {newCredential ? (
                <Button onClick={handleCloseCreateDialog} className="w-full sm:w-auto">Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCloseCreateDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRecipient}
                    disabled={!newRecipientName.trim() || createRecipient.isPending}
                  >
                    {createRecipient.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Recipient'
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search recipients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-muted/50 pl-9"
        />
      </div>

      {/* Recipients table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Recipients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRecipients && filteredRecipients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-purple/10">
                          <Users className="h-5 w-5 text-delta-purple" />
                        </div>
                        <Link
                          to={`/recipients/${recipient.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {recipient.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {recipient.email || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {recipient.shares && recipient.shares.length > 0 ? (
                          recipient.shares.slice(0, 2).map((share) => (
                            <Badge key={share} variant="outline" className="text-xs">
                              {share}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                        {recipient.shares && recipient.shares.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{recipient.shares.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {recipient.createdAt ? formatRelativeTime(recipient.createdAt) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/recipients/${recipient.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirm(recipient.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No recipients found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Add your first recipient to start sharing data'}
              </p>
              {!searchQuery && canCreate && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipient</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this recipient? They will lose access to all shared data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteRecipient(deleteConfirm)}
              disabled={deleteRecipient.isPending}
            >
              {deleteRecipient.isPending ? (
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
    </div>
  )
}

