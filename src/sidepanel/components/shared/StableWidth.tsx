/**
 * @module sidepanel/components/shared/StableWidth
 * @description Reserve the width a readout will eventually need, so its
 * neighbours are laid out once instead of every time it changes.
 *
 * ADR-0044 names the shape this exists to remove, and `D-053` filed it in seven
 * places: an element changes size after mount — a chip whose label swaps, a
 * badge that only appears once a fetch resolves, a button whose label runs
 * through three lengths — while sitting in a flex row beside text that is
 * `min-w-0` and therefore free to absorb the difference. The neighbour
 * re-truncates, re-wraps or changes its line count, and the row visibly
 * re-lays-out under the reader's eye. The Layout Instability API names the pair
 * directly: a `shrink-0` cluster widening beside a `flex-1 min-w-0` column.
 *
 * ## Why a hidden twin rather than a `min-w-[…]`
 *
 * A hard-coded width is a guess about a font the panel does not control, and it
 * is a guess that has to be re-made every time the copy changes — which is how
 * the reflow got in. Rendering the **widest state** invisibly in the same grid
 * cell makes the browser measure it: whatever the reserved content would occupy
 * is exactly what is reserved, in the reader's own font, at the reader's own
 * zoom.
 *
 * The twin is `aria-hidden` and inert, so it costs nothing to the accessibility
 * tree; only the live child is announced.
 *
 * ## What this does not fix
 *
 * A readout whose *digits* change width still twitches inside its reserved box —
 * `11%` and `88%` are different widths in a proportional font. That is the other
 * half of the convention: a numeric readout carries `tabular-nums`. This
 * component reserves the box; `tabular-nums` stabilises what sits in it, and
 * most call sites want both.
 */
import React from 'react';

/** Props for {@link StableWidth}. */
export interface StableWidthProps {
  /**
   * The widest state this slot will ever hold — usually the longest label
   * (`'Not evaluated'`), the fullest number (`'100%'`), or the badged form of a
   * control. Rendered invisibly to set the floor.
   *
   * Getting this wrong is a soft failure: too narrow and the row can still move,
   * too wide and it holds unused space. Neither breaks anything.
   */
  reserve: React.ReactNode;
  /** What is actually shown. */
  children: React.ReactNode;
  /**
   * How the live child sits in the reserved box. `start` is the default because
   * a label reads from its leading edge; `end` suits a right-aligned numeric
   * readout, `center` a chip or badge.
   */
  align?: 'start' | 'center' | 'end';
  /** Extra classes for the outer box — layout only (`shrink-0`, `text-right`). */
  className?: string;
}

const ALIGNMENT: Record<NonNullable<StableWidthProps['align']>, string> = {
  start: 'justify-self-start',
  center: 'justify-self-center',
  end: 'justify-self-end',
};

/**
 * Hold a slot open at the width of its widest state.
 *
 * Both children occupy the same single grid cell (`col-start-1 row-start-1`), so
 * the cell sizes to the larger of the two and the live child never moves what is
 * beside it.
 *
 * @param props - See {@link StableWidthProps}.
 * @returns The reserved slot.
 */
const StableWidth: React.FC<StableWidthProps> = ({
  reserve,
  children,
  align = 'start',
  className = '',
}) => (
  <span className={`grid ${className}`.trim()}>
    {/* Both children share one cell, so the cell sizes to the wider of the two. */}
    <span
      aria-hidden="true"
      // The hook the DOM queries key off. The twin is invisible to the reader, so
      // it must be invisible to a text query too — `src/test/setup.ts` and
      // `.storybook/preview.tsx` both add this attribute to Testing Library's
      // `defaultIgnore`, the same mechanism that already hides `<script>` and
      // `<style>`. Without it every reserved label matches twice and a suite
      // would have to be rewritten around a rendering detail.
      data-reserve-width="true"
      className="invisible col-start-1 row-start-1 select-none whitespace-nowrap"
    >
      {reserve}
    </span>
    <span className={`col-start-1 row-start-1 ${ALIGNMENT[align]}`}>{children}</span>
  </span>
);

export default StableWidth;
