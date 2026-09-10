/**
 * @module reel/ad/stabs/Why
 * @description Stab 3: every row says how it got there.
 *
 * This is the product's actual differentiator and it is a subtle one to film,
 * because the screen it happens on looks like a list. Any tool can list groups.
 * The claim here is in the third line of each row: `94 members`, `Source not
 * analyzed`, `Fed by 1 rule`, `Pushed to 1 app`. That line is provenance, and it
 * is the difference between a directory and an explanation.
 *
 * So the stab pushes in until that line is the largest thing on screen, arrives
 * the rows one at a time so the eye has somewhere to land, and then strikes
 * under the one phrase that answers the question the hook asked.
 */
import React from 'react';
import { STAGE } from '../../theme';
import { Pulse, Snap, Strike } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage, Super } from '../stage';
import { Badge, Body, Button, Meta, Panel, PageHeading, Row, SearchField, UI } from '../ui';
import type { StabProps } from '../types';

export const WHY_CUES = {
  /** The roster arrives, row by row. */
  roster: { verb: 'snap', gap: 6 },
  /** The word this whole stab is about. */
  mark: { verb: 'strike', gap: 16 },
  /** And a beat on it. */
  beat: { verb: 'pulse', gap: 2, hold: 1.05 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(WHY_CUES);
export const WHY_FRAMES = SHEET.frames;

/** Frames between one row landing and the next. */
const ROW_STEP = 6;

/** The demo org's own groups, in the order the tab sorts them. */
const GROUPS = [
  {
    name: 'Dormant - 120d',
    tag: 'OKTA',
    sub: 'No sign-in in 120 days. Review for deactivation.',
    members: 29,
    source: 'Source not analyzed',
    fed: null,
  },
  {
    name: 'Engineering - All',
    tag: 'OKTA',
    sub: 'Every engineer, rule-assigned by department',
    members: 94,
    source: 'Source not analyzed',
    fed: 'Fed by 1 rule',
  },
  {
    name: 'Everyone',
    tag: 'BUILT-IN',
    sub: 'All users in your organization',
    members: 250,
    source: 'Source not analyzed',
    fed: null,
  },
] as const;

export const Why: React.FC<StabProps> = () => (
  <Stage>
    <PanelPlate focus={{ x: 272, y: 405, scale: 1.62 }}>
      <Panel active={2} context="Engineering - All">
        <PageHeading title="Groups" right={<Badge tone="good">37 Cached</Badge>} />
        <Body style={{ paddingTop: 14 }}>
          {/*
            The tab's own toolbar, not a caption invented for the ad. Everything
            inside the panel in this film is something the product actually
            renders; the argument about what the rows mean is made on the stage,
            by the super, where it is obviously the advertisement talking.
          */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button icon="export">Export list</Button>
            <Button tone="ghost" icon="search">
              Cross-search
            </Button>
            <div style={{ flex: 1 }} />
            <Button tone="ghost">More</Button>
          </div>
          <SearchField placeholder="Search by name, description, ID  or /regex/" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {GROUPS.map((group, i) => (
              <Snap
                key={group.name}
                from={SHEET.at.roster + i * ROW_STEP}
                edge="left"
                distance={44}
              >
                <Row
                  title={
                    <>
                      {group.name}
                      <Badge tone={group.tag === 'OKTA' ? 'brand' : 'neutral'}>{group.tag}</Badge>
                    </>
                  }
                  sub={group.sub}
                  meta={
                    <>
                      <Meta value={group.members} unit="members" />
                      <span style={{ fontStyle: 'italic', color: UI.faint }}>{group.source}</span>
                      {group.fed && (
                        // The one phrase the stab is about, so it is the one
                        // thing here that carries a verb.
                        <span
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Pulse from={SHEET.at.beat} color={UI.brand} radius={6} swell={0.08}>
                            <span style={{ color: UI.brandText, fontWeight: 600 }}>
                              {group.fed}
                            </span>
                          </Pulse>
                          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -7 }}>
                            <Strike from={SHEET.at.mark} color={UI.brand} weight={2} />
                          </div>
                        </span>
                      )}
                    </>
                  }
                />
              </Snap>
            ))}
          </div>
        </Body>
      </Panel>
    </PanelPlate>
    <Super from={SHEET.at.mark} tone={STAGE.ink}>
      WHY
    </Super>
  </Stage>
);
