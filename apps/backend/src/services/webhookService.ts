/**
 * Webhook Service
 * 
 * Sends notifications to external systems when events occur:
 * - Share created/updated/deleted
 * - Recipient created/updated/deleted
 * - Access granted/revoked
 * - Token rotated
 * 
 * Webhooks are configured via the database and managed through the UI.
 */

import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export type WebhookEventType =
  | 'share.created'
  | 'share.updated'
  | 'share.deleted'
  | 'recipient.created'
  | 'recipient.updated'
  | 'recipient.deleted'
  | 'access.granted'
  | 'access.revoked'
  | 'token.rotated'
  | 'user.login'
  | 'user.sso_login'
  | 'test'; // For testing webhooks

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'share.created',
  'share.updated',
  'share.deleted',
  'recipient.created',
  'recipient.updated',
  'recipient.deleted',
  'access.granted',
  'access.revoked',
  'token.rotated',
  'user.login',
  'user.sso_login',
];

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string | null;
  enabled: boolean;
}

interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookDeliveryResult {
  webhookId: string;
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

// ============================================
// Webhook Service
// ============================================

class WebhookService {
  private endpoints: WebhookEndpoint[] = [];
  private initialized = false;
  private lastRefresh = 0;
  private refreshIntervalMs = 60000; // Refresh from DB every 60 seconds

  /**
   * Initialize the webhook service by loading from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.refreshEndpoints();
    this.initialized = true;
    
    logger.info('Webhook service initialized', {
      endpointCount: this.endpoints.length,
    });
  }

  /**
   * Refresh endpoints from database
   */
  async refreshEndpoints(): Promise<void> {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { enabled: true },
      });

      this.endpoints = webhooks.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        secret: w.secret,
        enabled: w.enabled,
      }));

      this.lastRefresh = Date.now();

      logger.debug('Webhook endpoints refreshed', {
        count: this.endpoints.length,
      });
    } catch (error) {
      logger.error('Failed to refresh webhook endpoints', error);
    }
  }

  /**
   * Check if endpoints need refresh
   */
  private async ensureRefreshed(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    } else if (Date.now() - this.lastRefresh > this.refreshIntervalMs) {
      await this.refreshEndpoints();
    }
  }

  /**
   * Check if webhooks are enabled
   */
  isEnabled(): boolean {
    return this.endpoints.length > 0;
  }

  /**
   * Get configured endpoints (for internal use)
   */
  getEndpoints(): WebhookEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Send a webhook notification
   */
  async notify(
    event: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.ensureRefreshed();

    // Find endpoints that subscribe to this event
    const targetEndpoints = this.endpoints.filter(
      ep => ep.events.includes(event) || ep.events.includes('*')
    );

    if (targetEndpoints.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      id: generateId(),
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Send to all target endpoints in parallel
    const results = await Promise.allSettled(
      targetEndpoints.map(ep => this.sendToEndpoint(ep, payload))
    );

    // Record delivery results and log
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const endpoint = targetEndpoints[i];

      if (result.status === 'fulfilled') {
        const deliveryResult = result.value;
        
        // Record delivery in database
        await this.recordDelivery(endpoint.id, event, payload, deliveryResult);

        if (deliveryResult.success) {
          logger.debug('Webhook delivered', {
            event,
            endpoint: endpoint.name,
            statusCode: deliveryResult.statusCode,
            durationMs: deliveryResult.durationMs,
          });
        } else {
          logger.warn('Webhook delivery failed', {
            event,
            endpoint: endpoint.name,
            statusCode: deliveryResult.statusCode,
            error: deliveryResult.error,
            durationMs: deliveryResult.durationMs,
          });
        }
      } else {
        // Record failed delivery
        await this.recordDelivery(endpoint.id, event, payload, {
          webhookId: endpoint.id,
          endpoint: endpoint.name,
          success: false,
          error: result.reason?.message || 'Unknown error',
          durationMs: 0,
        });

        logger.error('Webhook delivery error', result.reason, {
          event,
          endpoint: endpoint.name,
        });
      }
    }
  }

  /**
   * Send a test webhook to an endpoint
   */
  async sendTestWebhook(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const endpoint: WebhookEndpoint = {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      enabled: webhook.enabled,
    };

    const payload: WebhookPayload = {
      id: generateId(),
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Delta Sharing UI',
        webhookName: webhook.name,
      },
    };

    const result = await this.sendToEndpoint(endpoint, payload);
    
    // Record the test delivery
    await this.recordDelivery(webhookId, 'test', payload, result);

    return result;
  }

  /**
   * Send webhook to a specific endpoint
   */
  private async sendToEndpoint(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const start = Date.now();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DeltaSharingUI/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
      };

      // Add signature if secret is configured
      if (endpoint.secret) {
        const signature = this.signPayload(JSON.stringify(payload), endpoint.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      return {
        webhookId: endpoint.id,
        endpoint: endpoint.name,
        success: response.ok,
        statusCode: response.status,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        webhookId: endpoint.id,
        endpoint: endpoint.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Sign the payload for verification using HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Record webhook delivery in database
   */
  private async recordDelivery(
    webhookId: string,
    event: string,
    payload: WebhookPayload,
    result: WebhookDeliveryResult
  ): Promise<void> {
    try {
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          event,
          payload: payload as object,
          statusCode: result.statusCode,
          success: result.success,
          error: result.error,
          durationMs: result.durationMs,
        },
      });
    } catch (error) {
      logger.error('Failed to record webhook delivery', error);
    }
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(webhookId: string, limit = 50) {
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Clean up old delivery records (older than specified days)
   */
  async cleanupDeliveries(retentionDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.webhookDelivery.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    logger.info('Cleaned up old webhook deliveries', {
      deleted: result.count,
      retentionDays,
    });

    return result.count;
  }

  // ============================================
  // Convenience Methods
  // ============================================

  async onShareCreated(share: { id: string; name: string; createdBy?: string }) {
    await this.notify('share.created', { share });
  }

  async onShareUpdated(share: { id: string; name: string }) {
    await this.notify('share.updated', { share });
  }

  async onShareDeleted(share: { id: string; name: string }) {
    await this.notify('share.deleted', { share });
  }

  async onRecipientCreated(recipient: { id: string; name: string }) {
    await this.notify('recipient.created', { recipient });
  }

  async onRecipientUpdated(recipient: { id: string; name: string }) {
    await this.notify('recipient.updated', { recipient });
  }

  async onRecipientDeleted(recipient: { id: string; name: string }) {
    await this.notify('recipient.deleted', { recipient });
  }

  async onAccessGranted(grant: { recipientId: string; recipientName: string; shareId: string; shareName: string }) {
    await this.notify('access.granted', { grant });
  }

  async onAccessRevoked(grant: { recipientId: string; recipientName: string; shareId: string; shareName: string }) {
    await this.notify('access.revoked', { grant });
  }

  async onTokenRotated(recipient: { id: string; name: string }) {
    await this.notify('token.rotated', { recipient });
  }

  async onUserLogin(user: { id: string; email: string; method: 'password' | 'sso' }) {
    await this.notify(user.method === 'sso' ? 'user.sso_login' : 'user.login', { user });
  }
}

/**
 * Generate a unique ID for webhook events
 */
function generateId(): string {
  return `whk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Export singleton instance
export const webhookService = new WebhookService();
