import type { withSimpcn as factory } from './index.js';

/** Next transpiles next.config.ts to CommonJS in projects without type:module. */
const withSimpcn: typeof factory = (...args) => {
  let wrapped: ReturnType<typeof factory> | undefined;
  return async (phase, context) => {
    wrapped ??= (await import('./index.js')).withSimpcn(...args);
    return wrapped(phase, context);
  };
};
export = { withSimpcn };
