# Design + UX program — session kickoff

You are picking up a thirteen-item design/UX/bugfix program in
`/Users/samhenderson/Documents/Projects/okta-unbound` (Chrome MV3 side-panel
extension for Okta group/user admin; React 19, TS strict, Tailwind v4, Vitest +
Storybook). Read `CLAUDE.md` first — it is a router with non-negotiable hard rules
— then only the `docs/` rows your current task matches.

**Your first job is to produce an implementation plan, not code.** The plan must be
structured around a fleet of subagents, each sized to its task, with the model
(`sonnet` or `opus`) named per workstream and justified. Group work into
workstreams touching disjoint files so agents run in parallel; state explicitly
where two workstreams collide on a file and must serialize. One concern per commit;
history is squash-merged.

Everything below has already been verified against the code. **Trust it — do not
re-derive it.** Where a line number has drifted, the surrounding fact still holds.

---

## The thirteen items

1. ActionBar renders with transparent sides until a resize fires — `DEBT.md` D-044.
2. Group detail Overview pops in tile by tile — needs one pane-level skeleton.
3. Home redesign: numbers move right beside the chevron, leading icons on every
   row, handoff affordance, consent before the cold-org walk, prune the finding
   set. **Blocked on design ①.**
4. ActionBar band + search subRow visual rework. **Blocked on design ②.**
5. Members tab is overloaded with controls. **Blocked on design ③.**
6. Insights "Other (N values)" row is inert; plus a visual pass on the pane. Wiring
   is unblocked; the visual pass is **blocked on design ④**.
7. Scheduler bar redesign — persistent buckets, bars visible while expanded, badges
   folded onto the bars, cooldown stripes, honest ETA, drop "Active" — plus
   per-bucket parallelism. UI **blocked on design ⑤**; the scheduler change is not.
8. Groups list strip: `Select all` should not be primary-coloured, lowercase "all";
   "Hide cross-search" should not be a verb; collections belongs in More; More gets
   shoved around. Mostly settled by decisions 1 / 5 / 6 / 7 below.
9. User compare hero, its bespoke tab bar, and the orphan `⇄`. **Blocked on
   design ⑥.**
10. Group detail primary should be Add, not Export members. Settled by 1 / 5.
11. Exports live in More. Settled by 5.
12. Users tab "open in admin" box (`DetectedUserBanner`) becomes the shared handoff
    affordance. **Blocked on design ⑦.**
13. Double × in the members filter field — fix in shared `Input`.

---

## Decisions already made — treat these as settled requirements

1. **ActionBar `primary` = a verb that acts** (opens a modal, performs the
   operation). Chosen per rung, but NEVER a refresh and NEVER an export. This
   amends ADR-0061 §1 and supersedes ADR-0051 §1's panel-state reading. Needs a
   new ADR.
2. **Refresh is not a strip verb and not a `PageHeader` action.** One control at the
   top of the app beside the Pin, refreshing whatever the panel is currently
   showing (list rung → that list; detail rung → that entity's cache keys plus a
   re-run of its loads), with a tooltip naming its subject. Every existing
   rung-level refresh moves there.
3. **The connection dot in the top bar becomes the reconnect control** — today it is
   decorative, with a separate "Refresh context" button beside it.
4. **The Rules tab fetches on open** instead of waiting for `Load rules`; the `load`
   descriptor leaves `RulesListActionBar` entirely. It is cheap to populate.
5. **Exports always take `priority: 'tier'`.** `GroupActionBar`'s `export-members`
   demotes behind More and keeps forwarding to the Export tab. Copy members,
   filters, and the copy-selection modal already cover most of the need.
6. **Selection-scoped verbs leave the verb row** into a band of smaller buttons
   under the search subRow, led always by `Select all (N)` then `Deselect all`
   (leftmost — this preserves ADR-0051 §2's safety property), then Compare /
   Export / Merge.
7. **The selection count leaves the strip and the PageHeader badge** and joins the
   list's existing line: `Showing 128 of 214 · 3 selected` (`GroupsListPanel`).
8. **One skeleton per pane.** A pane renders a single skeleton for its whole layout
   until its queries settle, then swaps once. Design the exception for gated/idle
   queries (Overview's `MembershipSourceTile` idle state) so a manually-gated tile
   cannot hold the pane in skeleton forever.
9. **The scheduler gets per-bucket concurrency caps** plus a higher global ceiling,
   replacing the single `maxConcurrent: 5`. This touches the rate-limit surface →
   Proposed ADR and its own PR.
10. **Scope is everything** — all thirteen items, with the seven redesign items
    scoped and sequenced now but blocked on design returns before any UI code lands.

---

## Verified findings

### ActionBar system

Primitive `src/sidepanel/components/shared/ActionBar.tsx` (474 lines) +
`actionBarFit.ts` (pure `fitActions`) + `useActionOverflow.ts` (ResizeObserver,
off-layout measurement probe, width cache keyed on `label|icon|variant|loading`).
`ActionDescriptor` = `{id,label,icon?,variant?,onClick,disabled?,loading?,title?,priority?,testId?}`
— no JSX, no className, no `aria-pressed`/`aria-expanded`. `ActionPriority =
'pinned'|'flex'|'tier'`. `ActionBarProps` carries `subRow?: ReactNode` (unmeasured,
may hold JSX) and `expansion?: ReactNode` (the More tier). The band is
`sticky top-[var(--header-h)] z-30` with a `.dock-sentinel` sibling and
scroll-driven merge chrome in `src/sidepanel/tailwind.css` L716-980. **Never pass
`ActionBar` a `style` prop** — the hook publishes `--bar-bleed` on the band and
`--dock-offset` on its parent imperatively.

Five wrappers: `users/UserActionBar.tsx`, `groups/detail/GroupActionBar.tsx`,
`rules/RuleActionBar.tsx`, `rules/RulesListActionBar.tsx`,
`groups/GroupsListActionBar.tsx`.

- `GroupActionBar` L184-232: `export-members` (primary), `add-member` "Add" (flex),
  `compare` (flex), `remove-deprovisioned` (danger, tier).
- `GroupsListActionBar` L202-308: deselect-all (pinned), select-all `Select all (N)`
  (pinned), compare (flex, 2-5 selected), export-selection (flex), crossSearch
  (flex; label swaps to "Hide cross-search" when open, pinned while open),
  collections (same pattern), export-list "Export list" (**primary**), merge (tier),
  bulk (tier), cleanup (tier). Wired from `GroupsTab.tsx` L538-551 via
  `onTogglePanel` driving `ActivePanel = 'none'|'bulk'|'crossSearch'|'collections'|'cleanup'`;
  inline panels render below the strip.
- `RulesListActionBar` L161-224: `load` "Load rules"/"Refresh" (**primary**),
  export-rules (flex), three panel toggles (tier at rest, pinned when open).
- Tests: there is no `ActionBar.test.tsx`; coverage is `actionBarFit.test.ts` (309
  lines) + `useActionOverflow.test.ts` (519) + consumer suites (`GroupsTab.test.tsx`,
  `UsersTab.detailRung.test.tsx`, `GroupDetailView.test.tsx`). Stories exist for the
  primitive and every wrapper.
- Governing ADRs: 0038 (descriptor API), 0039 (wrapper mandate; no verb without a
  wire; consequence test), 0051 (list-rung strip; §2's leading position is a SAFETY
  property — Merge once landed under the pixel `Select all` had occupied; §3 no verb
  without an object), 0061 (primary = page-level verb; an open panel states itself
  in its LABEL because the descriptor carries no `aria-pressed`), 0030 §2, 0032
  (sticky stack).
- **`docs/components.md:336` is stale** — it claims `GroupsListActionBar` has no
  `primary`; the code has `export-list`. Fix this.

### D-044 (`DEBT.md` L351)

`useActionOverflow.publish()` sets `--bar-bleed` from
`band.getBoundingClientRect().left`, which reports the TRANSFORMED box. The Groups
rung mounts inside a wrapper running `animate-push-in` (`translateX(16%)` on the
first frame) and the first measure fires from the ResizeObserver during that
entrance, so the published bleed is gutter + ~16% of width until any resize
re-publishes. The Users rung is immune (no entrance animation). D-044's done-when
requires a transform-free source (`offsetLeft` against the offset parent, or the
column's padding) plus a story/unit test pinning the value under a transformed
ancestor.

### Double clear button

`members/MemberSearchBar.tsx` renders `<Input type="search">` AND its own trailing
ghost clear `IconButton`. Nothing in `src/` suppresses
`::-webkit-search-cancel-button` (grep for `search-cancel` returns nothing), so
Chrome draws its native × plus ours. Other `type="search"` + custom-clear sites:
`AuthPoliciesTab.tsx:173`, `home/EntityChooser.tsx:175`, `TabJumpPalette.tsx:376`,
`home/JumpBar.tsx`. The fix belongs in shared `Input` / `tailwind.css`, not in
`MemberSearchBar`.

### Group Overview pop-in

`groups/detail/GroupOverviewPane.tsx`: four tiles each `return null` until their own
query resolves — `MembershipSourceTile` (L157), `AccessGrantsTile` (L196),
`RuleRelationshipsTile` (L222), `AppPushTile`. Two sub-facts appear later inside
already-rendered tiles (admin-role detail L203; referencing-rule detail L229-235).
Four independent hooks owned in `GroupDetailView.tsx:206-232` (`useGroupSource`,
`useGroupAccessGrants`, `useGroupRuleReferences`). The grid at
`GroupOverviewPane.tsx:289` reflows as children arrive. Shared `shared/Skeleton.tsx`
exists (`variant: 'text'|'row'|'card'`, `size`, `count`, `width`, `label`) and
`variant="card"` is already label-line / big-number / detail-line shaped; 14 other
surfaces use it and Overview is the holdout. **`MembershipSourceTile` has an `idle`
state** — member analysis is gated behind `AUTO_LOAD_MEMBER_CAP = 5 × page` — so an
idle/gated tile must not block a pane-level skeleton forever.

### Insights "Other"

`members/memberAnalytics.ts` `mapToRows()` L188-217 folds the tail into
`{value: OTHER_VALUE '__other__', label: 'Other (N values)', count, pct}` and
**discards `tail`**. `BreakdownRow` has no `values` field.
`GroupInsightsPane.tsx:139` calls `discoverAttributeBreakdowns(members)` with
default `maxRows = 6`. `AttributeHealthCard.tsx:94-121` renders the Other row inert.
Recovery is cheap: `members: OktaUser[]` is already a prop in scope
(`GroupInsightsPane.tsx:74`) and `computeDimensionBreakdown(members, key)` defaults
to unlimited `maxRows` (L225-234). **The mirror pattern already exists on the
Members tab**: `members/AttributeFacet.tsx` (header count is the drill-in, the Other
segment falls through to `onExpand`, `+N more` is a text button) +
`members/BreakdownDetailsModal.tsx` + wiring in `MemberExplorer.tsx:319-322,436-443`.
`BreakdownReport.tsx:46-91` already makes `isOther` rows clickable only when
`onShowOther` is supplied.

### Members tab tree

`GroupMembersSection.tsx` → `MemberExplorer.tsx`: status ladder + Load members;
`MemberSourceFilterBar` (stacked bar + source pills); `MemberSourceNotes` →
`RuleAttributionList` ("Attributed to", unbounded); search + `FilterToggle`;
`MemberFilterPanel` (behind `showFilters`, default false); `CompositionReports`
(`CollapsibleSection`, closed by default); Members header + Copy members;
`MemberList`. Filter state is plain `useState` in `MemberExplorer.tsx:159-166` (one
flat `MemberFilter[]`) — **no hook**; mutators at L231-302, pure helpers in
`members/memberAnalytics.ts`.

### User compare

`users/UserComparisonPanel.tsx` → `users/UserComparisonView.tsx` (~445 lines).
`comparison/ComparisonHero.tsx:73-75` renders a bare `⇄` (U+21C4) in a
`<span aria-hidden>` — the only occurrence in `src/`, and there is no swap/exchange
member in the `IconType` union (`shared/Icon.tsx:16-53`, 37 names).
`comparison/ComparisonTabBar.tsx` is a hand-rolled `role="tablist"` whose
container/active/inactive classes are near-verbatim copies of `shared/Tabs.tsx`'s
`segmented` variant (Tabs.tsx:92, 229-232), forked for per-tab icons and
`grid-cols-2` wrapping below `sm:` — and it implements **no keyboard navigation**,
while shared `Tabs` has roving tabindex plus Arrow/Home/End at Tabs.tsx:166-200.
That is a real a11y regression against the primitive.

### Refresh

No entity detail rung has one. Refresh exists only at list level:
`GroupsTab.tsx:476-483` (`loadAllGroups(true)`), `AppsTab.tsx:209/223`,
`AuthPoliciesTab.tsx:128/151`, `RulesTab.tsx:529-535`, plus `ContextBar.tsx:166`
"Refresh context" → `App.tsx:319 handleRefreshAll`, which re-probes page context
only, not the entity cache. Cache: `cache/entityCache.ts` — `invalidate(key)` (L243,
a prefix drops nested keys), `registerDerived(derivedPrefix, sourcePrefix)` (L269;
`groupMembers/X` cascades to `memberSource/X`), `getOrFetch(key, fetcher, {force})`
(L348, documented as "used by manual refresh"). Key factories in `cache/keys.ts`.
Precedent: `GroupDetailView.tsx:247-250` `onCleanupDone`. `useGroupAccessGrants` and
`useGroupRuleReferences` expose **no re-run function** and would need one.

### Top bar / handoff

`content/pageContext.ts` (447 lines) extracts group/user/app/policy ids and names
from URL and DOM. `hooks/useOktaPageContext.ts:97-116` probes all four kinds in
parallel on every navigation and returns `{pageType, groupInfo, userInfo, appInfo,
policyInfo, connectionStatus, targetTabId, oktaOrigin, error, isLoading, refetch,
resyncPending}`. Per ADR-0058 there is exactly one instance, mounted at
`App.tsx:216`, always on. `components/ContextBar.tsx` (221 lines) renders a
hue-coded dot (`DOT_COLOR` by `PageType`), the entity NAME only (no id,
deliberately), a Refresh `IconButton`, and a Pin `Button`. Pin logic:
`App.tsx:243-267` + `sidepanel/pinContext.ts` (`liveIdentityOf`,
`hasLiveContextMoved`); `isLivePinnable` covers group|user only while
`navigationHandlers` covers all five kinds. **The "ugly open in admin box" is
`users/DetectedUserBanner.tsx`** — a `bg-primary-light border-primary-highlight`
band with an `Eyebrow` "Open in admin", `{userName} · {STATUS}`, a primary Load and
a dismiss `IconButton`; manual-load only by design. Navigation:
`contexts/NavigationContext.tsx` `useEntityNavigation()` → `navigateTo({type,id})` /
`canNavigateTo(type)`; handlers at `App.tsx:367-396`, registered `App.tsx:410-424`.
`home/jumpDestinations.ts:113` `navigationTarget(kind)` is the sanctioned
kind→EntityType mapper, and `KIND_ICON` + `destinationLabel` there give the glyph
and label. `PageType` includes `'admin'`/`'unknown'`, which have no EntityType and
need a guard.

### Home

`components/HomeTab.tsx` (227) + `components/home/` (13 files) + 8 hooks. Four
regions: `JumpBar` (user-triggered only, 600ms debounce, min 3 chars), `WorkingSet`
(chrome.storage only, zero requests), `OrgSnapshotCard` (5 findings from
`useOrgFigures`, all snapshot joins), `ReportsCard` (3 reports from `useHomeReports`

- `MfaCoverageLauncher`). **Home's own code issues zero Okta requests.** The single
  auto-sync is `useOrgFigures.ts:308-323`, gated four ways (`sawReading` ref,
  `enabled && connected`, a once-per-mount `toppedUp` ref, and `readAt` within
  `ORG_FIGURES_MAX_AGE_MS` = 1h) → one `syncSnapshot` message. On a COLD org that one
  sync is a full walk of `/groups?expand=stats&expand=app` + `/groups/rules` + `/apps`
- a per-app `/apps/{id}/groups` fan-out (`shared/snapshot/syncMeta.ts:150-172`,
  `snapshotSync.ts:856,578`) — hence the consent item. Numbers render LEFT and huge
  via shared `home/FigureNumber.tsx` (`text-3xl`, `tabular-nums`, `self-stretch`,
  `min-w-[2.6ch]`). Org card rows are flush `<li>` in a `divide-y` `<ul>` with a
  `StretchedButton` overlay and a trailing `chevron-right`, NO leading icon. Report
  rows: `home/ReportRow.tsx:76-98`, a real `<button>` with a rotating `chevron-down`.
  `MfaCoverageLauncher` substitutes a leading `Icon type="shield" size="lg"` for the
  number — the only leading icon on either card. `WorkingSetRow` / `JumpResultRow` DO
  use shared `ListRow` and DO have leading icons. There is no RTL test for
  `HomeTab.tsx` itself; the 11 home components are story-covered only.

### Scheduler

`src/shared/scheduler/apiScheduler.ts` (1313 lines), constructed in
`src/background/index.ts:60-67` with `{maxConcurrent: 5, minRemainingThreshold: 10,
cooldownDuration: 30000, retryDelay: 2000, maxRetries: 3, requestTimeout: 30000}`.
Buckets: `rateLimitDetector.ts` `bucketOf(endpoint)` = the first `/api/v1/{resource}`
segment. One shared priority FIFO drained by `drainQueue()` (L497-545), which
dispatches the first request whose OWN gate says go — **so cross-bucket progress
already happens**; the real limit is the single global
`while (activeRequests.size < maxConcurrent)` at L504. There is NO per-bucket
concurrency cap. Gates: `cooldowns: Map<bucket|'*', number>`, `gateKeyFor()`
L436-440, `gateFor()` L454-481 returning `'go'|'gated'|'cooldown'`, `enterCooldown()`
L905-933. `getState()` L1027-1042 returns `SchedulerState` including
`buckets: BucketState[]` (`types.ts:99-135`: `bucket, limit|null, remaining|null,
resetAt|null, queued, active, planned, gatedUntil|null`), rebuilt from scratch on
every call by `buildBucketStates()` L1056-1096 as the union of four LIVE sources
(header observations, the queue, in-flight requests, active plans' legs). **That is
why a bucket vanishes when its work finishes** — nothing removes it; it simply stops
being reconstructed once the queue and in-flight drain, the plan is reaped
(`plan.ts:291-305`, `PLAN_STALE_MS` 5min), and
`RateLimitDetector.cleanExpiredLimits()` (L375-392) drops the observation at
`now >= reset` (~60s). State is pushed to the panel via `notifyStateChange` →
`background/throttledRelay.ts` (150ms, leading + trailing, urgent on status change)
→ `{action:'schedulerStateChanged', state, metrics}` → `contexts/SchedulerContext.tsx`
(push-only, no polling). UI: `components/ActivityBar.tsx` (66) →
`ActivityBarView.tsx` (387; `role="status" aria-live="polite"`, fixed bottom, four
always-mounted `MetricSlot`s Queue/Active/Rate/ETA, condensed and full trees SWAPPED
rather than cross-faded, ADR-0008) + `activity/BucketList.tsx` (strained buckets
only, max 4) + `activity/BucketRow.tsx` + `activity/ResetTimeline.tsx` (only while a
gate is armed) + `hooks/useActivityBar.ts` (267; a shared 250ms clock armed only
while ticking; ETA at L213-216 = `round(elapsed/done*total) - elapsed`, shown only
when `operationActive && remaining > 0 && done > 2`). `BucketList` / `ResetTimeline`
/ `OperationList` render ONLY in the expanded tree
(`ActivityBarView.tsx:360-375`).

---

## Design status

Seven redesign prompts are out with Claude Design, covering: ① Home, ② the ActionBar
band, ③ Group detail → Members, ④ Group detail → Insights, ⑤ the scheduler/activity
bar, ⑥ user comparison, ⑦ the top bar (context, connection, refresh, handoff).
**No UI code for items 3, 4, 5, 6-visual, 7-UI, 9 or 12 lands until the matching
return is in hand and approved.**

The first ② return failed and its prompt was rewritten; the revised version lives at
`.claude/plans/the-primary-actionbar-action-humble-dream.md`. The failure modes worth
knowing, because ① and ⑤ share the same prompt weakness: a design prompt that opens
with an inventory of the current build gets a re-render of the current build back;
rules parked at the bottom lose to descriptions at the top; and asking for "two or
three ways" invites prose on the canvas instead of drawings.

---

## What the plan must contain

- Workstreams, each with: files touched, agent model and why, blocked-or-not, and
  verification commands.
- An explicit **file-collision matrix**. `GroupsTab.tsx` (731 lines, D-117),
  `App.tsx` (732 lines, D-118), `GroupDetailView.tsx` (514 lines, D-091) and
  `ActionBar.tsx` are each contended by several items — say what must serialize.
- Which ADRs must be written or amended, and which PRs are `docs/`-only.
- Per workstream: which existing tests to check against, and which new tests are
  needed. CLAUDE.md's hard rule stands — never weaken a test; a removal needs an
  ADR-0022 carve-out plus a PR note saying what stays covered.
- The `docs/components.md:336` staleness fix.
- A sequencing recommendation: what lands before the design returns, what waits.
- Where CLAUDE.md's plan-and-approval gate applies. At minimum the ActionBar primary
  rule change, the scheduler concurrency change, and the refresh relocation each
  commit to an approach and need sign-off before code.

Start by reading `CLAUDE.md`, then produce the plan.
