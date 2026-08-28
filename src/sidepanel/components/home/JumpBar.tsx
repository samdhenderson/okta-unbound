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
 * ## No `PageHeader`
 *
 * Home deliberately has no page header — one could only say "Home" — so this bar
 * is the first thing in the scroller, and its helper line does the work a header
 * subtitle would.
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
        ariaLabel="Paste an id, name, or email"
        placeholder="Paste an id, name, or email…"
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

      <p className="text-xs text-neutral-600">
        {jump.isIdQuery
          ? 'Press Enter to open this id'
          : 'Ids resolve exactly · names and emails search the org'}
      </p>

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

      {jump.mode === 'results' && jump.results.length > 0 && (
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
          {jump.resolution && (
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
