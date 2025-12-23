/**
 * OIDC Provider Presets Registry
 * 
 * Exports all available provider presets and utilities
 * for selecting the right preset based on configuration.
 */

import { OIDCPreset, OIDCConfig } from '../types.js';
import { azurePreset, createAzureConfig } from './azure.js';
import { oktaPreset, createOktaConfig } from './okta.js';

// Registry of all available presets
export const presets: Record<string, OIDCPreset> = {
  azure: azurePreset,
  okta: oktaPreset,
};

/**
 * Generic OIDC preset for custom providers
 */
export const genericPreset: OIDCPreset = {
  name: 'oidc',
  displayName: 'Generic OIDC',
  
  getIssuerUrl: (config: Record<string, string>) => {
    if (!config.issuerUrl) {
      throw new Error('OIDC issuer URL is required');
    }
    return config.issuerUrl;
  },
  
  defaultScopes: ['openid', 'profile', 'email'],
  
  mapClaims: (claims: Record<string, unknown>) => ({
    sub: String(claims.sub),
    email: claims.email as string | undefined,
    name: claims.name as string | undefined,
    picture: claims.picture as string | undefined,
    groups: Array.isArray(claims.groups) ? claims.groups.map(String) : [],
    roles: Array.isArray(claims.roles) ? claims.roles.map(String) : [],
    raw: claims,
  }),
  
  envMapping: {
    issuerUrl: 'OIDC_ISSUER_URL',
    clientId: 'OIDC_CLIENT_ID',
    clientSecret: 'OIDC_CLIENT_SECRET',
  },
};

// Add generic to presets
presets.oidc = genericPreset;

/**
 * Get a preset by name
 */
export function getPreset(name: string): OIDCPreset | undefined {
  return presets[name];
}

/**
 * Get all available presets
 */
export function getAvailablePresets(): OIDCPreset[] {
  return Object.values(presets);
}

/**
 * Detect which SSO provider is configured based on environment variables
 */
export function detectConfiguredProvider(): string | null {
  // Check for explicit provider setting
  const explicitProvider = process.env.SSO_PROVIDER;
  if (explicitProvider && presets[explicitProvider]) {
    return explicitProvider;
  }
  
  // Auto-detect based on environment variables
  if (process.env.AZURE_AD_TENANT_ID && process.env.AZURE_AD_CLIENT_ID) {
    return 'azure';
  }
  
  if (process.env.OKTA_DOMAIN && process.env.OKTA_CLIENT_ID) {
    return 'okta';
  }
  
  if (process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID) {
    return 'oidc';
  }
  
  return null;
}

/**
 * Create OIDC configuration from environment variables
 * Returns null if SSO is not configured
 */
export function createOIDCConfigFromEnv(): OIDCConfig | null {
  const provider = detectConfiguredProvider();
  
  if (!provider) {
    return null;
  }
  
  const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  let providerConfig: { 
    issuerUrl: string; 
    clientId: string; 
    clientSecret: string;
    adminGroup?: string;
    adminGroupId?: string;
  } | null = null;
  
  switch (provider) {
    case 'azure':
      providerConfig = createAzureConfig();
      break;
    case 'okta':
      providerConfig = createOktaConfig();
      break;
    case 'oidc':
      const issuerUrl = process.env.OIDC_ISSUER_URL;
      const clientId = process.env.OIDC_CLIENT_ID;
      const clientSecret = process.env.OIDC_CLIENT_SECRET;
      if (issuerUrl && clientId && clientSecret) {
        providerConfig = { issuerUrl, clientId, clientSecret };
      }
      break;
  }
  
  if (!providerConfig) {
    return null;
  }
  
  const preset = presets[provider];
  
  return {
    provider,
    issuerUrl: providerConfig.issuerUrl,
    clientId: providerConfig.clientId,
    clientSecret: providerConfig.clientSecret,
    redirectUri: `${baseUrl}/api/auth/sso/callback`,
    scopes: preset.defaultScopes,
    postLoginRedirect: frontendUrl,
    postLogoutRedirect: `${frontendUrl}/login`,
  };
}

export { azurePreset, oktaPreset };
export { createAzureConfig } from './azure.js';
export { createOktaConfig } from './okta.js';

