/**
 * @module sidepanel/components/home/JumpBar
 * @description The Home tab's first region: one input that resolves an id or
 * searches names and emails.
 *
 * Presentational. All of the behaviour — the three-character floor, the
 * no-request-until-Enter rule for ids, snapshot-first resolution — belongs to
 * {@link module:sidepanel/hooks/useJumpResolver}, and this component renders
 * whatever that hook is currently reporting.
 *
 * ## The footnote is a fact, not a slogan
 *
 * After an id resolves, the footnote states what it actually cost — `0 requests`
 * when the local org snapshot answered, `1 request` when Okta had to. The design
 * specified a fixed "1 request"; the snapshot makes that untrue about half the
 * time, and a cost line that is sometimes wrong is worse than none.
 *
 * ## Results are held across a refining search
 *
 * The list is rendered whenever the resolver is holding rows — not only in
 * `results` mode. A committed search leaves that mode while it runs, and
 * unmounting the list on that transition is what made refining a query flash:
 * the rows vanished, `.rise-in-stagger` replayed, and the panel visibly rebuilt
 * itself for a query still being typed. The spinner in the field's trailing slot
 * already says a newer answer is on the way; the older answer stays until it is
 * replaced. The id-cost footnote is not held — it is a claim about a finished
 * resolution, so it hides the moment one is superseded.
 *
 * ## No `PageHeader`, and no helper line
 *
 * Home deliberately has no page header — one could only say "Home" — so this bar
 * is the first thing in the scroller.
 *
 * It carried a line under it explaining the two behaviours ("ids resolve
 * exactly · names and emails search the org"). That line was removed: it sat
 * between the field and its results, pushing the working set and the org
 * findings down the panel to explain a distinction the placeholder now states
 * and the bar demonstrates on first use. Nothing is lost that the reader needed
 * *before* typing — an id still resolves on Enter, a name still searches, and
 * the cost footnote still reports what a resolution actually spent.
 */
import React, { useRef } from 'react';
import { IconButton, Input, LoadingSpinner } from '../shared';
import Icon from '../shared/Icon';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import JumpResultRow from './JumpResultRow';
import type { JumpResult, UseJumpResolverResult } from '../../hooks/useJumpResolver';

/** Props for {@link JumpBar}. */
export interface JumpBarProps {
  /** The live resolver state, from `useJumpResolver`. */
  jump: UseJumpResolverResult;
  /** Open a result on its owning tab, when this build can reach its kind. */
  onSelect: (result: JumpResult) => boolean | void;
  /** Whether a result's kind has a destination in this build. */
  canReach: (kind: JumpResult['kind']) => boolean;
  /** Org origin, for the Okta deep link on rows that cannot be reached in-panel. */
  oktaOrigin?: string | null;
  /** Focus the field on mount. The tab passes this only on first activation. */
  autoFocus?: boolean;
}

/**
 * Render the jump bar and its results.
 *
 * @param props - See {@link JumpBarProps}.
 */
const JumpBar: React.FC<JumpBarProps> = ({
  jump,
  onSelect,
  canReach,
  oktaOrigin,
  autoFocus = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = jump.mode === 'searching' || jump.mode === 'resolving';

  // Rows survive a refining search. `mode` leaves `results` the moment a new
  // query is committed, and unmounting the list on that transition is what makes
  // a refined search flash: the answers vanish, the stagger replays, and the
  // reader watches the panel rebuild itself for a query they are still typing.
  // The spinner in the trailing slot already says a newer answer is coming, so
  // the older one stays put until it is replaced.
  const showResults = jump.results.length > 0 && (jump.mode === 'results' || isBusy);

  const handleClear = () => {
    jump.clear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jump.submit();
    } else if (event.key === 'Escape' && jump.query) {
      // Escape clears the field rather than bubbling out of the panel.
      event.preventDefault();
      handleClear();
    }
  };

  return (
    <section aria-label="Jump to an entity" className="space-y-2">
      <Input
        inputRef={inputRef}
        type="text"
        value={jump.query}
        onChange={jump.setQuery}
        onKeyDown={handleKeyDown}
        ariaLabel="Search groups, apps, users, rules"
        placeholder="Search groups, apps, users, rules, etc."
        size="lg"
        autoFocus={autoFocus}
        icon={<Icon type="search" size="md" />}
        trailing={
          <div className="flex items-center gap-1">
            {isBusy && <LoadingSpinner size="sm" />}
            {jump.query.length > 0 && (
              <IconButton label="Clear" onClick={handleClear} variant="ghost" size="sm">
                <Icon type="close" size="md" />
              </IconButton>
            )}
          </div>
        }
        trailingInteractive={jump.query.length > 0}
      />

      {/* Announced rather than shown: the results below are visual, and a
          screen-reader user gets no equivalent from a list appearing. */}
      <p role="status" className="sr-only">
        {jump.mode === 'results'
          ? `${jump.results.length} ${jump.results.length === 1 ? 'result' : 'results'}`
          : ''}
      </p>

      {jump.error && (
        <AlertMessage message={{ text: jump.error, type: 'danger' }} onDismiss={jump.clear} />
      )}

      {showResults && (
        <>
          {/* `.rise-in-stagger` steps its direct children 24ms apart in pure CSS,
              honouring the motion tokens. No raw ms or cubic-bezier reaches this
              file, and no index prop reaches a row. */}
          <ul className="rise-in-stagger space-y-1">
            {jump.results.map((result) => {
              const reachable = canReach(result.kind);
              return (
                <li key={`${result.kind}:${result.id}`}>
                  <JumpResultRow
                    result={result}
                    onSelect={reachable ? onSelect : undefined}
                    oktaOrigin={oktaOrigin}
                  />
                </li>
              );
            })}
          </ul>
          {jump.mode === 'results' && jump.resolution && (
            <p className="text-xs text-neutral-600">
              Exact id match · {jump.resolution.cost === 0 ? 'no request' : '1 request'}
            </p>
          )}
        </>
      )}

      {jump.mode === 'results' && jump.results.length === 0 && (
        <EmptyState
          icon="search"
          title="Nothing matched"
          description={
            jump.isIdQuery
              ? 'No entity in this org has that id.'
              : 'No group or user matches that name. Try fewer characters, or paste an id.'
          }
        />
      )}
    </section>
  );
};

export default JumpBar;
