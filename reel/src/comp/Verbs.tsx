/**
 * @module reel/comp/Verbs
 * @description A scrubbable verb matrix: the six-verb grammar (plus the pencil
 * treatment's `draw`), each applied to the same three stand-in nouns, so the
 * repetition that makes a grammar read as designed is visible on one screen.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, "Section A - the animation
 * grammar" and `RevealLanguage.dc.html`'s own verb x object matrix are the
 * layout intent this composition makes scrubbable: rows are verbs, columns are
 * nouns, and the same verb runs at the same phase across every column in its
 * row so a viewer can compare identical timing on different objects at a
 * glance.
 *
 * This is a **preview harness**, not film content - no chapter, no beats tied
 * to a script, nothing here is ever cut into the reel. It exists so a verb's
 * motion can be judged by eye before three set pieces are built on top of it.
 *
 * ## Looping without `<Sequence>`
 *
 * Every verb in `reel/verbs/` and `reel/pencil/` is authored in the
 * composition's own absolute frames and clamps cleanly outside its own
 * window (see `useVerb.ts`'s module doc for why `<Sequence>` is banned here).
 * That clamping is what makes looping cheap: recomputing a cell's own `from`
 * with {@link loopFrom} is enough, because every verb already renders its
 * "before" pose for any frame earlier than `from` and its "settled" pose for
 * any frame past `from + <its own total>`. No manual reset logic is needed -
 * the jump from a held, settled pose back to the next cycle's "before" pose at
 * the loop boundary is a hard cut between two frames, not a fade.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { STAGE, TYPE, FRAMES, INTER, COLOR } from '../theme';
import { Dock, Lift, Count, Split, Fan, FanChild, Recede } from '../verbs';
import { SketchBox, Written, draw as pencilDraw } from '../pencil';

/** Ten seconds at the film's 60fps - several loops of every row after the stagger settles. */
export const VERBS_FRAMES = 600;

/** Frames between one row's cycle and the next row's, so a first pass can follow one verb at a time. */
const ROW_STAGGER = 24;

/**
 * A cell's own periodic `from`, given its row's stagger offset and its own
 * loop period. See the module doc: every verb clamps cleanly outside
 * `[from, from + total]`, so recomputing `from` this way is the entire
 * looping mechanism - there is nothing else to reset.
 */
function loopFrom(frame: number, stagger: number, period: number): number {
  // Before a row's own stagger offset, its first cycle has not started yet -
  // clamp to `stagger` itself rather than let the floor division wrap
  // negative and hand back a `from` from an imaginary earlier cycle (which
  // would show the row mid-hold, or already receded, before its staggered
  // entrance is supposed to happen at all).
  if (frame < stagger) return stagger;
  return stagger + Math.floor((frame - stagger) / period) * period;
}

// ---------------------------------------------------------------------------
// Three stand-in nouns, reused down every row. Repetition of the same three
// objects across seven verbs is the point of the matrix, not an accident of
// laziness - see the module doc.
// ---------------------------------------------------------------------------

// Light canvas, not `STAGE.plate` - `RuleCard` and `MemberRow` stand in for the
// product's own light UI (per the design doc's "product tokens... used inside
// every synthetic surface" convention), so lift/split/fan/recede's shadow
// language reads against the dark backdrop instead of disappearing into a
// dark-on-dark card.
const RuleCard: React.FC<{ status?: string }> = ({ status = 'active' }) => (
  <div
    style={{
      width: 190,
      padding: '10px 16px',
      background: COLOR.canvas,
      border: `1px solid ${COLOR['neutral-300']}`,
      borderRadius: 10,
    }}
  >
    <div style={{ fontSize: TYPE.body, fontWeight: 600, color: COLOR['neutral-900'] }}>
      Rule card
    </div>
    <div style={{ fontSize: TYPE.unit, color: COLOR['neutral-600'], marginTop: 4 }}>
      status: {status}
    </div>
  </div>
);

// `width` defaults to fit the harness's own longest label
// (`jane.doe@example.com`) at `TYPE.label` with real padding on both sides -
// at `TYPE.body` (27px, the plate's title size) the full address plus its
// leading dot and trailing chevron ran wider than the 260px plate, printing
// its tail dark-on-dark against the stage past the plate's own right edge.
// `TYPE.label` reads as "row copy," same as the product's own list rows, and
// leaves room for a plate a caller can still narrow (see the SPLIT row's
// shorter "before edit"/"after edit" labels) without either fault recurring.
const MemberRow: React.FC<{ label?: string; width?: number }> = ({
  label = 'jane.doe@example.com',
  width = 340,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width,
      padding: '8px 14px',
      background: COLOR.canvas,
      borderBottom: `1px solid ${COLOR['neutral-300']}`,
    }}
  >
    <div
      style={{ width: 10, height: 10, borderRadius: 5, background: COLOR.primary, flexShrink: 0 }}
    />
    <div
      style={{ fontSize: TYPE.label, color: COLOR['neutral-900'], flex: 1, whiteSpace: 'nowrap' }}
    >
      {label}
    </div>
    <div style={{ fontSize: TYPE.label, color: COLOR['neutral-600'] }}>{'›'}</div>
  </div>
);

// Genuinely smaller boxes for `fan`'s released children, not a `transform:
// scale(...)` on the full-size components - a CSS transform is paint-only and
// leaves the untransformed layout box (190px, 260px) in the flex flow, which
// overflowed a fanned row of three into the next grid column the first time
// this was tried with `scale()` on `RuleCard`/`MemberRow` directly.
const MiniRuleCard: React.FC<{ status?: string }> = ({ status = 'active' }) => (
  <div
    style={{
      width: 108,
      padding: '6px 10px',
      background: COLOR.canvas,
      border: `1px solid ${COLOR['neutral-300']}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 15, fontWeight: 600, color: COLOR['neutral-900'] }}>Rule card</div>
    <div style={{ fontSize: 11, color: COLOR['neutral-600'], marginTop: 2 }}>{status}</div>
  </div>
);

const MiniMemberRow: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: 150,
      padding: '5px 8px',
      background: COLOR.canvas,
      borderBottom: `1px solid ${COLOR['neutral-300']}`,
    }}
  >
    <div
      style={{ width: 6, height: 6, borderRadius: 3, background: COLOR.primary, flexShrink: 0 }}
    />
    <div
      style={{
        fontSize: 13,
        color: COLOR['neutral-900'],
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {label}
    </div>
  </div>
);

const Tally: React.FC<{ value: number; unit?: string; size?: number }> = ({
  value,
  unit = 'members',
  size = 56,
}) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
    <div
      style={{
        fontSize: size,
        fontWeight: 700,
        color: STAGE.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: TYPE.unit, color: STAGE.inkDim }}>{unit}</div>
  </div>
);

/** A small caption under every cell: the verb name and its own frame count. Every cell, per the brief. */
const CellLabel: React.FC<{ text: string; marginTop?: number }> = ({ text, marginTop = 8 }) => (
  <div
    style={{
      marginTop,
      fontSize: TYPE.unit,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: STAGE.inkDim,
    }}
  >
    {text}
  </div>
);

// `Dock`'s own hairline (see `verbs/Dock.tsx`) sits `marginTop: 22` under the
// object's resting box and is 3px tall - it is positioned absolutely, so it
// adds nothing to the flow height the caption's own default 8px margin is
// measured from. A caption at the default gap lands inside the hairline's
// [22, 25] band and gets struck through by it (visible on every DOCK cell).
// This gap clears the hairline and its own 3px with a few px of daylight
// besides.
const DOCK_LABEL_GAP = 34;

/** One cell: an object plus its caption, centred in its grid column. */
const Cell: React.FC<{
  label: string;
  children: React.ReactNode;
  /** Extra vertical clearance before the caption - see {@link DOCK_LABEL_GAP}. */
  labelGap?: number;
  /** Centre the object within the column instead of hugging its left edge -
   * `split`'s halves travel outward from the object's own resting centre, so
   * a left-hugged cell leaves almost no margin on one side and the departing
   * half runs into the previous column (see the SPLIT row's own comment). */
  center?: boolean;
}> = ({ label, children, labelGap, center }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: center ? 'center' : 'flex-start',
      minWidth: 0,
    }}
  >
    {children}
    <CellLabel text={label} marginTop={labelGap} />
  </div>
);

/** One row: the verb's own label at left, three cells to its right. */
const Row: React.FC<{
  name: string;
  cells: [React.ReactNode, React.ReactNode, React.ReactNode];
}> = ({ name, cells }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '170px repeat(3, 1fr)',
      columnGap: 16,
      alignItems: 'center',
      minHeight: 100,
    }}
  >
    <div style={{ fontSize: TYPE.claim, fontWeight: 700, color: STAGE.ink }}>{name}</div>
    {cells}
  </div>
);

// ---------------------------------------------------------------------------
// Pencil-row timing: not part of `verbs/ease.ts`'s `FRAMES` (draw is the
// seventh verb, scoped to `pencil/` - see `verbs/index.ts`'s module doc for
// why it stays out of that barrel). Stated here, once, for this harness.
// ---------------------------------------------------------------------------
const DRAW_BOX_FRAMES = 36;
const DRAW_TEXT_OFFSET = 26;
const DRAW_TEXT_FRAMES = 24;

// Column 1's box ends at y=56 (`y=6, height=50`) and its label sits at
// `y=78` - 22px of clearance between the box's bottom edge and the label's
// baseline, enough that the label's own ascent never reaches the sketched
// line above it. Columns 2 and 3 previously placed their labels only 12px
// and 18px below their own box's bottom edge, close enough that the label's
// ascent overlapped the box outline ("jane.doe@example.cor" and "94" both
// printed on top of the sketch). Deriving every column's label `y` from its
// own box bottom plus this same clearance keeps the three columns visually
// consistent instead of each carrying its own hand-tuned offset.
const DRAW_LABEL_CLEARANCE = 30;

/**
 * `Verbs`. A grid of seven verb rows (`dock`, `lift`, `count`, `split`, `fan`,
 * `recede`, and the pencil layer's `draw`) by three stand-in-noun columns
 * (a rule card, a member row, a tally), each cell looping independently on
 * its own verb-native period. See the module doc.
 */
export const Verbs: React.FC = () => {
  const frame = useCurrentFrame();

  // --- dock: 22f, hold 90f, then the loop boundary cuts straight back to the
  // off-stage/invisible pose Dock already renders for any frame before `from`.
  const dockFrom = loopFrom(frame, 0 * ROW_STAGGER, FRAMES.dockTotal + 90);

  // --- lift: 13f, hold 90f. `LiftPlate`'s full-frame dim is deliberately not
  // used here - it is a sibling of the composition root, not a per-cell
  // effect, and three simultaneous full-frame dims fighting over one stage
  // would misrepresent the verb rather than demonstrate it. See the report.
  const liftFrom = loopFrom(frame, 1 * ROW_STAGGER, FRAMES.lift + 90);

  // --- count: the longest column (3 digits) finishes at
  // 2*countColumnOffset + countRoll + countAffirmSettle; hold 90f past that.
  const countTotal = 2 * FRAMES.countColumnOffset + FRAMES.countRoll + FRAMES.countAffirmSettle;
  const countFrom = loopFrom(frame, 2 * ROW_STAGGER, countTotal + 90);

  // --- split: open (19f), hold (90f), close (19f) - the halves are whole
  // again by the time the loop wraps, so the cut is seamless rather than hard.
  const splitPeriod = FRAMES.split + 90 + FRAMES.split;
  const splitOpenFrom = loopFrom(frame, 3 * ROW_STAGGER, splitPeriod);
  const splitCloseFrom = splitOpenFrom + FRAMES.split + 90;

  // --- fan: 26f, hold 90f.
  const fanFrom = loopFrom(frame, 4 * ROW_STAGGER, FRAMES.fanTotal + 90);

  // --- recede: hold visible 60f, then recede (19f), then hold gone 40f.
  const recedePeriod = 60 + FRAMES.recede + 40;
  const recedeCellFrom = loopFrom(frame, 5 * ROW_STAGGER, recedePeriod);
  const recedeFrom = recedeCellFrom + 60;

  // --- draw: box (36f), label starts 26f in and runs 24f more (50f total), hold 90f.
  const drawPeriod = DRAW_TEXT_OFFSET + DRAW_TEXT_FRAMES + 90;
  const drawFrom = loopFrom(frame, 6 * ROW_STAGGER, drawPeriod);

  return (
    <AbsoluteFill style={{ background: STAGE.back, fontFamily: INTER }}>
      <div style={{ padding: '20px 40px 0' }}>
        <div style={{ fontSize: TYPE.claim, fontWeight: 700, color: STAGE.ink }}>
          The verb matrix
        </div>
        <div style={{ fontSize: TYPE.label, color: STAGE.inkDim, marginTop: 6 }}>
          Seven verbs, three nouns each: a rule card, a member row, a tally. Every row runs the same
          verb at the same phase across all three columns.
        </div>
      </div>

      <div style={{ padding: '14px 40px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Row
          name="DOCK"
          cells={[
            <Cell key="c1" label={`${FRAMES.dockTotal}F`} labelGap={DOCK_LABEL_GAP}>
              <Dock from={dockFrom}>
                <RuleCard />
              </Dock>
            </Cell>,
            <Cell key="c2" label={`${FRAMES.dockTotal}F`} labelGap={DOCK_LABEL_GAP}>
              <Dock from={dockFrom}>
                <MemberRow />
              </Dock>
            </Cell>,
            <Cell key="c3" label={`${FRAMES.dockTotal}F`} labelGap={DOCK_LABEL_GAP}>
              <Dock from={dockFrom}>
                <Tally value={94} />
              </Dock>
            </Cell>,
          ]}
        />

        <Row
          name="LIFT"
          cells={[
            <Cell key="c1" label={`${FRAMES.lift}F`}>
              <Lift from={liftFrom}>
                <RuleCard />
              </Lift>
            </Cell>,
            <Cell key="c2" label={`${FRAMES.lift}F`}>
              <Lift from={liftFrom}>
                <MemberRow />
              </Lift>
            </Cell>,
            <Cell key="c3" label={`${FRAMES.lift}F`}>
              <Lift from={liftFrom}>
                <Tally value={94} />
              </Lift>
            </Cell>,
          ]}
        />

        <Row
          name="COUNT"
          cells={[
            <Cell key="c1" label={`${FRAMES.countRoll}F ROLL, ${FRAMES.countAffirmSettle}F AFFIRM`}>
              <div
                style={{
                  padding: '10px 16px',
                  background: STAGE.plate,
                  border: `1px solid ${STAGE.rule}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: TYPE.unit,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: STAGE.inkDim,
                    marginBottom: 4,
                  }}
                >
                  Members filled
                </div>
                <Count from={countFrom} value={93} size={40} />
              </div>
            </Cell>,
            <Cell key="c2" label={`${FRAMES.countRoll}F ROLL, ${FRAMES.countAffirmSettle}F AFFIRM`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: 260,
                  padding: '8px 14px',
                  borderBottom: `1px solid ${STAGE.rule}`,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 5, background: STAGE.accent }} />
                <div style={{ fontSize: TYPE.body, color: STAGE.ink, flex: 1 }}>Engineering</div>
                <Count from={countFrom} value={12} size={27} unit="apps" />
              </div>
            </Cell>,
            <Cell key="c3" label={`${FRAMES.countRoll}F ROLL, ${FRAMES.countAffirmSettle}F AFFIRM`}>
              <Count from={countFrom} value={930} unit="events" size={56} />
            </Cell>,
          ]}
        />

        {/* `Split`'s halves travel outward from the object's own resting
            position via `transform`, which never changes its layout box - so
            a cell that hugs its column's left edge (every other row's
            default) leaves the departing left half nothing but the gutter to
            travel into, and at this row's gap widths that gutter is narrower
            than the travel. Centring each cell (`center`) gives both halves
            equal room on either side of the column instead. */}
        <Row
          name="SPLIT"
          cells={[
            <Cell key="c1" label={`${FRAMES.split}F`} center>
              <Split
                from={splitOpenFrom}
                close={splitCloseFrom}
                gap={140}
                tilt={[-4, 4]}
                left={<RuleCard status="expected" />}
                right={<RuleCard status="actual" />}
              />
            </Cell>,
            <Cell key="c2" label={`${FRAMES.split}F`} center>
              <Split
                from={splitOpenFrom}
                close={splitCloseFrom}
                gap={100}
                // Narrower than the row's other `MemberRow`s: "before
                // edit"/"after edit" are short enough not to need the wider
                // default plate, and a narrower pair leaves more of the
                // column's own gutter free for the halves' travel.
                left={<MemberRow label="before edit" width={220} />}
                right={<MemberRow label="after edit" width={220} />}
              />
            </Cell>,
            <Cell key="c3" label={`${FRAMES.split}F`} center>
              <Split
                from={splitOpenFrom}
                close={splitCloseFrom}
                gap={130}
                left={<Tally value={8} unit="before" />}
                right={<Tally value={12} unit="after" />}
                delta={
                  <div
                    style={{
                      width: 130,
                      height: 3,
                      background: STAGE.alert,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -26,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: TYPE.unit,
                        color: STAGE.alert,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      plus 4 members
                    </div>
                  </div>
                }
              />
            </Cell>,
          ]}
        />

        <Row
          name="FAN"
          cells={[
            <Cell key="c1" label={`${FRAMES.fanTotal}F, ${FRAMES.fanStagger}F APART`}>
              <Fan from={fanFrom} count={3} style={{ display: 'flex', gap: 10 }}>
                {(i, releaseFrame) => (
                  <FanChild from={releaseFrame} angle={(i - 1) * 10}>
                    <MiniRuleCard status={i === 1 ? 'active' : 'draft'} />
                  </FanChild>
                )}
              </Fan>
            </Cell>,
            <Cell key="c2" label={`${FRAMES.fanTotal}F, ${FRAMES.fanStagger}F APART`}>
              <Fan from={fanFrom} count={3} style={{ display: 'flex', gap: 10 }}>
                {(i, releaseFrame) => (
                  <FanChild from={releaseFrame} angle={(i - 1) * 6}>
                    <MiniMemberRow label={`member ${i + 1}`} />
                  </FanChild>
                )}
              </Fan>
            </Cell>,
            <Cell key="c3" label={`${FRAMES.fanTotal}F, ${FRAMES.fanStagger}F APART`}>
              <Fan from={fanFrom} count={3} style={{ display: 'flex', gap: 20 }}>
                {(i, releaseFrame) => (
                  <FanChild from={releaseFrame} angle={(i - 1) * 10}>
                    <Tally value={[2, 4, 12][i]} unit={['rules', 'groups', 'apps'][i]} size={32} />
                  </FanChild>
                )}
              </Fan>
            </Cell>,
          ]}
        />

        <Row
          name="RECEDE"
          cells={[
            <Cell key="c1" label={`${FRAMES.recede}F`}>
              <Recede from={recedeFrom}>
                <RuleCard />
              </Recede>
            </Cell>,
            <Cell key="c2" label={`${FRAMES.recede}F`}>
              <Recede from={recedeFrom}>
                <MemberRow />
              </Recede>
            </Cell>,
            <Cell key="c3" label={`${FRAMES.recede}F`}>
              <Recede from={recedeFrom}>
                <Tally value={94} />
              </Recede>
            </Cell>,
          ]}
        />

        <Row
          name="DRAW"
          cells={[
            <Cell key="c1" label={`${DRAW_BOX_FRAMES}F BOX, ${DRAW_TEXT_FRAMES}F LABEL`}>
              <svg width={210} height={100} viewBox="0 0 210 100">
                <SketchBox
                  x={8}
                  y={6}
                  width={160}
                  height={50}
                  p={pencilDraw(frame, drawFrom, DRAW_BOX_FRAMES)}
                  seed={1}
                />
                <Written
                  x={12}
                  y={6 + 50 + DRAW_LABEL_CLEARANCE}
                  text="Rule card"
                  p={pencilDraw(frame, drawFrom + DRAW_TEXT_OFFSET, DRAW_TEXT_FRAMES)}
                  size={20}
                  weight={600}
                />
              </svg>
            </Cell>,
            <Cell key="c2" label={`${DRAW_BOX_FRAMES}F BOX, ${DRAW_TEXT_FRAMES}F LABEL`}>
              {/* Wider than the 248px box it contains: `Written` reveals the full
                  measured width of its text, and `jane.doe@example.com` at 18px
                  runs to the old 260px viewport edge, where the SVG clipped its
                  last glyph. The box sets the drawing, the viewport must fit the
                  longest thing drawn in it. */}
              <svg width={320} height={92} viewBox="0 0 320 92">
                <SketchBox
                  x={6}
                  y={6}
                  width={248}
                  height={40}
                  p={pencilDraw(frame, drawFrom, DRAW_BOX_FRAMES)}
                  seed={5}
                />
                <Written
                  x={14}
                  y={6 + 40 + DRAW_LABEL_CLEARANCE}
                  text="jane.doe@example.com"
                  p={pencilDraw(frame, drawFrom + DRAW_TEXT_OFFSET, DRAW_TEXT_FRAMES)}
                  size={18}
                  weight={400}
                />
              </svg>
            </Cell>,
            <Cell key="c3" label={`${DRAW_BOX_FRAMES}F BOX, ${DRAW_TEXT_FRAMES}F LABEL`}>
              <svg width={130} height={108} viewBox="0 0 130 108">
                <SketchBox
                  x={6}
                  y={6}
                  width={90}
                  height={56}
                  p={pencilDraw(frame, drawFrom, DRAW_BOX_FRAMES)}
                  seed={9}
                />
                <Written
                  x={16}
                  y={6 + 56 + DRAW_LABEL_CLEARANCE}
                  text="94"
                  p={pencilDraw(frame, drawFrom + DRAW_TEXT_OFFSET, DRAW_TEXT_FRAMES)}
                  size={24}
                  weight={700}
                />
              </svg>
            </Cell>,
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};
