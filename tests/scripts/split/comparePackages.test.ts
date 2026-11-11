import { describe, expect, it } from 'vitest';
import { comparePackages, type PackageManifest } from '../../../scripts/split/comparePackages';

const manifest = (dependencies: Record<string, string>, devDependencies: Record<string, string> = {}): PackageManifest => ({ dependencies, devDependencies });

describe('materialgen/app R49 comparePackages', () => {
  it('R49 passes when every used package is declared with the version the upstream declares', () => {
    const own = manifest({ react: '19.3.1', three: '0.170.0' });
    expect(comparePackages(['react', 'three'], own, own)).toEqual([]);
  });

  it('R49 names each used package the own manifest does not declare', () => {
    const problems = comparePackages(['react', 'zustand', 'fflate'], manifest({ react: '19.3.1' }), manifest({ react: '19.3.1' }));
    expect(problems).toEqual(['missing: fflate is imported but not declared in package.json', 'missing: zustand is imported but not declared in package.json']);
  });

  it('R49 names a used package whose version differs from the upstream manifest, with both versions', () => {
    const problems = comparePackages(['three'], manifest({ three: '0.171.0' }), manifest({ three: '0.170.0' }));
    expect(problems).toEqual(['mismatch: three is 0.171.0 here but 0.170.0 upstream']);
  });

  it('R49 finds a package declared among the dev dependencies on either side', () => {
    const own = manifest({}, { vitest: '4.1.0' });
    expect(comparePackages(['vitest'], own, manifest({ react: '1' }, { vitest: '4.1.0' }))).toEqual([]);
  });

  it('R49 a used package the upstream does not declare is reported as missing upstream', () => {
    const problems = comparePackages(['fflate'], manifest({ fflate: '0.8.3' }), manifest({ react: '19.3.1' }));
    expect(problems).toEqual(['missing: fflate is not declared in the upstream package.json']);
  });

  it('R49 reports no problem for an empty package list', () => {
    expect(comparePackages([], manifest({}), manifest({}))).toEqual([]);
  });
});
