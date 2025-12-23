import { prisma } from '../db/client.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

export interface CreateRecipientInput {
  name: string;
  email?: string;
  comment?: string;
  shareIds?: string[];
}

export interface RecipientCredential {
  shareCredentialsVersion: number;
  endpoint: string;
  bearerToken: string;
  expirationTime: string | null;
}

// Generate a secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage (we store hash, return plain to user once)
async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

// Verify a token against its hash
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

export const recipientService = {
  async createRecipient(data: CreateRecipientInput, endpoint: string) {
    // Generate bearer token
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const tokenHint = plainToken.substring(0, 8);

    // Verify hash immediately to catch any bcrypt issues
    const hashVerified = await verifyToken(plainToken, tokenHash);
    if (!hashVerified) {
      logger.error('CRITICAL: Token hash verification failed immediately after creation', undefined, {
        action: 'TokenCreate',
        recipientName: data.name,
      });
      throw new Error('Token creation failed - hash verification error');
    }

    // Calculate expiration (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    logger.info('Creating recipient with token', {
      action: 'TokenCreate',
      recipientName: data.name,
      tokenHint,
      expiresAt: expiresAt.toISOString(),
    });

    // Create recipient with token in a transaction
    const recipient = await prisma.$transaction(async (tx) => {
      // Create recipient
      const newRecipient = await tx.recipient.create({
        data: {
          name: data.name,
          email: data.email,
          comment: data.comment,
        },
      });

      // Create token
      await tx.recipientToken.create({
        data: {
          recipientId: newRecipient.id,
          token: tokenHash,
          tokenHint,
          expiresAt,
          isActive: true,
        },
      });

      // Grant access to shares if provided
      if (data.shareIds && data.shareIds.length > 0) {
        // Find shares by id or name
        const shares = await tx.share.findMany({
          where: {
            OR: data.shareIds.flatMap(id => [
              { id },
              { name: id },
            ]),
          },
        });

        await tx.accessGrant.createMany({
          data: shares.map(share => ({
            recipientId: newRecipient.id,
            shareId: share.id,
          })),
        });
      }

      return newRecipient;
    });

    // Return recipient and credential
    const credential: RecipientCredential = {
      shareCredentialsVersion: 1,
      endpoint,
      bearerToken: plainToken,
      expirationTime: expiresAt.toISOString(),
    };

    return { recipient, credential };
  },

  async getRecipient(id: string) {
    return prisma.recipient.findFirst({
      where: {
        OR: [{ id }, { name: id }],
      },
      include: {
        tokens: {
          where: { isActive: true },
          select: {
            id: true,
            tokenHint: true,
            expiresAt: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
        accessGrants: {
          include: {
            share: true,
          },
          orderBy: {
            grantedAt: 'desc',
          },
        },
      },
    });
  },

  async listRecipients() {
    return prisma.recipient.findMany({
      include: {
        tokens: {
          where: { isActive: true },
          select: {
            tokenHint: true,
            expiresAt: true,
          },
        },
        accessGrants: {
          include: {
            share: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            grantedAt: 'desc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateRecipient(id: string, data: { email?: string; comment?: string }) {
    return prisma.recipient.update({
      where: { id },
      data,
    });
  },

  async deleteRecipient(id: string) {
    return prisma.recipient.delete({
      where: { id },
    });
  },

  // Grant access to a share
  async grantAccess(
    recipientId: string, 
    shareId: string, 
    grantedBy?: string, 
    expiresAt?: Date,
    options?: {
      canDownload?: boolean;
      canQuery?: boolean;
      maxRowsPerQuery?: number;
    }
  ) {
    // Find the share by id or name
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareId }, { name: shareId }],
      },
    });

    if (!share) {
      throw new Error('Share not found');
    }

    return prisma.accessGrant.upsert({
      where: {
        recipientId_shareId: {
          recipientId,
          shareId: share.id,
        },
      },
      update: {
        expiresAt,
        grantedBy,
        grantedAt: new Date(),
        // Only update these fields if explicitly provided (to avoid overwriting existing values)
        ...(options?.canDownload !== undefined && { canDownload: options.canDownload }),
        ...(options?.canQuery !== undefined && { canQuery: options.canQuery }),
        ...(options?.maxRowsPerQuery !== undefined && { maxRowsPerQuery: options.maxRowsPerQuery }),
      },
      create: {
        recipientId,
        shareId: share.id,
        grantedBy,
        expiresAt,
        canDownload: options?.canDownload ?? true,
        canQuery: options?.canQuery ?? true,
        maxRowsPerQuery: options?.maxRowsPerQuery,
      },
    });
  },

  // Revoke access to a share
  async revokeAccess(recipientId: string, shareId: string) {
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareId }, { name: shareId }],
      },
    });

    if (!share) return;

    await prisma.accessGrant.deleteMany({
      where: {
        recipientId,
        shareId: share.id,
      },
    });
  },

  // Update access grant settings
  async updateAccessGrant(
    recipientId: string,
    shareId: string,
    data: {
      expiresAt?: Date | null;
      canDownload?: boolean;
      canQuery?: boolean;
      maxRowsPerQuery?: number | null;
    }
  ) {
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareId }, { name: shareId }],
      },
    });

    if (!share) {
      throw new Error('Share not found');
    }

    // Build update data, only including fields that were explicitly provided
    const updateData: Record<string, unknown> = {};
    
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt;
    }
    if (data.canDownload !== undefined) {
      updateData.canDownload = data.canDownload;
    }
    if (data.canQuery !== undefined) {
      updateData.canQuery = data.canQuery;
    }
    if (data.maxRowsPerQuery !== undefined) {
      updateData.maxRowsPerQuery = data.maxRowsPerQuery;
    }

    return prisma.accessGrant.update({
      where: {
        recipientId_shareId: {
          recipientId,
          shareId: share.id,
        },
      },
      data: updateData,
    });
  },

  // Update recipient's share access (replace all grants)
  async updateShareAccess(recipientId: string, shareIds: string[]) {
    // Find all shares by id or name
    const shares = await prisma.share.findMany({
      where: {
        OR: shareIds.flatMap(id => [
          { id },
          { name: id },
        ]),
      },
    });

    await prisma.$transaction(async (tx) => {
      // Remove all existing grants
      await tx.accessGrant.deleteMany({
        where: { recipientId },
      });

      // Create new grants
      if (shares.length > 0) {
        await tx.accessGrant.createMany({
          data: shares.map(share => ({
            recipientId,
            shareId: share.id,
          })),
        });
      }
    });
  },

  // Rotate token - invalidate old, create new
  async rotateToken(recipientId: string, endpoint: string) {
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const tokenHint = plainToken.substring(0, 8);

    // Verify hash immediately to catch any bcrypt issues
    const hashVerified = await verifyToken(plainToken, tokenHash);
    if (!hashVerified) {
      logger.error('CRITICAL: Token hash verification failed during rotation', undefined, {
        action: 'TokenRotate',
        recipientId,
      });
      throw new Error('Token rotation failed - hash verification error');
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Get old tokens for logging
    const oldTokens = await prisma.recipientToken.findMany({
      where: { recipientId, isActive: true },
    });
    logger.info('Rotating token for recipient', {
      action: 'TokenRotate',
      recipientId,
      deactivatedTokens: oldTokens.length,
      newTokenHint: tokenHint,
      expiresAt: expiresAt.toISOString(),
    });

    await prisma.$transaction(async (tx) => {
      // Deactivate all existing tokens
      await tx.recipientToken.updateMany({
        where: { recipientId },
        data: { isActive: false },
      });

      // Create new token
      await tx.recipientToken.create({
        data: {
          recipientId,
          token: tokenHash,
          tokenHint,
          expiresAt,
          isActive: true,
        },
      });
    });

    logger.info('Token rotation complete', { action: 'TokenRotate', recipientId });

    const credential: RecipientCredential = {
      shareCredentialsVersion: 1,
      endpoint,
      bearerToken: plainToken,
      expirationTime: expiresAt.toISOString(),
    };

    return credential;
  },

  // Validate a bearer token and return the recipient
  async validateToken(bearerToken: string) {
    const tokenHint = bearerToken.substring(0, 8);
    const now = new Date();
    
    logger.debug('Validating token', { action: 'TokenValidation', tokenHint });

    // First, get ALL tokens for this hint to debug
    const allTokensForHint = await prisma.recipientToken.findMany({
      where: {
        tokenHint,
      },
      include: {
        recipient: true,
      },
    });

    if (allTokensForHint.length > 0) {
      for (const t of allTokensForHint) {
        logger.debug('Found token for hint', {
          action: 'TokenValidation',
          tokenHint,
          recipientName: t.recipient.name,
          isActive: t.isActive,
          expiresAt: t.expiresAt?.toISOString() || 'never',
          isExpired: t.expiresAt ? t.expiresAt < now : false,
        });
      }
    } else {
      logger.debug('No tokens found with hint', { action: 'TokenValidation', tokenHint });
    }

    // Get all active, non-expired tokens
    const tokens = await prisma.recipientToken.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        recipient: true,
      },
    });

    logger.debug('Active tokens in database', { action: 'TokenValidation', count: tokens.length });

    // Check each token (we have to do this because tokens are hashed)
    for (const tokenRecord of tokens) {
      const isValid = await verifyToken(bearerToken, tokenRecord.token);
      if (isValid) {
        logger.info('Token validated successfully', {
          action: 'TokenValidation',
          recipientName: tokenRecord.recipient.name,
          recipientId: tokenRecord.recipientId,
        });
        
        // Update last used timestamp
        await prisma.recipientToken.update({
          where: { id: tokenRecord.id },
          data: { lastUsedAt: new Date() },
        });

        return tokenRecord.recipient;
      }
    }

    logger.warn('Token validation failed - no matching token', {
      action: 'TokenValidation',
      tokenHint,
    });
    return null;
  },

  // Get credential for a recipient (for display purposes - token is masked)
  async getCredential(recipientId: string, endpoint: string) {
    const token = await prisma.recipientToken.findFirst({
      where: {
        recipientId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      return null;
    }

    return {
      shareCredentialsVersion: 1,
      endpoint,
      bearerToken: `${token.tokenHint}${'*'.repeat(56)}`, // Masked with ASCII-safe asterisks
      expirationTime: token.expiresAt?.toISOString() || null,
      tokenHint: token.tokenHint,
    };
  },
};


