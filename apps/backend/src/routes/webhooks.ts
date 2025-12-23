/**
 * Webhook Management Routes
 * 
 * CRUD endpoints for managing webhook configurations:
 * - GET /api/webhooks - List all webhooks
 * - GET /api/webhooks/:id - Get webhook details
 * - POST /api/webhooks - Create new webhook
 * - PUT /api/webhooks/:id - Update webhook
 * - DELETE /api/webhooks/:id - Delete webhook
 * - POST /api/webhooks/:id/test - Send test event
 * - GET /api/webhooks/:id/deliveries - Get delivery history
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { 
  requirePermission,
  Permissions,
  AuthenticatedRequest 
} from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { webhookService, WEBHOOK_EVENT_TYPES } from '../services/webhookService.js';

const router = Router();

// Schema for creating/updating webhooks
const webhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL'),
  secret: z.string().optional().nullable(),
  enabled: z.boolean().optional().default(true),
  events: z.array(z.string()).min(1, 'At least one event must be selected'),
});

/**
 * GET /api/webhooks
 * List all webhooks
 */
router.get('/', requirePermission(Permissions.ADMIN_USERS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Mask secrets in response
    const maskedWebhooks = webhooks.map(w => ({
      id: w.id,
      name: w.name,
      url: w.url,
      secret: w.secret ? '••••••••' : null,
      hasSecret: !!w.secret,
      enabled: w.enabled,
      events: w.events,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      createdBy: w.createdBy,
      deliveryCount: w._count.deliveries,
    }));

    res.json({
      success: true,
      data: maskedWebhooks,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/event-types
 * Get available webhook event types
 */
router.get('/event-types', requirePermission(Permissions.ADMIN_USERS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: WEBHOOK_EVENT_TYPES,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/:id
 * Get webhook details
 */
router.get('/:id', requirePermission(Permissions.ADMIN_USERS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    if (!webhook) {
      throw createError('Webhook not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret ? '••••••••' : null,
        hasSecret: !!webhook.secret,
        enabled: webhook.enabled,
        events: webhook.events,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
        createdBy: webhook.createdBy,
        deliveryCount: webhook._count.deliveries,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post('/', requirePermission(Permissions.ADMIN_USERS_CREATE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = webhookSchema.parse(req.body);

    // Check for duplicate name
    const existing = await prisma.webhook.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw createError('A webhook with this name already exists', 409);
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret: data.secret || null,
        enabled: data.enabled,
        events: data.events,
        createdBy: req.user?.email || req.user?.adminId,
      },
    });

    // Refresh webhook service endpoints
    await webhookService.refreshEndpoints();

    res.status(201).json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        hasSecret: !!webhook.secret,
        enabled: webhook.enabled,
        events: webhook.events,
        createdAt: webhook.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put('/:id', requirePermission(Permissions.ADMIN_USERS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = webhookSchema.partial().parse(req.body);

    const existing = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Webhook not found', 404);
    }

    // Check for duplicate name (if name is being changed)
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.webhook.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw createError('A webhook with this name already exists', 409);
      }
    }

    // Build update data - only include secret if it's being explicitly set
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.events !== undefined) updateData.events = data.events;
    // Only update secret if a new value is provided (not the masked value)
    if (data.secret !== undefined && data.secret !== '••••••••') {
      updateData.secret = data.secret || null;
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    // Refresh webhook service endpoints
    await webhookService.refreshEndpoints();

    res.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        hasSecret: !!webhook.secret,
        enabled: webhook.enabled,
        events: webhook.events,
        updatedAt: webhook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, error.errors));
    }
    next(error);
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', requirePermission(Permissions.ADMIN_USERS_DELETE), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw createError('Webhook not found', 404);
    }

    await prisma.webhook.delete({
      where: { id },
    });

    // Refresh webhook service endpoints
    await webhookService.refreshEndpoints();

    res.json({
      success: true,
      message: `Webhook "${webhook.name}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks/:id/test
 * Send a test event to the webhook
 */
router.post('/:id/test', requirePermission(Permissions.ADMIN_USERS_EDIT), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await webhookService.sendTestWebhook(id);

    res.json({
      success: true,
      data: {
        delivered: result.success,
        statusCode: result.statusCode,
        error: result.error,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get('/:id/deliveries', requirePermission(Permissions.ADMIN_USERS_VIEW), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    // Verify webhook exists
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw createError('Webhook not found', 404);
    }

    const deliveries = await webhookService.getDeliveryHistory(id, limit);

    res.json({
      success: true,
      data: deliveries.map(d => ({
        id: d.id,
        event: d.event,
        statusCode: d.statusCode,
        success: d.success,
        error: d.error,
        durationMs: d.durationMs,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export { router as webhookRoutes };

