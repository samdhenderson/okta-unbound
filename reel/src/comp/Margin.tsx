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
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { STAGE, TYPE } from '../theme';

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

/** Arrival: the same spring everywhere, so nothing has its own idea of timing. */
const useArrival = (from: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - from, fps, config: { damping: 200, mass: 0.6 } });
};

const Headline: React.FC<{ line: Line }> = ({ line }) => {
  const enter = useArrival(line.from);
  return (
    <div
      style={{
        opacity: interpolate(enter, [0, 1], [0, 1]),
        transform: `translateY(${(1 - enter) * 20}px)`,
        fontSize: TYPE.claim,
        fontWeight: 600,
        color: STAGE.ink,
        lineHeight: 1.15,
        letterSpacing: -0.5,
      }}
    >
      {line.text}
    </div>
  );
};

const Point: React.FC<{ line: Line }> = ({ line }) => {
  const enter = useArrival(line.from);
  const [figure, rest] = splitFigure(line.text);
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        marginTop: 26,
        opacity: interpolate(enter, [0, 1], [0, 1]),
        transform: `translateY(${(1 - enter) * 14}px)`,
      }}
    >
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
