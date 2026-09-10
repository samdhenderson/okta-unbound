/**
 * @module reel/ad/stabs/Compare
 * @description Stab 4: the difference is one character.
 *
 * The film spends a whole chapter on this and earns it. The ad has a second and
 * a half, so it skips the comparison and shows only the finding: a rule that
 * reads `user.department == "Engineering"`, and a profile that resolved to
 * `"Enginering"`. Nobody needs the intermediate steps explained to feel that.
 *
 * Everything in this frame is at rest except the missing character. The value
 * wipes in, the clause it failed is struck, and the typo beats once. That is
 * three verbs on one idea, which is the most an ad can spend anywhere and the
 * right place to spend it: this is the shot people will remember.
 */
import React from 'react';
import { Pulse, Snap, Strike, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Badge, Body, Card, Code, Icon, Panel, PageHeading, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const COMPARE_CUES = {
  /** The finding card arrives. */
  card: { verb: 'snap' },
  /** The clause that failed. */
  clause: { verb: 'wipe', gap: 8 },
  /** The value the rule actually read. */
  resolved: { verb: 'wipe', gap: 4 },
  /** Struck through, and beaten once. */
  mark: { verb: 'strike', gap: 8 },
  beat: { verb: 'pulse', gap: 2, hold: 0.75 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(COMPARE_CUES);
export const COMPARE_FRAMES = SHEET.frames;

export const Compare: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 265, y: 404, scale: 1.66 }}>
      <Panel active={1} context="Amara Okonkwo" contextIcon="user">
        <PageHeading
          title="Compare users"
          sub="Access Amara Okonkwo has that Priya Achterberg does not, grouped by what would close it."
          right={<Badge tone="brand">4 Groups</Badge>}
        />
        <Body style={{ paddingTop: 14 }}>
          <Snap from={SHEET.at.card} edge="up" distance={30}>
            <Card style={{ background: UI.warnWash, borderColor: '#e8dda8', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="warning" size={20} color={UI.warn} />
                <div style={{ fontSize: UI_TYPE.rowTitle, fontWeight: 700, color: UI.title }}>
                  Fix a profile attribute
                </div>
                <div style={{ flex: 1 }} />
                <Badge tone="neutral">1 group</Badge>
              </div>
              <div style={{ fontSize: UI_TYPE.rowBody, color: UI.body, margin: '8px 0 14px 30px' }}>
                A rule feeds this group and a clause that was actually checked failed.
              </div>

              <Card style={{ padding: 16 }}>
                <div style={{ fontSize: UI_TYPE.rowTitle, fontWeight: 700, color: UI.title }}>
                  Engineering - All
                </div>
                <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 4 }}>
                  Rule: <strong style={{ color: UI.title }}>Engineering by department</strong>
                </div>
                <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, margin: '10px 0 8px' }}>
                  1 failing clause
                </div>

                <Wipe from={SHEET.at.clause} edgeWidth={3}>
                  <Code>
                    {'user.department == '}
                    <span style={{ color: UI.brandText }}>{'"Engineering"'}</span>
                  </Code>
                </Wipe>

                <div style={{ position: 'relative', marginTop: 8 }}>
                  <Wipe from={SHEET.at.resolved} edgeWidth={3} edgeColor={UI.bad}>
                    <Code style={{ background: UI.badWash }}>
                      {'Resolved value:   '}
                      <Pulse
                        from={SHEET.at.beat}
                        color={UI.bad}
                        radius={5}
                        swell={0.14}
                        style={{ verticalAlign: 'middle' }}
                      >
                        <span style={{ color: UI.bad, fontWeight: 700 }}>{'"Enginering"'}</span>
                      </Pulse>
                    </Code>
                  </Wipe>
                </div>

                <div style={{ marginTop: 12, width: 220 }}>
                  <Strike from={SHEET.at.mark} color={UI.bad} weight={3} />
                </div>
              </Card>
            </Card>
          </Snap>
        </Body>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.mark}>COMPARE</Super>
  </Stage>
);
