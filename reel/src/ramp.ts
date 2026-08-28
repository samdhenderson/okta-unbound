/**
 * @module reel/ramp
 * @description Map composition frames onto captured clip frames at a chosen speed.
 *
 * This is the piece that makes speed ramping real rather than decorative, and
 * it only works because of a decision made at capture time: every clip was
 * filmed `manifest.retime` times slower than life (`stage.mjs`). Playing it
 * back at `retime` restores natural speed, and every rate below that is genuine
 * slow motion with real frames behind it. Post cannot invent frames; the only
 * reason there is anything to stretch is that the shoot was slowed first.
 *
 * ## How it is built
 *
 * A chapter's manifest carries beats in clip-local ms. An editorial plan
 * assigns each beat a {@link Speed}. Beats are then walked in order and turned
 * into constant-rate segments, each of which the composition renders as its own
 * `<Sequence>` wrapping an `<OffthreadVideo trimBefore playbackRate>`. Remotion
 * resolves that to an exact source frame, so the whole ramp is frame-accurate
 * with no resampling of our own.
 *
 * A rate *change* is subdivided rather than cut: `EASE_STEPS` short segments
 * with interpolated rates across `easeMs`, which reads as a ramp instead of a
 * gear change. Constant-rate pieces stay single segments, so a chapter costs a
 * handful of sequences rather than one per frame.
 */
import type { Manifest } from './captures';

/**
 * A beat's playback speed, named relative to how the product actually behaves.
 *
 * These are multipliers on *natural* speed, not on the file. `natural` resolves
 * to `manifest.retime`, so the arithmetic stays right if the shoot is ever
 * retimed differently.
 */
export type Speed = 'freeze' | 'dwell' | 'half' | 'natural' | 'brisk' | 'sprint' | 'blur';

/** Multipliers on natural speed. `freeze` is handled separately — it consumes no clip. */
const SPEED: Record<Exclude<Speed, 'freeze'>, number> = {
  dwell: 0.35,
  half: 0.5,
  natural: 1,
  brisk: 1.6,
  sprint: 2.6,
  blur: 4.5,
};

/** How many constant-rate slices a rate change is spread across. */
const EASE_STEPS = 7;

/** Editorial direction for one beat. */
export interface BeatPlan {
  /** The beat's name in the manifest. A plan naming a beat that is not there throws. */
  beat: string;
  /** How fast to play it. */
  speed: Speed;
  /** Ms of composition time to ease into this speed from the previous one. */
  easeMs?: number;
  /** Ms of composition time to hold the beat's first frame before it plays. */
  holdMs?: number;
  /**
   * Ms of composition time to hold this beat's *last* frame after it plays.
   *
   * {@link holdMs} is the general tool and it is enough everywhere but one
   * place: a chapter's final state has no successor to hold it, so the cut
   * landed the instant the last transition finished and the finding the whole
   * chapter was built to reach was on screen for no frames at all. This is that
   * missing pause. It is deliberately not "always add a tail" — how long a
   * chapter rests on its conclusion is editorial, and a chapter that ends on a
   * move wants none.
   */
  tailMs?: number;
}

/** One constant-rate slice of a chapter. */
export interface Segment {
  /** Source frame the slice starts at. */
  trimBefore: number;
  /** Composition frame the slice starts at, relative to the chapter. */
  from: number;
  /** How long the slice occupies the composition. */
  durationInFrames: number;
  /** Source frames consumed per composition frame. 0 freezes. */
  playbackRate: number;
}

/** A chapter's clip, retimed. */
export interface Ramp {
  segments: Segment[];
  durationInFrames: number;
  /** Which composition frame each beat begins at, for cueing the margin. */
  cues: Record<string, { from: number; durationInFrames: number }>;
  /** Clip ms at a given composition frame, for cueing anything read from the clip. */
  clipMsAt: (frame: number) => number;
}

const round = (n: number) => Math.max(1, Math.round(n));

/**
 * Build a chapter's ramp.
 *
 * @param manifest The capture to retime.
 * @param plan One entry per beat to include, in reel order. Beats the plan does
 *   not name are dropped from the reel entirely — which is the intended way to
 *   cut a chapter down, since it removes the footage rather than hiding it.
 * @param fps The composition's frame rate.
 * @throws when a plan names a beat the capture does not contain. A silent skip
 *   there produces a chapter that is subtly shorter than intended and looks
 *   fine, which is the failure mode this whole system is built to refuse.
 */
export function buildRamp(manifest: Manifest, plan: BeatPlan[], fps: number): Ramp {
  const byName = new Map(manifest.beats.map((b) => [b.name, b]));
  const missing = plan.filter((p) => !byName.has(p.beat)).map((p) => p.beat);
  if (missing.length > 0) {
    throw new Error(
      `${manifest.id}: plan names beats that were never filmed: ${missing.join(', ')}. ` +
        `Filmed: ${manifest.beats.map((b) => b.name).join(', ')}`,
    );
  }

  const segments: Segment[] = [];
  const cues: Ramp['cues'] = {};
  /** Composition frames used so far. */
  let out = 0;
  /** The rate the previous slice ended on, so an ease has somewhere to start. */
  let previousRate = SPEED.natural * manifest.retime;

  const push = (clipMs: number, clipMsEnd: number, rate: number) => {
    const clipFrames = ((clipMsEnd - clipMs) / 1000) * manifest.fps;
    if (clipFrames <= 0) return;
    const durationInFrames = round(clipFrames / rate);
    segments.push({
      trimBefore: Math.round((clipMs / 1000) * manifest.fps),
      from: out,
      durationInFrames,
      playbackRate: rate,
    });
    out += durationInFrames;
  };

  for (const entry of plan) {
    const beat = byName.get(entry.beat)!;
    const beatFrom = out;

    if (entry.holdMs) {
      const frames = round((entry.holdMs / 1000) * fps);
      segments.push({
        trimBefore: Math.round((beat.at / 1000) * manifest.fps),
        from: out,
        durationInFrames: frames,
        // Zero, not a tiny number: a frozen frame must be the *same* frame for
        // its whole hold, or the pause shimmers.
        playbackRate: 0,
      });
      out += frames;
    }

    if (entry.speed === 'freeze') {
      cues[entry.beat] = { from: beatFrom, durationInFrames: out - beatFrom };
      continue;
    }

    const rate = SPEED[entry.speed] * manifest.retime;
    const span = beat.endAt - beat.at;
    const ease = Math.min(entry.easeMs ?? 0, span);

    if (ease > 0 && previousRate !== rate) {
      // Subdivide the transition so the speed *arrives* rather than switches.
      // Each slice is constant-rate, which is what keeps this frame-exact.
      for (let i = 0; i < EASE_STEPS; i += 1) {
        const t = (i + 0.5) / EASE_STEPS;
        const stepRate = previousRate + (rate - previousRate) * t;
        push(beat.at + (ease * i) / EASE_STEPS, beat.at + (ease * (i + 1)) / EASE_STEPS, stepRate);
      }
    }
    push(beat.at + ease, beat.endAt, rate);
    previousRate = rate;

    if (entry.tailMs) {
      const frames = round((entry.tailMs / 1000) * fps);
      segments.push({
        // The frame *before* the beat's end. `endAt` on the last beat is the
        // clip's own end, and a `trimBefore` one frame past the final frame
        // resolves to nothing at all: the tail renders black.
        trimBefore: Math.max(0, Math.round((beat.endAt / 1000) * manifest.fps) - 1),
        from: out,
        durationInFrames: frames,
        playbackRate: 0,
      });
      out += frames;
    }

    // Measured after the tail so the margin's cue covers the pause. A caption
    // that vanished while the frame it explains was still held would be worse
    // than no pause at all.
    cues[entry.beat] = { from: beatFrom, durationInFrames: out - beatFrom };
  }

  const clipMsAt = (frame: number): number => {
    let carried = 0;
    for (const segment of segments) {
      if (frame < segment.from + segment.durationInFrames) {
        const into = Math.max(0, frame - segment.from);
        return ((segment.trimBefore + into * segment.playbackRate) / manifest.fps) * 1000;
      }
      carried = segment.trimBefore + segment.durationInFrames * segment.playbackRate;
    }
    return (carried / manifest.fps) * 1000;
  };

  return { segments, durationInFrames: out, cues, clipMsAt };
}
