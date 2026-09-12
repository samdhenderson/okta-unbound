/**
 * @module reel/ad/stabs/Hook
 * @description Stab 1: three questions the console will not answer.
 *
 * An ad on a store page competes with the back button, so the first second
 * cannot be the product. It has to be the viewer's own week. Every Okta admin
 * has been handed these questions and has answered them by opening tabs until
 * one of them happened to say something, which is what the six plates below
 * are: they arrive confident, one at a time, and go grey without having helped.
 *
 * ## Why three questions rather than one
 *
 * The first cut asked one - `why does she have that?` - which was the right
 * opener for a cut that spent all nine of its shots on provenance. It is the
 * wrong opener now. The ad answers three different questions in three different
 * places: who holds a thing, what reads a field, and what a change costs. An
 * opener that names only one of them promises a smaller product than the one
 * the viewer is about to watch, and the end card's `Who. What. Why.` has
 * nothing to land against.
 *
 * So the three interrogatives are set in the accent and everything else is
 * plain. That is the whole styling idea and it recurs on the end card: **the
 * question word is the thing to look at**, the rest of the line is context. A
 * viewer who reads nothing else off this frame reads `who`, `what`, `why`.
 *
 * The questions are lower case on purpose. A capitalised headline reads as
 * marketing; a lower case one reads as the thing somebody actually typed into
 * Slack, which is where these questions always come from.
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
  /** Who holds this. */
  who: { verb: 'stamp' },
  /** What reads that field. */
  what: { verb: 'stamp', gap: 7 },
  /** And why any of it is true. */
  why: { verb: 'stamp', gap: 7 },
  /** The rule under the stack. */
  rule: { verb: 'strike', gap: 3 },
  /** Six console tabs arrive, one after another. */
  tabs: { verb: 'snap', gap: 6, hold: 0.42 },
  /** And every one of them goes grey. */
  dim: { frames: 14, hold: 0.6 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(HOOK_CUES);
export const HOOK_FRAMES = SHEET.frames;

/** How many console tabs the admin opened before giving up. Six is the joke and the measurement. */
const TABS = 6;
/** Frames between one tab plate arriving and the next. */
const TAB_STEP = 7;

/**
 * One question: its interrogative in the accent, the rest of it plain.
 *
 * Set as one line rather than two spans of different sizes, because the accent
 * is doing the emphasis and a size change on top of a colour change reads as
 * two different sentences rather than one with a stressed word.
 */
const Question: React.FC<{ from: number; word: string; rest: string }> = ({ from, word, rest }) => (
  // `Stamp` is `inline-block`, so three of them in a row lay out as one run of
  // text. The block wrapper is what makes this a stack of three questions
  // rather than a single sentence with no spaces in it.
  <div>
    <Stamp from={from} flash={STAGE.accent}>
      <div
        style={{
          fontSize: TYPE.chapter - 20,
          fontWeight: 700,
          letterSpacing: '-.025em',
          color: STAGE.ink,
          lineHeight: 1.12,
        }}
      >
        <span style={{ color: STAGE.accent }}>{word}</span>
        {rest}
      </div>
    </Stamp>
  </div>
);

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
          gap: 46,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <Question from={SHEET.at.who} word="who" rest=" has this?" />
          <Question from={SHEET.at.what} word="what" rest=" reads that field?" />
          <Question from={SHEET.at.why} word="why" rest=" did they get it?" />
          <div style={{ margin: '20px 0 0', width: 300 }}>
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
