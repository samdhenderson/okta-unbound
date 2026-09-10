/**
 * @module reel/ad/stabs/End
 * @description Stab 9: the name, and the one thing to do about it.
 *
 * An end card has exactly two jobs and neither of them is summarising the ad.
 * The viewer has to leave knowing what the thing is called and where the button
 * is. Everything else on this frame is there to make those two things feel
 * inevitable rather than to add information.
 *
 * The wordmark stamps, the rule draws under it, and the install button beats
 * once and holds. The beat is the last motion in the film on purpose: the eye
 * ends up on the button and there is nothing after it to pull the eye away.
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
  /** The name. */
  mark: { verb: 'stamp' },
  /** The rule under it. */
  rule: { verb: 'strike', gap: 4 },
  /** What it is, in one line. */
  line: { verb: 'snap', gap: 8 },
  /** And the button. */
  cta: { verb: 'snap', gap: 8 },
  beat: { verb: 'pulse', gap: 6, hold: 1.1 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(END_CUES);
export const END_FRAMES = SHEET.frames;

export const End: React.FC<StabProps> = () => (
  <Stage>
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
    >
      <Stamp from={SHEET.at.mark} flash={STAGE.accent}>
        <div
          style={{
            fontSize: TYPE.chapter + 26,
            fontWeight: 700,
            letterSpacing: '-.03em',
            color: STAGE.ink,
          }}
        >
          Okta Unbound
        </div>
      </Stamp>

      <div style={{ marginTop: 26, width: 320 }}>
        <Strike from={SHEET.at.rule} color={STAGE.accent} weight={5} />
      </div>

      <Snap from={SHEET.at.line} edge="up" distance={22}>
        <div
          style={{
            marginTop: 34,
            fontSize: TYPE.claim - 4,
            fontWeight: 500,
            color: STAGE.inkDim,
            textAlign: 'center',
            maxWidth: 1240,
            lineHeight: 1.3,
          }}
        >
          Okta tells you what someone has. This tells you why, and lets you fix it.
        </div>
      </Snap>

      <Snap from={SHEET.at.cta} edge="down" distance={26} style={{ marginTop: 62 }}>
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
          marginTop: 40,
          fontSize: TYPE.body,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: STAGE.inkDim,
        }}
      >
        Free · No account · No backend
      </div>
    </AbsoluteFill>
  </Stage>
);
