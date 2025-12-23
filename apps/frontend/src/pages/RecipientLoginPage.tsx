import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipient } from '@/context/RecipientContext'
import { parseCredential, isCredentialExpired, DeltaSharingCredential } from '@/lib/delta-sharing-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Upload, FileJson, AlertCircle, Check, ExternalLink } from 'lucide-react'

export function RecipientLoginPage() {
  const navigate = useNavigate()
  const { connect, isConnected, isLoading: contextLoading } = useRecipient()
  
  const [credential, setCredential] = useState<DeltaSharingCredential | null>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Redirect if already connected
  useEffect(() => {
    if (isConnected && !contextLoading) {
      navigate('/recipient/shares', { replace: true })
    }
  }, [isConnected, contextLoading, navigate])

  const handleFileUpload = useCallback((file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCredential(text)
      if (parsed) {
        if (isCredentialExpired(parsed)) {
          setError('This credential has expired')
          return
        }
        setCredential(parsed)
        setJsonInput(text)
      } else {
        setError('Invalid credential file. Please upload a valid Delta Sharing credential JSON.')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/json') {
      handleFileUpload(file)
    } else {
      setError('Please upload a JSON file')
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleJsonInputChange = (value: string) => {
    setJsonInput(value)
    setError(null)
    const parsed = parseCredential(value)
    if (parsed) {
      if (isCredentialExpired(parsed)) {
        setError('This credential has expired')
        setCredential(null)
        return
      }
      setCredential(parsed)
    } else if (value.trim()) {
      setCredential(null)
    }
  }

  const handleConnect = async () => {
    if (!credential) return
    setError(null)
    setIsConnecting(true)

    try {
      await connect(credential)
      navigate('/recipient/shares', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }

  const isLoading = isConnecting || contextLoading

  // Handle Enter key to connect (Ctrl/Cmd + Enter for textarea)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && credential && !isLoading) {
      e.preventDefault()
      handleConnect()
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-[length:50px_50px] opacity-20" />
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-delta-purple/10 blur-[100px]" />
      <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-delta-cyan/10 blur-[100px]" />
      
      <Card className="relative w-full max-w-lg border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-delta-purple to-delta-cyan shadow-lg shadow-delta-purple/20">
            <span className="text-2xl font-bold text-white">Δ</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Recipient Portal</CardTitle>
            <CardDescription className="mt-2">
              Connect to any Delta Sharing server with your credential
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Info banner */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-delta-cyan/30 bg-delta-cyan/5 p-3 text-sm">
            <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5 text-delta-cyan" />
            <p className="text-muted-foreground">
              This portal works with <strong>any</strong> Delta Sharing server. 
              Just upload the credential file you received from your data provider.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Tabs defaultValue="upload" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload File</TabsTrigger>
              <TabsTrigger value="paste">Paste JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : credential
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {credential ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="mt-3 font-medium text-emerald-500">Credential loaded</p>
                    <p className="mt-1 text-sm text-muted-foreground truncate max-w-full px-4">
                      {credential.endpoint}
                    </p>
                    {credential.expirationTime && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expires: {new Date(credential.expirationTime).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 font-medium">Drop credential file here</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json" className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  Credential JSON
                </Label>
                <textarea
                  id="json"
                  placeholder={`{
  "shareCredentialsVersion": 1,
  "endpoint": "https://your-delta-sharing-server.com/api/delta",
  "bearerToken": "your-bearer-token",
  "expirationTime": "2025-12-31T23:59:59Z"
}`}
                  value={jsonInput}
                  onChange={(e) => handleJsonInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[150px] w-full rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {credential && jsonInput && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-emerald-500">
                      <Check className="h-4 w-4" />
                      Valid credential detected
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Press ⌘/Ctrl + Enter to connect
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Connect button */}
          <Button
            className="mt-6 w-full"
            onClick={handleConnect}
            disabled={!credential || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to Shares'
            )}
          </Button>

          {/* Provider link */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Are you a data provider?{' '}
            <a
              href="/login"
              className="text-primary hover:underline"
            >
              Go to Provider Console
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
