# Failure modes that look like success

Every entry here has actually happened in this repo. They share a shape: the
tool reports success, and the success is about something other than what you
changed.

## A verb wrapped in `<Sequence>` free-runs, silently

Every verb is authored in **absolute composition frames**. Remotion's
`<Sequence>` remaps `useCurrentFrame()` to start at 0 inside it, so a verb
inside one tracks its own clock instead of `from`. Nothing throws; the child
renders its **first pose for the entire shot**. If a verb looks frozen, look
for a `<Sequence>` above it. To start a verb later, pass a later `from` — that
is the whole mechanism.

## `defaultProps` silently drops functions

Remotion serialises a `<Composition>`'s `defaultProps` to JSON, so functions
and non-JSON values vanish without warning. This is why pieces are addressed by
**string id** and previews are **props-free wrappers**. A component handed
through a composition as a value arrives missing.

## A hand-kept list beside a registry falls behind

`Root.tsx` listed preview compositions as tuples while `PIECES` grew past it.
Two of the four registered set pieces had no preview, so the two most likely to
be under construction were the two nobody could look at. Nothing failed.
Registries are derived now — keep it that way; do not add a second list.

Related: both hand-written piece previews passed `id="placeholder"`, copied from
whichever was written first, so both handed a piece the wrong name for itself.

## A frame check that never rendered what you changed

The frame-identity check sampled three frames per act. A deliberate break in
`roster-tally` was caught; an identical break in `factor-ladder` was **missed
entirely**, because `reporting-2` runs 2,050 frames, the samples landed on
4125/4809/5492, and the `breakdown` beat that draws the ladder runs 4937–5232.
It reported "frame-identical" about a diagram it had never rendered.

It samples **per beat** now, which covers every cued visual by construction.
The general lesson stands: **a passing check whose coverage you have not
verified is not evidence.** Break the thing on purpose and watch it fail.

## A generated file the formatter fights

`CUT.generated.md` was written unformatted, prettier reformatted it on commit,
and `--check` then failed forever against output it could not reproduce.
Generated files are formatted with `prettier.resolveConfig` **before writing** —
`measure-vo.mjs` and `sync-theme.mjs` document the same rule. A bare
`prettier.format()` does not read `.prettierrc` and reintroduces the bug.

## A partial write that reports success

`vo-budget --write` matched `^###\s+(\S+)\s*$`, which only fits headings with
no label. It rewrote **6 of 15** target lines and printed a success message.
Anchoring to end-of-line missed every `### users-gap-0 (The gap)`.

## Hand-copied numbers go stale without failing anything

`NARRATION.md`'s `Target:` lines were copied by hand; four of fifteen had
drifted, one budgeting 21.72s for an act that runs 27.65s. `SCRIPT.md` claimed
~3:52 while `DESIGN-BRIEF.md` claimed ~6:09 for the same film; the truth was
6:09. Nothing was red. **Never type a number a program can derive** — run
`npm run reel:plan` and `npm run reel:vo:targets`.

## `tsc` stays green over an unused import

`reel/` is **eslint-ignored** and its tsconfig does **not** set
`noUnusedLocals`. Deleting a component leaves its imports behind and every gate
still passes. Check imports by hand after removing anything.

## A throw on the length path kills the whole studio

`Reel.tsx` builds its chapter table at **module scope**, so every act's length
resolves while the bundle evaluates. `capture()` and `figure()` throw by
design. Anything that can throw on the way to a length takes down the entire
bundle — one error page instead of the compositions that were fine. This is why
a piece's frame count is a literal.

## A forgotten `films` entry makes a clip immortal

Capture fingerprints hash the transitive reach of each tab in a chapter's
`films` list. `explorer` is reached via ⌘K, which is not static reach, so its
entry is **unenforced**. Omitting a tab there does not break the fingerprint —
it stops the chapter from ever noticing that tab changed, so the clip is never
re-shot. Nothing reports this.

## A stale plan answers confidently about the wrong cut

`plan.generated.json` is committed. If `script.ts` moves without it, every tool
keeps working and describes the previous cut. `readCut()` warns on mtime, and
`npm run reel:plan:check` is the gate — but the warning is easy to scroll past.
Regenerate after any script change.

## The narration gate is already red

`npm run reel:vo:check` currently fails with **15 "no narration recorded"**,
because no WAVs exist yet. That is the project's known state. Do not "fix" it,
and do not read it as caused by your change — but do check the count is still
15 and the failures are still all of that kind.
