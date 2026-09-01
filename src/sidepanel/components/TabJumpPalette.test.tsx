/**
 * Tests for the ⌘K jump-to palette and the shell-owned shortcut behind it.
 *
 * Two contracts are pinned here:
 *
 * 1. **The palette navigates.** It filters the nine top-level sections by
 *    label, tells you which one you are already on, and hands the chosen id back
 *    through the same `onTabChange` path the icon rail uses before closing.
 * 2. **The keyboard model is roving focus, not a combobox.** The shared `Input`
 *    exposes no `role`/`aria-activedescendant` passthrough, so the palette moves
 *    real focus onto real `<button>` rows instead: Down leaves the field, Up/Down
 *    move within the list, Up off the top returns to the field, and exactly one
 *    row is in the tab order at a time.
 *
 * 3. **The entity half is layered on, not merged in.** Section rows keep
 *    filtering synchronously while org results arrive on the container's
 *    schedule, both live in one flat roving-focus list, and the sections-only
 *    palette — every prop below `onSelect` omitted — behaves exactly as it did
 *    before entity search existed. That last property is why every assertion in
 *    blocks 1 and 2 is unchanged.
 *
 * The shortcut itself is exercised through a harness that wires
 * `useCommandPalette` the way `App` does, because the listener's whole reason for
 * living in the shell is that it must be registered exactly once (ADR-0018 keeps
 * every tab mounted).
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabJumpPalette from './TabJumpPalette';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { TAB_DEFS, type TabType } from '../tabs';
import type { JumpResult } from '../hooks/useJumpResolver';

const onSelect = vi.fn();
const onClose = vi.fn();
const onEntitySelect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

/** Render the palette in isolation with controllable props. */
function renderPalette(props: Partial<React.ComponentProps<typeof TabJumpPalette>> = {}) {
  return render(
    <TabJumpPalette isOpen onClose={onClose} activeTab="home" onSelect={onSelect} {...props} />,
  );
}

/** The search field. Named, not labelled, because it sits inline in the panel. */
const field = () => screen.getByRole('searchbox', { name: 'Search sections' });

/**
 * The palette's sr-only announcement. Matched on its class rather than its role:
 * `LoadingSpinner` also carries `role="status"`, so during a search there are two.
 */
const announcement = () => screen.getByText(/sections? available/, { selector: 'p.sr-only' });

/** Every result row, in render order (the modal's own close button excluded). */
const rows = () =>
  screen.getAllByRole('button').filter((el) => el.getAttribute('aria-label') !== 'Close modal');

/** One result row, matched on its visible label. */
const row = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });

/** Two entity results in two kinds, enough to exercise section boundaries. */
const ENTITY_RESULTS: JumpResult[] = [
  { kind: 'group', id: '00gFAKE0000000000001', name: 'Engineering', secondary: 'All engineers' },
  { kind: 'user', id: '00uFAKE0000000000001', name: 'Ada Lovelace', secondary: 'ada@example.com' },
];

/** The palette with its entity half wired, as `CommandPalette` supplies it. */
function renderWithEntities(props: Partial<React.ComponentProps<typeof TabJumpPalette>> = {}) {
  return renderPalette({
    onEntityQueryChange: vi.fn(),
    entityMode: 'results',
    entityResults: ENTITY_RESULTS,
    onEntitySelect: onEntitySelect,
    canReach: () => true,
    ...props,
  });
}

describe('TabJumpPalette', () => {
  describe('rendering and filtering', () => {
    it('renders every top-level section when opened with an empty query', () => {
      renderPalette();

      expect(screen.getByRole('dialog')).toHaveAccessibleName('Jump to section');
      for (const tab of TAB_DEFS) {
        expect(row(tab.label)).toBeInTheDocument();
      }
      expect(rows()).toHaveLength(TAB_DEFS.length);
    });

    it('renders nothing while closed', () => {
      renderPalette({ isOpen: false });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('filters to a case-insensitive substring match on the label', async () => {
      renderPalette();

      // Uppercase query, and "or" appears mid-label in all three matches — so
      // this pins case-insensitivity and substring (not prefix) matching at once.
      await userEvent.type(field(), 'OR');

      expect(row('Export')).toBeInTheDocument();
      expect(row('Explorer')).toBeInTheDocument();
      expect(row('History')).toBeInTheDocument();
      expect(rows()).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /^Overview/ })).toBeNull();
    });

    it('shows the shared empty state when nothing matches', async () => {
      renderPalette();

      await userEvent.type(field(), 'zzz');

      expect(screen.getByText('No sections match')).toBeInTheDocument();
      expect(rows()).toHaveLength(0);
    });

    it('marks the active section with aria-current and a visible label', () => {
      renderPalette({ activeTab: 'groups' });

      expect(row('Groups')).toHaveAttribute('aria-current', 'page');
      expect(row('Groups')).toHaveTextContent('Current');
      expect(row('Users')).not.toHaveAttribute('aria-current');
    });

    it('starts each open from a clean query', async () => {
      const { rerender } = renderPalette();
      await userEvent.type(field(), 'export');
      expect(rows()).toHaveLength(1);

      rerender(
        <TabJumpPalette isOpen={false} onClose={onClose} activeTab="home" onSelect={onSelect} />,
      );
      rerender(<TabJumpPalette isOpen onClose={onClose} activeTab="home" onSelect={onSelect} />);

      expect(field()).toHaveValue('');
      expect(rows()).toHaveLength(TAB_DEFS.length);
    });
  });

  describe('selection', () => {
    it('reports the chosen section and closes the palette', async () => {
      renderPalette();

      await userEvent.click(row('Policies'));

      expect(onSelect).toHaveBeenCalledWith('policies');
      expect(onClose).toHaveBeenCalled();
    });

    it('jumps to the top result on Enter in the search field', async () => {
      renderPalette();

      await userEvent.type(field(), 'hist{Enter}');

      expect(onSelect).toHaveBeenCalledWith('history');
      expect(onClose).toHaveBeenCalled();
    });

    it('does nothing on Enter when nothing matches', async () => {
      renderPalette();

      await userEvent.type(field(), 'zzz{Enter}');

      expect(onSelect).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('keyboard model (roving focus)', () => {
    // CHARACTERIZED, and moved here from `UserComparisonModal.test.tsx` when that
    // modal was deleted with the Overview tab. It pinned the same outcome on the
    // modal this palette replaced, and this is where the behaviour actually
    // matters: `TabJumpPalette` defers its focus by a tick *because* of it, and a
    // future "simplify" that passes `autoFocus` to the field instead would put
    // the caret on Close.
    it('CHARACTERIZED: shared Modal takes focus first, on the synchronous commit', () => {
      renderPalette();

      // A child's effects (and React's `autoFocus`) all run before its parent's,
      // so at this point Modal's own effect has already claimed the caret.
      expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
    });

    it('focuses the search field on open, ahead of the modal header button', async () => {
      renderPalette();

      // Deferred by a tick on purpose, which is what wins the race above.
      await waitFor(() => expect(field()).toHaveFocus());
    });

    // Addressed by position in TAB_DEFS rather than by tab name: the subject is
    // the roving-focus model, not which sections happen to exist. Naming rows
    // pinned the registry's contents to this file, so adding or removing a tab
    // broke a keyboard test that has nothing to do with either.
    it('moves focus into the list on ArrowDown and back to the field on ArrowUp', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      await userEvent.keyboard('{ArrowDown}');
      expect(row(TAB_DEFS[0].label)).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      expect(row(TAB_DEFS[1].label)).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      expect(row(TAB_DEFS[0].label)).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      expect(field()).toHaveFocus();
    });

    it('wraps from the last row to the first, and reaches the last row via ArrowUp from the field', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      await userEvent.keyboard('{ArrowUp}');
      const last = TAB_DEFS[TAB_DEFS.length - 1];
      expect(row(last.label)).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      expect(row(TAB_DEFS[0].label)).toHaveFocus();
    });

    it('activates the focused row with Enter', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

      expect(onSelect).toHaveBeenCalledWith(TAB_DEFS[1].id);
      expect(onClose).toHaveBeenCalled();
    });

    it('keeps exactly one row in the tab order and moves the anchor with focus', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      const tabbable = () => rows().filter((el) => el.getAttribute('tabindex') === '0');
      expect(tabbable()).toHaveLength(1);
      expect(tabbable()[0]).toBe(row(TAB_DEFS[0].label));

      await userEvent.keyboard('{ArrowDown}{ArrowDown}');

      expect(tabbable()).toHaveLength(1);
      expect(tabbable()[0]).toBe(row(TAB_DEFS[1].label));
    });

    it('re-anchors the tab order to the top row when the query changes', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());
      await userEvent.keyboard('{ArrowDown}{ArrowDown}');
      expect(row(TAB_DEFS[1].label)).toHaveAttribute('tabindex', '0');

      await userEvent.click(field());
      await userEvent.type(field(), 'o');

      expect(rows()[0]).toHaveAttribute('tabindex', '0');
    });

    it('announces the number of matching sections', async () => {
      renderPalette();

      expect(screen.getByRole('status')).toHaveTextContent(`${TAB_DEFS.length} sections available`);

      await userEvent.type(field(), 'export');

      expect(screen.getByRole('status')).toHaveTextContent('1 section available');
    });
  });
});

/** Wires the hook to the palette exactly the way `App` does. */
const Harness: React.FC = () => {
  const palette = useCommandPalette();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  return (
    <>
      <p data-testid="active-tab">{activeTab}</p>
      <TabJumpPalette
        isOpen={palette.isOpen}
        onClose={palette.close}
        activeTab={activeTab}
        onSelect={(tab) => {
          setActiveTab(tab);
          onSelect(tab);
        }}
      />
    </>
  );
};

describe('useCommandPalette (shell-owned shortcut)', () => {
  it('opens the palette on Meta+K and suppresses the browser default', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();

    const notPrevented = fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(notPrevented).toBe(false);
  });

  it('opens on Ctrl+K too', () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles shut on a second press', () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores a bare k, a modified k with Alt, and auto-repeat', () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: 'k' });
    fireEvent.keyDown(window, { key: 'k', metaKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 'k', metaKey: true, repeat: true });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', async () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(field()).toHaveFocus());

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('navigates to the chosen section and closes, end to end', async () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(field()).toHaveFocus());

    await userEvent.type(field(), 'appl');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByTestId('active-tab')).toHaveTextContent('home');
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.type(field(), '{Backspace}{Backspace}{Backspace}{Backspace}rul{Enter}');

    expect(onSelect).toHaveBeenCalledWith('rules');
    await waitFor(() => expect(screen.getByTestId('active-tab')).toHaveTextContent('rules'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('registers exactly one window listener regardless of how often it re-renders', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { rerender } = render(<Harness />);
    rerender(<Harness />);

    const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === 'keydown');

    expect(keydownRegistrations).toHaveLength(1);
    addSpy.mockRestore();
  });
});

describe('TabJumpPalette entity search', () => {
  it('renders entity rows under their section headings, after the sections', () => {
    renderWithEntities();

    // Sections keep their place at the top: the palette is still primarily a
    // jump-to, and the org search is layered under it.
    expect(rows()[0]).toHaveTextContent('Home');
    expect(screen.getByText('Groups', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('Users', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Engineering/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ada Lovelace/ })).toBeInTheDocument();
  });

  it('names an entity row\u2019s destination in its accessible name', () => {
    renderWithEntities();

    // "Engineering" alone does not say where the row goes.
    expect(
      screen.getByRole('button', { name: 'Engineering \u2014 open in Groups' }),
    ).toBeInTheDocument();
  });

  it('walks Down out of the last section row into the first entity row', async () => {
    renderWithEntities();
    // The open-focus timer lands the caret in the field; racing it with a manual
    // `.focus()` loses, so the walk starts from where the reader actually is.
    await waitFor(() => expect(field()).toHaveFocus());

    // Down once per section lands on the last one; once more crosses into the
    // org results. The boundary is the whole point — the two halves are one list.
    await userEvent.keyboard('{ArrowDown}'.repeat(TAB_DEFS.length));
    expect(row(TAB_DEFS[TAB_DEFS.length - 1].label)).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^Engineering/ })).toHaveFocus();
    // Exactly one row in the tab order, across both halves.
    expect(rows().filter((el) => el.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('activates the top row from the field even when entity results are present', async () => {
    renderWithEntities();

    field().focus();
    await userEvent.keyboard('{Enter}');

    // The top row is still a section — Enter must not jump to an entity just
    // because the org search happened to answer.
    expect(onSelect).toHaveBeenCalledWith('home');
    expect(onEntitySelect).not.toHaveBeenCalled();
  });

  it('opens an entity row and closes', async () => {
    renderWithEntities();

    await userEvent.click(screen.getByRole('button', { name: /^Ada Lovelace/ }));

    expect(onEntitySelect).toHaveBeenCalledWith(ENTITY_RESULTS[1]);
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('appends the entity count to the announcement without disturbing the sections clause', () => {
    renderWithEntities();

    // Append-only: the sections clause is byte-identical to the sections-only
    // palette's, which is what keeps the existing assertions above green.
    expect(announcement()).toHaveTextContent(`${TAB_DEFS.length} sections available, 2 results`);
  });

  it('says it is searching, and holds the previous rows while it does', () => {
    renderWithEntities({ entityMode: 'searching' });

    expect(announcement()).toHaveTextContent(', searching');
    // Held across a refining search: emptying the list mid-word would replay the
    // entrance animation and read as the palette losing its place.
    expect(screen.getByRole('button', { name: /^Engineering/ })).toBeInTheDocument();
  });

  it('surfaces a failed search as a danger banner, not an empty list', () => {
    renderWithEntities({
      entityMode: 'error',
      entityResults: [],
      entityError: 'Search failed. Check the connection to Okta and try again.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
    expect(announcement()).toHaveTextContent(', search failed');
  });

  it('says what it is waiting for below the character floor', async () => {
    renderWithEntities({ entityMode: 'idle', entityResults: [], entityMinChars: 3 });

    await userEvent.type(field(), 'en');

    expect(screen.getByText('Type 3 characters to search the org.')).toBeInTheDocument();
  });

  it('reports a fruitless search as a search, never as an absence', async () => {
    renderWithEntities({ entityMode: 'results', entityResults: [] });

    // Not "no groups exist" — a 20-row capped search cannot support that claim.
    expect(screen.getByText('Nothing in the org matched that search.')).toBeInTheDocument();
  });

  it('marks a section whose snapshot walk has not finished as partial', () => {
    renderWithEntities({
      entityResults: [{ kind: 'rule', id: '0prFAKE0000000000001', name: 'Feeds Engineering' }],
      sectionMeta: { rule: { fromSnapshot: true, complete: false } },
    });

    expect(screen.getByText(/partial snapshot/)).toBeInTheDocument();
  });

  it('gives an unreachable kind a working Okta link instead of a dead row', () => {
    renderWithEntities({ canReach: () => false, oktaOrigin: 'https://example.okta.com' });

    // Not a disabled row: a control that exists only to refuse is worse than no
    // control (ADR-0039), so an unreachable kind gets a real route out instead.
    const links = screen.getAllByRole('link', { name: /Okta/i });
    expect(links).toHaveLength(ENTITY_RESULTS.length);
    for (const link of links) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.getAttribute('href')).toMatch(/^https:\/\/example\.okta\.com\//);
    }
    // And no row claims a destination it cannot reach. (Matched on the label the
    // reachable form sets, not on loose text — the Okta link's own title says
    // "Open this group in the Okta Admin Console" and would match a laxer regex.)
    expect(rows().some((el) => /\u2014 open in /.test(el.getAttribute('aria-label') ?? ''))).toBe(
      false,
    );
  });

  it('pushes the query to the resolver while filtering sections synchronously', async () => {
    const onEntityQueryChange = vi.fn();
    renderWithEntities({ onEntityQueryChange, entityResults: [], entityMode: 'idle' });

    await userEvent.type(field(), 'rul');

    // One call per keystroke — the debounce is the resolver's job, not the
    // palette's, and sections must not wait for it.
    expect(onEntityQueryChange).toHaveBeenLastCalledWith('rul');
    expect(row('Rules')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Groups$/ })).not.toBeInTheDocument();
  });
});
