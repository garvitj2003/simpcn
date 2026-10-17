'use strict';
// Copied into .build/expo for Metro. Only react-native is reachable at runtime.
// Same choice as RN AssetUtils.pickScale: round up, then fall back to largest.
exports.selectImageSource = function selectImageSource(sources, deviceScale = require('react-native').PixelRatio.get()) {
  return sources.find(source => source.scale >= deviceScale) ?? sources[sources.length - 1];
};
