/**
 * NDJSON (Newline Delimited JSON) Utilities
 * 
 * Implements NDJSON response format as specified in the Delta Sharing protocol.
 * The query endpoint returns:
 * - Line 1: {"protocol": {"minReaderVersion": 1}}
 * - Line 2: {"metaData": {...}}
 * - Lines 3+: {"file": {"url": "...", "id": "...", "size": ...}}
 */

import { Response } from 'express';

/**
 * Protocol action per Delta Sharing spec
 */
export interface ProtocolAction {
  protocol: {
    minReaderVersion: number;
    minWriterVersion?: number;
  };
}

/**
 * Metadata action per Delta Sharing spec
 */
export interface MetadataAction {
  metaData: {
    id: string;
    name?: string;
    format: {
      provider: string;
      options?: Record<string, string>;
    };
    schemaString: string;
    partitionColumns: string[];
    configuration?: Record<string, string>;
    createdTime?: number;
    version?: number;
    size?: number;
    numFiles?: number;
  };
}

/**
 * File action per Delta Sharing spec
 */
export interface FileAction {
  file: {
    url: string;
    id: string;
    size: number;
    partitionValues?: Record<string, string>;
    stats?: string;
    version?: number;
    timestamp?: number;
    expirationTimestamp?: number;
  };
}

export type NDJSONAction = ProtocolAction | MetadataAction | FileAction;

/**
 * Write a single NDJSON line to response
 */
export function writeNDJSONLine(res: Response, data: NDJSONAction): void {
  res.write(JSON.stringify(data) + '\n');
}

/**
 * Stream a complete NDJSON response for a query
 */
export function streamNDJSONResponse(
  res: Response,
  protocol: ProtocolAction['protocol'],
  metadata: MetadataAction['metaData'],
  files: FileAction['file'][]
): void {
  // Set content type for NDJSON
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Write protocol line
  writeNDJSONLine(res, { protocol });

  // Write metadata line
  writeNDJSONLine(res, { metaData: metadata });

  // Write file action lines
  for (const file of files) {
    writeNDJSONLine(res, { file });
  }

  // End response
  res.end();
}

/**
 * Check if client wants NDJSON response based on Accept header
 */
export function wantsNDJSON(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  
  // Check for NDJSON content types
  return acceptHeader.includes('application/x-ndjson') ||
         acceptHeader.includes('application/x-ndjson+json') ||
         acceptHeader.includes('application/json-seq');
}
