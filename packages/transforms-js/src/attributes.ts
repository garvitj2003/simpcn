const media = new Set(['img', 'source', 'video', 'audio', 'track', 'input', 'embed']);
export function attributeKind(tag: string, name: string, rel = ''): 'url' | 'srcset' | undefined {
  if (media.has(tag) && name === 'src') return 'url';
  if (['img', 'source'].includes(tag) && name.toLowerCase() === 'srcset') return 'srcset';
  if (tag === 'video' && name === 'poster' || tag === 'object' && name === 'data' || tag === 'image' && ['href', 'xlinkHref', 'xlink:href'].includes(name)) return 'url';
  if (tag === 'link' && name === 'href' && rel.split(/\s+/).some(token => ['icon', 'apple-touch-icon', 'preload'].includes(token))) return 'url';
  return undefined;
}

