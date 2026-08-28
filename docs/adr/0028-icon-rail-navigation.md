# ADR-0028: Icon-rail navigation

- Status: Accepted
- Amended by: [ADR-0049](./0049-one-slab-and-a-sequenced-indicator.md). The
  "measured, not transitioned" rationale below still holds _while the label is
  moving_ — the indicator is now transitioned only during a first phase in which the
  labels are deliberately frozen, so it never chases a moving target. The rail also
  loses its `border-b` there, as part of merging the top chrome into one slab.
- Date: 2026-08-04
- Relates to: `docs/components.md` (`Tabs`, "documented raw-control exceptions"),
  `docs/motion.md`, ADR-0008 (stable layout, values swap in place)

## Context

The side panel's top-level navigation is eight tabs — Overview, Users, Groups,
Apps, Rules, Policies, Export, History — rendered as text labels in a single-row
strip. Eight labels need roughly 590px of width. The panel opens at 480px, and
Chrome side panels are user-resizable down to as narrow as 360px — a width this
app explicitly supports and tests against (`sidepanelCompact` in
`.storybook/preview.tsx`). At neither width did the strip fit, and there was no
wrap, no overflow menu, and no scroll affordance: labels simply ran off screen
with no way back to them short of widening the panel.

## Decision

**A third variant, `rail`, on the existing shared `Tabs` primitive** — alongside
`underline` (section navigation) and `segmented` (compact toggles). Inactive tabs
render icon-only; the active tab's label unfurls beside its glyph via
`grid-template-columns: 0fr → 1fr` at `--dur-move`, so the strip never toggles
`display` to make room (motion rule 4, `docs/motion.md`). What still overflows
scrolls horizontally, with the scrollbar hidden and `mask-image` edge fades keyed
off a `data-overflow` attribute computed by a new hook,
`src/sidepanel/hooks/useTabRail.ts`, which also owns scroll-active-into-view and
the sliding active-tab indicator's geometry. `TabNavigation` is now a thin wrapper
around `Tabs variant="rail"` fed from the tab registry, `src/sidepanel/tabs.ts`.

### Why a third `Tabs` variant, not a new component or an extended `underline`

A new standalone component would duplicate the ARIA tablist pattern
(`role="tablist"`/`"tab"`, `aria-selected`, roving `tabindex`, arrow-key
navigation) that `Tabs` already implements and that three other places in the app
depend on being correct. Extending `underline` in place instead of adding a
variant was also rejected: `underline` has a live consumer (section navigation
within tabs, e.g. the user comparison sections) that must stay pixel-identical,
and folding icon-rail behavior into it risked regressing that consumer for a
change it has no stake in. A sibling variant keeps both call sites independent
while sharing the tablist semantics, roving tabindex, and keyboard handling
verbatim — only the container classes, tab classes, and button children differ
per variant.

### Why not a mobile drawer

A collapsible drawer/hamburger pattern was the user's own first instinct, and it
was built and evaluated before this decision was made. It solves the overflow
problem completely — a closed drawer needs no width at all — but it costs **two
clicks per navigation hop** (open the drawer, then pick a destination) in a tool
whose entire value proposition is fast lateral movement between Users, Groups,
Rules, and Policies while cross-referencing them. Phone navigation hides
destinations behind a drawer because thumbs need ~44px touch targets and screen
space is scarce in every direction; a side panel is narrow in only one dimension,
and its user has a mouse, not a thumb. The rail keeps every destination one click
away at every supported width, which the drawer could not do without contradicting
the reason it was reached for.

### Why `aria-label` is derived from `tab.label` inside `Tabs`, not passed as a separate prop

An icon-only tab has no visible text, so it needs an explicit accessible name or
it fails axe's `button-name` rule — enforced at `test: 'error'` in the Storybook
browser suite (ADR-0014). The label was deliberately **not** added as a second,
independently-suppliable prop (e.g. `ariaLabel`): with two props, nothing stops
`label` (what a caller sees when a tab happens to render as text, and what the
`TabItem` type calls it) and a hand-typed `ariaLabel` from drifting apart the
first time someone edits one and not the other. Deriving `aria-label` from
`tab.label` inside `Tabs` itself makes that drift structurally impossible, and it
is exactly what keeps `getByRole('tab', { name })` queries working against
icon-only rail tabs in tests without a separate accessible-name prop to keep in
sync. One consequence documented on `TabItem.label`'s JSDoc: because `aria-label`
overrides an element's rendered content for accessible-name computation, a rail
tab's optional `count` badge is **not** currently part of its accessible name. If
counts are ever added to the rail, the derived label must become
`` `${label}, ${count}` `` or the badge will be invisible to screen-reader users.

### Why the sliding indicator is measured, not transitioned

The active tab's underline indicator is positioned via `left`/`width` measured by
`useTabRail`'s `ResizeObserver`, written with no CSS transition on the indicator
itself (`transition: none`, implicitly — no transition class is applied). Giving
the indicator its own CSS transition was tried and rejected: the active label is
_simultaneously_ growing from `0fr` to `1fr` over the same `--dur-move` window, so
a transitioned indicator chasing a moving target desyncs from it — the indicator
either overshoots or lags depending on frame timing, rather than tracking the
label's actual edge. Measuring the indicator every time the buttons' own layout
changes (via the observer, not a separate animation) makes the slide fall out of
the real layout for free instead of approximating it.

The observer callback is **rAF-throttled** rather than writing state directly:
an observer that synchronously writes a layout-affecting value from inside its
own callback triggers `ResizeObserver loop completed with undelivered
notifications` — a genuine browser warning, not a test artifact, but one the
Storybook browser runner (`@storybook/addon-vitest`) surfaces as an unhandled
error and fails the story on. jsdom does not implement `ResizeObserver` at all,
so this failure mode is **structurally uncatchable in the `unit` Vitest project**
— it only ever appears in the browser suite, which is why the throttle needed to
be verified there rather than trusted from a jsdom test.

### The `'Auth Policies'` → `'Policies'` rename

`src/sidepanel/tabs.ts`'s nav label for that tab changed from `'Auth Policies'` to
`'Policies'`. The rail unfurls exactly one label at a time, and the longer form
does not reliably fit inside a 360px panel alongside the glyph and the tab's own
padding. This is a **navigation-label-only** change: the Export flow's entity
descriptor still reports `displayName: 'Auth Policies'` for the same entity type,
a separate concept (what the export UI calls the entity) left deliberately
untouched — the two labels serving two different UIs are allowed to diverge.

## Consequences

- All eight tabs fit at every supported panel width (360–720px, the
  `sidepanelCompact`/`Default`/`Wide` Storybook presets) with no wrap, no
  overflow menu, and no reduction in one-click reachability.
- `Tabs`' `rail` variant, `useTabRail`, and the `tabs.ts` registry are the new
  seams: a ninth top-level tab is one entry in `TAB_DEFS` (id, label, icon) away,
  provided its icon already exists in the `Icon` registry.
- `docs/components.md`'s `Tabs` entry documents the variant and the
  `aria-label`-derivation contract; this ADR is the _why_, not a restatement of
  the _what_.
- **Deferred / future work:** the rail solves navigating directly to a known
  destination tab, but not jumping to an arbitrary _sub_-destination (a specific
  group, a specific rule) without first arriving at its tab. A command-palette-style
  jump affordance is the natural next step for that gap and is tracked as
  separate, follow-on work — not part of this decision.
