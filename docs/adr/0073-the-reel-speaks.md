# ADR-0073: The reel speaks

- Status: Proposed
- Date: 2026-09-04
- Amends: [ADR-0045](./0045-capture-thin-compose-in-react.md) §8. Everything else in
  0045 is untouched: capture stays thin, composition still happens in React, and the
  guard ladder in §7 is unchanged in shape. §8's own claim, "It plays silent, and it is
  watched without narration. Anything that needs explaining does not work," is the one
  sentence this record overturns, and it overturns it as a constraint on the picture,
  not as a description of the soundtrack.
- Relates to: [ADR-0053](./0053-a-chapter-is-several-acts-on-one-tab.md) (an act is the
  unit narration is written against, since `chapterLength` is what a script has to fit
  inside)

## Context

`reel/DESIGN-BRIEF.md` calls the film "a silent, unnarrated" product film, twice, and
that was a decision, not an oversight. §8's version of it is stronger: "Anything that
needs explaining does not work." Both sentences were true of a film that had no voice
to explain anything with, and both are now wrong in the specific way that a decided
position stops being an argument once the thing it forbade becomes possible. Sam is
recording narration for the reel. This record decides what that means for the parts of
the film that were built around the assumption it would never happen.

Three of those parts do not survive contact with narration unless something is said
about them on purpose:

**The muted-legibility constraint has no soundtrack to fall back on if it goes.** The
margin marks exist because the film has always had to argue with pictures alone, and a
viewer who mutes a product reveal (most of them, on a feed) has to be the one this film
is built for regardless of what plays if they do not. Adding a voice is not permission
to let the picture assume the voice is on.

**"Two voices, one origin" (§6) is a claim about two things that are not allowed to
disagree, and a third thing that can disagree with both just arrived.** `note` and
`register` both resolve every number they print from `figure()`, which throws if the
capture never read it. A recorded voice has no such throw. Sam can say "forty one
users" on a take where the panel showed thirty eight, and nothing catches it until
someone watches the cut side by side with the manifest.

**Every act's length is a literal, and narration is not exempt from why.** ADR-0053
made `chapterLength` the sum of each act's `buildRamp(...).durationInFrames`, and
`reel/src/pieces/index.ts` explains, for pieces, the reason a length must never be a
computation: `Reel.tsx` builds `CHAPTERS` at module scope, before any composition
renders, so anything on the path to a length that can throw takes the whole studio
down with it instead of failing the one chapter that is actually broken. A narration
duration read from a recorded file is exactly that kind of computation if it is allowed
anywhere near `chapterLength`. The reel cannot let the microphone decide how long a
cut is.

None of these are reasons not to add a voice. They are the three places the existing
argument was written for a film that had no voice, and this record is where each one
gets rewritten for a film that does.

## Decision

### 1. The film is no longer silent, and the muted constraint moves to where it now belongs

Narration is Sam's own recorded voice, not a text-to-speech track and not a licensed
one. `DESIGN-BRIEF.md`'s "silent, unnarrated" is retired as a description of the
finished film.

The argument underneath it is retained in full, aimed at the picture instead of at the
soundtrack: **the picture must still work with the sound off.** Nothing on screen is
allowed to depend on the voice for a claim to land, because a feed autoplay, a phone on
silent and a screen reader are all still real audiences and none of them hear a word of
it. That is why the margin marks stay exactly as they are: every claim the voice makes
out loud is also a line the margin already prints. Narration gets to say more than the
margin does (tone, transition, "and here is the interesting part"), but it may never be
the only place a fact appears.

### 2. Two voices, one origin, now three, held to the same one rule

`note` and `register` (ADR-0045 §6) keep meaning what they meant. Narration joins them
as a third voice under the rule both already follow: **no digit is spoken that is not a
`figure(m, key)` read off a manifest.** A script line that says "forty one" has to cite
the same `figure()` call a caption citing the same number would use, or it does not get
written that way.

This is not enforceable by throwing at render time the way `figure()` already is for
captions, because narration is a recorded voice, not a `figure()` call site. It is
enforced by a new script, `check-vo.mjs`, added to the gate ladder below. Every spoken
line that carries a number is written in `reel/src/vo/script.ts` (or wherever the
script lands, alongside the picture's own script) paired with the `figure()` key it
cites, and the check confirms the key resolves against the chapter's manifest and the
literal digit in the line matches the figure's rendered value. A line that speaks a
number with no cited key fails the check outright; that is the mechanism, not a
convention someone has to remember.

### 3. Record to picture, not picture to record

Act lengths keep coming from `buildRamp` (`reel/src/ramp.ts`), summed per ADR-0053.
Narration is written to fit the time budget an act already has; it never stretches the
cut to fit itself.

The reason is the one `reel/src/pieces/index.ts` already states for why a piece's
frame count is a literal and not a computation, and it applies here without
modification: `reel/src/comp/Reel.tsx` builds `CHAPTERS` at module scope, before any
composition renders, so anything on the path to a chapter's length that can throw
takes the whole studio down instead of failing the one chapter that is actually
broken. A narration duration measured from a recorded `.wav` file is precisely a
measurement on that path if `chapterLength` is allowed to read it, and a missing or
short file would not fail the act that needs re-recording, it would fail the studio.

So the dependency runs one way only. An act's length is decided first, from the ramp,
exactly as ADR-0053 left it. The narration script for that act is then written to fit
inside frames that already exist. If a line does not fit, the line is cut or the act's
plan is re-pitched in `script.ts` the same way ADR-0045 §3 already re-pitches a beat's
speed for a caption that reads too fast, not by asking the audio to run long.

### 4. Where the audio lives, and how its duration reaches the build without becoming a build-time risk

The audio lives at `captures/vo/<act-key>.wav`, under the existing public dir.
`reel/remotion.config.ts` already sets `Config.setPublicDir('../captures')`, and
ADR-0045's reasoning for that is a decision this record reuses rather than reopens: a
second public dir, or a copy step into this one, introduces a third place a clip (or
now a line of narration) can be stale relative to what was actually recorded.
`.storybook/scripts/capture/capture.mjs` only ever writes `<id>.mp4` and `<id>.json` at
the top level of `captures/`, so a `vo/` subdirectory sits entirely outside anything
the shoot writes to and is safe from a Playwright run touching it by accident.

Durations still cannot be read at module-evaluation time for the reason in §3, so they
are measured once, at build time, into a generated literal: `reel/src/vo.generated.ts`,
the same pattern `reel/src/theme.generated.ts` already uses and for the same reason. A
build step (not a render-time call) probes each `.wav`'s length with ffprobe and writes
a plain object literal mapping act key to duration in milliseconds. `CHAPTERS` at
module scope reads that literal, which cannot throw, instead of reading the file, which
can. If a `.wav` is missing or an act key in the manifest has no matching entry, the
generation step fails the build loudly, the same place a missing theme token would,
rather than the studio failing silently at render.

### 5. The gate ladder grows a rung, and it is compensation, not decoration

`reel/` sits outside build, lint, type-check and knip (ADR-0045 §4), and today its only
gates are `tsc --noEmit` and `reel/scripts/check-verbs.mjs`. That is already the least
mechanically guarded part of this repository, and narration is landing directly in it.

`reel/scripts/check-vo.mjs` is the rung that answers for that. It checks two things,
plainly:

- Every spoken figure cites a `figure()` key that exists in the chapter's manifest, and
  the digit in the script line matches what that key actually resolved to (§2).
- Every act referenced by the narration script has a `.wav` under `captures/vo/` and a
  corresponding entry in `vo.generated.ts` (§4), so a script line for an act with no
  recording is caught here rather than surfacing as a silent gap in the finished film.

Stated without softening: narration is landing in the one corner of the repo with no
type-check-shaped safety net beyond `tsc`, and this script is the whole of what stands
between a spoken claim and a film that ships it wrong.

## Consequences

**A re-record is a fourth place a change can land, and it is the one place Sam cannot
fix without a microphone.** A caption is a text edit. A speed is a number in
`script.ts`. A diagram is a hot reload. A line of narration that no longer matches the
cut, or that a figure changed underneath, needs Sam back in front of a microphone
before the fix exists anywhere. Nothing in this record makes that faster; it is named
here so the cost is visible at decision time rather than discovered at the fourth
re-shoot.

**A caption or a line of narration that describes something the panel never showed is
still not mechanically detectable.** `check-vo.mjs` catches a spoken figure that
disagrees with a read figure. It cannot catch a spoken claim about a capability the
footage never demonstrates, the same failure `docs/component-explorer.md` already
records as having shipped twice in caption form. That gap does not close because the
voice arrived; it gets a second way to open. Watching the reel end to end stays part of
review, not a step this rung replaces.

**The muted cut is no longer the only cut, and it is still the one the margin has to
carry alone.** Every review pass now has two legitimate ways to watch the film, and the
margin has to be complete under the harsher of the two.
