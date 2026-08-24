# ADR-0039: Wrap the strip, and ship no verb without a wire

- Status: Accepted
- Date: 2026-08-24
- Amends: [ADR-0030](./0030-detail-page-layout-contract.md) §2, which says where an
  action lives but never who is allowed to call the primitive that renders it; and
  [ADR-0038](./0038-a-strip-that-knows-what-it-holds.md), whose descriptor API this
  ADR governs the _use_ of, not the mechanics of
- Relates to: [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md)
  §2a (absent is not zero — the identity-facts precedent this borrows for actions)

## Context

Two detail rungs call `shared/ActionBar` today, and they do it two different ways.

`users/UserActionBar` wraps it. The wrapper computes an `ActionDescriptor[]`, owns
the tier's open state and the lifecycle hook's confirm-modal state, and hands both
to the shared strip. Its two everyday verbs — _Add group_ (`primary`, `pinned`) and
_Compare_ (`flex`) — sit in the row, because the worst either can do is add a
membership you can remove again. `UserLifecycleActions` — Reset password,
Suspend/Unsuspend — sits in `expansion`, one press behind **More**, and each of
those renders its own confirm `Modal` with the consequence spelled out inline:
"Blocks sign-in until reversed," "Restores sign-in immediately." Nothing in
`ActionBar` requires any of this. The wrapper is where it was decided, and the only
reason it holds together is that `UserActionBar`'s author made the row/tier split by
hand, correctly, without a rule telling them to.

`groups/detail/GroupDetailView` calls `<ActionBar>` inline, no wrapper, with one
action:

```tsx
const actions: ActionDescriptor[] = [
  {
    id: 'export-members',
    label: 'Export members',
    icon: 'download',
    variant: 'primary',
    onClick: () => onExportGroup?.(group.id, group.name),
    disabled: !onExportGroup,
    title: "Export this group's members (opens the Export tab with column picker + presets)",
  },
];
```

`onExportGroup` is an optional prop, threaded from `App.tsx` through `GroupsTab`
down to this component, and the descriptor's `disabled` is a direct negation of
whether that prop happened to arrive. Both intermediate docblocks describe this as
a known gap: `GroupsTab.tsx`'s own `onExportGroup` prop doc says _"App.tsx already
owns a `handleExportGroup` of this shape for the Overview tab but does not yet wire
it through to the Groups tab, so this stays a no-op action rather than a hard
requirement until that wiring lands."_ `GroupDetailView.tsx`'s says the same thing
about `App.tsx` one level further out. Both were written, per `git blame`, in
commit `114e676e` — the same commit that also added the two lines that _do_ wire
it, `onExportGroup={handleExportGroup}` on both the Overview and the Groups
`renderTabPanel` calls in `App.tsx`. The claim was already false in the commit that
made it. The button has worked since the day it existed, and nothing about staring
at a plain grey "Export members" with a permission-shaped tooltip would have told a
future reader whether that was true — the answer is three files and one `git
blame` away, and two docblocks got it wrong regardless.

That is the actual defect, and it is not this one button's on/off state. A
descriptor whose liveness rides an optional prop threaded through intermediate
components, with `disabled` standing in for both "not wired yet" and "no
permission," gives a reader nothing to distinguish the two from the render site.
Had the wiring genuinely lagged — which is what both comments describe, and which
is exactly the state a page ships in the moment a verb is added before its handler
— the strip would have shown a dead control with a tooltip that reads like a
permission message, forever, with no signal that anything was owed.

Nothing forced `GroupDetailView` to reach for a wrapper it didn't build. One
action didn't feel like it earned a component, and `ActionBar` doesn't require
one — it takes `actions` from whoever calls it, inline JSX or wrapper alike. The
call site that got the row/tier split right did it by discipline, not because the
API asked for it; the call site that got the dead-action shape wrong had no rule
telling it not to. Both gaps are closed the same way: by naming the rule
`UserActionBar` already follows and applying it everywhere `ActionBar` is called.

## Decision

**A detail page never renders `<ActionBar>` directly. It renders its own
`<Entity>ActionBar` wrapper, which computes the descriptors and owns whatever local
state a tier needs — and the wrapper decides where each verb starts by asking one
question: can this be undone with a second press?**

### 1. The wrapper is not optional, even for one action

Every detail page that shows `ActionBar` shows it through an `<Entity>ActionBar`
component (`UserActionBar`, `GroupActionBar`, and so on) — never inline in the
page's own render. This holds at one action exactly as it holds at five.
`UserActionBar` is the reference shape: it takes the entity plus one callback per
verb, builds the `ActionDescriptor[]`, and owns the tier's open/confirm state so
the page component itself never touches `ActionBar` or `ActionDescriptor` at all.

A one-action page is not a reason to skip this. It is the page most likely to grow
a second verb, and the wrapper is where that verb goes — inline call sites don't
get "upgraded" to a wrapper when the second action arrives; someone has to notice
the pattern was skipped, find the inline `<ActionBar>`, and migrate it, which is
exactly the kind of step that gets skipped under a deadline. Building the wrapper
first costs one small component file per entity and removes the discovery step
entirely.

### 2. Where a verb starts is a consequence test, not a per-page call

> A reversible or read-only action defaults to the row (`priority: 'flex'`, or
> `'pinned'` if it is the page's one primary verb). An action that changes the
> entity's state with **no symmetric undo** — suspend, delete, deactivate, anything
> a second click cannot cleanly reverse — defaults to the tier (`expansion`),
> requires a confirm step through the shared `Modal`, and states its consequence in
> plain language next to the control.

"Blocks sign-in until reversed" and "Restores sign-in immediately," exactly as
`UserLifecycleActions` already writes them, are the bar: the sentence names what
changes, not what the button is called. A label is a verb; a reader deciding
whether to press an irreversible one needs the noun it acts on and the state it
leaves behind, and inferring that from "Suspend" alone is the thing this rule
exists to stop asking of them.

This is a test, not a preference ranking. It does not matter whether an action
_feels_ important enough for the row — Suspend is arguably the single most
consequential thing on the user page and it still starts in the tier, because
consequence is exactly what puts it there. A page with no irreversible verb has no
tier-only actions and no wrapper decision to make here at all; `priority: 'tier'`
exists for the day one shows up.

### 3. An action is never declared with no path to firing

> If the handler is not wired up yet, the `ActionDescriptor` does not exist yet. It
> is omitted, not rendered `disabled` forever with no explanation.

This is ADR-0032 §2a's rule — a fact a builder cannot answer is omitted, never
shown as a misleading zero — applied to verbs instead of facts. A `disabled`
action still has to render _something_ the reader can reason about: a
**permission-gated** action may legitimately render `disabled` with a `title`
naming the real, resolvable reason ("Requires the Super Administrator role"), the
same way `UserActionBar`'s row verbs disable with a reason while memberships load.
What is banned is a control with no path to ever becoming live and no explanation
offered for why — `GroupDetailView`'s `disabled: !onExportGroup` with a tooltip
that reads like a permission message is exactly that shape, whether or not the
prop happens to be supplied on a given render. The fix is not a better tooltip. It
is declaring the descriptor only once the wrapper actually has a live callback to
give it, the same discipline `UserActionBar`'s own docblock already applies to
Export and Clear sessions — both real product asks, both left off the strip
entirely, on the grounds that "a dead control is worse than an absent one."

### Scope: this governs the detail rung today, and is the starting point elsewhere

This decision governs the one place a verb strip exists in this app right now:
the detail rung's page-level `ActionBar`, under ADR-0030's layout contract. It does
not yet govern a bulk-selection toolbar, because none is built — ADR-0038's own
Consequences section names `GroupSelectionBar` as a future consumer of the
descriptor model, and when that surface (or any other future verb-strip-shaped UI)
gets built, it starts from these same two rules — wrap in a purpose-built
component, and decide row-vs-tier by the consequence test — rather than
reinventing them. It refines only where that surface's shape genuinely differs. A
selection bar's "primary" action does not obviously mean the same thing when _N_
items are selected instead of one page being browsed, and whether "no symmetric
undo" reads the same over a batch — where the reversible cases might now include a
per-item failure a partial batch can't cleanly roll back — is a real open question
this ADR does not answer. That refinement is for whichever ADR ships
`GroupSelectionBar`, not this one.

## Consequences

- **`GroupDetailView` is the one current violator of rule 1**, and this ADR does
  not schedule its fix. Sam is building Group Detail v2 as separate, immediate
  work — `CLAUDE.md` already puts `groups/detail/` off-limits beyond a specific
  claimed backlog item until that lands — and the inline `<ActionBar>` call is
  superseded by that rewrite rather than patched ahead of it. `GroupActionBar`
  does not exist yet; when it does, it is built to this ADR from the start.
- **`UserActionBar` needs no change.** It already wraps, already splits by
  consequence, and already states each lifecycle action's effect inline. It is
  cited throughout this ADR as the reference shape precisely because it already
  conforms.
- **`docs/components.md`'s `ActionBar` section and `CLAUDE.md`'s hard-rules list
  both now state the wrap-always and consequence-test rules**, pointing here for
  the why. `docs/components.md` keeps ADR-0038's descriptor mechanics where they
  already were; this ADR adds the policy of _when_ to reach for a wrapper and
  _where_ a verb starts, not a second description of `priority`, `expansion`, or
  the overflow ladder.
- **No new component or test is required by this ADR alone.** It is a rule about
  call sites, checked the way ADR-0024's plan gate already treats mechanical,
  single-file conformance: a future PR that adds or touches a detail page's action
  strip is reviewed against these three rules, the same way it is already reviewed
  against ADR-0030 §2 for _where_ a verb belongs.
- **A permission-gated `disabled` action still needs a real `title`.** This ADR
  does not relax that — `UserActionBar`'s membership-loading disable already
  supplies one, and `GroupActionBar` (when it exists) will need one for any
  permission-gated verb it grows, not just for the ones that ship on day one.
