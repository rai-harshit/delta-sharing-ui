declare module 'parquetjs-lite' {
  export interface ParquetSchema {
    fields: Record<string, unknown>;
  }

  export interface ParquetCursor {
    next(): Promise<Record<string, unknown> | null>;
    rewind(): void;
  }

  export class ParquetReader {
    static openFile(path: string): Promise<ParquetReader>;
    static openBuffer(buffer: Buffer): Promise<ParquetReader>;
    getSchema(): ParquetSchema;
    getCursor(): ParquetCursor;
    getRowCount(): bigint | number;
    getMetadata(): Record<string, unknown>;
    close(): Promise<void>;
  }

  export class ParquetWriter {
    static openFile(schema: ParquetSchema, path: string): Promise<ParquetWriter>;
    appendRow(row: Record<string, unknown>): Promise<void>;
    close(): Promise<void>;
  }

  const parquet: {
    ParquetReader: typeof ParquetReader;
    ParquetWriter: typeof ParquetWriter;
  };

  export default parquet;
}

