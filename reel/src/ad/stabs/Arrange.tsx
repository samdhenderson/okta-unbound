/**
 * @module reel/ad/stabs/Arrange
 * @description Stab 3: the profile is twenty five fields, and you decide which ones matter.
 *
 * Every other shot in this ad is about the product knowing something. This one
 * is about the product getting out of the way, and it is the shot that says the
 * thing a store page listing cannot say in words: somebody built this for the
 * job rather than generated it from a schema. An Okta user profile is a wall of
 * attributes in whatever order the org's schema happens to list them, and the
 * two minutes an admin spends hunting the one field they actually check is the
 * most boring recurring cost in the whole tool. Here they drag it to the top
 * once and it stays there.
 *
 * ## Two tracks, and why the copy is on the stage
 *
 * The panel does one thing at a time: a row is picked up, carried into another
 * section, and put down; then an attribute is hidden; then the header count
 * comes down. Beside it, in the dark column, the four verbs the editor offers
 * arrive one at a time with an example each.
 *
 * The list is on the **stage**, not in the panel, and that is the ad's own
 * rule (`AD.md`): a rebuilt product surface never carries a sentence of ad
 * copy. It is also the better shot, because each line is cued to the exact
 * panel moment that proves it - `reorder` lands as the row is in the air,
 * `hide` as the value greys out - so the claim and its evidence are the same
 * frame rather than a caption over a still.
 *
 * The four are the real editor's four: sections you add and name, a grip on
 * every row, an eye on every row, and the "Mark attributes read by rules"
 * toggle. Nothing here is a capability being promised.
 */
import React from 'react';
import { STAGE } from '../../theme';
import { Drag, DropGap, Pulse, Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import {
  Badge,
  Body,
  Card,
  DropIndicator,
  FilterPill,
  Icon,
  Panel,
  PageHeading,
  UI,
  UI_TYPE,
} from '../ui';
import type { IconName } from '../ui';
import type { StabProps } from '../types';

export const ARRANGE_CUES = {
  /** The sections arrive, already grouped. */
  sections: { verb: 'snap' },
  /** And the first thing the stage says is what that grouping was. */
  categorize: { verb: 'snap', with: 'sections', gap: 8 },
  /** A grip, beaten once, so the eye is on the row before it moves. */
  grip: { verb: 'pulse', gap: 10 },
  /** Picked up and carried into the section above. */
  carry: { verb: 'drag', gap: 2 },
  /** Named while it is in the air. */
  reorder: { verb: 'snap', with: 'carry' },
  /** Put down, and the section it joined says it is one field bigger. */
  drop: { verb: 'wipe', gap: 4 },
  /** An attribute nobody reads goes out. */
  dim: { verb: 'wipe', gap: 10 },
  /** Named as it greys. */
  hide: { verb: 'snap', with: 'dim' },
  /** And the header's own tally comes down. */
  shown: { verb: 'wipe', gap: 4 },
  /** The last line, over the settled panel. */
  mark: { verb: 'snap', with: 'shown', gap: 8, hold: 0.95 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(ARRANGE_CUES);
export const ARRANGE_FRAMES = SHEET.frames;

// ---------------------------------------------------------------------------
// The geometry the drag is measured in.
//
// The carried row stays **in the flow** of the list it starts in, and the space
// it vacates sits directly above it. That pairing is what makes the travel a
// constant: the section above grows by a slot, which pushes this card down by
// one, and the vacated slot closes, which pulls the row back up by one. The two
// cancel exactly, so the row's own starting position never moves while it is
// moving, and its travel is the difference between two tops derived below
// rather than a number tuned against a render.
//
// The first draft positioned it absolutely to dodge that reflow and had to be
// hand-tuned twice, because an absolute box is measured from the stack while
// every row it has to line up with is measured from inside a padded card. In
// the flow it is aligned by construction and there is nothing to tune.
// ---------------------------------------------------------------------------

/** One attribute row, and the space between two of them. */
const ROW_H = 44;
const ROW_GAP = 8;
/** The gap between two section cards. */
const STACK_GAP = 12;

/** A section card's inner padding, and the height of its own header line. */
const CARD_PAD = 12;
const CARD_HEAD = 26;

/** Where a card's rows start, measured from the card's own top edge. */
const ROWS_TOP = CARD_PAD + CARD_HEAD + ROW_GAP;
/** How tall the first card is before anything opens: its two rows and its padding. */
const EMPLOYMENT_H = ROWS_TOP + ROW_H * 2 + ROW_GAP * 2 + CARD_PAD;

/** Where the receiving slot opens, in the stack's own space. */
const DROP_TOP = ROWS_TOP + (ROW_H + ROW_GAP) * 2;
/** Where the carried row starts: the second card's first row, before anything moves. */
const CARRY_TOP = EMPLOYMENT_H + STACK_GAP + ROWS_TOP;

/**
 * How far the carried row is translated.
 *
 * Not simply `DROP_TOP - CARRY_TOP`, because the row's own starting point moves
 * while it travels: the card above it grows by `ROW_H` as the receiving slot
 * opens, which carries this whole card down by the same amount. Both run on the
 * one eased progress, so subtracting that displacement here makes the row's
 * position linear in the progress and land exactly on `DROP_TOP`.
 */
const CARRY_Y = DROP_TOP - CARRY_TOP - ROW_H;

/** What the editor lets you do, and the smallest true example of each. */
const MOVES: readonly { verb: string; example: string; icon: IconName }[] = [
  { verb: 'Categorize', example: 'sections you add and name yourself', icon: 'plus' },
  { verb: 'Reorder', example: 'drag the field you check first to the top', icon: 'grip' },
  { verb: 'Hide', example: 'the seven you never read, gone', icon: 'eye-off' },
  { verb: 'Mark', example: 'every field a group rule reads', icon: 'rule' },
];

/** One line of the stage's list, arriving on its own cue. */
const Move: React.FC<{ from: number; move: (typeof MOVES)[number] }> = ({ from, move }) => (
  <Snap from={from} edge="left" distance={30}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ paddingTop: 6 }}>
        <Icon name={move.icon} size={24} color={STAGE.accent} strokeWidth={2} />
      </div>
      <div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-.02em',
            color: STAGE.ink,
            lineHeight: 1.1,
          }}
        >
          {move.verb}
        </div>
        <div style={{ fontSize: 24, color: STAGE.inkDim, marginTop: 3 }}>{move.example}</div>
      </div>
    </div>
  </Snap>
);

/**
 * One state wiped over another, in place.
 *
 * The ad's own established way of saying a value changed - `Fix` corrects a
 * profile field this way and it is the clearest second of the current cut. It
 * is used here instead of `count` because every figure in this stab is set in
 * the panel's own 11px to 15px type, where an odometer rolling three digit
 * columns is a smear rather than a number. A wipe over the whole line reads at
 * any size, and it can carry a word as easily as a digit.
 */
const Swap: React.FC<{ from: number; before: React.ReactNode; children: React.ReactNode }> = ({
  from,
  before,
  children,
}) => (
  <div style={{ position: 'relative' }}>
    {before}
    <div style={{ position: 'absolute', inset: 0 }}>
      <Wipe from={from} edgeWidth={3}>
        {children}
      </Wipe>
    </div>
  </div>
);

/** The header line the product prints above the sections. */
const ShownLine: React.FC<{ shown: number }> = ({ shown }) => (
  <div
    style={{
      fontSize: UI_TYPE.rowBody,
      color: UI.muted,
      background: UI.canvas,
      paddingBottom: 2,
    }}
  >
    <strong style={{ color: UI.title, fontVariantNumeric: 'tabular-nums' }}>{shown}</strong>
    {' of 25 attributes shown · '}
    <strong style={{ color: UI.title }}>3</strong>
    {' read by rules that grant access'}
  </div>
);

/** One attribute, as the display editor renders it: grip, name, value, chip, eye. */
const AttrRow: React.FC<{
  name: string;
  value: string;
  rules?: number;
  hidden?: boolean;
  carried?: boolean;
}> = ({ name, value, rules, hidden, carried }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: ROW_H,
      padding: '0 12px',
      borderRadius: 8,
      background: carried ? UI.brandWash : UI.chrome,
      border: `1px solid ${carried ? UI.brand : UI.line}`,
      opacity: hidden ? 0.6 : 1,
    }}
  >
    <Icon name="grip" size={18} color={carried ? UI.brand : UI.strongLine} />
    <div
      style={{
        width: 150,
        fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
        fontSize: UI_TYPE.mono,
        color: UI.body,
        textDecoration: hidden ? 'line-through' : undefined,
      }}
    >
      {name}
    </div>
    <div
      style={{
        flex: 1,
        fontSize: UI_TYPE.rowTitle,
        fontWeight: 600,
        color: UI.title,
        textDecoration: hidden ? 'line-through' : undefined,
      }}
    >
      {value}
    </div>
    {rules !== undefined && <Badge tone="brand">{rules === 1 ? '1 rule' : `${rules} rules`}</Badge>}
    <Icon name={hidden ? 'eye-off' : 'eye'} size={19} color={hidden ? UI.brand : UI.faint} />
  </div>
);

/** A section of the profile, with its own name and field count. */
const Section: React.FC<{ name: string; count: React.ReactNode; children: React.ReactNode }> = ({
  name,
  count,
  children,
}) => (
  <Card style={{ padding: CARD_PAD }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: CARD_HEAD,
        marginBottom: ROW_GAP,
      }}
    >
      <Icon name="grip" size={18} color={UI.strongLine} />
      <div style={{ fontSize: UI_TYPE.rowTitle, fontWeight: 700, color: UI.title }}>{name}</div>
      {count}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>{children}</div>
  </Card>
);

export const Arrange: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 263, y: 430, scale: 1.75 }}>
      <Panel active={1} context="Priya Achterberg" contextIcon="user">
        <PageHeading
          title="Priya Achterberg"
          sub="ACTIVE  ·  00uFAKE0000000000031"
          right={<Badge tone="neutral">Customizing display</Badge>}
        />
        <Body style={{ paddingTop: 14 }}>
          {/*
            The header line the product prints, with the count that moves. The
            seven it comes down by is the same seven the stage's `Hide` line
            counts: one fixture, two places, no disagreement.
          */}
          <Swap from={SHEET.at.shown} before={<ShownLine shown={18} />}>
            <ShownLine shown={17} />
          </Swap>

          <div style={{ display: 'flex', gap: 10 }}>
            <FilterPill selected>All attributes</FilterPill>
            <FilterPill>Used by rules</FilterPill>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Snap from={SHEET.at.sections} edge="up" distance={22}>
              <Section
                name="Employment"
                count={
                  <Swap from={SHEET.at.drop} before={<Badge tone="neutral">6 fields</Badge>}>
                    <Badge tone="neutral">7 fields</Badge>
                  </Swap>
                }
              >
                <AttrRow name="title" value="Staff Engineer" />
                <AttrRow name="manager" value="Amara Okonkwo" />
                <DropGap from={SHEET.at.carry} height={ROW_H}>
                  <div style={{ paddingTop: ROW_H / 2 - 1 }}>
                    <DropIndicator />
                  </div>
                </DropGap>
              </Section>
            </Snap>

            <Snap from={SHEET.at.sections + 5} edge="up" distance={22}>
              <Section
                name="Uncategorized"
                count={
                  // The other half of the same move. A section that gains a
                  // field while the one beside it keeps its count is two
                  // numbers disagreeing on screen about what just happened.
                  <Swap from={SHEET.at.drop} before={<Badge tone="neutral">8 fields</Badge>}>
                    <Badge tone="neutral">7 fields</Badge>
                  </Swap>
                }
              >
                {/*
                  The row in the hand, in the slot it is emptying.

                  The slot closes while the row spills out of it, which is the
                  only arrangement that leaves no hole behind: a transform moves
                  paint and leaves the layout box, so a row that merely
                  translates away keeps its space in this list for the rest of
                  the shot. `zIndex` so it passes over the card it is leaving
                  rather than clipping behind its border, which is the one frame
                  of this shot a viewer would notice.
                */}
                <DropGap from={SHEET.at.carry} height={ROW_H} closing spill>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
                    <Drag from={SHEET.at.carry} to={{ y: CARRY_Y }}>
                      <Pulse
                        from={SHEET.at.grip}
                        color={UI.brand}
                        radius={7}
                        swell={0.05}
                        style={{ display: 'block' }}
                      >
                        <AttrRow name="department" value="Engineering" rules={3} carried />
                      </Pulse>
                    </Drag>
                  </div>
                </DropGap>
                <Swap from={SHEET.at.dim} before={<AttrRow name="secondEmail" value="not set" />}>
                  <AttrRow name="secondEmail" value="not set" hidden />
                </Swap>
                <AttrRow name="costCenter" value="CC-4180" />
              </Section>
            </Snap>
          </div>
        </Body>
      </Panel>
    </PanelPlate>

    <div
      style={{
        position: 'absolute',
        left: 64,
        bottom: 262,
        width: 430,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {MOVES.map((move, i) => (
        <Move
          key={move.verb}
          from={[SHEET.at.categorize, SHEET.at.reorder, SHEET.at.hide, SHEET.at.mark][i]}
          move={move}
        />
      ))}
    </div>

    <Super from={SHEET.at.carry}>ARRANGE</Super>
  </Stage>
);
