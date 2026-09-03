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
 * ## Two rows, because there were always two kinds of verb
 *
 * The strip declares a page-scoped `actions` row and a selection-scoped
 * `register`, and `ActionBar` renders the second as a recessed well one tonal
 * step below the first — no border, no rule, no divider between them.
 *
 * The split is not decoration. *Export list* acts on the filter and is present in
 * every state; *Export (3)* acts on the ticked rows and is gone the moment they
 * are unticked. Sharing one row, those two were indistinguishable, and the row's
 * meaning changed under the pointer every time a checkbox moved.
 *
 * **The register shares its space, it does not stack.** It is passed
 * unconditionally, so at rest it still holds `Select all (M)` and is still a row.
 * Ticking the first checkbox adds controls to a row that already exists; nothing
 * below the band moves. A register that appeared on the first tick would push the
 * list down under the pointer that was ticking it, so the reader's next click
 * lands on the row beneath the one they meant.
 *
 * ## Where the counts went
 *
 * The old bar led with a `N of M selected` readout. **M** rides the verb that
 * offers to take it, *Select all (128)*, and **N** rides every verb scoped to it
 * — *Compare (3)*, *Merge (3)*, *Export (3)* — because a count is only ever read
 * in order to decide whether to press something. The plain statement of both
 * belongs to `GroupsListPanel`'s own line beneath the list
 * (`Showing 128 of 214 · 3 selected`), which is the one place either number is
 * written as prose.
 *
 * ## Position one is a safety property
 *
 * Every control in the register except the selection control appears and
 * disappears with the selection size, so whatever sits first *changes as you tick
 * rows*. The first cut of this strip put `Merge` there at two selections —
 * directly under the pointer that had just been pressing `Select all`, and one
 * press from copying members into a survivor and emptying the sources. The two
 * selection controls lead, `Deselect all` first the moment anything is ticked,
 * and both are `pinned` so the row wraps rather than overflowing them. Whatever
 * the selection size, the two leftmost controls cost at worst another click.
 * (ADR-0051 §2, which survives ADR-0061 and ADR-0068 untouched.)
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
 * ## A panel toggle is not a verb
 *
 * *Cross-search*, *Collections*, *Cleanup* and *Bulk actions* show and hide an
 * inline panel. That is not an operation on the rung, so they are `ghost` —
 * chromeless, next to the bordered `secondary` of a verb and the fill of the
 * `primary`. Their state lives in the **label** and nowhere else (*Cross-search
 * (5)* → *Hide cross-search*), because a descriptor carries no `aria-pressed` and
 * no `className`, and an open/closed distinction made in colour alone is one no
 * screen reader can read (ADR-0061 §2).
 *
 * The one mechanical thing an open trigger keeps is `priority: 'pinned'`, set
 * explicitly rather than as a side effect of a `variant`: the control that
 * *closes* a panel must never be the one hiding behind **More** while the panel
 * it toggles sits open below (ADR-0051 §1, the half that survives).
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
 * ## The blue button, and why it is still *Export list* (ADR-0068 §2, softened)
 *
 * ADR-0068 replaced "the rung's page-level verb" with a narrower test: `primary`
 * marks a verb that **acts** — its object is the whole page *and* pressing it
 * opens a modal or performs the operation.
 *
 * **This rung has no such verb.** *Cross-search*, *Collections* and *Cleanup*
 * open read-only panels; every verb that writes — *Merge*, *Bulk actions* — is
 * scoped to a selection, so it is a property of what you ticked rather than of
 * the page, and absent entirely until something is ticked. Under §2 as first
 * written the honest answer would have been "no `primary` at all", which is a
 * real answer and not a gap to fill.
 *
 * The softened §2 admits the other one: **an export may hold `primary` on a rung
 * that has no acting verb** (a refresh still may not, ever). *Export list* is the
 * only control present in every state whose object is the thing the reader is
 * looking at, and with no acting verb to displace it there is nothing the fill is
 * being taken from. Every *other* export in the app — including *Export (N)* in
 * the register below — is `tier` under the flat rule.
 *
 * The Rules strip's old answer, a *Load* / *Refresh* verb, is not available here
 * and would not be allowed if it were: the Groups list loads on arrival, and a
 * refresh is never `primary`.
 *
 * Selection-scoped verbs (*Compare*, *Merge*, *Bulk actions*, *Export (N)*,
 * *Deselect*) are **omitted** below their selection threshold rather than
 * shipped disabled, per ADR-0039 — a verb with nothing to act on is not a verb
 * yet.
 *
 * ## The two deliberate disabled states, and what they say
 *
 * *Export list* acts on the filter, not the selection, so at zero filtered rows
 * it is a live, wired verb with an empty result — worth saying out loud rather
 * than making the control vanish (ADR-0051 §3).
 *
 * *Select all (M)* stays visible and disabled once everything is taken. It does
 * not swap to *Deselect all* and it does not disappear: a control that vanishes
 * at the boundary makes the boundary unreadable, and `(M)` is this strip's only
 * statement of how many rows the filter matches.
 *
 * Both carry the **reason** in their `title`, which is the button's accessible
 * description — "All 42 groups matching the filter are already selected", not a
 * restatement of the label. A disabled control with no explanation is worse than
 * an enabled one; it leaves the reader to guess which of two boundaries they are
 * standing on.
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
   *
   * `ghost`, so a panel toggle **stops presenting as a verb**. Showing a panel is
   * not an operation on the rung, and a chromeless control says that where a
   * bordered one claims otherwise. The state stays in the label and nowhere else:
   * a descriptor carries no `aria-pressed` and no `className`, and the open/closed
   * distinction is not one a colour may make alone (ADR-0061 §2).
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
      variant: 'ghost',
      onClick: () => onTogglePanel(panel),
      priority: open ? 'pinned' : restingPriority,
    };
  };

  /** The page-scoped row: verbs whose object is the whole filtered rung. */
  const actions: ActionDescriptor[] = [
    {
      // The rung's `primary`. ADR-0068 §1 wants a verb that *acts* here, and this
      // rung has none — Cross-search and Collections open read-only panels, and
      // every verb that writes is scoped to a selection and lives in the register
      // below. So the softened §2 applies: an export may hold `primary` on a rung
      // with no acting verb, and this is the only control present in every state
      // whose object is the thing the reader is looking at. `primary` implies
      // `pinned`, so it never leaves the row.
      id: 'export-list',
      label: 'Export list',
      icon: 'download',
      variant: 'primary',
      onClick: onExportGroupsList,
      disabled: filteredCount === 0,
      title:
        filteredCount === 0
          ? 'No groups match the current filter, so there is nothing to export'
          : 'Export the current groups list as CSV',
    },
    panelAction(
      'crossSearch',
      crossSearchBadge > 0 ? `Cross-search (${crossSearchBadge})` : 'Cross-search',
      'Hide cross-search',
      'search',
    ),
    /*
      Behind **More** on frequency (ADR-0051 §2's weaker reason, which may move a
      verb down and never up). Both open a read-only panel and would pass the
      consequence test; neither is what an admin came to the rung to do, and the
      row is not theirs to spend.
    */
    panelAction('collections', 'Collections', 'Hide collections', 'clipboard', 'tier'),
    panelAction('cleanup', 'Cleanup', 'Hide cleanup', 'sparkles', 'tier'),
  ];

  /*
    The selection register: everything whose object is the ticked rows.

    Position one is always a selection control, and it is `pinned` so it can never
    be pushed out. This is a safety property, not a layout preference (ADR-0051
    §2): every other control here appears and disappears with the selection size,
    so whatever sits first changes as you tick rows. With `Merge` leading, the
    button under the pointer where `Select all` had been was the one that empties
    groups. First is `Deselect all` the moment anything is ticked and `Select all`
    when nothing is — two controls whose worst outcome is another click.
  */
  const registerActions: ActionDescriptor[] = [
    ...(selectedCount > 0
      ? [
          {
            id: 'deselect-all',
            label: 'Deselect all',
            variant: 'ghost' as const,
            onClick: onDeselectAll,
            priority: 'pinned' as const,
          },
        ]
      : []),
    {
      /*
        Always present, disabled rather than omitted once there is nothing left to
        take. It does **not** swap to `Deselect all` and it does not vanish: a
        control that disappears at the boundary makes the boundary unreadable, and
        `(M)` is this strip's only statement of how many rows the filter matches.

        A disabled control owes the reader the reason, so the `title` — which is
        the button's accessible description — says which of the two boundaries it
        is sitting on rather than restating the label.

        `ghost`, like `Deselect all`: inside the register's recessed well these two
        are furniture for the selection, not verbs acting on it, and the bordered
        `secondary` of `Compare (N)` is what a verb looks like here.
      */
      id: 'select-all',
      label: `Select all (${filteredCount})`,
      variant: 'ghost',
      onClick: onSelectAll,
      disabled: filteredCount === 0 || selectedCount === filteredCount,
      title:
        filteredCount === 0
          ? 'No groups match the current filter'
          : selectedCount === filteredCount
            ? `All ${filteredCount} groups matching the filter are already selected`
            : 'Select every group the current filter matches',
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

    /*
      Behind **More** from the start, for the two different reasons ADR-0039,
      ADR-0051 and ADR-0068 give. They spill into the strip's one tier — the
      register grows no disclosure of its own.

      Consequence, for `Merge` and `Bulk actions`. `Merge` copies members into a
      survivor and then **empties the sources** — a mega-group and a set of husks,
      with no symmetric undo — and `Bulk actions` offers *Clean inactive users* and
      *Remove user from all*, which delete memberships across every selected group.
      Each owns a confirmation of its own (the merge wizard previews the delta and
      what breaks; the bulk panel reports per-group results), but ADR-0039 is about
      where a verb *starts*, and neither of these starts in the row.

      The flat export rule, for `Export (N)`. ADR-0068 §2: an export descriptor is
      `tier` in every strip on every rung, because it does not produce a file in
      place — it forwards to the Export tab. `Export list` above is the one
      exception the softened §2 carves out, and only because it is this rung's
      `primary`.
    */
    ...(selectedCount > 0
      ? [
          {
            id: 'export-selection',
            label: `Export (${selectedCount})`,
            icon: 'download' as const,
            onClick: onExportSelection,
            priority: 'tier' as const,
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
            priority: 'tier' as const,
            title: 'Copies members into one survivor and empties the others',
          },
        ]
      : []),
    ...(selectedCount > 0
      ? [panelAction('bulk', 'Bulk actions', 'Hide bulk actions', 'list', 'tier')]
      : []),
  ];

  return (
    <ActionBar
      ariaLabel="Actions for the groups list"
      actions={actions}
      subRow={search}
      register={{ ariaLabel: 'Selection actions for the groups list', actions: registerActions }}
      testId="groups-list-action-bar"
    />
  );
};

export default GroupsListActionBar;
