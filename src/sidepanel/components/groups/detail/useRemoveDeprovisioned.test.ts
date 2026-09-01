/**
 * @module sidepanel/components/groups/detail/useRemoveDeprovisioned.test
 * @description Tests for the group-detail rung's bulk-cleanup run state.
 *
 * The removal itself belongs to `useOktaApi/groupCleanup` and has its own suite;
 * mocked at the facade boundary here (the house pattern — this repo does not use
 * MSW) so what is under test is only this hook's three jobs: the in-flight flag,
 * the error captured off `onResult`, and the fact that `onDone` runs on the
 * failure path too. That last one is the one that matters: it is the roster
 * refresh, and a run that dies half-way through leaves the page showing members
 * Okta has already dropped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRemoveDeprovisioned } from './useRemoveDeprovisioned';
import type { OperationResult } from '../../../hooks/useOktaApi/types';

const facade = vi.hoisted(() => ({
  removeDeprovisioned: vi.fn<(groupId: string) => Promise<void>>(),
  /** The `onResult` the hook handed the facade, so a test can play a line back through it. */
  lastOnResult: null as ((result: OperationResult) => void) | null,
}));

vi.mock('../../../hooks/useOktaApi', () => ({
  useOktaApi: ({ onResult }: { onResult?: (result: OperationResult) => void }) => {
    facade.lastOnResult = onResult ?? null;
    return { removeDeprovisioned: facade.removeDeprovisioned };
  },
}));

const GROUP_ID = '00gFAKEgroup00001';

describe('useRemoveDeprovisioned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facade.lastOnResult = null;
  });

  it('calls the facade operation with the group id and clears the flag when it settles', async () => {
    let release!: () => void;
    facade.removeDeprovisioned.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const onDone = vi.fn();
    const { result } = renderHook(() => useRemoveDeprovisioned(GROUP_ID, 1, onDone));

    expect(result.current.isRemoving).toBe(false);

    act(() => result.current.run());
    expect(facade.removeDeprovisioned).toHaveBeenCalledWith(GROUP_ID);
    expect(result.current.isRemoving).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });

    expect(result.current.isRemoving).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  /*
    A rejection has to be caught, not merely `void`-ed: `.finally()` re-raises,
    so leaving it uncaught is an unhandled rejection in the panel. And since a
    throw never reached `onResult`, the confirm modal would otherwise show no
    reason at all — hence the fallback line.
  */
  it('still refreshes the roster when the operation rejects, and says so', async () => {
    facade.removeDeprovisioned.mockRejectedValue(new Error('network died'));
    const onDone = vi.fn();
    const { result } = renderHook(() => useRemoveDeprovisioned(GROUP_ID, 1, onDone));

    act(() => result.current.run());

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(result.current.isRemoving).toBe(false);
    expect(result.current.error).toMatch(/Removal failed/);
  });

  it("keeps the operation's error line, and ignores its non-error chatter", async () => {
    facade.removeDeprovisioned.mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveDeprovisioned(GROUP_ID, 1, vi.fn()));

    act(() => {
      facade.lastOnResult?.({ message: 'Found 3 deprovisioned users', type: 'warning' });
      facade.lastOnResult?.({ message: 'Removed: ada@example.com', type: 'success' });
    });
    expect(result.current.error).toBeNull();

    act(() => {
      facade.lastOnResult?.({ message: '403 Forbidden: grace@example.com', type: 'error' });
    });
    expect(result.current.error).toBe('403 Forbidden: grace@example.com');

    // A fresh run starts from a clean slate rather than showing the last one's failure.
    await act(async () => {
      result.current.run();
    });
    expect(result.current.error).toBeNull();
  });
});
