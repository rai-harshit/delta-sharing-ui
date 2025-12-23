import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { RecipientProvider } from '@/context/RecipientContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Toaster } from '@/components/ui/toaster'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { MainLayout } from '@/components/layout/MainLayout'
import { RecipientLayout } from '@/components/layout/RecipientLayout'

// Pages - Provider
import { LoginPage } from '@/pages/LoginPage'
import { SSOCallbackPage } from '@/pages/SSOCallbackPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SharesPage } from '@/pages/SharesPage'
import { ShareDetailPage } from '@/pages/ShareDetailPage'
import { RecipientsPage } from '@/pages/RecipientsPage'
import { RecipientDetailPage } from '@/pages/RecipientDetailPage'
import { AuditDashboardPage } from '@/pages/AuditDashboardPage'
import { StorageSettingsPage } from '@/pages/StorageSettingsPage'
import { SharedAssetsPage } from '@/pages/SharedAssetsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'
import { SettingsPage } from '@/pages/SettingsPage'

// Pages - Recipient
import { RecipientLoginPage } from '@/pages/RecipientLoginPage'
import { RecipientSharesPage } from '@/pages/RecipientSharesPage'
import { RecipientCredentialPage } from '@/pages/RecipientCredentialPage'
import { RecipientGuidePage } from '@/pages/RecipientGuidePage'

// Pages - Common
import { LandingPage } from '@/pages/LandingPage'

// Build mode: 'full' | 'provider' | 'recipient'
const BUILD_MODE = import.meta.env.VITE_BUILD_MODE || 'full'

// Check if provider features are enabled
const isProviderEnabled = BUILD_MODE === 'full' || BUILD_MODE === 'provider'

// Check if recipient features are enabled
const isRecipientEnabled = BUILD_MODE === 'full' || BUILD_MODE === 'recipient'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RecipientProvider>
          {/* Only show change password dialog in provider modes */}
          {isProviderEnabled && <ChangePasswordDialog />}
          
          <Routes>
            {/* Landing Page - behavior depends on build mode */}
            <Route 
              path="/" 
              element={
                BUILD_MODE === 'full' ? (
                  <LandingPage />
                ) : BUILD_MODE === 'provider' ? (
                  <Navigate to="/login" replace />
                ) : (
                  <Navigate to="/recipient" replace />
                )
              } 
            />

            {/* Provider Console (Admin) - only in full and provider modes */}
            {isProviderEnabled && (
              <>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/sso-callback" element={<SSOCallbackPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                </Route>
                <Route
                  path="/shares"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SharesPage />} />
                </Route>
                <Route
                  path="/shares/:shareId"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ShareDetailPage />} />
                </Route>
                <Route
                  path="/recipients"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<RecipientsPage />} />
                </Route>
                <Route
                  path="/recipients/:recipientId"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<RecipientDetailPage />} />
                </Route>
                <Route
                  path="/audit"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AuditDashboardPage />} />
                </Route>
                <Route
                  path="/storage"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<StorageSettingsPage />} />
                </Route>
                <Route
                  path="/assets"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SharedAssetsPage />} />
                </Route>
                <Route
                  path="/webhooks"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<WebhooksPage />} />
                </Route>
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SettingsPage />} />
                </Route>
              </>
            )}

            {/* Recipient Portal - only in full and recipient modes */}
            {isRecipientEnabled && (
              <>
                <Route path="/recipient" element={<RecipientLoginPage />} />
                <Route path="/recipient/login" element={<RecipientLoginPage />} />
                <Route path="/recipient/shares" element={<RecipientLayout><RecipientSharesPage /></RecipientLayout>} />
                <Route path="/recipient/credential" element={<RecipientLayout><RecipientCredentialPage /></RecipientLayout>} />
                <Route path="/recipient/guide" element={<RecipientLayout><RecipientGuidePage /></RecipientLayout>} />
              </>
            )}

            {/* Fallback for undefined routes */}
            <Route 
              path="*" 
              element={
                <Navigate 
                  to={
                    BUILD_MODE === 'recipient' ? '/recipient' : 
                    BUILD_MODE === 'provider' ? '/login' : 
                    '/'
                  } 
                  replace 
                />
              } 
            />
          </Routes>
          <Toaster />
        </RecipientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
