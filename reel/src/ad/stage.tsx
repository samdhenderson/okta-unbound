/**
 * @module reel/ad/stage
 * @description How the rebuilt panel is presented, and the ad's own furniture.
 *
 * Two jobs, and the first one is the important one.
 *
 * **Keeping the panel unmistakably a diagram.** `ui.tsx` rebuilds the product's
 * surface accurately on purpose, which is exactly what would let it pass for a
 * recording if it were ever cut flat against the frame. It is not: {@link Stage}
 * puts it on the film's own dark backdrop, {@link PanelPlate} tilts it, lifts it
 * on a shadow no browser casts and scales it past life size, and the stabs act
 * on its parts with verbs. The viewer is never looking at a window; they are
 * looking at an object being explained. That is ADR-0045's fourth rule kept by
 * construction rather than by good intentions.
 *
 * **Getting close enough to read.** A side panel is a tall narrow thing and an
 * ad is a wide short one. Showing the whole panel means type too small to read
 * on a phone, so every stab picks a region instead: {@link PanelPlate}'s `focus`
 * scales up and translates so a chosen band of the panel sits in the middle of
 * the frame. The panel is still whole and still consistent between stabs - the
 * camera moved, not the product.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { FRAME, INTER, STAGE, TYPE } from '../theme';
import { Stamp, Strike } from '../verbs';
import { PANEL } from './ui';

/** The dark ground every stab sits on, with the film's own faint brand cast. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: STAGE.back, fontFamily: INTER, overflow: 'hidden' }}>
    {/*
      A radial lift behind the subject, not a flat fill. The panel is white and
      nearly fills the frame's height; against an even near-black it reads as a
      cut-out pasted on, and against a lit ground it reads as an object standing
      in a space. Cheap, and it survives the bitrate a store page will serve.
    */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 42%, ${STAGE.plate} 0%, ${STAGE.back} 62%)`,
      }}
    />
    {children}
  </AbsoluteFill>
);

/** Which band of the panel a stab wants in the middle of the frame. */
export interface Focus {
  /** The panel-space y the frame should centre on. */
  y: number;
  /** How much larger than life the panel is drawn. */
  scale: number;
  /**
   * The panel-space x to centre on. Defaults to the panel's own middle.
   *
   * Every pushed-in stab sets this well left of the middle, which slides the
   * panel to the right of the frame and leaves a dark column at the left. That
   * column is where {@link Super} lives, and it is the reason a super never has
   * to be drawn on top of the product.
   */
  x?: number;
}

/**
 * The panel as a lit, tilted plate, optionally pushed in on one region.
 *
 * The tilt is small (a couple of degrees) and constant across the ad. A larger
 * angle looks like a stock mockup template, and a changing angle makes every cut
 * read as a different product.
 */
export const PanelPlate: React.FC<{
  focus?: Focus;
  tilt?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ focus, tilt = -1.4, children, style }) => {
  const scale = focus?.scale ?? 1;
  const cx = focus?.x ?? PANEL.width / 2;
  const cy = focus?.y ?? PANEL.height / 2;

  // The panel is laid out at its own size and then moved so `(cx, cy)` lands on
  // the frame's centre. Composed as translate-then-scale about the panel's
  // top-left, so the arithmetic is the same whatever the scale is.
  const left = FRAME.width / 2 - cx * scale;
  const top = FRAME.height / 2 - cy * scale;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: PANEL.width,
        height: PANEL.height,
        transform: `scale(${scale}) rotate(${tilt}deg)`,
        transformOrigin: 'top left',
        borderRadius: 6,
        boxShadow: '0 80px 140px -40px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * The ad's one word per stab.
 *
 * Bottom left, always the same place, always the same size. A super that moves
 * between stabs makes the eye hunt for it, which costs more than the motion
 * gains: this is the fixed point the rest of the frame changes around.
 */
export const Super: React.FC<{ from: number; children: React.ReactNode; tone?: string }> = ({
  from,
  children,
  tone = STAGE.ink,
}) => (
  <>
    {/*
      The super lives in the dark column the pushed-in stabs deliberately leave
      at the left of the frame (see {@link Focus}), never on top of the panel.
      The first cut let it cross onto the white and its last letters vanished:
      `COMPARE` read as `COMP`, `PROVE` as `PROV`. A scrim behind the word fixed
      the legibility and left a grey smudge across the product, which is worse.
      Framing the shot so the word has ground of its own is the version with no
      side effect.
    */}
    <div style={{ position: 'absolute', left: 64, bottom: 92, width: 430 }}>
      <Stamp from={from} flash={STAGE.accent}>
        <div
          style={{
            fontSize: TYPE.chapter,
            fontWeight: 700,
            letterSpacing: '-.02em',
            color: tone,
            lineHeight: 1,
          }}
        >
          {children}
        </div>
      </Stamp>
      <div style={{ marginTop: 16, width: 230 }}>
        <Strike from={from + 6} color={STAGE.accent} weight={4} />
      </div>
    </div>
  </>
);

/**
 * A line of argument set beside the panel, for the stabs with no super.
 *
 * Deliberately not the same object as {@link Super}: a super is one word doing
 * pacing, this is a sentence doing meaning, and giving them one component would
 * mean one of the two carrying props it never uses.
 */
export const Claim: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      fontSize: TYPE.claim,
      fontWeight: 600,
      lineHeight: 1.15,
      letterSpacing: '-.01em',
      color: STAGE.ink,
      ...style,
    }}
  >
    {children}
  </div>
);
