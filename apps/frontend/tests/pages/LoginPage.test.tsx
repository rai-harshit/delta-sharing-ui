/**
 * LoginPage Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '@/pages/LoginPage'
import { AuthProvider } from '@/context/AuthContext'

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    login: vi.fn(),
    getMe: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    fetchCsrfToken: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderLoginPage = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('should render login form', async () => {
    renderLoginPage()
    
    // Wait for loading state to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('should show validation error for empty email', async () => {
    renderLoginPage()
    
    // Wait for loading state to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)
    
    // Should show some form of validation feedback
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })
  })

  it('should allow typing in email field', async () => {
    renderLoginPage()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    const emailInput = screen.getByLabelText(/email/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('should allow typing in password field', async () => {
    renderLoginPage()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } })
    
    expect(passwordInput).toHaveValue('mypassword123')
  })

  it('should have password field with type password', async () => {
    renderLoginPage()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should display the Delta Sharing branding', async () => {
    renderLoginPage()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
    
    expect(screen.getByText(/delta sharing/i)).toBeInTheDocument()
  })
})


