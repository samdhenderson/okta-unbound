/**
 * @module reel/ad/stabs/Fix
 * @description Stab 6: and then fix it, right where you found it.
 *
 * The reason this stab exists is that the previous five are all diagnosis, and
 * diagnosis is where every other tool in this category stops. A report tells you
 * the department is mistyped and then hands the problem to whoever has write
 * access. Here the field is editable in the same panel that found the fault, the
 * rule re-reads it on save, and the group count moves while you are still
 * looking at it.
 *
 * The value correcting itself in place is the only moment in this ad where the
 * product changes something. It gets the wipe, the save gets the snap, and the
 * count gets the roll: three verbs describing one save, in that order, because
 * that is the order the admin experiences them in.
 */
import React from 'react';
import { Count, Pulse, Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Badge, Body, Button, Card, Icon, Panel, PageHeading, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const FIX_CUES = {
  /** The field, as it was. */
  field: { verb: 'snap' },
  /** Corrected in place. */
  edit: { verb: 'wipe', gap: 10 },
  /** Saved. */
  save: { verb: 'pulse', gap: 6 },
  /** The rule rereads it, and her groups move. */
  land: { verb: 'count', gap: 8, hold: 0.8 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(FIX_CUES);
export const FIX_FRAMES = SHEET.frames;

export const Fix: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 265, y: 392, scale: 1.66 }}>
      <Panel active={1} context="Amara Okonkwo" contextIcon="user">
        <PageHeading
          title="Priya Achterberg"
          sub="ACTIVE  ·  00uFAKE0000000000031"
          right={<Button tone="ghost">Open in Okta</Button>}
        />
        <Body style={{ paddingTop: 14 }}>
          <Snap from={SHEET.at.field} edge="up" distance={22}>
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: UI_TYPE.rowTitle, fontWeight: 700, color: UI.title }}>
                  Profile
                </div>
                <Badge tone="neutral">25 attributes</Badge>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: UI_TYPE.rowBody, color: UI.muted }}>1 change</span>
                <Pulse from={SHEET.at.save} radius={9} color={UI.brand}>
                  <Button>Save</Button>
                </Pulse>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: `1px solid ${UI.line}`,
                }}
              >
                <div style={{ width: 150, fontSize: UI_TYPE.rowBody, color: UI.muted }}>
                  department
                </div>
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                    padding: '11px 14px',
                    border: `2px solid ${UI.brand}`,
                    borderRadius: 9,
                    background: UI.chrome,
                    fontSize: UI_TYPE.rowTitle,
                    color: UI.title,
                  }}
                >
                  {/*
                    The wrong value is underneath and the right one wipes across
                    it, rather than the two being cut. A cut would read as a
                    different screen; a wipe reads as one field being corrected,
                    which is what actually happens.
                  */}
                  <span style={{ color: UI.faint, textDecoration: 'line-through' }}>
                    Enginering
                  </span>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <Wipe from={SHEET.at.edit} edgeWidth={3}>
                      <div
                        style={{
                          padding: '11px 14px',
                          background: UI.chrome,
                          fontSize: UI_TYPE.rowTitle,
                          fontWeight: 600,
                          color: UI.title,
                          borderRadius: 7,
                        }}
                      >
                        Engineering
                      </div>
                    </Wipe>
                  </div>
                </div>
                <Badge tone="brand">read by 1 rule</Badge>
              </div>
            </Card>
          </Snap>

          <Snap from={SHEET.at.land} edge="up" distance={20}>
            <Card style={{ padding: 18, background: UI.goodWash, borderColor: '#b7e6c8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Icon name="check" size={22} color={UI.good} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: UI_TYPE.rowTitle, color: UI.title }}>Groups</span>
                  <Count
                    from={SHEET.at.land}
                    value={5}
                    size={44}
                    color={UI.good}
                    rule="transparent"
                    style={{ fontWeight: 700 }}
                  />
                </div>
                <div style={{ fontSize: UI_TYPE.rowBody, color: UI.title }}>
                  Rule reevaluated on save · 1 group added
                </div>
              </div>
            </Card>
          </Snap>
        </Body>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.edit}>FIX</Super>
  </Stage>
);
