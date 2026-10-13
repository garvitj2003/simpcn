/** Decode only path segments, preserving resource query values and fragments verbatim. */
export function parsePublicUrlImport(id: string, basePath: string): { key: string; suffix: string } | undefined {
  if (!id.startsWith('/') || id.startsWith('//') || id.includes('\\')) return;
  const hash = id.indexOf('#');
  const query = id.indexOf('?');
  if (query < 0 || hash >= 0 && query > hash) return;
  const parameters = id.slice(query + 1, hash < 0 ? undefined : hash).split('&');
  if (!parameters.includes('url') || parameters.some(parameter =>
    ['raw', 'inline', 'no-inline', 'worker', 'sharedworker'].includes(parameter.split('=')[0]))) return;
  let pathname = id.slice(0, query);
  const base = basePath.endsWith('/') ? basePath : basePath + '/';
  pathname = base !== '/' && pathname.startsWith(base) ? pathname.slice(base.length) : pathname.slice(1);
  let segments: string[];
  try { segments = pathname.split('/').map(decodeURIComponent); } catch { return; }
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[/\\\0]/.test(segment))) return;
  const key = segments.join('/');
  if (/^[A-Za-z]:/.test(key)) return;
  const remaining = parameters.filter(parameter => parameter !== 'url').join('&');
  return { key, suffix: (remaining ? '?' + remaining : '') + (hash < 0 ? '' : id.slice(hash)) };
}
