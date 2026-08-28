/**
 * @module sidepanel/components/home/FigureNumber
 * @description The number column shared by Home's findings and its reports.
 *
 * Extracted rather than duplicated: the org card and the reports card sit one
 * above the other on the same tab, so a difference in how they set a number
 * would read as a mistake. There is one place to change it.
 */
import React from 'react';

/** Props for {@link FigureNumber}. */
export interface FigureNumberProps {
  /** The count, or `null` when nothing behind it can support one. */
  value: number | null;
}

/**
 * A row's leading number.
 *
 * At least `2.6ch` of `tabular-nums` so the left edge of the sentences beside it
 * never twitches between a `4` and a `214` — and so an em dash occupies the same
 * space a number would, which is what lets a missing value sit in a list without
 * the row looking broken. A minimum rather than a fixed width: a four-digit org
 * must widen the column, not spill out of it.
 *
 * Sized and centred to the full height of the lines beside it, so the number
 * reads as the row's subject rather than as a caption sitting on the first line.
 * `self-stretch` takes the height from the text block rather than asserting one,
 * so the column stays matched if a note ever wraps.
 *
 * A missing value dims to `text-neutral-400` at normal weight and is hidden from
 * assistive technology: the row is still there and still readable, but nothing
 * about it competes with the rows carrying a real number, and "—" is not a fact
 * worth announcing when the sentence beside it already says what is missing.
 *
 * @param props - See {@link FigureNumberProps}.
 */
const FigureNumber: React.FC<FigureNumberProps> = ({ value }) => (
  <span
    aria-hidden={value === null ? 'true' : undefined}
    className="flex shrink-0 items-center self-stretch"
  >
    <span
      className={`min-w-[2.6ch] text-right text-3xl leading-none tabular-nums ${
        value === null ? 'font-normal text-neutral-400' : 'font-semibold text-neutral-900'
      }`}
    >
      {value === null ? '—' : value.toLocaleString()}
    </span>
  </span>
);

export default FigureNumber;
