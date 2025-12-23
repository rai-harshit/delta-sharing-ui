/**
 * SSO Callback Page
 * 
 * Handles SSO errors that might occur during the authentication flow.
 * Note: With HttpOnly cookies, successful SSO redirects directly to dashboard.
 * This page is primarily for handling and displaying error cases.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { validateSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const errorMessage = searchParams.get('error');

      // Check for error from SSO provider
      if (errorMessage) {
        setError(errorMessage);
        setProcessing(false);
        return;
      }

      try {
        // With HttpOnly cookies, the cookie is already set by the backend
        // We just need to validate the session and update the context
        await validateSession();
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch {
        setError('Authentication failed. Please try again.');
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, validateSession, navigate]);

  if (processing && !error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-delta-purple mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-foreground">Completing sign in...</h2>
          <p className="text-muted-foreground mt-2">Please wait while we authenticate you.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6">
            <svg
              className="h-12 w-12 text-destructive mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Failed</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-delta-purple hover:bg-delta-purple/90 text-white font-medium rounded-lg transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default SSOCallbackPage;
