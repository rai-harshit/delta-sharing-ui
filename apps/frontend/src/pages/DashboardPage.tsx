import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useShares } from '@/hooks/useShares'
import { useRecipients } from '@/hooks/useRecipients'
import {
  Share2,
  Users,
  Database,
  Activity,
  ArrowRight,
} from 'lucide-react'

interface ShareWithCounts {
  id: string
  name: string
  createdAt?: string
  schemaCount?: number
  tableCount?: number
  recipientCount?: number
}

export function DashboardPage() {
  const { data: shares, isLoading: sharesLoading } = useShares() as { data: ShareWithCounts[] | undefined, isLoading: boolean }
  const { data: recipients, isLoading: recipientsLoading } = useRecipients()

  // Calculate total tables from shares data
  const totalTables = shares?.reduce((sum, share) => sum + (share.tableCount || 0), 0) || 0
  const totalSchemas = shares?.reduce((sum, share) => sum + (share.schemaCount || 0), 0) || 0

  const stats = [
    {
      title: 'Total Shares',
      value: shares?.length || 0,
      icon: Share2,
      color: 'from-delta-cyan to-cyan-400',
      href: '/shares',
    },
    {
      title: 'Recipients',
      value: recipients?.length || 0,
      icon: Users,
      color: 'from-delta-purple to-purple-400',
      href: '/recipients',
    },
    {
      title: 'Tables Shared',
      value: totalTables,
      icon: Database,
      color: 'from-emerald-500 to-emerald-400',
      href: '/assets?tab=tables',
    },
    {
      title: 'Schemas',
      value: totalSchemas,
      icon: Activity,
      color: 'from-amber-500 to-amber-400',
      href: '/assets?tab=schemas',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-delta-cyan/5 p-8">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold">Welcome to Delta Sharing</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Manage your data shares, recipients, and monitor access to your Delta Lake tables.
          </p>
          <div className="mt-6 flex gap-4">
            <Button asChild>
              <Link to="/shares">
                <Share2 className="mr-2 h-4 w-4" />
                View Shares
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/recipients">
                <Users className="mr-2 h-4 w-4" />
                Manage Recipients
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-delta-cyan/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-delta-purple/10 blur-3xl" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} to={stat.href}>
            <Card className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} shadow-lg`}
                >
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                {sharesLoading || recipientsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-3xl font-bold">{stat.value}</span>
                )}
              </CardContent>
              <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-delta-cyan to-delta-purple transition-all group-hover:w-full" />
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Shares */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Shares</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/shares">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sharesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : shares && shares.length > 0 ? (
              <div className="space-y-3">
                {shares.slice(0, 5).map((share) => (
                  <Link
                    key={share.id}
                    to={`/shares/${share.name}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-cyan/10">
                        <Share2 className="h-5 w-5 text-delta-cyan" />
                      </div>
                      <div>
                        <p className="font-medium">{share.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Share2 className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No shares yet</p>
                <Button className="mt-4" size="sm" asChild>
                  <Link to="/shares">Create your first share</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Recipients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Recipients</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/recipients">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recipientsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recipients && recipients.length > 0 ? (
              <div className="space-y-3">
                {recipients.slice(0, 5).map((recipient) => (
                  <Link
                    key={recipient.id}
                    to={`/recipients/${recipient.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-delta-purple/10">
                        <Users className="h-5 w-5 text-delta-purple" />
                      </div>
                      <div>
                        <p className="font-medium">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {recipient.shares?.length || 0} shares
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No recipients yet</p>
                <Button className="mt-4" size="sm" asChild>
                  <Link to="/recipients">Add your first recipient</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

