/**
 * @module reel/ad/stabs/End
 * @description Stab 12: what Okta leaves out, what this adds, and where the button is.
 *
 * An end card has two jobs and neither of them is summarising the ad. The
 * viewer has to leave knowing what the thing is called and where the button is.
 * Everything else on this frame exists to make those two feel inevitable rather
 * than to add information.
 *
 * ## The claim, and why it is phrased against Okta rather than about us
 *
 * `Okta covers the basics. Unbind and discover more.` is a positioning line,
 * not a criticism: an admin watching this has Okta and is not replacing it, so
 * an ad that argues with the console it sits beside is arguing with the
 * viewer's own decision. Conceding the basics is what earns the second
 * sentence. The name does the work in that sentence - `Unbind` is the product,
 * set in the accent, and it is the one word on this frame that is both the
 * claim and the brand.
 *
 * ## Who. What. Why. Then take action.
 *
 * The four beats are the ad's own structure read back, and they land one at a
 * time so the viewer hears the rhythm rather than reads a list. They pick up
 * the three accented interrogatives the `hook` opened on, in the same colour,
 * which is the only piece of styling that spans the whole cut: the questions
 * that had six tabs and no answer at the start have an answer and a verb by the
 * end.
 *
 * The install button beats last, on purpose. The eye ends on the button and
 * there is nothing after it to pull the eye away.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLOR, STAGE, TYPE } from '../../theme';
import { Pulse, Snap, Stamp, Strike } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { Stage } from '../stage';
import { Icon } from '../ui';
import type { StabProps } from '../types';

export const END_CUES = {
  /** The concession. */
  basics: { verb: 'snap' },
  /** The claim, and the name inside it. */
  unbind: { verb: 'stamp', gap: 6 },
  /** The rule under it. */
  rule: { verb: 'strike', gap: 3 },
  /** The three questions, answered this time. */
  who: { verb: 'stamp', gap: 9 },
  what: { verb: 'stamp', gap: 5 },
  why: { verb: 'stamp', gap: 5 },
  /** And the verb the other three were for. */
  act: { verb: 'snap', gap: 6 },
  /** The button. */
  cta: { verb: 'snap', gap: 8 },
  beat: { verb: 'pulse', gap: 6, hold: 1.15 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(END_CUES);
export const END_FRAMES = SHEET.frames;

/** One of the three interrogatives, in the accent the `hook` set them in. */
const Beat: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => (
  <Stamp from={from} flash={STAGE.accent}>
    <span
      style={{
        fontSize: TYPE.claim,
        fontWeight: 700,
        letterSpacing: '-.015em',
        color: STAGE.accent,
      }}
    >
      {children}
    </span>
  </Stamp>
);

export const End: React.FC<StabProps> = () => (
  <Stage>
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
    >
      <Snap from={SHEET.at.basics} edge="up" distance={18}>
        <div
          style={{
            fontSize: TYPE.body,
            fontWeight: 600,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: STAGE.inkDim,
          }}
        >
          Okta covers the basics
        </div>
      </Snap>

      <Stamp from={SHEET.at.unbind} flash={STAGE.accent}>
        <div
          style={{
            marginTop: 20,
            fontSize: TYPE.chapter - 6,
            fontWeight: 700,
            letterSpacing: '-.03em',
            color: STAGE.ink,
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: STAGE.accent }}>Unbind</span> and discover more.
        </div>
      </Stamp>

      <div style={{ marginTop: 24, width: 320 }}>
        <Strike from={SHEET.at.rule} color={STAGE.accent} weight={5} />
      </div>

      {/*
        One row, not a stacked list: these are four beats of a sentence and a
        list would invite the eye to compare them instead of hearing them in
        order. The separators are set in the rule colour so the words are the
        only thing with weight.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginTop: 44,
          fontSize: TYPE.claim,
          fontWeight: 700,
          color: STAGE.rule,
        }}
      >
        <Beat from={SHEET.at.who}>Who.</Beat>
        <Beat from={SHEET.at.what}>What.</Beat>
        <Beat from={SHEET.at.why}>Why.</Beat>
        <Snap from={SHEET.at.act} edge="left" distance={22}>
          <span style={{ color: STAGE.ink }}>Then take action.</span>
        </Snap>
      </div>

      <div
        style={{
          marginTop: 54,
          fontSize: TYPE.claim - 6,
          fontWeight: 700,
          letterSpacing: '-.02em',
          color: STAGE.ink,
        }}
      >
        Okta Unbound
      </div>

      <Snap from={SHEET.at.cta} edge="down" distance={26} style={{ marginTop: 24 }}>
        <Pulse from={SHEET.at.beat} radius={16} color={STAGE.accent} swell={0.05}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '22px 40px',
              borderRadius: 14,
              background: COLOR.primary,
              color: '#ffffff',
              fontSize: TYPE.claim - 8,
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={30} color="#ffffff" strokeWidth={2.4} />
            Add to Chrome
          </div>
        </Pulse>
      </Snap>

      <div
        style={{
          marginTop: 30,
          fontSize: TYPE.body,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: STAGE.inkDim,
        }}
      >
        Free! Install in the webstore.
      </div>
    </AbsoluteFill>
  </Stage>
);
