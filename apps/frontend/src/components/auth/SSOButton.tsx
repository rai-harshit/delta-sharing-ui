/**
 * SSO Button Component
 * 
 * Renders a branded button for SSO login with the appropriate provider.
 */

import React from 'react';

interface SSOProvider {
  name: string;
  displayName: string;
  logoUrl?: string;
}

interface SSOButtonProps {
  provider: SSOProvider;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// Provider-specific colors and icons
const providerStyles: Record<string, { bg: string; hover: string; icon: string }> = {
  azure: {
    bg: 'bg-[#0078D4]',
    hover: 'hover:bg-[#006BC8]',
    icon: '🔷',
  },
  okta: {
    bg: 'bg-[#007DC1]',
    hover: 'hover:bg-[#006BA1]',
    icon: '🔐',
  },
  oidc: {
    bg: 'bg-gray-700',
    hover: 'hover:bg-gray-600',
    icon: '🔑',
  },
};

export function SSOButton({ provider, onClick, disabled, loading }: SSOButtonProps) {
  const style = providerStyles[provider.name] || providerStyles.oidc;
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
        text-white font-medium transition-all duration-200
        ${style.bg} ${style.hover}
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      `}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
      ) : (
        <>
          {provider.logoUrl ? (
            <img 
              src={provider.logoUrl} 
              alt={provider.displayName} 
              className="h-5 w-5 object-contain"
            />
          ) : (
            <span className="text-lg">{style.icon}</span>
          )}
        </>
      )}
      <span>Continue with {provider.displayName}</span>
    </button>
  );
}

interface SSOButtonListProps {
  providers: SSOProvider[];
  onProviderClick: (provider: SSOProvider) => void;
  loading?: boolean;
}

export function SSOButtonList({ providers, onProviderClick, loading }: SSOButtonListProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <SSOButton
          key={provider.name}
          provider={provider}
          onClick={() => onProviderClick(provider)}
          loading={loading}
        />
      ))}
    </div>
  );
}

export function SSORDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-4 bg-card text-muted-foreground">or continue with email</span>
      </div>
    </div>
  );
}

