# Page shell

The panel's chrome, its one scroller, and the layout every rung is built on. Read this
when you are touching `App.tsx`, the tab rail, `PageHeader`, `ContextBar`, a sticky
band, or a tab's sub-navigation.

## The shell does not scroll

The shell is a full-height flex column. The chrome sits **outside** the scroller,
and the scroller is the content region beneath it.

```
<div class="flex flex-col h-screen overflow-hidden">   ← the shell, never scrolls
  <ContextBar/>                                        ← fixed chrome
  <TabNavigation/>                                     ← fixed chrome
  <div class="flex-1 min-h-0 overflow-y-auto">         ← the one scroller
    …tab panels…
  </div>
</div>
```

A Chrome side panel gets a **classic** scrollbar, not an overlay one, and it takes
its ~15px out of the content box. With the chrome outside the scroller that channel
runs beside the content only — every band keeps its full width and its full-bleed
background, with no gutter and no seam. Three rules follow:

- **The panel has exactly one root scroller**, the `flex-1 min-h-0 overflow-y-auto`
  div in `App`. No tab shadows it with a scroll box of its own; inner list scrollers
  use `.scrollable-list`, which reserves its own gutter. `min-h-0` is load-bearing —
  a flex item's default `min-height: auto` lets it grow past the shell rather than
  scroll.
- **The scroll root carries `overflow-anchor: none`.** A pinned `PageHeader`
  collapses its identity region and subtitle, losing height _above_ the viewport;
  Chrome's anchoring reads that as unintended reflow and pulls `scrollTop` back far
  enough to un-pin the header, which re-expands it, which re-pins it — the panel grew
  and shrank in a loop for anyone scrolling slowly. Every height change in this
  scroller is intentional, so there is nothing here for anchoring to protect.
- **Fixed chrome is a budget.** `ContextBar` plus the rail is the standing cost at
  every width — ~91px, measured in Chromium at 360 and 480 — and it is the number to
  argue with when either band wants to grow. `ContextBar` is one line because a band
  that never scrolls away spends its height permanently.

## Two bars, two subjects

`ContextBar` and `PageHeader` are not redundant and **must not converge**.

|              | `ContextBar` (top of the shell)                                  | `PageHeader` (inside the scroller)     |
| ------------ | ---------------------------------------------------------------- | -------------------------------------- |
| Subject      | the live Okta tab this panel is bound to                         | whatever you are browsing in the panel |
| Source       | `useOktaTabContext` / `useOktaPageContext`, or the pinned entity | the tab's `useViewStack` current entry |
| Changes when | the Okta tab navigates, or you pin/unpin                         | you drill in, pop, or switch tabs      |

The header **never** falls back to the context entity: a list rung says "Groups", not
the name of whatever group the browser happens to be on. The context bar **never**
follows in-panel navigation. The two showing the same name is a coincidence — you
drilled into the group you were already looking at — not duplication to remove.

The division is enforced by removing overlap, not by asking two adjacent bands to be
read carefully. A fact _about the entity_ — its id, its counts, its timestamps — is a
`PageHeader` identity fact; `ContextBar` holds a subject and the verbs that act on the
live tab.

## The top chrome is one slab

`ContextBar` and the rail carry **no border of their own**. They are bands of one
white slab, separated by spacing and type weight, and a single rule closes the slab
against the content. That rule lives on `TabNavigation`'s `<nav>` — the last band —
so the edge sits where the slab meets what scrolls beneath it. On a rung with a
`PageHeader` the rule therefore lands between the rail and the header: nav chrome
separated from entity description, which is the line worth drawing.

The tab rail is the **`rail` variant of the shared `Tabs` primitive**, fed
`RAIL_TAB_DEFS`. Never a second nav strip, never a drawer. Inactive tabs are
icon-only and the active tab's label unfurls beside its glyph, so every destination
stays one click away at 360px; a drawer costs two clicks per hop in a tool whose whole
value is fast lateral movement.

The indicator and the label are **sequenced, not simultaneous**:

- **Phase 1** — both labels carry a `--dur-move` delay, so layout is frozen and the
  indicator transitions `left`/`width` on `--ease-glide` toward a target that cannot
  move.
- **Phase 2** — the transition class is dropped, the labels cross over, and the
  indicator is measured per frame by `useTabRail`'s `ResizeObserver`.

An indicator transitioned across both phases chases a growing label and desyncs from
it; measured across both, it teleports. `useTabRail`'s `sliding` flag is the line
between them, and it drops the label delay under reduced motion — the blanket freeze
zeroes `transition-duration` but not `transition-delay`, which would otherwise remove
the motion and add latency. The ⌘K affordance sits at the trailing end of the `<nav>`
and **outside** the tablist: it is not an eighth section, and a `role="tab"` sibling
that opens a dialog would lie to a reader.

## A section is not a rail seat

`src/sidepanel/tabs.ts` holds both lists, one filter apart:

- **`TAB_DEFS`** is every section the panel has.
- **`RAIL_TAB_DEFS`** is the subset the rail draws — `TAB_DEFS` minus the entries
  carrying `railHidden`.

**Everything that enumerates sections reads `TAB_DEFS`**: the ⌘K palette,
`migrateLegacyTabId`, destination labels, tab persistence. **Only the rail reads
`RAIL_TAB_DEFS`.** Getting that backwards makes a rail-hidden section _unreachable_
rather than _keyboard-only_.

Explorer and History are the two that carry `railHidden` — both are places you go
having decided to go there, not places you browse into. They remain real `TabType`s:
persisted, restored, mountable, and valid `EntityLink` destinations.

Standing on a rail-hidden section means no tab matches `activeKey`, so the rail shows
no selection and no indicator — the honest rendering. `Tabs`' roving anchor falls
back to the first tab there, because a tablist must keep exactly one tab stop or a
keyboard user cannot Tab back into the nav. `aria-selected` is deliberately not
forced to match the anchor: the tab is focusable, not selected.

## Sub-navigation is a view stack, not a router

The panel has no router. A tab shell instantiates **one `useViewStack`** and gets
`push`/`pop`/`popTo`/`reset`, `currentEntry`, `depth`, `isRoot` and a breadcrumb
`trail`.

- **One `PageHeader` stays mounted per tab** and swaps its contents as views are
  pushed and popped. A pushed view never renders its own header; it feeds the
  existing one through `onBack`, `breadcrumbs` and `identity`.
- **The pushed view is a sibling of the list, never a replacement for it.** The stack
  preserves _navigation_ state only — anything the list holds in component-local
  `useState` (a progressive-reveal window, per-row expansion) dies if the list
  unmounts, so the list is hidden and kept mounted. Focus restoration needs the
  trigger still in the document, which is the same reason.
- **Scroll is the exception either way.** Hiding is `display: none`, which destroys the
  scroll box, so `useScrollPreservation` banks `scrollTop` before the push and restores
  it after the pop.
- **No focus trap.** A pushed view replaces the list in the page flow rather than
  overlaying it, so nothing behind it is inert and the surrounding chrome must stay
  reachable. Focus moves into the view on push and back to the trigger on pop, using
  `Modal`'s `FOCUSABLE` selector.
- **`transition` is a CSS hint and gates nothing.** `animate-push-in` /
  `animate-pop-in` decorate the arriving surface; the focus effect runs on the commit
  that mounts it, before a frame has played.
- **The container ref is passed into the hook**, not returned by it — React Compiler's
  `react-hooks/refs` rule treats an object carrying a ref as a ref and would reject
  every `nav.<field>` read during render.

## A band out of flow publishes its measured height

**Nothing hard-codes an offset around a band.** A band measures itself and publishes
its height as a custom property; whatever has to keep clear of it consumes that. One
owner per variable, every value measured.

| Band            | Position                                | Publishes                      | Consumes       |
| --------------- | --------------------------------------- | ------------------------------ | -------------- |
| `TabNavigation` | static, outside the scroller            | —                              | —              |
| `PageHeader`    | `sticky top-0 z-20`                     | `--header-h` on its `TabPanel` | —              |
| `ActionBar`     | `sticky top-[var(--header-h,0px)] z-30` | —                              | `--header-h`   |
| `ActivityBar`   | `fixed bottom-0 z-50`                   | `--activity-h` on the root     | —              |
| scroll root     | `flex-1 overflow-y-auto`                | —                              | `--activity-h` |

Two variables, and they publish to different places for a reason. `--header-h` is
per-`TabPanel` (see below); `--activity-h` goes on the document root because there is
exactly one activity bar in the panel, and a root-scoped value cannot be clobbered by
a hidden tab.

The rail is outside the scroller, so it has nothing to stick to and nothing below it
needs to park clear of it — the scroller's own top edge already begins beneath it.

**The bottom reserve is the same rule as the sticky offsets.** The `ActivityBar` is
`fixed`, so it is out of flow and paints over the end of whatever is scrolling behind
it. The scroll root reserves `pb-[var(--activity-h,36px)]`. It used to reserve a flat
`pb-14`, which was wrong by 4px against the bar it was guarding and would have gone
wrong again on any change to the bar's padding or its bucket rack. The fallback is the
condensed bar's own height, which is both what the bar boots into and what the
variable resolves to wherever there is no `ResizeObserver` (jsdom).

**`--header-h` is scoped to the `TabPanel`, not the document root.** Every tab stays
mounted, so all nine headers exist at once and a root-scoped variable would be
overwritten by whichever _hidden_ tab measured last. `TabPanel` carries
`data-header-scope`; `PageHeader` publishes to `closest('[data-header-scope]')`. For
the same reason, `sticky` takes the tab's `isActive`, never a bare `true`: a hidden
panel is `display: none`, so its sentinel never intersects and it would report a
permanently pinned header and publish a stale height.

"Is it pinned?" is answered by a zero-height sentinel in normal flow above the
header, watched by an `IntersectionObserver` (`useStuck`) whose `rootMargin` comes
from the header's own resolved `top` — no scroll listener, nothing per frame, and no
reference to the shared scroller.

**Nothing between a band and the band it parks under may establish a stacking
context.** `ActionBar`'s `z-30` beats `PageHeader`'s `z-20` only while the two
resolve against the same context. A wrapper whose entrance animation touches
`opacity`/`transform` and fills _forwards_ stays one after it finishes, computing
`transform: matrix(1, 0, 0, 1, 0, 0)` rather than `none`. That is why the two
view-stack primitives fill `backwards`, and why a 1px divider above a docked strip is
the symptom to look for.

None of this is verifiable in jsdom — there is no scroller and no layout. It is a
manual check in the loaded extension, plus `ActionBar`'s `StickyInAScroller` story,
which carries a real scroller and a real sticky header.

## A detail rung

A rung that describes one entity is: **the tab's `PageHeader`, then a sticky
`ActionBar`, then the body.** The body is a `DetailSection` stack when the rung
answers one question, and tabbed panes of one card when it answers several — see
[components.md](./components.md) for that threshold, and for which verbs the strip
carries and where each is allowed to live. This doc says only that the strip is the
second thing on the rung.

**The header describes the entity; the body must not repeat it.** A detail rung
passes `identity` and `identityKey` to `PageHeader`, built by a pure per-entity
descriptor function living beside its entity (`groupIdentity`, `userIdentity`,
`ruleIdentity`). There is never a second identity card at the top of the body — it
opens on its first real section. `PageHeader` owns chrome only and never learns what a
group or a user is, so adding an entity kind is one new builder plus a unit test.
