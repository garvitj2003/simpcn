import { createUrlMapper, resolveSrcSet } from '@simpcn/core/delivery';
import type { AssetUrlResolver } from '@simpcn/core';

export interface DeliveryOptions {
  urls: Record<string, string>;
  basePath: string;
  nextImages?: boolean;
  preserveImageOptimization?: boolean;
}
/** Contains public URL data only; all records have already been verified by the wrapper. */
export function mapResolver(options: DeliveryOptions): AssetUrlResolver {
  const resolve = createUrlMapper(options);
  return {
    managedPaths: Object.keys(options.urls), resolve,
    resolveKey: key => Object.hasOwn(options.urls, key) ? options.urls[key] : undefined,
    resolveSrcSet: value => resolveSrcSet(value, resolve),
    deliveryMap: () => options.urls,
  };
}
