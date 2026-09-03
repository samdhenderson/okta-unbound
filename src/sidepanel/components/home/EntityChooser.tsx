/**
 * @module sidepanel/components/home/EntityChooser
 * @description Pick one entity out of a list already in memory, and hand its id
 * back. The launcher half of a scoped, opt-in action.
 *
 * This exists for the actions Home cannot afford to run for everybody. Both of
 * the reports above it are joins over rows already on disk, so they can state a
 * number for the whole org for free. An MFA-coverage read is not free — it is a
 * factor lookup per member — so the honest shape is not a number with a list
 * behind it but a **scope first**: name the group, then land where the scan can
 * be started deliberately.
 *
 * ## It filters; it never searches
 *
 * Everything offered comes in through {@link EntityChooserProps.choices}, and
 * typing narrows that array locally. There is deliberately no `onFilterChange`
 * escape hatch and no async source: a chooser that queried Okta per keystroke
 * would spend requests to *avoid* spending requests, which is the whole reason
 * this is a chooser and not a count. A caller with 20k groups passes 20k rows
 * and pays nothing; what it may not do is make this component the thing that
 * fetches them.
 *
 * ## The cap is stated, never silent
 *
 * Only {@link CHOOSER_VISIBLE_LIMIT} rows render at once, and the panel says so
 * whenever it is truncating — the same rule the reports card applies to a capped
 * finding list. A list quietly cut to its first page reads as the complete
 * answer, and here it would read as "your group isn't in this org".
 *
 * Entity names are tenant data and are rendered through React's escaping. This
 * module logs nothing and fetches nothing.
 */
import React, { useId, useMemo, useState } from 'react';
import Icon from '../shared/Icon';
import Input from '../shared/Input';
import StretchedButton from '../shared/StretchedButton';

/**
 * How many rows the chooser shows at once.
 *
 * Matched to the reports card's own preview cap so the two lists on this card
 * truncate at the same place; the filter field, not a longer list, is how a
 * reader reaches row 400.
 */
export const CHOOSER_VISIBLE_LIMIT = 25;

/** One offerable entity. Structurally what a report's finding already is. */
export interface EntityChoice {
  /** Okta id, handed back to {@link EntityChooserProps.onChoose} verbatim. */
  id: string;
  /** Display name — what the filter matches against. */
  name: string;
  /** One line of context under the name (member count, apps). Optional. */
  detail?: string;
}

/** Props for {@link EntityChoiceRow}. */
export interface EntityChoiceRowProps {
  /** The entity this row names. */
  choice: EntityChoice;
  /**
   * Accessible name of the row's press target — the *verb*, not the entity:
   * "Open this group", "Scan MFA coverage for this group". The name itself is
   * already announced through `aria-describedby`, so repeating it here would
   * read it twice.
   */
  actionLabel: string;
  /** Called with {@link EntityChoice.id} when the row is pressed. */
  onChoose: (id: string) => void;
}

/**
 * One named entity as a pressable row.
 *
 * A {@link StretchedButton} rather than a wrapping `<button>`, so the name and
 * its explanation stay plain text and the row keeps its flush padding. `hover`
 * lands on white because the panel it sits in is already `neutral-50`.
 *
 * Shared by the reports' finding lists and by {@link EntityChooser} on purpose:
 * they are the same row doing the same job one nesting level down, and a
 * difference between them on one card would read as a mistake.
 *
 * @param props - See {@link EntityChoiceRowProps}.
 */
export const EntityChoiceRow: React.FC<EntityChoiceRowProps> = ({
  choice,
  actionLabel,
  onChoose,
}) => {
  const nameId = useId();
  return (
    // Padding stays a raw `px-2 py-1.5` rather than the row roles: this is a
    // nested row inside an already-padded disclosure panel, deliberately
    // denser than a top-level row so the hierarchy reads. No `.press` on the
    // row itself — `StretchedButton` carries the response layer's press
    // feedback on its own `:active` (ADR-0046), since the overlay has no
    // visible box for a scale to read on.
    <li className="relative flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-(--dur-instant) hover:bg-white">
      <StretchedButton
        label={actionLabel}
        describedBy={nameId}
        onClick={() => onChoose(choice.id)}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={nameId} className="truncate text-sm font-medium text-neutral-900">
          {choice.name}
        </span>
        {choice.detail && (
          <span className="truncate text-xs text-neutral-600">{choice.detail}</span>
        )}
      </span>
      <Icon type="chevron-right" size="xs" className="shrink-0 text-neutral-400" />
    </li>
  );
};

/** Props for {@link EntityChooser}. */
export interface EntityChooserProps {
  /**
   * Everything that may be offered, already in memory and in display order.
   * Filtering happens here; fetching does not (see the module header).
   */
  choices: EntityChoice[];
  /**
   * Accessible name of the filter field, and its placeholder — "Filter groups".
   * Required rather than defaulted: the noun is the one thing a second caller
   * must not inherit from the first.
   */
  filterLabel: string;
  /** Forwarded to every row. See {@link EntityChoiceRowProps.actionLabel}. */
  actionLabel: string;
  /** Called with the chosen entity's id. The caller decides where that goes. */
  onChoose: (id: string) => void;
  /**
   * What to say when nothing matches what was typed. Defaults to a generic
   * sentence; pass one naming the noun when the surface can afford the words.
   */
  emptyLabel?: string;
}

/**
 * A filter field over a list of entities, and the rows it narrows to.
 *
 * Renders no heading of its own — it is a panel body, and the disclosure that
 * opens it already carries the title. It holds no selection either: pressing a
 * row is a one-shot hand-off, so there is nothing to accumulate and nothing to
 * confirm.
 *
 * @param props - See {@link EntityChooserProps}.
 */
const EntityChooser: React.FC<EntityChooserProps> = ({
  choices,
  filterLabel,
  actionLabel,
  onChoose,
  emptyLabel = 'Nothing matches that.',
}) => {
  const [query, setQuery] = useState('');

  // Substring, case-insensitive, name only. Not fuzzy: an admin filtering a
  // group list is recalling a name they already know, and a fuzzy match's job is
  // to surface things they did not type — which here just buries the exact hit.
  // Not matched against `detail` either: a hit on "412 members" is noise.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return choices;
    return choices.filter((choice) => choice.name.toLowerCase().includes(needle));
  }, [choices, query]);

  const shown = matches.slice(0, CHOOSER_VISIBLE_LIMIT);

  return (
    <div className="space-y-2">
      <Input
        type="search"
        size="sm"
        value={query}
        onChange={setQuery}
        ariaLabel={filterLabel}
        placeholder={filterLabel}
        icon={<Icon type="search" size="sm" className="text-neutral-400" />}
      />
      {shown.length === 0 ? (
        <p className="px-2 text-xs text-neutral-600">{emptyLabel}</p>
      ) : (
        <ul className="space-y-px">
          {shown.map((choice) => (
            <EntityChoiceRow
              key={choice.id}
              choice={choice}
              actionLabel={actionLabel}
              onChoose={onChoose}
            />
          ))}
        </ul>
      )}
      {matches.length > shown.length && (
        // Stated, never silent — the same rule a capped report list follows. A
        // list cut to its first page would otherwise read as "not in this org".
        <p className="px-2 text-xs text-neutral-600">
          Showing the first {shown.length.toLocaleString()} of {matches.length.toLocaleString()}.
          Keep typing to narrow it.
        </p>
      )}
    </div>
  );
};

export default EntityChooser;
