/**
 * Tests for useViewStack — the generic push/pop sub-navigation stack.
 *
 * Pins the stack semantics (push/pop/popTo/reset, including popping an empty
 * stack), the breadcrumb trail's shape at every depth, the reported transition
 * direction consumers animate from, and the focus contract it borrows from `Modal`:
 * record the trigger on push, move focus into the pushed view, restore it to the
 * trigger on pop — with no focus trap.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { useViewStack } from './useViewStack';

interface Entry {
  id: string;
  name: string;
}

const ENGINEERING: Entry = { id: '00gFAKE00000000000001', name: 'Engineering' };
const PLATFORM: Entry = { id: '00gFAKE00000000000002', name: 'Platform' };
const ON_CALL: Entry = { id: '00gFAKE00000000000003', name: 'On Call' };

const OPTIONS = {
  rootLabel: 'Groups',
  getLabel: (entry: Entry) => entry.name,
  getKey: (entry: Entry) => entry.id,
};

const renderStack = () => renderHook(() => useViewStack<Entry>(OPTIONS));

describe('useViewStack', () => {
  describe('stack semantics', () => {
    it('starts at the root with no current entry', () => {
      const { result } = renderStack();

      expect(result.current.depth).toBe(0);
      expect(result.current.isRoot).toBe(true);
      expect(result.current.currentEntry).toBeUndefined();
      expect(result.current.entries).toEqual([]);
    });

    it('push sets the current entry and increases depth', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));

      expect(result.current.depth).toBe(1);
      expect(result.current.isRoot).toBe(false);
      expect(result.current.currentEntry).toEqual(ENGINEERING);
      expect(result.current.entries).toEqual([ENGINEERING]);
    });

    it('supports a deep stack, keeping the entries in push order', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.push(ON_CALL));

      expect(result.current.depth).toBe(3);
      expect(result.current.entries).toEqual([ENGINEERING, PLATFORM, ON_CALL]);
      expect(result.current.currentEntry).toEqual(ON_CALL);
    });

    it('pop removes exactly one level', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.pop());

      expect(result.current.depth).toBe(1);
      expect(result.current.currentEntry).toEqual(ENGINEERING);
    });

    it('popping an empty stack is a no-op and keeps the same entries reference', () => {
      const { result } = renderStack();
      const before = result.current.entries;

      act(() => result.current.pop());

      expect(result.current.depth).toBe(0);
      expect(result.current.isRoot).toBe(true);
      expect(result.current.currentEntry).toBeUndefined();
      expect(result.current.entries).toBe(before);
    });

    it('popTo returns to the given depth', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.push(ON_CALL));
      act(() => result.current.popTo(1));

      expect(result.current.depth).toBe(1);
      expect(result.current.currentEntry).toEqual(ENGINEERING);
    });

    it('popTo clamps a negative depth to the root and ignores a depth at or past the top', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));

      act(() => result.current.popTo(5));
      expect(result.current.depth).toBe(2);

      act(() => result.current.popTo(2));
      expect(result.current.depth).toBe(2);

      act(() => result.current.popTo(-3));
      expect(result.current.depth).toBe(0);
    });

    it('reset clears the whole stack back to the root', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.reset());

      expect(result.current.depth).toBe(0);
      expect(result.current.isRoot).toBe(true);
      expect(result.current.currentEntry).toBeUndefined();
    });
  });

  describe('transition direction', () => {
    it('is null before the first navigation, so the initial render never animates', () => {
      const { result } = renderStack();

      expect(result.current.transition).toBeNull();
    });

    it('reports push and pop, and commits the direction with the entries', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      expect(result.current.transition).toBe('push');
      // Same commit: the arriving view and its entrance class land together.
      expect(result.current.depth).toBe(1);

      act(() => result.current.pop());
      expect(result.current.transition).toBe('pop');
      expect(result.current.depth).toBe(0);
    });

    it('reports pop for popTo and reset', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.popTo(1));
      expect(result.current.transition).toBe('pop');

      act(() => result.current.push(ON_CALL));
      act(() => result.current.reset());
      expect(result.current.transition).toBe('pop');
    });

    it('stays null when a pop is a no-op at the root', () => {
      const { result } = renderStack();

      act(() => result.current.pop());
      act(() => result.current.popTo(3));
      act(() => result.current.reset());

      expect(result.current.transition).toBeNull();
    });
  });

  describe('breadcrumb trail', () => {
    it('is a single non-actionable root crumb at the root', () => {
      const { result } = renderStack();

      expect(result.current.trail).toHaveLength(1);
      expect(result.current.trail[0]).toMatchObject({
        label: 'Groups',
        depth: 0,
        isCurrent: true,
      });
      expect(result.current.trail[0].onSelect).toBeUndefined();
    });

    it('makes every ancestor actionable and only the last crumb current', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.push(ON_CALL));

      const trail = result.current.trail;
      expect(trail.map((crumb) => crumb.label)).toEqual([
        'Groups',
        'Engineering',
        'Platform',
        'On Call',
      ]);
      expect(trail.map((crumb) => crumb.depth)).toEqual([0, 1, 2, 3]);
      expect(trail.map((crumb) => crumb.isCurrent)).toEqual([false, false, false, true]);
      expect(trail.slice(0, 3).every((crumb) => typeof crumb.onSelect === 'function')).toBe(true);
      expect(trail[3].onSelect).toBeUndefined();
    });

    it('crumb onSelect navigates back to that crumb', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));
      act(() => result.current.push(PLATFORM));
      act(() => result.current.trail[1].onSelect?.());

      expect(result.current.depth).toBe(1);
      expect(result.current.currentEntry).toEqual(ENGINEERING);

      act(() => result.current.trail[0].onSelect?.());
      expect(result.current.isRoot).toBe(true);
    });

    it('keys entry crumbs with getKey when supplied', () => {
      const { result } = renderStack();

      act(() => result.current.push(ENGINEERING));

      expect(result.current.trail[1].key).toBe(ENGINEERING.id);
    });

    it('falls back to a depth-based key without getKey', () => {
      const { result } = renderHook(() =>
        useViewStack<Entry>({ rootLabel: 'Groups', getLabel: (entry) => entry.name }),
      );

      act(() => result.current.push(ENGINEERING));

      expect(result.current.trail[1].key).toBe('view-stack-1');
      expect(result.current.trail[1].key).not.toBe(result.current.trail[0].key);
    });
  });

  describe('focus management', () => {
    /**
     * Mirrors the documented consumer shape: the root list stays mounted (hidden)
     * while a detail view renders as a sibling, so the trigger survives the push
     * and can receive focus again on pop.
     */
    function Harness({ manageFocus = true }: { manageFocus?: boolean }) {
      const viewRef = useRef<HTMLDivElement>(null);
      const nav = useViewStack<Entry>({ ...OPTIONS, viewRef, manageFocus });
      return (
        <div>
          <div hidden={!nav.isRoot}>
            <button type="button" onClick={() => nav.push(ENGINEERING)}>
              Open Engineering
            </button>
          </div>
          {nav.currentEntry && (
            <div ref={viewRef} tabIndex={-1} data-testid="detail">
              <button type="button" onClick={nav.pop}>
                Back
              </button>
            </div>
          )}
        </div>
      );
    }

    it('moves focus to the first focusable element of the pushed view', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByRole('button', { name: 'Open Engineering' }));

      expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    });

    it('restores focus to the element that triggered the push on pop', async () => {
      render(<Harness />);
      const trigger = screen.getByRole('button', { name: 'Open Engineering' });

      await userEvent.click(trigger);
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(trigger).toHaveFocus();
    });

    it('does not trap focus — the pushed view is not aria-modal and siblings stay in the DOM', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByRole('button', { name: 'Open Engineering' }));

      const detail = screen.getByTestId('detail');
      expect(detail).not.toHaveAttribute('aria-modal');
      expect(detail).not.toHaveAttribute('role', 'dialog');
      // The root panel is still mounted alongside it, so its state survives the push.
      expect(
        screen.getByRole('button', { name: 'Open Engineering', hidden: true }),
      ).toBeInTheDocument();
    });

    it('focuses the container itself when the pushed view has no focusable child', async () => {
      function EmptyViewHarness() {
        const viewRef = useRef<HTMLDivElement>(null);
        const nav = useViewStack<Entry>({ ...OPTIONS, viewRef });
        return (
          <div>
            <button type="button" onClick={() => nav.push(ENGINEERING)}>
              Open Engineering
            </button>
            {nav.currentEntry && (
              <div ref={viewRef} tabIndex={-1} data-testid="detail">
                Loading…
              </div>
            )}
          </div>
        );
      }
      render(<EmptyViewHarness />);

      await userEvent.click(screen.getByRole('button', { name: 'Open Engineering' }));

      expect(screen.getByTestId('detail')).toHaveFocus();
    });

    it('leaves focus alone when manageFocus is false', async () => {
      render(<Harness manageFocus={false} />);
      const trigger = screen.getByRole('button', { name: 'Open Engineering' });

      await userEvent.click(trigger);

      expect(trigger).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Back' })).not.toHaveFocus();
    });

    it('does not throw when the trigger unmounted while the detail view was open', async () => {
      function UnmountingHarness() {
        const viewRef = useRef<HTMLDivElement>(null);
        const nav = useViewStack<Entry>({ ...OPTIONS, viewRef });
        return nav.currentEntry ? (
          <div ref={viewRef} tabIndex={-1} data-testid="detail">
            <button type="button" onClick={nav.pop}>
              Back
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => nav.push(ENGINEERING)}>
            Open Engineering
          </button>
        );
      }
      render(<UnmountingHarness />);

      await userEvent.click(screen.getByRole('button', { name: 'Open Engineering' }));
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByRole('button', { name: 'Open Engineering' })).toBeInTheDocument();
    });
  });
});
