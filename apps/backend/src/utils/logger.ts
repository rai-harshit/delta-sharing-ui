/**
 * Structured Logging Utility
 * 
 * Provides JSON-formatted logging with:
 * - Correlation IDs for request tracing
 * - Log levels (debug, info, warn, error)
 * - Contextual metadata
 * - Timestamps and process info
 */

import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

// ============================================
// Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  userId?: string;
  recipientId?: string;
  action?: string;
  resource?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ============================================
// Configuration
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
const isProduction = process.env.NODE_ENV === 'production';
const serviceName = process.env.SERVICE_NAME || 'delta-sharing-ui';
const serviceVersion = process.env.SERVICE_VERSION || '0.1.0';

// ============================================
// Logger Class
// ============================================

class Logger {
  private context: LogContext = {};

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: isProduction ? undefined : error.stack,
        }
      : error
        ? { message: String(error) }
        : undefined;

    this.log('error', message, context, errorDetails);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: { name?: string; message: string; stack?: string }
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: serviceName,
      version: serviceVersion,
      environment: process.env.NODE_ENV || 'development',
      correlationId: context?.correlationId || this.context.correlationId,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = error as LogEntry['error'];
    }

    // Clean up empty context
    if (entry.context && Object.keys(entry.context).length === 0) {
      delete entry.context;
    }

    // Output
    if (isProduction) {
      // JSON format for production
      console.log(JSON.stringify(entry));
    } else {
      // Pretty format for development
      this.prettyPrint(entry);
    }
  }

  /**
   * Pretty print for development
   */
  private prettyPrint(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    const level = `${colors[entry.level]}${entry.level.toUpperCase().padEnd(5)}${reset}`;
    const time = `${dim}${new Date(entry.timestamp).toLocaleTimeString()}${reset}`;
    const corrId = entry.correlationId ? `${dim}[${entry.correlationId.slice(0, 8)}]${reset} ` : '';

    console.log(`${time} ${level} ${corrId}${entry.message}`);

    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(`${dim}  Context: ${JSON.stringify(entry.context)}${reset}`);
    }

    if (entry.error) {
      console.log(`${colors.error}  Error: ${entry.error.message}${reset}`);
      if (entry.error.stack) {
        console.log(`${dim}${entry.error.stack}${reset}`);
      }
    }
  }
}

// ============================================
// Singleton Logger Instance
// ============================================

export const logger = new Logger();

// ============================================
// Express Middleware
// ============================================

// Store correlation ID in async context
const correlationIdSymbol = Symbol('correlationId');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
      logger?: Logger;
    }
  }
}

/**
 * Request logging middleware
 * - Generates/extracts correlation ID
 * - Attaches child logger to request
 * - Logs request start and completion
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  
  // Extract or generate correlation ID
  const correlationId = 
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    randomUUID();

  // Attach to request
  req.correlationId = correlationId;
  
  // Create child logger with request context
  req.logger = logger.child({
    correlationId,
    method: req.method,
    path: req.path,
  });

  // Set correlation ID header in response
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request start
  req.logger.info('Request started', {
    userAgent: req.get('user-agent'),
    ip: req.ip,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });

  // Log request completion
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level: LogLevel = res.statusCode >= 500 ? 'error' :
                            res.statusCode >= 400 ? 'warn' : 'info';

    req.logger![level]('Request completed', {
      statusCode: res.statusCode,
      durationMs,
      contentLength: res.get('content-length'),
    });
  });

  next();
}

// ============================================
// Utility Functions
// ============================================

/**
 * Log application startup
 */
export function logStartup(port: number, additionalInfo?: Record<string, unknown>): void {
  logger.info('Application started', {
    port,
    nodeVersion: process.version,
    platform: process.platform,
    ...additionalInfo,
  });
}

/**
 * Log application shutdown
 */
export function logShutdown(reason?: string): void {
  logger.info('Application shutting down', { reason });
}

