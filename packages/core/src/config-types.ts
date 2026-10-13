/** Options shared by config loading, CLI initialization and framework integrations. */
export interface ConfigFlags {
  config?: string; root?: string; provider?: string; endpoint?: string; bucket?: string;
  region?: string; prefix?: string; 'state-file'?: string; 'manifest-file'?: string;
  concurrency?: string; 'hash-concurrency'?: string; 'max-attempts'?: string;
  'retry-delay-ms'?: string; 'cache-control'?: string; 'public-base-url'?: string;
  exclude?: string[]; force?: boolean;
}
