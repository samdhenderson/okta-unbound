import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

function renderModal(overrides: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  render(
    <Modal isOpen title="Compare users" onClose={onClose} {...overrides}>
      <button>Inside action</button>
    </Modal>,
  );
  return { onClose };
}

describe('Modal accessibility', () => {
  it('exposes dialog semantics with an accessible name', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Compare users');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus into the dialog on open', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    // Focus lands on the first focusable control inside the panel (the Close button).
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });
});

/** A trigger button plus a Modal, so focus has somewhere to be restored to. */
function Harness({ isOpen }: { isOpen: boolean }) {
  return (
    <>
      <button data-testid="trigger">Open</button>
      <Modal isOpen={isOpen} title="Compare users" onClose={vi.fn()}>
        <button>Inside action</button>
      </Modal>
    </>
  );
}

/** The closing panel, found without going through the accessible tree. */
const rawPanel = () => document.querySelector<HTMLElement>('[role="dialog"]');

describe('Modal exit transition', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds the panel in the DOM but out of the accessible tree while it animates out', () => {
    const { rerender } = render(<Harness isOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<Harness isOpen={false} />);

    // Still rendered — the exit animation needs something to animate.
    const panel = rawPanel();
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');
    // …but gone as far as any consumer (or its tests) can tell.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inside action' })).toBeNull();
  });

  it('restores focus to the trigger as soon as isOpen flips false, before the exit resolves', () => {
    const { rerender } = render(<Harness isOpen={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();

    rerender(<Harness isOpen />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    rerender(<Harness isOpen={false} />);
    // Focus is back on the trigger immediately, not EXIT_MS later.
    expect(document.activeElement).toBe(trigger);
    // …and the panel is demonstrably still mid-exit at that moment.
    expect(rawPanel()).not.toBeNull();
  });

  it('unmounts the panel on animationend', () => {
    const { rerender } = render(<Harness isOpen />);
    rerender(<Harness isOpen={false} />);

    const panel = rawPanel();
    expect(panel).not.toBeNull();
    fireEvent.animationEnd(panel as HTMLElement);

    expect(rawPanel()).toBeNull();
  });

  it('ignores an animationend bubbling up from panel content', () => {
    const { rerender } = render(<Harness isOpen />);
    const inner = screen.getByRole('button', { name: 'Inside action' });
    rerender(<Harness isOpen={false} />);

    fireEvent.animationEnd(inner);

    expect(rawPanel()).not.toBeNull();
  });

  it('unmounts the panel on the timeout fallback when no exit event arrives', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness isOpen />);
    rerender(<Harness isOpen={false} />);
    expect(rawPanel()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(rawPanel()).toBeNull();
  });

  it('cancels the hold when the modal reopens mid-exit', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness isOpen />);
    rerender(<Harness isOpen={false} />);
    rerender(<Harness isOpen />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // The pending exit timer must not unmount the freshly reopened modal.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('unmounts synchronously with no pending timers under prefers-reduced-motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { rerender } = render(<Harness isOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const timersWhileOpen = vi.getTimerCount();

    rerender(<Harness isOpen={false} />);

    // Gone in the same commit, with no exit hold scheduled.
    expect(rawPanel()).toBeNull();
    expect(vi.getTimerCount()).toBe(timersWhileOpen);
  });
});
