/**
 * Tests for OrgEntityIndexContext — the panel's single mount of the org
 * snapshot index.
 *
 * The subject is a **count**, not a rendering. `useOrgEntityIndexSource` opens
 * four `useOrgSnapshot` reads and registers four `snapshotUpdated` listeners,
 * and for a while two surfaces each opened their own set: Home mounted one and
 * the ⌘K palette mounted a second, so one org's four collections cost eight
 * reads and eight listeners (`I-033`). These cases pin that rendering the two
 * real surfaces together opens **one** set.
 *
 * `useOrgSnapshot` is mocked, which is also the instrument: the number of times
 * it is called is the whole assertion. `useOktaApi` is mocked because neither
 * surface's request path is under test here, and a real facade would drag the
 * scheduler context in with it.
 *
 * All ids and origins are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { UseOrgSnapshotResult } from '../cache/useOrgSnapshot';

const useOrgSnapshot = vi.fn();
vi.mock('../cache/useOrgSnapshot', () => ({
  useOrgSnapshot: (...args: unknown[]) => useOrgSnapshot(...args),
}));

vi.mock('../hooks/useOktaApi', () => ({
  useOktaApi: () => ({}),
}));

const { OrgEntityIndexProvider, useOrgEntityIndex } = await import('./OrgEntityIndexContext');
const { default: HomeTab } = await import('../components/HomeTab');
const { default: CommandPalette } = await import('../components/CommandPalette');

const ORIGIN = 'https://example.okta.com';

/** The four collections one mount of the index reads. */
const COLLECTIONS = ['groups', 'rules', 'apps', 'appGroups'];

/** An empty snapshot handle — the cases here count reads, they do not read rows. */
function emptySnapshot(): UseOrgSnapshotResult<never> {
  return {
    rows: [],
    records: [],
    isReading: false,
    complete: true,
    lastFullWalkAt: 1,
    isSyncing: false,
    lastError: null,
    lastStatus: null,
    refresh: vi.fn(),
  } as unknown as UseOrgSnapshotResult<never>;
}

/** Which collections `useOrgSnapshot` was asked for, in call order. */
const requested = (): string[] => useOrgSnapshot.mock.calls.map((call) => call[0] as string);

beforeEach(() => {
  useOrgSnapshot.mockReset();
  // One handle per collection, reused across renders. The real hook's result is
  // stable while nothing changes, and an unstable stub would send every consumer
  // memoized on the index into a re-render loop — a property of the stub, not of
  // the subject.
  const handles = new Map<string, UseOrgSnapshotResult<never>>();
  useOrgSnapshot.mockImplementation((collection: string) => {
    const held = handles.get(collection) ?? emptySnapshot();
    handles.set(collection, held);
    return held;
  });
});

/**
 * Home and the ⌘K palette, mounted together the way the shell mounts them.
 *
 * `act` is awaited because Home's working-set store resolves after mount; the
 * reads under test are all opened synchronously on the first render, but letting
 * the tail settle keeps the console free of `act` warnings that belong to a
 * different subject.
 */
async function renderShell({ enabled = true }: { enabled?: boolean } = {}) {
  await act(async () => {
    render(
      <OrgEntityIndexProvider oktaOrigin={ORIGIN} targetTabId={1} enabled={enabled}>
        <HomeTab
          isActive
          targetTabId={1}
          oktaOrigin={ORIGIN}
          onOpenListView={vi.fn()}
          onOpenTab={vi.fn()}
          onScanGroupMfa={vi.fn()}
        />
        <CommandPalette
          isOpen={false}
          onClose={vi.fn()}
          activeTab="home"
          onSelect={vi.fn()}
          targetTabId={1}
          oktaOrigin={ORIGIN}
        />
      </OrgEntityIndexProvider>,
    );
  });
}

describe('OrgEntityIndexProvider', () => {
  it('opens one set of snapshot reads for Home and the palette together', async () => {
    await renderShell();

    // Four collections, each asked for exactly once — not once per surface.
    expect(requested().sort()).toEqual([...COLLECTIONS].sort());
    for (const collection of COLLECTIONS) {
      expect(requested().filter((name) => name === collection)).toHaveLength(1);
    }
  });

  it('scopes every read to the provider’s origin and tab', async () => {
    await renderShell();

    for (const call of useOrgSnapshot.mock.calls) {
      expect(call[1]).toBe(ORIGIN);
      expect(call[2]).toBe(1);
    }
  });

  it('passes its own enabled through, so a closed palette on a hidden Home syncs nothing', async () => {
    await renderShell({ enabled: false });

    for (const call of useOrgSnapshot.mock.calls) {
      expect(call[3]).toEqual({ enabled: false });
    }
  });
});

describe('useOrgEntityIndex', () => {
  it('throws outside a provider rather than answering from an empty index', () => {
    const Consumer = () => {
      useOrgEntityIndex();
      return null;
    };
    // React logs the thrown render error; the assertion is the throw itself.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/OrgEntityIndexProvider/);
    consoleError.mockRestore();
  });
});
