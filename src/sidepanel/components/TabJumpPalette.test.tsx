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

const onSelect = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

/** Render the palette in isolation with controllable props. */
function renderPalette(props: Partial<React.ComponentProps<typeof TabJumpPalette>> = {}) {
  return render(
    <TabJumpPalette isOpen onClose={onClose} activeTab="overview" onSelect={onSelect} {...props} />,
  );
}

/** The search field. Named, not labelled, because it sits inline in the panel. */
const field = () => screen.getByRole('searchbox', { name: 'Search sections' });

/** Every result row, in render order (the modal's own close button excluded). */
const rows = () =>
  screen.getAllByRole('button').filter((el) => el.getAttribute('aria-label') !== 'Close modal');

/** One result row, matched on its visible label. */
const row = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });

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
        <TabJumpPalette
          isOpen={false}
          onClose={onClose}
          activeTab="overview"
          onSelect={onSelect}
        />,
      );
      rerender(
        <TabJumpPalette isOpen onClose={onClose} activeTab="overview" onSelect={onSelect} />,
      );

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
    it('focuses the search field on open, ahead of the modal header button', async () => {
      renderPalette();

      // Deferred by a tick on purpose: the shared Modal focuses its own close
      // button from a parent effect, which runs after every child effect.
      await waitFor(() => expect(field()).toHaveFocus());
    });

    it('moves focus into the list on ArrowDown and back to the field on ArrowUp', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      await userEvent.keyboard('{ArrowDown}');
      expect(row('Overview')).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      expect(row('Users')).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      expect(row('Overview')).toHaveFocus();

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

      expect(onSelect).toHaveBeenCalledWith('users');
      expect(onClose).toHaveBeenCalled();
    });

    it('keeps exactly one row in the tab order and moves the anchor with focus', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());

      const tabbable = () => rows().filter((el) => el.getAttribute('tabindex') === '0');
      expect(tabbable()).toHaveLength(1);
      expect(tabbable()[0]).toBe(row('Overview'));

      await userEvent.keyboard('{ArrowDown}{ArrowDown}');

      expect(tabbable()).toHaveLength(1);
      expect(tabbable()[0]).toBe(row('Users'));
    });

    it('re-anchors the tab order to the top row when the query changes', async () => {
      renderPalette();
      await waitFor(() => expect(field()).toHaveFocus());
      await userEvent.keyboard('{ArrowDown}{ArrowDown}');
      expect(row('Users')).toHaveAttribute('tabindex', '0');

      await userEvent.click(field());
      await userEvent.type(field(), 'o');

      expect(rows()[0]).toHaveAttribute('tabindex', '0');
    });

    it('announces the number of matching sections', async () => {
      renderPalette();

      expect(screen.getByRole('status')).toHaveTextContent('9 sections available');

      await userEvent.type(field(), 'export');

      expect(screen.getByRole('status')).toHaveTextContent('1 section available');
    });
  });
});

/** Wires the hook to the palette exactly the way `App` does. */
const Harness: React.FC = () => {
  const palette = useCommandPalette();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
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

    expect(screen.getByTestId('active-tab')).toHaveTextContent('overview');
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
