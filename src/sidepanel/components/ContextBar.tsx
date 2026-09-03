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
 * What is left is the subject (a name) and the two verbs. The heavy per-entity
 * identity lives in the content below (ADR-0032).
 *
 * ## Connection is a wire, not a row
 *
 * The connection used to be a 10px hue-coded dot inside the row, with a separate
 * *Reconnect* `Button` appearing beside it — and displacing Refresh — whenever
 * there was an error. Two problems. The dot was decoration: `role="img"` with no
 * action on it, so an admin who noticed it had gone amber had to go find a
 * different control that only exists in the failure state. And the recovery
 * control moved the row's contents, so the button under the reader's pointer
 * changed identity at the moment the connection dropped.
 *
 * It is now a **status wire**: a hairline spanning the panel's top edge, carrying
 * hue at rest and costing **zero layout height** (it is absolutely positioned
 * inside the row's own top padding, so the band's resting height is exactly what
 * it was, minus the dot's horizontal space). Degraded, it thickens and discloses
 * a labelled strip beneath it holding the real, keyboard-reachable *Reconnect*
 * control.
 *
 * Two properties fall out and both are the point. **Refresh and Pin never move**
 * — they are `shrink-0` in a trailing group, and everything that varies varies
 * inside the `flex-1` region to their left or in a band above them. And **hue is
 * not the only carrier** (ADR-0061): the status is stated in words to assistive
 * technology at all times through a `role="status"` line, and visibly in the
 * strip whenever it is anything other than healthy.
 *
 * ## The identity region morphs; the verbs do not
 *
 * When the live Okta tab is on something the panel can open, the identity region
 * turns into the offer to open it — the same name, made pressable, plus a
 * control to decline. It gains no row, and neither does the band: the region is
 * `flex-1 min-w-0` and truncates, so everything the offer costs is taken from
 * the name it was already showing.
 *
 * That replaces the Users tab's `DetectedUserBanner`, which asked this question
 * for **users only** and spent a full row inside the tab body asking it. Three
 * of its properties are carried over deliberately: it offers and never navigates
 * (admin navigation cannot hijack the panel), declining is scoped to that one
 * entity, and a different entity brings the offer back. The logic lives in
 * {@link module:sidepanel/hooks/useEntityHandoff}; this component renders it.
 */
import React from 'react';
import { Button, IconButton } from './shared';
import Icon from './shared/Icon';
import { KIND_ICON, destinationLabel } from './home/jumpDestinations';
import type { ConnectionStatus } from '../hooks/useOktaTabContext';
import type { PageType } from '../hooks/useOktaPageContext';
import type { HandoffOffer } from '../hooks/useEntityHandoff';

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
   *
   * The recovery control lives in the status wire's disclosed strip and appears
   * only while there is a connection error. Omit when there is no tab to
   * reconnect to — the strip then states the status without offering an action
   * that cannot work.
   */
  onReconnect?: () => void;
  /**
   * The live Okta tab's entity, offered to be opened in the panel, or
   * `null`/omitted when there is nothing to hand over.
   *
   * Rendered **into the identity region**, in place of the plain name — the
   * region already names this entity, so the offer is that same name made
   * pressable rather than a second statement of it. It costs no row of its own,
   * which is what the Users tab's detected-user banner cost.
   */
  handoff?: HandoffOffer | null;
  /** Open the offered entity in the panel. Required when `handoff` is supplied. */
  onAcceptHandoff?: () => void;
  /** Decline the offer for that entity only. Required when `handoff` is supplied. */
  onDismissHandoff?: () => void;
}

// One distinct hue per detected entity kind. `warning` reads as a *category* here,
// not a severity — it is the only remaining token visually distinct from the
// group/user/app trio (danger is reserved for the disconnected state below).
const WIRE_COLOR: Record<PageType, string> = {
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
 * Renders the slim merged context header: a status wire, one identity row, and
 * the two chrome verbs. Presentational — pin/refresh behaviour, the
 * live-vs-pinned comparison and the refresh subject are owned by the caller
 * (`App`).
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
  handoff,
  onAcceptHandoff,
  onDismissHandoff,
}) => {
  const displayName = error
    ? 'Not connected'
    : isLoading
      ? 'Loading…'
      : entityName || NO_ENTITY_LABEL[pageType];

  const isSettling = connectionStatus === 'connecting' || isLoading;

  const wireColor = error
    ? 'var(--color-danger)'
    : isSettling
      ? 'var(--color-warning)'
      : WIRE_COLOR[pageType];

  const connectionText = error ? 'Disconnected' : isSettling ? 'Connecting…' : 'Connected';

  // Only a genuine failure thickens the wire into a strip. A probe still
  // settling is not a problem to act on, and disclosing a band for it would make
  // the panel's top edge move on every navigation of the live Okta tab.
  const degraded = Boolean(error);

  const liveChanged = isPinned && liveContextChanged;

  // Names the subject, never renders it. See `refreshSubjectName`'s doc.
  const refreshLabel = refreshSubjectName ? `Refresh ${refreshSubjectName}` : 'Refresh';

  return (
    // No border of its own: this is the first band of the top-chrome slab, not a
    // stripe. The rail beneath it carries the one rule that closes the whole slab
    // (see `TabNavigation`); separation *inside* the slab comes from spacing and
    // type weight. Horizontal padding is `--sp-gutter`, so the row breathes with
    // the panel's measured width instead of holding 20px at 360px.
    <div className="relative bg-white" style={{ fontFamily: 'var(--font-primary)' }}>
      {/*
        The status wire. `absolute` on purpose: it paints inside the row's own
        top padding, so it costs no layout height at rest — on a panel the reader
        can drag to 360px, every pixel of permanent chrome is a pixel of content
        lost, and a connection light is not worth a row. Purely visual, hence
        `aria-hidden`; the status reaches assistive technology in words through
        the `role="status"` line below, not through this hue (ADR-0061).
      */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 transition-all duration-(--dur-instant) ease-(--ease-standard) ${degraded ? 'h-1.5' : 'h-1'} ${isSettling ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: wireColor }}
      />
      <span className="sr-only" role="status">
        {connectionText}
      </span>

      {/*
        Degraded, the wire thickens into a labelled strip carrying the recovery
        control — the status and the remedy as one object, rather than a decorative
        light plus a button that only exists in the failure state and has to be
        found. `.disclose` animates `grid-template-rows` (motion rule 4: layout
        never jumps to make room), and reduced motion freezes that transition to
        1ms, which is the non-animated form of the same result.
      */}
      <div className="disclose" data-open={degraded ? 'true' : 'false'}>
        <div>
          <div className="px-(--sp-gutter) pt-2 pb-1.5 flex items-center gap-(--sp-inline) bg-danger-light">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-danger-text">
              Not connected to the Okta tab
            </span>
            {onReconnect && (
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={onReconnect}
                title="Reload the Okta tab to re-establish the connection"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-(--sp-gutter) py-1.5 flex items-center gap-2">
        {/*
          The identity region, which morphs rather than growing. With an offer it
          holds a pressable version of the same name plus a decline control; with
          none it holds the name as text. Both forms are `flex-1 min-w-0` and
          truncate, so the trailing verb group below never moves — a control that
          changes identity under the reader's pointer is the failure the whole
          composition is arranged to avoid.
        */}
        {handoff ? (
          <div className="min-w-0 flex-1 flex items-center gap-(--sp-inline)">
            <Button
              variant="ghost"
              size="sm"
              icon={KIND_ICON[handoff.kind]}
              onClick={onAcceptHandoff}
              className="min-w-0"
              // The visible label is the entity's name, which is a noun: on its
              // own it tells a screen-reader user nothing about what pressing it
              // does. `title` cannot carry that — on an element with content it
              // becomes the accessible description, not the name.
              ariaLabel={`Open ${handoff.name} in ${destinationLabel(handoff.kind)}`}
              title={`Open ${handoff.name} in ${destinationLabel(handoff.kind)}`}
            >
              <span className="min-w-0 truncate">{handoff.name}</span>
              <Icon type="handoff" size="sm" />
            </Button>
            <IconButton
              label={`Dismiss ${handoff.name}`}
              onClick={onDismissHandoff}
              variant="ghost"
              size="sm"
              title="Keep browsing what is on screen"
            >
              <Icon type="close" size="sm" />
            </IconButton>
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
            {displayName}
          </span>
        )}

        {/*
          Everything that varies with connection or context varies to the left of
          this group or in the band above it. These two are `shrink-0` and always
          in the same pixel, so the control under the reader's pointer never
          changes identity underneath them.
        */}
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            label={refreshLabel}
            onClick={onRefresh}
            variant="ghost"
            size="sm"
            title={refreshLabel}
          >
            <Icon type="refresh" size="sm" className={isLoading ? 'animate-spin' : ''} />
          </IconButton>
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
