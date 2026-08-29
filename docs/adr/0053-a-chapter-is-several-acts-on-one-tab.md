# ADR-0053: A chapter is several acts on one tab

- Status: Proposed
- Date: 2026-08-28
- Amends: [ADR-0045](./0045-capture-thin-compose-in-react.md). The capture/compose
  split is unchanged — Playwright still films only the walk, Remotion still composes
  everything else. What changes is the unit `Scene` composes: one capture per chapter
  becomes several, and `Chapter` gains a sequencing layer to hand them one clock.
- Relates to: [ADR-0043](./0043-the-demo-is-a-stage-the-script-is-the-director.md)
  (the chapter card and the margin the act boundary must not disturb),
  [ADR-0044](./0044-a-reel-that-can-fail.md) (`reel.json`'s per-beat contract, unchanged
  per act)

## Context

The reel is seven chapters — users, groups, apps, rules, compare, attributes,
reporting — and `.storybook/scripts/capture/chapters.mjs` names the tab each one
films: `users`, `groups`, `apps`, `rules`, `users`, `groups`, `groups`. Rail order is
`users, groups, apps, rules`. The cut does not follow it. It runs the four tabs in
order and then backtracks three times: `compare` re-films Users, `attributes` and
`reporting` both re-film Groups. A viewer who has just watched the rail settle on
Rules watches it jump back to Users, then twice back to Groups, with two of those
three revisits landing on the same tab.

The restructure this ADR is part of puts every tab's material in one chapter, once,
in rail order. Groups absorbs `groups`, `attributes` and `reporting` into a single
chapter that runs three scenarios back to back — group provenance, a reorg cohort,
and an SMS-retirement scan — and lands around 66 seconds. Users absorbs `users` and
`compare` the same way. That is the plan this ADR gives a type to; it does not choose
the new cut's content.

`Scene` is not shaped for that. `script.ts` defines it as one `id`, which resolves to
one `capture()`, one `plan: BeatPlan[]`, and one `marks: Mark[]` list — a single
`ramp` built once in `Chapter` from a single manifest. A three-scenario Groups chapter
under today's `Scene` has exactly one way to exist: one Playwright walk that opens the
tab, runs provenance, runs the reorg cohort, runs the SMS scan, and closes, filmed as
one clip with one `beats[]` array threading all three.

That throws away the exact thing ADR-0045 bought. Its own numbers: a chapter that
genuinely changed re-filmed in 10 to 28 seconds, against 162 seconds of continuous
shooting for the whole reel before the split. A single 66-second walk is not a chapter
at that scale, it is most of a reel's worth of one chapter, and every property that
made the dev loop cheap was earned by capture being _thin_ — short enough that a
caption edit's re-shoot cost is close to zero. A 66-second capture is not thin. Retiming
one line in the SMS-scan act's caption would re-run the provenance and reorg acts too,
because they are frames in the same file. And a beat that misses its mark inside that
walk — `moveAndClick`'s throw, ADR-0044 §3 — fails the entire chapter's capture, not
the one scenario that was actually broken. Three scenarios sharing a `beats[]` and an
`ok` flag means one flaky selector in the SMS-retirement act blocks review of provenance
and the reorg cohort, which were fine.

## Decision

**A chapter becomes a sequence of acts, and each act is its own capture.**

```ts
export interface Act {
  capture: CaptureId;
  label?: string;
  plan: BeatPlan[];
  marks: Mark[];
}

export interface Scene {
  id: string;
  title: string;
  acts: Act[];
}
```

`plan` and `marks` move from `Scene` onto `Act`, one act's worth of what they already
were — a `BeatPlan[]` retiming one capture's beats, and a `Mark[]` cueing that
capture's beats to margin copy and camera. Nothing about how a beat plan or a mark is
built changes; only which capture it is built against does. A chapter that still needs
only one act — `apps`, `rules`, and any chapter that stays single-scenario after the
restructure — declares `acts: [{ capture, plan, marks }]`, and every property below
degenerates to what the chapter already does today. This is a typed change, not a
re-shoot: the existing seven clips and their manifests stay exactly as valid as they
were, because a one-act chapter is the same walk `Chapter` already renders, addressed
through one more level of indirection.

**Why per-act captures instead of one long walk with internal scene breaks.** The
alternative was rejected and is worth stating plainly, because it is the smaller change:
keep `Scene` as it is, keep one capture per chapter, and simply write a longer walk that
does all three scenarios before the manifest closes. It costs everything ADR-0045 was
for. The re-film loop goes from 10-28s per chapter back to a shoot sized to the whole
chapter — 66 seconds of capture plus whatever hold and retime multiply it by, for a
one-word change to any one scenario's caption. Failure stops being isolated: `capture()`
throws on the first failed beat in the manifest (`captures.ts`), so a selector that
drifts in the SMS-retirement act fails the capture for provenance and the reorg cohort
too, and there is no way to re-run only the broken third. Acts avoid both: an act is a
capture the same size ADR-0045 already validated as thin, so retiming or recaptioning
one scenario re-shoots one act, and a broken act fails on its own — the other two acts'
manifests are untouched and still `ok`.

**`chapterLength` sums its acts.** `buildRamp` still runs once per capture; a chapter's
duration is now the sum of each act's `buildRamp(...).durationInFrames` rather than one
call's result. Nothing about how a single act's ramp is built changes — `easeMs`,
`holdMs`, `tailMs` all mean what they meant, scoped to that act's own manifest.

**`Chapter` renders a `<Series>` of acts.** Today `Chapter` builds one `ramp` from one
`manifest` and derives `cues`, camera state, and diagram lifetime from marks cued
against that ramp's frames. Under acts, `Chapter` wraps its existing per-capture body in
a `<Series.Sequence>` per act, each with its own `manifest`, `ramp`, and `cues`, exactly
as today — the frame-local logic inside a single act does not change, because an act
_is_ what `Scene` used to be. What moves up a level is chapter-wide state that must not
reset at an act boundary: the margin's accumulated lines survive Groups' provenance act
into its reorg-cohort act only if the chapter, not the act, owns when `resetMargin`-
equivalent clearing happens — which mirrors the "bands accumulate, they do not replace"
rule ADR-0043 already set for beats inside one capture, now applied at the coarser
grain. An act's optional `label` is what a caption-level distinction inside a chapter
needs that a beat's mark did not: something to say _which_ scenario is running, read by
`FilmIndex`, see below.

**`chapterTab` reads the first act's tab and asserts every other act agrees.** This is
the load-bearing part of the whole ADR, more than the type change itself. The
restructure's premise — visit each rail tab exactly once — is not a property of the data
today; it is a property of how `script.ts` happens to be written, checked by nobody. The
old seven-chapter script already proves how fast that convention rots: `compare` and
`attributes` were each added, at different times, by someone who needed "one more
scenario on an existing tab" and reached for "one more chapter" because that was the
only unit `Scene` offered — and nothing said no. A convention that lives only in a
treatment document — this ADR, `docs/features-plan.md`, whatever names the intended cut
— is exactly the kind of rule the next contributor adding an eighth scenario will not
have open. Asserting it in `chapterTab` turns that drift into a render-time error the
moment it happens, rather than a discrepancy a viewer has to notice in the finished
film:

```ts
export function chapterTab(scene: Scene): number {
  const tabs = scene.acts.map((a) => capture(a.capture).tab);
  const [first, ...rest] = tabs;
  if (rest.some((t) => t !== first)) {
    throw new Error(`Chapter "${scene.id}" mixes tabs: ${tabs.join(', ')}. A chapter is one tab.`);
  }
  const index = TAB_DEFS.findIndex((t) => t.id === first);
  if (index < 0) {
    throw new Error(`Chapter "${scene.id}" films tab "${first}", which is not in TAB_DEFS.`);
  }
  return index;
}
```

This is the same move ADR-0045 made for the app's own rail versus the film's band —
turning an assertion someone has to remember into an invariant the composition checks
by construction — applied here to the chapter/tab relationship instead of to the
crop.

**`kind: 'tour' | 'deep'` stops being structural, and stays written into the capture
manifest.** Under the old seven-chapter cut, `kind` distinguished "a stop" from "an
argument" across different chapters, and `FilmIndex` printed it as "The tour" or "In
depth" beside the counter. Under the new cut every chapter is one tab and every chapter
is an argument built from one or more scenarios — "The tour" does not name anything a
viewer needs to be told, because there is no longer a chapter that is merely a stop
along the way. So `FilmIndex` stops reading `kind`, and its `kind` prop and the label
slot beside the counter carry the current _act's_ `label` instead — which is exactly
what a three-act, 66-second Groups chapter needs to say ("Provenance" versus "The reorg
cohort" versus "SMS retirement") that a chapter-level "tour or deep" distinction cannot.

`kind` is not deleted from `chapters.mjs` or from `captures.ts`'s `Manifest` type.
Removing it from the capture step would make `captures.ts`'s `Manifest.kind` field a lie
about what `capture.mjs` actually writes, and every existing manifest JSON still carries
it, so `Reel.tsx`'s `capture(scene.id).kind` read (used today to build `CHAPTERS`) would
throw on `undefined` the moment one caller forgot the type had gone stale. It also buys
nothing to remove: `fingerprint()` — the function that decides whether a capture is
still current and can be reused without a re-shoot — hashes `{ id, story, ready }` only.
`kind` was never part of what keeps a clip current, the same way ADR-0045 found for the
`chrome` crop-height field it did drop (§8, "Dropping the `chrome` measurement did not
bump `SCHEMA`... the composition stopped cropping, not because any footage went
stale"). The difference here is that field truly stopped being read anywhere; `kind`
still has a reader, `chapters.mjs`'s own capture step, so it stays.

## Consequences

- `reel/src/script.ts`: `Scene`'s `plan`/`marks` fields move onto a new `Act`
  interface; `Scene` gains `acts: Act[]`. `SCRIPT` entries with one scenario become
  `acts: [{ capture, plan, marks }]`; a restructured Groups or Users chapter lists two
  or three.
- `reel/src/comp/Chapter.tsx`: renders a `<Series>` of acts instead of one capture's
  body directly. `chapterLength` sums per-act `buildRamp(...).durationInFrames`.
  `chapterTab` asserts a single tab across `scene.acts` and throws naming the stray
  act and its tab if that fails.
- **The margin starts clean at each act, and this is a correction to what was first
  proposed here.** The intent was to scope band accumulation to the chapter's
  `<Series>` so a claim from act one could still be standing when act two's evidence
  arrived. Implementation showed that to be wrong on the only ground that matters:
  bands stack rather than replace, so a three-act Groups chapter would argue its third
  scenario underneath six lines about the first two, in a margin that is one column
  wide. An act _is_ a scenario, and a scenario's evidence belongs to it. Each act
  therefore resolves its own cues from its own marks and its own clock, which is also
  what makes an act independently renderable and independently re-shootable. A claim
  that genuinely spans two acts is restated by the second act, on camera, where a
  viewer can read it.
- `reel/src/comp/Reel.tsx`: `CHAPTERS` still derives `at`, `tab`, `from`, `length` per
  chapter from `chapterTab`/`chapterLength`, unchanged in shape — those functions keep
  their chapter-level signature, so `Band` and `FilmIndex`'s across-chapter slide need
  no change. `capture(scene.id).kind` is replaced with the running act's `label`.
- `reel/src/comp/FilmIndex.tsx`: `kind: 'tour' | 'deep'` prop is replaced with an
  optional act `label: string`, printed in the slot that used to read "The tour" / "In
  depth". A chapter whose single act has no label prints nothing there, same as a
  chapter today with no scenario worth naming separately.
- `reel/src/captures.ts`: unchanged in shape. `Manifest.kind` stays, still written by
  `capture.mjs`, still asserted by `capture()`'s existing checks (`schema`, `ok`,
  per-beat `ok`) — those checks already operate per capture, so they apply per act with
  no change.
- `.storybook/scripts/capture/chapters.mjs`: `CHAPTERS` keeps naming `kind` per capture
  entry, because that is what `capture.mjs` reads to decide how long to run and how
  much to read off the panel — the capture-time meaning ADR-0053 leaves alone. It is
  the composition's _reading_ of `kind` that stops, not the capture's writing of it.
- **No re-shoot.** Every clip and manifest under `reel/captures/` that exists today
  stays valid: a one-act `Scene` is the degenerate case of the new shape, addressed
  through one extra array level. The restructure's actual new footage — the Groups
  reorg-cohort and SMS-retirement acts, and whatever Users needs to fold `compare`
  in — is scoped separately and is not part of this ADR.
- A chapter with acts sharing a tab that later drifts — someone adds a fourth Groups
  scenario to a different chapter instead of extending this one — fails at
  `chapterTab`'s assertion rather than at review. That is the point: the "one tab, one
  visit" property the whole restructure rests on is now checked by the composition
  every time it renders, not remembered by whoever edits `script.ts` next.
