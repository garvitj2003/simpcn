import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { VISITOR_KEYS, type Node, type JSXAttribute, type JSXOpeningElement } from '@babel/types';
import MagicString from 'magic-string';
import { parse as parseHtml, type DefaultTreeAdapterMap } from 'parse5';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import type { AssetUrlResolver } from '@simpcn/core';

const media = new Set(['img', 'source', 'video', 'audio', 'track', 'input', 'embed']);
function attributeKind(tag: string, name: string, rel = ''): 'url' | 'srcset' | undefined {
  if (media.has(tag) && name === 'src') return 'url';
  if (['img', 'source'].includes(tag) && name.toLowerCase() === 'srcset') return 'srcset';
  if (tag === 'video' && name === 'poster' || tag === 'object' && name === 'data' || tag === 'image' && ['href', 'xlinkHref', 'xlink:href'].includes(name)) return 'url';
  if (tag === 'link' && name === 'href' && rel.split(/\s+/).some(token => ['icon', 'apple-touch-icon', 'preload'].includes(token))) return 'url';
  return undefined;
}

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

function staticValue(attribute: JSXAttribute): { value: string; node: Node; rawAttribute: boolean } | undefined {
  const raw = attribute.value;
  if (raw?.type === 'StringLiteral') return { value: raw.value, node: raw, rawAttribute: true };
  const expression = raw?.type === 'JSXExpressionContainer' ? raw.expression : undefined;
  if (expression?.type === 'StringLiteral') return { value: expression.value, node: expression, rawAttribute: false };
  if (expression?.type === 'TemplateLiteral' && expression.expressions.length === 0) {
    return { value: expression.quasis[0].value.cooked ?? expression.quasis[0].value.raw, node: expression, rawAttribute: false };
  }
  return undefined;
}
export function transformJs(code: string, id: string, resolver: AssetUrlResolver, warn: (message: string) => void, options: {
  helperModule?: string;
  nextImages?: boolean;
  preserveImageOptimization?: boolean;
} = {}) {
  const ast = parse(code, { sourceType: 'unambiguous', sourceFilename: id,
    plugins: /\.tsx?$/.test(id) ? /\.tsx$/.test(id) ? ['typescript', 'jsx'] : ['typescript'] : ['jsx'] });
  const output = new MagicString(code);
  const helperNames = new Set<string>();
  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== (options.helperModule ?? 'virtual:simpcn')) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'assetUrl') helperNames.add(specifier.local.name);
    }
  }
  function walk(node: Node): void {
    if (node.type === 'JSXOpeningElement') rewriteElement(node);
    for (const key of VISITOR_KEYS[node.type] ?? []) {
      const value = (node as unknown as Record<string, unknown>)[key];
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child === 'object' && 'type' in child) walk(child as Node);
      }
    }
  }
  function rewriteElement(element: JSXOpeningElement): void {
    if (element.name.type !== 'JSXIdentifier') return;
    const tag = element.name.name;
    const relAttribute = element.attributes.find(attr => attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier' && attr.name.name === 'rel') as JSXAttribute | undefined;
    const rel = relAttribute ? staticValue(relAttribute)?.value ?? '' : '';
    for (const attr of element.attributes) {
      if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
      const kind = attributeKind(tag, attr.name.name, rel);
      if (!kind) continue;
      const literal = staticValue(attr);
      if (!literal) {
        const expression = attr.value?.type === 'JSXExpressionContainer' ? attr.value.expression : undefined;
        if (!(expression?.type === 'CallExpression' && expression.callee.type === 'Identifier' && helperNames.has(expression.callee.name))) {
          warn(`Dynamic ${tag}.${attr.name.name} in ${id} was left unchanged; use assetUrl() from ${options.helperModule ?? 'virtual:simpcn'} when it references managed assets.`);
        }
        continue;
      }
      const value = kind === 'srcset' ? resolver.resolveSrcSet(literal.value) : resolver.resolve(literal.value);
      if (value !== literal.value) {
        const replacement = JSON.stringify(value);
        output.overwrite(literal.node.start!, literal.node.end!, literal.rawAttribute ? `{${replacement}}` : replacement);
      }
    }
  }
  walk(ast);
  if (options.nextImages) traverse(ast, {
    JSXOpeningElement(elementPath) {
      const element = elementPath.node;
      if (element.name.type !== 'JSXIdentifier') return;
      const binding = elementPath.scope.getBinding(element.name.name);
      if (!binding?.constant) return;
      const specifier = binding.path.node;
      const declaration = binding.path.parentPath;
      const importedImage = specifier.type === 'ImportDefaultSpecifier' ||
        specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'default';
      if (!importedImage || !declaration?.isImportDeclaration() || declaration.node.source.value !== 'next/image' || declaration.node.importKind === 'type') return;
      const attributes = element.attributes.filter((attribute): attribute is JSXAttribute => attribute.type === 'JSXAttribute');
      const named = (name: string) => attributes.filter(attribute => attribute.name.type === 'JSXIdentifier' && attribute.name.name === name);
      const sources = named('src');
      if (!sources.length) return;
      const literal = staticValue(sources[0]);
      if (!literal) return; // Ownership of arbitrary dynamic/API URLs cannot be inferred.
      const resolved = resolver.resolve(literal.value);
      if (resolved === literal.value) return; // Only the already-verified public inventory is managed.
      const unoptimized = named('unoptimized');
      const explicitlyDirect = unoptimized.length === 1 && (unoptimized[0].value === null ||
        unoptimized[0].value?.type === 'JSXExpressionContainer' && unoptimized[0].value.expression.type === 'BooleanLiteral' && unoptimized[0].value.expression.value);
      let reason: string | undefined;
      if (sources.length !== 1 || element.attributes.some(attribute => attribute.type === 'JSXSpreadAttribute')) reason = 'duplicate src or spread props';
      else if (named('loader').length || named('overrideSrc').length) reason = 'an explicit loader or overrideSrc';
      else if (unoptimized.length && !explicitlyDirect) reason = 'an explicit unoptimized setting';
      else if (options.preserveImageOptimization && !explicitlyDirect) reason = 'explicit image optimization settings in next.config';
      if (reason) {
        warn(`Managed next/image ${literal.value} in ${id} was left unchanged because of ${reason}. For direct delivery, resolve conflicting props and use unoptimized or assetUrl() explicitly.`);
        return;
      }
      const replacement = JSON.stringify(resolved);
      output.overwrite(literal.node.start!, literal.node.end!, literal.rawAttribute ? `{${replacement}}` : replacement);
      // Insert before the tag terminator, preserving whitespace, attributes and children.
      if (!unoptimized.length) output.appendLeft(element.end! - (element.selfClosing ? 2 : 1), ' unoptimized ');
    },
  });
  return output.hasChanged() ? { code: output.toString(), map: output.generateMap({ hires: true, source: id, includeContent: true }) } : null;
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
