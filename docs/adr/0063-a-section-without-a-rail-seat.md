# ADR-0063: A section without a rail seat

- Status: Proposed
- Date: 2026-09-01
- Relates to: [ADR-0057](./0057-a-keyboard-route-into-the-panel.md) (the ⌘K route,
  and the reachability gap this decision leans on),
  [ADR-0062](./0062-every-kind-the-panel-searches-has-a-wire.md) (the palette
  became a spotlight, which is what makes this affordable),
  [ADR-0018](./0018-tabs-stay-mounted.md) (a hidden tab is still mounted, so this
  changes nothing about lifecycle)

## Context

The icon rail carried all nine top-level sections. Nine glyphs plus one unfurled
label needs well past 590px of strip; the panel opens at 480 and can be dragged
to 360, so the rail has scrolled — with edge fades and a hidden scrollbar — for
as long as it has had nine tabs. Every section added has made the primary
navigation slightly worse for every section already in it.

Two of the nine are not like the other seven. **Explorer** is a raw API console
and **History** is an audit log. Both are places you go having already decided to
go there; neither is something you browse into while working on a group. They
have the same visual weight in the rail as Groups.

Until this change there was nowhere else to put them. The ⌘K palette jumped
between tabs and nothing else, so removing a tab from the rail meant removing it
from the panel. ADR-0062 changed that: the palette is now a search surface people
have a reason to open, which makes it a plausible home for a section rather than
a shortcut nobody remembers.

## Decision

**Explorer and History lose their rail seats and are reached through ⌘K.**

`TabDef` gains an optional `railHidden`. `TAB_DEFS` stays the full registry of
nine; `RAIL_TAB_DEFS` is the subset the rail renders. The distinction is the
whole decision:

- Everything that enumerates **sections** — the ⌘K palette, `migrateLegacyTabId`,
  `destinationLabel`, tab persistence — reads `TAB_DEFS`.
- Only the rail reads `RAIL_TAB_DEFS`.

Getting that backwards makes a rail-hidden section _unreachable_ rather than
_keyboard-only_, which is why the two lists are one filter apart in one file
rather than two registries that can drift.

Nothing else about these tabs changes. They are real `TabType`s, still persisted
and restored on reopen (a user who was last on History still lands on History),
still mountable, still valid `EntityLink` destinations.

### The accessibility fix this forced

`Tabs` gave `tabIndex={0}` to the tab matching `activeKey` and `-1` to the rest.
Standing on a section with no seat means no tab matches — so **every** tab in the
rail got `-1` and the entire tablist dropped out of the page's tab order, leaving
a keyboard user on Explorer or History with no way to Tab back into the nav.

The roving anchor now falls back to the first tab when `activeKey` matches
nothing. WAI-ARIA's tabs pattern requires exactly one tab stop in a tablist, and
this keeps that true when nothing is selected. `aria-selected` is deliberately
_not_ forced to match the anchor: the tab is focusable, not selected, and
claiming otherwise would announce a section the reader is not on. On a
rail-hidden section the rail therefore shows no active tab and no indicator,
which is the honest rendering.

## Consequences

**What this costs, stated plainly.** These two sections now have **no visible
affordance anywhere in the panel**. A user who does not already know ⌘K exists
cannot find them at all — and ADR-0057 is still `Proposed`, so the chord only
fires once focus is inside the side panel document; pressed while focus is in the
Okta page, Chrome takes it for the omnibox. This is a real regression in
discoverability for two features that exist, and it is accepted here rather than
hidden:

- The two sections are the panel's most expert-facing, so the population that
  wants them is the population most likely to try a keyboard shortcut.
- The cost is a first-run problem, not a recurring one.

It is not, however, a cost that should stay unpaid. Two follow-ups belong on the
backlog rather than in this ADR's scope: landing ADR-0057's `manifest.json`
`commands` entry so the chord works from the Okta page, and giving the panel one
visible ⌘K affordance — `useCommandPalette` already exports an unused `open()`
for exactly that. **Either of those would discharge most of this consequence, and
neither is done.** A reviewer who thinks the trade is wrong should say so now:
reversing it later is a one-line change to two `TAB_DEFS` entries, which is by
design.

**What it buys.** The rail drops from nine seats to seven, so the strip stops
scrolling at the panel's default width and the seven sections that are actually
browsed get more room each.

**Retired ids are unaffected.** `migrateLegacyTabId` reads `TAB_DEFS`, so an
install persisting an old id still migrates onto a rail-hidden section correctly.
