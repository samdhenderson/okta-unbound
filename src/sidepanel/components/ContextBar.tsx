/**
 * @module sidepanel/components/ContextBar
 * @description One line of chrome: what the live Okta tab is on, and the two
 * controls that act on it — Refresh and a Pin toggle.
 *
 * Pinning freezes the panel on the current entity so you can cross-reference
 * another Okta page without losing your place; when the live tab moves elsewhere
 * while pinned, a hint below the row offers to switch.
 *
 * ## Why it is one line
 *
 * The bar used to be three stacked lines — an `Okta Unbound · {pageType}` wordmark
 * eyebrow, the entity name with a *Pinned* chip, and a copyable id — about 74px
 * tall. That was affordable while the bar scrolled away. It no longer does: the
 * top chrome sits outside the panel's scroller so the scrollbar stops running
 * beside it, which means every pixel here is permanently spent, on a panel the
 * user can drag down to 360px.
 *
 * Each of the three lines was cut for its own reason, not to hit a number:
 *
 * - **The wordmark.** Chrome already prints the extension's name and icon in the
 *   side panel's own title bar, directly above this row. Printing it again is the
 *   panel telling the user what application they are looking at, twice.
 * - **The copyable id.** `PageHeader`'s identity rows already carry an
 *   `{ kind: 'id' }` fact with its own copy control (`groupIdentity`,
 *   `userIdentity`), which is where ADR-0032 says a *fact about the entity*
 *   belongs. This bar's subject is the live tab, not a record to transcribe.
 * - **The *Pinned* chip.** The Pin button beside it already reads "Pinned" and
 *   fills when it is on. The chip restated a state one control away from it.
 *
 * What is left is the subject (a hue-coded connection dot plus a name) and the two
 * verbs. The heavy per-entity identity lives in the content below (ADR-0032).
 */
import React from 'react';
import { Button, IconButton } from './shared';
import Icon from './shared/Icon';
import type { ConnectionStatus } from '../hooks/useOktaTabContext';
import type { PageType } from '../hooks/useOktaPageContext';

/** Props for {@link ContextBar}. */
interface ContextBarProps {
  /** Detected page type; drives the label fallback and dot colour. */
  pageType: PageType;
  /** Display name of the detected (or pinned) entity, if resolved. */
  entityName?: string;
  /** Connection state to the Okta tab. */
  connectionStatus: ConnectionStatus;
  /** Whether page context is still resolving. */
  isLoading: boolean;
  /** Connection/context error message, or `null` when healthy. */
  error: string | null;
  /** Whether the panel is currently pinned to `entityName`/`entityId`. */
  isPinned: boolean;
  /** Whether pinning is available right now (a group/user entity is present). */
  canPin: boolean;
  /** While pinned, `true` once the live Okta tab has navigated to another entity. */
  liveContextChanged?: boolean;
  /** Optional name of the live entity, shown in the switch hint when known. */
  liveEntityName?: string;
  /** Toggle the pin on/off. */
  onTogglePin: () => void;
  /**
   * Re-read whatever the panel is showing, and re-probe the live context
   * (ADR-0069 §2). Not disabled while pinned: the pin freezes which entity the
   * panel follows, not whether the data under it is current.
   */
  onRefresh: () => void;
  /**
   * What {@link ContextBarProps.onRefresh} will act on, in the reader's words —
   * `Payments Team`, `the apps list`. Supplied by the rung on screen through
   * `useRefreshSubject`; `undefined` when no rung has claimed the control.
   *
   * Reaches the control's `title` and accessible name and **nothing else**. It
   * is deliberately never rendered as visible text, a badge or a count: this
   * band's readout describes the *live Okta tab*, and printing the browsed
   * entity's name beside it is the ADR-0032 §1 convergence. The deictic
   * alternative ("Refresh this group") was rejected for being ambiguous in
   * exactly the state where the two differ — which is the state the band exists
   * to make legible.
   */
  refreshSubjectName?: string | null;
  /**
   * Reload the Okta tab to re-establish the content script, then re-detect.
   * Shown only when a connection error is present. Omit when there is no tab to
   * reconnect to.
   */
  onReconnect?: () => void;
}

// One distinct hue per detected entity kind. `warning` reads as a *category* here,
// not a severity — it is the only remaining token visually distinct from the
// group/user/app trio (danger is reserved for the disconnected state below).
const DOT_COLOR: Record<PageType, string> = {
  group: 'var(--color-primary)',
  user: 'var(--color-accent)',
  app: 'var(--color-success)',
  policy: 'var(--color-warning)',
  admin: 'var(--color-neutral-500)',
  unknown: 'var(--color-neutral-500)',
};

const NO_ENTITY_LABEL: Record<PageType, string> = {
  group: 'No group selected',
  user: 'No user selected',
  app: 'No app selected',
  policy: 'No policy detected',
  admin: 'Okta Admin',
  unknown: 'No context',
};

/**
 * Renders the slim merged context header. Presentational: pin/refresh behaviour and
 * the live-vs-pinned comparison are owned by the caller (App).
 */
const ContextBar: React.FC<ContextBarProps> = ({
  pageType,
  entityName,
  connectionStatus,
  isLoading,
  error,
  isPinned,
  canPin,
  liveContextChanged = false,
  liveEntityName,
  onTogglePin,
  onRefresh,
  refreshSubjectName,
  onReconnect,
}) => {
  const displayName = error
    ? 'Not connected'
    : isLoading
      ? 'Loading…'
      : entityName || NO_ENTITY_LABEL[pageType];

  const dotColor = error
    ? 'var(--color-danger)'
    : connectionStatus === 'connecting' || isLoading
      ? 'var(--color-warning)'
      : DOT_COLOR[pageType];

  const connectionText = error
    ? 'Disconnected'
    : connectionStatus === 'connecting' || isLoading
      ? 'Connecting…'
      : 'Connected';

  const liveChanged = isPinned && liveContextChanged;

  // Names the subject, never renders it. See `refreshSubjectName`'s doc.
  const refreshLabel = refreshSubjectName ? `Refresh ${refreshSubjectName}` : 'Refresh';

  return (
    // No border of its own: this is the first band of the top-chrome slab, not a
    // stripe. The rail beneath it carries the one rule that closes the whole slab
    // (see `TabNavigation`); separation *inside* the slab comes from spacing and
    // type weight. Horizontal padding is `--sp-gutter`, so the row breathes with
    // the panel's measured width instead of holding 20px at 360px.
    <div className="bg-white" style={{ fontFamily: 'var(--font-primary)' }}>
      <div className="px-(--sp-gutter) py-1.5 flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${connectionStatus === 'connecting' || isLoading ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: dotColor }}
          title={connectionText}
          role="img"
          aria-label={connectionText}
        />
        <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">
          {displayName}
        </span>

        <div className="ms-auto flex items-center gap-1 shrink-0">
          {error && onReconnect ? (
            // Replaces Refresh rather than joining it: re-detecting the context is
            // exactly what cannot work until the content script is back, so
            // offering both would be offering a button that is known to fail.
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={onReconnect}
              title="Reload the Okta tab to re-establish the connection"
            >
              Reconnect
            </Button>
          ) : (
            <IconButton
              label={refreshLabel}
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              title={refreshLabel}
            >
              <Icon type="refresh" size="sm" className={isLoading ? 'animate-spin' : ''} />
            </IconButton>
          )}
          <Button
            variant={isPinned ? 'primary' : 'secondary'}
            size="sm"
            icon="pin"
            onClick={onTogglePin}
            disabled={!canPin && !isPinned}
            title={
              isPinned
                ? 'Unpin — resume following the live Okta tab'
                : canPin
                  ? 'Pin this context while you cross-reference another page'
                  : 'Navigate to a group or user page to pin it'
            }
          >
            {isPinned ? 'Pinned' : 'Pin'}
          </Button>
        </div>
      </div>

      {/* Live-context-changed hint (pinned only) */}
      {liveChanged && (
        <div className="px-(--sp-gutter) py-2 bg-warning-light border-t border-warning-light flex items-center justify-between gap-2 text-xs text-warning-text">
          <span className="truncate">
            {liveEntityName ? (
              <>
                Live tab moved to <strong>{liveEntityName}</strong>
              </>
            ) : (
              'The live Okta tab has changed'
            )}
          </span>
          {/* §3 exception: chromeless text-link awaiting a shared `TextLink` primitive (I-035). */}
          <button
            type="button"
            onClick={onTogglePin}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Unpin &amp; switch
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextBar;
