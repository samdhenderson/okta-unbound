/**
 * @module sidepanel/components/shared/Modal
 * @description Accessible modal dialog — the canonical overlay for all pop-up UI.
 *
 * Provides `role="dialog"` + `aria-modal`, a Tab focus-trap, autofocus into the
 * panel, focus restoration on close, and Escape / overlay-click to dismiss.
 * Always use this rather than a bespoke overlay. See docs/ux-guidelines.md.
 *
 * Closing is animated: the panel is held in the DOM for one exit animation after
 * `isOpen` flips false, but is removed from the accessible tree (`aria-hidden` +
 * `inert`) for that whole window, so nothing can be queried, focused, or clicked
 * on a modal that is on its way out.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Icon from '../overview/shared/Icon';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ModalProps {
  /**
   * When false the modal closes. The panel is held in the DOM for the duration of
   * its exit animation (hidden from the accessible tree), then unmounted; while
   * false and settled the modal renders nothing.
   */
  isOpen: boolean;
  /** Invoked on Escape, overlay click, or the header close button. */
  onClose: () => void;
  /** Dialog title; wired to `aria-labelledby`. */
  title: string;
  /** Body content. */
  children: React.ReactNode;
  /** Optional footer node (typically action buttons), shown in a styled footer bar. */
  footer?: React.ReactNode;
  /** Max-width preset for the panel. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Upper bound on the exit hold, in milliseconds. Mirrors `--dur-quick` (140ms),
 * the duration of the `animate-panel-out` / `animate-overlay-out` exit defined in
 * `tailwind.css` — keep the two in step if that token moves.
 *
 * This is only a fallback: the hold is normally released by the panel's own
 * `animationend`/`transitionend`. It exists because those events never arrive if
 * the animation is interrupted, the panel is display-none'd by an ancestor, or
 * the environment doesn't run animations at all (jsdom). The duration is not read
 * back from `getComputedStyle().transitionDuration` — jsdom returns `''`.
 */
const EXIT_MS = 140;

/**
 * Accessible modal dialog. Provides `role="dialog"` + `aria-modal`, closes on
 * Escape or overlay click, traps Tab focus within the panel, and restores focus
 * to the previously-focused element on close. See docs/ux-guidelines.md.
 *
 * The panel animates in on open and out on close. The exit is a JS mount-hold:
 * the panel stays in the DOM until its exit animation ends (or {@link EXIT_MS}
 * elapses), but is `aria-hidden` + `inert` for that window, and focus returns to
 * the trigger immediately — never at the end of the animation. Under
 * `prefers-reduced-motion: reduce` the hold is skipped and the panel unmounts
 * synchronously.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Confirm removal"
 *   footer={<Button variant="danger" onClick={confirm}>Remove</Button>}
 * >
 *   <p>This cannot be undone.</p>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const reduced = useReducedMotion();

  // Mount-hold state machine. `present` keeps the panel in the DOM for one exit
  // animation after `isOpen` goes false; `closing` marks that window.
  //
  // Both are derived during render (React's "adjusting state when a prop changes"
  // pattern) rather than in an effect, and `present` is lazily seeded from
  // `isOpen`. Two things depend on that:
  //   - a modal rendered with `isOpen` already true has its panel in the *first*
  //     commit, so the focus effect below finds it (an effect-driven `present`
  //     would put the panel one commit late and focus would never enter);
  //   - a modal rendered with `isOpen` false renders nothing at all, never a
  //     transient panel.
  const [present, setPresent] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      // Re-opening mid-exit is a legal transition: cancel the hold.
      setPresent(true);
      setClosing(false);
    } else if (present) {
      // Reduced motion skips the hold entirely — no animation to wait for.
      if (reduced) setPresent(false);
      else setClosing(true);
    }
  }

  // Release the hold on the panel's own exit animation, or on the timeout,
  // whichever lands first.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;

    const finish = (event?: { target: unknown }) => {
      // Ignore animations/transitions bubbling up from content inside the panel.
      if (event && event.target !== panel) return;
      setPresent(false);
      setClosing(false);
    };

    const timer = window.setTimeout(finish, EXIT_MS);
    panel?.addEventListener('animationend', finish);
    panel?.addEventListener('transitionend', finish);
    return () => {
      window.clearTimeout(timer);
      panel?.removeEventListener('animationend', finish);
      panel?.removeEventListener('transitionend', finish);
    };
  }, [closing]);

  // A modal on its way out must not be re-closable — a second Escape or overlay
  // click during the exit would fire `onClose` again on an already-closed modal.
  const requestClose = useCallback(() => {
    if (closing) return;
    onClose();
  }, [closing, onClose]);

  // Remember the trigger, autofocus into the modal, and restore focus on close.
  // Deliberately keyed on `isOpen`, not `present`: focus must return to the
  // trigger the instant the modal is dismissed, not `EXIT_MS` later, or a
  // keyboard user is stranded in a dead zone for the length of the animation.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [requestClose],
  );

  if (!present) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 isolate ${
        closing ? 'animate-overlay-out pointer-events-none' : 'animate-overlay-in'
      }`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // While closing, the panel is pixels only: out of the accessible tree, out
        // of the tab order, and unclickable. Consumers (and their tests) can treat
        // `isOpen === false` as "the dialog is gone" the moment it flips.
        aria-hidden={closing || undefined}
        inert={closing || undefined}
        tabIndex={-1}
        className={`bg-white rounded-md shadow-xl ${sizeClasses[size]} w-full mx-4 my-4 max-h-[calc(100vh-2rem)] flex flex-col focus:outline-none ${
          closing ? 'animate-panel-out' : 'animate-panel-in'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <h3 id={titleId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h3>
          <button
            onClick={requestClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors duration-(--dur-instant) p-1 rounded-md hover:bg-neutral-50"
            aria-label="Close modal"
          >
            <Icon type="close" size="md" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto scrollable-list">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-neutral-50 rounded-b-md border-t border-neutral-200 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
