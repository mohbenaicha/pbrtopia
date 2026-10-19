import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBroadcastVaultChannel } from '../../src/keys/vaultChannel';

afterEach(() => vi.unstubAllGlobals());

describe('createBroadcastVaultChannel', () => {
  it('R10 a change posted on one channel is heard by another channel of the same name, and not by the sender', async () => {
    const first = createBroadcastVaultChannel()!;
    const second = createBroadcastVaultChannel()!;
    const heardFirst = vi.fn();
    const heardSecond = vi.fn();
    first.onChanged(heardFirst);
    second.onChanged(heardSecond);
    first.postChanged();
    await vi.waitFor(() => expect(heardSecond).toHaveBeenCalledTimes(1));
    expect(heardFirst).not.toHaveBeenCalled();
    first.close();
    second.close();
  });

  it('R10 after unsubscribing a listener hears nothing more', async () => {
    const first = createBroadcastVaultChannel()!;
    const second = createBroadcastVaultChannel()!;
    const heard = vi.fn();
    const stop = second.onChanged(heard);
    const other = vi.fn();
    second.onChanged(other);
    stop();
    first.postChanged();
    await vi.waitFor(() => expect(other).toHaveBeenCalledTimes(1));
    expect(heard).not.toHaveBeenCalled();
    first.close();
    second.close();
  });

  it('R10 a browser without BroadcastChannel gives no channel instead of failing', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(createBroadcastVaultChannel()).toBeNull();
  });
});
