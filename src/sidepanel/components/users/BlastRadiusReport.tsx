/**
 * @module sidepanel/components/users/BlastRadiusReport
 * @description The report an admin opts into before saving a profile edit:
 * **"if I make this change, what happens to this user's group access?"**
 *
 * Two views of one answer, switched by a pill. *Groups* is the consequence —
 * what access is gained, what is lost, and what we decline to call.
 * *Rules* is the cause — which rules move, and which could not be judged at all.
 * The same report backs both; nothing is recomputed by the switch.
 *
 * ## Three statuses, three different things to say
 *
 * - `not-computed` renders **nothing**. The rule inventory has not resolved, or
 *   the admin has not asked yet; the parent owns the button that asks. A report
 *   that renders itself before it has been asked for is a report an admin will
 *   read as an answer.
 * - `unavailable` renders an honest line: the org's rule inventory could not be
 *   loaded, so **no prediction is possible**. It is emphatically not "no
 *   changes" — collapsing an inability into a negative is the single move
 *   ADR-0020 forbids, and it is the one this surface would be most tempted by.
 * - `computed` renders the report, and a computed report with zero effects says
 *   so explicitly rather than rendering as an absence.
 *
 * ## Second-order effects
 *
 * Second-order effects are **named, not resolved** — one quiet line saying how
 * many other rules read membership of a group this edit would move.
 *
 * ## Security
 *
 * Every string in a report — group names, rule names, condition expressions —
 * is end-user-controllable tenant data. Rendered through React's escaping only,
 * and **nothing in this module logs**.
 */
import React, { useMemo, useState } from 'react';
import { AlertMessage, EmptyState, Eyebrow, FilterPill, type GroupNameResolver } from '../shared';
import BlastRadiusGroupRow from './BlastRadiusGroupRow';
import { cascadeLinesByGroupId, type CascadeLine } from './cascadeLines';
import type { CascadeGroupBlock } from './BlastRadiusCascade';
import BlastRadiusRuleRow from './BlastRadiusRuleRow';
import type {
  BlastRadiusReport as BlastRadiusReportData,
  GroupEffect,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';

/** Props for {@link BlastRadiusReport}. */
export interface BlastRadiusReportProps {
  /**
   * The report to render, from `useBlastRadius`. Its `status` decides everything
   * — `not-computed` renders nothing at all, so a parent may mount this
   * unconditionally.
   */
  report: BlastRadiusReportData;
  /** Extra classes on the outer container — layout and spacing only. */
  className?: string;
  /**
   * Names the group ids inside each rule's condition, from `useBlastRadius`'s
   * `resolveGroupName`. Passed straight through to the rule rows; this view
   * fetches nothing.
   */
  resolveGroupName?: GroupNameResolver;
}

/** Which of the two views the pills have selected. */
type ReportView = 'groups' | 'rules';

/** The transitions that constitute an *affected* rule; the rest are carried but collapsed. */
const AFFECTED_TRANSITIONS = new Set(['starts-matching', 'stops-matching', 'undetermined']);

/** A titled block of group rows, or nothing when the block is empty. */
const GroupSection: React.FC<{
  title: string;
  effects: readonly GroupEffect[];
  cascadeLines: ReadonlyMap<string, readonly CascadeLine[]>;
  openRowIds: ReadonlySet<string>;
  onToggle: (rowId: string) => void;
}> = ({ title, effects, cascadeLines, openRowIds, onToggle }) =>
  effects.length === 0 ? null : (
    <section className="flex flex-col gap-2">
      <Eyebrow as="h3">{title}</Eyebrow>
      <ul className="space-y-(--sp-rung)">
        {effects.map((effect) => (
          <BlastRadiusGroupRow
            key={effect.groupId}
            effect={effect}
            cascade={cascadeLines.get(effect.groupId)}
            expanded={openRowIds.has(effect.groupId)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </section>
  );

/** A titled block of rule rows, or nothing when the block is empty. */
const RuleSection: React.FC<{
  title: string;
  effects: readonly RuleEffect[];
  resolveGroupName?: GroupNameResolver;
  cascadeLines: ReadonlyMap<string, readonly CascadeLine[]>;
  openRowIds: ReadonlySet<string>;
  onToggle: (rowId: string) => void;
}> = ({ title, effects, resolveGroupName, cascadeLines, openRowIds, onToggle }) =>
  effects.length === 0 ? null : (
    <section className="flex flex-col gap-2">
      <Eyebrow as="h3">{title}</Eyebrow>
      <ul className="space-y-(--sp-rung)">
        {effects.map((effect) => (
          <BlastRadiusRuleRow
            key={effect.ruleId}
            effect={effect}
            resolveGroupName={resolveGroupName}
            cascadeBlocks={blocksFor(effect, cascadeLines)}
            expanded={openRowIds.has(effect.ruleId)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </section>
  );

/**
 * The cascade blocks for one rule row: its target groups that the report moved.
 *
 * `cascadeLines` is keyed only by *affected* groups, so this is scoped for free —
 * a target this rule assigns but that nothing predicted a change for has no
 * entry, which is what keeps the rules view from repeating the groups view.
 *
 * @param effect - The rule row's effect.
 * @param cascadeLines - Affected group id → its cascade lines.
 * @returns One block per affected target group, in the rule's own target order.
 */
function blocksFor(
  effect: RuleEffect,
  cascadeLines: ReadonlyMap<string, readonly CascadeLine[]>,
): CascadeGroupBlock[] {
  return effect.targetGroupIds
    .map((groupId, index) => ({
      groupId,
      groupName: effect.targetGroupNames[index] ?? groupId,
      lines: cascadeLines.get(groupId),
    }))
    .filter((block): block is CascadeGroupBlock => block.lines !== undefined);
}

/**
 * The blast-radius report for one proposed profile edit.
 *
 * @param props - See {@link BlastRadiusReportProps}.
 */
const BlastRadiusReport: React.FC<BlastRadiusReportProps> = ({
  report,
  className = '',
  resolveGroupName,
}) => {
  const [view, setView] = useState<ReportView>('groups');
  /*
    Open panels live here rather than in the rows because the pill switch below
    unmounts every row: local row state would silently collapse an open
    disclosure on a switch. One set serves both views — group ids (`00g…`) and
    rule ids (`0pr…`) cannot collide, and the two views' rows are different rows,
    so what this buys is survival across the switch rather than cross-view sync.
  */
  const [openRowIds, setOpenRowIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleRow = React.useCallback((rowId: string) => {
    setOpenRowIds((open) => {
      const next = new Set(open);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });
  }, []);
  const cascadeLines = useMemo(() => cascadeLinesByGroupId(report), [report]);

  const { added, removed, notPredicted } = useMemo(
    () => ({
      added: report.groups.filter((effect) => effect.kind === 'added'),
      removed: report.groups.filter((effect) => effect.kind === 'removed'),
      notPredicted: report.groups.filter((effect) => effect.kind === 'not-predicted'),
    }),
    [report.groups],
  );

  const { starts, stops, undetermined, unaffectedCount } = useMemo(() => {
    const affected = report.rules.filter((effect) => AFFECTED_TRANSITIONS.has(effect.transition));
    return {
      starts: affected.filter((effect) => effect.transition === 'starts-matching'),
      stops: affected.filter((effect) => effect.transition === 'stops-matching'),
      undetermined: affected.filter((effect) => effect.transition === 'undetermined'),
      unaffectedCount: report.rules.length - affected.length,
    };
  }, [report.rules]);

  // Nobody has asked yet. The parent owns the control that asks.
  if (report.status === 'not-computed') return null;

  if (report.status === 'unavailable') {
    return (
      <div className={className}>
        <AlertMessage
          message={{
            type: 'info',
            text: "This org's group rules could not be loaded, so no prediction can be made about this edit. That is not the same as predicting no change.",
          }}
        />
      </div>
    );
  }

  const groupCount = report.groups.length;
  const ruleCount = starts.length + stops.length + undetermined.length;

  if (groupCount === 0 && ruleCount === 0) {
    return (
      <div className={`flex flex-col gap-(--sp-rung) ${className}`}>
        <EmptyState
          icon="check"
          title="No group changes predicted"
          description="No group rule's verdict about this user moves under this edit, so no membership is predicted to change."
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-(--sp-rung) ${className}`}>
      <div
        className="flex flex-wrap items-center gap-(--sp-inline)"
        role="group"
        aria-label="Report view"
      >
        <FilterPill active={view === 'groups'} onClick={() => setView('groups')}>
          Groups {groupCount}
        </FilterPill>
        <FilterPill active={view === 'rules'} onClick={() => setView('rules')}>
          Rules {ruleCount}
        </FilterPill>
      </div>

      {view === 'groups' ? (
        <div className="flex flex-col gap-(--sp-rung)">
          {groupCount === 0 ? (
            <p className="text-sm text-neutral-600">
              No membership is predicted to change, even though rules below move.
            </p>
          ) : (
            <>
              <GroupSection
                title="Added"
                effects={added}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
              <GroupSection
                title="Removed"
                effects={removed}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
              <GroupSection
                title="Not predicted"
                effects={notPredicted}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-(--sp-rung)">
          {ruleCount === 0 ? (
            <p className="text-sm text-neutral-600">
              No rule&rsquo;s verdict about this user moves.
            </p>
          ) : (
            <>
              <RuleSection
                title="Starts matching"
                effects={starts}
                resolveGroupName={resolveGroupName}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
              <RuleSection
                title="Stops matching"
                effects={stops}
                resolveGroupName={resolveGroupName}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
              <RuleSection
                title="Could not be evaluated"
                effects={undetermined}
                resolveGroupName={resolveGroupName}
                cascadeLines={cascadeLines}
                openRowIds={openRowIds}
                onToggle={toggleRow}
              />
            </>
          )}
          {unaffectedCount > 0 && (
            <p className="text-xs text-neutral-500">
              {unaffectedCount === 1
                ? 'And 1 rule is unaffected by this edit.'
                : `And ${unaffectedCount} rules are unaffected by this edit.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BlastRadiusReport;
