import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

type AdminRole = 'admin' | 'editor' | 'viewer'

interface AdminUser {
  id: string
  email: string
  name?: string
  role: AdminRole
  mustChangePassword: boolean
}

interface RecipientUser {
  serverUrl: string
  recipientId: string
  recipientName: string
  role: 'recipient'
}

type User = AdminUser | RecipientUser

// Permission types matching backend
type Permission = 
  | 'shares:view' | 'shares:create' | 'shares:edit' | 'shares:delete'
  | 'recipients:view' | 'recipients:create' | 'recipients:edit' | 'recipients:delete' | 'recipients:rotate_token'
  | 'storage:view' | 'storage:create' | 'storage:edit' | 'storage:delete'
  | 'audit:view' | 'audit:export' | 'audit:cleanup'
  | 'admin_users:view' | 'admin_users:create' | 'admin_users:edit' | 'admin_users:delete'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isRecipient: boolean
  isAdmin: boolean
  adminRole: AdminRole | null
  mustChangePassword: boolean
  hasPermission: (permission: Permission) => boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  login: (email: string, password: string) => Promise<void>
  validateSession: () => Promise<void>
  recipientLogin: (endpoint: string, bearerToken: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Only store user display info (not the token - that's in HttpOnly cookie)
const USER_KEY = 'delta_sharing_user'
const PERMISSIONS_KEY = 'delta_sharing_permissions'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user info and permissions from /me endpoint
  const fetchUserWithPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include HttpOnly cookie
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
          setPermissions(data.permissions || [])
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
          localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(data.permissions || []))
          return true
        }
      }
      
      // Session invalid, clear user
      setUser(null)
      setPermissions([])
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(PERMISSIONS_KEY)
      return false
    } catch {
      // Network error or invalid session
      setUser(null)
      setPermissions([])
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(PERMISSIONS_KEY)
      return false
    }
  }, [])

  // Validate session on mount - check if HttpOnly cookie is valid
  const validateSession = useCallback(async () => {
    const valid = await fetchUserWithPermissions()
    if (valid) {
      // Fetch CSRF token for state-changing requests
      await api.fetchCsrfToken()
    }
  }, [fetchUserWithPermissions])

  // Initialize: validate session first, don't use stale localStorage data
  useEffect(() => {
    const init = async () => {
      // Validate session with server (cookie will be sent automatically)
      // This will set user and permissions from the API response
      await validateSession()
      setIsLoading(false)
    }
    
    init()
  }, [validateSession])

  // Admin login with email/password
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await api.login(email, password) as unknown as {
        success: boolean
        user: AdminUser
      }
      
      if (response.success) {
        // Fetch CSRF token for subsequent state-changing requests
        await api.fetchCsrfToken()
        // After login, fetch full user info with permissions
        await fetchUserWithPermissions()
      } else {
        throw new Error('Login failed')
      }
    } finally {
      setIsLoading(false)
    }
  }, [fetchUserWithPermissions])

  // Recipient login
  const recipientLogin = useCallback(async (endpoint: string, bearerToken: string) => {
    setIsLoading(true)
    try {
      const response = await api.recipientLogin(endpoint, bearerToken) as unknown as {
        success: boolean
        user: {
          serverUrl: string
          recipientId: string
          recipientName: string
          role: string
        }
      }
      
      if (response.success) {
        // Fetch CSRF token for subsequent state-changing requests
        await api.fetchCsrfToken()
        // After login, fetch full user info with permissions
        await fetchUserWithPermissions()
      } else {
        throw new Error('Login failed')
      }
    } finally {
      setIsLoading(false)
    }
  }, [fetchUserWithPermissions])

  // Change password
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await api.changePassword(currentPassword, newPassword) as unknown as {
      success: boolean
      message: string
    }
    
    if (response.success && user && 'mustChangePassword' in user) {
      // Update user state to reflect password changed
      const updatedUser = { ...user, mustChangePassword: false }
      setUser(updatedUser)
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
    }
  }, [user])

  // Logout - calls server to clear HttpOnly cookie
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include HttpOnly cookie
      })
    } catch {
      // Ignore errors, still clear local state
    }
    
    // Clear CSRF token
    api.clearCsrfToken()
    
    setUser(null)
    setPermissions([])
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(PERMISSIONS_KEY)
  }, [])

  const isRecipient = user?.role === 'recipient'
  const adminRole: AdminRole | null = user && 'mustChangePassword' in user ? user.role : null
  const isAdmin = adminRole !== null
  const mustChangePassword = user && 'mustChangePassword' in user ? user.mustChangePassword : false

  // Check if user has a specific permission (fetched from API)
  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission)
  }, [permissions])

  // Convenience booleans for common permission checks
  const canCreate = hasPermission('shares:create') || hasPermission('recipients:create')
  const canEdit = hasPermission('shares:edit') || hasPermission('recipients:edit')
  const canDelete = hasPermission('shares:delete') || hasPermission('recipients:delete')

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isRecipient,
    isAdmin,
    adminRole,
    mustChangePassword,
    hasPermission,
    canCreate,
    canEdit,
    canDelete,
    login,
    validateSession,
    recipientLogin,
    changePassword,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
