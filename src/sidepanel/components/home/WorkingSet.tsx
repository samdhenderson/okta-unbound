/**
 * @module sidepanel/components/home/WorkingSet
 * @description The Home tab's second region: what you pinned, and what you were
 * just looking at.
 *
 * ## The empty state is the point, not a fallback
 *
 * A cold panel has nothing pinned and nothing recent, and the obvious move is to
 * render nothing at all. That is wrong here: the pin lives in the corner of a
 * detail header, which is a place nobody looks until they know something is
 * there. So an empty **Pinned** list holds its space and says how to fill it —
 * the section is the only surface that can teach the affordance, and it can only
 * do that by existing before it has content.
 *
 * **Recent** is different. It fills itself the first time you open anything, so
 * it needs no instructions and is simply absent until it has rows.
 */
import React from 'react';
import Eyebrow from '../shared/Eyebrow';
import Icon from '../shared/Icon';
import WorkingSetRow from './WorkingSetRow';
import type { WorkingSetRef } from '../../../shared/storage/workingSetStore';

/** Props for {@link WorkingSet}. */
export interface WorkingSetProps {
  /** Entities the reader chose to keep. */
  pinned: WorkingSetRef[];
  /** Entities recently opened, most recent first. */
  recent: WorkingSetRef[];
  /** Open one on its owning tab. */
  onOpen: (entry: WorkingSetRef) => void;
  /** Release a pin. */
  onUnpin: (entry: WorkingSetRef) => void;
  /** Drop a recent. */
  onForget: (entry: WorkingSetRef) => void;
}

/**
 * Render the pinned and recent lists.
 *
 * @param props - See {@link WorkingSetProps}.
 */
const WorkingSet: React.FC<WorkingSetProps> = ({ pinned, recent, onOpen, onUnpin, onForget }) => (
  <div className="space-y-4">
    <section aria-label="Pinned" className="space-y-2">
      <Eyebrow as="h3">Pinned</Eyebrow>
      {pinned.length > 0 ? (
        <ul className="space-y-1">
          {pinned.map((entry) => (
            <li key={`${entry.kind}:${entry.id}`}>
              <WorkingSetRow entry={entry} onOpen={onOpen} pinned onDrop={onUnpin} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-600">
          <Icon type="pin" size="sm" className="shrink-0 text-neutral-400" />
          <span>
            Nothing pinned yet. Open a group or a user and press the pin in the corner of its header
            to keep it here.
          </span>
        </p>
      )}
    </section>

    {recent.length > 0 && (
      <section aria-label="Recent" className="space-y-2">
        <Eyebrow as="h3">Recent</Eyebrow>
        <ul className="space-y-1">
          {recent.map((entry) => (
            <li key={`${entry.kind}:${entry.id}`}>
              <WorkingSetRow entry={entry} onOpen={onOpen} pinned={false} onDrop={onForget} />
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export default WorkingSet;
