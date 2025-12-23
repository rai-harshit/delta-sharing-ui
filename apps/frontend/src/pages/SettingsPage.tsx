import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAdminUsers, useCreateAdminUser, useDeleteAdminUser } from '@/hooks/useAdminUsers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  Settings,
  User,
  Users,
  Lock,
  Mail,
  Calendar,
  Shield,
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { AdminUser } from '@/lib/api'

type SettingsTab = 'account' | 'users'

export function SettingsPage() {
  const { user, changePassword, hasPermission } = useAuth()
  const canManageUsers = hasPermission('admin_users:view')
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-delta-cyan to-delta-purple shadow-lg">
          <Settings className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and system settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('account')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === 'account'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="h-4 w-4" />
          Account
        </button>
        {canManageUsers && (
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === 'users'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Users
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'account' ? (
        <AccountTab user={user} changePassword={changePassword} />
      ) : canManageUsers ? (
        <UsersTab currentUserId={(user as { id?: string })?.id} />
      ) : null}
    </div>
  )
}

// Account Tab
function AccountTab({ 
  user, 
  changePassword 
}: { 
  user: ReturnType<typeof useAuth>['user'];
  changePassword: (current: string, newPass: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password')
      return
    }

    setIsLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user && 'email' in user ? user.email : '—'}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge variant="outline" className="capitalize">
                {user?.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <p>Password changed successfully!</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <PasswordInput
                id="currentPassword"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-muted/50"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-muted/50"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-muted/50"
                autoComplete="new-password"
              />
            </div>

            {newPassword && confirmPassword && newPassword === confirmPassword && (
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>Passwords match</span>
              </div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Users Tab
function UsersTab({ currentUserId }: { currentUserId?: string }) {
  const { data: users, isLoading } = useAdminUsers()
  const createUser = useCreateAdminUser()
  const deleteUser = useDeleteAdminUser()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('viewer')
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!newEmail || !newPassword) {
      setCreateError('Email and password are required')
      return
    }

    if (newPassword.length < 8) {
      setCreateError('Password must be at least 8 characters')
      return
    }

    try {
      await createUser.mutateAsync({
        email: newEmail,
        password: newPassword,
        name: newName || undefined,
        role: newRole,
      })
      setShowCreateDialog(false)
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setNewRole('admin')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return

    try {
      await deleteUser.mutateAsync(deleteConfirm.id)
      setDeleteConfirm(null)
    } catch (err) {
      // Error is handled by the mutation
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Admin Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage users who can access the admin console
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !users || users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-delta-cyan to-delta-purple">
                    <span className="font-semibold text-white">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name || user.email}</p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "capitalize text-xs",
                          user.role === 'admin' && "bg-delta-purple/10 text-delta-purple border-delta-purple/30"
                        )}
                      >
                        {user.role}
                      </Badge>
                      {user.id === currentUserId && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      Created {formatDate(user.createdAt)}
                    </p>
                    {user.lastLoginAt && (
                      <p className="text-xs text-muted-foreground/70">
                        Last login: {formatDate(user.lastLoginAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteConfirm(user)}
                    disabled={user.id === currentUserId}
                    title={user.id === currentUserId ? "You can't delete yourself" : "Delete user"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new admin user who can access the management console.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            {createError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{createError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newEmail">Email *</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newName">Name (optional)</Label>
              <Input
                id="newName"
                type="text"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createNewPassword">Password *</Label>
              <PasswordInput
                id="createNewPassword"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                User will be asked to change password on first login.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newRole">Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as 'admin' | 'editor' | 'viewer')}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access (create, edit, delete, manage users)</SelectItem>
                  <SelectItem value="editor">Editor - Create & edit (no delete, no user management)</SelectItem>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.email}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

