/**
 * @module reel/showcase
 * @description Product components, rebuilt for the camera.
 *
 * A diagram (`reel/diagrams`) enlarges a *figure*. A showcase enlarges a
 * *component*: it draws the thing the panel draws, at frame resolution, in the
 * arrangement the app puts it in — and then reveals it in a way the extension
 * would never ship. Icons land before their rows. Bars grow from nothing.
 * Legends arrive one dot at a time. None of that happens in the product, and
 * none of it should: a settings panel that performed like this on every render
 * would be unbearable. In a film it is the difference between "here is a card"
 * and "here is what the card is telling you".
 *
 * ## Why these are hand-written rather than filmed
 *
 * Filming a component would mean a second capture mode, and the footage would
 * still animate the way the app animates, which is exactly the constraint this
 * layer exists to escape. Filming and then animating the pixels is worse still:
 * a bitmap cannot stagger its own rows.
 *
 * The cost is honest and worth naming: this is a second implementation of the
 * product's surfaces, and it can drift from the real ones. Two things keep the
 * drift from mattering. Every *number* comes from the capture's `figures`, read
 * off the running panel, so the data cannot drift even if the styling does. And
 * a showcase is always cut against footage of the real component in the same
 * chapter — the film never asserts a component exists without also showing it.
 *
 * This is not the thing ADR-0045 rules out. Mounting the *extension's own*
 * React inside Remotion is still banned, and for the same reason: its motion is
 * CSS transitions on `--dur-*` tokens, which a frame-indexed renderer does not
 * advance. Everything here is driven by `useCurrentFrame`.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Rect } from '../layout';
import { COLOR, STAGE, TYPE } from '../theme';

/** Where a showcase may draw, in frame pixels. */
export type Plot = Rect;

/** A plot as CSS. `x`/`y` are not CSS properties; see `reel/diagrams`. */
const at = (plot: Plot): React.CSSProperties => ({
  position: 'absolute',
  left: plot.x,
  top: plot.y,
  width: plot.width,
  height: plot.height,
});

/**
 * The stagger every showcase is built on.
 *
 * One spring per item, offset by its index. Returned rather than applied, so a
 * component can spend the same value on opacity, on a rise, and on the width of
 * a bar, and have all three arrive as one gesture instead of three that overlap.
 */
function useStagger(from: number, count: number, step = 5) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Array.from({ length: count }, (_, i) =>
    spring({
      frame: frame - from - i * step,
      fps,
      config: { damping: 200, mass: 0.7 },
    }),
  );
}

/**
 * The card the app puts things in.
 *
 * `rounded-lg border border-neutral-200 bg-white` at panel scale, lifted onto
 * the dark stage: on this backdrop a white card would flare, so the surface is
 * the stage's own plate and the border is its rule. The *shape* is the
 * product's; the value is not, and could not be.
 */
const Card: React.FC<{
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ style, children }) => (
  <div
    style={{
      background: STAGE.plate,
      border: `1px solid ${STAGE.rule}`,
      borderRadius: 14,
      padding: 22,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A segmented proportion bar, the shape `AttributeCard` draws. */
const Bar: React.FC<{
  segments: { value: number; muted?: boolean }[];
  total: number;
  grow: number;
  height?: number;
}> = ({ segments, total, grow, height = 14 }) => (
  <div
    style={{
      display: 'flex',
      gap: 3,
      height,
      borderRadius: height / 2,
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.06)',
    }}
  >
    {segments.map((segment, i) => (
      <div
        key={i}
        style={{
          width: `${(segment.value / total) * 100 * grow}%`,
          background: segment.muted
            ? STAGE.rule
            : `rgba(143,159,242,${1 - Math.min(0.62, i * 0.13)})`,
        }}
      />
    ))}
  </div>
);

/* --- The showcases -------------------------------------------------------- */

/**
 * The Composition card's attribute grid, as the panel lays it out.
 *
 * The chapter's claim is that the panel finds a group's *own* dimensions. That
 * is a claim about a set of cards, not about a number, so the enlargement has
 * to be the set: every attribute this group varies along, each with its real
 * distribution. The cards arrive in a stagger and each bar grows from zero,
 * which is the reel making the point that these were discovered rather than
 * configured.
 */
export const FacetBoard: React.FC<{
  plot: Plot;
  from: number;
  facets: {
    attribute: string;
    distinct: number;
    values: { value: string; members: number; filterable: boolean }[];
  }[];
  /** How many to draw. The grid is two columns and a chapter is not a catalogue. */
  limit?: number;
}> = ({ plot, from, facets, limit = 6 }) => {
  const shown = facets.slice(0, limit);
  const cards = useStagger(from, shown.length, 6);

  return (
    <div
      style={{
        ...at(plot),
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        // Rows sized to their cards and gathered in the middle. Without
        // `gridAutoRows` the grid spreads three rows evenly down 866px of plot
        // and the board reads as three unrelated pairs rather than one card
        // set; without centring it hangs from the top of a mostly empty frame.
        gridAutoRows: 'min-content',
        alignContent: 'center',
        gap: 22,
      }}
    >
      {shown.map((facet, i) => {
        const t = cards[i] ?? 0;
        const total = facet.values.reduce((sum, v) => sum + v.members, 0);
        return (
          <Card
            key={facet.attribute}
            style={{
              opacity: t,
              transform: `translateY(${(1 - t) * 26}px)`,
              alignSelf: 'start',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <div style={{ fontSize: TYPE.body, fontWeight: 600, color: STAGE.ink }}>
                {facet.attribute}
              </div>
              <div style={{ fontSize: TYPE.unit, color: STAGE.inkDim }}>
                {facet.distinct} {facet.distinct === 1 ? 'value' : 'values'}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Bar
                segments={facet.values.map((v) => ({ value: v.members }))}
                total={total}
                grow={t}
              />
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 16px',
                fontSize: TYPE.unit,
                color: STAGE.inkDim,
              }}
            >
              {facet.values.slice(0, 3).map((v, j) => {
                // Legend entries chase their card rather than sharing its
                // spring, so a card reads as filling in rather than as one
                // block sliding up.
                const l = interpolate(t, [0.35 + j * 0.12, 0.75 + j * 0.12], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <span
                    key={v.value}
                    style={{ opacity: l, display: 'flex', alignItems: 'center', gap: 7 }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: `rgba(143,159,242,${1 - j * 0.2})`,
                        transform: `scale(${l})`,
                      }}
                    />
                    {v.value}
                    <span style={{ color: STAGE.ink, fontWeight: 600 }}>
                      {Math.round((v.members / total) * 100)}%
                    </span>
                  </span>
                );
              })}
              {facet.values.length > 3 && (
                <span style={{ color: STAGE.accent }}>+{facet.values.length - 3} more</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

/**
 * The MFA breakdown, as a ladder of rows.
 *
 * The reporting chapter's point is that coverage is a worklist rather than a
 * percentage, so the enlargement is the rows themselves: a glyph, a label, a
 * count and a bar, in the order the panel reports them. The gap row is drawn in
 * the alert colour and arrives last, because it is the row the chapter is
 * about — every other row exists to make it mean something.
 */
export const FactorLadder: React.FC<{
  plot: Plot;
  from: number;
  rows: { label: string; count: number; pct: number }[];
  /** The row the chapter is arguing about. */
  highlight: string;
}> = ({ plot, from, rows, highlight }) => {
  // The highlighted row is dealt last so it lands on its own beat, whatever
  // order the panel happened to report the breakdown in.
  const ordered = [
    ...rows.filter((r) => r.label !== highlight),
    ...rows.filter((r) => r.label === highlight),
  ];
  const steps = useStagger(from, ordered.length, 7);
  const most = Math.max(...ordered.map((r) => r.count), 1);

  return (
    <div style={{ ...at(plot), display: 'flex', flexDirection: 'column', gap: 14 }}>
      {ordered.map((row, i) => {
        const t = steps[i] ?? 0;
        const lit = row.label === highlight;
        return (
          <Card
            key={row.label}
            style={{
              opacity: t,
              transform: `translateX(${(1 - t) * -34}px)`,
              padding: '18px 24px',
              borderColor: lit ? STAGE.alert : STAGE.rule,
              display: 'grid',
              gridTemplateColumns: '52px 1fr 132px',
              alignItems: 'center',
              gap: 20,
            }}
          >
            {/* The glyph lands before its row: a scale-up from nothing, so the
                eye has something to arrive on before the text does. */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: lit ? 'rgba(255,122,92,0.16)' : 'rgba(143,159,242,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${interpolate(t, [0, 0.5], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })})`,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: lit ? 2 : '50%',
                  background: lit ? STAGE.alert : STAGE.accent,
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: TYPE.body,
                  color: lit ? STAGE.ink : STAGE.inkDim,
                  fontWeight: lit ? 600 : 400,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  marginTop: 9,
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    width: `${(row.count / most) * 100 * t}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: lit ? STAGE.alert : STAGE.accent,
                  }}
                />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  letterSpacing: -1,
                  color: lit ? STAGE.alert : STAGE.ink,
                }}
              >
                {Math.round(interpolate(t, [0, 1], [0, row.count]))}
              </span>
              <span style={{ fontSize: TYPE.unit, color: STAGE.inkDim, marginLeft: 8 }}>
                {row.pct}%
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

/**
 * Every rule in the org, one chip each, with the dormant one left behind.
 *
 * The rules chapter's line is that the gap between every rule and the ones in
 * force is the rule nobody deleted. Nine tiles where one goes out says that
 * faster than a sentence can: the count is the same picture as the claim.
 */
export const RuleBoard: React.FC<{
  plot: Plot;
  from: number;
  total: number;
  active: number;
  /** The stat tiles the panel's own header shows, in its order. */
  stats: { label: string; value: number }[];
}> = ({ plot, from, total, active, stats }) => {
  const tiles = useStagger(from, total, 4);
  const cards = useStagger(from, stats.length, 8);
  const frame = useCurrentFrame();
  // The dormant tiles do not fade with the others; they arrive lit and then go
  // out, a beat later, which is the whole argument in one gesture.
  const dim = interpolate(frame - from - total * 4 - 26, [0, 22], [1, 0.18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        ...at(plot),
        display: 'flex',
        flexDirection: 'column',
        // Centred in the plot rather than hung from its top. This board is the
        // shortest thing the `focus` stage ever holds, and top-aligned it left
        // two thirds of the frame empty under it, which reads as a layout that
        // failed rather than as room.
        justifyContent: 'center',
        gap: 34,
      }}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {stats.map((stat, i) => {
          const t = cards[i] ?? 0;
          return (
            <Card
              key={stat.label}
              style={{
                flex: 1,
                opacity: t,
                transform: `translateY(${(1 - t) * 22}px)`,
                padding: '18px 20px',
              }}
            >
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.5, color: STAGE.ink }}>
                {Math.round(interpolate(t, [0, 1], [0, stat.value]))}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: TYPE.unit,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: STAGE.inkDim,
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {Array.from({ length: total }, (_, i) => {
          const t = tiles[i] ?? 0;
          const dormant = i >= active;
          return (
            <div
              key={i}
              style={{
                width: 96,
                height: 76,
                borderRadius: 12,
                border: `1px solid ${STAGE.rule}`,
                background: dormant ? `rgba(143,159,242,${0.1 * dim})` : 'rgba(143,159,242,0.26)',
                opacity: t * (dormant ? Math.max(dim, 0.3) : 1),
                transform: `scale(${0.86 + t * 0.14})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: dormant ? STAGE.rule : COLOR.primary,
                  opacity: dormant ? dim : 1,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
