/**
 * @module reel/ad/stabs/Prove
 * @description Stab 7: the evidence walks out as a file.
 *
 * Export is table stakes and the ad treats it as such: one stab, near the end,
 * no argument made for it. It is here because the question behind half of this
 * work is "prove it to an auditor", and an answer that only exists on screen
 * does not close that ticket.
 *
 * The columns fan because a fan is the verb for a set being offered, and the
 * rows cascade under the button because the file is the point rather than the
 * picker.
 */
import React from 'react';
import { Fan, FanChild, Pulse, Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Body, Button, Card, Panel, PageHeading, SectionLabel, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const PROVE_CUES = {
  /** The report you picked. */
  report: { verb: 'snap' },
  /** Its columns, offered. */
  columns: { verb: 'fan', gap: 4 },
  /** The button. */
  arm: { verb: 'pulse', gap: 6 },
  /** The file. */
  rows: { verb: 'wipe', gap: 2, hold: 0.7 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(PROVE_CUES);
export const PROVE_FRAMES = SHEET.frames;

/** The report's own column set, as the Export tab lists it. */
const COLUMNS = ['Group ID', 'Group', 'Finding', 'Caveat', 'Completeness'] as const;

/** Enough rows to read as a file rather than as a list. */
const SHEET_ROWS = 7;

export const Prove: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 272, y: 398, scale: 1.62 }}>
      <Panel active={6}>
        <PageHeading title="Export" sub="Download reports across your org" />
        <Body style={{ paddingTop: 14 }}>
          <Snap from={SHEET.at.report} edge="up" distance={20}>
            <div style={{ fontSize: UI_TYPE.h1 - 6, fontWeight: 700, color: UI.title }}>
              Report: App access no rule maintains
            </div>
          </Snap>

          <Card style={{ padding: 16 }}>
            <SectionLabel>Columns</SectionLabel>
            <Fan
              from={SHEET.at.columns}
              count={COLUMNS.length}
              style={{ display: 'flex', gap: 10 }}
            >
              {(i, releaseFrame) => (
                <FanChild from={releaseFrame}>
                  <div
                    style={{
                      padding: '9px 14px',
                      borderRadius: 8,
                      background: UI.brand,
                      color: '#ffffff',
                      fontSize: UI_TYPE.button,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {COLUMNS[i]}
                  </div>
                </FanChild>
              )}
            </Fan>
          </Card>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button tone="ghost">Preview</Button>
            <Pulse from={SHEET.at.arm} radius={9} color={UI.brand}>
              <Button icon="export">Download CSV</Button>
            </Pulse>
          </div>

          <Wipe from={SHEET.at.rows} direction="down" edgeWidth={3}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {Array.from({ length: SHEET_ROWS }, (_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 1,
                    borderBottom: i === SHEET_ROWS - 1 ? undefined : `1px solid ${UI.line}`,
                    background: i === 0 ? UI.canvas : UI.chrome,
                  }}
                >
                  {COLUMNS.map((column, c) => (
                    <div
                      key={column}
                      style={{
                        flex: c === 0 ? 1.2 : 1,
                        padding: '10px 12px',
                        fontSize: UI_TYPE.label + 1,
                        fontWeight: i === 0 ? 700 : 400,
                        color: i === 0 ? UI.muted : UI.body,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {i === 0 ? (
                        column
                      ) : (
                        <div
                          style={{
                            height: 8,
                            width: `${58 + ((i * 13 + c * 29) % 38)}%`,
                            borderRadius: 4,
                            background: UI.line,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          </Wipe>
        </Body>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.rows}>PROVE</Super>
  </Stage>
);
