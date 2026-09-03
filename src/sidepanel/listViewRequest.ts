/**
 * @module sidepanel/listViewRequest
 * @description The cross-tab "open that list, already filtered" contract.
 *
 * The Home tab's org card states a figure and a few sub-counts under it — *31
 * empty*, *4 paused*. A figure that names a problem and then leaves you to
 * reproduce its filter by hand is a worse version of a link, so each sub-count
 * is a control that switches tab and applies the matching filter on arrival.
 *
 * The mechanism mirrors `ExportRequest`: {@link App} holds one nullable request
 * in state, routes it to the owning tab as a prop, and the tab clears it through
 * an `onConsumed` callback once applied. A request is a one-shot instruction,
 * not a mode — nothing here persists, and re-pressing the same sub-count sends a
 * fresh request rather than toggling anything off.
 *
 * Each view names an axis that already exists in that tab's own filter module.
 * This module deliberately holds no filter logic of its own: the destination
 * decides what its filter means, so the Home card cannot drift away from what
 * the list actually does.
 */

/**
 * A pre-filtered view of the Groups list.
 *
 * - `empty` — `sizeFilter: 'empty'`, groups with no members.
 * - `no-rules` — `ruleFilter: 'unruled'`, groups no rule assigns anyone to.
 * - `empty-no-rules` — both at once: nothing in the group, and nothing on its
 *   way in. This is the one the Home card's second finding opens, and it exists
 *   as its own view rather than reusing either single axis because a finding
 *   whose number disagrees with the list it opens is worse than no link at all.
 *   The two single-axis views stay: they are what the Groups tab's own filter
 *   pills produce.
 */
export type GroupsListView = 'empty' | 'no-rules' | 'empty-no-rules';

/**
 * A pre-filtered view of the Applications list.
 *
 * - `inactive` — `statusFilter: 'INACTIVE'`, apps Okta does not report as active.
 * - `pushes-nothing` — `groupsFilter: 'no-groups'`, Group Push apps with no
 *   stored group assignment. Narrower than "no groups assigned" on purpose; see
 *   `apps/appFilters.AppGroupsFilter`.
 */
export type AppsListView = 'inactive' | 'pushes-nothing';

/**
 * A pre-filtered view of the Rules list.
 *
 * - `paused` — `activeFilter: 'paused'`, rules whose status is `INACTIVE`.
 */
export type RulesListView = 'paused';

/**
 * Which view type belongs to which tab.
 *
 * Written as a map rather than three union members so {@link viewFor} can index
 * it — a `tab: 'groups'` request narrowing to `GroupsListView` is then a fact
 * the compiler knows, not one each call site restates.
 */
interface ListViewByTab {
  groups: GroupsListView;
  apps: AppsListView;
  rules: RulesListView;
}

/** Which tabs accept a pre-filtered view. */
export type ListViewTab = keyof ListViewByTab;

/** A request to open one tab's list with one filter already applied. */
export type ListViewRequest = {
  [K in ListViewTab]: { tab: K; view: ListViewByTab[K] };
}[ListViewTab];

/**
 * Narrow a request to one tab's view, or `null` when it targets another tab.
 *
 * Lets `App` hand every list tab the same expression without each tab learning
 * the union — a tab receives its own view type or nothing.
 *
 * @param request - The pending request, if any.
 * @param tab - The tab asking.
 * @returns The view for that tab, or `null`.
 *
 * @example
 * ```ts
 * <GroupsTab listView={viewFor(listViewRequest, 'groups')} … />
 * ```
 */
export function viewFor<T extends ListViewTab>(
  request: ListViewRequest | null | undefined,
  tab: T,
): ListViewByTab[T] | null {
  if (!request || request.tab !== tab) return null;
  // Sound by construction: the union pairs each `tab` with exactly that tab's
  // view type, and the guard above has just fixed `tab`. TypeScript cannot
  // narrow a union through a generic type parameter, so it is asserted here —
  // once — rather than at each of the three call sites.
  return request.view as ListViewByTab[T];
}
