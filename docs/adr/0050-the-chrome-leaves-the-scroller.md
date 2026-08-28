# ADR-0050: The chrome leaves the scroller

- Status: Accepted
- Date: 2026-08-28
- Amends: ADR-0032 §3 (the sticky stack — it loses a band and a variable)
- Relates to: ADR-0038 (the docking strip and its view timeline), ADR-0039
  (wrap the strip), ADR-0049 (one slab)

## Context

The side panel had exactly one scroller and it was the whole panel:

```
<div class="h-screen overflow-y-auto">   ← the scroller
  <ContextBar/>                          ← scrolls away
  <TabNavigation/>                       ← sticky top-0
  …tab panels…
</div>
```

Everything a Chrome side panel gets is a **classic** scrollbar, not an overlay one, and
it takes its width out of the content box — about 15px. Because the scroller was the
panel, that channel ran the full height of the panel, down the right edge of the context
bar and the tab rail as well as the content. Two costs, and the second is the one that
actually hurt:

1. Every band paid 15px it had no use for. At the 360px width the panel is realistically
   dragged to, that is 4% of the panel, permanently, on bands that never scroll.
2. **The rail is the surface with the width problem.** Nine tabs already overflow it at
   360px (ADR-0049 measured 475px of strip in 358px of box), so the rail is where 15px is
   worth the most, and it was the band least able to spare it.

`.scrollable-list` in `tailwind.css` has long documented the shape of this: it reserves a
`scrollbar-gutter` for inner list scrollers _and explicitly declines to do so on the panel
root_, because a gutter there "would inset the full-bleed sticky bands, stopping their
background and bottom border short of the panel edge… a permanent ~15px stripe of canvas
beside a white header band reads as a seam." That note correctly named the symptom and
then treated it as unavoidable. It was not.

## Decision

**The top chrome moves out of the scroller.** The shell becomes a non-scrolling flex
column; the scroller is the content region below the chrome.

```
<div class="flex flex-col h-screen overflow-hidden">   ← the shell, never scrolls
  <ContextBar/>                                        ← fixed chrome
  <TabNavigation/>                                     ← fixed chrome
  <div class="flex-1 min-h-0 overflow-y-auto">         ← the one scroller
    …tab panels…
  </div>
</div>
```

Three consequences follow, and each simplifies something.

### 1. The rail stops being a sticky band, and `--rail-h` goes with it

ADR-0032's stack was three bands deep because all three were in one scroller and each had
to park clear of the ones above it. Two of them are no longer in that scroller, so the
stack is two bands, and the offset the rail existed to publish is now structural — the
scroller's own top edge already begins beneath the rail.

| Band            | Position                                | Publishes                      | Consumes     |
| --------------- | --------------------------------------- | ------------------------------ | ------------ |
| `TabNavigation` | static, outside the scroller            | —                              | —            |
| `PageHeader`    | `sticky top-0 z-20`                     | `--header-h` on its `TabPanel` | —            |
| `ActionBar`     | `sticky top-[var(--header-h,0px)] z-30` | —                              | `--header-h` |

Every consumer read the rail's height through a `var(--rail-h, 0px)` fallback, so the
arithmetic collapses rather than breaks: `calc(var(--rail-h,0px) + var(--header-h,0px))`
becomes `var(--header-h,0px)`, and the dock sentinel's `view-timeline-inset` follows the
same reduction. The variable and its `usePublishedHeight` call are deleted rather than
left publishing a number nobody reads.

`useStuck` needs no change at all, and the reason is worth writing down because it looks
like it should. The hook reads the sticky element's own resolved `top` and turns it into
an `IntersectionObserver` `rootMargin` against the **viewport**, so a `top` measured
inside a scroller that starts ~100px down the viewport ought to be off by ~100px. It is
not, because an intersection is computed against the root rect intersected with the clip
rect of **every** ancestor between target and root. The scroller clips. With `top: 0` the
sentinel stops intersecting at exactly the line the header parks on, and the clip does the
work the `rootMargin` used to.

### 2. `ContextBar` is now permanently on screen, so it is one line

A band that scrolls away can afford to be three lines tall. A band that never does cannot.
`ContextBar` was ~74px — a wordmark eyebrow, the entity name with a _Pinned_ chip, and a
copyable id. It is now a single 48px row: a hue-coded connection dot, the entity name,
Refresh, and the Pin toggle.

Each line was cut for its own reason rather than to hit a number, and all three reasons
are that the line was **already said somewhere better**:

- **The wordmark.** Chrome prints the extension's name and icon in the side panel's own
  title bar, directly above this row.
- **The copyable id.** `PageHeader`'s identity rows already carry an `{ kind: 'id' }` fact
  with its own copy control — which is where ADR-0032 §1 says a fact about the entity
  belongs. This bar's subject is the live tab, not a record to transcribe. Its `entityId`
  prop is deleted.
- **The _Pinned_ chip.** The Pin button beside it reads "Pinned" and fills when it is on.

That is ADR-0032's own division of labour — `ContextBar` describes the _live Okta tab_,
`PageHeader` what you are _browsing_ — enforced by removing the overlap rather than by
asking two adjacent bands to be read carefully.

The Pin control also stops being a hand-rolled `<button>` and becomes the shared `Button`,
which CLAUDE.md required all along.

### 3. Fixed chrome is a budget, and it is now 91px

`ContextBar` (48px) + the rail (43px), measured in Chromium at both 360 and 480. That is the standing cost of the panel's chrome
at every width, and it is the number to argue with when either band wants to grow. The old
arrangement had no such number — the chrome's cost varied with scroll position, which is
precisely why it was never counted.

## Consequences

- **The scrollbar starts where the content does.** The bands keep their full width and
  their full-bleed backgrounds; no gutter, no seam.
- **`ContextBar` no longer scrolls away.** Connection state and the pin are always
  reachable, which is the upside; 48px is permanently spent, which is the price. It is
  paid back roughly one-for-one by what the bar stopped saying twice.
- **Nested scrollers are unaffected.** `.scrollable-list` (the groups list, the member
  explorer) keeps its reserved 6px gutter and its own styled bar. The panel now has
  exactly the two kinds of scrollbar it should: one for the content region, one per inner
  list.
- **`usePublishedHeight`'s document-root mode has no caller.** It is kept — the hook is
  general and its unit tests exercise both modes — but the panel's only live publisher is
  now `PageHeader`'s `TabPanel`-scoped one.
- **A wrapping `PageHeader` is now the tallest thing above the fold.** Measured at 360px:
  91px of chrome plus a 114px header on the Groups rung, whose subtitle wraps to three
  lines. That is a header problem, not a chrome one and not addressed here — but the
  chrome budget above is what makes it countable.
- **Not verified here:** the `overflow-anchor: none` oscillation `App.tsx` documents. The
  header's parking line moved from `--rail-h` to `0`, which is the input to that loop, and
  confirming it needs `dist/` loaded against a live Okta session.
