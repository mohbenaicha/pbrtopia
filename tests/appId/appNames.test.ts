import { describe, expect, it } from 'vitest';
import { projectStoreNames, validateAppId, vaultScope } from '../../src/appId';

describe('shared/materialgen-prep R8 default names', () => {
  it('R8 with no appId every name is the one the projection app has always used', () => {
    const names = projectStoreNames();
    expect(names.database).toBe('projects');
    expect(names.folder).toBe('projects');
    expect(names.zipApp).toBe('texture-lab');
    expect(names.lockName('abc')).toBe('project:abc');
    expect(names.foreignZipMessage).toBe('This zip was not made by Texture Lab.');
    expect(vaultScope()).toBe('texture-lab-keys');
  });
});

describe('shared/materialgen-prep R9 names with an appId', () => {
  it('R9 every name contains the appId and differs from every default name', () => {
    const names = projectStoreNames('mat-lab');
    const defaults = projectStoreNames();
    for (const [key, value] of Object.entries({ database: names.database, folder: names.folder, zipApp: names.zipApp, scope: vaultScope('mat-lab') })) {
      expect(value, key).toContain('mat-lab');
    }
    expect(names.database).not.toBe(defaults.database);
    expect(names.folder).not.toBe(defaults.folder);
    expect(names.zipApp).not.toBe(defaults.zipApp);
    expect(vaultScope('mat-lab')).not.toBe(vaultScope());
  });

  it('R9 the appId texture-lab still gives names that differ from the defaults', () => {
    const names = projectStoreNames('texture-lab');
    expect(names.zipApp).not.toBe('texture-lab');
    expect(names.database).not.toBe('projects');
    expect(vaultScope('texture-lab')).not.toBe('texture-lab-keys');
  });

  it('R9 the lock name is <appId>:project:<id>', () => {
    expect(projectStoreNames('mat-lab').lockName('p1')).toBe('mat-lab:project:p1');
  });

  it('R9 two appIds never share a name', () => {
    const first = projectStoreNames('alpha');
    const second = projectStoreNames('alpha-b');
    expect([first.database, first.folder, first.zipApp]).not.toEqual(expect.arrayContaining([second.database]));
    expect(first.database).not.toBe(second.database);
    expect(first.folder).not.toBe(second.folder);
    expect(first.zipApp).not.toBe(second.zipApp);
    expect(first.lockName('p')).not.toBe(second.lockName('p'));
    expect(vaultScope('alpha')).not.toBe(vaultScope('alpha-b'));
  });
});

describe('shared/materialgen-prep R13 appId rule', () => {
  it.each(['a', 'mat-lab', 'A1-b2', 'a'.repeat(32)])('R13 accepts %s', (appId) => {
    expect(() => validateAppId(appId)).not.toThrow();
  });

  it.each(['', '1abc', '-abc', 'has space', 'under_score', 'dot.ted', 'a'.repeat(33), 'café'])('R13 rejects "%s" with a message that names the rule', (appId) => {
    expect(() => validateAppId(appId)).toThrow(/1 to 32 letters, digits or hyphens, starting with a letter/);
    expect(() => projectStoreNames(appId)).toThrow(/appId/);
    expect(() => vaultScope(appId)).toThrow(/appId/);
  });
});
