import { describe, it, expect } from 'vitest';
import { parsePublicUrlImport } from '../src/public-import.js';

describe('public URL import parsing', () => {
  it('decodes segments once and removes only the URL directive', () => {
    expect(parsePublicUrlImport('/app/images/menu%20%231.svg?url&v=one%20two#shape', '/app/')).toEqual({
      key: 'images/menu #1.svg', suffix: '?v=one%20two#shape',
    });
    expect(parsePublicUrlImport('/images/%2520%3F.png?v=1&url', '/')).toEqual({ key: 'images/%20?.png', suffix: '?v=1' });
    expect(parsePublicUrlImport('/images/logo.png?url', '/')).toEqual({ key: 'images/logo.png', suffix: '' });
  });
  it('leaves non-URL imports and competing Vite directives to Vite', () => {
    for (const id of ['/images/logo.png', '/images/logo.png?raw', '/images/logo.png?url=1',
      '/images/logo.png?url&raw', '/images/logo.png?url&inline', '/images/logo.png?worker&url',
      '/images/logo.png?sharedworker&url', './images/logo.png?url', 'https://host/logo.png?url', '//host/logo.png?url']) {
      expect(parsePublicUrlImport(id, '/')).toBeUndefined();
    }
  });
  it('rejects traversal, encoded separators and malformed escapes', () => {
    for (const id of ['/../outside?url', '/images/%2e%2e/outside?url', '/images%2foutside?url',
      '/images/%5coutside?url', '/images/%00.png?url', '/images/%zz.png?url', '/C:/outside?url']) {
      expect(parsePublicUrlImport(id, '/')).toBeUndefined();
    }
  });
});
