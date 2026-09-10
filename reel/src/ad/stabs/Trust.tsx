/**
 * @module reel/ad/stabs/Trust
 * @description Stab 8: the three facts that get it installed.
 *
 * An extension that reads an identity console is a thing security teams block by
 * default, and rightly. Whoever watches this ad to the end is going to have to
 * defend the install to somebody, so the ad hands them the argument.
 *
 * Every line here is a fact the code keeps and `docs/security.md` states: there
 * is no backend and no telemetry, the XSRF token is read from the page per
 * request and never stored or messaged, and API calls run in the content script
 * on the session the browser already has. No line claims an audit, a
 * certification, or a review that has not happened.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { STAGE, TYPE } from '../../theme';
import { Stamp, Strike } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { Stage } from '../stage';
import type { StabProps } from '../types';

export const TRUST_CUES = {
  /** Three lines, each landing on top of the last one's tail. */
  lines: { verb: 'stamp', hold: 1.35 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(TRUST_CUES);
export const TRUST_FRAMES = SHEET.frames + 26;

/** Frames between one line landing and the next. */
const LINE_STEP = 13;

const LINES = [
  'No backend. No telemetry.',
  'Your own Okta session is the only credential.',
  'Nothing leaves your browser.',
] as const;

export const Trust: React.FC<StabProps> = () => (
  <Stage>
    <AbsoluteFill
      style={{
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 34,
        padding: '0 160px',
      }}
    >
      {LINES.map((line, i) => (
        <div key={line}>
          <Stamp from={SHEET.at.lines + i * LINE_STEP} scaleFrom={0.18} blur={6}>
            <div
              style={{
                fontSize: TYPE.claim + 8,
                fontWeight: 700,
                letterSpacing: '-.015em',
                color: STAGE.ink,
              }}
            >
              {line}
            </div>
          </Stamp>
          <div style={{ marginTop: 12, width: 120 }}>
            <Strike
              from={SHEET.at.lines + i * LINE_STEP + 6}
              color={i === LINES.length - 1 ? STAGE.affirm : STAGE.accent}
              weight={4}
            />
          </div>
        </div>
      ))}
    </AbsoluteFill>
  </Stage>
);
