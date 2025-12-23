/**
 * SSO Routes
 * 
 * Handles Single Sign-On authentication flows:
 * - GET /api/auth/sso/providers - List available SSO providers
 * - GET /api/auth/sso/:provider/login - Initiate SSO login
 * - GET /api/auth/sso/callback - Handle SSO callback
 * - POST /api/auth/sso/link - Link SSO to existing account
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { getJwtSecretCached, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { 
  OIDCClient, 
  createOIDCConfigFromEnv, 
  detectConfiguredProvider,
  presets,
  SSOProvider,
} from '../auth/index.js';

const router = Router();

// Initialize OIDC client if SSO is configured
let oidcClient: OIDCClient | null = null;

async function getOIDCClient(): Promise<OIDCClient | null> {
  if (oidcClient) return oidcClient;
  
  const config = createOIDCConfigFromEnv();
  if (!config) return null;
  
  oidcClient = new OIDCClient(config);
  await oidcClient.initialize();
  return oidcClient;
}

/**
 * GET /api/auth/sso/providers
 * 
 * Returns list of configured SSO providers
 */
router.get('/providers', async (_req: Request, res: Response) => {
  const providers: SSOProvider[] = [];
  
  const configuredProvider = detectConfiguredProvider();
  
  if (configuredProvider) {
    const preset = presets[configuredProvider];
    providers.push({
      name: configuredProvider,
      displayName: preset?.displayName || configuredProvider,
      logoUrl: preset?.logoUrl,
      enabled: true,
    });
  }
  
  res.json({
    success: true,
    providers,
    ssoEnabled: providers.length > 0,
  });
});

/**
 * GET /api/auth/sso/:provider/login
 * 
 * Initiates SSO login flow by redirecting to the identity provider
 */
router.get('/:provider/login', async (req: Request, res: Response, next) => {
  try {
    const { provider } = req.params;
    const { returnTo } = req.query;
    
    const configuredProvider = detectConfiguredProvider();
    
    if (!configuredProvider || configuredProvider !== provider) {
      throw createError(`SSO provider '${provider}' is not configured`, 400);
    }
    
    const client = await getOIDCClient();
    if (!client) {
      throw createError('SSO is not configured', 500);
    }
    
    const { url } = await client.getAuthorizationUrl(returnTo as string);
    
    logger.info('Initiating SSO login', { provider, returnTo });
    
    res.redirect(url);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/sso/callback
 * 
 * Handles the callback from the identity provider
 */
router.get('/callback', async (req: Request, res: Response, next) => {
  try {
    const { state, error, error_description } = req.query;
    
    // Check for error from provider
    if (error) {
      logger.error('SSO callback error from provider', { error, error_description });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error_description as string || error as string)}`);
    }
    
    if (!state) {
      throw createError('Missing state parameter', 400);
    }
    
    const client = await getOIDCClient();
    if (!client) {
      throw createError('SSO is not configured', 500);
    }
    
    // Build the callback URL
    const callbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Handle the callback
    const result = await client.handleCallback(callbackUrl, state as string);
    
    if (!result.success || !result.user) {
      logger.error('SSO callback failed', { error: result.error });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(result.error || 'Authentication failed')}`);
    }
    
    // Find or create user
    const provider = detectConfiguredProvider()!;
    const preset = presets[provider];
    
    // Determine role based on groups
    let role = 'viewer';
    if (preset.mapGroupsToRole && result.user.groups) {
      const config: Record<string, string> = {};
      if (process.env.AZURE_AD_ADMIN_GROUP_ID) {
        config.adminGroupId = process.env.AZURE_AD_ADMIN_GROUP_ID;
      }
      if (process.env.OKTA_ADMIN_GROUP) {
        config.adminGroup = process.env.OKTA_ADMIN_GROUP;
      }
      role = preset.mapGroupsToRole(result.user.groups, config);
    }
    
    // Find existing user by SSO subject or email
    let user = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { ssoProvider: provider, ssoSubject: result.user.sub },
          { email: result.user.email },
        ],
      },
    });
    
    if (user) {
      // Update SSO info if needed
      if (!user.ssoProvider) {
        user = await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            ssoProvider: provider,
            ssoSubject: result.user.sub,
            ssoMetadata: result.user.raw,
            lastLoginAt: new Date(),
          },
        });
      } else {
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    } else {
      // Create new user from SSO
      user = await prisma.adminUser.create({
        data: {
          email: result.user.email || `${result.user.sub}@sso.local`,
          name: result.user.name,
          role,
          ssoProvider: provider,
          ssoSubject: result.user.sub,
          ssoMetadata: result.user.raw,
          mustChangePassword: false, // SSO users don't need password change
          lastLoginAt: new Date(),
        },
      });
      
      logger.info('Created new user from SSO', { 
        userId: user.id, 
        email: user.email,
        provider,
      });
    }
    
    // Generate JWT token
    const jwtSecret = getJwtSecretCached();
    const token = jwt.sign(
      {
        adminId: user.id,
        email: user.email,
        name: user.name,
        role: 'admin',
        adminRole: user.role,
        ssoProvider: provider,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    // Set HttpOnly cookie for secure token storage
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
    
    // Redirect to frontend - cookie is set, just redirect to dashboard
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnTo = result.returnTo || '/dashboard';
    res.redirect(`${frontendUrl}${returnTo}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/sso/link
 * 
 * Links an SSO account to an existing local account
 * Requires authenticated session
 */
router.post('/link', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.adminId) {
      throw createError('Authentication required', 401);
    }
    
    const { ssoToken } = req.body;
    if (!ssoToken) {
      throw createError('SSO token is required', 400);
    }
    
    // Verify the SSO token
    const jwtSecret = getJwtSecretCached();
    let decoded;
    try {
      decoded = jwt.verify(ssoToken, jwtSecret) as { 
        ssoProvider: string; 
        email: string;
      };
    } catch {
      throw createError('Invalid SSO token', 400);
    }
    
    // Update the user with SSO info
    await prisma.adminUser.update({
      where: { id: authReq.user.adminId },
      data: {
        ssoProvider: decoded.ssoProvider,
        // Note: We'd need the SSO subject from a proper flow
      },
    });
    
    res.json({
      success: true,
      message: 'SSO account linked successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/sso/logout
 * 
 * Handles SSO logout (if provider supports it)
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const client = await getOIDCClient();
    
    if (client) {
      const logoutUrl = await client.getLogoutUrl();
      res.json({
        success: true,
        logoutUrl,
      });
    } else {
      res.json({
        success: true,
        logoutUrl: null,
      });
    }
  } catch (error) {
    next(error);
  }
});

export { router as ssoRoutes };

