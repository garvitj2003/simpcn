/** Experimental build-time Metro integration. Not a mobile runtime module. */
export declare function withSimpcn<T extends {
  projectRoot?: string;
  cacheVersion?: string;
  transformer?: { babelTransformerPath?: string; [key: string]: unknown };
}>(config: T | Promise<T>, options?: { cwd?: string }): Promise<T>;
