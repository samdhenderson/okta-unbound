/**
 * @module reel/ad/stabs/Predict
 * @description Stab 5: find out what breaks before you break it.
 *
 * Every other claim in this ad is about reading. This one is about writing, and
 * it is the one an admin's manager cares about: the panel will tell you who
 * falls out of a group before you switch the rule off, and it writes nothing to
 * do it.
 *
 * The count is the shot. A figure rolling up in alert colour under the words
 * `held by this rule alone` is the entire argument for a preflight, and it is
 * legible at any size on any screen, which is what an ad frame has to be.
 */
import React from 'react';
import { Count, Pulse, Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Badge, Body, Button, Card, Code, Panel, PageHeading, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const PREDICT_CUES = {
  /** The verb you are about to press. */
  arm: { verb: 'pulse' },
  /** What it answers, without writing anything. */
  preview: { verb: 'wipe', gap: 6 },
  /** The number that decides it. */
  count: { verb: 'count', gap: 4 },
  /** And the consequence, stated plainly. */
  consequence: { verb: 'snap', gap: 10, hold: 0.8 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(PREDICT_CUES);
export const PREDICT_FRAMES = SHEET.frames;

export const Predict: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 262, y: 382, scale: 1.68 }}>
      <Panel active={4}>
        <PageHeading
          title="Engineering by department"
          sub="Active  ·  1 target group  ·  1 attribute"
          right={<Badge tone="brand">0prFAKE...02</Badge>}
        />
        <Body style={{ paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Pulse from={SHEET.at.arm} radius={9} color={UI.brand}>
              <Button icon="users">Preview impact</Button>
            </Pulse>
            <div style={{ flex: 1 }} />
            <Button tone="ghost">More</Button>
          </div>

          <Code style={{ marginTop: 4 }}>{'user.department == "Engineering"'}</Code>

          <Wipe from={SHEET.at.preview} direction="down" edgeWidth={3}>
            <Card style={{ padding: 18, marginTop: 4 }}>
              <div
                style={{
                  fontSize: UI_TYPE.label,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: UI.muted,
                }}
              >
                If you switch this off
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
                <Count
                  from={SHEET.at.count}
                  value={94}
                  size={54}
                  color={UI.bad}
                  rule="transparent"
                  style={{ fontWeight: 700 }}
                />
                <div style={{ fontSize: UI_TYPE.rowTitle, color: UI.title, fontWeight: 600 }}>
                  members are held by this rule alone
                </div>
              </div>
              <Snap from={SHEET.at.consequence} edge="up" distance={18}>
                <Card
                  style={{
                    background: UI.badWash,
                    borderColor: '#f3c8bf',
                    padding: 14,
                    marginTop: 14,
                  }}
                >
                  <div style={{ fontSize: UI_TYPE.rowBody, color: UI.title, lineHeight: 1.5 }}>
                    <strong>Deactivate</strong> moves nobody. They stay, unexplained, reversibly.
                    <br />
                    <strong>Delete</strong> is the only verb that removes them, and it does not
                    reverse.
                  </div>
                </Card>
              </Snap>
              <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 12 }}>
                This preview writes nothing. It only tells you.
              </div>
            </Card>
          </Wipe>
        </Body>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.count}>PREDICT</Super>
  </Stage>
);
