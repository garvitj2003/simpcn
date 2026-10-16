interface Context {
  resourcePath: string;
  getOptions(): import('./map.js').DeliveryOptions;
  async(): (error: Error | null, code?: string, map?: unknown) => void;
  emitWarning(error: Error): void;
}
function loader(this: Context, code: string, inputMap: unknown) {
  const done = this.async();
  void (async () => {
    const { mapResolver } = await import('./map.js');
    const { transformJs } = await import('@simpcn/transforms-js');
    const options = this.getOptions();
    const result = transformJs(code, this.resourcePath, mapResolver(options), message => this.emitWarning(new Error(message)), {
      helperModule: '@simpcn/next/assets', nextImages: options.nextImages,
      preserveImageOptimization: options.preserveImageOptimization,
    });
    done(null, result?.code ?? code, result ? JSON.parse(result.map.toString()) : inputMap);
  })().catch(error => done(error));
}
export = loader;
