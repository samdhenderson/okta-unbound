/**
 * @module reel/diagrams
 * @description The exaggerated layer: figures drawn large, from the capture.
 *
 * Every diagram here takes its numbers from a chapter's `figures` — read off
 * the rendered panel during the shoot — and never from a literal in this file.
 * That is the whole discipline: a diagram is an *enlargement* of something the
 * product already said, so it cannot drift from the product, and a figure that
 * stopped being read fails the render instead of going stale on screen.
 *
 * They are drawn at frame resolution rather than by zooming the capture,
 * because the capture is 840x980 of real pixels and magnifying it only buys
 * blur (see `RENDER_SCALE` in `.storybook/scripts/capture/stage.mjs`). This is
 * where the sharpness the old reel wanted from supersampling actually comes
 * from.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { STAGE, TYPE, COLOR } from '../theme';

/** Where a diagram is allowed to draw, in frame pixels. */
export interface Plot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A plot as CSS.
 *
 * Spreading a `Plot` straight into a style object is the obvious thing and it
 * silently does nothing: `x` and `y` are not CSS properties, so the element
 * keeps `width` and `height` and lands at its static position. The whole
 * diagram layer rendered stacked in the top-left corner for one build that way
 * and looked, at a glance, like the diagrams simply were not there.
 */
const at = (plot: Plot): React.CSSProperties => ({
  position: 'absolute',
  left: plot.x,
  top: plot.y,
  width: plot.width,
  height: plot.height,
});

/** Frames since the diagram arrived, eased once so every part shares a beat. */
function useArrival(from: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - from, fps, config: { damping: 200, mass: 0.9 } });
}

/** A count that lands on its figure rather than appearing at it. */
const Counter: React.FC<{ value: number; t: number; size?: number; color?: string }> = ({
  value,
  t,
  size = TYPE.figure,
  color = STAGE.ink,
}) => (
  <span style={{ fontSize: size, fontWeight: 700, color, letterSpacing: -2, lineHeight: 1 }}>
    {Math.round(interpolate(t, [0, 1], [0, value])).toLocaleString()}
  </span>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: TYPE.unit,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: STAGE.inkDim,
      fontWeight: 600,
      marginTop: 10,
    }}
  >
    {children}
  </div>
);

/**
 * A narrowing, drawn as a descent.
 *
 * The attribute chapter's argument in one picture: 94 members, then 19, then
 * 17, with each step's width proportional to the last. The bars are the point
 * rather than the numbers, because the claim is about *how much* is dropped.
 */
export const Funnel: React.FC<{
  plot: Plot;
  from: number;
  steps: { label: string; value: number }[];
}> = ({ plot, from, steps }) => {
  const t = useArrival(from);
  const top = steps[0]?.value ?? 1;
  return (
    <div style={at(plot)}>
      {steps.map((step, i) => {
        // Each bar waits for the one above it. The stagger is what makes this
        // read as a consequence rather than as three facts.
        const local = interpolate(t, [i * 0.18, i * 0.18 + 0.5], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const width = (step.value / top) * plot.width * local;
        const last = i === steps.length - 1;
        return (
          <div key={step.label} style={{ marginBottom: 34 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <Counter
                value={step.value}
                t={local}
                size={last ? TYPE.figure : 64}
                color={last ? STAGE.accent : STAGE.ink}
              />
              <span style={{ fontSize: TYPE.body, color: STAGE.inkDim }}>{step.label}</span>
            </div>
            <div
              style={{
                marginTop: 12,
                height: last ? 18 : 12,
                width,
                borderRadius: 9,
                background: last ? STAGE.accent : STAGE.rule,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * A set difference, as three counts.
 *
 * The compare chapter's tallies. Not a Venn: two people's group lists overlap
 * in a way no two circles honestly describe, and the panel does not draw one
 * either.
 */
export const Tally: React.FC<{
  plot: Plot;
  from: number;
  entries: { label: string; value: number }[];
}> = ({ plot, from, entries }) => {
  const t = useArrival(from);
  return (
    <div style={{ ...at(plot), display: 'flex', gap: 64 }}>
      {entries.map((entry, i) => {
        const local = interpolate(t, [i * 0.14, i * 0.14 + 0.55], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div key={entry.label} style={{ transform: `translateY(${(1 - local) * 20}px)` }}>
            <Counter value={entry.value} t={local} color={STAGE.accent} />
            <Label>{entry.label}</Label>
          </div>
        );
      })}
    </div>
  );
};

/**
 * A count narrowing to a count, side by side.
 *
 * The lightest of the diagrams, for a tour chapter that has a figure worth
 * showing but not an argument worth building.
 */
export const Ratio: React.FC<{
  plot: Plot;
  from: number;
  before: { label: string; value: number };
  after: { label: string; value: number };
}> = ({ plot, from, before, after }) => {
  const t = useArrival(from);
  const step = interpolate(t, [0.35, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ ...at(plot), display: 'flex', alignItems: 'center', gap: 46 }}>
      <div>
        <Counter value={before.value} t={t} color={STAGE.inkDim} />
        <Label>{before.label}</Label>
      </div>
      <div
        style={{
          fontSize: 58,
          color: STAGE.rule,
          opacity: step,
          transform: `translateX(${(1 - step) * -18}px)`,
        }}
      >
        {'→'}
      </div>
      <div style={{ opacity: step }}>
        <Counter value={after.value} t={step} color={STAGE.accent} />
        <Label>{after.label}</Label>
      </div>
    </div>
  );
};
