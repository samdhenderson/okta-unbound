# ADR-0044: A reel that can fail

- Status: Accepted
- Date: 2026-08-27
- Superseded in part by [ADR-0045](./0045-capture-thin-compose-in-react.md). The
  principle stands and the detectors are rebuilt against a different manifest; the
  margin and shift-probe guards are deleted because their defects stopped being
  expressible.
- Amends: [ADR-0043](./0043-the-demo-is-a-stage-the-script-is-the-director.md), whose
  2026-08-27 camera amendment gave the director a camera and two video guards. This
  ADR does not move the frame again. It closes the three defects the camera left
  behind and makes each one mechanically detectable.
- Relates to: [ADR-0016](./0016-in-tab-view-stack-navigation.md) (both rungs of a tab
  stay mounted, which is why "visible" cannot mean "non-zero box"),
  [ADR-0012](./0012-no-test-tampering.md) (a detector that cannot fail is a weakened
  test by another name)

## Context

The second cut had a camera and two guards, and it still carried three defects that
`reel.json` reported as `ok`:

**A. The frame jumps.** An unanimated, instant scroll or camera move lands mid beat.

**B. The cursor clicks where nothing is.** A control the beat assumes is on screen is
not, the click lands in empty backdrop or on the scrolled-away twin rung, and the beat
records `ok: true` because a click was in fact dispatched.

**C. Text re-wraps as its neighbour resizes.** A count badge or a status chip lands
late and re-lays-out the string beside it, on camera.

`film-demo.mjs` already admitted the gap these live in: neither `check-open` nor
`check-margin` can catch a beat narrating something the panel never showed. Both judge
pixels in a region. None of the three defects changes what is in a region; they change
whether it was still, whether the pointer reached it, and whether it re-flowed while
the caption was asserting something about it.

The through-line is that all three were **silent by construction**. `moveAndClick`
returned `true` on four distinct failures. `scrollIntoViewIfNeeded` swallowed its own
timeout. Nothing observed layout at all. A reel that cannot fail is a reel that will
be wrong without anyone finding out, and the previous cut proved that in the smallest
possible way: a beat asserted a figure the panel did not display and stayed wrong
until a human watched it back.

## Decision

### 1. The declared-motion ledger is a consequence of commanding the camera

Both remaining guards need to know when the stage was _supposed_ to be moving. The
ledger is driven from `_time(ms, ease)` in `showcase.mjs`, which is already the single
chokepoint every camera verb funnels through: `frame`, `cut`, `push`, `pull`, the
entrance, and the re-raster nudge. `_time()` opens a window of `ms + MOTION_TAIL` and
closes it on a timer. `MOTION_TAIL` is 200ms, one exported constant, and it reaches
the page through `SHOWCASE_CSS` so the in-page recorders and the Node guards read the
same number.

This is the design point worth arguing. The alternative was a `declare()` call at each
choreography site, which reads the same but is not the same thing at all: it makes the
declaration an **assertion by the commander**. Under that shape, "declare everything"
is achieved by sprinkling calls through a thousand lines of `choreography.mjs`, spread
so thin that no reviewer would catch it. Driven from `_time()`, the declaration is a
**consequence of the camera being commanded**, and defeating the guard requires
editing one visible chokepoint that every reviewer of this subsystem already reads.

Scroll is the one channel `_time()` does not cover, because `rampScroll` and
`centreInView` run their own in-page rAF loops. They bracket themselves explicitly.

The backstop is arithmetic rather than trust, but **not the arithmetic this
decision was first drafted with.** The plan specified a ceiling on
`declaredMs / totalMs` per chapter, and the first full reel failed it in three
chapters at 40 to 55 percent. Every one of those windows was a camera move that
genuinely happened: a chapter reframe travels `1250 * 1.3 + 70 + 140` ms, a push
holds 1200, a pull 1140, and the eased scrolls declare on top of that. A reel
whose subject is a camera is supposed to be in motion much of the time, so the
ratio measures how camera-driven the edit is and calls it dishonesty.

What dishonesty actually looks like is a window declared over footage that never
moved, which is exactly what declaring everything produces and exactly what a
ratio cannot distinguish from a busy shot. So each declared window is asked
whether it contains a move the guard would otherwise have flagged. A window that
does is justified however long it is; one that does not is padding, and padding
is what blinds the guard. `DECLARED_INERT_MAX` (0.35 of declared time) is the
control; the ratio is still printed, as a fact about the edit rather than a
verdict.

The inert share earned its place immediately. The `navigates` declaration below
was first written after `page.mouse.up()`, and React resets the scroller on the
render that mouseup schedules, which lands sooner than a round trip out to the
page can call `declare()`. The guard reported both halves of that mistake: the
snap as an undeclared jump, and the late window as inert. The ratio would have
reported neither.

### 2. One layout-shift observation serves both the fix and the guard

A single `PerformanceObserver({ type: 'layout-shift', buffered: true })` feeds two
consumers: `stage.settled()`, which is the **fix** (a beat waits for quiet before it
starts), and `check-settle`, which is the **guard** (a beat fails when a shift lands
inside its window and outside a declared one). One recorder, so the thing being waited
for and the thing being checked cannot diverge.

Three properties of that recorder are load-bearing:

- **`hadRecentInput` is recorded and never filtered on.** Our `page.mouse.down()` is
  dispatched via CDP as trusted input, so it opens a 500ms suppression window and sets
  the flag. Filtering on it would blind the recorder for 500ms after every click,
  which is exactly when class C happens. See the measured section: the entry is
  delivered anyway.
- **Displacement is normalised to panel-local pixels.** `sources[].previousRect` and
  `currentRect` are viewport coordinates taken post-transform, so under a 2.6x push a
  1px in-app shift reads as 2.6px; and `value` is an impact fraction scored against the
  1920x1080 stage, so an identical shift scores differently in `panel-right` than in
  `centre`. Dividing by `root.getBoundingClientRect().width / root.offsetWidth` undoes
  the camera. `shiftPx` is the only quantity a threshold may be written against.
- **`sources[]` is scoped to nodes inside `#storybook-root`.** Every beat opens by
  writing the margin, which shifts the margin's own DOM continuously; unscoped, the
  settle gate never goes quiet. Documented blind spot: `source.node` is `null` when the
  node was removed, so null-node sources are ignorable and are counted into a visible
  tally rather than dropped in silence.

The recorder installs from `STAGE_INIT` phase 1, not from `installStage()`.
`installStage()` runs at `DOMContentLoaded`, which under Vite dev is seconds and
hundreds of requests after document start, so every shift during app boot would be
missed.

The settle gate is **budgeted, not additive**. A pre-roll in `makeBeat` normally
returns immediately because the previous beat's trailing hold already paid for the
quiet period, and `still()` consumes the settle out of the hold it was already
spending. A quiet page costs exactly its nominal hold; an unquiet one records its
overrun rather than silently lengthening the reel.

### 3. The mark throws, hit-tests, and shares one on-screen predicate with Node

`moveAndClick` throws by default. `{ optional: true }` opts out and is the only way to
get the old boolean back; `typeInto` uses it, because there the pointer move is
presentation and the typing is the point.

| Condition                            | Before  | After                       |
| ------------------------------------ | ------- | --------------------------- |
| never visible within the find window | `false` | throws, names the selector  |
| zero-size box                        | `false` | throws `zero box`           |
| `disabled` / `aria-disabled`         | `true`  | throws `disabled`           |
| centre outside the panel box         | `true`  | throws `offstage at (x, y)` |
| hit test resolves elsewhere          | `true`  | throws, names what was hit  |

The enabled check exists because the raw `page.mouse` path **bypasses Playwright's
actionability check entirely**. That is how a `disabled` Compare button reported a
landed click. The hit test runs `elementFromPoint` at the click coordinate immediately
before `mouse.down()` and requires the hit to be the target or a descendant of it,
which also catches a tooltip opened by the 16-step hover path sitting under the press.

The on-screen predicate is factored out into `stage.isOnstage(el)` and registered as a
Playwright selector engine named `onstage`, so `push()`'s candidate filter,
`moveAndClick`'s offstage check and `visible()`'s resolution all run **one definition
in two languages**. This is the predicate ADR-0043 already argued for: a candidate
qualifies only if its centre lies inside the panel box, which is what a viewer means by
"on screen" and which rules out the scrolled-away twin rung ADR-0016 keeps mounted.
Before this, `push()` enforced it and `visible()` did not, so the two disagreed about
what was on camera.

`scrollIntoViewIfNeeded` is deleted. It was instant, unanimated and swallowed its own
failure, and it is the one live cause of class A. Callers that were relying on it use
the eased `centreInView` ramp instead.

Everything the pointer does is written to a `pointer[]` ledger in `reel.json`:
coordinates, selector, hit result, enabled state, onstage. The contract is enforced at
click time; the ledger is the proof it was.

### 4. Two guards, and both decode no video

`check-still` (class A) and `check-settle` (class C) read `reel.json` only. This is a
deliberate departure from `check-open` and `check-margin`, which sample frames. Reading
the manifest makes both new guards **deterministic and testable against a fixture**
rather than against a four-minute shoot, which is the difference between iterating in
seconds and iterating in minutes, and it removes the frame-drop timebase problem
described in section 5.

They keep the house discipline unchanged: falsifiability controls printed **before** any
verdict, exit 1 for a bad take, exit 2 for a detector that failed its own controls. The
distinction matters because a broken detector and a broken reel are different problems
and `film-demo` reports them separately.

- `check-still` samples the **computed** custom properties, not `stage._cam`. `_cam` is
  the _target_, written once at transition start, so sampling it would show a step at
  the write and a flatline through the actual move. Its positive control is an
  undeclared 40px `--cam-y` jump the stage injects during the end card; not flagging it
  is exit 2. That control is load-bearing rather than ceremonial, because the sampler
  and the thing it judges both live in `showcase.mjs`, so a broken sampler would
  otherwise pass itself.
- `check-settle`'s positive control widens a probe node by a known amount outside any
  declared window. Its negative control is a declared `frame()` move, which must not be
  reported.

Because both consume `reel.json`, the manifest carries a clock reconciliation. `beat.at`
is Node wall clock; everything the stage records is `performance.now()`, which **resets
on every navigation**, and the reel navigates once per scene on a single page. So there
are five page clocks in one reel, not one. Each chapter records a clock sync taken
immediately after navigation, and only reel-time values reach `reel.json`. No guard ever
sees a `performance.now()` value. Getting this wrong would have had both guards
comparing unrelated timelines and passing.

### 5. There is no third guard for class B, and that is a decision

A video guard for "the cursor clicked where nothing is" was designed and rejected on
three counts:

- **It would be the stage checking itself.** `#demo-cursor` is drawn from the
  `clientX`/`clientY` of the very events `page.mouse` dispatches, so the footage cannot
  disagree with the DOM about where the pointer was.
- **It has no timebase it can trust.** `beat.at` is Node wall clock consumed as video
  seconds, and a webm shot at `deviceScaleFactor: 2` drops frames. `check-margin`
  tolerates that drift because a margin is populated for seconds; a cursor patch is
  valid for about 100ms.
- **Luma inverts on the case that matters.** A click landing in the margin reads light,
  which is precisely the reading a "did it land on the panel" test would score as a
  pass.

Class B is enforced at click time instead, by the hit test in section 3. That is exact
rather than probabilistic, it catches strictly more, and the `pointer[]` ledger makes
the enforcement auditable after the fact.

### 6. Class C is worked around reel-side, and the product defects are filed, not buried

Two class-C causes are not waitable and are fixed directly, both in reel-side files, so
that no file under `src/` is touched by this work:

- **Fonts.** Inter is one self-hosted variable file, so the swap is once per
  navigation, not once per beat. One `await document.fonts.ready` in `awaitContent()`.
- **Scrollbars.** `.scrollable-list::-webkit-scrollbar` in `src/sidepanel/tailwind.css`
  opts those boxes out of Chrome's overlay scrollbars and gives them classic ones, which
  take 6px out of the content box the instant a list crosses from fitting to
  overflowing. There is no quiet period to wait through; the width simply changes.
  `SHOWCASE_CSS` sets `scrollbar-gutter: stable`.

**The scrollbar rule is a reel-side mask and does nothing for real users**, and neither
does the settle gate, which conceals a late-landing badge by waiting for it rather than
by reserving room for it. The underlying product defects are a single class: an element
whose size changes after mount sits beside text that then re-lays-out. They are filed as
`D-053` and its seven sub-items so that hardening the reel does not quietly retire the
symptom it was hardening against.

### 7. The margin's claim belongs to the scene, and `check-margin` scans continuously

Two findings that arrived together, from the same red run, and neither is class A, B
or C. They are recorded here because the second is the reason the first went unseen
for the whole life of the reel.

**The claim moved off the first beat and onto the scene.** `playChapter` wiped the
margin, raised the card, dropped it, and then travelled the reframe -- and the first
beat's `claim()` was what put anything back. So every chapter opened on a blank
margin with the panel already in frame: 1.3s at Compare, 1.6s at Composition, 2.9s at
Provenance, which has no card to hide behind. The claim is now a field on the
`SCENES` entry rather than the first statement in a choreography function, and the
runner raises it as the card lifts -- under the lift, so the masked reveal off the
rail runs while the card is still clearing and the band has landed before the reframe
begins. The claim is still never a reprint of the card's title, for the reason it
never was.

**`check-margin` sampled at `beat.at` and `beat.at + 1s`.** Its verdict line read
"margin populated at every beat boundary", which was true of every take and told us
nothing: a blank margin ends when a beat writes a claim, so a beat boundary is the
one instant in a blank stretch guaranteed to be lit. The defect above sat entirely in
the gap between two samples, in all five chapters, and surfaced only when one fade
landed 40ms late and the boundary sample caught the frame before it.

So the scan is continuous -- every 250ms across the clip -- and the verdict is on
runs rather than instants, failing at 500ms of consecutive blank. That needs to know
where the margin _is_ at an arbitrary instant, which no beat can say, so every
sampler row now carries the live frame name and whether the chapter card is covering
the field. Both exemptions are by declaration from the stage rather than by a
threshold that happens to pass over the card's own pixels, which is the same
discipline `margin: null` already had for the `centre` frame. The control strip is
read at every scanned instant too, so it covers exactly the ground the verdict does.

The general lesson is the one this ADR is about: a guard that samples where the
subject is by construction well-behaved reports a clean run forever. `check-margin`
had a falsifiability control and passed it the whole time -- the control proved the
detector could tell ink from light, not that it was ever pointed at the defect.

## Measured: what the Layout Instability API reports under the camera

**No number above was written before this table existed.** It was produced by
`.storybook/scripts/probe-shift.mjs` on 2026-08-27 against
`demo-scenes--group-drilldown`, headless Chrome at 1920x1080, `deviceScaleFactor: 2`.

| What moved                               | Property written     | Entries | Max panel-local px | Verdict                      |
| ---------------------------------------- | -------------------- | ------- | ------------------ | ---------------------------- |
| nothing (idle 1.5s)                      | none                 | 0       | 0.00               | clean baseline               |
| `--cam-s` 1 to 2.4                       | `transform`          | **0**   | 0.00               | excluded                     |
| `--cam-s` 2.4 to 1                       | `transform`          | **0**   | 0.00               | excluded                     |
| `--cam-x/y` +/-200px                     | `transform`          | **0**   | 0.00               | excluded                     |
| `--cl-*` inset 120px                     | `clip-path`          | **0**   | 0.00               | excluded                     |
| `--panel-x` 1008 to 72                   | **layout** (`left`)  | 50      | 0.00               | emits, zero displacement     |
| `--panel-w` 840 to 600                   | **layout** (`width`) | ~21     | **37.10**          | genuine reflow               |
| app load and settle                      | none                 | 11      | n/a                | real product shifts          |
| click a group row                        | none                 | 12      | n/a                | real, `hadRecentInput: true` |
| scroll 400px                             | none                 | 0       | 0.00               | scrolling is not a shift     |
| 120px grow, scale 1                      | none                 | 1       | **120.00**         | reference                    |
| 120px grow, scale 2.4 + 100px clip inset | none                 | 1       | **120.00**         | normalisation exact          |

### Two predictions came out the opposite way to the design

**Transform scale is excluded, so `push()` and `pull()` emit nothing.** The design
reasoned that the Layout Instability spec excludes _translation_ by an ancestor
transform, that Chrome compensates translation only, and that a 1 to 2.6 scale would
therefore register as a shift of everything on screen at once. That reasoning is wrong:
a 1 to 2.4 scale registers **zero entries**, and so does a `clip-path` inset. The
declared-motion gate was written as the load-bearing mechanism for class C and is in
fact belt and braces. It is kept, because it costs nothing and it survives a future
Chrome changing its mind, but this ADR should not be read as claiming it earns its keep
on this evidence. The mechanism that actually does the work is the panel-local
threshold.

A second consequence of the same measurement: `frame()` and `cut()` write `--panel-x`,
which produces 50 entries at **0.00 panel px of displacement**. A `shiftPx` threshold
therefore ignores camera reframes _naturally_, with no window arithmetic involved.
`--panel-w` is the only camera write that genuinely reflows the app, and it is reachable
only from `actionBarShowcase`, which is not in `REEL_ORDER`.

**`hadRecentInput` is advisory and the entry is delivered anyway.** The fear was that
the flag suppressed delivery, blinding the recorder for 500ms after every click.
Measured, clicking a group row produced 12 entries, all flagged `true`, all fully
populated with `value` and `sources`. Only the CLS _aggregator_ drops flagged entries.
"Record the flag, never branch on it" now stands on evidence rather than on reasoning.

One prediction that held, and that closed a coverage hole this ADR would otherwise have
had to declare: **panel-local normalisation is exact.** A 120px induced shift measures
`120.00` at scale 1 and `120.00` at scale 2.4 under a 100px clip inset, so a beat that
pushes is still fully covered by `check-settle`.

Finally, the API sees the reported defect by name. Clicking a group row reports sources
`DIV.flex-1.min-w-0` and `DIV.shrink-0.flex.items-center`: a `shrink-0` cluster widening
beside a `flex-1 min-w-0` text column, which is exactly the "text adjusts as the element
next to it shifts position" complaint, and exactly the shape every item under `D-053`
takes.

### The instrument failed before the subject did

This is the transferable part. The first probe run produced an all-zero table, and it
was not a finding. Its positive control inserted a fresh 120px `<div>` at the top of the
app scroller. Twenty-nine elements demonstrably moved by more than 1px, and the API
reported **zero entries**.

The same insertion in a synthetic page reported normally, including in one wrapped in a
fixed, scaled, `clip-path`'d panel with an `overflow-y: auto` flex-column scroller. So
the behaviour is specific to this tree, not to the camera: **a freshly inserted node
produces no attributed layout shift here.** Growing an element already in the layout
reports immediately and exactly, and it is also the more faithful control, because
growing in place is what the app itself does when a badge lands or a chip changes text.

The failure mode is what matters: **a positive control that silently reads zero makes
every zero below it look like a finding instead of a broken instrument.** Every "0
entries" row in the table above would have been accepted, the declared-motion gate would
have been documented as unnecessary rather than merely redundant, and the panel-local
normalisation would never have been validated. `probe-shift.mjs` now exits 2 when its own
control reads zero, and that is what caught it. Every detector in this subsystem carries
the same rule for the same reason.

### The constants, and what each clears

| Constant             | Value        | What it clears                                                                                                                         |
| -------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `SHIFT_EPS_PX`       | 1.0 panel px | Sub-pixel noise. `frame()` reads 0.00; the 120px control clears it by 100x.                                                            |
| `CAM_SCALE_EPS`      | 1e-4         | The re-raster nudge is `s * 1.0000001`, i.e. 2.6e-7 at s=2.6, about 400x below.                                                        |
| `CAM_PX_EPS`         | 0.5 px       | Sub-pixel rounding on `--cam-x/y`.                                                                                                     |
| `SCROLL_EPS_PX`      | 8 px         | Above rounding, below any real jump. Eased scrolls are declared, so this only has to catch _undeclared_ scroll.                        |
| `DECLARED_INERT_MAX` | 0.35         | Share of declared time that may cover footage that never moved. The honesty backstop; the ratio it replaced is printed but not judged. |
| `MOTION_TAIL`        | 200 ms       | Contains `push()`'s re-raster nudge at `ms + 60`.                                                                                      |

## Consequences

- `npm run film-demo` runs the shoot and **four** guards in order, stopping at the
  first failure and still distinguishing exit 2 from exit 1. What remains uncovered is
  meaning: whether the claim in the margin is true of what the panel is showing, and
  whether the cut has a rhythm. That is a human watching it end to end, and the guards
  are the regression net rather than the acceptance test.
- **Making the mark throw surfaces every currently-silent miss at once.** Some are
  genuine misses that need new choreography rather than a wider timeout. The MFA scan
  is the known case: its wall clock is clicked and never awaited, so a later beat
  reaches for a row that only exists once the scan lands. Hold arithmetic there is
  replaced by an observable wait.
- Both new guards are unit-testable against a fixture manifest, so the cheap loop is
  seeding a jump or a shift into a fixture and confirming exit 1, and removing the
  controls and confirming exit 2. Neither requires a shoot.
- The guards must be proved non-vacuous the same way, one fix at a time: restoring
  `scrollIntoViewIfNeeded` turns `check-still` red, removing the pre-roll turns
  `check-settle` red, and dropping the hit test turns a silent pass into a throw.
- `reel.json` is at schema v2. Every v1 key keeps its name, type and meaning, so
  `check-open` and `check-margin` continue to read it untouched.
- The class-C product defects survive this work by design. `D-053` holds them, and each
  sub-item says explicitly that the reel masks the symptom rather than fixing it.
- The reel's declared-motion ratio is now a published number per chapter. If a future
  change needs to declare more than a third of a scene, that is a signal about the
  choreography, not a threshold to raise.
