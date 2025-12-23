import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useShares, useCreateShare, useDeleteShare } from '@/hooks/useShares'
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
  Share2,
  Eye,
  Trash2,
  Loader2,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

export function SharesPage() {
  const { canCreate, canDelete } = useAuth()
  const { data: shares, isLoading } = useShares()
  const createShare = useCreateShare()
  const deleteShare = useDeleteShare()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newShareName, setNewShareName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filteredShares = shares?.filter(share =>
    share.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateShare = async () => {
    if (!newShareName.trim()) return
    
    await createShare.mutateAsync({ name: newShareName.trim() })
    setNewShareName('')
    setIsCreateOpen(false)
  }

  const handleDeleteShare = async (shareId: string) => {
    await deleteShare.mutateAsync(shareId)
    setDeleteConfirm(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shares</h2>
          <p className="text-muted-foreground">
            Manage your Delta Lake data shares
          </p>
        </div>
        
        {canCreate && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Share
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Share</DialogTitle>
              <DialogDescription>
                Create a new data share to start sharing Delta Lake tables.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Share Name</Label>
                <Input
                  id="name"
                  placeholder="my_data_share"
                  value={newShareName}
                  onChange={(e) => setNewShareName(e.target.value)}
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  Use alphanumeric characters and underscores only
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateShare}
                disabled={!newShareName.trim() || createShare.isPending}
              >
                {createShare.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Share'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

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

      {/* Shares table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Shares</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredShares && filteredShares.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-cyan/10">
                          <Share2 className="h-5 w-5 text-delta-cyan" />
                        </div>
                        <div>
                          <Link
                            to={`/shares/${share.name}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {share.name}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {share.createdAt ? formatRelativeTime(share.createdAt) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
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
                            <Link to={`/shares/${share.name}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirm(share.name)}
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
              <Share2 className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No shares found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first share to start sharing data'}
              </p>
              {!searchQuery && canCreate && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Share
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
            <DialogTitle>Delete Share</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the share "{deleteConfirm}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteShare(deleteConfirm)}
              disabled={deleteShare.isPending}
            >
              {deleteShare.isPending ? (
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











