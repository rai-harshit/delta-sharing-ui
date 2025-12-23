import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Share2,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Package,
  Settings,
  Webhook,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Shares',
    href: '/shares',
    icon: Share2,
  },
  {
    title: 'Shared Assets',
    href: '/assets',
    icon: Package,
  },
  {
    title: 'Recipients',
    href: '/recipients',
    icon: Users,
  },
  {
    title: 'Storage',
    href: '/storage',
    icon: Cloud,
  },
  {
    title: 'Webhooks',
    href: '/webhooks',
    icon: Webhook,
  },
  {
    title: 'Audit Logs',
    href: '/audit',
    icon: BarChart3,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { logout, user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-delta-cyan to-delta-purple">
                <span className="font-bold text-white">Δ</span>
              </div>
              <span className="font-semibold tracking-tight">Delta Sharing</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-delta-cyan to-delta-purple mx-auto">
              <span className="font-bold text-white">Δ</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href))

            const NavLink = (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return NavLink
          })}
        </nav>

        <Separator />

        {/* Footer */}
        <div className="p-2 space-y-1">
          {/* Server Info */}
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              <p className="truncate" title={user.serverUrl}>
                {user.mockMode ? '🧪 Mock Mode' : user.serverUrl}
              </p>
            </div>
          )}

          {/* Collapse Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </Button>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
                {!collapsed && <span>Logout</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <p>Logout</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}


