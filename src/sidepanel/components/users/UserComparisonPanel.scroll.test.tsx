/**
 * @module sidepanel/components/users/UserComparisonPanel.scroll.test
 * @description The comparison rung's scroll offset across a push/pop cycle (I-005).
 *
 * The comparison owns no scroll box — it scrolls the app root scroller, shared with
 * the detail rung it is pushed on top of and with every other tab. So the offset the
 * admin sees when the comparison arrives is whatever the *other* rung last left
 * there, unless the panel preserves its own. That is what these tests pin: the two
 * user-visible consequences (a first push opens at the top; a return lands where the
 * comparison was left), never the wiring that produces them.
 *
 * Same shape as `GroupsTab.navigation.test.tsx`'s scroll case: jsdom does no layout,
 * so `scrollTop` is a permanently read-only `0` until it is redefined as a writable
 * data property, and the hide is simulated the way the Users tab performs it.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import UserComparisonPanel from './UserComparisonPanel';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { OktaUser } from '../../../shared/types';

// The panel's state source, stubbed: what is under test is the DOM scroll offset the
// panel preserves, not anything the hook computes. `comparisonState` is a hoisted
// function declaration, so the mock factory can reach it even though the factory is
// evaluated before this module's bindings are initialised.
vi.mock('../../hooks/useUserComparison', () => ({
  useUserComparison: () => comparisonState(),
}));

const contextUser: OktaUser = {
  id: 'ctx-1',
  status: 'ACTIVE',
  profile: {
    login: 'alice@example.com',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Context',
  },
};

/** An idle, per-column attribute editor — nothing here is exercised. */
const idleSide = (
  key: 'context' | 'compared',
): UserComparisonState['attributeEdit']['context'] => ({
  key,
  userName: 'Alice Context',
  cells: {},
  isEditing: false,
  isSaving: false,
  hasChanges: false,
  hasInvalid: false,
  canEdit: false,
  begin: vi.fn(),
  cancel: vi.fn(),
  requestSave: vi.fn(),
});

/** The search phase, as `useUserComparison` returns it before a user is picked. */
function comparisonState(): UserComparisonState {
  return {
    comparedUser: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchResults: [],
    isSearching: false,
    activeTab: 'overview',
    setActiveTab: vi.fn(),
    groupBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
    appBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
    causes: undefined,
    groupDiffCount: 0,
    appDiffCount: 0,
    attributeParity: { rows: [], hiddenRows: [], hiddenDifferences: 0, differenceCount: 0 },
    attributeDiffCount: 0,
    attributeConfig: DEFAULT_PROFILE_DISPLAY_CONFIG,
    attributeRuleReads: {},
    attributeEdit: {
      context: idleSide('context'),
      compared: idleSide('compared'),
      pendingSave: null,
    },
    groupSimilarity: 0,
    appSimilarity: 0,
    overallSimilarity: 0,
    similarityScope: 'both',
    appsIncomplete: false,
    isLoading: false,
    loadError: null,
    addingGroupId: null,
    addError: null,
    setAddError: vi.fn(),
    addToContext: vi.fn(),
    addToCompared: vi.fn(),
    contextName: 'Alice Context',
    comparedName: '',
    resolveGroupName: () => undefined,
    selectUser: vi.fn(),
    changeUser: vi.fn(),
  };
}

/**
 * The Users tab in miniature: one scroller (the app root), and a rung that is hidden
 * with a class swap rather than unmounted (ADR-0016).
 */
const Harness: React.FC<{ onScreen: boolean }> = ({ onScreen }) => (
  <div data-testid="scroller" style={{ overflowY: 'auto' }}>
    <div className={onScreen ? '' : 'hidden'}>
      <UserComparisonPanel
        isActive={onScreen}
        searchEnabled={onScreen}
        contextUser={contextUser}
        contextGroups={[]}
        targetTabId={1}
        onGroupsChanged={vi.fn()}
      />
    </div>
  </div>
);

/** The shared scroller, with a `scrollTop` jsdom will actually let us read back. */
function scroller(): HTMLElement {
  const node = screen.getByTestId('scroller');
  if (!Object.getOwnPropertyDescriptor(node, 'scrollTop')) {
    Object.defineProperty(node, 'scrollTop', { value: 0, writable: true, configurable: true });
  }
  return node;
}

/** Move the shared scroller and let the passive mirror observe it. */
function scrollTo(node: HTMLElement, top: number) {
  node.scrollTop = top;
  fireEvent.scroll(node);
}

describe('UserComparisonPanel scroll preservation', () => {
  it('opens at the top when pushed onto a scroller the previous rung left part-way down', () => {
    const { rerender } = render(<Harness onScreen={false} />);
    const node = scroller();

    // The detail rung the comparison is pushed from, scrolled well down.
    node.scrollTop = 800;

    rerender(<Harness onScreen={true} />);

    expect(node.scrollTop).toBe(0);
  });

  it('returns to the offset the comparison was left at, not the one the other rung left', () => {
    const { rerender } = render(<Harness onScreen={false} />);
    const node = scroller();

    rerender(<Harness onScreen={true} />);
    scrollTo(node, 240);

    // Pop: the comparison is hidden and the detail rung takes the shared scroller
    // somewhere else entirely.
    rerender(<Harness onScreen={false} />);
    scrollTo(node, 900);

    rerender(<Harness onScreen={true} />);

    expect(node.scrollTop).toBe(240);
  });
});
