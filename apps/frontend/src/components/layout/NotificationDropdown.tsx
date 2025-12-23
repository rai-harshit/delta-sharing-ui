import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, AlertCircle, AlertTriangle, Info, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import type { NotificationSeverity } from '@/lib/api'

const severityConfig: Record<NotificationSeverity, { icon: typeof AlertCircle; color: string; bgColor: string }> = {
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  info: {
    icon: Info,
    color: 'text-delta-cyan',
    bgColor: 'bg-delta-cyan/10',
  },
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch, isRefetching } = useNotifications()

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0
  const hasNotifications = notifications.length > 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasNotifications ? (
          <div className="py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/70">All systems are running smoothly</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const config = severityConfig[notification.severity]
                const Icon = config.icon

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      notification.severity === 'error' && "bg-destructive/5"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", config.bgColor)}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                      {notification.link && (
                        <Link
                          to={notification.link}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            config.color,
                            "hover:underline"
                          )}
                        >
                          {notification.linkText || 'View'}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {hasNotifications && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-center text-xs text-muted-foreground">
              {notifications.length} notification{notifications.length > 1 ? 's' : ''}
              {unreadCount > 0 && ` • ${unreadCount} require attention`}
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

