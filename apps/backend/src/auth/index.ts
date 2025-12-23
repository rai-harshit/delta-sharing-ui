/**
 * Authentication Module
 * 
 * Exports all authentication-related components:
 * - OIDC client and configuration
 * - Provider presets (Azure, Okta, Generic)
 * - SSO utilities
 */

export * from './oidc/types.js';
export * from './oidc/client.js';
export * from './oidc/presets/index.js';


