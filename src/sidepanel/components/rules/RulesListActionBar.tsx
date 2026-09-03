/**
 * @module sidepanel/components/rules/RulesListActionBar
 * @description The rules-list rung's action strip — the ADR-0039 wrapper the Rules tab
 * was missing.
 *
 * The Rules rung was the last major list rung with no `ActionBar`. It stacked four
 * always-on cards between the header and the first rule — provenance chips, a four-tile
 * stats grid, a duplicate-condition banner and a current-group relations section — then a
 * toolbar card, then the list. Nothing docked, so all of it scrolled away together, and
 * the tab's most valuable read-only analysis (which rules share an identical condition)
 * was a *collapsed* banner behind two disclosures that most readers never opened.
 *
 * The three analysis cards are now inline panels this strip toggles, the search field is
 * its `subRow`, and the filter chips live behind that field's `FilterToggle`. What is
 * left above the list is the strip and the list.
 *
 * ## Where `primary` goes (ADR-0068 §2, rule 2)
 *
 * This strip used to open with a **Load rules** / **Refresh** descriptor, and ADR-0061
 * made it *the* reference example of a list rung's `primary`. Both halves of that
 * argument are gone. ADR-0069 §6 makes the tab fetch when it is opened and §4 moves every
 * rung-level refresh into the one chrome control beside the Pin, so the descriptor does
 * not exist here any more; ADR-0068 §2 then excludes a fetch from `primary` absolutely —
 * on any rung, in any state — so it could not come back even if the fetch did.
 *
 * What is left is a rung with **no acting verb**. That claim is not a judgement call: the
 * enumeration above the descriptor array names every verb the rung offers in any state,
 * on the strip or off it, and the question each one fails, because that is what a reviewer
 * has to be able to re-check. It comes out empty, so ADR-0068 §2's rule 2 applies and the
 * rung's one whole-rung export — **Export rules** — holds `primary` and stays in the row.
 * A host that does not wire the export gets rule 3 instead: no `primary` at all, which is
 * a real answer rather than a gap to fill.
 *
 * That `primary` is **constant** in the ADR-0068 §3 sense. It does not move with which
 * panel is open, with whether anything has loaded, or with a selection — this rung has
 * none. Re-coupling emphasis to state would reinstate exactly the colour-only state
 * ADR-0061 removed: an `ActionDescriptor` carries no `aria-pressed`, so a wash tells a
 * screen reader nothing, and tells nobody who cannot pick a hue out of a row of buttons.
 * `RuleCard`'s own docblock records this correction being made once already, to the rule
 * status dot: *the status is stated in text, not hue.* A strip is no different.
 *
 * Position one is constant for a second reason, which is ADR-0051 §2's safety property.
 * The set of verbs here genuinely varies with state — panel toggles appear and disappear
 * with their objects, and an open one is pulled into the row — so whatever sits under the
 * leading pixel must be a control whose worst outcome is cheap. `Export rules` is a
 * navigation to the Export tab's column picker: nothing is written and nothing is spent.
 *
 * ## Why all three panels start in the tier
 *
 * Every verb on this strip is read-only or reversible; nothing here passes the ADR-0039
 * consequence test into the tier. The three panel toggles are there on **frequency**,
 * which ADR-0051 §2 established as a bounded second reason — it may move a verb down,
 * never up, and never brings a confirm `Modal` with it. `Cleanup` is the precedent.
 * Reading rules is the common act; auditing duplicates, checking the current group's
 * relations and reading the stat tiles are the occasional ones, and they should not spend
 * row width at 360px.
 *
 * ## No verb without an object
 *
 * A panel toggle whose panel would be empty is **omitted**, not disabled (ADR-0051 §3):
 * no duplicate clusters, no *Duplicates*; no loaded rules, no *Stats*.
 *
 * *This group* is the case where that test has to be applied carefully, and the obvious
 * reading of it is wrong. Its object is **the detected group**, not the rules related to
 * it: with a group in context the question always has an answer, and the answer *"no
 * loaded rule assigns users to this group"* is the most interesting one the panel gives —
 * gating the verb on a non-zero count would hide the finding precisely when there is a
 * finding. So the verb appears whenever a group is detected, and the count rides the
 * label only when there is one to state, exactly as `Cross-search (5)` does on the Groups
 * rung.
 *
 * `Export rules` is not gated on the loaded list at all — the Group Rules export
 * descriptor fetches its own rows from Okta and does not read this tab's rules, so it is
 * live whether or not anything has been loaded here. That is also what lets it hold a
 * `primary` that never blinks.
 *
 * ## Where the initial load went
 *
 * Into the list panel's own empty state, which is where an initial load belongs and where
 * `RulesListPanel` already had it. A rung whose on-open fetch failed, or which was never
 * eligible to run, still offers **Load Rules** there — so deleting the strip verb costs
 * no recovery path (ADR-0069 §4, §6).
 */
import React from 'react';
import { ActionBar, type ActionDescriptor } from '../shared';

/** Which inline analysis panel (if any) is open below the bar. */
export type RulesPanel = 'none' | 'duplicates' | 'currentGroup' | 'stats';

/** Props for {@link RulesListActionBar}. */
interface RulesListActionBarProps {
  /**
   * The rung's search field and filter toggle, rendered inside the band directly beneath
   * the verbs. It is here rather than above the strip so the two dock as one surface, and
   * so the **More** tier opens below the field rather than between the verbs and the
   * thing they filter.
   */
  search?: React.ReactNode;
  /** Whether any rules are loaded. Gates *Stats*, whose object is the loaded list. */
  hasRules: boolean;
  /** Number of duplicate-condition clusters found. Below 1 the *Duplicates* verb is omitted. */
  duplicateClusterCount: number;
  /**
   * Whether a group is detected on the Okta page. This — not the relation count — is what
   * the *This group* verb acts on: with no group there is no question, and with one there
   * is always an answer, including the informative empty one.
   */
  hasCurrentGroup: boolean;
  /** Distinct rules related to that group. Rides the label when above zero; never gates the verb. */
  currentGroupRelationCount: number;
  /** Which analysis panel is open; its trigger says `Hide …` and is pinned into the row. */
  activePanel: RulesPanel;
  /** Toggles the given panel open/closed. */
  onTogglePanel: (panel: RulesPanel) => void;
  /**
   * Opens the Export tab on the Group Rules descriptor, and is this rung's `primary`
   * under ADR-0068 §2's rule 2. Omitted when not wired (ADR-0039 §3), in which case the
   * rung has no `primary` at all — rule 3.
   */
  onExportRules?: () => void;
}

/**
 * The rules-list action strip.
 *
 * @example
 * ```tsx
 * <RulesListActionBar
 *   search={<RulesSearchRow … />}
 *   hasRules={rules.length > 0}
 *   duplicateClusterCount={mergeableClusters.length}
 *   hasCurrentGroup={Boolean(currentGroupId)}
 *   currentGroupRelationCount={currentGroupRelationCount}
 *   activePanel={activePanel}
 *   onTogglePanel={togglePanel}
 *   onExportRules={onExportRules}
 * />
 * ```
 */
const RulesListActionBar: React.FC<RulesListActionBarProps> = ({
  search,
  hasRules,
  duplicateClusterCount,
  hasCurrentGroup,
  currentGroupRelationCount,
  activePanel,
  onTogglePanel,
  onExportRules,
}) => {
  /**
   * An analysis-panel trigger. It states its own state: closed it names what it will
   * show and how much of it there is, open it names the way back. `pinned` while open so
   * the closer cannot overflow behind **More**.
   */
  const panelAction = (
    panel: Exclude<RulesPanel, 'none'>,
    closedLabel: string,
    openLabel: string,
    icon: ActionDescriptor['icon'],
    title: string,
  ): ActionDescriptor => {
    const open = activePanel === panel;
    return {
      id: panel,
      label: open ? openLabel : closedLabel,
      icon,
      onClick: () => onTogglePanel(panel),
      priority: open ? 'pinned' : 'tier',
      title,
    };
  };

  /*
    ADR-0068 §2's enumeration, which is the whole of the argument for `Export rules`
    holding `primary`. Rule 2 is only available on a rung with **no acting verb**, and
    that is the easy thing to claim, so it is listed rather than asserted: every verb the
    rung offers in any state — every branch of the spreads below, plus every page-scoped
    verb it renders outside this strip — with the §1 question each one fails.

      Q1 — is its object the whole page?    Q2 — does pressing it act?

    | Candidate                                       | Fails                                                          |
    | ----------------------------------------------- | -------------------------------------------------------------- |
    | `Load Rules` (the list panel's empty state)     | Q2 — a fetch, excluded from `primary` absolutely. It is also    |
    |                                                 | no longer on this strip at all (ADR-0069 §4).                   |
    | Search field, `Filters (N)`, the filter chips   | Q1 — their object is the filter, not the rung.                  |
    | `Duplicates (N)`, `This group (N)`, `Stats`     | Q2 — read-only panel toggles. They reveal; they never commit.   |
    | `Merge` (inside the duplicates panel)           | Q1 — object is one duplicate cluster. It acts, forcefully, and  |
    |                                                 | that is the ordinary scoped case rather than a counter-example. |
    | A rule card, `View` (relations panel)           | Q1 — object is one rule, and it navigates rather than acting.   |
    | Activate / Deactivate / Preview impact          | Not this rung's verbs. They belong to `RuleActionBar` on the    |
    |                                                 | pushed rule-detail rung, and are declared there.                |
    | `Export rules`                                  | Nothing — Q1 passes (every group rule in the org) and Q2 is     |
    |                                                 | the export case rule 2 exists for.                              |

    Nothing here acts on the whole rung, and nothing acting on the whole rung is rendered
    off the strip either. If the rung later grows one — a *Create rule*, say — that verb
    takes `primary` in the same change and `Export rules` moves to `priority: 'tier'`
    under rule 1.
  */
  const actions: ActionDescriptor[] = [
    ...(onExportRules
      ? [
          {
            id: 'export-rules',
            label: 'Export rules',
            icon: 'download',
            variant: 'primary',
            onClick: onExportRules,
            title: 'Export every group rule as CSV (opens the Export tab with a column picker)',
          } satisfies ActionDescriptor,
        ]
      : []),

    /*
      Behind **More** from the start, all three, on frequency (ADR-0051 §2). Each is
      omitted outright when its panel would have nothing in it.
    */
    ...(duplicateClusterCount > 0
      ? [
          panelAction(
            'duplicates',
            `Duplicates (${duplicateClusterCount})`,
            'Hide duplicates',
            'link',
            `${duplicateClusterCount} set${duplicateClusterCount === 1 ? '' : 's'} of rules share an identical condition`,
          ),
        ]
      : []),
    ...(hasCurrentGroup
      ? [
          panelAction(
            'currentGroup',
            currentGroupRelationCount > 0
              ? `This group (${currentGroupRelationCount})`
              : 'This group',
            'Hide this group',
            'users',
            'Rules that feed, or refer to, the group open in the Okta tab',
          ),
        ]
      : []),
    ...(hasRules
      ? [
          panelAction(
            'stats',
            'Stats',
            'Hide stats',
            'chart',
            'Totals for the loaded rules: active, inactive, conflicting',
          ),
        ]
      : []),
  ];

  return (
    <ActionBar
      ariaLabel="Actions for the rules list"
      actions={actions}
      subRow={search}
      testId="rules-list-action-bar"
    />
  );
};

export default RulesListActionBar;
