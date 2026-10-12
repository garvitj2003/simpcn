export interface ScanOptions {
  root?: string;
  exclude?: readonly string[];
}
export interface ScannedAsset {
  absolutePath: string;
  relativePath: string;
}
export interface AnalyzedAsset extends ScannedAsset {
  publicPath: string;
  extension: string;
  size: number;
  mimeType: string;
}
export interface AssetRecord {
  relativePath: string;
  hash: string;
  size: number;
  mimeType: string;
  storageKey: string;
}
export interface AssetManifest {
  version: 1;
  assets: AssetRecord[];
}
export interface AssetDiff {
  added: AssetRecord[];
  modified: { previous: AssetRecord; current: AssetRecord }[];
  unchanged: AssetRecord[];
  removed: AssetRecord[];
}
export interface MigrationAction {
  type: 'upload' | 'replace' | 'skip' | 'report-removed';
  asset: AssetRecord;
  reason: string;
  cacheInvalidationRequired: boolean;
}
