# Procedures

Each ends in a look. Do not report a change to the film without having seen a
frame of it.

---

## Add a set piece

A full-frame synthetic composition that plays while the panel is gone.

1. **Write** `reel/src/pieces/<Name>.tsx`. It takes `PieceProps`
   (`id`, `frames`, `plot`, `manifest`, `holds`) and exports its cues and its
   length.
   - Every number it prints comes from `figure(manifest, key)`. Never a literal.
   - **Write the choreography as a tempo sheet, not as frame constants:**

     ```ts
     export const LEDGER_CUES = {
       dock: { verb: 'dock' },
       split: { verb: 'split', gap: 7, hold: 5 },
       rejoin: { frames: 12 },
       out: { verb: 'recede', gap: 4 },
     } as const satisfies Record<string, Cue>;

     const SHEET = tempo(LEDGER_CUES);
     export const LEDGER_FRAMES = SHEET.frames;
     ```

     `gap` is frames (spacing between moves, read against verb budgets of
     13-26); `hold` is seconds (the pause an editor asks for). Cues run in
     declaration order, each starting where the last finished, and `with`
     starts one alongside an earlier one for a second track. Never add up frame
     numbers by hand and never write a pause as the difference between two
     constants - that is the thing the sheet exists to end.

   - **Do not subtract one from the total.** `tempo()` already accounts for a
     verb completing _on_ its last frame; every piece used to carry its own
     `- 1` for this.
   - The length may be `SHEET.frames`. `tempo()` is total - no manifest, no
     figure, no capture - so it is safe on the module-scope length path. A
     length that reads a manifest or a figure is still banned; see
     `pieces/index.ts`.
   - **It draws into the whole frame, not into `plot`.** `PieceProps.plot`
     says "the rectangle to draw into" and only `Placeholder` actually uses it;
     every real piece centres itself in the 1920x1080 frame, because a piece
     plays with the panel gone and the two-zone geometry only exists while the
     panel is on screen. Leave room at the bottom - the existing pieces each
     declare their own `CHROME_BOTTOM = 200`.
   - The backdrop is already behind it in the film.
2. **Register** in `reel/src/pieces/index.ts`:

   ```ts
   '<id>': {
     component: <Name>,
     frames: <NAME>_FRAMES,
     cues: <NAME>_CUES,
     preview: '<capture-id>',
   },
   ```

   `cues` is what lets the cut retune the piece: `pieceFrames()` replays the
   sheet with an act's overrides so `Reel.tsx` can size the act without asking
   the component. Omit it and the piece simply is not tunable.

   The preview composition `piece-<id>` now exists automatically.

   **Set `preview:` to the capture your figures come from.** A preview takes its
   manifest from the first act naming the piece, and no act names a piece you
   have just built. Without `preview:` it falls back to one shared capture,
   `figure()` throws on a key that capture never read, and the preview renders
   as an error page - at exactly the moment you need to look at it. It is a
   preview affordance only: in the film, `Chapter` uses the act's own manifest,
   so the honesty rule stays enforced by the act.

3. **Look**: `npm run reel:look -- piece-<id> --sheet`, then
   `npm run reel:draft -- piece-<id>` to watch it move.
4. **Name it from an act** in `script.ts`, if it belongs in the film:
   ```ts
   { kind: 'piece', piece: '<id>', from: '<capture-id>' },
   ```
   `from` is the footage whose figures it dramatises. It plays none of those
   frames.
5. `npm run reel:plan` — the act changes every downstream length.
6. `npm run reel:vo:targets` — the new act needs a narration budget, and every
   act after it shifted.
7. Add a `### <act-key>` section to `NARRATION.md`, or `check-vo.mjs` will
   report it as unrecorded.

---

## Retune a set piece's pauses

The piece states the pacing it was built at; the cut gets to disagree, without
opening the component.

1. `reel/CUT.generated.md` lists the cues each piece act exposes, under
   **Set piece holds**. Those names are what `holds` accepts.
2. In `script.ts`, on the piece act:
   ```ts
   { kind: 'piece', piece: 'exploded-plates', from: 'users-cause',
     holds: { split: 5, rejoin: 4 } },
   ```
   Seconds, by cue name. A name that is not a cue is ignored rather than
   throwing, because a throw on the length path takes down the whole bundle.
3. `npm run reel:plan` - the act, its chapter, and every chapter after it moved.
4. `npm run reel:vo:targets` - the act's narration budget moved with it.
5. Look: `npm run reel:look -- --at <act-key>`. The `piece-<id>` preview shows
   the same pacing, because it reads the cut's holds too.

Changing the piece's own `hold` in its sheet changes it everywhere; `holds` in
the script changes it for that act. Prefer the script when the reason is
editorial.

---

## Add a diagram

Drawn in the plot beside the panel, cued on a beat.

1. **Write** the component (in `diagrams/` for a bare figure, `showcase/` for a
   rebuilt product surface — the honesty rule reads differently for each).
2. **Register** an adapter in `reel/src/diagrams/registry.tsx`. The adapter
   reads its own figures:
   ```ts
   '<id>': ({ manifest, plot, from }) => (
     <Thing plot={plot} from={from} value={figure<Shape>(manifest, 'key')} />
   ),
   ```
   Shapes live in `reel/src/figures.ts` — add there, do not redeclare locally.
3. **Name it from a mark** in `script.ts`: `diagram: '<id>'`.
4. `npm run reel:plan`, then look:
   `npm run reel:look -- --at <act-key>`

A diagram is drawn into the stage current **when it was cued**, and ends at the
next mark that draws its own diagram or moves the camera.

Two marks needing the same component with different figures are **two
entries**, named for the argument (`inactive-ratio`, `sole-ratio`), not one
entry used twice.

---

## Add or retime a beat

1. The beat must exist in the **footage**: check `captures/<id>.json`'s `beats`.
   A plan naming a beat the manifest lacks fails the render. Adding a genuinely
   new beat is a **walk change**, and that is a re-shoot.
2. Edit the act's `plan` in `script.ts` (`speed`, `easeMs`, `holdMs`), and its
   `marks` for the copy.
3. `npm run reel:plan` — always. Every length downstream moved.
4. `npm run reel:vo:targets` — the narration budget moved with it.
5. Look: `npm run reel:look -- --at <act-key>`; use `reel:draft` if the question
   is about motion.

A retime changes act keys **only** if you add or remove an act — the key
carries the act's index. If it does, the narration WAV filenames change with
it, and `check-vo.mjs` will report the old ones as dead audio.

---

## Add a verb

Two files, and the gate catches the rest.

1. Write `reel/src/verbs/<Name>.tsx`, authored in **absolute composition
   frames**, taking a `from: number`. Drive it with `useVerb(name, from)` and
   `useVerbPart(name, part, from)` - never a hand-rolled `interpolate` over
   frame constants.
2. Add **one entry** to `VERBS` in `verbs/registry.ts`:
   ```ts
   <name>: {
     frames: framesFor('<dur-token>'),   // or a literal the verb table states
     ease: '<curve>',
     parts: { <window>: { at: 0, over: 8 } },   // relative to the verb's start
     stagger: 4,                                 // if it releases children
   },
   ```
   `VerbName` derives from this. A budget without a curve is now impossible.
3. Export it from `verbs/index.ts` and add a `<Row verb="<name>" ...>` to
   `comp/Verbs.tsx`. Each row's _body_ stays hand-written, because each is a
   different component; the heading is derived from the verb name.
4. `npm --prefix reel run check-verbs` fails if you skipped 3, or if a part is
   scheduled past the end of its own verb.
5. Look: `npm run reel:look -- verbs 60`.

A verb that cannot be driven by one `[0,1]` says so in its `compound` field and
reads its own `parts` - `count` is the one that does. `draw` and `convert` stay
in `pencil/` with `PENCIL_FRAMES`, deliberately.

Never wrap a verb's contents in Remotion's `<Sequence>`. See `traps.md`.

---

## Add a chapter

1. The footage has to exist. A new chapter means a new **walk** and a new
   capture — that is the expensive path, and the only one that needs the camera.
   Add the chapter to `CHAPTERS` in `.storybook/scripts/capture/chapters.mjs`
   with its `films` list, write `walks/<id>.mjs`, then `npm run capture <id>`
   and `npm run capture:check`.
2. Add the JSON import and `MANIFESTS` entry in `reel/src/captures.ts`.
3. Add the `Scene` to `SCRIPT`. Every act in it must film the same tab.
4. `npm run reel:plan`, `npm run reel:vo:targets`, add `NARRATION.md` sections.
5. The `chapter-<id>` composition appears automatically.

---

## Re-record narration

1. `npm run reel:vo:targets` — rewrites every `Target:` line from the real cut.
   Never type one.
2. Write the spoken `>` lines in `NARRATION.md`. **No digits** except inside a
   `` `figure:KEY` `` reference; no em or en dashes.
3. Record to `captures/vo/<act-key>.wav`, mono, 48kHz.
4. `npm run reel:vo:measure` then `npm run reel:vo:check`.

The gate fails a recording that runs longer than the picture under it. The film
does not wait for narration.

---

## Refactor the composition without changing the film

1. **Before touching anything**: `npm run reel:identical -- --save <name>`.
2. Make the change.
3. `npm run reel:identical -- --against <name>`.

If the refactor touches something the sample cannot reach — a preview
composition, the `verbs` matrix — the check will pass while proving nothing.
Confirm coverage by deliberately breaking the thing you changed and watching the
check fail. That is the only way to know the result means anything.
