# ADR-0043: The demo is a stage; the script is the director

- Status: Accepted
- Date: 2026-08-26

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
