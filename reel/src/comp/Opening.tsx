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
 * ## Why this does not use `Margin`
 *
 * It very nearly does — the premise is three accumulating bands, which is
 * exactly what a chapter's register is. But `Margin`'s `proof` band stamps
 * `Read off the panel` above itself, and that is not decoration: it is the
 * promise `figure()` enforces, that the number beside it came off the panel
 * during capture. Nothing here has been read off anything. There is no panel on
 * screen yet.
 *
 * So the trust line gets `proof`'s weight and colour without `proof`'s stamp,
 * and the honest way to have that is to not reach for the component whose whole
 * job is making that stamp inseparable from that styling. The type scale and the
 * palette are shared from {@link module:reel/theme}, which is where the design
 * language actually lives.
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
import { FRAME, INTER, STAGE, TYPE } from '../theme';

/** The title card: the product's name and what it is. */
export const TITLE_FRAMES = 420;

/** The premise: the situation the product is for. */
export const PREMISE_FRAMES = 660;

/** The whole opening, before the first chapter. */
export const OPENING_FRAMES = TITLE_FRAMES + PREMISE_FRAMES;

/**
 * When each premise band arrives, in frames from the start of the premise.
 *
 * Spaced by reading time rather than evenly. The first band is the longest
 * sentence and lands alone; the second is the consequence of it and can follow
 * closely; the third changes subject, from what the job is to what the tool
 * does about it, so it gets the widest gap in front of it.
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
            Group and user administration in the side panel, beside the org you are already signed
            in to.
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
            The questions you would otherwise take to a script and a spreadsheet, answered without
            leaving the tab.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface BandProps {
  from: number;
  style: React.CSSProperties;
  children: React.ReactNode;
}

/** One premise band, arriving on the same spring the margin's bands use. */
const Band: React.FC<BandProps> = ({ from, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - from, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <div
      style={{
        opacity: interpolate(enter, [0, 1], [0, 1]),
        transform: `translateY(${(1 - enter) * 22}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Premise: React.FC = () => {
  const out = useExit(PREMISE_FRAMES);

  return (
    <AbsoluteFill style={{ fontFamily: INTER, opacity: out }}>
      <Backdrop focusX={FRAME.width / 2} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1240,
            // The same left rule every chapter's margin hangs from, so the film
            // opens in the voice it is going to keep.
            borderLeft: `2px solid ${STAGE.rule}`,
            paddingLeft: 46,
          }}
        >
          <Band
            from={BAND_AT[0]}
            style={{
              fontSize: TYPE.claim,
              fontWeight: 600,
              color: STAGE.ink,
              lineHeight: 1.18,
            }}
          >
            Nobody&rsquo;s org is clean. RBAC was half rolled out, attributes are typed by whoever
            created the account, and last quarter&rsquo;s reorg left values behind that no rule
            agrees with.
          </Band>
          <Band
            from={BAND_AT[1]}
            style={{
              marginTop: 40,
              fontSize: TYPE.body,
              fontWeight: 400,
              color: STAGE.inkDim,
              lineHeight: 1.5,
            }}
          >
            So the job is corrections. Who is missing what, why the rule did not fire, and a list of
            names by Friday.
          </Band>
          <Band
            from={BAND_AT[2]}
            style={{
              marginTop: 38,
              fontSize: TYPE.body,
              fontWeight: 600,
              color: STAGE.accent,
              lineHeight: 1.4,
            }}
          >
            {/* Deliberately not "nothing is exported anywhere": there is a CSV
                export, and the accurate sentence is stronger than the
                approximate one. What is true is that nothing is sent anywhere. */}
            There is no server in this. The panel reads the Okta tab you are signed in to, and
            nothing goes anywhere else.
          </Band>
        </div>
      </AbsoluteFill>
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
