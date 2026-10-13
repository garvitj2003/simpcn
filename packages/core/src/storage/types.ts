import type { Readable } from 'node:stream';
import type { AssetRecord, MigrationAction } from '../types.js';

export interface StorageTarget {
  /** Stable provider/service identity, e.g. an endpoint URL. Never credentials. */
  service: string;
  bucket: string;
  prefix: string;
}
export interface RemoteAsset {
  key: string;
  size: number;
  mimeType?: string;
  sha256?: string;
  cacheControl?: string;
  etag?: string;
}
export interface UploadInput {
  key: string;
  size: number;
  mimeType: string;
  sha256: string;
  cacheControl: string;
  /** Returns a new stream for each attempt. */
  openBody: () => Promise<Readable>;
  /** Protect against overwriting an object created/changed since HEAD. */
  condition: { ifAbsent: true } | { ifMatch: string };
  signal?: AbortSignal;
}
export interface UploadResult { etag?: string }
export interface StorageAdapter {
  readonly target: StorageTarget;
  head(key: string, signal?: AbortSignal): Promise<RemoteAsset | null>;
  upload(input: UploadInput): Promise<UploadResult>;
}
export type StorageErrorCode = 'not-found' | 'auth' | 'conflict' | 'transient' | 'aborted' | 'unknown';
export class StorageError extends Error {
  constructor(message: string, readonly code: StorageErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
  }
}
export interface DeploymentRecord {
  asset: AssetRecord;
  key: string;
  cacheControl: string;
  status: 'uploaded' | 'verified';
  uploadedAt?: string;
  verifiedAt?: string;
  etag?: string;
}
export interface DeploymentState {
  version: 1;
  target: StorageTarget;
  assets: DeploymentRecord[];
}
/** A session owns its state exclusively until close. Implementations serialize writes. */
export interface DeploymentSession {
  state: DeploymentState;
  save(state: DeploymentState): Promise<void>;
  close(): Promise<void>;
}
export interface DeploymentStateStore {
  acquire(target: StorageTarget): Promise<DeploymentSession>;
}
export interface MigrationResult {
  action: MigrationAction;
  key: string;
  status: 'uploaded' | 'skipped' | 'removed' | 'failed' | 'cancelled';
  attempts: number;
  /** True when this execution overwrote a remote object at the same key. */
  replaced?: boolean;
  error?: string;
  errorCode?: StorageErrorCode | 'local' | 'state' | 'verification';
}
export interface ExecutionReport {
  success: boolean;
  results: MigrationResult[];
  state: DeploymentState;
}
