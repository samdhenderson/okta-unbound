/**
 * @module reel/ad/stabs/Weigh
 * @description Stab 6: one profile field, and everything standing on it.
 *
 * The stab before this one found a mistyped attribute. The obvious next
 * question is the one nobody can answer from Okta's own admin console: *what
 * else reads this field?* An attribute in Okta has no back-reference. Group
 * rules read profile values, and the profile has no idea which rules those are,
 * so the cost of changing a field is invisible at the moment you are deciding
 * whether to change it. Admins find out afterwards, from a ticket.
 *
 * The panel keeps the index. `shared/rules/groupAttributeIndex.ts` reads every
 * feeding rule's expression, pulls the attributes out of it, and the group's
 * Insights tab prints the answer as a heading: **Depended on by 3 rules**, each
 * one a row you can open. That heading is the product's own sentence and it is
 * left alone here.
 *
 * ## The figure is on the stage, not in the card
 *
 * A number an ad wants read across a room has to be set like one, and the
 * product sets this one at fifteen pixels inside a card, correctly, because in
 * the product it is a label rather than a headline. Rolling it there would be a
 * smear. So the panel prints its own sentence at its own size and the stage
 * says `3` at ninety, in alert colour, which is the register the *risk* reading
 * belongs in anyway: the panel is reporting, the advertisement is warning.
 *
 * The three rules are the demo fixture's three genuine readers of
 * `user.department` (`demo/snapshot.ts`, rules 2, 3 and 4). Nothing here is
 * invented, and the count on the stage is the length of the list beside it
 * rather than a second number that could disagree with it.
 */
import React from 'react';
import { STAGE, TYPE } from '../../theme';
import { Count, Pulse, Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Badge, Body, Card, Icon, Panel, PageHeading, SectionLabel, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const WEIGH_CUES = {
  /** The attribute, ranked to the top of the spread. */
  card: { verb: 'snap' },
  /** Opened: what depends on it. */
  expand: { verb: 'wipe', gap: 4 },
  /**
   * The readers, one at a time, riding the wipe rather than following it.
   *
   * `with` on purpose: a stagger that waits for the reveal to finish leaves the
   * opened card empty for its own length, which at this pace is a visible beat
   * of nothing. Started together, each row lands about as the wipe's edge
   * reaches it.
   */
  rules: { verb: 'snap', with: 'expand', gap: 4 },
  /** And the stage puts a size on it. */
  tally: { verb: 'count', gap: 6 },
  /** One beat on the chip that started the question. */
  beat: { verb: 'pulse', gap: 2, hold: 0.9 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(WEIGH_CUES);
export const WEIGH_FRAMES = SHEET.frames;

/** Frames between one rule row landing and the next. */
const RULE_STEP = 6;

/**
 * The fixture's three readers of `user.department`, with the group each one
 * assigns into. Verbatim from `src/sidepanel/demo/snapshot.ts`.
 */
const READERS = [
  { name: 'Engineering by department', target: 'Engineering - All' },
  { name: 'Engineering → GitHub (excludes contractors)', target: 'GitHub - Engineering' },
  { name: 'Sales by department', target: 'Sales - All' },
] as const;

/** One dependent rule, as the Insights tab lists it. */
const RuleRow: React.FC<{ from: number; name: string; target: string }> = ({
  from,
  name,
  target,
}) => (
  <Snap from={from} edge="left" distance={34}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 8,
        background: UI.chrome,
        border: `1px solid ${UI.line}`,
      }}
    >
      <Icon name="rule" size={18} color={UI.brand} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: UI_TYPE.rowTitle, fontWeight: 600, color: UI.title }}>{name}</div>
        <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 3 }}>
          {'Targets: '}
          <strong style={{ color: UI.title }}>{target}</strong>
        </div>
      </div>
      <Icon name="chevron" size={16} color={UI.strongLine} />
    </div>
  </Snap>
);

/** A ranked attribute in the spread, closed. */
const QuietCard: React.FC<{ name: string; meta: string }> = ({ name, meta }) => (
  <Card style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div
      style={{
        fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
        fontSize: UI_TYPE.mono,
        color: UI.body,
        width: 150,
      }}
    >
      {name}
    </div>
    <div style={{ flex: 1, fontSize: UI_TYPE.rowBody, color: UI.muted }}>{meta}</div>
    <Icon name="chevron" size={17} color={UI.strongLine} />
  </Card>
);

export const Weigh: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 268, y: 430, scale: 1.68 }}>
      <Panel active={2} context="Engineering - All">
        <PageHeading
          title="Engineering - All"
          sub="Insights  ·  94 members"
          right={<Badge tone="brand">Attribute spread</Badge>}
        />
        <Body style={{ paddingTop: 14 }}>
          <SectionLabel>Attribute spread</SectionLabel>

          <Snap from={SHEET.at.card} edge="up" distance={26}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
                    fontSize: UI_TYPE.rowTitle,
                    fontWeight: 600,
                    color: UI.title,
                  }}
                >
                  department
                </div>
                <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted }}>
                  94 values · 3 blank
                </div>
                <div style={{ flex: 1 }} />
                {/*
                  The chip the whole stab is about, so it is the one thing in
                  the card carrying a verb.
                */}
                <Pulse from={SHEET.at.beat} color={UI.bad} radius={7} swell={0.1}>
                  <Badge tone="bad">3 rules</Badge>
                </Pulse>
              </div>
            </Card>
          </Snap>

          {/*
            The dependency block is its own card rather than a drawer inside the
            one above, because a `wipe` masks without collapsing: revealed from
            inside the attribute card it left a white void the height of three
            rows for the second before it opened, which reads as a card that
            failed to load. Out here the unrevealed space is canvas, which reads
            as page.
          */}
          <Wipe from={SHEET.at.expand} direction="down" edgeWidth={3}>
            <Card style={{ padding: 16 }}>
              <div
                style={{
                  fontSize: UI_TYPE.label,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: UI.muted,
                  marginBottom: 10,
                }}
              >
                Depended on by 3 rules
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {READERS.map((reader, i) => (
                  <RuleRow
                    key={reader.name}
                    from={SHEET.at.rules + i * RULE_STEP}
                    name={reader.name}
                    target={reader.target}
                  />
                ))}
              </div>
            </Card>
          </Wipe>

          <QuietCard name="employeeType" meta="2 values · 0 blank" />
          <QuietCard name="city" meta="11 values · 6 blank" />
        </Body>
      </Panel>
    </PanelPlate>

    {/*
      Held back until the tally, not merely rolled from zero: an odometer that
      has not been cued yet reads `0`, and `0 rules read this one field` is the
      opposite of what this shot is for. It was on screen for a second in the
      first cut.
    */}
    <div style={{ position: 'absolute', left: 64, bottom: 296, width: 470 }}>
      <Snap from={SHEET.at.tally} edge="left" distance={26}>
        <Count
          from={SHEET.at.tally}
          value={READERS.length}
          size={TYPE.figure}
          color={STAGE.alert}
          style={{ fontWeight: 700 }}
        />
        <div
          style={{
            fontSize: TYPE.claim,
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: '-.01em',
            color: STAGE.ink,
            marginTop: 14,
          }}
        >
          rules read this one field
        </div>
      </Snap>
    </div>

    <Super from={SHEET.at.tally}>WEIGH</Super>
  </Stage>
);
