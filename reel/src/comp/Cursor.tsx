/**
 * @module reel/comp/Cursor
 * @description The pointer, drawn rather than filmed.
 *
 * The capture records every commanded pointer move and click in fractions of
 * the panel, so the cursor is redrawn here at frame resolution. Two things fall
 * out of that which a captured cursor cannot give: it stays sharp through a
 * crop, and it retimes with the ramp for free, because its position is a
 * function of clip time and the ramp already answers that question.
 *
 * The click ring is deliberately drawn in composition time, not clip time. A
 * click is an instant; if its ripple were retimed it would last four times as
 * long in a slowed beat and vanish in a sped one.
 */
import React from 'react';
import { interpolate } from 'remotion';
import type { PointerStep } from '../captures';
import type { Crop, Rect } from '../layout';
import { PANEL } from '../layout';
import { STAGE } from '../theme';

interface CursorProps {
  pointer: PointerStep[];
  /** Clip-local ms at this composition frame, from the ramp. */
  clipMs: number;
  pose: Rect;
  crop: Crop;
}

/** Where the pointer is at a given clip time, in panel pixels. */
function positionAt(pointer: PointerStep[], ms: number): { x: number; y: number } | null {
  let current: { x: number; y: number } | null = null;
  for (const step of pointer) {
    if (step.at > ms) break;
    if (step.kind === 'move' && step.from && step.to) {
      const span = step.ms ?? 1;
      // Eased, because the driver moves the pointer on an eased path too. A
      // linear redraw over an eased capture drifts visibly at the ends.
      const t = Math.min(1, (ms - step.at) / span);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      current = {
        x: step.from.x + (step.to.x - step.from.x) * eased,
        y: step.from.y + (step.to.y - step.from.y) * eased,
      };
    } else if (step.to) {
      current = step.to;
    }
  }
  return current && { x: current.x * PANEL.width, y: current.y * PANEL.height };
}

/** The most recent click at or before this clip time, and how long ago it was. */
function lastClick(pointer: PointerStep[], ms: number): PointerStep | null {
  let found: PointerStep | null = null;
  for (const step of pointer) {
    if (step.at > ms) break;
    if (step.kind === 'click') found = step;
  }
  return found;
}

export const Cursor: React.FC<CursorProps> = ({ pointer, clipMs, pose, crop }) => {
  const spot = positionAt(pointer, clipMs);
  if (!spot) return null;

  const zoom = pose.width / crop.width;
  const x = pose.x + (spot.x - crop.x) * zoom;
  const y = pose.y + (spot.y - crop.y) * zoom;
  // Off-frame after a crop is a real state, not an error: the walk may click
  // something the camera has moved away from.
  if (x < pose.x - 40 || x > pose.x + pose.width + 40) return null;
  if (y < pose.y - 40 || y > pose.y + pose.height + 40) return null;

  const click = lastClick(pointer, clipMs);
  const sinceClickMs = click ? clipMs - click.at : Infinity;
  // Composition-time ripple: it reads the same however the beat is retimed.
  const ripple = interpolate(sinceClickMs, [0, 420], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rippling = sinceClickMs < 420;

  return (
    <>
      {rippling && (
        <div
          style={{
            position: 'absolute',
            left: x - 46,
            top: y - 46,
            width: 92,
            height: 92,
            borderRadius: '50%',
            border: `3px solid ${STAGE.accent}`,
            opacity: (1 - ripple) * 0.85,
            transform: `scale(${0.35 + ripple * 0.9})`,
          }}
        />
      )}
      <svg
        width={44}
        height={52}
        viewBox="0 0 44 52"
        style={{
          position: 'absolute',
          left: x - 3,
          top: y - 2,
          filter: 'drop-shadow(0 3px 7px rgba(0,0,0,0.55))',
          // A hair of squash on impact. Enough to feel the press at 60fps and
          // not enough to notice as an effect.
          transform: `scale(${rippling ? 0.9 + ripple * 0.1 : 1})`,
          transformOrigin: '4px 3px',
        }}
      >
        <path
          d="M3 2 L3 38 L12 29 L18 43 L25 40 L19 26 L31 25 Z"
          fill="#fff"
          stroke="#12142a"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
