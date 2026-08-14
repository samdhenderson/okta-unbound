/**
 * @module sidepanel/hooks/useOwedLoad.test
 * @description Behaviour of the owed-load latch — the two bugs it exists to prevent
 * (dropping a load whose input changed while hidden; refetching on every reshow),
 * plus the case the boolean idiom it replaces got wrong.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOwedLoad } from './useOwedLoad';

/** Render the latch with `identity`/`ready` as props so both can be driven. */
const renderLatch = (run: () => void, initial: { id: string | null; ready: boolean }) =>
  renderHook(
    ({ id, ready }: { id: string | null; ready: boolean }) => useOwedLoad(id, ready, run),
    {
      initialProps: initial,
    },
  );

describe('useOwedLoad', () => {
  it('runs once when ready, and not again for the same identity', () => {
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);

    rerender({ id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run while not ready', () => {
    const run = vi.fn();
    renderLatch(run, { id: 'a', ready: false });
    expect(run).not.toHaveBeenCalled();
  });

  it('defers rather than drops: a load owed while hidden runs on becoming ready', () => {
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: 'a', ready: false });
    expect(run).not.toHaveBeenCalled();

    // Input changed while hidden — the naive `if (!ready) return` loses this.
    rerender({ id: 'b', ready: false });
    expect(run).not.toHaveBeenCalled();

    rerender({ id: 'b', ready: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not re-run on a bare hide/show with the identity unchanged', () => {
    // The quieter of the two bugs: gating on `ready` alone turns every tab revisit
    // into a refetch.
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);

    rerender({ id: 'a', ready: false });
    rerender({ id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again when the identity genuinely changes', () => {
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: 'a', ready: true });
    rerender({ id: 'b', ready: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('skips a round trip when the identity returns to one already paid for', () => {
    // This is where the comparison idiom beats the boolean `owedRef` it replaces:
    // a boolean only knows "something is owed" and would re-run for `a`.
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);

    rerender({ id: 'a', ready: false });
    rerender({ id: 'b', ready: false });
    rerender({ id: 'a', ready: false });
    rerender({ id: 'a', ready: true });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never runs for a null identity, however ready', () => {
    const run = vi.fn();
    const { rerender } = renderLatch(run, { id: null, ready: true });
    expect(run).not.toHaveBeenCalled();

    // …and picks up normally once the input resolves.
    rerender({ id: 'a', ready: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reads the callback through a ref, so a fresh closure does not re-trigger', () => {
    // Callers pass inline closures. Re-running because the closure's captured
    // values changed is exactly what the latch exists to prevent.
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ run }: { run: () => void }) => useOwedLoad('a', true, run), {
      initialProps: { run: first },
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ run: second });
    expect(second).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('calls the latest callback when a real identity change does trigger', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ id, run }: { id: string; run: () => void }) => useOwedLoad(id, true, run),
      { initialProps: { id: 'a', run: first } },
    );
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ id: 'b', run: second });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
