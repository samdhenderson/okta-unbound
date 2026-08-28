/**
 * @module reel/comp/Margin
 * @description The reel's two voices, sharing one origin.
 *
 * A tour chapter gets a `note`: one line, low, out of the way. A deep chapter
 * gets a `register`: claim, then evidence, then proof, opening downward as
 * bands. They are deliberately not two designs. Both start at the same left
 * rule and the same baseline, so moving from one to the other reads as the
 * argument *opening out* rather than as a different film.
 *
 * The proof band is the one with a rule attached: every figure it prints was
 * read off the panel during capture, and `figure()` throws rather than let a
 * claim fall back to prose. That is enforced in {@link module:reel/captures},
 * not here, so it cannot be forgotten by a caption that does not use this.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { STAGE, TYPE } from '../theme';

/** Which band of the argument a line belongs to. */
export type Register = 'note' | 'claim' | 'evidence' | 'proof';

/** One line of margin copy. */
export interface Line {
  register: Register;
  text: string;
  /** Composition frame, relative to the chapter, at which it arrives. */
  from: number;
}

interface MarginProps {
  lines: Line[];
  /** Frame pixels the margin occupies. */
  box: { x: number; y: number; width: number };
}

const STYLES: Record<Register, React.CSSProperties> = {
  note: { fontSize: TYPE.body, color: STAGE.ink, fontWeight: 400, lineHeight: 1.45 },
  claim: { fontSize: TYPE.claim, color: STAGE.ink, fontWeight: 600, lineHeight: 1.18 },
  evidence: { fontSize: TYPE.body, color: STAGE.inkDim, fontWeight: 400, lineHeight: 1.5 },
  proof: { fontSize: TYPE.body, color: STAGE.accent, fontWeight: 600, lineHeight: 1.4 },
};

/**
 * Space above each band, so the three read as a descent rather than a list.
 *
 * `note` is not zero: a tour chapter can cue two of them, and with no gap the
 * second ran straight on from the first as one paragraph, which read as a
 * single long sentence rather than as a second remark about a later beat.
 */
const GAP: Record<Register, number> = { note: 22, claim: 0, evidence: 34, proof: 30 };

export const Margin: React.FC<MarginProps> = ({ lines, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.width,
        // The rule every band hangs from. It is the thing the two voices share,
        // and the reason a note and a register are one design.
        borderLeft: `2px solid ${STAGE.rule}`,
        paddingLeft: 34,
      }}
    >
      {lines.map((line) => {
        const age = frame - line.from;
        const enter = spring({ frame: age, fps, config: { damping: 200, mass: 0.6 } });
        // Bands do not leave. A claim that scrolls away takes its evidence's
        // subject with it, and the viewer is left reading a number with no noun.
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        return (
          <div
            key={`${line.register}-${line.text}`}
            style={{
              marginTop: GAP[line.register],
              opacity,
              transform: `translateY(${(1 - enter) * 22}px)`,
              ...STYLES[line.register],
            }}
          >
            {line.register === 'proof' && (
              <span
                style={{
                  display: 'block',
                  fontSize: TYPE.unit,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: STAGE.inkDim,
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                Read off the panel
              </span>
            )}
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
