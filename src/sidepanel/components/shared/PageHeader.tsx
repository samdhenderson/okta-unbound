/**
 * @module sidepanel/components/shared/PageHeader
 * @description Top-of-view header bar — title with optional subtitle, status badge, leading
 * back affordance, breadcrumb trail, trailing actions, and an expanding identity region.
 *
 * All leading-slot props (`onBack`, `leading`, `breadcrumbs`) are additive and
 * optional: a header rendered without them is byte-identical to the pre-existing
 * layout. They exist so a tab using
 * {@link sidepanel/hooks/useViewStack.useViewStack} can keep **one** header mounted
 * and swap its contents in place as views are pushed and popped, rather than each
 * view rendering its own header (ADR-0008's stable-region precedent).
 *
 * ## The identity region
 *
 * {@link PageHeaderProps.identity} extends that idea downward: the header is the single
 * place the entity you are browsing is described, so a detail view no longer opens with a
 * card repeating the name and type already in the title. The region grows and shrinks with
 * its content and crossfades when {@link PageHeaderProps.identityKey} changes.
 *
 * This component owns **chrome only** (ADR-0029) — the expansion, the transition, the
 * layout. It never learns what a group or a user is: tabs pass an opaque node, normally an
 * {@link sidepanel/components/shared/EntityIdentity.EntityIdentity} built from a
 * per-entity descriptor.
 *
 * ## What is deliberately outside the transition
 *
 * The `<h1>`, its badge and the breadcrumbs update **synchronously**; only the identity
 * region crossfades. Two reasons, one visual and one structural: the title is the anchor
 * the whole panel is read against, so it is the last thing that should flicker; and holding
 * an outgoing headline on screen while the incoming one mounts would put two `<h1>`s in the
 * tree mid-transition, which `GroupsTab`/`UsersTab` navigation tests assert can never
 * happen.
 */
import React, { useEffect, useRef, useState } from 'react';
import Icon from '../overview/shared/Icon';
import IconButton from './IconButton';
import Badge, { type BadgeVariant } from './Badge';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublishedHeight } from '../../hooks/usePublishedHeight';
import { useStuck } from '../../hooks/useStuck';

/**
 * How long the outgoing identity is held before the incoming one replaces it.
 *
 * Hand-kept mirror of `--dur-move` (`docs/design-system.md` — same arrangement as
 * `Modal`'s `EXIT_MS` and `useCountUp`'s `COUNT_UP_MS`; there is no lint gate). The region
 * collapses to `0fr` over that duration while the old content fades over the shorter
 * `--dur-quick`, so the swap lands exactly as the region reaches zero height and the new
 * content expands from nothing rather than jumping.
 */
const SWAP_MS = 220;

interface PageHeaderProps {
  /** Page/section heading. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /**
   * Optional trailing action node(s), right-aligned (e.g. a {@link Button} or an
   * {@link OpenInOktaLink}). Shares the trailing cluster with
   * {@link PageHeaderProps.badge}, which sits to their left.
   */
  actions?: React.ReactNode;
  /**
   * Optional back handler. When set, a leading chevron-left {@link IconButton} is
   * rendered before the title. Pass `undefined` at the root of a view stack to
   * hide it. Ignored when {@link PageHeaderProps.leading} is supplied.
   */
  onBack?: () => void;
  /** Accessible name / tooltip for the back button. Defaults to `Back`. */
  backLabel?: string;
  /**
   * Custom node for the leading slot, replacing the default back button (e.g. an
   * avatar or a status glyph). Takes precedence over
   * {@link PageHeaderProps.onBack}.
   */
  leading?: React.ReactNode;
  /**
   * Optional breadcrumb trail rendered above the title — typically a
   * {@link Breadcrumbs} fed from a view stack's `trail`.
   */
  breadcrumbs?: React.ReactNode;
  /**
   * Optional coloured mark rendered in the trailing cluster, immediately before
   * {@link PageHeaderProps.actions}. Defaults to `neutral`.
   */
  badge?: {
    text: string;
    /** Treatment from the canonical shared {@link BadgeVariant} vocabulary. */
    variant?: BadgeVariant;
  };
  /**
   * Optional identity region rendered below the title, expanding and collapsing with its
   * own content. Pass `undefined` on a rung with no entity (a list, a search) and the
   * region closes to nothing.
   */
  identity?: React.ReactNode;
  /**
   * Stable key for whatever {@link PageHeaderProps.identity} describes — normally the
   * entity's Okta id.
   *
   * A **changed** key means a different entity and plays the crossfade. An **unchanged**
   * key means the same entity's data refreshed (a member count arriving, a status
   * changing) and swaps silently, because animating a background refresh would report
   * navigation that did not happen.
   */
  identityKey?: string;
  /**
   * Pin the header below the tab rail as the page scrolls under it, collapsing the
   * identity region so the title, its badge and the back button stay on screen through a
   * long list. Defaults to `false`, which leaves the header scrolling away as before.
   *
   * Pass the tab's `isActive`, not a bare `true`: a hidden panel is `display: none`, so
   * its sentinel never intersects and it would otherwise report a permanently pinned
   * header and publish a stale height (ADR-0018).
   */
  sticky?: boolean;
}

/**
 * Standardized header bar rendered at the top of a tab/view.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Groups"
 *   subtitle="Manage Okta group membership"
 *   badge={{ text: 'Beta', variant: 'primary' }}
 *   actions={<Button icon="plus">New</Button>}
 * />
 * ```
 *
 * @example Drilled-in view of a {@link sidepanel/hooks/useViewStack.useViewStack} stack
 * ```tsx
 * const identity = detailGroup ? groupIdentity(detailGroup) : undefined;
 * <PageHeader
 *   title={identity?.name ?? 'Groups'}
 *   badge={identity?.badge}
 *   identityKey={identity?.key}
 *   identity={identity && <EntityIdentity lines={identity.lines} />}
 *   onBack={nav.isRoot ? undefined : nav.pop}
 *   breadcrumbs={nav.isRoot ? undefined : <Breadcrumbs items={nav.trail} />}
 * />
 * ```
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
  onBack,
  backLabel = 'Back',
  leading,
  breadcrumbs,
  identity,
  identityKey,
  sticky = false,
}) => {
  const reduced = useReducedMotion();
  const headerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const pinned = useStuck(sentinelRef, headerRef, sticky);

  // The action strip of a detail view parks directly beneath this header, so it needs to
  // know how tall the header currently is — including mid-collapse, which is what keeps
  // the two flush as the region animates shut (ADR-0032).
  usePublishedHeight(headerRef, '--header-h', {
    scopeSelector: '[data-header-scope]',
    enabled: sticky,
  });

  // The outgoing identity has to survive its own fade, so it is held in state while the
  // incoming one waits. `latest` keeps the current node reachable from the swap timer
  // without making it an effect dependency — `identity` is a fresh element on every
  // render, so depending on it would re-arm the timer continuously. Written from an
  // effect rather than during render (refs are commit-phase state), which is early
  // enough: the timer cannot fire before the commit that armed it.
  const latest = useRef(identity);
  useEffect(() => {
    latest.current = identity;
  });

  const [held, setHeld] = useState<{ key: string | undefined; node: React.ReactNode }>({
    key: identityKey,
    node: identity,
  });
  const [fading, setFading] = useState(false);

  // Adjusting state during render on a prop change, the same pattern `Modal` uses for its
  // exit hold: React re-renders immediately without committing the intermediate frame.
  if (held.key !== identityKey && !fading) {
    setHeld({ key: identityKey, node: held.node });
    setFading(true);
  }

  useEffect(() => {
    if (!fading) return;
    // `held.key` was already advanced to the incoming key when the fade started, so only
    // the node needs catching up. If the key changed *again* mid-fade, the render-time
    // guard sees the mismatch on the next pass and chains a second fade.
    const finish = () => {
      setHeld((prev) => ({ key: prev.key, node: latest.current }));
      setFading(false);
    };
    if (reduced) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [fading, reduced]);

  const leadingNode =
    leading ??
    (onBack ? (
      <IconButton label={backLabel} variant="subtle" onClick={onBack}>
        <Icon type="chevron-left" size="md" />
      </IconButton>
    ) : null);

  // While fading, the frozen outgoing node stays on screen; otherwise the live one does, so
  // a same-entity data refresh is reflected without waiting on any timer.
  const shownIdentity = fading ? held.node : identity;
  const regionOpen = Boolean(shownIdentity) && !fading && !pinned;

  // A header that has never been given an identity renders exactly the markup it did
  // before this region existed — the five call sites that do not use it are untouched.
  const hasRegion = Boolean(identity) || fading;
  const align = hasRegion ? 'items-start' : 'items-center';

  return (
    <>
      {/*
        Zero-height sentinel in normal flow: once it scrolls past the line the header
        sticks to, the header is pinned. See `useStuck`.
      */}
      {sticky && <div ref={sentinelRef} aria-hidden="true" className="h-0" />}
      <div
        ref={headerRef}
        className={`bg-white border-b border-neutral-200 ${
          sticky ? 'sticky top-[var(--rail-h,0px)] z-20' : ''
        }`}
      >
        <div className={`px-5 py-4 flex ${align} justify-between gap-4`}>
          <div className={`flex-1 min-w-0 flex ${align} gap-2`}>
            {leadingNode && <div className="shrink-0">{leadingNode}</div>}
            <div className="flex-1 min-w-0">
              {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
              <h1
                className="text-lg font-semibold text-neutral-900"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {title}
              </h1>
              {subtitle && <p className="mt-0.5 text-sm text-neutral-600">{subtitle}</p>}

              {/*
              Inside the title column rather than below the whole row, so the lines align
              with the title instead of with the back button. `.disclose` needs exactly one
              child carrying the clipping; the padded content is that child's child, which
              is also why its `mt-2` cannot add height while the region is closed.
            */}
              {hasRegion && (
                <div className="disclose" data-open={regionOpen ? 'true' : 'false'}>
                  <div>
                    <div
                      className={`mt-2 transition-opacity duration-(--dur-quick) ${
                        fading ? 'opacity-0 ease-exit' : 'opacity-100 ease-entrance'
                      }`}
                    >
                      {shownIdentity}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/*
            The badge is a trailing mark, not part of the title: at 360px a badge beside
            the `<h1>` pushes a long entity name into a second and third line before the
            region below it has said anything. Here it sits with the actions, immediately
            left of the Okta link, and the title gets the width.
          */}
          {(badge || actions) && (
            <div className="shrink-0 flex items-center gap-2">
              {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
              {actions}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PageHeader;
