/**
 * @module sidepanel/components/groups/GroupsListActionBar
 * @description The groups-list rung's action strip — the ADR-0039 wrapper the
 * list rung was missing.
 *
 * It replaces `GroupSelectionBar`, which was ten `Button`s and a count laid out
 * by hand on a `bg-neutral-50` card. Three things were wrong with that, and only
 * the last one is cosmetic:
 *
 * 1. **It could not overflow.** Ten verbs need well past 700px of row; the panel
 *    opens at 480 and drags to 360. The row simply wrapped to three lines of
 *    buttons, and the least-used verbs (*Cleanup*, *Collections*) took the same
 *    space as *Compare*. `ActionBar` measures each verb and re-splits the row as
 *    the panel is dragged, moving the tail behind **More** (ADR-0038).
 * 2. **Grey is the panel's disabled/inert wash.** Every other resting surface on
 *    the rung is white; a grey slab of controls above a white list read as a
 *    section that had been switched off.
 * 3. It was a fourth kind of box on a rung that already has a header, cards and
 *    rows.
 *
 * ## Where the counts went
 *
 * The old bar led with a `N of M selected` readout. That sentence is now carried
 * by the verbs that need it — *Compare (3)*, *Merge (3)*, *Export (3)*, *Select
 * all (128)* — because a count is only ever read in order to decide whether to
 * press something. `GroupsListPanel` still prints its own `Showing X of Y`
 * beneath the list, so the filtered denominator has not gone anywhere either.
 *
 * ## Why the open panel's trigger turns primary
 *
 * `ActionDescriptor` carries no JSX and no `className`, deliberately — a strip
 * that cannot see what it holds cannot decide what fits. So the open inline
 * panel is marked the way the descriptor vocabulary allows: `variant: 'primary'`,
 * which `ActionBar` also treats as `priority: 'pinned'`. Both halves of that are
 * wanted here. At most one panel is open at a time, so the "at most one primary
 * per strip" rule holds by construction; and pinning it keeps the control that
 * *closes* the open panel in the row, rather than letting it overflow behind
 * **More** while the panel it toggles sits open below.
 */
import React from 'react';
import { ActionBar, type ActionDescriptor } from '../shared';

/** Which inline panel (if any) is currently open below the bar. */
export type ActivePanel = 'none' | 'bulk' | 'crossSearch' | 'collections' | 'cleanup';

/** Props for {@link GroupsListActionBar}. */
interface GroupsListActionBarProps {
  /** Number of currently selected groups. */
  selectedCount: number;
  /** Number of groups after filtering — the *Select all* count and the export denominator. */
  filteredCount: number;
  /** Which inline panel is open; its trigger renders primary and pinned. */
  activePanel: ActivePanel;
  /** `groupMembersCache.size` — appended to the Cross-search label when above zero. */
  crossSearchBadge: number;
  /** Selects every filtered group. */
  onSelectAll: () => void;
  /** Clears the selection. */
  onDeselectAll: () => void;
  /** Opens the comparison modal (offered only for 2–5 selections). */
  onCompare: () => void;
  /** Opens the merge wizard (offered for 2+ selections). */
  onMerge: () => void;
  /** Toggles the given inline panel open/closed. */
  onTogglePanel: (panel: ActivePanel) => void;
  /** Exports the selected groups. */
  onExportSelection: () => void;
  /** Exports the current (filtered) groups list. */
  onExportGroupsList: () => void;
}

/**
 * The groups-list action strip.
 *
 * Selection-scoped verbs (*Compare*, *Merge*, *Bulk actions*, *Export (N)*,
 * *Deselect*) are **omitted** below their selection threshold rather than
 * shipped disabled, per ADR-0039 — a verb with nothing to act on is not a verb
 * yet. *Export list* is the one exception and is a genuinely transient disabled
 * state: it acts on the filter, not the selection, so at zero filtered rows it
 * is a live verb with an empty result, which is worth saying out loud rather
 * than hiding.
 *
 * *Cleanup* opens a triage panel that reads the whole org and is the rarest verb
 * here, so it starts behind **More** (`priority: 'tier'`) instead of competing
 * for row space — unless it is the open panel, in which case it is pinned like
 * any other open panel's trigger.
 *
 * @example
 * ```tsx
 * <GroupsListActionBar
 *   selectedCount={selected.size}
 *   filteredCount={filtered.length}
 *   activePanel={activePanel}
 *   crossSearchBadge={cache.size}
 *   {...handlers}
 * />
 * ```
 */
const GroupsListActionBar: React.FC<GroupsListActionBarProps> = ({
  selectedCount,
  filteredCount,
  activePanel,
  crossSearchBadge,
  onSelectAll,
  onDeselectAll,
  onCompare,
  onMerge,
  onTogglePanel,
  onExportSelection,
  onExportGroupsList,
}) => {
  /** An inline-panel trigger: primary + pinned while its panel is the open one. */
  const panelAction = (
    panel: Exclude<ActivePanel, 'none'>,
    label: string,
    icon: ActionDescriptor['icon'],
    restingPriority: ActionDescriptor['priority'] = 'flex',
  ): ActionDescriptor => {
    const open = activePanel === panel;
    return {
      id: panel,
      label,
      icon,
      onClick: () => onTogglePanel(panel),
      priority: open ? 'pinned' : restingPriority,
      ...(open ? { variant: 'primary' as const } : {}),
    };
  };

  const actions: ActionDescriptor[] = [
    ...(selectedCount >= 2 && selectedCount <= 5
      ? [
          {
            id: 'compare',
            label: `Compare (${selectedCount})`,
            icon: 'chart' as const,
            onClick: onCompare,
          },
        ]
      : []),
    ...(selectedCount >= 2
      ? [
          {
            id: 'merge',
            label: `Merge (${selectedCount})`,
            icon: 'link' as const,
            onClick: onMerge,
          },
        ]
      : []),
    ...(selectedCount > 0 ? [panelAction('bulk', 'Bulk actions', 'list')] : []),
    ...(selectedCount > 0
      ? [
          {
            id: 'export-selection',
            label: `Export (${selectedCount})`,
            icon: 'download' as const,
            onClick: onExportSelection,
          },
        ]
      : []),
    {
      id: 'select-all',
      label: `Select all (${filteredCount})`,
      onClick: onSelectAll,
      disabled: filteredCount === 0 || selectedCount === filteredCount,
      title: 'Select every group the current filter matches',
    },
    ...(selectedCount > 0
      ? [{ id: 'deselect-all', label: 'Deselect', onClick: onDeselectAll }]
      : []),
    panelAction(
      'crossSearch',
      crossSearchBadge > 0 ? `Cross-search (${crossSearchBadge})` : 'Cross-search',
      'search',
    ),
    panelAction('collections', 'Collections', 'clipboard'),
    {
      id: 'export-list',
      label: 'Export list',
      icon: 'download',
      onClick: onExportGroupsList,
      disabled: filteredCount === 0,
      title: 'Export the current groups list as CSV',
    },
    panelAction('cleanup', 'Cleanup', 'sparkles', 'tier'),
  ];

  return (
    <ActionBar
      ariaLabel="Actions for the groups list"
      actions={actions}
      /* The list rung is a fixed toolbar zone above its own scroller
         (`GroupsTab`), so there is nothing here for the strip to pin against and
         nothing to merge into. */
      sticky={false}
      testId="groups-list-action-bar"
    />
  );
};

export default GroupsListActionBar;
