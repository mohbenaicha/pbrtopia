// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsGroup } from '../../../src/shell/settings/SettingsGroup';
import { SettingsPage } from '../../../src/shell/settings/SettingsPage';
import { SettingsRow } from '../../../src/shell/settings/SettingsRow';

afterEach(cleanup);

describe('settings page structure', () => {
  it('settings R12 a section is a titled page: the title, one line of description under it, then its groups', () => {
    render(
      <SettingsPage title="Models" description="Pick the prompt enhancer.">
        <SettingsGroup title="Prompt enhancer">
          <p>row</p>
        </SettingsGroup>
      </SettingsPage>,
    );
    const page = screen.getByRole('region', { name: 'Models' });
    expect(within(page).getByRole('heading', { level: 2, name: 'Models' })).toBeTruthy();
    const description = within(page).getByText('Pick the prompt enhancer.');
    const heading = within(page).getByRole('heading', { level: 2 });
    expect(heading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(page).getByRole('group', { name: 'Prompt enhancer' })).toBeTruthy();
  });

  it('settings R12 a group is named by its heading and may carry a hint line under it', () => {
    render(
      <SettingsGroup title="Model list" hint="Used by the enhancer.">
        <p>row</p>
      </SettingsGroup>,
    );
    const group = screen.getByRole('group', { name: 'Model list' });
    expect(within(group).getByRole('heading', { level: 3, name: 'Model list' })).toBeTruthy();
    expect(within(group).getByText('Used by the enhancer.')).toBeTruthy();
  });

  it('settings R12 a button that acts on the whole group sits in its own last row, after the rows, and messages show under the rows', () => {
    render(
      <SettingsGroup title="Storage" actions={<button type="button">Keep my data</button>} messages={<p role="status">Saved.</p>}>
        <p>first row</p>
      </SettingsGroup>,
    );
    const group = screen.getByRole('group', { name: 'Storage' });
    const row = within(group).getByText('first row');
    const messages = within(group).getByRole('status');
    const actions = within(group).getByRole('button', { name: 'Keep my data' });
    expect(row.compareDocumentPosition(messages) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(messages.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions.closest('[data-actions]')).not.toBeNull();
  });

  it('settings R12 a group with no actions and no messages draws neither', () => {
    const { container } = render(
      <SettingsGroup title="Plain">
        <p>row</p>
      </SettingsGroup>,
    );
    expect(container.querySelector('[data-actions]')).toBeNull();
    expect(container.querySelector('[data-messages]')).toBeNull();
  });

  it('settings R12 a row has its label (and hint) on the left and its control on the right', () => {
    render(
      <SettingsRow label="Prompt enhancer model" hint="Reads your picture.">
        <input aria-label="field" />
      </SettingsRow>,
    );
    const label = screen.getByText('Prompt enhancer model');
    const control = screen.getByLabelText('field');
    expect(label.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Reads your picture.')).toBeTruthy();
    expect(label.closest('[data-label]')).not.toBeNull();
    expect(control.closest('[data-control]')).not.toBeNull();
  });

  it('settings R12 a row without a hint draws no hint line', () => {
    const { container } = render(
      <SettingsRow label="Plain">
        <input aria-label="field" />
      </SettingsRow>,
    );
    expect(container.querySelector('[data-hint]')).toBeNull();
  });
});
