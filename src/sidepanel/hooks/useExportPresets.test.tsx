/**
 * @module sidepanel/hooks/useExportPresets.test
 * @description Unit tests for the Export tab's preset-binding hook.
 *
 * The underlying {@link presetStore} is mocked, so these tests pin the hook's own
 * behavior: it loads presets on mount, `save`/`remove` call through and refresh
 * the in-memory list, `reconcile` drops column ids absent from the current
 * catalog, and `loadLastUsed` returns the reconciled selection (stripping a
 * persisted id that no longer exists) or `null` when nothing is stored.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExportPresets } from './useExportPresets';
import { presetStore, type ExportPreset } from '@/shared/storage/presetStore';

vi.mock('@/shared/storage/presetStore', () => ({
  presetStore: {
    listPresets: vi.fn(),
    savePreset: vi.fn(),
    deletePreset: vi.fn(),
    getLastUsed: vi.fn(),
    setLastUsed: vi.fn(),
  },
}));

const mockedStore = vi.mocked(presetStore);

const VALID_IDS = ['id', 'email', 'status'];

function makePreset(overrides: Partial<ExportPreset> = {}): ExportPreset {
  return {
    id: 'preset-1',
    entityId: 'users',
    name: 'Audit',
    enabledColumnIds: ['id', 'email'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedStore.listPresets.mockResolvedValue([]);
  mockedStore.savePreset.mockResolvedValue(makePreset());
  mockedStore.deletePreset.mockResolvedValue(undefined);
  mockedStore.getLastUsed.mockResolvedValue(null);
  mockedStore.setLastUsed.mockResolvedValue(undefined);
});

describe('useExportPresets loading', () => {
  it('loads presets for the entity on mount', async () => {
    const preset = makePreset();
    mockedStore.listPresets.mockResolvedValue([preset]);

    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));

    await waitFor(() => expect(result.current.presets).toEqual([preset]));
    expect(mockedStore.listPresets).toHaveBeenCalledWith('users');
  });
});

describe('useExportPresets mutations', () => {
  it('save calls through and refreshes the list', async () => {
    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));
    await waitFor(() => expect(mockedStore.listPresets).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.save('New', ['id'], 'status eq "ACTIVE"');
    });

    expect(mockedStore.savePreset).toHaveBeenCalledWith({
      entityId: 'users',
      name: 'New',
      enabledColumnIds: ['id'],
      filterText: 'status eq "ACTIVE"',
    });
    // Mount load + post-save refresh.
    expect(mockedStore.listPresets).toHaveBeenCalledTimes(2);
  });

  it('remove calls through and refreshes the list', async () => {
    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));
    await waitFor(() => expect(mockedStore.listPresets).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.remove('preset-1');
    });

    expect(mockedStore.deletePreset).toHaveBeenCalledWith('preset-1');
    expect(mockedStore.listPresets).toHaveBeenCalledTimes(2);
  });
});

describe('useExportPresets reconciliation', () => {
  it('reconcile drops ids not in the current catalog', async () => {
    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));
    await waitFor(() => expect(mockedStore.listPresets).toHaveBeenCalled());

    expect(result.current.reconcile(['id', 'bogus', 'status'])).toEqual(['id', 'status']);
  });

  it('loadLastUsed returns the reconciled selection, stripping unknown ids', async () => {
    mockedStore.getLastUsed.mockResolvedValue({
      entityId: 'users',
      enabledColumnIds: ['id', 'gone', 'email'],
      updatedAt: new Date(),
    });

    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));
    await waitFor(() => expect(mockedStore.listPresets).toHaveBeenCalled());

    let loaded: { enabledColumnIds: string[] } | null = null;
    await act(async () => {
      loaded = await result.current.loadLastUsed();
    });

    expect(loaded).toEqual({ enabledColumnIds: ['id', 'email'] });
  });

  it('loadLastUsed returns null when nothing is stored', async () => {
    mockedStore.getLastUsed.mockResolvedValue(null);

    const { result } = renderHook(() => useExportPresets('users', VALID_IDS));
    await waitFor(() => expect(mockedStore.listPresets).toHaveBeenCalled());

    let loaded: { enabledColumnIds: string[] } | null = {
      enabledColumnIds: [],
    };
    await act(async () => {
      loaded = await result.current.loadLastUsed();
    });

    expect(loaded).toBeNull();
  });
});
