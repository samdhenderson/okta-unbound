# ADR-0016: In-tab sub-navigation via a per-tab view stack

- Status: Accepted
- Date: 2026-08-03
- Relates to: ADR-0008 (stable regions whose contents swap in place),
  `docs/state-management.md`, `docs/components.md`

## Context

The side panel has **no router**. A tab is a component, and until now the only way
to show something "inside" a tab was to open a `Modal` over it. That worked while
drill-ins were single questions (`GroupSourceModal` answered "where do these
members come from?"), and stopped working as soon as a drill-in became a real view:
the Group Detail view carries five sections, two independent read-only loads, and
deep links out to the Rules tab. A dialog is the wrong container for that — it traps
focus, hides the list it was opened from, and has no room for a section that itself
links elsewhere.

The alternatives available in the repo were all worse:

- **Swap the tab body.** Render the detail instead of the list. Everything the list
  had accumulated — filters, selection, the progressive-reveal window, scroll
  offset, per-row expansion — dies with the unmount, so "back" returns the user to a
  reset list rather than where they were.
- **A router.** `react-router` (or any router) is a runtime dependency plus a URL
  model that a side panel has no address bar for, no history buttons for, and no
  deep-link surface for. It would be all of the cost of routing and none of its
  payoff.
- **A third React context.** `docs/state-management.md` reserves context for state
  needed by "distant, unrelated parts of the tree". Sub-navigation inside one tab is
  the opposite: one owner, one subtree, and each tab needs its **own** independent
  stack, which a single provider would have to key by tab anyway.
- **Ad-hoc `useState` per tab.** Whichever tab drills in first invents a
  breadcrumb, a back affordance and a focus policy, and the second one invents them
  differently.

Nothing in `docs/adr/` covered navigation at all, and the user's requirement was
explicitly that whatever landed be reusable by the other tabs, not built into
Groups.

## Decision

**A custom hook, `src/sidepanel/hooks/useViewStack.ts`**, instantiated **once per
tab shell**: a small typed stack (`push` / `pop` / `popTo` / `reset`) exposing
`currentEntry`, `depth`, `isRoot`, and a breadcrumb `trail`. It is the default home
for a cluster of related state + effects per `docs/state-management.md`, it needs no
provider plumbing, and each tab's stack is naturally independent.

Supporting pieces, all **additive** so every existing call site keeps working:

- **`Breadcrumbs`** (`components/shared/`) — `nav > ol`, ancestor crumbs are real
  buttons, the current crumb is plain text with `aria-current="page"`. It shapes
  directly to `trail`.
- **`PageHeader` leading slots** — `onBack`, `leading`, and `breadcrumbs`. A tab
  keeps **one** `PageHeader` mounted and swaps its contents as views are pushed and
  popped, rather than each view rendering its own header. This follows ADR-0008's
  precedent for the activity bar: a stable region whose values change in place
  instead of a region that mounts and unmounts.
- **`chevron-left` / `chevron-right`** added to the `Icon` registry (chevrons were
  previously inlined ad hoc).

**Focus: move and restore, but deliberately no trap.** `useViewStack` mirrors
`Modal`'s approach — record `document.activeElement` at `push`, move focus into the
pushed view once it mounts (its first focusable child, else the container, which the
consumer gives `tabIndex={-1}`), and restore focus to the trigger on `pop`. It
shares `Modal`'s `FOCUSABLE` selector so both behave identically.

It does **not** trap focus, and that is the substantive difference from `Modal`. A
pushed view _replaces the list in the page flow_; it does not overlay it. Nothing is
inert behind it, so the surrounding chrome — the tab bar, the activity bar — must
stay reachable by keyboard. Trapping focus in a non-modal view would strand a
keyboard user in a region they can see past and are entitled to leave.

**The consumer's obligation: render the detail as a sibling, not a replacement.**
The hook preserves _navigation_ state only. Any state the list holds in
component-local `useState` dies if the list unmounts. So a consumer either keeps the
list mounted and hidden while a view is pushed (preferred — every `useState`
survives, however deep, and so does the element focus is restored to), or lifts the
state into a hook owned by the tab shell (per piece, and it cannot reach state owned
by a row). `GroupsTab` takes the first route. Scroll is the exception either way:
`display: none` destroys the scroll box, so `useScrollPreservation` captures
`scrollTop` before the push and restores it after the pop.

The container ref is passed **into** the hook as an option rather than returned by
it, because React Compiler's `react-hooks/refs` rule treats an object carrying a ref
as a ref and would reject every `nav.<field>` read during render.

## Consequences

- The first consumer is `GroupsTab` → `GroupDetailView`; `GroupSourceModal` is
  retired, its content now living in the detail view's membership-source section.
- Any tab can adopt sub-navigation without inventing breadcrumbs, a back button or a
  focus policy — but must honour the sibling-rendering contract above, which is
  documented on the hook and in `docs/state-management.md`.
- **The stack is in-memory and not persisted.** Reopening the side panel starts at
  the root. The existing deep-link contract (`selectedGroupId` / `onGroupSelected`)
  is unchanged: it targets a _row_, so it calls `nav.reset()` first — a pushed view
  would otherwise hide the list the deep link needs to scroll to.
- Focus restoration depends on the trigger still being in the document — one more
  reason to keep the list mounted. If it has gone, focus is left where it is rather
  than moved somewhere arbitrary.
- New tests cover the hook (push/pop/popTo/reset, trail shape, focus move and
  restore), `Breadcrumbs`, the `PageHeader` slots, and — in
  `GroupsTab.navigation.test.tsx` — the round trip.
- **Deferred:** no persistence of the stack, and no browser-history/back-gesture
  integration (a side panel has neither). Revisit only with a concrete need.
