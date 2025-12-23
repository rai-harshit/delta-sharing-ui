/**
 * Config Sync Service
 * 
 * Synchronizes the database state to OSS Delta Sharing Server config files.
 * This enables using the battle-tested OSS server for protocol handling
 * while keeping the admin UI for management.
 */

import { prisma } from '../db/client.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { storageConfigService } from './storageConfigService.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Config directory shared with OSS server (via Docker volume)
const CONFIG_DIR = process.env.OSS_CONFIG_PATH || '/shared-config';
const CONFIG_FILE = 'delta-sharing.yaml';
const TOKENS_FILE = 'tokens';

// Interface matching OSS server config format
interface OSSTable {
  name: string;
  location: string;
  id: string;
}

interface OSSSchema {
  name: string;
  tables: OSSTable[];
}

interface OSSShare {
  name: string;
  schemas: OSSSchema[];
}

interface OSSConfig {
  version: number;
  shares: OSSShare[];
  authorization: {
    bearerToken: {
      tokenFile: string;
    };
  };
}

// Track last sync hash to avoid unnecessary writes
let lastConfigHash: string | null = null;
let lastTokensHash: string | null = null;

export const configSyncService = {
  /**
   * Check if hybrid mode is enabled
   */
  isHybridMode(): boolean {
    return process.env.HYBRID_MODE === 'true' || existsSync(CONFIG_DIR);
  },

  /**
   * Resolve cloud:// internal format to actual cloud URLs for OSS server
   */
  async resolveLocation(location: string): Promise<string> {
    // If not using internal cloud:// format, return as-is
    if (!location.startsWith('cloud://')) {
      return location;
    }

    // Parse cloud://configId/bucket/path
    const withoutProtocol = location.replace('cloud://', '');
    const parts = withoutProtocol.split('/');
    const configId = parts[0];
    const bucket = parts[1];
    const path = parts.slice(2).join('/');

    if (!configId || !bucket) {
      throw new Error(`Invalid cloud location format: ${location}`);
    }

    const config = await storageConfigService.getDecryptedConfig(configId);
    if (!config) {
      throw new Error(`Storage config not found: ${configId}`);
    }

    // Convert to cloud-provider-specific URL
    switch (config.type) {
      case 's3':
        return path ? `s3://${bucket}/${path}` : `s3://${bucket}`;
      case 'azure':
        if (!config.azureAccount) {
          throw new Error('Azure account not configured');
        }
        return path 
          ? `wasbs://${bucket}@${config.azureAccount}.blob.core.windows.net/${path}`
          : `wasbs://${bucket}@${config.azureAccount}.blob.core.windows.net`;
      case 'gcs':
        return path ? `gs://${bucket}/${path}` : `gs://${bucket}`;
      default:
        throw new Error(`Unknown storage type: ${config.type}`);
    }
  },

  /**
   * Generate OSS-compatible shares config from database
   */
  async generateConfig(): Promise<OSSConfig> {
    const shares = await prisma.share.findMany({
      include: {
        schemas: {
          include: {
            tables: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const ossShares: OSSShare[] = [];

    for (const share of shares) {
      const ossSchemas: OSSSchema[] = [];

      for (const schema of share.schemas) {
        const ossTables: OSSTable[] = [];

        for (const table of schema.tables) {
          try {
            // Resolve cloud:// URLs to actual cloud URLs
            const location = await this.resolveLocation(table.location);
            ossTables.push({
              name: table.alias || table.name, // Use alias if set
              location,
              id: table.id,
            });
          } catch (error) {
            logger.warn(`Failed to resolve location for table ${table.name}`, { error, tableName: table.name });
            // Skip tables with invalid locations
          }
        }

        if (ossTables.length > 0) {
          ossSchemas.push({
            name: schema.name,
            tables: ossTables,
          });
        }
      }

      if (ossSchemas.length > 0) {
        ossShares.push({
          name: share.name,
          schemas: ossSchemas,
        });
      }
    }

    return {
      version: 1,
      shares: ossShares,
      authorization: {
        bearerToken: {
          tokenFile: '/config/tokens',
        },
      },
    };
  },

  /**
   * Generate tokens file content from database
   * Format: token = recipient_name (one per line)
   */
  async generateTokensFile(): Promise<string> {
    const recipients = await prisma.recipient.findMany({
      include: {
        tokens: {
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        },
        accessGrants: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        },
      },
    });

    // Only include recipients with active tokens and at least one access grant
    const lines: string[] = [];
    
    for (const recipient of recipients) {
      if (recipient.tokens.length === 0 || recipient.accessGrants.length === 0) {
        continue;
      }

      for (const token of recipient.tokens) {
        // Format: token = recipient_name
        lines.push(`${token.token} = ${recipient.name}`);
      }
    }

    return lines.join('\n');
  },

  /**
   * Convert config object to YAML string
   */
  toYaml(config: OSSConfig): string {
    let yaml = `# Delta Sharing Server Configuration\n`;
    yaml += `# Auto-generated by Delta Sharing UI - DO NOT EDIT MANUALLY\n`;
    yaml += `# Generated at: ${new Date().toISOString()}\n\n`;
    yaml += `version: ${config.version}\n\n`;

    if (config.shares.length === 0) {
      yaml += `shares: []\n`;
    } else {
      yaml += `shares:\n`;

      for (const share of config.shares) {
        yaml += `  - name: "${share.name}"\n`;
        yaml += `    schemas:\n`;

        for (const schema of share.schemas) {
          yaml += `      - name: "${schema.name}"\n`;
          yaml += `        tables:\n`;

          for (const table of schema.tables) {
            yaml += `          - name: "${table.name}"\n`;
            yaml += `            location: "${table.location}"\n`;
            yaml += `            id: "${table.id}"\n`;
          }
        }
      }
    }

    yaml += `\nauthorization:\n`;
    yaml += `  bearerToken:\n`;
    yaml += `    tokenFile: "${config.authorization.bearerToken.tokenFile}"\n`;

    return yaml;
  },

  /**
   * Calculate hash of content for change detection
   */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  },

  /**
   * Write config files and optionally signal OSS server to reload
   */
  async sync(): Promise<{ configChanged: boolean; tokensChanged: boolean }> {
    if (!this.isHybridMode()) {
      logger.debug('Hybrid mode not enabled, skipping config sync');
      return { configChanged: false, tokensChanged: false };
    }

    try {
      await mkdir(CONFIG_DIR, { recursive: true });

      // Generate config
      const config = await this.generateConfig();
      const configYaml = this.toYaml(config);
      const configHash = this.hashContent(configYaml);

      // Generate tokens
      const tokens = await this.generateTokensFile();
      const tokensHash = this.hashContent(tokens);

      let configChanged = false;
      let tokensChanged = false;

      // Only write if changed
      if (configHash !== lastConfigHash) {
        await writeFile(join(CONFIG_DIR, CONFIG_FILE), configYaml, 'utf-8');
        lastConfigHash = configHash;
        configChanged = true;
        logger.info('Config file updated', { file: CONFIG_FILE, shareCount: config.shares.length });
      }

      if (tokensHash !== lastTokensHash) {
        await writeFile(join(CONFIG_DIR, TOKENS_FILE), tokens, 'utf-8');
        lastTokensHash = tokensHash;
        tokensChanged = true;
        const tokenCount = tokens.split('\n').filter(l => l.trim()).length;
        logger.info('Tokens file updated', { file: TOKENS_FILE, tokenCount });
      }

      // Refresh system token access if config changed (new shares added)
      if (configChanged) {
        try {
          // Dynamic import to avoid circular dependency
          const { ossProxyService } = await import('./ossProxyService.js');
          await ossProxyService.refreshSystemAccess();
        } catch (error) {
          logger.warn('Failed to refresh system access', { error });
        }
      }

      return { configChanged, tokensChanged };
    } catch (error) {
      logger.error('Failed to sync config', error as Error);
      throw error;
    }
  },

  /**
   * Force a full sync (ignores hash cache)
   */
  async forceSync(): Promise<void> {
    lastConfigHash = null;
    lastTokensHash = null;
    await this.sync();
  },

  /**
   * Read current config from file (if exists)
   */
  async readCurrentConfig(): Promise<string | null> {
    try {
      const configPath = join(CONFIG_DIR, CONFIG_FILE);
      if (existsSync(configPath)) {
        return await readFile(configPath, 'utf-8');
      }
    } catch (error) {
      logger.warn('Could not read current config', { error });
    }
    return null;
  },

  /**
   * Start periodic sync (for catching any missed changes)
   */
  startPeriodicSync(intervalMs: number = 60000): NodeJS.Timeout {
    logger.info('Starting periodic config sync', { intervalSeconds: intervalMs / 1000 });
    
    // Initial sync
    this.sync().catch((err) => logger.error('Config sync failed', err));

    // Periodic sync
    return setInterval(() => {
      this.sync().catch((err) => logger.error('Periodic config sync failed', err));
    }, intervalMs);
  },

  /**
   * Get sync status for health check
   */
  async getStatus(): Promise<{
    hybridMode: boolean;
    configDir: string;
    lastConfigHash: string | null;
    lastTokensHash: string | null;
    shareCount: number;
    tokenCount: number;
  }> {
    const config = await this.generateConfig();
    const tokens = await this.generateTokensFile();
    const tokenCount = tokens.split('\n').filter(l => l.trim()).length;

    return {
      hybridMode: this.isHybridMode(),
      configDir: CONFIG_DIR,
      lastConfigHash,
      lastTokensHash,
      shareCount: config.shares.length,
      tokenCount,
    };
  },
};




