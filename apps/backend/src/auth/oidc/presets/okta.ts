/**
 * Okta Preset
 * 
 * Pre-configured settings for Okta authentication.
 * Supports group-based role mapping.
 */

import { OIDCPreset, OIDCUserInfo } from '../types.js';

/**
 * Map Okta groups to application roles
 */
function mapOktaGroupsToRole(
  groups: string[],
  adminGroup?: string
): string {
  // If an admin group is configured, check membership
  if (adminGroup && groups.includes(adminGroup)) {
    return 'admin';
  }
  
  // Check for common admin group names
  const adminGroups = ['DeltaSharingAdmins', 'Administrators', 'admins', 'Admin'];
  if (groups.some(g => adminGroups.includes(g))) {
    return 'admin';
  }
  
  // Check for editor group names
  const editorGroups = ['DeltaSharingEditors', 'Editors', 'editors'];
  if (groups.some(g => editorGroups.includes(g))) {
    return 'editor';
  }
  
  // Default to viewer for SSO users
  return 'viewer';
}

export const oktaPreset: OIDCPreset = {
  name: 'okta',
  displayName: 'Okta',
  logoUrl: 'https://www.okta.com/sites/default/files/Okta_Logo_BrightBlue_Medium.png',
  
  /**
   * Construct Okta issuer URL from domain
   * Format: https://{domain}/oauth2/default
   * 
   * Note: For custom authorization servers, the URL might be different:
   * https://{domain}/oauth2/{authServerId}
   */
  getIssuerUrl: (config: Record<string, string>) => {
    const domain = config.domain;
    if (!domain) {
      throw new Error('Okta domain is required');
    }
    // Remove protocol if included
    const cleanDomain = domain.replace(/^https?:\/\//, '');
    const authServerId = config.authServerId || 'default';
    return `https://${cleanDomain}/oauth2/${authServerId}`;
  },
  
  /**
   * Default scopes for Okta
   * - openid, profile, email: Standard OIDC scopes
   * - groups: Include group memberships in token
   * - offline_access: Refresh token support
   */
  defaultScopes: ['openid', 'profile', 'email', 'groups', 'offline_access'],
  
  /**
   * Map Okta claims to our user info format
   */
  mapClaims: (claims: Record<string, unknown>): OIDCUserInfo => {
    return {
      sub: String(claims.sub),
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      picture: claims.picture as string | undefined,
      groups: extractOktaGroups(claims),
      roles: extractOktaRoles(claims),
      raw: claims,
    };
  },
  
  /**
   * Map Okta groups to admin role
   */
  mapGroupsToRole: (groups: string[], config: Record<string, string>): string => {
    return mapOktaGroupsToRole(groups, config.adminGroup);
  },
  
  /**
   * Environment variable mapping
   */
  envMapping: {
    domain: 'OKTA_DOMAIN',
    clientId: 'OKTA_CLIENT_ID',
    clientSecret: 'OKTA_CLIENT_SECRET',
    adminGroup: 'OKTA_ADMIN_GROUP',
    authServerId: 'OKTA_AUTH_SERVER_ID',
  },
};

/**
 * Extract groups from Okta claims
 * 
 * Okta includes groups in the 'groups' claim when the groups scope is requested
 */
function extractOktaGroups(claims: Record<string, unknown>): string[] {
  if (Array.isArray(claims.groups)) {
    return claims.groups.map(String);
  }
  return [];
}

/**
 * Extract custom roles from Okta claims
 * 
 * If you configure custom claims in Okta, they can appear here
 */
function extractOktaRoles(claims: Record<string, unknown>): string[] {
  // Check for custom roles claim
  if (Array.isArray(claims.roles)) {
    return claims.roles.map(String);
  }
  // Check for app-specific roles
  if (Array.isArray(claims.appRoles)) {
    return claims.appRoles.map(String);
  }
  return [];
}

/**
 * Create Okta OIDC configuration from environment variables
 */
export function createOktaConfig(): {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  adminGroup?: string;
} | null {
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.OKTA_CLIENT_ID;
  const clientSecret = process.env.OKTA_CLIENT_SECRET;
  
  if (!domain || !clientId || !clientSecret) {
    return null;
  }
  
  return {
    issuerUrl: oktaPreset.getIssuerUrl({ 
      domain,
      authServerId: process.env.OKTA_AUTH_SERVER_ID || 'default',
    }),
    clientId,
    clientSecret,
    adminGroup: process.env.OKTA_ADMIN_GROUP,
  };
}


