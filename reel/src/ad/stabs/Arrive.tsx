/**
 * @module reel/ad/stabs/Arrive
 * @description Stab 2: the panel arrives beside the tab you already had open.
 *
 * The single most misunderstood thing about this product is where it lives.
 * People assume another console, another login, another place to go. It is a
 * side panel: it opens against the right edge of the Okta tab that is already
 * in front of you, using the session you are already signed in with.
 *
 * So this stab spends its whole second and a half on that one fact. The panel
 * snaps in from the right edge, which is the edge it really docks to, and its
 * tabs arrive left to right afterwards so the eye reads the shape of the thing
 * before it starts reading labels.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { STAGE } from '../../theme';
import { Snap, Wipe } from '../../verbs';
import { tempo } from '../../tempo';
import type { Cue } from '../../tempo';
import { PanelPlate, Stage } from '../stage';
import { Body, Panel, Row, SearchField, SectionLabel, TABS, UI, UI_TYPE } from '../ui';
import type { StabProps } from '../types';

export const ARRIVE_CUES = {
  /** The panel comes in off the right edge. */
  dock: { verb: 'snap' },
  /** Its tabs arrive, left to right. */
  tabs: { frames: 26, gap: 4 },
  /** The search field takes focus. */
  focus: { verb: 'wipe', gap: 2 },
  /** What you kept, already there. */
  pinned: { verb: 'snap', gap: 4, hold: 0.75 },
} as const satisfies Record<string, Cue>;

const SHEET = tempo(ARRIVE_CUES);
export const ARRIVE_FRAMES = SHEET.frames;

/** Frames between one tab appearing and the next. */
const TAB_STEP = 4;

/**
 * A finding's count, as Home prints one: a plain bold figure before the chevron.
 *
 * Not a badge. The product deliberately does not tone-colour these - a finding
 * is a number to go and look at, not a severity - and an ad that recoloured them
 * would be advertising a panel that does not exist.
 */
const Finding: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ fontSize: UI_TYPE.h1 - 6, fontWeight: 700, color: UI.title }}>{value}</div>
);

export const Arrive: React.FC<StabProps> = () => {
  const frame = useCurrentFrame();

  // The tab strip fills in by count rather than by animating each tab: the
  // strip is one object arriving in pieces, and animating seven separate icons
  // would read as seven objects.
  const revealedTabs = Math.max(
    0,
    Math.min(TABS.length, Math.floor((frame - SHEET.at.tabs) / TAB_STEP) + 1),
  );

  // The browser edge the panel docks against. Drawn as a soft vertical seam
  // rather than a chrome mockup: a fake browser window would be the one thing
  // in this ad pretending to be a screenshot.
  const seam = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Stage>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 640,
          background: `linear-gradient(90deg, rgba(255,255,255,.05), transparent)`,
          borderRight: `1px solid ${STAGE.rule}`,
          opacity: seam * 0.9,
        }}
      />
      <PanelPlate focus={{ y: 490, scale: 1.02 }}>
        <Snap from={SHEET.at.dock} edge="right" distance={520} overshoot={0.03}>
          <Panel active={0} revealedTabs={revealedTabs}>
            <Body>
              <Wipe from={SHEET.at.focus} edgeWidth={3}>
                <SearchField placeholder="Search groups, apps, users, rules, etc." focused />
              </Wipe>

              <div style={{ marginTop: 8 }}>
                <SectionLabel>Pinned</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Snap from={SHEET.at.pinned} edge="left" distance={40}>
                    <Row
                      icon="users"
                      title="Engineering - All"
                      sub="Group  ·  left on Attributes"
                      chevron={false}
                    />
                  </Snap>
                  <Snap from={SHEET.at.pinned + 5} edge="left" distance={40}>
                    <Row
                      icon="user"
                      title="Amara Okonkwo"
                      sub="User  ·  left on Groups  ·  2 days ago"
                      chevron={false}
                    />
                  </Snap>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <SectionLabel>This org</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Snap from={SHEET.at.pinned + 10} edge="left" distance={40}>
                    <Row
                      icon="rule"
                      title="Group rules paused"
                      sub="of 21 group rules"
                      right={<Finding value={1} />}
                    />
                  </Snap>
                  <Snap from={SHEET.at.pinned + 15} edge="left" distance={40}>
                    <Row
                      icon="users"
                      title="Groups with no members that no rule fills"
                      sub="of 37 groups"
                      right={<Finding value={3} />}
                    />
                  </Snap>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <SectionLabel>Reports</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Snap from={SHEET.at.pinned + 20} edge="left" distance={40}>
                    <Row
                      icon="app"
                      title="App access no rule maintains"
                      sub="of 37 groups"
                      right={<Finding value={5} />}
                    />
                  </Snap>
                  <Snap from={SHEET.at.pinned + 25} edge="left" distance={40}>
                    <Row icon="shield" title="MFA coverage for a group" sub="Pick a group" />
                  </Snap>
                </div>
              </div>
            </Body>
          </Panel>
        </Snap>
      </PanelPlate>
    </Stage>
  );
};
