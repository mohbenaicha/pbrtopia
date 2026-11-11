import { describe, expect, it } from 'vitest';
import * as viaRelative from '../../../src/ui-kit/imageView';
import * as viaMatAlias from '@mat/maps/mapKinds';
import * as viaMatRelative from '../../../src/materialgen/maps/mapKinds';
import * as viaSharedAlias from '@shared/ui-kit/imageView';

describe('shared/materialgen-prep R1 R2 aliases', () => {
  it('R1 @shared/<path> is the same module instance as the relative path into src', () => {
    expect(viaSharedAlias).toBe(viaRelative);
  });

  it('R2 @mat/<path> is the same module instance as the path into src/materialgen', () => {
    expect(viaMatAlias).toBe(viaMatRelative);
  });
});
