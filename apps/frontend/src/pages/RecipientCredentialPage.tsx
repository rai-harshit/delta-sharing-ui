import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipient } from '@/context/RecipientContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Key,
  Server,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Download,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { copyToClipboard, downloadAsJson, formatDate } from '@/lib/utils'

export function RecipientCredentialPage() {
  const navigate = useNavigate()
  const { credential, isConnected, isLoading } = useRecipient()
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)

  // Redirect to login if not connected
  useEffect(() => {
    if (!isLoading && !isConnected) {
      navigate('/recipient', { replace: true })
    }
  }, [isConnected, isLoading, navigate])

  if (!credential) {
    return null
  }

  const daysUntilExpiry = credential.expirationTime
    ? Math.ceil(
        (new Date(credential.expirationTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  const handleCopy = async () => {
    await copyToClipboard(JSON.stringify(credential, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    downloadAsJson(credential, 'delta-sharing-credential.json')
  }

  // Mask the bearer token
  const maskedToken = credential.bearerToken
    ? `${credential.bearerToken.slice(0, 8)}${'*'.repeat(24)}${credential.bearerToken.slice(-4)}`
    : '********************************'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Credential</h1>
        <p className="text-muted-foreground">
          Manage your Delta Sharing access credential
        </p>
      </div>

      {/* Credential Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-delta-purple" />
            Access Credential
          </CardTitle>
          <CardDescription>
            Use this credential to access shared data from your applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium">Credential Active</p>
                <p className="text-sm text-muted-foreground">
                  Your credential is valid and working
                </p>
              </div>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>

          {/* Credential details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Server className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Endpoint</p>
                <p className="font-mono text-sm break-all">{credential.endpoint}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Key className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Bearer Token</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="font-mono text-sm break-all">
                  {showToken ? credential.bearerToken : maskedToken}
                </p>
              </div>
            </div>

            {credential.expirationTime && (
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Expiration</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm">{formatDate(credential.expirationTime)}</p>
                    {daysUntilExpiry !== null && (
                      daysUntilExpiry < 30 ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {daysUntilExpiry} days left
                        </Badge>
                      ) : (
                        <Badge variant="outline">{daysUntilExpiry} days left</Badge>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy JSON
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need a New Credential?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            If your credential has expired or been revoked, contact your data provider
            to request a new one. They can generate a fresh credential from the Provider Console.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
