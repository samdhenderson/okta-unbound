# The demo reel

The extension ships two films. **The reel** is the long demo: real footage of the
real panel, captioned and argued over in a compositor. **The advertisement** is a
twenty-eight-second store-page cut sharing the reel's motion grammar and tokens and
none of its footage. This page owns the rules both rest on; how to work the rig is
the `okta-reel` skill.

## The demo is a stage; the script is the director

`src/sidepanel/demo/scenes.stories.tsx` seeds the demo org, sets initial state,
mounts `App`, and stops. **A demo story carries no `play` function.** Everything
that moves is commanded from outside the browser by a walk under
`.storybook/scripts/capture/walks/`.

This is mechanical, not stylistic. A `play` has no wheel and no viewport, so it
cannot exercise `useStaggerReveal`'s cascade or the action bar's width re-split; it
blocks Storybook's `storyRendered` signal until animations settle; and a throw
inside it paints an error overlay into the middle of a take.

Demo stories live under `Demo/` in the explorer, `tags: ['!test']` with `a11y` and
`actions` off. **They are not component stories and not a tested surface** — they
still type-check and still build, which is the gate that matters. Do not copy their
shape for a component story. Demo data lives in `src/sidepanel/demo/`, not
`.storybook/`: it does not ship — Rollup follows the manifest entry graph and
nothing there reaches it — and living under `src` keeps it inside tsc, eslint and
knip, which it needs because it mirrors `shared/types.ts`.

## The demo org can be written to

The reel has to end a chapter on a fix landing, so the org is not a constant.

- **A write is a patch overlay, never a mutated seed.** `demoUsers` stays the
  frozen deterministic array; `demo/state.ts` holds per-user profile patches and
  merges on read. The seed stays diffable, reset is a `.clear()`, and a scene that
  never writes pays nothing.
- **Memberships re-derive on write.** `demoGroupMembers()` and `demoUserGroups()`
  are functions over a memo invalidated by a monotonic revision counter, so a
  rule-fed group's roster is computed against the user's _live_ profile and a row
  claiming rule-based provenance is telling the truth about what is on camera.
  Hand-managed groups have no predicate and hold their seeded sample; they were
  never derived and do not start being derived here.
- **No group row carries a frozen count.** `currentGroups()` stamps
  `_embedded.stats.usersCount` at read time: a stale count is invisible, so the
  shape that could go stale was removed. A write then re-seeds the snapshot and
  fires `snapshotUpdated`, so the panel repaints through the same listener a real
  org's background sync uses.
- **A walk refuses the take if the named row does not appear.** Read the panel's
  own before-state, wait on the product's save confirmation (never a timeout), wait
  for the **named group row** (a badge going 5 to 6 is not an event), and throw if
  the count did not move or the row was already there. A chapter that does not show
  what it claims does not ship.

## Capture is thin; composition is everything else

Playwright records **only the panel-sized walk**. React composes the film. The
capture viewport is the panel itself, 840x980 at `deviceScaleFactor: 1`, with no
transform. Scaling the app into a bigger viewport is geometrically fine and breaks
the product: `view-timeline` progress is measured against the viewport, so the
docked action bar films as a blank grey band while remaining present in the DOM.
Sharpness is bought elsewhere — the panel sits near 1:1 and the emphasis comes from
vector overlays drawn at full frame resolution.

The app is filmed slow and played back fast. `RETIME` is 3 at capture time and no
amount of post recovers it; every wall-clock action the driver takes is retimed
alongside the CSS, or the drawn cursor crosses the panel in a few frames and reads
as a cut. The shoot only has to be slow **enough**: **the pitch of the cut is
editorial and decided in post**, through `Speed` in `reel/src/ramp.ts`.

**Everything else is composed.** Titles, captions, diagrams, set pieces, chapter
order, camera and speed all live under `reel/` on one clock, and nothing under
`reel/` is an input to the capture fingerprint. Re-shoot only when the walk changes.

**The extension's own React is never mounted inside the compositor.** Its motion is
CSS transitions on `--dur-*`/`--ease-*` tokens, which a frame-indexed renderer does
not advance. Purpose-written components driven by `useCurrentFrame` are expected —
a rebuilt surface is always cut against footage of the real component in the same
chapter, so the film never asserts a component exists without showing it. The
palette is generated from `src/sidepanel/tailwind.css` into
`reel/src/theme.generated.ts`, never transcribed.

The guards are one file, `capture/check.mjs`, judging the _footage_ and not the
composition: **exit 1 is a bad take; exit 2 is a detector that could not look**,
never conflated. `check.fixture.mjs` plants one real defect per control with the
magnitudes imported from `thresholds.mjs`, so raising a threshold cannot silently
neuter its own control.

**A green check is not a finished film.** The guards judge whether the footage is
technically sound — settled, unshifted, framed. They cannot judge whether it shows
what the narration claims it shows. A caption describing something the panel never
did is invisible to every control here, and that exact failure has shipped twice.
Watch the cut end to end before calling it done; the guards catch what a person
watching would miss, not the reverse.

## Declared motion, and a mark that throws

A guard for "the app moved when we did not ask it to" needs to know when the stage
was _supposed_ to be moving. **The declaration is a consequence of the camera being
commanded, not an assertion by the commander.** `drive.mjs`'s verbs declare their
own windows as they issue them; nothing declares at a choreography site, where
"declare everything" is achievable by sprinkling calls nobody reviews. A window
over footage that never moved is worse than no window, so `scrollBy` throws when it
asks for travel and gets none.

**A mark that cannot be satisfied throws** rather than quietly filming the wrong
frame. `drive.click` refuses an element that never appears, has a zero box, is
disabled or `aria-disabled`, is not onstage, or whose click coordinate hit-tests
elsewhere. The raw pointer path bypasses Playwright's actionability check entirely,
which is how a disabled button once reported a landed click. `{ optional: true }`
is the only escape hatch, and typing is its only routine user. "Onstage" is one
predicate registered as a Playwright selector engine, so nothing can disagree about
what was on camera.

## A chapter is one tab; an act is the unit of shooting

A chapter is one or more acts, and **each act is its own capture** — thin enough
that recaptioning one scenario re-films twenty seconds rather than a minute, and a
missed mark fails its own act while the acts either side stay valid.

- **`chapterTab` asserts every act films the same tab** and throws by name when one
  does not. Rail order, forwards, each tab visited once is a property the
  composition checks, not a convention in a treatment document.
- **The label belongs to the act**, printed beside the chapter counter in the film
  index. It earns the slot only when a chapter has more than one movement to
  distinguish. **`kind: 'tour' | 'deep'` stays in the capture manifest and nowhere
  else** — it changes what gets captured, and no composition reads it.
- **An act may be a set piece instead of footage.** A piece act names the capture
  it dramatises — where its numbers come from, not what is on screen — and never
  labels itself.

## Every number came off the panel

A walk reads a figure through `drive.read`, which throws if the panel does not say
it; the composition fetches it with `figure(manifest, key)`, which throws if the
capture never recorded it. **No figure is ever typed into a script, a diagram, a
piece or a narration line.** A visual wanting a number the walk did not record is a
walk that needs to record it, which is a re-shoot. Walks assert their own arguments
too: a chapter whose second filter did not narrow the roster does not ship.

## The cut is data; the vocabulary is a registry

`reel/src/script.ts` is the film. It imports **no components** — a mark names a
diagram by id, an act names a piece by id — and the only value it imports is
`figure`, so it stays evaluable outside a bundler. Everything below depends on
that. The resolved cut is emitted to `reel/plan.generated.json` (and
`CUT.generated.md`) by running the real script through the real ramp. **Every build
script reads the plan; none reads the script's text.** It is committed, carries a
do-not-edit header, has a `--check` mode, and CI asserts it — the same contract
`theme.generated.ts` holds.

Everything the script can name lives in exactly one id-keyed registry: `PIECES`,
`DIAGRAMS`, `CARDS`, `VERBS`, and the ad's `STABS`. **`Root.tsx` derives its
compositions from the registries**, so a registered thing is previewable because it
is registered, and no second list can drift.

- **A verb is one entry that cannot be half declared** — total, curve, named
  sub-windows and stagger together in `verbs/registry.ts`, `VerbName` derived from
  the table. `check-verbs.mjs` fails a verb that is registered but not exported,
  has no row in the demo matrix, or schedules a part past its own end.
- **A set piece's time is a sheet of named cues.** A pause is a named quantity the
  cut retunes through `holds`, not an implicit subtraction between two frame
  constants. `pieceFrames()` replays the same arithmetic, so the generated cut
  cannot describe a length the film will not render.
- **Nothing on the length path may throw.** `Reel.tsx` resolves every act's length
  at module scope, so a computation there is fine and a `capture()` or `figure()`
  call is not: it takes down the whole bundle instead of one composition.

## Narration

The reel is narrated in Sam's own recorded voice, and **the picture must still work
muted** — a feed autoplay, a phone on silent and a screen reader are all real
audiences. Every claim the voice makes is also a line the margin prints; narration
may add tone, never a fact that appears nowhere else. **No digit is spoken that is
not a `figure(m, key)` read off a manifest**: the voice is held to the rule the
captions are.

**The cut leads and the voice follows.** Act lengths come from the ramp and a line
is written to fit the budget an act already has; a line that does not fit is cut,
or the act is re-pitched in `script.ts`. Durations reach the build as a generated
literal (`reel/src/vo.generated.ts`, measured by ffprobe), never as a file read on
the length path.

`check-vo.mjs` is the gate, and it is compensation rather than decoration: `reel/`
sits outside build, lint and knip, so it and `check-verbs.mjs` are most of what
stands between a spoken claim and a film that ships it wrong. It fails an act with
no recording, a recording longer than the act under it, a WAV no act claims, and a
digit in `NARRATION.md` citing no figure.

## The advertisement

`reel/src/ad/` is a second, twenty-eight-second cut for the Chrome Web Store, behind
its own Remotion entry (`reel/src/ad-entry.ts`), its own script
(`reel/src/ad/script.ts`) and its own documented cut (`reel/AD.md`). **It is not a
truncated film.** It shares the reel's verb grammar and generated theme and shares
nothing else: no captures, no manifests, no figures, no narration gate, and no
frame of footage. Everything on screen is synthetic, and it re-shoots nothing — a
walk that breaks cannot take the ad down with it, which is why the entry point is
separate.

The rules the ad is held to are its own, and `reel/AD.md` is their page: nothing
invented inside the rebuilt panel, never mistakable for a screenshot, fake data
only, no em or en dashes on camera, and sound cued on the stab's own cue names
rather than on frames. Its sound effects are synthesised with ffmpeg from
`reel/sfx.json` by `reel/scripts/make-sfx.mjs` into `reel/src/sfx.generated.ts` —
no samples, no licences. WAVs are build output under gitignored `captures/`, so a
missing sound renders silent rather than blocking a cut being edited. Ad narration
is optional and stays outside `check-vo.mjs`, which is per film act.
