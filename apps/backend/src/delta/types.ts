// Delta Lake types

export interface DeltaTableMetadata {
  id: string;
  name: string | null;
  description: string | null;
  format: {
    provider: string;
    options: Record<string, string>;
  };
  schemaString: string;
  partitionColumns: string[];
  configuration: Record<string, string>;
  createdTime: number;
}

export interface DeltaSchema {
  type: 'struct';
  fields: DeltaField[];
}

export interface DeltaField {
  name: string;
  type: string | DeltaSchema | DeltaArrayType | DeltaMapType;
  nullable: boolean;
  metadata: Record<string, unknown>;
}

export interface DeltaArrayType {
  type: 'array';
  elementType: string | DeltaSchema;
  containsNull: boolean;
}

export interface DeltaMapType {
  type: 'map';
  keyType: string;
  valueType: string | DeltaSchema;
  valueContainsNull: boolean;
}

export interface DeltaAddAction {
  path: string;
  partitionValues: Record<string, string>;
  size: number;
  modificationTime: number;
  dataChange: boolean;
  stats?: string;
  tags?: Record<string, string>;
}

export interface DeltaRemoveAction {
  path: string;
  deletionTimestamp: number;
  dataChange: boolean;
  extendedFileMetadata?: boolean;
  partitionValues?: Record<string, string>;
  size?: number;
}

export interface DeltaProtocol {
  minReaderVersion: number;
  minWriterVersion: number;
}

export interface DeltaCommitInfo {
  timestamp: number;
  operation: string;
  operationParameters: Record<string, string>;
  readVersion?: number;
  isolationLevel?: string;
  isBlindAppend?: boolean;
  operationMetrics?: Record<string, string>;
  engineInfo?: string;
}

export interface DeltaLogEntry {
  add?: DeltaAddAction;
  remove?: DeltaRemoveAction;
  metaData?: DeltaTableMetadata;
  protocol?: DeltaProtocol;
  commitInfo?: DeltaCommitInfo;
}

export interface TableStats {
  numRecords: number;
  numFiles: number;
  totalSize: number;
  minValues?: Record<string, unknown>;
  maxValues?: Record<string, unknown>;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

export interface TablePreviewResult {
  columns: Column[];
  rows: Record<string, unknown>[];
  totalRows: number;
  hasMore: boolean;
}
