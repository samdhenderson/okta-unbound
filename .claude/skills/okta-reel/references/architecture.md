# The reel's architecture

Enough to work in the system without reading 1,700 lines of ADR.

## The pipeline

```
walk (Playwright)  ->  clip.mp4 + manifest.json  ->  composition (Remotion)  ->  reel.mp4
   what the camera        the footage and every       everything drawn over
   does in the panel      figure read off it          it, in React
```

**The camera films only the walk.** No captions, no diagrams, no cursor, no
chrome — those are all composed afterwards in React (ADR-0045). This is the
single most useful fact about the system: it means almost every change to the
film is free of the camera.

### The shoot

`.storybook/scripts/capture/` (~2,600 lines) plus `walks/` (12 files, ~1,550
lines). `npm run capture` films only chapters whose **fingerprint** changed.

The fingerprint hashes: a schema version, the chapter's own entry, the shared
driver files, that chapter's walk, and the transitive import reach of the app
slice it films. **Nothing in `reel/` is hashed, deliberately** — so a caption,
a diagram, a retime, or a whole new set piece never costs a re-shoot.

Deliberate blind spots, documented in `capture.mjs`: bare-specifier deps and
the lockfile are not hashed, build/Storybook config is not, and non-static
reach is not. The `explorer` chapter is reached via ⌘K, so its `films` entry
is unenforced — omitting a tab there makes the clip immortal rather than
broken.

### The manifest

One `captures/<id>.json` per clip, written even when a chapter throws. It
carries `beats` (named time ranges the walk marked), `pointer` (cursor steps
the composition replays), `figures` (values read off the live panel, each with
the ms it was read at), and `instrument` (layout shifts, scrolls, declared
motion — what the footage judge reads).

`reel/src/captures.ts` is the front door and it **refuses** rather than
degrades: schema mismatch, `ok: false`, or any failed beat throws. `figure()`
throws naming the keys that _were_ read. `figureNumber()` additionally refuses
a non-finite value, which is what stops `NaN groups` reaching the screen.

### The composition

`reel/src/` (~12,000 lines). Structure:

```
SCRIPT  ->  Scene (chapter)  ->  Act  ->  { plan: BeatPlan[], marks: Mark[] }
```

- A **chapter** is one tab, visited once. Every act in it must film the same
  tab; `chapterTab()` throws otherwise (ADR-0053).
- An **act** is one capture, retimed. Its key is `<capture|piece-id>-<index>`,
  and that key is the narration filename, the `NARRATION.md` heading, and what
  `reel:look --at` resolves. One definition, in `reel/src/actKey.ts`.
- A **beat plan** entry retimes a manifest beat: `speed`, `easeMs`, `holdMs`.
  `buildRamp()` turns beats + plan into constant-rate segments and frame cues.
- A **mark** is editorial: a headline, points, a stage, a crop, a diagram id.
  It is cued on a beat.

Lengths are **derived, never authored**: mark/plan → `buildRamp` →
`actLengths` → `chapterLength` → `REEL_FRAMES`. A piece short-circuits to a
literal, because `Reel.tsx` builds the chapter table at module scope and
anything that can throw on that path takes the whole bundle down.

Two stages: `home` (panel in its column, argument to the right) and `focus`
(panel gone, a synthetic visual in its place).

### The narration

`NARRATION.md` is the recording script — one `###` heading per act key, a
generated `Target:` line, and `>` blockquote lines to read aloud. WAVs land at
`captures/vo/<act-key>.wav`; `measure-vo.mjs` ffprobes them into
`vo.generated.ts`; `check-vo.mjs` is the gate.

Narration is written **to fit the picture**, never the other way round: act
lengths come from `buildRamp` at module scope, so a length that stretched to
fit audio could throw and take the studio down (ADR-0073).

## The generated cut

`reel/plan.generated.json` + `reel/CUT.generated.md`, from `npm run reel:plan`.

`emit-plan.mjs` compiles `script.ts` and `ramp.ts` to CommonJS in a temporary
directory, requires them, and runs the **real** `SCRIPT` through the **real**
`buildRamp`. Every build script reads the result.

This replaced three text parsers and a hand-written port of `buildRamp` that
carried the comment "This must be updated by hand." Those existed only because
`script.ts` used to import React and could not be evaluated outside a bundler
(ADR-0074).

## The five ADRs, as operative rules

Read the records themselves only when changing one of these decisions.

**ADR-0043** — the demo is a stage, the script is the director. Origin of the
demo stage and the **em/en dash ban** (they read as a hitch in the voice as
much as a kern problem); `check-verbs.mjs` enforces it.

**ADR-0044** — a reel that can fail. Guards must be able to fail; a check
nobody has watched fail is not evidence. `check.fixture.mjs` exists to prove
the footage judge can fail.

**ADR-0045** — capture thin, compose in React. The load-bearing one:

1. Playwright films only the walk; everything else is composed.
2. Nothing in `reel/` is a capture-cache input.
3. Every figure on screen was read off the live panel — the honesty rule.
4. A synthetic component must never be mistakable for a screenshot.

**ADR-0053** — a chapter is several acts on one tab. Why `users` is six acts
and `rules` is two. `kind: 'tour' | 'deep'` survives on the manifest but the
composition no longer reads it.

**ADR-0073** — the reel speaks. Narration is Sam's own voice. The film must
still work **muted**, so the margin marks stay. No spoken digit that is not a
`figure:` reference.

**ADR-0074** — the cut is data, the vocabulary is a registry. The script names
visuals by id and imports no components; `PIECES`/`DIAGRAMS`/`CARDS` share one
shape; `Root.tsx` derives its compositions; the cut is emitted, not parsed.

## Where things are

```
reel/src/script.ts          the cut: scenes, acts, beat plans, marks
reel/src/actKey.ts          how an act is named (one definition)
reel/src/ramp.ts            buildRamp: beats + plan -> frames
reel/src/captures.ts        the footage contract, and its refusals
reel/src/figures.ts         the shapes walks read off the panel
reel/src/layout.ts          PANEL, STAGES, crops
reel/src/comp/Chapter.tsx   sequences acts; cues marks; draws diagrams
reel/src/comp/Reel.tsx      assembles chapters + furniture
reel/src/comp/cards.ts      CARDS registry
reel/src/pieces/            set pieces + PIECES registry + derived previews
reel/src/diagrams/registry.tsx  DIAGRAMS registry (absorbs showcase/)
reel/src/verbs/             the motion grammar + VERBS table
reel/src/pencil/            the graphite treatment, and the `draw` verb
reel/scripts/               emit-plan, vo-budget, check-vo, measure-vo, sync-theme
.storybook/scripts/capture/ the rig, walks, and the footage judge
.storybook/scripts/reel/    look, draft, identical
```
