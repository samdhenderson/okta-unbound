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
 * ## Position one is a safety property
 *
 * Every verb here except the selection control appears and disappears with the
 * selection size, so whatever sits first *changes as you tick rows*. The first
 * cut of this strip put `Merge` there at two selections — directly under the
 * pointer that had just been pressing `Select all`, and one press from copying
 * members into a survivor and emptying the sources. The two selection controls
 * now lead, `Deselect all` first the moment anything is ticked, and both are
 * `pinned` so the row wraps rather than overflowing them. Whatever the selection
 * size, the two leftmost controls cost at worst another click.
 *
 * ## The search field lives in the band
 *
 * `subRow` puts it inside the strip, under the verbs. The rung used to freeze a
 * whole toolbar zone above a nested list scroller — search, filters, strip — so
 * nothing up there ever moved and the strip could not dock: a grey block bolted
 * to the top of the page while every other strip in the app merges into the
 * header as it parks. Now the rung scrolls in the panel's one scroller, the strip
 * is sticky like every other, and the search field docks with it (ADR-0051 §5).
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
  /**
   * The rung's search field and filter toggle, rendered inside the band directly
   * beneath the verbs. It is here rather than above the strip so the two dock as
   * one surface: search stays reachable at any scroll offset, and the **More**
   * tier opens below it rather than between the verbs and the field they filter.
   */
  search?: React.ReactNode;
  /** Number of currently selected groups. */
  selectedCount: number;
  /** Number of groups after filtering — the *Select all* count and the export denominator. */
  filteredCount: number;
  /** Which inline panel is open; its trigger names the way back and is pinned. */
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
 * ## The blue button, and why it is *Export list* (ADR-0061, I-030)
 *
 * With no panel open — the state this rung rests in — every control here was
 * `secondary`, so six identically-weighted buttons sat above the list with nothing
 * saying where to start. Sam, on that strip: *"groups tab has no blue buttons and
 * it should."*
 *
 * ADR-0061 fixed the mechanism while the Rules strip was being built — `primary`
 * names a rung's **page-level verb**, and an open panel states itself in its label
 * rather than in a colour a screen reader cannot read — but deliberately did not
 * convert this strip, because applying the rule mechanically would have deleted
 * its `primary` and left it with none.
 *
 * *Export list* is the answer, and it is the only candidate that survives the
 * ADR's own test. *Compare (N)*, *Merge (N)*, *Export (N)* and *Bulk actions* are
 * all **selection-scoped** — they act on rows you ticked, so they are properties
 * of a selection rather than of the page, and they are absent entirely until one
 * exists. *Export list* acts on the whole filtered rung, is present in every state,
 * and is the one verb whose object is the thing the reader is looking at.
 *
 * The Rules strip's answer — a *Load* / *Refresh* verb — is **not** available here,
 * and that is a real difference rather than an oversight: the Groups list loads on
 * arrival, so there is no "fetch this rung" verb for a reader to press. That
 * asymmetry is the ADR's point: two strips now differ in which verb is blue because
 * the two rungs differ in what their page-level verb is.
 *
 * It passes the consequence test that decides whether a page verb may sit in the
 * row at all (ADR-0039): an export reads and writes a file, and pressing it twice
 * costs a second download.
 *
 * Selection-scoped verbs (*Compare*, *Merge*, *Bulk actions*, *Export (N)*,
 * *Deselect*) are **omitted** below their selection threshold rather than
 * shipped disabled, per ADR-0039 — a verb with nothing to act on is not a verb
 * yet. *Export list* is the one exception and is a genuinely transient disabled
 * state: it acts on the filter, not the selection, so at zero filtered rows it
 * is a live verb with an empty result, which is worth saying out loud rather
 * than hiding.
 *
 * Three verbs start behind **More**, for two different reasons. *Merge* and
 * *Bulk actions* are there on **consequence** (ADR-0039): the first empties the
 * source groups, the second deletes memberships across every selected group, and
 * neither has a symmetric undo. *Cleanup* is there on **frequency** — it is a
 * read-only triage report that would pass the consequence test, and simply does
 * not deserve row width that *Compare* and *Export* want. An open panel's trigger
 * is pulled back into the row regardless, so the control that closes it is always
 * reachable.
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
  search,
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
  /**
   * An inline-panel trigger. It states its own state in **words** — closed it names
   * what it will show, open it names the way back — and is `pinned` while open so
   * the control that closes a panel can never be the thing hiding behind **More**
   * (ADR-0061).
   *
   * It used to say so in colour instead: the open trigger took `variant: 'primary'`,
   * which `ActionBar` also reads as `pinned`. That carried the pinning for free but
   * made the open state colour-only — a screen reader was told nothing, and the
   * strip's one blue button meant "a panel is open" rather than "start here".
   */
  const panelAction = (
    panel: Exclude<ActivePanel, 'none'>,
    closedLabel: string,
    openLabel: string,
    icon: ActionDescriptor['icon'],
    restingPriority: ActionDescriptor['priority'] = 'flex',
  ): ActionDescriptor => {
    const open = activePanel === panel;
    return {
      id: panel,
      label: open ? openLabel : closedLabel,
      icon,
      onClick: () => onTogglePanel(panel),
      priority: open ? 'pinned' : restingPriority,
    };
  };

  const actions: ActionDescriptor[] = [
    /*
      Position one is always the selection control, and it is `pinned` so it can
      never be pushed out of the row. This is a safety property, not a layout
      preference: every other verb here appears and disappears with the selection
      size, so whatever sits first changes as you tick rows. With `Merge` in the
      row that meant the button under the pointer where `Select all` had been was
      the one that empties groups. First is now `Deselect all` the moment anything
      is ticked, and `Select all` when nothing is — two controls whose worst
      outcome is that you have to click again.
    */
    ...(selectedCount > 0
      ? [
          {
            id: 'deselect-all',
            label: 'Deselect all',
            onClick: onDeselectAll,
            priority: 'pinned' as const,
          },
        ]
      : []),
    {
      // Always present, disabled rather than omitted once there is nothing left
      // to take — the same transient-disabled case as `Export list`, and the
      // reason is the count: `(M)` is the strip's only statement of how many rows
      // the current filter matches, so it has to survive a full selection.
      id: 'select-all',
      label: `Select all (${filteredCount})`,
      onClick: onSelectAll,
      disabled: filteredCount === 0 || selectedCount === filteredCount,
      title: 'Select every group the current filter matches',
      priority: 'pinned' as const,
    },
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
    panelAction(
      'crossSearch',
      crossSearchBadge > 0 ? `Cross-search (${crossSearchBadge})` : 'Cross-search',
      'Hide cross-search',
      'search',
    ),
    panelAction('collections', 'Collections', 'Hide collections', 'clipboard'),
    {
      // The rung's page-level verb, and the reason this strip has a `primary` at
      // all — see the docblock. `primary` implies `pinned`, so it never leaves the
      // row.
      id: 'export-list',
      label: 'Export list',
      icon: 'download',
      variant: 'primary',
      onClick: onExportGroupsList,
      disabled: filteredCount === 0,
      title: 'Export the current groups list as CSV',
    },

    /*
      Behind **More** from the start, all three, for the two different reasons
      ADR-0039 and ADR-0051 give.

      Consequence, for the first two. `Merge` copies members into a survivor and
      then **empties the sources** — a mega-group and a set of husks, with no
      symmetric undo — and `Bulk actions` offers *Clean inactive users* and
      *Remove user from all*, which delete memberships across every selected
      group. Each owns a confirmation of its own (the merge wizard previews the
      delta and what breaks; the bulk panel reports per-group results), but
      ADR-0039 is about where a verb *starts*, and neither of these starts in the
      row.

      Frequency, for the third. `Cleanup` is a read-only triage report and could
      sit in the row on consequence grounds; it is the rarest verb on the rung, so
      it does not spend row width that `Compare` and `Export` want.
    */
    ...(selectedCount >= 2
      ? [
          {
            id: 'merge',
            label: `Merge (${selectedCount})`,
            icon: 'link' as const,
            onClick: onMerge,
            priority: 'tier' as const,
            title: 'Copies members into one survivor and empties the others',
          },
        ]
      : []),
    ...(selectedCount > 0
      ? [panelAction('bulk', 'Bulk actions', 'Hide bulk actions', 'list', 'tier')]
      : []),
    panelAction('cleanup', 'Cleanup', 'Hide cleanup', 'sparkles', 'tier'),
  ];

  return (
    <ActionBar
      ariaLabel="Actions for the groups list"
      actions={actions}
      subRow={search}
      testId="groups-list-action-bar"
    />
  );
};

export default GroupsListActionBar;
