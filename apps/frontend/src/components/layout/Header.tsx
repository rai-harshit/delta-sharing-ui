import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { NotificationDropdown } from './NotificationDropdown'
import { ThemeToggle } from '@/context/ThemeContext'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/shares': 'Shares',
  '/recipients': 'Recipients',
}

export function Header() {
  const location = useLocation()
  
  // Get title based on current path
  const getTitle = () => {
    // Check for exact matches first
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }
    
    // Check for nested routes
    if (location.pathname.startsWith('/shares/')) {
      return 'Share Details'
    }
    if (location.pathname.startsWith('/recipients/')) {
      return 'Recipient Details'
    }
    
    return 'Delta Sharing'
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/30 px-6 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-semibold">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 bg-muted/50 pl-9"
          />
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationDropdown />
      </div>
    </header>
  )
}











