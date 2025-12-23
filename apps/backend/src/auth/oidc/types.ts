/**
 * OIDC Types and Interfaces
 */

export interface OIDCConfig {
  provider: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  postLoginRedirect: string;
  postLogoutRedirect: string;
}

export interface OIDCUserInfo {
  sub: string;          // Unique identifier from provider
  email?: string;
  name?: string;
  picture?: string;
  groups?: string[];    // Group memberships
  roles?: string[];     // Role claims
  raw?: Record<string, unknown>; // Raw claims
}

export interface OIDCPreset {
  name: string;
  displayName: string;
  logoUrl?: string;
  
  /**
   * Construct the issuer URL from provider-specific config
   */
  getIssuerUrl: (config: Record<string, string>) => string;
  
  /**
   * Default scopes to request
   */
  defaultScopes: string[];
  
  /**
   * Map provider claims to our user info format
   */
  mapClaims: (claims: Record<string, unknown>) => OIDCUserInfo;
  
  /**
   * Map groups to admin role
   */
  mapGroupsToRole?: (groups: string[], config: Record<string, string>) => string;
  
  /**
   * Environment variable mapping
   */
  envMapping: Record<string, string>;
}

export interface OIDCSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: Date;
}

export interface OIDCCallbackResult {
  success: boolean;
  user?: OIDCUserInfo;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken: string;
    expiresAt: Date;
  };
  error?: string;
}

export interface SSOProvider {
  name: string;
  displayName: string;
  logoUrl?: string;
  enabled: boolean;
}


