/**
 * @module reel/comp/EndCard
 * @description The close.
 *
 * The product's name and two lines. Deliberately not a feature list: everything
 * worth listing was just shown, and a reel that ends by summarising itself is
 * telling the viewer it did not trust the previous four minutes.
 *
 * The close used to reprint the description that opens the film. It pays off
 * the through-line instead: what the film did to somebody's API limits, and
 * where the data went. Both mean nothing cold and everything after four minutes
 * of watching an org get read, compared, scanned and corrected without a single
 * tab change.
 */
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop } from './Backdrop';
import { FRAME, INTER, STAGE, TYPE } from '../theme';

export const END_CARD_FRAMES = 150;

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = spring({ frame, fps, config: { damping: 200, mass: 1.2 } });
  const out = interpolate(frame, [END_CARD_FRAMES - 26, END_CARD_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ fontFamily: INTER, opacity: out }}>
      <Backdrop focusX={FRAME.width / 2} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: open, transform: `translateY(${(1 - open) * 26}px)` }}>
          <div
            style={{
              fontSize: TYPE.chapter,
              fontWeight: 700,
              color: STAGE.ink,
              letterSpacing: -3,
              textAlign: 'center',
            }}
          >
            Okta Unbound
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: TYPE.body,
              color: STAGE.inkDim,
              textAlign: 'center',
              maxWidth: 820,
            }}
          >
            Fetches data only on demand, to respect your API limits.
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: TYPE.body,
              color: STAGE.inkDim,
              textAlign: 'center',
              maxWidth: 820,
            }}
          >
            No servers. Nothing left the tab.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
