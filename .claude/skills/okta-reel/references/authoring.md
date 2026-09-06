# Procedures

Each ends in a look. Do not report a change to the film without having seen a
frame of it.

---

## Add a set piece

A full-frame synthetic composition that plays while the panel is gone.

1. **Write** `reel/src/pieces/<Name>.tsx`. It takes `PieceProps`
   (`id`, `frames`, `plot`, `manifest`) and exports a `<NAME>_FRAMES` literal.
   - Every number it prints comes from `figure(manifest, key)`. Never a literal.
   - Export the frame budget as a **literal**, never a computation — see the
     module doc on `pieces/index.ts` for why a throw on that path kills the
     whole bundle.
   - It draws into `plot`; the backdrop is already behind it in the film.
2. **Register** in `reel/src/pieces/index.ts`:
   ```ts
   '<id>': { component: <Name>, frames: <NAME>_FRAMES },
   ```
   The preview composition `piece-<id>` now exists automatically.
3. **Look**: `npm run reel:look -- piece-<id> --sheet`
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

1. Write `reel/src/verbs/<Name>.tsx`, authored in **absolute composition
   frames**, taking a `from: number`.
2. Add its frame budget to `FRAMES` in `verbs/ease.ts`.
3. Add one entry to `VERBS` in `verbs/useVerb.ts`:
   `<name>: { frames: FRAMES.<name>, ease: EASING.<curve> }`.
   `VerbName` derives from the table.
4. Export it from `verbs/index.ts`.
5. Add a row to `comp/Verbs.tsx` **by hand** — that demo matrix is deliberately
   not derived, because each row's body is a different component.
6. Look: `npm run reel:look -- verbs --sheet`.

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
