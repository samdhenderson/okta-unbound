/**
 * @module reel/comp/Opening
 * @description How the film introduces itself.
 *
 * The reel used to name the product once, on the end card, at 2:29. Everything
 * before that asked the viewer to work out what they were looking at from the
 * evidence, which is a lot to ask of someone who has not yet been told there is
 * an argument being made.
 *
 * Two parts. A title card that says what this is, and a premise that says what
 * the job is — an admin's-eye account of why anybody would want it, before a
 * single feature is named. Naming features here would be the tour the
 * restructure exists to stop: the film's claim is that the work never leaves the
 * tab, and that claim is worth more stated once, up front, than demonstrated
 * seven times without ever being said.
 *
 * ## It uses the same slide as every chapter
 *
 * A headline and a couple of points, hung off the same left rule, arriving on
 * the same spring. The premise is not a different kind of statement from the
 * ones the chapters make, so it should not look like one. It used to have its
 * own copy of the band code, because the margin's `proof` band stamped
 * `Read off the panel` above itself and nothing here has been read off
 * anything. The stamp is gone, so the duplication can go with it.
 */
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Backdrop } from './Backdrop';
import { Margin } from './Margin';
import { FRAME, INTER, STAGE, TYPE } from '../theme';

/** The title card: the product's name and what it is. */
export const TITLE_FRAMES = 420;

/** The premise: the situation the product is for. */
export const PREMISE_FRAMES = 660;

/** The whole opening, before the first chapter. */
export const OPENING_FRAMES = TITLE_FRAMES + PREMISE_FRAMES;

/**
 * When the headline and its two points arrive, in frames from the premise.
 *
 * Spaced by reading time rather than evenly, and spaced generously: this is the
 * first thing anyone sees and there is no narration to carry them through it.
 * Three and a bit seconds between points is enough to read one and look up.
 */
const BAND_AT = [0, 200, 400] as const;

/** Fade the whole card out over its last beats, so the cut into Home is not hard. */
const useExit = (total: number, over = 26): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [total - over, total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = spring({ frame, fps, config: { damping: 200, mass: 1.2 } });
  const sub = spring({ frame: frame - 22, fps, config: { damping: 200, mass: 1 } });
  const out = useExit(TITLE_FRAMES);

  return (
    <AbsoluteFill style={{ fontFamily: INTER, opacity: out }}>
      <Backdrop focusX={FRAME.width / 2} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1180, textAlign: 'center' }}>
          <div
            style={{
              opacity: open,
              transform: `translateY(${(1 - open) * 26}px)`,
              fontSize: TYPE.chapter,
              fontWeight: 700,
              color: STAGE.ink,
              letterSpacing: -3,
            }}
          >
            Okta Unbound
          </div>
          <div
            style={{
              opacity: sub,
              transform: `translateY(${(1 - sub) * 18}px)`,
              marginTop: 30,
              fontSize: TYPE.body,
              lineHeight: 1.5,
              color: STAGE.inkDim,
            }}
          >
            Group and user admin in a side panel, beside the org you are already signed in to.
          </div>
          <div
            style={{
              opacity: sub,
              transform: `translateY(${(1 - sub) * 18}px)`,
              marginTop: 16,
              fontSize: TYPE.body,
              lineHeight: 1.5,
              color: STAGE.inkDim,
            }}
          >
            No server. Nothing leaves the tab.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Premise: React.FC = () => {
  const out = useExit(PREMISE_FRAMES);
  return (
    <AbsoluteFill style={{ fontFamily: INTER, opacity: out }}>
      <Backdrop focusX={FRAME.width / 2} />
      <Margin
        box={{ x: 340, y: 400, width: 1240 }}
        lines={[
          { kind: 'headline', text: "Nobody's org is clean.", from: BAND_AT[0] },
          {
            kind: 'point',
            text: 'Rules half rolled out. Attributes typed by hand.',
            from: BAND_AT[1],
          },
          {
            kind: 'point',
            text: 'Last quarter\u2019s reorg, still sitting in the data.',
            from: BAND_AT[2],
          },
        ]}
      />
    </AbsoluteFill>
  );
};

export const Opening: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={TITLE_FRAMES}>
      <Title />
    </Sequence>
    <Sequence from={TITLE_FRAMES} durationInFrames={PREMISE_FRAMES}>
      <Premise />
    </Sequence>
  </AbsoluteFill>
);
