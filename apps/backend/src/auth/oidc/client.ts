/**
 * Generic OIDC Client
 * 
 * Provides OpenID Connect authentication using the openid-client library.
 * Works with any OIDC-compliant identity provider.
 * 
 * Sessions are stored in Redis for clustered deployments (falls back to in-memory).
 */

import { Issuer, Client, generators, TokenSet } from 'openid-client';
import { OIDCConfig, OIDCSession, OIDCCallbackResult, OIDCUserInfo } from './types.js';
import { logger } from '../../utils/logger.js';
import { cache } from '../../cache/redis.js';

// Session key prefix
const SESSION_PREFIX = 'oidc:session:';
const SESSION_TTL = 600; // 10 minutes in seconds

export class OIDCClient {
  private config: OIDCConfig;
  private client: Client | null = null;
  private initialized = false;

  constructor(config: OIDCConfig) {
    this.config = config;
  }

  /**
   * Initialize the OIDC client by discovering the issuer
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing OIDC client', {
        provider: this.config.provider,
        issuerUrl: this.config.issuerUrl,
      });

      const issuer = await Issuer.discover(this.config.issuerUrl);
      
      this.client = new issuer.Client({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uris: [this.config.redirectUri],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      });

      this.initialized = true;
      logger.info('OIDC client initialized successfully', {
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to initialize OIDC client', error);
      throw error;
    }
  }

  /**
   * Generate the authorization URL for login
   */
  async getAuthorizationUrl(returnTo?: string): Promise<{
    url: string;
    state: string;
  }> {
    await this.ensureInitialized();

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Store session in Redis (or in-memory fallback) with TTL
    const session: OIDCSession = {
      state,
      nonce,
      codeVerifier,
      returnTo: returnTo || this.config.postLoginRedirect,
      createdAt: new Date(),
    };
    
    await cache.setJSON(`${SESSION_PREFIX}${state}`, session, { ttl: SESSION_TTL });

    const url = this.client!.authorizationUrl({
      scope: this.config.scopes.join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    logger.debug('Generated authorization URL', { state, returnTo });

    return { url, state };
  }

  /**
   * Handle the callback from the identity provider
   */
  async handleCallback(
    callbackUrl: string,
    state: string
  ): Promise<OIDCCallbackResult> {
    await this.ensureInitialized();

    // Retrieve session from Redis/cache
    const session = await cache.getJSON<OIDCSession>(`${SESSION_PREFIX}${state}`);
    if (!session) {
      logger.warn('Invalid or expired OIDC session', { state });
      return {
        success: false,
        error: 'Invalid or expired session. Please try logging in again.',
      };
    }

    // Remove session (single use) - Redis TTL will also clean it up
    await cache.del(`${SESSION_PREFIX}${state}`);

    try {
      // Parse the callback URL
      const params = this.client!.callbackParams(callbackUrl);

      // Exchange code for tokens
      const tokenSet = await this.client!.callback(
        this.config.redirectUri,
        params,
        {
          state: session.state,
          nonce: session.nonce,
          code_verifier: session.codeVerifier,
        }
      );

      // Get user info
      const userInfo = await this.getUserInfo(tokenSet);

      logger.info('OIDC callback successful', {
        sub: userInfo.sub,
        email: userInfo.email,
        provider: this.config.provider,
      });

      return {
        success: true,
        user: userInfo,
        tokens: {
          accessToken: tokenSet.access_token!,
          refreshToken: tokenSet.refresh_token,
          idToken: tokenSet.id_token!,
          expiresAt: new Date(Date.now() + (tokenSet.expires_in || 3600) * 1000),
        },
      };
    } catch (error) {
      logger.error('OIDC callback failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Get user info from tokens
   */
  private async getUserInfo(tokenSet: TokenSet): Promise<OIDCUserInfo> {
    const claims = tokenSet.claims();
    
    // Try to get additional user info from userinfo endpoint
    let userInfoClaims: Record<string, unknown> = {};
    try {
      if (tokenSet.access_token) {
        userInfoClaims = await this.client!.userinfo(tokenSet.access_token);
      }
    } catch (error) {
      logger.warn('Failed to fetch userinfo', error);
    }

    // Merge claims
    const allClaims = { ...claims, ...userInfoClaims };

    return {
      sub: String(allClaims.sub),
      email: allClaims.email as string | undefined,
      name: allClaims.name as string | undefined,
      picture: allClaims.picture as string | undefined,
      groups: this.extractGroups(allClaims),
      roles: this.extractRoles(allClaims),
      raw: allClaims,
    };
  }

  /**
   * Extract groups from claims (varies by provider)
   */
  private extractGroups(claims: Record<string, unknown>): string[] {
    // Common group claim names
    const groupClaims = ['groups', 'group', 'memberOf', 'roles'];
    
    for (const claimName of groupClaims) {
      const value = claims[claimName];
      if (Array.isArray(value)) {
        return value.map(String);
      }
      if (typeof value === 'string') {
        return [value];
      }
    }
    
    return [];
  }

  /**
   * Extract roles from claims
   */
  private extractRoles(claims: Record<string, unknown>): string[] {
    const roles = claims.roles || claims.role;
    if (Array.isArray(roles)) {
      return roles.map(String);
    }
    if (typeof roles === 'string') {
      return [roles];
    }
    return [];
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<TokenSet | null> {
    await this.ensureInitialized();

    try {
      return await this.client!.refresh(refreshToken);
    } catch (error) {
      logger.error('Token refresh failed', error);
      return null;
    }
  }

  /**
   * Generate logout URL
   */
  async getLogoutUrl(idToken?: string): Promise<string> {
    await this.ensureInitialized();

    if (this.client!.issuer.metadata.end_session_endpoint) {
      const params: Record<string, string> = {
        post_logout_redirect_uri: this.config.postLogoutRedirect,
      };
      
      if (idToken) {
        params.id_token_hint = idToken;
      }

      const url = new URL(this.client!.issuer.metadata.end_session_endpoint);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      return url.toString();
    }

    // Fallback to local logout
    return this.config.postLogoutRedirect;
  }

  /**
   * Ensure the client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.client) {
      throw new Error('OIDC client not initialized');
    }
  }
}

/**
 * Create an OIDC client from environment variables
 */
export function createOIDCClientFromEnv(): OIDCClient | null {
  const issuerUrl = process.env.OIDC_ISSUER_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;

  if (!issuerUrl || !clientId || !clientSecret) {
    return null;
  }

  const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
  
  return new OIDCClient({
    provider: 'oidc',
    issuerUrl,
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/auth/sso/callback`,
    scopes: (process.env.OIDC_SCOPES || 'openid,profile,email').split(','),
    postLoginRedirect: process.env.POST_LOGIN_REDIRECT || '/',
    postLogoutRedirect: process.env.POST_LOGOUT_REDIRECT || '/login',
  });
}
