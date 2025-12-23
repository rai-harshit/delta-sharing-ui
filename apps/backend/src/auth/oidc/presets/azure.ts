/**
 * Azure AD / Microsoft Entra ID Preset
 * 
 * Pre-configured settings for Azure Active Directory authentication.
 * Supports group-based role mapping.
 */

import { OIDCPreset, OIDCUserInfo } from '../types.js';
import { logger } from '../../../utils/logger.js';

/**
 * Map Azure AD groups to application roles
 */
function mapAzureGroupsToRole(
  groups: string[],
  adminGroupId?: string
): string {
  // If an admin group is configured, check membership
  if (adminGroupId && groups.includes(adminGroupId)) {
    return 'admin';
  }
  
  // Default to viewer for SSO users without explicit admin group
  return 'viewer';
}

export const azurePreset: OIDCPreset = {
  name: 'azure',
  displayName: 'Microsoft Azure AD',
  logoUrl: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/media/howto-add-branding-in-azure-ad-apps/ms-symbollockup_mssymbol_19.png',
  
  /**
   * Construct Azure AD issuer URL from tenant ID
   * Format: https://login.microsoftonline.com/{tenantId}/v2.0
   */
  getIssuerUrl: (config: Record<string, string>) => {
    const tenantId = config.tenantId;
    if (!tenantId) {
      throw new Error('Azure AD tenant ID is required');
    }
    return `https://login.microsoftonline.com/${tenantId}/v2.0`;
  },
  
  /**
   * Default scopes for Azure AD
   * - openid, profile, email: Standard OIDC scopes
   * - User.Read: Access to user profile via Microsoft Graph
   * - offline_access: Refresh token support
   */
  defaultScopes: ['openid', 'profile', 'email', 'User.Read', 'offline_access'],
  
  /**
   * Map Azure AD claims to our user info format
   */
  mapClaims: (claims: Record<string, unknown>): OIDCUserInfo => {
    return {
      sub: String(claims.sub || claims.oid),
      email: (claims.preferred_username || claims.email || claims.upn) as string | undefined,
      name: claims.name as string | undefined,
      picture: undefined, // Azure AD doesn't include picture in token, need Graph API
      groups: extractAzureGroups(claims),
      roles: extractAzureRoles(claims),
      raw: claims,
    };
  },
  
  /**
   * Map Azure AD groups to admin role
   */
  mapGroupsToRole: (groups: string[], config: Record<string, string>): string => {
    return mapAzureGroupsToRole(groups, config.adminGroupId);
  },
  
  /**
   * Environment variable mapping
   */
  envMapping: {
    tenantId: 'AZURE_AD_TENANT_ID',
    clientId: 'AZURE_AD_CLIENT_ID',
    clientSecret: 'AZURE_AD_CLIENT_SECRET',
    adminGroupId: 'AZURE_AD_ADMIN_GROUP_ID',
  },
};

/**
 * Extract group IDs from Azure AD claims
 * 
 * Azure AD can include groups in the token if configured:
 * - groups: Array of group object IDs
 * - _claim_names/_claim_sources: For large group sets (overage scenario)
 */
function extractAzureGroups(claims: Record<string, unknown>): string[] {
  const groups: string[] = [];
  
  // Direct groups claim
  if (Array.isArray(claims.groups)) {
    groups.push(...claims.groups.map(String));
  }
  
  // Check for group overage (when user has too many groups)
  if (claims._claim_names && typeof claims._claim_names === 'object') {
    const claimNames = claims._claim_names as Record<string, string>;
    if (claimNames.groups) {
      // Groups are in a separate endpoint - would need Graph API call
      // For now, log a warning
      logger.warn('Azure AD group overage detected. Consider using application roles instead.');
    }
  }
  
  return groups;
}

/**
 * Extract application roles from Azure AD claims
 * 
 * If you configure app roles in Azure AD, they appear in the 'roles' claim
 */
function extractAzureRoles(claims: Record<string, unknown>): string[] {
  if (Array.isArray(claims.roles)) {
    return claims.roles.map(String);
  }
  return [];
}

/**
 * Create Azure AD OIDC configuration from environment variables
 */
export function createAzureConfig(): {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  adminGroupId?: string;
} | null {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  
  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }
  
  return {
    issuerUrl: azurePreset.getIssuerUrl({ tenantId }),
    clientId,
    clientSecret,
    adminGroupId: process.env.AZURE_AD_ADMIN_GROUP_ID,
  };
}

