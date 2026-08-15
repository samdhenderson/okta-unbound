/**
 * Tests for usePublishedHeight.
 *
 * jsdom implements neither `ResizeObserver` nor layout, so both are stubbed: the observer
 * so the hook can arm at all, and `getBoundingClientRect` so there is a height to publish.
 * What is actually pinned here is the contract the sticky stack depends on — which element
 * receives the variable, and that it is removed again on the way out.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePublishedHeight } from './usePublishedHeight';

type Callback = () => void;

let callbacks: Callback[] = [];
const originalResizeObserver = globalThis.ResizeObserver;

/** Element whose measured height is a fixed 48px. */
const makeNode = (height = 48): HTMLElement => {
  const node = document.createElement('div');
  node.getBoundingClientRect = () => ({ height }) as DOMRect;
  return node;
};

beforeEach(() => {
  callbacks = [];
  globalThis.ResizeObserver = class {
    constructor(callback: Callback) {
      callbacks.push(callback);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  document.documentElement.style.removeProperty('--rail-h');
  document.body.innerHTML = '';
});

describe('usePublishedHeight', () => {
  it('publishes the measured height on the document root by default', () => {
    const node = makeNode(48);
    document.body.appendChild(node);

    renderHook(() => usePublishedHeight({ current: node }, '--rail-h'));

    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('48px');
  });

  it('publishes onto the nearest matching ancestor when a scope is given', () => {
    // Every tab stays mounted (ADR-0018), so a per-tab band must not write to a shared
    // root — a hidden panel would overwrite the visible one's offset.
    const scope = document.createElement('div');
    scope.setAttribute('data-header-scope', '');
    const node = makeNode(96);
    scope.appendChild(node);
    document.body.appendChild(scope);

    renderHook(() =>
      usePublishedHeight({ current: node }, '--header-h', { scopeSelector: '[data-header-scope]' }),
    );

    expect(scope.style.getPropertyValue('--header-h')).toBe('96px');
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('');
  });

  it('republishes when the observer reports a resize', () => {
    let height = 48;
    const node = document.createElement('div');
    node.getBoundingClientRect = () => ({ height }) as DOMRect;
    document.body.appendChild(node);

    renderHook(() => usePublishedHeight({ current: node }, '--rail-h'));
    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('48px');

    height = 72;
    callbacks.forEach((cb) => cb());

    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('72px');
  });

  it('removes the variable on unmount so no stale offset is left behind', () => {
    const node = makeNode(48);
    document.body.appendChild(node);

    const { unmount } = renderHook(() => usePublishedHeight({ current: node }, '--rail-h'));
    unmount();

    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('');
  });

  it('publishes nothing while disabled', () => {
    const node = makeNode(48);
    document.body.appendChild(node);

    renderHook(() => usePublishedHeight({ current: node }, '--rail-h', { enabled: false }));

    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('');
    expect(callbacks).toHaveLength(0);
  });

  it('no-ops when the scope selector matches nothing', () => {
    const node = makeNode(48);
    document.body.appendChild(node);

    renderHook(() =>
      usePublishedHeight({ current: node }, '--header-h', { scopeSelector: '[data-nowhere]' }),
    );

    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('');
  });

  it('no-ops where ResizeObserver is unavailable rather than throwing', () => {
    // @ts-expect-error — deliberately removing the API the hook guards on.
    delete globalThis.ResizeObserver;
    const node = makeNode(48);
    document.body.appendChild(node);

    expect(() => renderHook(() => usePublishedHeight({ current: node }, '--rail-h'))).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--rail-h')).toBe('');
  });
});
