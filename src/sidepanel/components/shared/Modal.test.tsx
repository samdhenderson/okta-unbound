import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';
import { render, screen, act, fireEvent, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal, { MODAL_LAYER_ID } from './Modal';

/** Shell nodes mounted by {@link mountShell}, torn down after every test. */
const shellNodes: HTMLElement[] = [];

afterEach(() => {
  shellNodes.splice(0).forEach((node) => node.remove());
});

/** A shell shaped like `App`: the scroll root, then the modal layer after it. */
function mountShell() {
  const scrollRoot = document.body.appendChild(document.createElement('div'));
  const layer = document.body.appendChild(document.createElement('div'));
  layer.id = MODAL_LAYER_ID;
  shellNodes.push(scrollRoot, layer);
  return { scrollRoot, layer };
}

/**
 * D-016. `Modal` has two render branches: it portals its overlay into the shell's
 * modal layer when one is declared, and renders in place when none is. `App` always
 * mounts the layer, so the portal branch is the one that ships — yet the a11y
 * contract (dialog role, `aria-modal`, Tab trap, Escape, focus restore, and the
 * `aria-hidden`/`inert` exit window) used to be asserted only against the fallback.
 *
 * The describes below are therefore parametrised over both configurations. Every
 * case covering one of those six properties also carries an `expectBranch`
 * assertion, so a regression that collapsed the two branches into one could not
 * let the portal configuration keep passing vacuously. The remaining cases here
 * pin exit *mechanics* rather than the a11y contract (which listener unmounts the
 * panel, and when); they run on both branches but do not re-assert placement,
 * because the cases above already pin it for the configuration they share.
 */
interface MountResult {
  /** The node `render` mounted into — the shell's scroll root in the portal case. */
  container: HTMLElement;
  /** The mounted modal layer, or `null` when the configuration declares none. */
  layer: HTMLElement | null;
  rerender: RenderResult['rerender'];
}

interface RenderConfiguration {
  /** Label interpolated into the parametrised describe titles. */
  name: string;
  /** Renders `ui` on this configuration's branch. */
  mount: (ui: ReactElement) => MountResult;
  /** Asserts `dialog` landed on the branch this configuration names. */
  expectBranch: (dialog: HTMLElement, rendered: Omit<MountResult, 'rerender'>) => void;
}

const configurations: RenderConfiguration[] = [
  {
    name: 'no modal layer',
    mount: (ui) => {
      const { container, rerender } = render(ui);
      return { container, rerender, layer: null };
    },
    expectBranch: (dialog, { container }) => {
      expect(document.getElementById(MODAL_LAYER_ID)).toBeNull();
      expect(container.contains(dialog)).toBe(true);
    },
  },
  {
    name: 'portalled into the modal layer',
    mount: (ui) => {
      const { scrollRoot, layer } = mountShell();
      const { container, rerender } = render(ui, { container: scrollRoot });
      return { container, rerender, layer };
    },
    expectBranch: (dialog, { container, layer }) => {
      expect(layer).not.toBeNull();
      expect(layer?.contains(dialog)).toBe(true);
      expect(container.contains(dialog)).toBe(false);
    },
  },
];

function renderModal(
  mount: RenderConfiguration['mount'],
  overrides: Partial<ComponentProps<typeof Modal>> = {},
) {
  const onClose = vi.fn();
  const rendered = mount(
    <Modal isOpen title="Compare users" onClose={onClose} {...overrides}>
      <button>Inside action</button>
    </Modal>,
  );
  return { onClose, ...rendered };
}

describe.each(configurations)('Modal accessibility ($name)', ({ mount, expectBranch }) => {
  it('exposes dialog semantics with an accessible name', () => {
    const { container, layer } = renderModal(mount);
    const dialog = screen.getByRole('dialog');
    expectBranch(dialog, { container, layer });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Compare users');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose, container, layer } = renderModal(mount);
    expectBranch(screen.getByRole('dialog'), { container, layer });
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    renderModal(mount, { isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus into the dialog on open', () => {
    renderModal(mount);
    const dialog = screen.getByRole('dialog');
    // Focus lands on the first focusable control inside the panel (the Close button).
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('traps Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    const { container, layer } = renderModal(mount);
    const dialog = screen.getByRole('dialog');
    expectBranch(dialog, { container, layer });

    const close = screen.getByRole('button', { name: 'Close modal' });
    const inside = screen.getByRole('button', { name: 'Inside action' });

    // Tabbing forward off the last control wraps to the first…
    inside.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);

    // …and backward off the first wraps to the last. Focus never leaves the panel.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(inside);
    expect(dialog.contains(document.activeElement)).toBe(true);
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

describe.each(configurations)('Modal exit transition ($name)', ({ mount, expectBranch }) => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds the panel in the DOM but out of the accessible tree while it animates out', () => {
    const { rerender, container, layer } = mount(<Harness isOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expectBranch(screen.getByRole('dialog'), { container, layer });

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
    const { rerender, container, layer } = mount(<Harness isOpen={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();

    rerender(<Harness isOpen />);
    expectBranch(screen.getByRole('dialog'), { container, layer });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    rerender(<Harness isOpen={false} />);
    // Focus is back on the trigger immediately, not EXIT_MS later.
    expect(document.activeElement).toBe(trigger);
    // …and the panel is demonstrably still mid-exit at that moment.
    expect(rawPanel()).not.toBeNull();
  });

  it('unmounts the panel on animationend', () => {
    const { rerender } = mount(<Harness isOpen />);
    rerender(<Harness isOpen={false} />);

    const panel = rawPanel();
    expect(panel).not.toBeNull();
    fireEvent.animationEnd(panel as HTMLElement);

    expect(rawPanel()).toBeNull();
  });

  it('ignores an animationend bubbling up from panel content', () => {
    const { rerender } = mount(<Harness isOpen />);
    const inner = screen.getByRole('button', { name: 'Inside action' });
    rerender(<Harness isOpen={false} />);

    fireEvent.animationEnd(inner);

    expect(rawPanel()).not.toBeNull();
  });

  it('unmounts the panel on the timeout fallback when no exit event arrives', () => {
    vi.useFakeTimers();
    const { rerender } = mount(<Harness isOpen />);
    rerender(<Harness isOpen={false} />);
    expect(rawPanel()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(rawPanel()).toBeNull();
  });

  it('cancels the hold when the modal reopens mid-exit', () => {
    vi.useFakeTimers();
    const { rerender } = mount(<Harness isOpen />);
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

    const { rerender } = mount(<Harness isOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const timersWhileOpen = vi.getTimerCount();

    rerender(<Harness isOpen={false} />);

    // Gone in the same commit, with no exit hold scheduled.
    expect(rawPanel()).toBeNull();
    expect(vi.getTimerCount()).toBe(timersWhileOpen);
  });
});

/**
 * D-009. `ActivityBar` is a `fixed bottom-0 z-50` band and `Modal`'s overlay is
 * `fixed inset-0 z-50` — the same rung of the ladder, so whichever comes later in
 * the document paints on top. Every tab panel that hosts a modal sits *before* the
 * bar inside the app's scroll root, so the bar covered open modals' footer actions.
 *
 * The property under test is therefore document position, not any class or style:
 * the overlay must leave the scroll root for the shell's modal layer, which is
 * mounted after it.
 */
describe('Modal stacking', () => {
  /** A modal followed by the activity bar — the order every tab panel produces. */
  const shellContent = (
    <>
      <Modal isOpen title="Compare users" onClose={vi.fn()}>
        <button>Inside action</button>
      </Modal>
      <div data-testid="activity-bar" />
    </>
  );

  it('renders its overlay into the modal layer, outside the scrolling shell', () => {
    const { scrollRoot, layer } = mountShell();

    render(shellContent, { container: scrollRoot });

    const dialog = screen.getByRole('dialog');
    expect(scrollRoot.contains(dialog)).toBe(false);
    expect(layer.contains(dialog)).toBe(true);
  });

  it('places its overlay after the activity bar in document order', () => {
    const { scrollRoot } = mountShell();

    render(shellContent, { container: scrollRoot });

    const dialog = screen.getByRole('dialog');
    const activityBar = screen.getByTestId('activity-bar');
    // Later in the document at an equal z-index = painted on top.
    expect(
      Boolean(
        activityBar.compareDocumentPosition(dialog) & activityBar.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('renders in place when no shell declares a modal layer', () => {
    // Isolated component tests and Storybook stories have no app shell; the modal
    // stays inside the render container so canvas-scoped queries (and the story
    // axe run) still reach it.
    const { container } = render(
      <Modal isOpen title="Compare users" onClose={vi.fn()}>
        <button>Inside action</button>
      </Modal>,
    );

    expect(container.contains(screen.getByRole('dialog'))).toBe(true);
  });
});
