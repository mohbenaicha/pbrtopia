import { describe, expect, it, vi } from 'vitest';
import { createViewportEvents } from '../../src/viewport/viewportEvents';

describe('viewportEvents', () => {
  it('R18 a subscriber hears the events it subscribed to, with the payload, and no others', () => {
    const events = createViewportEvents();
    const onProjection = vi.fn();
    const onLost = vi.fn();
    events.on('projection-changed', onProjection);
    events.on('context-lost', onLost);
    events.emit('projection-changed', 'orthographic');
    expect(onProjection).toHaveBeenCalledWith('orthographic');
    expect(onLost).not.toHaveBeenCalled();
  });

  it('R18 materialgen preview R5 the resized event reaches its subscriber (a feature that frames its own view refits on it)', () => {
    const events = createViewportEvents();
    const onResized = vi.fn();
    events.on('resized', onResized);
    events.emit('resized');
    expect(onResized).toHaveBeenCalledTimes(1);
  });

  it('R18 the function returned by on stops that subscriber only', () => {
    const events = createViewportEvents();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = events.on('context-restored', first);
    events.on('context-restored', second);
    stopFirst();
    events.emit('context-restored');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('R18 clear removes every subscriber', () => {
    const events = createViewportEvents();
    const listener = vi.fn();
    events.on('camera-change', listener);
    events.clear();
    events.emit('camera-change');
    expect(listener).not.toHaveBeenCalled();
  });

  it('R18 a subscriber that unsubscribes while an event is being delivered does not break delivery to the rest', () => {
    const events = createViewportEvents();
    const later = vi.fn();
    const stopSelf = events.on('context-lost', () => stopSelf());
    events.on('context-lost', later);
    events.emit('context-lost');
    expect(later).toHaveBeenCalledTimes(1);
  });
});
