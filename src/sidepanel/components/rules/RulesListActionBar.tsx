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
 * ## The blue button, and where `primary` goes (ADR-0059)
 *
 * ADR-0051 spends `primary` on *which inline panel is open*, on the reasoning that a list
 * rung has no page-level verb — its verbs are gated by a selection, and which one matters
 * is a property of what the admin is doing rather than of the page.
 *
 * This rung is the counter-example. Rules do not load on mount; **Load rules** is the one
 * thing that has to happen before the rung means anything, and once loaded **Refresh** is
 * the same control. That is a page-level verb in the ADR-0030 sense, so it takes `primary`
 * here, and the open panel is named the way ADR-0051 §4 already names counts — in its own
 * label, which swaps to `Hide …`.
 *
 * That is not merely a substitution. A `primary` wash is colour-only state: an
 * `ActionDescriptor` carries no `aria-pressed`, so a screen reader was told nothing, and
 * neither was anyone who cannot pick the hue out of a row of buttons. `RuleCard`'s own
 * docblock already records this exact correction being made once, to the rule status dot:
 * *the status is stated in text, not hue.* A strip is no different.
 *
 * Both of ADR-0051's safety properties survive. At most one `primary` per strip holds by
 * construction — it is the load verb, which is always present and always `pinned`. And an
 * open panel's trigger still takes `priority: 'pinned'`, so the control that **closes** a
 * panel can never overflow behind **More** while the panel it toggles sits open below.
 *
 * ## Why all three panels start in the tier
 *
 * Every verb on this strip is read-only or reversible; nothing here passes the ADR-0039
 * consequence test into the tier. The three panel toggles are there on **frequency**,
 * which ADR-0051 §2 established as a bounded second reason — it may move a verb down,
 * never up, and never brings a confirm `Modal` with it. `Cleanup` is the precedent.
 * Reading rules is the common act; auditing duplicates, checking the current group's
 * relations and reading the stat tiles are the occasional ones, and they should not spend
 * row width that **Refresh** and **Export rules** want at 360px.
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
 * `Export rules` is not a transient disabled state at all — the Group Rules export
 * descriptor fetches its own rows from Okta and does not read this tab's loaded list, so
 * it is live whether or not anything has been loaded here.
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
  /** Whether any rules are loaded — decides `Load rules` vs `Refresh`, and gates *Stats*. */
  hasRules: boolean;
  /** Whether a load is in flight. */
  isLoading: boolean;
  /** Loads (or reloads) the rules. */
  onLoad: () => void;
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
  /** Opens the Export tab on the Group Rules descriptor. Omitted when not wired. */
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
 *   isLoading={data.isLoading}
 *   onLoad={() => loadRules(rules.length > 0)}
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
  isLoading,
  onLoad,
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

  const actions: ActionDescriptor[] = [
    {
      // The rung's page-level verb, and the reason this strip has a `primary` at all
      // (ADR-0059). `primary` implies `pinned`, so it never leaves the row.
      id: 'load',
      label: hasRules ? 'Refresh' : 'Load rules',
      icon: 'refresh',
      variant: 'primary',
      onClick: onLoad,
      disabled: isLoading,
      loading: isLoading,
      title: hasRules
        ? 'Re-fetch every group rule from Okta, bypassing the cache'
        : 'Fetch every group rule in the org',
    },
    ...(onExportRules
      ? [
          {
            id: 'export-rules',
            label: 'Export rules',
            icon: 'download',
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
