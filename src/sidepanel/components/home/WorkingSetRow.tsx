/**
 * @module sidepanel/components/home/WorkingSetRow
 * @description One entity in the Home tab's working set.
 *
 * The row is activatable *and* carries its own control (unpin / forget), which a
 * `<button>` row cannot legally contain — so it uses the shared
 * {@link sidepanel/components/shared/StretchedButton.StretchedButton} overlay
 * rather than `ListRow as="button"`, and the trailing control sits above it on
 * `relative z-10`.
 */
import React, { useId } from 'react';
import ListRow from '../shared/ListRow';
import Icon from '../shared/Icon';
import IconButton from '../shared/IconButton';
import StretchedButton from '../shared/StretchedButton';
import { getRelativeTime } from '../../../shared/utils/dateFormat';
import type { WorkingSetRef } from '../../../shared/storage/workingSetStore';

/** Human labels for the two kinds a working set can hold. */
const KIND_LABEL = { group: 'Group', user: 'User' } as const;

/** Props for {@link WorkingSetRow}. */
export interface WorkingSetRowProps {
  /** The remembered entity. */
  entry: WorkingSetRef;
  /** Open it on its owning tab. */
  onOpen: (entry: WorkingSetRef) => void;
  /** Whether this row is a pin (rather than a recent) — changes the drop verb. */
  pinned: boolean;
  /** Drop the entry: unpin a pin, forget a recent. */
  onDrop: (entry: WorkingSetRef) => void;
}

/**
 * Render one working-set row.
 *
 * @param props - See {@link WorkingSetRowProps}.
 */
const WorkingSetRow: React.FC<WorkingSetRowProps> = ({ entry, onOpen, pinned, onDrop }) => {
  const nameId = useId();

  // The design's worked example reads `Rule · left on Attributes`, which cannot
  // be built — the Rules tab has no view stack and no panes. A rung that did not
  // report a pane shows its kind alone rather than an invented location.
  const secondary = entry.lastPane
    ? `${KIND_LABEL[entry.kind]} · left on ${entry.lastPane}`
    : KIND_LABEL[entry.kind];

  // Omitted for anything seen today: on a list you were just browsing, "today"
  // on every row is a column of noise that distinguishes nothing.
  const seen = getRelativeTime(new Date(entry.lastSeenAt).toISOString());
  const age = seen && seen !== 'today' ? ` · ${seen}` : '';

  return (
    // No `.press` here: `StretchedButton` itself now carries the response
    // layer's press feedback (ADR-0046) — a faint state-layer wash on its own
    // `:active`, since the overlay is invisible and has no box to depress the
    // way `ListRow`'s own `.press` scale assumes. `ListRow` deliberately
    // excludes it for the same reason on any row activated this way.
    <ListRow density="compact" className="relative">
      <StretchedButton
        label={`Open ${KIND_LABEL[entry.kind].toLowerCase()}`}
        describedBy={nameId}
        onClick={() => onOpen(entry)}
      />
      <div className="flex items-center gap-3 min-w-0">
        <Icon
          type={entry.kind === 'group' ? 'users' : 'user'}
          size="md"
          className="text-neutral-400 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p id={nameId} className="text-sm font-medium text-neutral-900 truncate">
            {entry.name}
          </p>
          <p className="text-xs text-neutral-600 truncate">
            {secondary}
            {age}
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <IconButton
            label={pinned ? `Unpin ${entry.name}` : `Forget ${entry.name}`}
            variant="ghost"
            size="sm"
            onClick={() => onDrop(entry)}
          >
            <Icon type="close" size="sm" />
          </IconButton>
        </div>
      </div>
    </ListRow>
  );
};

export default WorkingSetRow;
