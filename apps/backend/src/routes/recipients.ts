import { Router, Response, NextFunction } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { 
  requirePermission,
  Permissions,
  AuthenticatedRequest 
} from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { recipientService } from '../services/recipientService.js';
import { configSyncService } from '../services/configSyncService.js';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';

const router: RouterType = Router();

// Helper to construct the Delta Sharing endpoint URL
function getEndpointUrl(req: AuthenticatedRequest): string {
  // Check for environment variable first (for hybrid mode, points to /delta)
  if (process.env.DELTA_SHARING_ENDPOINT) {
    return process.env.DELTA_SHARING_ENDPOINT;
  }
  
  // If user is a recipient, use their serverUrl
  if (req.user?.serverUrl) {
    return req.user.serverUrl;
  }
  
  // Construct from request
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
  
  // In hybrid mode, endpoint should be /delta (handled by OSS server via nginx)
  if (configSyncService.isHybridMode()) {
    return `${protocol}://${host}/delta`;
  }
  
  // Standalone mode uses built-in protocol handler
  return `${protocol}://${host}/api/delta`;
}

// List all recipients
router.get('/', requirePermission(Permissions.RECIPIENTS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipients = await recipientService.listRecipients();

    res.json({
      success: true,
      data: recipients.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        shares: r.accessGrants.map(g => g.share.name),
        accessGrants: r.accessGrants.map(g => ({
          shareId: g.share.id,
          shareName: g.share.name,
          grantedAt: g.grantedAt?.toISOString(),
          expiresAt: g.expiresAt?.toISOString() || null,
          canDownload: g.canDownload,
          canQuery: g.canQuery,
          maxRowsPerQuery: g.maxRowsPerQuery,
        })),
        tokenHint: r.tokens[0]?.tokenHint,
        tokenExpires: r.tokens[0]?.expiresAt?.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get recipient details
router.get('/:recipientId', requirePermission(Permissions.RECIPIENTS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;
    const recipient = await recipientService.getRecipient(recipientId);

    if (!recipient) {
      throw createError('Recipient not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        comment: recipient.comment,
        createdAt: recipient.createdAt.toISOString(),
        shares: recipient.accessGrants.map(g => g.share.name),
        accessGrants: recipient.accessGrants.map(g => ({
          shareId: g.share.id,
          shareName: g.share.name,
          grantedAt: g.grantedAt.toISOString(),
          expiresAt: g.expiresAt?.toISOString() || null,
          canDownload: g.canDownload,
          canQuery: g.canQuery,
          maxRowsPerQuery: g.maxRowsPerQuery,
        })),
        token: recipient.tokens[0] ? {
          hint: recipient.tokens[0].tokenHint,
          expiresAt: recipient.tokens[0].expiresAt?.toISOString(),
          createdAt: recipient.tokens[0].createdAt.toISOString(),
          lastUsedAt: recipient.tokens[0].lastUsedAt?.toISOString(),
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create a new recipient
const createRecipientSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Recipient name must be alphanumeric with underscores'),
  email: z.string().email().optional().or(z.literal('')),
  comment: z.string().optional(),
  shares: z.array(z.string()).optional(),
});

router.post('/', requirePermission(Permissions.RECIPIENTS_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = createRecipientSchema.parse(req.body);
    
    const { recipient, credential } = await recipientService.createRecipient(
      {
        name: data.name,
        email: data.email || undefined,
        comment: data.comment,
        shareIds: data.shares,
      },
      getEndpointUrl(req)
    );

    // Sync tokens to OSS server (if in hybrid mode)
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onRecipientCreated({
      id: recipient.id,
      name: recipient.name,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.status(201).json({
      success: true,
      data: {
        recipient: {
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
          createdAt: recipient.createdAt.toISOString(),
        },
        credential,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    if ((error as any)?.code === 'P2002') {
      return next(createError('Recipient with this name already exists', 409));
    }
    next(error);
  }
});

// Update recipient
const updateRecipientSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  comment: z.string().optional(),
  shares: z.array(z.string()).optional(),
});

router.put('/:recipientId', requirePermission(Permissions.RECIPIENTS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;
    const data = updateRecipientSchema.parse(req.body);

    // Get recipient first
    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    // Update basic info
    if (data.email !== undefined || data.comment !== undefined) {
      await recipientService.updateRecipient(existing.id, {
        email: data.email || undefined,
        comment: data.comment,
      });
    }

    // Update share access if provided
    if (data.shares !== undefined) {
      await recipientService.updateShareAccess(existing.id, data.shares);
      // Sync tokens to OSS server (if in hybrid mode) - access grants changed
      configSyncService.sync().catch(err => logger.error('Config sync failed', err));
    }

    // Get updated recipient
    const recipient = await recipientService.getRecipient(existing.id);

    res.json({
      success: true,
      data: {
        id: recipient!.id,
        name: recipient!.name,
        email: recipient!.email,
        shares: recipient!.accessGrants.map(g => g.share.name),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

// Rotate recipient token
router.post('/:recipientId/token/rotate', requirePermission(Permissions.RECIPIENTS_ROTATE_TOKEN), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    const credential = await recipientService.rotateToken(existing.id, getEndpointUrl(req));

    // Sync tokens to OSS server (if in hybrid mode) - token rotated
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onTokenRotated({
      id: existing.id,
      name: existing.name,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.json({
      success: true,
      data: {
        recipient: {
          id: existing.id,
          name: existing.name,
        },
        credential,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get recipient credential
router.get('/:recipientId/credential', requirePermission(Permissions.RECIPIENTS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    const credential = await recipientService.getCredential(existing.id, getEndpointUrl(req));
    if (!credential) {
      throw createError('No active token found', 404);
    }

    res.json({
      success: true,
      data: credential,
    });
  } catch (error) {
    next(error);
  }
});

// Grant access to a share with optional expiration
const grantAccessSchema = z.object({
  shareId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  // Permission flags
  canDownload: z.boolean().optional().default(true),
  canQuery: z.boolean().optional().default(true),
  maxRowsPerQuery: z.number().int().positive().optional(),
});

router.post('/:recipientId/access', requirePermission(Permissions.RECIPIENTS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;
    const data = grantAccessSchema.parse(req.body);

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    await recipientService.grantAccess(
      existing.id,
      data.shareId,
      req.user?.adminId,
      data.expiresAt ? new Date(data.expiresAt) : undefined,
      {
        canDownload: data.canDownload,
        canQuery: data.canQuery,
        maxRowsPerQuery: data.maxRowsPerQuery,
      }
    );

    // Sync tokens to OSS server (if in hybrid mode) - access grant added
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    const recipient = await recipientService.getRecipient(existing.id);

    // Send webhook notification - find the granted share
    const grantedShare = recipient!.accessGrants.find(g => g.share.id === data.shareId);
    if (grantedShare) {
      webhookService.onAccessGranted({
        recipientId: existing.id,
        recipientName: existing.name,
        shareId: grantedShare.share.id,
        shareName: grantedShare.share.name,
      }).catch(err => logger.error('Webhook notification failed', err));
    }

    res.json({
      success: true,
      data: {
        shares: recipient!.accessGrants.map(g => ({
          id: g.share.id,
          name: g.share.name,
          grantedAt: g.grantedAt.toISOString(),
          expiresAt: g.expiresAt?.toISOString() || null,
          canDownload: g.canDownload,
          canQuery: g.canQuery,
          maxRowsPerQuery: g.maxRowsPerQuery,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

// Update access grant settings
const updateAccessSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
  canDownload: z.boolean().optional(),
  canQuery: z.boolean().optional(),
  maxRowsPerQuery: z.number().int().positive().optional().nullable(),
});

router.put('/:recipientId/access/:shareId', requirePermission(Permissions.RECIPIENTS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId, shareId } = req.params;
    const data = updateAccessSchema.parse(req.body);

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    // Find the existing grant
    const existingGrant = existing.accessGrants.find(g => g.share.id === shareId);
    if (!existingGrant) {
      throw createError('Access grant not found', 404);
    }

    await recipientService.updateAccessGrant(
      existing.id,
      shareId,
      {
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : (data.expiresAt === null ? null : undefined),
        canDownload: data.canDownload,
        canQuery: data.canQuery,
        maxRowsPerQuery: data.maxRowsPerQuery === null ? null : data.maxRowsPerQuery,
      }
    );

    // Sync tokens to OSS server (if in hybrid mode) - access grant updated
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    const recipient = await recipientService.getRecipient(existing.id);
    const updatedGrant = recipient!.accessGrants.find(g => g.share.id === shareId);

    res.json({
      success: true,
      data: {
        grant: updatedGrant ? {
          shareId: updatedGrant.share.id,
          shareName: updatedGrant.share.name,
          grantedAt: updatedGrant.grantedAt.toISOString(),
          expiresAt: updatedGrant.expiresAt?.toISOString() || null,
          canDownload: updatedGrant.canDownload,
          canQuery: updatedGrant.canQuery,
          maxRowsPerQuery: updatedGrant.maxRowsPerQuery,
        } : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

// Revoke access to a share
router.delete('/:recipientId/access/:shareId', requirePermission(Permissions.RECIPIENTS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId, shareId } = req.params;

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    // Get share name before revoking for webhook
    const revokedGrant = existing.accessGrants.find(g => g.share.id === shareId);
    const shareName = revokedGrant?.share.name || shareId;

    await recipientService.revokeAccess(existing.id, shareId);

    // Sync tokens to OSS server (if in hybrid mode) - access grant removed
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onAccessRevoked({
      recipientId: existing.id,
      recipientName: existing.name,
      shareId,
      shareName,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.json({
      success: true,
      message: `Access to share ${shareId} revoked`,
    });
  } catch (error) {
    next(error);
  }
});

// Debug endpoint: Get all tokens for a recipient (for troubleshooting)
router.get('/:recipientId/tokens/debug', requirePermission(Permissions.RECIPIENTS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;

    const recipient = await recipientService.getRecipient(recipientId);
    if (!recipient) {
      throw createError('Recipient not found', 404);
    }

    // Get ALL tokens for this recipient (including inactive and expired)
    const { prisma } = await import('../db/client.js');
    
    const allTokens = await prisma.recipientToken.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    
    res.json({
      success: true,
      data: {
        recipientId,
        recipientName: recipient.name,
        currentTime: now.toISOString(),
        tokens: allTokens.map(t => ({
          id: t.id,
          tokenHint: t.tokenHint,
          isActive: t.isActive,
          expiresAt: t.expiresAt?.toISOString() || null,
          isExpired: t.expiresAt ? t.expiresAt < now : false,
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() || null,
          status: !t.isActive ? 'INACTIVE' : (t.expiresAt && t.expiresAt < now) ? 'EXPIRED' : 'VALID',
        })),
        summary: {
          total: allTokens.length,
          active: allTokens.filter(t => t.isActive).length,
          valid: allTokens.filter(t => t.isActive && (!t.expiresAt || t.expiresAt > now)).length,
          expired: allTokens.filter(t => t.expiresAt && t.expiresAt < now).length,
          inactive: allTokens.filter(t => !t.isActive).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Debug endpoint: Test token validation
router.post('/debug/validate-token', requirePermission(Permissions.RECIPIENTS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw createError('Token is required in request body', 400);
    }

    logger.debug('Testing token validation', { tokenHint: token.substring(0, 8) });
    
    const recipient = await recipientService.validateToken(token);
    
    if (recipient) {
      res.json({
        success: true,
        valid: true,
        recipient: {
          id: recipient.id,
          name: recipient.name,
        },
        message: 'Token is valid',
      });
    } else {
      res.json({
        success: true,
        valid: false,
        recipient: null,
        message: 'Token validation failed - see server logs for details',
      });
    }
  } catch (error) {
    next(error);
  }
});

// Delete recipient
router.delete('/:recipientId', requirePermission(Permissions.RECIPIENTS_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = req.params;

    const existing = await recipientService.getRecipient(recipientId);
    if (!existing) {
      throw createError('Recipient not found', 404);
    }

    const recipientName = existing.name;
    
    await recipientService.deleteRecipient(existing.id);

    // Sync tokens to OSS server (if in hybrid mode) - recipient removed
    configSyncService.sync().catch(err => logger.error('Config sync failed', err));

    // Send webhook notification
    webhookService.onRecipientDeleted({
      id: existing.id,
      name: recipientName,
    }).catch(err => logger.error('Webhook notification failed', err));

    res.json({
      success: true,
      message: `Recipient ${recipientName} deleted`,
    });
  } catch (error) {
    next(error);
  }
});

export { router as recipientsRoutes };
