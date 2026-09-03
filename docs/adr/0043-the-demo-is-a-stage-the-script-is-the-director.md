# ADR-0043: The demo is a stage; the script is the director

- Status: Accepted
- Date: 2026-08-26
- Superseded in part by [ADR-0045](./0045-capture-thin-compose-in-react.md), which
  keeps the premise (film the real product; the script directs) and moves the camera,
  the captions and every piece of furniture out of the browser into a compositor.

## Context

Okta Unbound had no way to show itself. Demonstrating it meant pointing a screen
recorder at a real org, and every real org is someone's private directory — so
the extension could be described but never shown.

Storybook already held everything a fake org needs: a `useOktaApi` facade mock
wired through a Vite alias, a `chrome.*` fake, Playwright as a dependency, and a
headless screenshot script. What it did not hold was anything that shows the
product _moving_. No story mounted `App`, so tab navigation, view push/pop and
the ActivityBar had no stage. `preview.tsx` stamps `data-motion="off"` on every
story and `tailwind.css` clamps animation to `1ms` under it, so the default state
of the entire catalogue is motionless. And the shared fixtures — 250 users named
`First{n} Last{n}`, one group called `Test Group` — read as unfinished on camera.

## Decision

Add a `Demo/` story set filmed by a Playwright script, and split the two
responsibilities strictly:

**A scene is a stage.** `src/sidepanel/demo/scenes.stories.tsx` seeds the demo
org, sets the initial state, mounts `App`, and stops. Scenes carry **no `play`
functions**.

**The script is the director.** `.storybook/scripts/film-scenes.mjs` drives every
movement, draws the cursor, and places the captions.

Four mechanical reasons, not a stylistic preference:

1. `docs/component-explorer.md` already forbids the combination — "keep `play`
   functions off motion-enabled stories" — and every scene is motion-enabled by
   construction.
2. **A `play` has no wheel and no viewport.** `useStaggerReveal` only cascades
   rows that genuinely cross the viewport, and `actionBarFit` only re-splits when
   the panel width really changes. `page.mouse.wheel()` and `setViewportSize()`
   exist; `userEvent` equivalents do not.
3. **A `play` blocks the ready signal.** Storybook emits `storyRendered` only
   after `waitForAnimations`, and a scroll-driven `.dock-band` holds that open for
   its full 5s ceiling — its `finished` promise resolves at 100% range progress.
   The script waits on a DOM anchor instead.
4. **A throw inside `play` paints an error overlay mid-take**, ruining footage in
   a way nobody notices until playback.

Supporting decisions:

- **Demo data lives in `src/sidepanel/demo/`**, not `.storybook/`. It does not
  ship — Rollup follows the manifest entry graph and nothing there reaches it —
  and living in `src` keeps it under tsc, eslint and knip, which matters because
  it mirrors `shared/types.ts` and `groupSummary.ts` and must not drift. It is
  added to `coverage.exclude`: it has no behaviour to assert.
- **Memberships are derived, not asserted.** Each rule-fed group's membership is
  computed by applying the predicate its rule expresses, so a member row claiming
  rule-based provenance is telling the truth and a group cannot advertise a
  headcount it does not hold.
- **Scenes are `tags: ['!test']`** — a 30-second staged scene has no business in
  the browser suite — with `a11y` and `actions` disabled. They still type-check
  and still build, which is the gate that matters (`build-storybook` and
  `test:storybook` are separate CI steps).
- **Showcase motion is injected, not authored.** The reel needs motion roughly
  2.6× the product's own scale; rather than animate around the design system, the
  film script overrides the same `--dur-*` / `--ease-*` custom properties the app
  consumes. Nothing enters `tailwind.css`; it is a gel on the light, not a change
  to the set.

## Consequences

- `npm run film` regenerates every clip after a UI change; `--reel` produces one
  continuous 16:9 video, so there is a publishable artefact without an ffmpeg
  dependency.
- Choreography is coupled to real selectors, so a renamed control breaks a beat.
  Beats are isolated and timestamped into `clips/manifest.json`, and a missed
  mark is reported rather than silently filmed — the first cut hid an empty
  search box behind a beat that reported success.
- `.storybook/mocks/chrome.ts` gained a real `runtime.onMessage` registry, a
  seedable `storage.local`, `tabs.get`/`tabs.reload`, and stagers for page
  context and scheduler state. These make the fake usable by ordinary stories
  too.
- The `useOktaApi` mock gained the seven facade keys it was missing; without
  `getUserProfileSchema` the comparison surface could not render at all.

## Amendment, 2026-08-26: the margin, and what the reel is for

The decision above is unchanged: a scene is still a stage, the script is still
the director, and scenes still carry no `play` functions. What the first cut got
wrong was everything downstream of that — the stage dressing and the reel's
contents. Stills pulled with `frames.mjs` made all of it visible at once.

- **The caption system is a register set, and the margin never empties.** The
  left column is the claim, the evidence the panel produces, and the proof line
  that settles it: three bands on one grid, hanging off a single rail at x=96.
  The middle band is a stack of blocks, and a block can be evidence lines, a
  counting tally, a set diff, or a typed trace, so a fixed grid does not read as
  a fixed template. `claim()` and `proof()` replace in place; `evidence()`,
  `diffRow()` and `trace()` accrete. There is **no `clearCaption`**: the previous
  cut called it at the end of most beats and kept filming, so stills at t=33s and
  t=128s were blank from the rail to the panel. Only `resetMargin()` clears, and
  only the runner calls it, at a scene boundary.
- **A caption no longer computes its own position.** Each one used to derive
  `top` from whatever element it was anchored to, clamped to 70–760, so every
  beat landed on a different baseline. The rail is the single x-origin and the
  grid is the single baseline.
- **The title card is gone; the chapter is the margin at full frame.** Its
  anatomy used to duplicate the caption's exactly (kicker / headline / sub /
  gradient rule), so the reel had two ways of saying the same thing and no change
  of register between them. The chapter is still opaque, because concealing the
  inter-scene tab-load spinner is the job the old card was actually doing — but
  the panel now _recedes_ behind it (dimmed, blurred, scaled back) and rides
  forward again as the chapter fades, so the hand-off is a movement rather than
  a cut.
- **The chapter goes up before the panel has loaded, and a scene may declare a
  `prologue` that runs underneath it.** That is what stops the Rules scene from
  filming its own "No Rules Loaded" empty state, without needing a new seeding
  hook.
- **Beats are declared, and the declaration drives the rail.** `SCENES[id].beats`
  is a contract: the runner fills the rail from it and warns when a choreography
  function calls a beat the list does not name. A renamed beat surfaces instead
  of silently stopping the rail halfway.
- **The palette is the product's.** The first cut accented on `#7dd3fc` /
  `#38bdf8` — Tailwind's `sky`, which this repo does not own — so the furniture
  was cyan around an indigo product. Every value in `showcase.mjs` is now derived
  from `tailwind.css`: `signal` is `--color-primary` lifted at the same hue,
  `paper` is `--color-canvas` verbatim. `affirm` / `alarm` appear only on a real
  delta, never for emphasis.
- **Chapters state, they do not ask.** Three of five titles were questions. A
  question hands the viewer a job and defers the payoff; the reel asserts, the
  evidence produces the artifacts, and the proof line settles it.
- **No em dash or en dash appears on camera.** Hyphens are fine. This reaches the
  demo org too, because the panel is the video: `snapshot.ts` used an em dash as
  its group-name separator and it was on screen for most of the runtime.
- **The reel is four scenes, and the action bar is not one of them.** It is still
  a story and still filmed by `npm run film` as its own clip, but a layout
  behaviour is the weakest possible use of a reel's last position. The cut closes
  on the audit trail instead.
- **The impact scene was captioning a number the panel never showed, over a
  click that never landed.** Every rule card renders its own `Preview Impact`
  button, all nine sit in the DOM at once and all nine report as visible, so
  `.first()` picked rule 1's — and once `scrollIntoViewIfNeeded` had parked that
  under the `sticky top-0 z-40` nav, the click hit the nav while `moveAndClick`
  still returned `true`. The beat recorded `ok`. Worse, the caption read "80
  people would lose GitHub", which takes the _membership_ count and reports it as
  a loss: the modal actually says **lose access 0**, current members 80, target
  group "No change". Two fixes, and the second is the one that matters — a beat
  that asserts a figure the panel does not display can be wrong forever without
  anything going red. `previewImpactFor()` now resolves a rule's own button
  through its unique rule id, `centreInView()` keeps it clear of the nav, and the
  tally reads the modal's own figures.
- **Diff rows are derived, not written.** The comparison scene's set difference
  follows from applying the demo org's own rule predicates to the pinned pair, so
  it changes when the rules change — the same discipline the memberships already
  hold themselves to.

## Amendment, 2026-08-27: the camera

The first amendment fixed what the frame contained. This one moves the frame.
Every shot in the second cut was the same shot: the panel pinned right at a
fixed size for the whole runtime, always shown whole, so the fine type that
carries the argument was small and webm-soft. The decision is unchanged again —
a scene is still a stage, the script is still the director — and everything
below is the director gaining a camera.

### The panel is 840px, and its geometry is a variable bus

Nothing writes a longhand inline any more. The camera writes **custom
properties** on `:root` and on `#storybook-root`, and one rule in
`SHOWCASE_CSS` consumes them into `left`, `top`, `width`, `height`, `transform`,
`clip-path`, `opacity` and `filter`. `sweepPanelWidth` was the other writer of
`width` and now writes `--panel-w`, which also removes the inline
`transition: width` that would have clobbered the camera's transition list.

Three named frames — `panel-right`, `panel-left`, `centre` — each carry their
layout variables **and** an `aperture`, `margin` and `control` rect. They are
exported as one table, `FRAMES`, because both video guards import it. Duplicated
geometry drifts, and a checker that disagrees with the camera is worse than no
checker.

**`animation: stage-panel-in` had to be deleted before any of this could work.**
An animation declaration outranks author rules _and_ inline styles, and with
`fill-mode: both` it pins its `to` values forever. Measured: the "recede" behind
a chapter card had never dimmed or scaled — only the `filter: blur` was ever
applied, because `opacity` and `transform` were pinned. Any camera writing
`transform` would have been ignored just as silently. The deletion site carries a
warning comment: re-adding an animation with `fill-mode: forwards`/`both` to
`#storybook-root` kills the entire camera while every beat still reports `ok`.

### Sharpness comes from animating the variable, not the transform

Transitioning `--cam-s` is a **main-thread** animation: every frame gets a fresh
style recalc and rasters at that frame's scale. Transitioning the `transform`
longhand is a compositor animation that rasters once and reuses the texture. So
the variable bus is not merely tidier, it is what keeps a 2.4x push crisp.
For the same reason there is deliberately **no `will-change: transform`** on the
panel: it pins raster scale and buys nothing here. `deviceScaleFactor: 2` with
the video still at 1920x1080 supersamples every frame, not only the zoomed ones.

### Two things a push silently breaks, both now enforced mechanically

- **Modals.** `clip-path` _does_ clip `position: fixed` descendants, and a
  modal's overlay centres on the panel box rather than on the aperture, so a
  modal opened under a push is both clipped away and misplaced. A
  `MutationObserver` on the modal layer auto-pulls and raises a warning the
  runner prints. `camera.frame('centre')` is the supported way to enlarge a
  modal in frame.
- **Stagger reveals.** `useStaggerReveal` observes against the **viewport**, so
  rows outside it under a push never reveal. `push()` refuses a target still
  held by a live stagger gate.

### A push may only aim at something that is on screen

"Visible" cannot mean "non-zero box". Both rungs of a tab stay mounted
(ADR-0016) and the rung behind is not hidden, it is _scrolled away_ — so its
nodes report perfectly real boxes at coordinates outside the panel. Accepting one
produced a crop of 358x-173 out of an 840x980 panel. A candidate now qualifies
only if its **centre** lies inside the panel's box, which is what a viewer means
by "on screen" and rules out the off-screen twin and the scrolled-past target in
one test. Relatedly, every `return false` inside `push()` records a reason:
several used to return in silence and surfaced to the runner as a useless "no
match" over a selector that matched, was visible, and pushed fine a second later.

### The pointer and the camera must not race

The camera never rests — a continuous idle drift composed underneath any push,
because a dead-still frame is the strongest tell of a screen recording. That
drift broke **every click in the reel**, and not in the way it looks like it
would. Playwright's actionability check refuses to act on a moving element, so
`scrollIntoViewIfNeeded` failed with "element is not stable" after a five second
timeout; `moveAndClick` swallowed that, measured a box still below the fold, and
clicked into empty backdrop — returning `true`, because it _had_ dispatched a
click. The group-detail rung silently never opened while every beat reported as
landed.

So **every pointer interaction freezes the drift for its whole duration**, in one
place (`steadily()` in `helpers.mjs`), wrapping the scroll as well as the click.
The drift's clock stops rather than keeps running, so releasing resumes from
where it froze instead of snapping forward.

### The white flash was Storybook's loading overlay, not the backdrop

Three backdrop layers were built and all three verified working — a CDP
`Emulation.setDefaultBackgroundColorOverride`, a two-phase init that installs the
stage stylesheet via a `MutationObserver` as soon as any host element exists
(measured: in `<head>` at 31ms, while `readyState` is still `loading`), and
`color-scheme: dark`. The document background was ink from the first painted
frame. The field still went fully white for ~500ms on every navigation.

Sampling `elementFromPoint(6, 6)` frame by frame named it: a full-bleed
`div.sb-preparing-story.sb-wrapper` with a hard-coded white background, painted
on top of a backdrop that was never the problem. It is now dressed in ink rather
than hidden, because `display: none` would also throw away Storybook's error
display, and an error rendered invisibly during a shoot is worse than a flash.

For the record, since both were tried: the launch switch
`--default-background-color` is inert in current Chrome, and
`Page.setDefaultBackgroundColorOverride` has been removed outright.

### Two guards, each with falsifiability controls

- **`check-open.mjs`** judges a 30px backdrop band around the field, **not** the
  whole frame. The obvious global "what fraction is white" detector does not
  work and a first run proved it: the panel is near-white and fills 40% of the
  field by design, and the cold open legitimately reaches 61%, so any threshold
  clearing that is one a partial flash hides under. The band is ink in every
  named frame by construction, and it is derived from `PANEL` and `FRAMES` with a
  drift allowance rather than written down. Controls: a **positive** control runs
  the same maths over a synthetic all-white buffer and must exceed 0.99, and a
  **negative** control reads the identical band mid-reel and must come back ink.
  Both print before any verdict.
- **`check-margin.mjs` is frame-aware.** Its rects used to be hard-coded to the
  panel-right layout. Once the camera can put the panel on the left those numbers
  land on the _panel_, so the check reports "populated" for a blank margin and
  its control strip reads as content — both silent, both pointing the wrong way.
  Each beat now records the frame it ended in and the checker derives its rects
  from `FRAMES`. Marginless frames are exempt **by declaration**, not by a
  threshold that happens to pass.

**`npm run film-demo`** runs the reel and both guards in order, stopping at the
first failure, and distinguishes exit 2 (a detector failed its own controls, so
its verdict means nothing) from exit 1 (a bad take). `--reel` now exits non-zero
when a beat does not land, so the gate has something to read.

### The bloom is a deliberate reversal

The first amendment said the backdrop is "flat, not a two-blob gradient". That
rule was written against decorative background blobs and it stands for those. A
soft radial bloom **anchored behind the panel and travelling with it** is a
different thing: it is the light the panel implies, and it is what stops the ink
field banding in webm. Recorded here as a reversal rather than quietly reverted.

### The reel's contents changed again

- **The bulk-operation scene is gone.** It narrated 48 membership writes over the
  Users tab's search box with the ActivityBar's numbers typed in from the script,
  and nothing was ever written. Its slot goes to **MFA coverage**, which drives
  the real `scanGroupMfa`: one `GET /api/v1/users/{id}/factors` per member, the
  single job in this app that no query parameter collapses, and therefore the one
  place the scheduler's progress bar reports on work an administrator genuinely
  waits for. Factor data is **derived** from each user's own status, employee type
  and department, so the coverage figure is a consequence of the org — and
  filtering the roster to the unenrolled returns exactly those people.
- **A composition scene was added**, reading a group as a population: facets the
  panel discovered for itself, filters that compose, and a sort over the same
  roster.
- **No caption states a figure the panel does not display, and that is now
  enforced rather than remembered.** `readRoster()` reads the panel's own
  "Members N of M" heading at run time and the proof line is built from it.
- **The rule-impact scene is held out of the reel.** It narrates a product bug:
  `ruleImpact` models deactivation as retracting membership, and Okta does not
  work that way. Filed as `D-052`, not fixed here. When the fix lands the scene
  returns arguing **both verbs side by side** — deactivate, where nobody moves
  but N members become unattributed, and delete, where `removeUsers` chooses
  irreversibly between removing them and keeping them as manual members.

## Amendment, 2026-09-02: the rule-impact chapter came back

The 2026-08-27 amendment ended by holding the rule-impact scene out of the reel,
because it narrated a product bug: `ruleImpact` modelled deactivation as
retracting membership, and Okta does not work that way. That was filed as
`D-052`, fixed there, and nothing recorded that the block had lifted — the
knowledge lived only in a closed item's **Related** paragraph. `I-029` is that
record, and this is the note the earlier amendment was waiting on.

**It returns as the Rules chapter's second act, not as its own chapter.**
ADR-0053 made a chapter a tab visited once, with acts inside it; the inventory
and the consequence are two movements of one argument about rules, so they are
labelled `The inventory` and `The consequence` and share a chapter card. The
capture is `rules-impact`, its walk is `walks/rules-impact.mjs`, and its `films`
list is `['rules']` — the act opens the rule detail rung and two modals, all of
which hang off the `RulesTab` island, and it changes no rail tab.

**It argues both verbs, which is what the earlier amendment asked for.** One
population, read off the panel, and the difference between what each verb does
to it: deactivate removes nobody and leaves them in the group with no rule left
to explain them; delete is the only verb that can take them out, and
`removeUsers` decides whether it does. Only the first is reversible.

Three things this act does that the pulled scene did not:

- **It reads the panel's own sentence in each mode and refuses a take without
  it.** `RuleImpactModal`'s lead paragraph differs per mode, and those two
  sentences _are_ the `D-052` fix. A cut of the fixed product and a cut of the
  defective one are otherwise indistinguishable at playback speed, which is
  precisely how the original defect survived a cut and a review. The assertion
  lives in the walk, so a regression stops the shoot rather than shipping.
- **It picks a subject with a non-empty solely-held set, and proves it.** The
  pulled scene previewed `Engineering → GitHub`, whose target is an `APP_GROUP`;
  group rules never attribute `APP_GROUP` membership, so `heldSolelyCount` there
  is structurally zero. The scene was arguing about an empty set, which is the
  other half of why nobody noticed. The subject is now `Engineering by
department`, whose target is an ordinary group no other active rule assigns
  into, and the walk throws if the count comes back below one.
- **It writes nothing.** `Preview impact` is read-only by construction; the
  deactivate confirmation is opened for its copy and then **cancelled**. The
  demo org is genuinely writable (ADR-0052), and a confirmed deactivation would
  leave the rule `INACTIVE` for the first act, which argues from the count of
  inactive rules.

### Two things `I-026` moved under the composition

`I-026` declared twelve group rules whose memberships the demo org already
had — eight departments, three offices, and `Datadog - Engineering`. Nothing in
the reel states a figure directly, so no caption went wrong. Two pieces of prose
and one piece of geometry did:

- **The ledger set piece was built for exactly two line items.** Its row draw
  cues were the literal pair `[24, 38]` and its column height was
  `ROW_H * 2 + ROW_GAP`. With a third predicted group the third row clamped onto
  the second's draw cue and overran the block by a full row, printing through the
  totals plate underneath — on the one plate in the film whose whole argument is
  that each line item was measured separately. Both are now derived from the
  captured row count, and `readLedger` refuses more rows than the sheet can hold
  rather than running off the bottom of the frame.
- **`previewImpactFor()` in `selectors.mjs` had been stale since the rule detail
  rung landed.** It looked for `Preview Impact` inside an open disclosure on a
  rule card; the verb is `Preview impact` and it lives on `RuleActionBar`
  (ADR-0039). Nothing caught it because no walk used it — the chapter that would
  have was the one held out. Replaced by the selectors this act actually aims at.

The reel's rule against writing a figure down held: every number on camera still
comes off the panel through `figure()`, and the two things that broke were a
comment and a layout constant, neither of which that rule covers.
