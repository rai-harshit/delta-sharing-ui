import { ReactNode, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Database,
  FolderTree,
  Key,
  LogOut,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useRecipient } from '@/context/RecipientContext'
import { ThemeToggle } from '@/context/ThemeContext'

const navItems = [
  {
    title: 'Available Shares',
    href: '/recipient/shares',
    icon: FolderTree,
  },
  {
    title: 'My Credential',
    href: '/recipient/credential',
    icon: Key,
  },
  {
    title: 'Access Guide',
    href: '/recipient/guide',
    icon: HelpCircle,
  },
]

interface RecipientLayoutProps {
  children?: ReactNode
}

export function RecipientLayout({ children }: RecipientLayoutProps) {
  const location = useLocation()
  const { disconnect, endpoint } = useRecipient()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        <Link to="/recipient/shares" className="flex items-center gap-2" onClick={closeMobileMenu}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-delta-purple to-delta-cyan">
            <span className="font-bold text-white">Δ</span>
          </div>
          <div>
            <span className="font-semibold tracking-tight">Delta Sharing</span>
            <span className="ml-2 rounded bg-delta-purple/20 px-1.5 py-0.5 text-xs font-medium text-delta-purple">
              Recipient
            </span>
          </div>
        </Link>
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={closeMobileMenu}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={closeMobileMenu}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-delta-purple/10 text-delta-purple shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-delta-purple')} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-2 space-y-1">
        {/* Server Info */}
        {endpoint && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <p className="truncate" title={endpoint}>
              Connected to: {endpoint}
            </p>
          </div>
        )}

        {/* Theme Toggle (desktop only) */}
        <div className="hidden md:flex items-center justify-between px-3 py-2">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>

        {/* Switch to Provider */}
        <Link
          to="/login"
          onClick={closeMobileMenu}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Database className="h-5 w-5" />
          <span>Provider Console</span>
        </Link>

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={() => {
            disconnect()
            closeMobileMenu()
          }}
        >
          <LogOut className="h-5 w-5" />
          <span>Disconnect</span>
        </Button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-border bg-card backdrop-blur-xl transition-transform duration-300 ease-in-out md:hidden',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-delta-purple to-delta-cyan">
                <span className="text-sm font-bold text-white">Δ</span>
              </div>
              <span className="font-semibold">Delta Sharing</span>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  )
}
