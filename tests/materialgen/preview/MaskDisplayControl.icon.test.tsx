// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from '../../../src/ui-kit';

describe('the Material Masks icon (preview R26)', () => {
  it('TestR26_the_masks_icon_draws_the_supplied_mat_mask_picture', () => {
    render(<Icon name="masks" />);
    const icon = document.querySelector('[data-icon="masks"]') as HTMLElement;
    expect(icon.className).toContain('ui-icon--image');
    expect(icon.style.getPropertyValue('--icon-url')).toContain('mat-mask');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
