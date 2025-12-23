import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { SSOButtonList, SSORDivider } from '@/components/auth/SSOButton'

interface SSOProvider {
  name: string
  displayName: string
  logoUrl?: string
  enabled?: boolean
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, isLoading } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([])
  const [ssoLoading, setSsoLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  // Check for SSO error in URL
  useEffect(() => {
    const ssoError = searchParams.get('error')
    if (ssoError) {
      setError(ssoError)
    }
  }, [searchParams])

  // Fetch SSO providers on mount
  useEffect(() => {
    async function fetchSSOProviders() {
      try {
        const response = await fetch('/api/auth/sso/providers', {
          credentials: 'include', // Include cookies for consistency
        })
        if (response.ok) {
          const data = await response.json()
          if (data.ssoEnabled && data.providers?.length > 0) {
            setSsoProviders(data.providers)
          }
        }
      } catch (err) {
        // SSO not configured, which is fine
        console.debug('SSO providers not available')
      }
    }
    fetchSSOProviders()
  }, [])

  const handleSSOLogin = (provider: SSOProvider) => {
    setSsoLoading(true)
    window.location.href = `/api/auth/sso/${provider.name}/login?returnTo=${encodeURIComponent(from)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-[length:50px_50px] opacity-20" />
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-delta-cyan/10 blur-[100px]" />
      <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-delta-purple/10 blur-[100px]" />
      
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-delta-cyan to-delta-purple shadow-lg shadow-delta-cyan/20">
            <span className="text-2xl font-bold text-white">Δ</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Delta Sharing</CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage your data shares
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* SSO Buttons */}
          {ssoProviders.length > 0 && (
            <>
              <SSOButtonList
                providers={ssoProviders}
                onProviderClick={handleSSOLogin}
                loading={ssoLoading}
              />
              <SSORDivider />
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@localhost"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted/50"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Password
              </Label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/50"
                autoComplete="current-password"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Help text */}
          <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
            <p>
              Are you a data recipient?{' '}
              <a
                href="/recipient/login"
                className="text-delta-purple hover:underline"
              >
                Go to Recipient Portal
              </a>
            </p>
            <p className="text-muted-foreground/70">
              Default credentials: admin@localhost / changeme
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
