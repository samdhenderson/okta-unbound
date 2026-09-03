/**
 * @module sidepanel/components/groups/GroupListItem
 * @description One compact, scannable row in the groups list.
 *
 * Rebuilt around a single question — *where do this group's members come from?* —
 * so the row encodes state instead of listing badges. Its anatomy:
 *
 * ```
 * [✓] Engineering                      OKTA        [⚡] [↗] [›]
 *     All engineering staff
 *     ▓▓▓▓▓░░  128 members  Rule-managed 96 · Manual 32  Fed by 2 rules
 * ```
 *
 * - **Identity line** — the Okta description, falling back to the group id when
 *   it is blank (they frequently are), so the line never renders empty.
 * - **State encoding** — the member-source meter, which is also where the member
 *   count now lives; there is no separate metrics strip.
 * - **Two open affordances, two accessible names.** The chevron (`Expand` /
 *   `Collapse`) discloses an inline preview; the row body (`View group details`)
 *   drills into the Group Detail view. Both are real buttons, and the chevron
 *   carries `aria-expanded`/`aria-controls` — neither of which the old row had.
 * - **Progressive controls.** The selection checkbox and the action icons are
 *   revealed on hover, on `:focus-within` (so keyboard users see them), and
 *   permanently on touch devices, which have no hover. A *selected* checkbox
 *   stays visible unconditionally, or selection would vanish while scrolling.
 *
 * The card around all of that — border, radius, hover, `compact` padding and the
 * selected/highlighted state — is the shared
 * {@link module:sidepanel/components/shared/ListRow} (ADR-0029). The inline
 * preview goes in its `body` slot, which sits inside the row's border but outside
 * the header's padding, so the preview keeps its own full-bleed separator.
 *
 * The meter renders only from a breakdown that has **already** been computed and
 * banked in {@link module:sidepanel/cache/memberSourceCache} — the row reads it
 * through {@link module:sidepanel/hooks/useCachedMemberSource}, which has no API
 * access at all. Computing one costs `ceil(N/200)` member requests, so a list of
 * rows must never do it on its own; the row instead offers an explicit "analyze"
 * action that hands the job to the detail view.
 *
 * **Default shallow compare, deliberately — no custom comparator.** There was one,
 * listing every field the row renders plus the callback props; enumerating it against
 * the render body (`D-045`, following `RuleCard`'s `D-039`) found every field already
 * there, so it added no correctness over the default while still being a hand-written
 * list that will silently drift the moment the row grows a new field. `group` objects
 * come from the groups list with stable per-id identity, so the honest shallow compare
 * skips unaffected rows exactly as effectively and cannot go stale.
 */
import React, { useState, useCallback, useMemo, memo } from 'react';
import { Checkbox, IconButton, ListRow, StretchedButton } from '../shared';
import Icon from '../shared/Icon';
import GroupListItemSignal from './GroupListItemSignal';
import GroupListItemDetails from './GroupListItemDetails';
import { summarizeGroupRow } from './groupSourceSummary';
import { useCachedMemberSource } from '../../hooks/useCachedMemberSource';
import type { GroupSummary } from '../../../shared/types';
import { oktaAdminEntityUrl } from '../../../shared/utils/oktaUrl';

/**
 * Controls that fade in on hover or keyboard focus and stay put on touch.
 *
 * Tailwind wraps `hover:` variants in `@media (hover: hover)`, so a touch device
 * would otherwise never reveal them — hence the explicit `hover: none` branch.
 */
const REVEAL_ON_HOVER =
  'opacity-0 transition-opacity duration-(--dur-instant) ' +
  'group-hover/row:opacity-100 group-focus-within/row:opacity-100 ' +
  'focus-within:opacity-100 [@media(hover:none)]:opacity-100';

/** Props for {@link GroupListItem}. */
interface GroupListItemProps {
  /** The group to render. */
  group: GroupSummary;
  /** Whether this row is selected — a selected row shows its checkbox unconditionally. */
  selected: boolean;
  /** Toggles selection for this group's id. */
  onToggleSelect: (groupId: string) => void;
  /** Okta origin, enabling the "Open in Okta" deep link when present. */
  oktaOrigin?: string;
  /**
   * Drills into this group's read-only detail view. When omitted the row body is
   * inert (no overlay button) — the chevron still expands the inline preview.
   */
  onOpenDetail?: (group: GroupSummary) => void;
  /**
   * Requests the (paid) member-source analysis for this group. Offered only while
   * no breakdown is cached; the handler is expected to run the analysis somewhere
   * that can show its cost and progress, and bank the result for the row to read.
   */
  onAnalyzeSource?: (group: GroupSummary) => void;
  /** When true, the row auto-expands and shows a highlight ring (deep-link target). */
  isHighlighted?: boolean;
}

/** Memoised compact row for one group in the groups list. */
const GroupListItem: React.FC<GroupListItemProps> = memo(
  ({
    group,
    selected,
    onToggleSelect,
    oktaOrigin,
    onOpenDetail,
    onAnalyzeSource,
    isHighlighted = false,
  }) => {
    const [expanded, setExpanded] = useState(false);
    // Lazily mounts `GroupListItemDetails` on first expand, then leaves it mounted
    // (hidden by `.disclose`'s zero-height row) for the rest of the row's life, so
    // the *close* transition has real content to shrink instead of vanishing
    // instantly. Rows never expanded at all — the overwhelming majority in a long
    // list — never pay to render the preview at all. Derived during render, not an
    // effect, mirroring the codebase's other derived-state resets (e.g.
    // GroupsListPanel's visible-window reset).
    const [everExpanded, setEverExpanded] = useState(false);
    if (expanded && !everExpanded) setEverExpanded(true);
    const breakdown = useCachedMemberSource(group.id);
    const model = useMemo(() => summarizeGroupRow(group, breakdown), [group, breakdown]);

    const detailsId = `group-row-details-${group.id}`;
    const nameId = `group-row-name-${group.id}`;

    // Auto-expand when highlighted (deep-linked from the Rules tab).
    React.useEffect(() => {
      if (isHighlighted) setExpanded(true);
    }, [isHighlighted]);

    const handleToggleSelect = useCallback(() => {
      onToggleSelect(group.id);
    }, [onToggleSelect, group.id]);

    const toggleExpanded = useCallback(() => {
      setExpanded((prev) => !prev);
    }, []);

    const handleOpenDetail = useCallback(() => {
      onOpenDetail?.(group);
    }, [onOpenDetail, group]);

    const handleAnalyzeSource = useCallback(() => {
      onAnalyzeSource?.(group);
    }, [onAnalyzeSource, group]);

    const handleOpenInOkta = useCallback(() => {
      const url = oktaAdminEntityUrl(oktaOrigin, 'group', group.id);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }, [oktaOrigin, group.id]);

    const canAnalyze = Boolean(onAnalyzeSource) && model.source.kind === 'unknown';

    return (
      <ListRow
        density="compact"
        // The two states *compose* in this row rather than one winning: `selected`
        // paints the border and background, and a deep link adds a ring on top of
        // whatever is underneath. `highlighted` is a superset of `selected`, so
        // testing it first reproduces both combinations exactly.
        state={isHighlighted ? 'highlighted' : selected ? 'selected' : 'default'}
        // Deep-link arrival: a background/border flash (`--dur-tell`, the
        // "deliberately noticeable" duration) that decays to transparent on its
        // own — a one-shot confirmation over the ring, not a steady state.
        flash={isHighlighted}
        className="group/row"
        dataAttributes={{ 'data-group-id': group.id }}
        // `body` is what keeps the padding boundary intact: `density` moves off the
        // card and onto the header wrapper, so the header keeps exactly its old
        // `px-3 py-2` while the preview below stays flush to the border and draws
        // its own full-bleed separator. `relative` therefore belongs on that header
        // wrapper — it scopes the row-body overlay to the header, leaving the
        // expanded preview freely clickable. Controls inside the header sit above
        // the overlay via `relative z-10`.
        headerClassName="relative flex items-start gap-(--sp-field)"
        body={
          /*
            `.disclose` animates `grid-template-rows` (0fr closed → 1fr open)
            instead of toggling `display`, so the outer wrapper is always mounted
            (the chevron's `aria-controls` always resolves to a real element) and
            `inert` keeps a closed row out of the tab order/accessible tree without
            unmounting it. The preview itself is lazily mounted on first expand —
            see `everExpanded` above.
          */
          <div
            id={detailsId}
            className="disclose"
            data-open={expanded}
            inert={!expanded || undefined}
          >
            <div>
              {everExpanded && <GroupListItemDetails group={group} breakdown={breakdown} />}
            </div>
          </div>
        }
      >
        {onOpenDetail && (
          <StretchedButton
            label="View group details"
            describedBy={nameId}
            title={`Open the detail view for ${group.name}`}
            onClick={handleOpenDetail}
          />
        )}

        <div
          className={`relative z-10 flex items-center pt-0.5 ${selected ? '' : REVEAL_ON_HOVER}`}
        >
          <Checkbox
            checked={selected}
            onChange={handleToggleSelect}
            aria-label={`Select ${group.name}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-(--sp-inline)">
            {/*
              `title` carries the untruncated name for a hover/focus reveal —
              the name is already in the accessibility tree via the visible
              text, so this is purely for the visual reader when `truncate`
              clips it. Omitted rather than set to `""` when the name is
              empty (I-011).
            */}
            <h3
              id={nameId}
              className="min-w-0 truncate text-sm font-semibold text-neutral-900 group-hover/row:text-primary-text"
              title={group.name || undefined}
            >
              {group.name}
            </h3>

            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${model.typeBadge.className}`}
            >
              {model.typeBadge.label}
            </span>

            {model.sourceApp && (
              <span
                className="shrink-0 truncate rounded-md border border-primary-highlight bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-text"
                title={`Mastered by ${model.sourceApp}`}
              >
                {model.sourceApp}
              </span>
            )}

            <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5">
              {canAnalyze && (
                <span className={REVEAL_ON_HOVER}>
                  <IconButton
                    label="Analyze member source"
                    title={`Analyze where ${group.name}'s ${model.memberCount.toLocaleString()} ${model.memberNoun} came from — reads them all once`}
                    onClick={handleAnalyzeSource}
                    size="sm"
                  >
                    <Icon type="chart" size="sm" />
                  </IconButton>
                </span>
              )}

              {oktaOrigin && (
                <span className={REVEAL_ON_HOVER}>
                  <IconButton label="Open in Okta" onClick={handleOpenInOkta} size="sm">
                    <Icon type="external-link" size="sm" />
                  </IconButton>
                </span>
              )}

              <IconButton
                // Names the group for the same reason `AppListItem` names its
                // app (D-103): a bare "Expand" repeated down a list tells a
                // screen-reader user nothing about which row they are on. No id
                // — see `D-107` for the duplicate-name case.
                label={expanded ? `Collapse ${group.name}` : `Expand ${group.name}`}
                onClick={toggleExpanded}
                expanded={expanded}
                controls={detailsId}
                size="sm"
              >
                <Icon
                  type="chevron-right"
                  size="sm"
                  className={`transition-transform duration-(--dur-instant) ${expanded ? 'rotate-90' : ''}`}
                />
              </IconButton>
            </div>
          </div>

          {/*
            The two interior lines the row typography contract names: a secondary
            line for the description, and the identifier treatment for the id
            fallback (ADR-0029 §2, `docs/design-system.md`).
          */}
          <p
            className={`mt-0.5 truncate text-xs ${
              model.identity.kind === 'id' ? 'font-mono text-neutral-500' : 'text-neutral-600'
            }`}
            title={model.identity.title}
          >
            {model.identity.text}
          </p>

          <GroupListItemSignal model={model} />
        </div>
      </ListRow>
    );
  },
);

GroupListItem.displayName = 'GroupListItem';

export default GroupListItem;
