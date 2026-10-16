import MagicString from 'magic-string';
import { parse as parseHtml, type DefaultTreeAdapterMap } from 'parse5';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import type { AssetUrlResolver } from '@simpcn/core';
import { attributeKind } from '@simpcn/transforms-js/attributes';
export { transformJs } from '@simpcn/transforms-js';

function decodeCss(value: string): string {
  return value.replace(/\\([\da-fA-F]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n\f])/g, (_match, hex, character) => {
    if (!hex) return character;
    const code = parseInt(hex, 16);
    return String.fromCodePoint(code === 0 || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff ? 0xfffd : code);
  });
}
export function rewriteCssValue(value: string, resolver: AssetUrlResolver): string {
  const parsed = valueParser(value);
  parsed.walk(node => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
    const parts = node.nodes.filter(part => part.type !== 'space' && part.type !== 'comment');
    if (parts.length !== 1 || !['word', 'string'].includes(parts[0].type)) return false;
    const url = decodeCss(parts[0].value);
    const resolved = resolver.resolve(url);
    if (resolved !== url) {
      const escaped = resolved.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ').replace(/\r/g, '\\d ');
      node.nodes = valueParser(`"${escaped}"`).nodes;
    }
    return false;
  });
  return parsed.toString();
}
export function transformCss(code: string, id: string, resolver: AssetUrlResolver) {
  const root = postcss.parse(code, { from: id });
  let changed = false;
  root.walkDecls(declaration => {
    const value = rewriteCssValue(declaration.value, resolver);
    if (value !== declaration.value) { declaration.value = value; changed = true; }
  });
  if (!changed) return null;
  const result = root.toResult({ from: id, to: id, map: { inline: false, annotation: false, sourcesContent: true } });
  return { code: result.css, map: result.map!.toString() };
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function transformHtml(code: string, resolver: AssetUrlResolver): string {
  const root = parseHtml(code, { sourceCodeLocationInfo: true });
  const output = new MagicString(code);
  function walk(node: DefaultTreeAdapterMap['node']): void {
    if ('tagName' in node) {
      const rel = node.attrs.find(attr => attr.name === 'rel')?.value ?? '';
      for (const attr of node.attrs) {
        const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
        const location = node.sourceCodeLocation?.attrs?.[name];
        const kind = attributeKind(node.tagName, name, rel);
        const value = name === 'style' ? rewriteCssValue(attr.value, resolver) :
          kind === 'srcset' ? resolver.resolveSrcSet(attr.value) : kind ? resolver.resolve(attr.value) : attr.value;
        if (location && value !== attr.value) output.overwrite(location.startOffset, location.endOffset, `${name}="${escapeHtml(value)}"`);
      }
      if (node.tagName === 'style') {
        for (const child of node.childNodes) {
          if ('value' in child && child.nodeName === '#text' && child.sourceCodeLocation) {
            const transformed = transformCss(child.value, 'inline.css', resolver);
            if (transformed) output.overwrite(child.sourceCodeLocation.startOffset, child.sourceCodeLocation.endOffset, transformed.code);
          }
        }
      }
      if ('content' in node) walk(node.content as DefaultTreeAdapterMap['node']);
    }
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
  }
  walk(root);
  return output.toString();
}
