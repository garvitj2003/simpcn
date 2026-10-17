'use strict';
const plugin = require('./plugin.cjs');
exports.createTransformer = function createTransformer(upstreamPath, snapshot) {
  const upstream = require(upstreamPath);
  return {
    ...upstream,
    // This wrapper always adds a plugin in production, so Expo must not use its
    // default-config fast path to bypass the extension.
    isDefaultConfig: () => false,
    transform(args) {
      if (args.options.dev !== false || !['ios', 'android'].includes(args.options.platform)) return upstream.transform(args);
      return upstream.transform({ ...args, plugins: [[plugin, { entries: snapshot.entries[args.options.platform], runtime: snapshot.runtime }], ...(args.plugins ?? [])] });
    },
    getCacheKey(...args) { return snapshot.digest + ':' + (upstream.getCacheKey?.(...args) ?? ''); },
  };
};
