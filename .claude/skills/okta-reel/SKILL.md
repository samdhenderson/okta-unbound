---
name: okta-reel
version: 1.0.0
description: >-
  How to change Okta Unbound's demo reel without reading 15,000 lines first —
  which of the three territories a change lands in (the Playwright capture rig,
  the Remotion composition, the narration), whether it costs a re-shoot, the
  registries a new set piece / diagram / verb / act plugs into, the three-rung
  feedback loop (`reel:look` for a frame, `reel:draft` for motion, `reel` for
  delivery) that replaces rendering a six-minute film to see anything, the
  generated `plan.generated.json` that every build script reads instead of
  parsing the script, and the failure modes that look like success. Use when
  working under `reel/` or `.storybook/scripts/capture/`, when adding or
  retiming a beat, act, chapter or set piece, when building an animated
  component for the film, when narration or VO is involved, when a capture
  needs re-filming, or when asked to "add a beat", "change the reel", "make the
  demo video", "add a scene to the reel", "re-shoot a chapter", "why is the
  reel out of sync", or "add an animation to the demo".
---

# Changing the demo reel

The reel is four separate systems. **Work out which one a change lands in
before opening a file** — that decision determines the cost, the gate, and
whether a camera has to run again.

| Territory                                               | Where                                          | What it costs                                 |
| ------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| **The shoot** — what the camera does in the panel       | `.storybook/scripts/capture/` (rig + 12 walks) | A re-shoot. Minutes, and the footage changes. |
| **The composition** — everything drawn over the footage | `reel/src/`                                    | A render. Nothing is re-filmed.               |
| **The narration** — what is said over it                | `reel/NARRATION.md`, `captures/vo/*.wav`       | A re-record, which only Sam can do.           |
| **The advertisement** — the store page cut              | `reel/src/ad/`, `reel/AD.md`                   | A render. No footage exists or is wanted.     |

The fourth is a separate film sharing the first one's parts. It is nineteen
seconds, entirely synthetic, and lives behind its own Remotion entry
(`reel/src/ad-entry.ts`) precisely so a broken capture cannot take it down with the
reel. **`reel/AD.md` is its one page**; read that instead of these rows when the
task is the ad.

Most requests are the middle one. A slide, a diagram, a set piece, a retime, a
caption, the order of chapters: all composition, no camera. **Nothing under
`reel/` is an input to the capture fingerprint, by design** — so changing the
film is cheap and changing the shoot is not.

## Read the cut before anything else

`reel/CUT.generated.md` is one page: every chapter, act key, runtime, frame
range, beat and diagram placement, generated from the composition itself. It
answers most orientation questions without opening `script.ts` (919 lines).

`reel/plan.generated.json` is the same data for programs. Every build script
reads it. **Regenerate with `npm run reel:plan` after any change to
`script.ts`**; `npm run reel:plan:check` is the gate, and `readCut()` warns when
the plan is older than the script.

## Look at your work — do not render the film to see a frame

Three rungs. Use the cheapest that answers the question.

```
npm run reel:look -- --list                 what exists: compositions + act keys
npm run reel:look -- --at users-fix-3       ~15s  contact sheet of one act
npm run reel:look -- --at users-fix-3 200   ~2s   one still, 200 frames into it
npm run reel:look -- chapter-users 2663     ~2s   one still, by composition+frame
npm run reel:look -- piece-coverage-bars --sheet   a set piece, before it is cut in
npm run reel:draft -- piece-coverage-bars    ~3s   any composition as video
npm run reel:draft -- --at piece-ledger-4    ~3s   one act as video
npm run reel                                mins  the delivery encode
```

`--at <act-key>` renders out of that act's own **chapter** composition, not the
reel: 1,271 frames instead of 22,162. Output lands in the gitignored
`reel/out/`. Read the PNG it prints — a contact sheet answers a pacing question
in one image instead of a scrub.

A still cannot show a transition and a sheet cannot show motion. If the question
is about movement, go up a rung.

## The registries — where a new thing plugs in

Everything the film can draw is addressed by a string id. **Adding one is the
component file plus one registry entry; nothing else.** Previews are derived, so
a registered thing is immediately viewable in the studio.

| To add…                               | Write                                                | Register in                                                          | Then                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A set piece (full-frame, panel gone)  | `reel/src/pieces/<Name>.tsx` + a `tempo()` sheet     | `pieces/index.ts` → `PIECES`, with `cues` and `preview: '<capture>'` | name it from an act: `{ kind: 'piece', piece: '<id>', from: '<capture>' }`; retune with `holds: { <cue>: <seconds> }`                                    |
| A diagram (drawn beside the panel)    | a component + an adapter entry                       | `diagrams/registry.tsx` → `DIAGRAMS`                                 | name it from a mark: `diagram: '<id>'`                                                                                                                   |
| A card (opening, seam, end furniture) | `reel/src/comp/<Name>.tsx` + a props-free `*Preview` | `comp/cards.ts` → `CARDS`                                            | placed by `Reel.tsx`/`Chapter.tsx`, never by the script                                                                                                  |
| A verb (reusable motion primitive)    | `reel/src/verbs/<Name>.tsx`                          | one row in `reel/src/verbs/registry.ts` → `VERBS`, budget included   | `verbs/ease.ts` → `FRAMES` is a derived _view_ over that table, never edited by hand; add a row to `comp/Verbs.tsx` by hand — that matrix is not derived |
| A beat or act                         | —                                                    | `reel/src/script.ts`                                                 | `npm run reel:plan`, then `npm run reel:vo:targets`                                                                                                      |
| A stab (one shot of the ad)           | `reel/src/ad/stabs/<Name>.tsx` + a `tempo()` sheet   | `ad/stabs/index.ts` → `STABS`                                        | name it from `ad/script.ts`; look with `npm run ad:look -- stab-<id> --sheet`. See `reel/AD.md`                                                          |

**A piece's length is a literal, never a computation.** `Reel.tsx` resolves every
act's length at module scope, so anything on that path that can throw —
`capture()`, `figure()` — takes down the whole bundle instead of one
composition.

## The honesty rule

Every number on screen comes from `figure(manifest, key)`, which throws if the
walk never read that key off the live panel. **Never type a figure into the
script, a diagram, a piece, or the narration.** A diagram that wants a number
the walk did not record is a walk that needs to record it — which is a re-shoot.

## Detail

@references/architecture.md — the three territories, the capture→manifest→composition contract, and the six rules the whole system rests on.
@references/authoring.md — step-by-step procedures: add a beat, an act, a piece, a diagram, a verb; retime; re-record.
@references/traps.md — the failure modes that look like success. Read this before trusting a green result.
@references/gates.md — every gate, what it catches, and what a red one means.

## Before saying it works

- `npm --prefix reel run type-check` — `reel/` is eslint-ignored, so `tsc` is
  its only static gate, and it does **not** set `noUnusedLocals`.
- `npm run reel:plan:check` — the cut is in sync.
- `npm run reel:vo:check` — the narration gate. It currently fails with **15
  "no narration recorded"**; that is the known state (no WAVs recorded yet), not
  your change. Any other failure is.
- `npm run reel:identical -- --against <baseline>` — for a refactor that must
  not move the picture. Save a baseline **before** you start.
