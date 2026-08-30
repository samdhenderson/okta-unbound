/**
 * @module reel/comp/Margin
 * @description A slide beside the panel: one headline, a few short points.
 *
 * The reel is silent and it moves, so the copy has one job — say what this
 * moment is about, in the time it takes to glance away from the panel and back.
 * That is a slide, not an essay. A headline states the question the beat
 * answers; under it go at most a few points, each short enough to be taken in
 * whole rather than read.
 *
 * ## What this replaced, and why
 *
 * The margin used to carry four "registers" (note, claim, evidence, proof) whose
 * bands accumulated down a chapter and never left, and every proof band stamped
 * `Read off the panel` above itself. Two problems, both fatal at speed. The
 * bands stacked, so by the end of a chapter there were six lines on screen and
 * the newest was at the bottom. And the stamp was provenance addressed to the
 * people building the film rather than to anyone watching it, repeated eight
 * times. The guarantee it named is real and still enforced — `figure()` throws
 * rather than print a number nobody read off the panel — it just does not need
 * saying on camera.
 *
 * So: slides replace, they do not accumulate. A headline clears what came
 * before it, which is what makes the pause in front of it legible as "here is a
 * new thing" rather than as "here is more of the same thing".
 *
 * ## Figures inside a point
 *
 * A point that begins with a number gets that number lifted — brighter and
 * heavier than the words after it. No authoring ceremony, no second field: write
 * `28 groups no rule fills` and the `28` carries. It means the eye finds the
 * figure before it has finished reading the line, which at this pace is the
 * whole difference between a point landing and a point being missed.
 */
import React from 'react';
import { STAGE, TYPE } from '../theme';
import { Dock } from '../verbs';

/** One line of a slide. */
export interface Line {
  /** A headline starts a new slide; a point is added to the running one. */
  kind: 'headline' | 'point';
  text: string;
  /** Composition frame, relative to the chapter, at which it arrives. */
  from: number;
}

interface MarginProps {
  lines: Line[];
  /** Frame pixels the margin occupies. */
  box: { x: number; y: number; width: number };
}

/**
 * A leading figure, split off so it can be set apart from its words.
 *
 * Deliberately only *leading*. A number in the middle of a sentence is being
 * used as prose and lifting it there would be decoration; a number at the front
 * is the point of the line.
 */
const splitFigure = (text: string): [string, string] => {
  const match = /^(\d[\d,]*)(\s.*)$/.exec(text);
  return match ? [match[1]!, match[2]!] : ['', text];
};

/**
 * How long a slide's line takes to arrive: 35 frames, not the verb table's 22.
 *
 * This margin used to animate on a hand-rolled Remotion spring - `damping:
 * 200`, `mass: 0.6` - and every `holdMs`/`tailMs` in `script.ts` was tuned by
 * eye against it, against copy that had visibly stopped moving somewhere around
 * half a second in. Remotion's own `measureSpring` puts that spring's settle at
 * **35 frames** at 60fps (it crosses 90% at f=18, 95% at f=22, 99% at f=31).
 * Docking in the verb's default 22f would land every line 10 to 15 frames
 * early in all nine chapters at once, which would not read as a bug - it would
 * read as a film that is slightly rushed everywhere, with nothing to point at.
 *
 * So the curve is the grammar's and the duration is the one the script was
 * written against. `dock` takes a `frames` override precisely so a caller can
 * say this out loud; a verb with an explicit frame count is still the verb, and
 * the point of the migration is one shared curve and one shared vocabulary
 * rather than one shared duration. Retiming the slides is a `script.ts` change,
 * and a deliberate one, not a side effect of swapping a curve.
 *
 * `entrance` at 35f tracks that spring's whole tail to within about a frame at
 * every threshold that matters (90% at f=18, 95% at f=23, 99% at f=29). The
 * head differs and is meant to: `dock` is front-loaded and reaches full opacity
 * inside its first 8f, so a line is legible sooner than it used to be while
 * still travelling the same distance over the same window.
 */
const ARRIVAL_FRAMES = 35;

const Headline: React.FC<{ line: Line }> = ({ line }) => (
  // `edge="down"` and `rule={false}` are both deliberate. The slide's lines
  // rise into place rather than arriving from the left, because the left edge
  // here is already occupied by the margin's own 2px rule - the thing the whole
  // slide hangs from - and docking copy through it would read as the copy
  // crossing the rule rather than settling against it. For the same reason
  // there is no accent hairline under each line: the rule beside them is the
  // margin's only rule, and a second one per line would be seven of them.
  <Dock from={line.from} edge="down" distance={20} frames={ARRIVAL_FRAMES} rule={false}>
    <div
      style={{
        fontSize: TYPE.claim,
        fontWeight: 600,
        color: STAGE.ink,
        lineHeight: 1.15,
        letterSpacing: -0.5,
      }}
    >
      {line.text}
    </div>
  </Dock>
);

const Point: React.FC<{ line: Line }> = ({ line }) => {
  const [figure, rest] = splitFigure(line.text);
  return (
    // A point travels 14px where a headline travels 20 - the same relationship
    // the hand-rolled version had, kept because it is the slide's hierarchy
    // rather than an accident: the thing that starts the slide moves further
    // than the things that join it.
    <Dock
      from={line.from}
      edge="down"
      distance={14}
      frames={ARRIVAL_FRAMES}
      rule={false}
      style={{ marginTop: 26 }}
    >
      <div style={{ display: 'flex', gap: 18 }}>
        <span
          style={{
            flex: 'none',
            width: 9,
            height: 9,
            marginTop: 14,
            borderRadius: 2,
            background: STAGE.accent,
          }}
        />
        <span style={{ fontSize: TYPE.body, color: STAGE.inkDim, lineHeight: 1.45 }}>
          {figure && <span style={{ color: STAGE.ink, fontWeight: 700 }}>{figure}</span>}
          {rest}
        </span>
      </div>
    </Dock>
  );
};

export const Margin: React.FC<MarginProps> = ({ lines, box }) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.width,
      // The rule the slide hangs from. The opening hangs from the same one, so
      // the film starts in the voice it keeps.
      borderLeft: `2px solid ${STAGE.rule}`,
      paddingLeft: 34,
    }}
  >
    {lines.map((line, i) =>
      line.kind === 'headline' ? (
        <Headline key={`${i}-${line.text}`} line={line} />
      ) : (
        <Point key={`${i}-${line.text}`} line={line} />
      ),
    )}
  </div>
);
