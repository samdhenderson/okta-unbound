/**
 * @module reel/ad/stabs/Blast
 * @description Stab 8: press save, and see who moves before you do.
 *
 * `predict` asks what happens if you switch a rule off. This asks the harder
 * version of the same question, and the one an admin actually faces every day:
 * what happens if you change a *value*. Rules read profile attributes, so
 * correcting one field can add somebody to a group, drop somebody out of one,
 * or do nothing at all, and Okta will not tell you which until after the write.
 *
 * The panel runs every group rule against the draft before the write goes out
 * (`shared/membership/blastRadius.ts`, which is pure and calls nothing), and
 * prints the answer in the save modal as two lists you can switch between.
 * This shot is that modal: the live-write warning, the button that asks, and
 * the verdict arriving underneath it.
 *
 * ## Why the honest row is on screen
 *
 * The report's third section is `Not predicted`, and it is the reason this
 * feature is trustworthy rather than merely impressive. A membership Okta
 * credits to a direct add is not going to move because a rule's verdict
 * changed, and the panel says so in a sentence instead of quietly counting it
 * as a change. An advertisement that showed only the confident half of this
 * screen would be advertising a different, worse product - and the sentence is
 * short enough to read in a second, which is the only reason it can be here.
 *
 * The counts are the lengths of the lists beside them. There is no second
 * number anywhere in this stab that could disagree with what is on screen.
 */
import React from 'react';
import { Count, Pulse, Snap, Wipe, useVerb } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import {
  AlertMessage,
  Badge,
  Body,
  Button,
  Card,
  FilterPill,
  Icon,
  Panel,
  PageHeading,
  Sheet,
  UI,
  UI_TYPE,
} from '../ui';
import type { IconName } from '../ui';
import type { StabProps } from '../types';

export const BLAST_CUES = {
  /** What saving is: a live write, said before anything else. */
  warn: { verb: 'snap' },
  /** The button that asks the question, beaten once. */
  arm: { verb: 'pulse', gap: 8 },
  /** The report arriving. */
  analyze: { verb: 'wipe', gap: 4 },
  /**
   * Two figures, under the two views, rolling with the reveal rather than
   * after it. An odometer that has not been cued reads `0`, and `Groups 0`
   * under a report that has just opened is a wrong answer rather than a
   * pending one.
   */
  tally: { verb: 'count', with: 'analyze', gap: 2 },
  /** And the rows themselves, one at a time. */
  rows: { verb: 'snap', with: 'analyze', gap: 8, hold: 1.05 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(BLAST_CUES);
export const BLAST_FRAMES = SHEET.frames;

/** Frames between one predicted row landing and the next. */
const ROW_STEP = 6;

/**
 * How tall the report stands once it is open, in panel pixels.
 *
 * Stated, because a `wipe` masks without collapsing: the report's full height
 * is reserved from the modal's first frame, so revealing it in place left half
 * a second of empty white modal before anything arrived - a third of this shot,
 * showing nothing. The height opens on the wipe's own eased progress (`useVerb`,
 * the sanctioned accessor, not a hand-picked curve), so the box grows exactly as
 * the mask travels down it and the modal does what the product's modal does:
 * gets taller when you ask it the question.
 */
const REPORT_H = 240;

/** What the engine predicted, in the product's own three sections. */
const PREDICTED: readonly {
  group: string;
  verdict: string;
  tone: 'good' | 'warn' | 'neutral';
  icon?: IconName;
  because?: string;
}[] = [
  { group: 'Engineering - All', verdict: 'Added', tone: 'good', icon: 'plus' },
  { group: 'Sales - All', verdict: 'Removed', tone: 'warn', icon: 'minus' },
  {
    group: 'GitHub - Engineering',
    verdict: 'Not predicted',
    tone: 'neutral',
    because:
      'Okta credits this membership to a direct add, not to a rule, so changing a rule will not remove it.',
  },
];

const TONE_COLOR: Record<'good' | 'warn' | 'neutral', string> = {
  good: UI.good,
  warn: UI.warn,
  neutral: UI.faint,
};

/** One predicted group change, as `BlastRadiusGroupRow` renders it. */
const PredictedRow: React.FC<{ from: number; row: (typeof PREDICTED)[number] }> = ({
  from,
  row,
}) => (
  <Snap from={from} edge="up" distance={18}>
    <Card style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {row.icon && <Icon name={row.icon} size={18} color={TONE_COLOR[row.tone]} />}
        <div style={{ flex: 1, fontSize: UI_TYPE.rowTitle, fontWeight: 600, color: UI.title }}>
          {row.group}
        </div>
        <Badge tone={row.tone}>{row.verdict}</Badge>
      </div>
      {row.because && (
        <div
          style={{
            fontSize: UI_TYPE.rowBody,
            color: UI.muted,
            lineHeight: 1.45,
            marginTop: 7,
          }}
        >
          {row.because}
        </div>
      )}
    </Card>
  </Snap>
);

/** The prediction, opening the modal as it arrives. */
const Report: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const open = useVerb('wipe', SHEET.at.analyze);
  return (
    <div style={{ height: REPORT_H * open, overflow: 'hidden' }}>
      <Wipe from={SHEET.at.analyze} direction="down" edgeWidth={3}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </Wipe>
    </div>
  );
};

export const Blast: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 285, y: 510, scale: 1.72 }}>
      <Panel active={1} context="Priya Achterberg" contextIcon="user">
        <PageHeading
          title="Priya Achterberg"
          sub="ACTIVE  ·  00uFAKE0000000000031"
          right={<Badge tone="neutral">1 change</Badge>}
        />
        {/*
          The edit the modal is about. Behind the scrim and mostly covered at
          this framing, deliberately kept anyway: the product's modal opens over
          the pane you were editing, and a panel with an empty page under its
          own dialog would be a different screen from the one that ships.
        */}
        <Body style={{ paddingTop: 14 }}>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 150, fontSize: UI_TYPE.rowBody, color: UI.muted }}>
                department
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  border: `2px solid ${UI.brand}`,
                  borderRadius: 9,
                  fontSize: UI_TYPE.rowTitle,
                  fontWeight: 600,
                  color: UI.title,
                }}
              >
                Engineering
              </div>
              <Badge tone="brand">3 rules</Badge>
            </div>
          </Card>
        </Body>
        <Sheet
          title="Save profile changes"
          sub="1 attribute on Priya Achterberg"
          footer={
            <>
              <Button tone="ghost">Cancel</Button>
              <Button>Save changes</Button>
            </>
          }
        >
          <Snap from={SHEET.at.warn} edge="up" distance={16}>
            <AlertMessage tone="warn">
              <strong>1 attribute</strong> on Priya Achterberg will be overwritten in Okta. This is
              a live write.
            </AlertMessage>
          </Snap>

          <div>
            <div
              style={{
                fontSize: UI_TYPE.label,
                fontWeight: 700,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: UI.muted,
              }}
            >
              Blast radius
            </div>
            <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, margin: '6px 0 12px' }}>
              Group rules read profile attributes, so this edit can move group access.
            </div>

            <Pulse from={SHEET.at.arm} radius={9} color={UI.brand}>
              <Button tone="ghost" icon="chart">
                Analyze blast radius
              </Button>
            </Pulse>
          </div>

          <Report>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FilterPill selected>
                Groups
                <Count
                  from={SHEET.at.tally}
                  value={PREDICTED.length}
                  size={UI_TYPE.rowTitle}
                  color={UI.brandText}
                  rule="transparent"
                  style={{ fontWeight: 700 }}
                />
              </FilterPill>
              <FilterPill>
                Rules
                <Count
                  from={SHEET.at.tally + 3}
                  value={4}
                  size={UI_TYPE.rowTitle}
                  color={UI.faint}
                  rule="transparent"
                  style={{ fontWeight: 700 }}
                />
              </FilterPill>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PREDICTED.map((row, i) => (
                <PredictedRow key={row.group} from={SHEET.at.rows + i * ROW_STEP} row={row} />
              ))}
            </div>
          </Report>
        </Sheet>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.analyze}>BLAST</Super>
  </Stage>
);
