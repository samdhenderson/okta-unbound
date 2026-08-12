/**
 * @module sidepanel/components/groups/GroupListItemSignal
 * @description The one-line signal region of a group row: source meter, member count, facts.
 *
 * The row's redesign folded the old three-item metrics strip (members / rules /
 * dates) into this single line, so the numbers live *inside* the state encoding
 * rather than beside it. It carries, in order:
 *
 * 1. the compact member-source meter — rendered **only** when a breakdown has
 *    already been computed elsewhere (see
 *    {@link module:sidepanel/cache/memberSourceCache}); never fetched here. Its
 *    56px bar draws one segment per attributing rule, capped at
 *    {@link module:sidepanel/components/groups/groupSourceSummary.COMPACT_RULE_SEGMENTS}
 *    named rules with the tail aggregated, and a `min-w-0.5` floor so a
 *    one-member segment is still a visible sliver rather than nothing,
 * 2. the exact member count, which Okta returns free with `?expand=stats`,
 * 3. what the source split says, or an honest "not analyzed",
 * 4. the exact rule and push facts, with "fed by" and "used in" kept apart.
 *
 * The bar is decorative (`aria-hidden`): every number it encodes is printed as
 * text alongside it, so nothing is available only as colour.
 */
import React from 'react';
import type { GroupRowModel } from './groupSourceSummary';

/** Props for {@link GroupListItemSignal}. */
interface GroupListItemSignalProps {
  /** The derived row model — see {@link module:sidepanel/components/groups/groupSourceSummary}. */
  model: GroupRowModel;
}

/**
 * Renders the compact signal line for one group row. Pure: everything it shows
 * is already decided by {@link GroupRowModel}.
 */
const GroupListItemSignal: React.FC<GroupListItemSignalProps> = ({ model }) => {
  const { source, memberCount, memberNoun, facts } = model;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
      {source.kind === 'computed' && (
        <span
          aria-hidden="true"
          title={source.title}
          className="flex h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-100"
        >
          {source.segments.map((segment) => (
            <span
              key={segment.key}
              className={`min-w-0.5 ${segment.barClass}`}
              style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
            />
          ))}
        </span>
      )}

      <span className="whitespace-nowrap">
        <span className="font-semibold text-neutral-700">{memberCount.toLocaleString()}</span>{' '}
        <span>{memberNoun}</span>
      </span>

      {source.kind === 'computed' && (
        <span className="text-neutral-700" title={source.title}>
          {source.summary}
        </span>
      )}

      {source.kind === 'unknown' && (
        <span className="text-neutral-400 italic" title={source.title}>
          {source.summary}
        </span>
      )}

      {facts.map((fact) => (
        <span key={fact.key} className="whitespace-nowrap" title={fact.title}>
          {fact.label}
        </span>
      ))}
    </div>
  );
};

export default GroupListItemSignal;
