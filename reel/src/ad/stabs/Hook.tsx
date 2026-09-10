/**
 * @module reel/ad/stabs/Hook
 * @description Stab 1: the question, and the six tabs that will not answer it.
 *
 * An ad on a store page competes with the back button, so the first second
 * cannot be the product. It has to be the viewer's own week. Every Okta admin
 * has been handed this exact question and has answered it by opening tabs until
 * one of them happened to say something, which is what the six plates below are:
 * they arrive confident, one at a time, and go grey without having helped.
 *
 * The question is set in lower case on purpose. A capitalised headline reads as
 * marketing; a lower case one reads as the thing somebody actually typed into
 * Slack, which is where this question always comes from.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { STAGE, TYPE } from '../../theme';
import { Snap, Stamp, Strike } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { Stage } from '../stage';
import type { StabProps } from '../types';

export const HOOK_CUES = {
  /** The question lands. */
  ask: { verb: 'stamp' },
  /** The rule under it. */
  rule: { verb: 'strike', gap: 4 },
  /** Six console tabs arrive, one after another. */
  tabs: { verb: 'snap', gap: 8, hold: 0.5 },
  /** And every one of them goes grey. */
  dim: { frames: 14, hold: 0.62 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(HOOK_CUES);
export const HOOK_FRAMES = SHEET.frames;

/** How many console tabs the admin opened before giving up. Six is the joke and the measurement. */
const TABS = 6;
/** Frames between one tab plate arriving and the next. */
const TAB_STEP = 7;

export const Hook: React.FC<StabProps> = () => {
  const frame = useCurrentFrame();

  // Every plate dims together rather than in the order they arrived: they did
  // not fail one at a time, they failed as a set, at the moment the admin ran
  // out of places to look.
  const dim = interpolate(frame, [SHEET.at.dim, SHEET.at.dim + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Stage>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 54,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Stamp from={SHEET.at.ask} flash={STAGE.accent}>
            <div
              style={{
                fontSize: TYPE.chapter,
                fontWeight: 700,
                letterSpacing: '-.025em',
                color: STAGE.ink,
                lineHeight: 1.05,
              }}
            >
              why does she have that?
            </div>
          </Stamp>
          <div style={{ margin: '22px auto 0', width: 300 }}>
            <Strike from={SHEET.at.rule} color={STAGE.alert} weight={4} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {Array.from({ length: TABS }, (_, i) => (
            <Snap key={i} from={SHEET.at.tabs + i * TAB_STEP} edge="down" distance={26}>
              <div
                style={{
                  width: 168,
                  height: 74,
                  borderRadius: 8,
                  background: STAGE.plate,
                  border: `1px solid ${STAGE.rule}`,
                  padding: 12,
                  opacity: interpolate(dim, [0, 1], [1, 0.28]),
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 8,
                    borderRadius: 4,
                    background: STAGE.inkDim,
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    width: 132,
                    height: 8,
                    borderRadius: 4,
                    background: STAGE.rule,
                    marginTop: 12,
                  }}
                />
                <div
                  style={{
                    width: 60,
                    height: 8,
                    borderRadius: 4,
                    background: STAGE.rule,
                    marginTop: 8,
                  }}
                />
              </div>
            </Snap>
          ))}
        </div>

        <div
          style={{
            fontSize: TYPE.body,
            color: STAGE.inkDim,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            opacity: dim,
          }}
        >
          six tabs, still guessing
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
