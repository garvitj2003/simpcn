'use strict';
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { imageSize } = require('./image.cjs');

// Metro parses the platform suffix first, then density from the remaining name.
// Unknown platform suffixes remain part of the name (including explicit cross-platform requests).
function parse(key, platform) {
  const extension = path.posix.extname(key);
  if (!/^\.(png|jpe?g)$/i.test(extension)) return;
  let name = key.slice(0, -extension.length), target = '';
  if (name.endsWith('.' + platform)) { name = name.slice(0, -(platform.length + 1)); target = platform; }
  const density = name.match(/^(.+?)@([\d.]+)x$/);
  const scale = density ? Number(density[2]) : 1;
  if (density) name = density[1];
  return { key: name + extension, platform: target, scale };
}
exports.parseAsset = parse;
exports.buildFamilies = async function buildFamilies({ root, files, managed, resolver, setupError }) {
  const platforms = {};
  const bytes = new Map();
  async function dimensions(key) {
    if (!bytes.has(key)) bytes.set(key, readFile(path.join(root, key)).then(imageSize));
    return bytes.get(key);
  }
  for (const platform of ['ios', 'android']) {
    const groups = new Map(), aliases = new Map(), native = new Set();
    for (const file of files) {
      const key = file.relativePath;
      const parsed = parse(key, platform);
      if (!parsed) continue;
      const nativeName = parse(key, 'native');
      if (nativeName?.platform) { native.add(nativeName.key); continue; }
      if (!groups.has(parsed.key)) groups.set(parsed.key, { generic: [], specific: [] });
      groups.get(parsed.key)[parsed.platform ? 'specific' : 'generic'].push({ key, scale: parsed.scale });
      if (!aliases.has(parsed.key)) aliases.set(parsed.key, new Set());
      aliases.get(parsed.key).add(key);
      // Do not invent an alias that Metro would parse as another family.
      if (parse(parsed.key, platform).key === parsed.key) aliases.get(parsed.key).add(parsed.key);
    }
    const entries = Object.create(null);
    for (const [key, group] of groups) {
      const variants = (group.specific.length ? group.specific : group.generic).sort((a, b) => a.scale - b.scale);
      // Preserve local delivery when a selected sibling is excluded; do not
      // silently redirect only part of a density family. .native is deferred.
      if (native.has(key) || variants.some(item => !managed.has(item.key))) continue;
      let entry;
      try {
        if (setupError) throw new Error(setupError);
        const seen = new Set(), sources = [];
        let logical;
        for (const item of variants) {
          if (!Number.isFinite(item.scale) || item.scale <= 0 || seen.has(item.scale)) throw new Error('Invalid or duplicate image density');
          seen.add(item.scale);
          const size = await dimensions(item.key);
          const current = { width: size.width / item.scale, height: size.height / item.scale };
          if (logical && (Math.abs(logical.width - current.width) > 0.000001 || Math.abs(logical.height - current.height) > 0.000001)) throw new Error('Image density variants must have matching logical dimensions');
          logical = current;
          sources.push({ uri: resolver.resolveKey(item.key), ...current, scale: item.scale });
        }
        entry = sources.length === 1 ? { source: sources[0] } : { sources };
      } catch (error) { entry = { error: `${key} (${platform}): ${error.message}` }; }
      for (const alias of aliases.get(key)) entries[path.resolve(root, alias)] = entry;
    }
    platforms[platform] = entries;
  }
  return platforms;
};
