import { describe, expect, it } from 'vitest';
import { parseDescribedComponents, parseMasksRecord, serializeDescribedComponents } from '@shared/materialMasks';

const components = [
  { name: 'Wall', description: 'red brick', location: 'left' },
  { name: 'Plate', description: 'steel', location: 'right' },
  { name: 'Moss', description: 'green', location: 'bottom' },
];

describe('materialgen/masks described components (R8a R8b)', () => {
  it('R8a the saved components read back for the albedo they were made from', () => {
    const raw = serializeDescribedComponents('albedo-1', components);
    expect(parseDescribedComponents(raw, 'albedo-1')).toEqual(components);
  });

  it('R8a the saved field is not a masks record, so the panel still shows nothing', () => {
    expect(parseMasksRecord(serializeDescribedComponents('albedo-1', components))).toBeNull();
  });

  it('R8b components made from another albedo are not used', () => {
    expect(parseDescribedComponents(serializeDescribedComponents('albedo-1', components), 'albedo-2')).toBeNull();
  });

  it('R8b a saved list with fewer than 3 or more than 10 components, or bad fields, is not used', () => {
    expect(parseDescribedComponents(serializeDescribedComponents('a', components.slice(0, 2)), 'a')).toBeNull();
    const many = Array.from({ length: 11 }, (_, index) => ({ name: `C${index}`, description: '', location: '' }));
    expect(parseDescribedComponents(serializeDescribedComponents('a', many), 'a')).toBeNull();
    expect(parseDescribedComponents({ source: 'model', described: { albedoKey: 'a', components: [1, 2, 3] } }, 'a')).toBeNull();
    expect(parseDescribedComponents({ source: 'model' }, 'a')).toBeNull();
    expect(parseDescribedComponents(undefined, 'a')).toBeNull();
  });
});

describe('material-masks-core described components limits', () => {
  it('material-masks-core R6 two saved components are read under limits 2 to 10 and refused under the default 3 to 10', () => {
    const raw = serializeDescribedComponents('albedo-1', components.slice(0, 2));
    expect(parseDescribedComponents(raw, 'albedo-1', { min: 2, max: 10 })).toHaveLength(2);
    expect(parseDescribedComponents(raw, 'albedo-1')).toBeNull();
  });
});
