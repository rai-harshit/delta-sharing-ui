import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Database, 
  Download, 
  ArrowRight,
  Share2,
  Shield,
  Zap,
} from 'lucide-react'

export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-[length:50px_50px] opacity-20" />
      <div className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-delta-purple/10 blur-[120px]" />
      <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-delta-cyan/10 blur-[120px]" />
      <div className="absolute left-1/2 top-1/4 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-delta-purple/5 blur-[80px]" />

      {/* Header */}
      <div className="relative z-10 mb-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-delta-purple to-delta-cyan shadow-xl shadow-delta-purple/20">
          <span className="text-4xl font-bold text-white">Δ</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          Delta Sharing
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Open protocol for secure data sharing across platforms and clouds
        </p>
      </div>

      {/* Role Selection Cards */}
      <div className="relative z-10 grid w-full max-w-4xl gap-6 md:grid-cols-2">
        {/* Data Provider Card */}
        <Card className="group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-xl transition-all hover:border-delta-purple/50 hover:shadow-lg hover:shadow-delta-purple/10">
          <div className="absolute inset-0 bg-gradient-to-br from-delta-purple/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <CardHeader className="relative">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-delta-purple/10">
              <Database className="h-7 w-7 text-delta-purple" />
            </div>
            <CardTitle className="text-xl">Data Provider</CardTitle>
            <CardDescription>
              Create and manage data shares for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-delta-purple" />
                Create shares with schemas and tables
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-delta-purple" />
                Manage recipient access and permissions
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-delta-purple" />
                Monitor usage with audit logs
              </li>
            </ul>
            <Link to="/login" className="block">
              <Button className="w-full group/btn">
                Go to Provider Console
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Data Recipient Card */}
        <Card className="group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-xl transition-all hover:border-delta-cyan/50 hover:shadow-lg hover:shadow-delta-cyan/10">
          <div className="absolute inset-0 bg-gradient-to-br from-delta-cyan/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <CardHeader className="relative">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-delta-cyan/10">
              <Download className="h-7 w-7 text-delta-cyan" />
            </div>
            <CardTitle className="text-xl">Data Recipient</CardTitle>
            <CardDescription>
              Access shared data with your credential file
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-delta-cyan" />
                Connect to any Delta Sharing server
              </li>
              <li className="flex items-center gap-2">
                <Database className="h-4 w-4 text-delta-cyan" />
                Browse and preview shared tables
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-delta-cyan" />
                Get code snippets for Python & Spark
              </li>
            </ul>
            <Link to="/recipient" className="block">
              <Button variant="outline" className="w-full group/btn border-delta-cyan/50 hover:bg-delta-cyan/10 hover:text-delta-cyan">
                Go to Recipient Portal
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 text-center text-sm text-muted-foreground">
        <p>
          Powered by{' '}
          <a 
            href="https://delta.io/sharing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-delta-purple hover:underline"
          >
            Delta Sharing Protocol
          </a>
        </p>
      </div>
    </div>
  )
}














