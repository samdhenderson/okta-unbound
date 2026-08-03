# ADR-0018: Keep every tab mounted; gate background work on `isActive`

- Status: Accepted
- Date: 2026-08-03
- Relates to: ADR-0016 (the same problem one level down), ADR-0008, `docs/architecture.md`

## Context

`App.tsx` rendered each tab as `{activeTab === 'groups' && <GroupsTab … />}`, so
**switching tabs unmounted the whole tab**. Everything component-local died with it:
the Groups tab's pushed detail view (ADR-0016), its filters, its selection, the
list's progressive-reveal window, the scroll offset, and per-row expansion. The list
only _appeared_ to survive because `useGroupsLoader` rehydrates it from
`chrome.storage.local` on mount.

This was reported as a bug against a path the app itself invites: drill into a
group, click one of its feeding rules, land on the Rules tab (`GroupDetailView` →
`onNavigateToRule` → `scopeRulesToGroupId`), come back to Groups — and find a bare
list. The user followed a link the app rendered and lost their place.

It is the same class of problem ADR-0016 solved _within_ a tab, one level up, and it
applies to every tab, not just Groups.

Alternatives considered:

- **Persist the view stack to `chrome.storage.local`.** Fixes one tab, adds a
  serialization contract for pushed entries, and still loses scroll offset, the
  loaded window and per-row expansion, because those were never in the stack.
- **Lift each tab's state into `App`.** Every tab's internals leak upward into the
  shell, and it still cannot reach state owned by a row.
- **Keep tabs mounted and hide the inactive ones.** One change, every tab. The
  `.tab-content` / `.tab-content.active` rules in `tailwind.css` already encode
  exactly this (`display: none` / `block`), so it was once the model.

## Decision

**A tab mounts on its first activation and is hidden — never unmounted —
thereafter.** `App.tsx` renders through one helper, `renderTabPanel(tab, content)`:
it returns `null` until the tab has been activated once (tracked in `mountedTabs`
state, so first activation triggers the render that mounts it), then a permanently
mounted subtree whose visibility is toggled by the `.tab-content` classes, with the
`hidden` attribute set alongside them so the panel leaves the accessibility tree and
the tab order even where that stylesheet is not loaded.

`React.lazy` is unaffected — it gates only the initial chunk fetch, so a never-visited
tab still costs nothing. **Each panel owns its own `Suspense` boundary**: a shared
one would swap the fallback in for every mounted tab while a newly activated lazy
chunk loads, which is precisely the unmount-and-lose-state problem this ADR removes.

### The obligation this creates — read this before adding a tab

Eight mounted tabs mean **eight sets of live effects**. The correctness of this
decision rests entirely on hidden tabs being inert.

> **Every tab receives `isActive` and MUST gate on it anything that issues an Okta
> request, polls, re-probes page context, or attaches a listener to a shared global
> (`window`, `document`). A tab that does not is a background API caller: it spends
> the shared scheduler's rate-limit budget invisibly, on behalf of a screen nobody is
> looking at.**

A new tab, or a new mount effect in an existing tab, is not done until it has an
answer for "what does this do while hidden?". `App.tsx:108`'s
`useOktaPageContext(activeTab === 'overview' && !isPinned)` is the original instance
of the pattern. As audited at the time of this decision:

| Tab      | What is gated while hidden                                                       |
| -------- | -------------------------------------------------------------------------------- |
| Overview | Live page-context re-probe (gated in `App`, predates this ADR)                   |
| Rules    | The `window` scroll persister; `markTabVisited` fires per arrival, not per mount |
| Users    | Live user-page detection, the user-search debounce, Add-to-Group type-ahead      |
| Groups   | The live-search debounce; the detail view's two read-only loads                  |
| Apps     | The one-per-connected-tab inventory auto-load                                    |
| Policies | The one-per-connected-tab policy auto-load                                       |
| Export   | The live match-count probe                                                       |
| History  | Nothing to gate — `AuditLogViewer` reads IndexedDB, issues no Okta traffic       |

### Two patterns for gating, and when to use which

1. **Deferred re-arm** — add `enabled` to the effect's guard _and_ its dependency
   array. The effect's own dependencies already describe when it should run, so the
   work is **deferred, not dropped**: it runs the next time the tab is shown.
   `useAppsData` and `AuthPoliciesTab` use this for their auto-loads.
2. **Owed-load latch** — for an effect that must **not** re-run every time the tab
   is re-shown. Raise an `owedRef` in one effect keyed on the real inputs (the
   entity id, the API target), and pay it in a second effect gated on `enabled`.
   `useGroupRuleReferences` is the reference implementation. Without the latch,
   "gate on `isActive`" silently turns every tab revisit into a refetch — trading
   one bug for a quieter one.

### Scroll is DOM state, not React state

`display: none` destroys the scroll box, so a hidden tab's `scrollTop` reads `0` and
returns at the top. `useScrollPreservation` mirrors `scrollTop` on a passive
listener while the container is visible, which covers hides the tab did not
initiate — a top-level tab switch has no `capture()` call site inside the tab.

## Consequences

- The reported round trip works: drilling into a group, navigating to a rule, and
  returning restores the detail view for that group with the list's filters,
  selection, loaded window and scroll intact behind it — and the same now holds for
  every other tab's local state, not just Groups.
- Up to eight tab subtrees are live at once. That is a deliberate memory-for-state
  trade in a single side panel, bounded by the number of tabs and by lazy mounting
  (a tab never visited costs nothing).
- Shared-global listeners are now genuinely shared. The Rules tab's `window` scroll
  persister would otherwise have recorded _another_ tab's scrolling as its own
  restore point; it is gated. Treat any new `window`/`document` listener the same
  way.
- Effects that used to mean "on entering the tab" now mean "on mounting it, once".
  `TabStateManager.markTabVisited('rules')` moved from mount to every `isActive`
  arrival for exactly this reason. Check any effect whose intent was "on arrival".
- **Not persisted.** The view stack and tab state live in memory; reopening the side
  panel starts fresh. That was judged acceptable and is a separate decision if
  wanted.
- Tests: `src/sidepanel/App.tabpersistence.test.tsx` pins mount-once, hide-not-unmount,
  the Groups → Rules → Groups round trip, and that a hidden Applications tab does not
  re-load its inventory when the connected Okta tab changes.
- **Review rule:** a PR that adds a tab, or adds a mount effect to an existing tab,
  should state in its description how that code behaves while the tab is hidden.
