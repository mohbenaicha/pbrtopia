// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MissingFeaturesPage } from '@mat/app/capabilities/MissingFeaturesPage';
import { readBrowserCapabilityEnv } from '@mat/app/capabilities/readBrowserCapabilityEnv';

afterEach(cleanup);

describe('materialgen/app R6a missing-features page', () => {
  it('R6a lists each missing feature in one full-page alert', () => {
    render(
      <MissingFeaturesPage
        missing={[
          { id: 'opfs', ok: false, message: 'No file storage here, so projects cannot be kept.' },
          { id: 'web-workers', ok: false, message: 'No background work here, so the page would freeze.' },
        ]}
      />,
    );
    const page = screen.getByRole('alert');
    expect(within(page).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['No file storage here, so projects cannot be kept.', 'No background work here, so the page would freeze.']);
  });
});

describe('materialgen/app R6 reading the browser', () => {
  it('R6 reads the storage and worker features from the window and finds no WebGL2 in jsdom', () => {
    const env = readBrowserCapabilityEnv({
      document: { createElement: () => ({ getContext: () => null }) },
      navigator: { storage: { getDirectory: () => undefined }, locks: { request: () => undefined } },
      indexedDB: {},
      Worker: function Worker() {},
    } as unknown as Window);
    expect(env).toEqual({ gl: null, hasOpfs: true, hasIndexedDb: true, hasWebLocks: true, hasWorkers: true });
  });

  it('R6 reports each feature missing when the window lacks it', () => {
    const env = readBrowserCapabilityEnv({ document: { createElement: () => ({ getContext: () => { throw new Error('no gl'); } }) }, navigator: {} } as unknown as Window);
    expect(env).toEqual({ gl: null, hasOpfs: false, hasIndexedDb: false, hasWebLocks: false, hasWorkers: false });
  });
});
