/**
 * Parquet File Reader
 * Reads Parquet files using parquetjs-lite
 */

import parquet from 'parquetjs-lite';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const { ParquetReader } = parquet;

export interface ParquetReadResult {
  rows: Record<string, unknown>[];
  schema: { name: string; type: string }[];
  rowCount: number;
}

/**
 * Convert Parquet schema type to a simple string type
 */
function getSimpleType(field: any): string {
  if (!field) return 'unknown';
  
  const type = field.originalType || field.primitiveType || field.type;
  
  switch (type) {
    case 'INT32':
    case 'INT64':
    case 'INT96':
      return 'integer';
    case 'FLOAT':
    case 'DOUBLE':
      return 'double';
    case 'BOOLEAN':
      return 'boolean';
    case 'BYTE_ARRAY':
    case 'UTF8':
    case 'STRING':
      return 'string';
    case 'TIMESTAMP_MILLIS':
    case 'TIMESTAMP_MICROS':
      return 'timestamp';
    case 'DATE':
      return 'date';
    case 'DECIMAL':
      return 'decimal';
    default:
      return type?.toLowerCase() || 'unknown';
  }
}

/**
 * Read a Parquet file from the local filesystem
 */
export async function readParquetFile(
  filePath: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ParquetReadResult> {
  const { limit = 1000, offset = 0 } = options;
  
  let reader: Awaited<ReturnType<typeof ParquetReader.openFile>> | null = null;
  const rows: Record<string, unknown>[] = [];
  const schemaFields: { name: string; type: string }[] = [];
  
  try {
    // Open the Parquet file
    reader = await ParquetReader.openFile(filePath);
    
    // Get schema information
    const schema = reader.getSchema();
    for (const fieldName of Object.keys(schema.fields || {})) {
      const field = schema.fields[fieldName];
      schemaFields.push({
        name: fieldName,
        type: getSimpleType(field),
      });
    }
    
    // Create cursor and read rows
    const cursor = reader.getCursor();
    let record: Record<string, unknown> | null = null;
    let rowIndex = 0;
    let rowCount = 0;
    
    while ((record = await cursor.next()) !== null) {
      rowCount++;
      
      // Skip rows before offset
      if (rowIndex < offset) {
        rowIndex++;
        continue;
      }
      
      // Stop if we've reached the limit
      if (rows.length >= limit) {
        // Continue counting total rows
        continue;
      }
      
      // Process the record - convert special types
      const processedRecord: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (value instanceof Buffer) {
          processedRecord[key] = value.toString('utf-8');
        } else if (value instanceof Date) {
          processedRecord[key] = value.toISOString();
        } else if (typeof value === 'bigint') {
          processedRecord[key] = Number(value);
        } else {
          processedRecord[key] = value;
        }
      }
      
      rows.push(processedRecord);
      rowIndex++;
    }
    
    return {
      rows,
      schema: schemaFields,
      rowCount,
    };
  } finally {
    if (reader) {
      await reader.close();
    }
  }
}

/**
 * Read a Parquet file from a buffer (for cloud storage)
 * Writes to a temp file first since parquetjs-lite requires file paths
 */
export async function readParquetBuffer(
  buffer: Buffer,
  options: { limit?: number; offset?: number } = {}
): Promise<ParquetReadResult> {
  // Create a temporary file
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `parquet-${Date.now()}-${Math.random().toString(36).slice(2)}.parquet`);
  
  try {
    // Write buffer to temp file
    await fs.writeFile(tempFile, buffer);
    
    // Read using the file reader
    return await readParquetFile(tempFile, options);
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
