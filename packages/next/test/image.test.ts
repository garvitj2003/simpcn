import { it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { transformJs } from '@simpcn/transforms';
import { mapResolver } from '../src/map.js';

const resolver = mapResolver({ urls: { 'logo.png': 'https://cdn.example.com/assets/logo.png' }, basePath: '/docs' });
const run = (source: string, options = {}) => {
  const warnings: string[] = [];
  const result = transformJs(source, 'component.tsx', resolver, message => warnings.push(message), { nextImages: true, ...options });
  if (result) parse(result.code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return { result, warnings };
};
it('automatically rewrites verified next/image literals and adds unoptimized', () => {
  const source = `import Image from 'next/image';export default () => <Image src="/docs/logo.png?v=1#shape" width={100} height={20} alt="Logo"/>`;
  const { result, warnings } = run(source);
  expect(result!.code).toContain('src={"https://cdn.example.com/assets/logo.png?v=1#shape"}');
  expect(result!.code).toContain(' unoptimized ');
  expect(result!.code).toContain('width={100} height={20} alt="Logo"');
  expect(result!.map.sourcesContent).toEqual([source]);
  expect(warnings).toEqual([]);
});
it('recognizes import aliases but not shadowed bindings or unrelated Image components', () => {
  const source = `import Photo from 'next/image';const a=<Photo src={'/logo.png'}/>;function Shadow(Photo:any){return <Photo src="/logo.png"/>};function Image(){return null};const b=<Image src="/logo.png"/>;`;
  const { result } = run(source);
  expect(result!.code).toContain('src={"https://cdn.example.com/assets/logo.png"}');
  expect(result!.code).toContain('<Photo src="/logo.png"/>');
  expect(result!.code).toContain('<Image src="/logo.png"/>');
});
it('preserves explicit direct settings without adding another prop and handles non-self-closing tags', () => {
  for (const prop of ['unoptimized', 'unoptimized={true}']) {
    const { result } = run(`import Image from 'next/image';const a=<Image src={\`/logo.png\`} ${prop}></Image>`);
    expect(result!.code).toContain('https://cdn.example.com/assets/logo.png');
    expect(result!.code.match(/unoptimized/g)).toHaveLength(1);
  }
});
it('preserves explicit conflicting props and reports managed images requiring review', () => {
  for (const props of ['unoptimized={false}', 'unoptimized={choice}', 'loader={customLoader}', 'overrideSrc="/other.png"', '{...props}', 'src="/other.png"']) {
    const { result, warnings } = run(`import Image from 'next/image';const a=<Image src="/logo.png" ${props}/>`);
    expect(result).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('left unchanged');
  }
});
it('does not rewrite unknown, API, external or dynamic sources, or imported StaticImageData', () => {
  for (const src of ['"/api/photo"', '"/unknown.png"', '"https://api.example.com/photo"', '{imageFromApi}', '{importedImage}']) {
    const { result, warnings } = run(`import Image from 'next/image';const a=<Image src=${src}/>`);
    expect(result).toBeNull();
    expect(warnings).toEqual([]);
  }
});
it('preserves global optimization choices unless the element explicitly opts into direct delivery', () => {
  expect(run(`import Image from 'next/image';const a=<Image src="/logo.png"/>`, { preserveImageOptimization: true }).result).toBeNull();
  expect(run(`import Image from 'next/image';const a=<Image src="/logo.png" unoptimized/>`, { preserveImageOptimization: true }).result!.code).toContain('https://cdn.example.com/assets/logo.png');
});
it('does not enable next/image handling in the Vite/default transform', () => {
  expect(transformJs(`import Image from 'next/image';const a=<Image src="/logo.png"/>`, 'component.tsx', resolver, () => {})).toBeNull();
});
