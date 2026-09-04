/**
 * A deliberate, hand-kept-in-sync port of `buildRamp`'s frame arithmetic from
 * `src/ramp.ts`, for build scripts that cannot import it.
 *
 * `src/ramp.ts` is a `.ts` module reached only through `script.ts`'s import
 * graph, and Node's ESM loader cannot resolve that graph's extensionless
 * relative imports without a custom loader. That is the same constraint
 * documented on `balanced.mjs` and `parse-script.mjs`. So this reimplements
 * the one piece of `buildRamp` the VO tooling actually needs: how long each
 * planned beat runs, in composition frames, given a manifest's beats and a
 * plan's speeds, holds, eases and tails. **This must be updated by hand if
 * `buildRamp` changes.** There is no mechanical link between the two files.
 * What is deliberately dropped: `frameAtClipMs` and `clipMsAt`, the two
 * closures that answer "what
 * frame is this clip moment at" for `after`-cued marks. Neither a VO budget
 * nor the VO gate cares where inside a beat something lands, only how long the
 * beat itself runs, so porting them would be complexity with no reader.
 *
 * @module
 */

/** Multipliers on natural speed. Mirrors `SPEED` in `src/ramp.ts` exactly. */
const SPEED = {
  dwell: 0.35,
  half: 0.5,
  natural: 1,
  brisk: 1.6,
  sprint: 2.6,
  blur: 4.5,
};

/** How many constant-rate slices a rate change is spread across. Mirrors `src/ramp.ts`. */
const EASE_STEPS = 7;

const round = (n) => Math.max(1, Math.round(n));

/**
 * Build a chapter's ramp, frame-accurately, but reporting only per-beat
 * durations and the act's total: the subset `vo-budget.mjs` and
 * `check-vo.mjs` need.
 *
 * @param {{ beats: { name: string, at: number, endAt: number }[], retime: number, fps: number }} manifest
 * @param {{ beat: string, speed: string, easeMs?: number, holdMs?: number, tailMs?: number }[]} plan
 * @param {number} fps The composition's frame rate.
 * @returns {{ cues: Record<string, { from: number, durationInFrames: number }>, durationInFrames: number }}
 * @throws when the plan names a beat the manifest never recorded. That is the
 *   same refusal `buildRamp` makes, for the same reason: a silent skip would
 *   report a budget for a chapter shorter than the one that actually renders.
 */
export function buildRampLite(manifest, plan, fps) {
  const byName = new Map(manifest.beats.map((b) => [b.name, b]));
  const missing = plan.filter((p) => !byName.has(p.beat)).map((p) => p.beat);
  if (missing.length > 0) {
    throw new Error(
      `${manifest.id}: plan names beats that were never filmed: ${missing.join(', ')}. ` +
        `Filmed: ${manifest.beats.map((b) => b.name).join(', ')}`,
    );
  }

  const cues = {};
  let out = 0;
  let previousRate = SPEED.natural * manifest.retime;

  // Mirrors `push` in `src/ramp.ts`: advance `out` by one constant-rate slice.
  const push = (clipMs, clipMsEnd, rate) => {
    const clipFrames = ((clipMsEnd - clipMs) / 1000) * manifest.fps;
    if (clipFrames <= 0) return;
    out += round(clipFrames / rate);
  };

  for (const entry of plan) {
    const beat = byName.get(entry.beat);
    const beatFrom = out;

    if (entry.holdMs) {
      out += round((entry.holdMs / 1000) * fps);
    }

    if (entry.speed === 'freeze') {
      cues[entry.beat] = { from: beatFrom, durationInFrames: out - beatFrom };
      continue;
    }

    const rate = SPEED[entry.speed] * manifest.retime;
    const span = beat.endAt - beat.at;
    const ease = Math.min(entry.easeMs ?? 0, span);

    if (ease > 0 && previousRate !== rate) {
      for (let i = 0; i < EASE_STEPS; i += 1) {
        const t = (i + 0.5) / EASE_STEPS;
        const stepRate = previousRate + (rate - previousRate) * t;
        push(beat.at + (ease * i) / EASE_STEPS, beat.at + (ease * (i + 1)) / EASE_STEPS, stepRate);
      }
    }
    push(beat.at + ease, beat.endAt, rate);
    previousRate = rate;

    if (entry.tailMs) {
      out += round((entry.tailMs / 1000) * fps);
    }

    cues[entry.beat] = { from: beatFrom, durationInFrames: out - beatFrom };
  }

  return { cues, durationInFrames: out };
}
