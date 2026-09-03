/**
 * @module sidepanel/components/home/ReportRow
 * @description The two lines and the disclosure every row on Home's reports
 * card is built from — the row idiom itself, factored out of the rows using it.
 *
 * Extracted for the same reason {@link module:sidepanel/components/home/FigureNumber}
 * was: the reports card now carries rows of two different kinds (a report that
 * counts, a launcher that scopes), they sit inside one bordered surface, and any
 * difference between how they set a title, colour a note, or open a panel would
 * read as a mistake rather than as a distinction. There is one place to change
 * it, and a polish pass has one target.
 *
 * Renders no entity data of its own and logs nothing.
 */
import React, { useState } from 'react';
import Icon from '../shared/Icon';

/**
 * The title and the line under it — the two lines every row on this card shows,
 * whether it heads a report or a launcher.
 *
 * `recessed` is the "this row states no number" treatment; `warn` colours the
 * note for a read that did not finish.
 */
export const RowLines: React.FC<{
  label: string;
  note?: string;
  id: string;
  recessed?: boolean;
  warn?: boolean;
}> = ({ label, note, id, recessed = false, warn = false }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
    <span
      id={id}
      className={`text-sm ${recessed ? 'font-medium text-neutral-600' : 'font-semibold text-neutral-900'}`}
    >
      {label}
    </span>
    {note && (
      <span className={`text-xs ${warn ? 'text-warning-text' : 'text-neutral-600'}`}>{note}</span>
    )}
  </span>
);

/**
 * A row that opens in place: the header is a real `<button>` wrapping the row's
 * own content, and the panel is its sibling.
 *
 * Valid here and not in the org card: a row on this card has no controls of its
 * own until it is open, and everything that *is* a control lives in the panel,
 * outside the button. That buys `aria-expanded`/`aria-controls` with no extra
 * element. Shared by the report rows and the launcher so the two cannot drift
 * apart under a polish pass.
 */
export const RowDisclosure: React.FC<{
  /** Stem for the label/panel ids; unique per row on the card. */
  rowKey: string;
  /** The left column — a {@link FigureNumber}, or a glyph standing in for one. */
  figure: React.ReactNode;
  label: string;
  note?: string;
  recessed?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}> = ({ rowKey, figure, label, note, recessed, warn, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `home-report-panel-${rowKey}`;
  return (
    <li>
      {/* `.press press-subtle` (ADR-0046): this button IS the row, so `:active`
          applies directly — the same treatment `ListRow` now gives an
          interactive row, and the `active:brightness-90` step `Button`/
          `IconButton` add for the third, darker press state Odyssey specifies
          beyond hover. Its own transition replaces `transition-colors` so the
          two don't fight over the `transition` longhands. */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="press press-subtle flex w-full items-stretch gap-3 px-(--sp-row-x) py-(--sp-row-y) hover:bg-neutral-50 active:brightness-90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {figure}
        <RowLines
          label={label}
          note={note}
          id={`home-report-${rowKey}`}
          recessed={recessed}
          warn={warn}
        />
        <Icon
          type="chevron-down"
          size="xs"
          className={`shrink-0 self-center text-neutral-400 transition-transform duration-(--dur-quick) ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div id={panelId} className="border-t border-neutral-100 bg-neutral-50 p-(--sp-card)">
          {children}
        </div>
      )}
    </li>
  );
};
