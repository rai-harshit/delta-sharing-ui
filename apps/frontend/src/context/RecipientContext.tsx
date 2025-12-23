/**
 * Recipient Context
 * 
 * Provides recipient authentication and Delta Sharing client access
 * using direct credential storage (no backend JWT exchange needed).
 * 
 * This enables the Recipient Portal to work with ANY Delta Sharing server,
 * not just the bundled backend.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { 
  DeltaSharingClient, 
  DeltaSharingCredential, 
  parseCredential,
  isCredentialExpired 
} from '@/lib/delta-sharing-client'

const CREDENTIAL_KEY = 'delta_sharing_recipient_credential'

interface RecipientContextType {
  // Connection state
  isConnected: boolean
  isLoading: boolean
  error: string | null
  
  // Credential info
  credential: DeltaSharingCredential | null
  endpoint: string | null
  
  // Client instance
  client: DeltaSharingClient | null
  
  // Actions
  connect: (credential: DeltaSharingCredential) => Promise<void>
  connectWithJson: (json: string) => Promise<void>
  disconnect: () => void
}

const RecipientContext = createContext<RecipientContextType | undefined>(undefined)

export function RecipientProvider({ children }: { children: React.ReactNode }) {
  const [credential, setCredential] = useState<DeltaSharingCredential | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create client instance when credential changes
  const client = useMemo(() => {
    if (!credential) return null
    return DeltaSharingClient.fromCredential(credential)
  }, [credential])

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CREDENTIAL_KEY)
    if (stored) {
      const parsed = parseCredential(stored)
      if (parsed && !isCredentialExpired(parsed)) {
        setCredential(parsed)
      } else {
        // Clear expired or invalid credential
        localStorage.removeItem(CREDENTIAL_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  // Connect with a credential object
  const connect = useCallback(async (cred: DeltaSharingCredential) => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if expired
      if (isCredentialExpired(cred)) {
        throw new Error('This credential has expired')
      }

      // Test the connection by listing shares
      const testClient = DeltaSharingClient.fromCredential(cred)
      await testClient.listShares()

      // Connection successful - store credential
      setCredential(cred)
      localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(cred))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect'
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Connect with JSON string
  const connectWithJson = useCallback(async (json: string) => {
    const parsed = parseCredential(json)
    if (!parsed) {
      throw new Error('Invalid credential format')
    }
    await connect(parsed)
  }, [connect])

  // Disconnect
  const disconnect = useCallback(() => {
    setCredential(null)
    setError(null)
    localStorage.removeItem(CREDENTIAL_KEY)
  }, [])

  const value: RecipientContextType = {
    isConnected: !!credential && !!client,
    isLoading,
    error,
    credential,
    endpoint: credential?.endpoint || null,
    client,
    connect,
    connectWithJson,
    disconnect,
  }

  return (
    <RecipientContext.Provider value={value}>
      {children}
    </RecipientContext.Provider>
  )
}

export function useRecipient() {
  const context = useContext(RecipientContext)
  if (context === undefined) {
    throw new Error('useRecipient must be used within a RecipientProvider')
  }
  return context
}

/**
 * Hook to ensure the user is connected as a recipient
 * Redirects to login if not connected
 */
export function useRequireRecipient() {
  const { isConnected, isLoading } = useRecipient()
  return { isConnected, isLoading }
}














