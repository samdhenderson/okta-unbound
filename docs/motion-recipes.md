# Motion recipes

Two pieces of choreography that are too specific to belong in the scale itself: the
**scroll-driven dock timeline** that merges a pinned `ActionBar` into the page header,
and the **sticky-stack** rules that keep that merge from being broken by an unrelated
animation. The token scale, the four rules, the nine primitives, the reduced-motion
contract and the skeleton-vs-spinner rule are in [motion.md](./motion.md); read that
first. The band's resting shape and its geometry custom properties are in
[surfaces.md](./surfaces.md).

## The scroll-driven one

`.dock-band` is the panel's only **progress-driven** animation: it advances with
scroll position, not with a clock, so no duration token applies to it. It merges a
pinned `ActionBar` into the `PageHeader` above it — the strip **rests as a card the
width of the rung** and, over the last `--merge-range` **before it parks**, grows past
the column's margins to the panel edges, drops its radius and borders, covers the
header's seam and grows `--shadow-dock`.

The timeline is a `view-timeline` on a zero-size sentinel `ActionBar` renders just
before itself, not `scroll()`: the merge is a function of how close the strip is to
the header, and scroll offset does not carry that.

```css
:has(> .dock-sentinel) {
  /* hoist the name onto the sentinel's parent, so the band can see it */
  timeline-scope: --dock-progress;
}

.dock-sentinel {
  view-timeline: --dock-progress block;
  /* the band already parked at the top, less the rung margin between sentinel
     and band — so `cover 100%` is exactly the docking line. The tab rail is not in
     this sum: it sits outside the scroller, so the scrollport starts below it
     already. */
  view-timeline-inset: calc(var(--header-h, 0px) - var(--dock-offset, 0px)) 0px;
}

:has(> .dock-sentinel) > .dock-band::before {
  animation: dock-band linear both;
  animation-timeline: --dock-progress;
  animation-range: cover calc(100% - var(--merge-range)) cover 100%;
}
```

### The post-mortem: it never actually ran

**None of this ran for its first several revisions, and the way it failed is the thing
to learn from.** A named timeline is referenceable by the declaring element and its
_descendants_ — not by its following siblings, which is what this doc and
`tailwind.css` both claimed. `--dock-progress` resolved to `null` on the band's
`::before`, and a null timeline with `fill: both` holds the animation on its `to`
keyframe forever: the strip rendered permanently merged and full-bleed at
`scrollTop: 0`.

It was not failing to merge, it was failing to _un_-merge — which is why it read as a
styling choice rather than a bug, and survived review. Check anything you add here
with `getAnimations()`: a resolved timeline is not the default outcome.

The fix is the `timeline-scope` hoist above, onto the sentinel's parent.

### Tuning the range

**`--merge-range` is 16px and is bounded by the gap the strip actually closes** — the
tab column's vertical padding, 24px. Not the strip's own travel, which is larger and
not the same thing: `PageHeader` collapses its identity region on the way down, so the
strip moves ~96px while closing a 24px gap over ~24px of scroll. A range longer than
the gap means the merge is part-done before the page has moved — measured on the real
component, 64px started 61% merged and 32px still started 25%. At 16px it rests flat
through the first ~7px of scroll, merges over the next ~17, and reaches 100% on exactly
the frame the strip parks. If the rung's spacing changes, this is the token to
re-check.

`--dock-offset` guards the same class of error from the other side: it is
`bandTop − sentinelTop`, subtracted from the timeline inset so the marker cannot sit
above the position it marks. At both current call sites the strip is the first child of
its rung and the sentinel floats, so **nothing collects a step and the measured value
is `0px`**. It earns its keep the day a page renders something above the strip inside
the rung.

There was briefly a second animation, `dock-more`, translating the **More** cluster out
to the docked edge as the chrome widened. It went when the strip became a card: a
card's disclosure is already at the trailing edge, and moving it during the merge would
break the rule that nothing in flow is on this timeline.

### Four things to know before adding another one

- **`@supports` is not optional**, and gate on the sentinel too. A browser that drops
  the unknown `animation-timeline` runs the keyframes on the _document_ timeline at
  `0s` with `fill: both` — permanently stuck at the end state; an unresolvable name
  fails the same way, and a non-sticky strip renders no sentinel.
- **Only a `to` block.** `dock-band`'s implicit `from` is the element's own computed
  value, so the resting card is described once — in `::before` — instead of being
  duplicated in a `from` block that then drifts out of sync with it.
- **Reduced motion needs an explicit rule.** Duration plays no part in a
  progress-based timeline, so the blanket reduced-motion block in
  [motion.md](./motion.md#reduced-motion) cannot reach it: `tailwind.css` clears
  `animation-name` for `.dock-band::before` in both the media-query and the
  `data-motion="off"` block instead. Any new one must add itself to both — and must be
  safe at rest, which for this one means the unconditional `::after` bleed plate
  covering the gutters ([surfaces.md](./surfaces.md)).
- **Animate a positioned pseudo-element, not the element.** These are not compositable
  properties, so every frame of scroll is style work; on an absolutely positioned
  `::before` it never reflows the real content — which is what lets the chrome bleed
  past the column while the band keeps the constant layout width its `ResizeObserver`
  depends on. Animating the element itself risks a feedback loop: the size change
  alters `scrollHeight`, which alters the progress. Relatedly, the scroll root sets
  `overflow-anchor: none`.

Stories default to `data-motion="off"`, so a scroll-driven animation renders inert
there. A story that showcases one opts back in with `parameters: { motion: 'on' }`.

## The sticky stack

The merge happens between two sticky layers — the band's `z-30` and `PageHeader`'s
`z-20` — and anything that creates a stacking context between them breaks it.

**Push in and pop in fill `backwards`; every other `animate-*` primitive fills `both`.**
That is deliberate and it is not a motion choice. These two run on a whole rung
wrapper — an ancestor of every sticky band on the page — and a forwards fill keeps the
animation applying after it finishes, which keeps its element a stacking context:
Chrome reports a settled `animate-push-in` wrapper as `transform: matrix(1, 0, 0, 1, 0, 0)`,
not `none`. That trapped `ActionBar`'s `z-30` inside the rung, below `PageHeader`'s
sticky layer, and left a hairline above the docked strip on the Groups detail rung.

Both keyframe sets end at `opacity: 1; transform: none` — the element's own resting
values — so dropping the forwards half changes nothing you can see and releases the
trap. The `*-out` primitives keep `both`: they end away from their resting state and
need the fill to hold there.

**If you add a rung-level or page-level animation, check it the same way.** Anything
that animates `opacity`, `transform`, `filter` or `backdrop-filter` with a forwards
fill, on an element between a sticky band and the header it merges into, will break
that merge in exactly this way — and it will look like a CSS-border bug, not a
paint-order one, because the merge itself still runs perfectly.

Bands out of flow publish their heights as custom properties (`--rail-h`, `--header-h`,
`--activity-h`), and the timeline inset above is computed from `--header-h`. Never
hard-code an offset around one — a literal de-syncs the docking line from the band that
defines it.
