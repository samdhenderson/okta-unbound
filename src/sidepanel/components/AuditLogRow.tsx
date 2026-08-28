/**
 * @module sidepanel/components/AuditLogRow
 * @description One entry in the action history: what happened, when, and — for a
 * profile write — the way back.
 *
 * This replaces a hand-rolled disclosure: a `<div className="cursor-pointer"
 * onClick>` with no `role` and no `aria-expanded`, an inline `<svg>` chevron and
 * a `<span>` wearing badge classes. That shape was already inaccessible, and it
 * became untenable the moment the row had to carry an **Undo** button, because
 * putting a real control inside a clickable `div` nests interactive elements.
 *
 * So the row is built the way ADR-0029 says: shared `ListRow` owns the card and
 * its `body` slot holds the disclosure, a real `IconButton` carries
 * `aria-expanded`/`aria-controls`, and the type mark is a shared `Badge`.
 *
 * ## Undo is offered, or it is absent
 *
 * The button appears only when {@link AuditLogRowProps.undoability} says the
 * entry can be undone. A disabled button with no explanation reads as a bug; the
 * *reason* an entry cannot be undone is a quiet line inside the expanded body,
 * where there is room to say it in a sentence.
 *
 * Security: group names, rule names, user names, attribute names and attribute
 * values in this metadata are all tenant PII, rendered through React's escaping.
 * This component logs nothing.
 */
import React, { useId } from 'react';
import { Badge, Button, IconButton, ListRow } from './shared';
import Icon from './shared/Icon';
import { formatActionTime } from '../../shared/undoManager';
import type { ActionType, CapturedAttribute, UndoAction } from '../../shared/undoTypes';
import type { UseUndoActionReturn } from '../hooks/useUndoAction';

/**
 * The human name of each action type.
 *
 * A `Record`, not the `switch` with a `default:` this row inherited — that
 * default rendered both `CONSOLIDATE_RULE` and `UPDATE_USER_PROFILE` as the
 * uninformative "Action", and would have absorbed the next type just as quietly.
 */
const TYPE_LABEL: Record<ActionType, string> = {
  REMOVE_USER_FROM_GROUP: 'User Removal',
  ADD_USER_TO_GROUP: 'User Addition',
  BULK_REMOVE_USERS_FROM_GROUP: 'Bulk Removal',
  BULK_ADD_USERS_TO_GROUP: 'Bulk Addition',
  ACTIVATE_RULE: 'Rule Activated',
  DEACTIVATE_RULE: 'Rule Deactivated',
  CONSOLIDATE_RULE: 'Rules Consolidated',
  UPDATE_USER_PROFILE: 'Profile Updated',
};

/** The outcome mark a non-completed entry wears, if any. */
const STATUS_BADGE: Partial<
  Record<UndoAction['status'], { label: string; variant: 'info' | 'warning' | 'danger' }>
> = {
  undone: { label: 'Undone', variant: 'info' },
  // "Outcome unknown", never "Partial": the write may have applied in full. The
  // one thing we can state is that nobody confirmed it.
  partial: { label: 'Outcome unknown', variant: 'warning' },
  failed: { label: 'Failed', variant: 'danger' },
};

/** Props for {@link AuditLogRow}. */
export interface AuditLogRowProps {
  /** The history entry this row is about. */
  action: UndoAction;
  /** Whether the disclosure is open. Owned by the list, so a refresh cannot close a row. */
  isExpanded: boolean;
  /** Toggles this row's disclosure, by action id. */
  onToggle: (actionId: string) => void;
  /**
   * Opens the undo confirmation for this entry. Omitted, no Undo button is
   * rendered at all — a surface that cannot undo does not offer to.
   */
  onUndo?: (action: UndoAction) => void;
  /**
   * The pure eligibility test from `useUndoAction`. The row asks rather than
   * deciding: the rules for what can be undone live with the executor that has
   * to honour them.
   */
  undoability: UseUndoActionReturn['undoability'];
}

/** A label/value pair in the expanded body. */
const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-2 text-sm">
    <span className="min-w-25 font-medium text-neutral-600">{label}:</span>
    <span className="break-words text-neutral-900">{value}</span>
  </div>
);

/**
 * The label/value rows for one entry, ported from the viewer this row replaces.
 *
 * @param action - The entry to describe.
 * @returns Rows in display order. `UPDATE_USER_PROFILE` contributes only the
 * *who*; its per-attribute diff renders separately, since it is a list rather
 * than a pair.
 */
function detailRows(action: UndoAction): Array<[string, string]> {
  const metadata = action.metadata;
  const rows: Array<[string, string]> = [];

  if (metadata.type === 'REMOVE_USER_FROM_GROUP' || metadata.type === 'ADD_USER_TO_GROUP') {
    rows.push(['User', `${metadata.userName} (${metadata.userEmail})`]);
    rows.push(['Group', metadata.groupName]);
    rows.push(['User ID', metadata.userId]);
    rows.push(['Group ID', metadata.groupId]);
  } else if (
    metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' ||
    metadata.type === 'BULK_ADD_USERS_TO_GROUP'
  ) {
    rows.push(['Group', metadata.groupName]);
    rows.push(['Users affected', String(metadata.users.length)]);
    rows.push(['Group ID', metadata.groupId]);
    if (metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' && metadata.operationType) {
      rows.push(['Operation', metadata.operationType]);
    }
  } else if (metadata.type === 'ACTIVATE_RULE' || metadata.type === 'DEACTIVATE_RULE') {
    rows.push(['Rule', metadata.ruleName]);
    rows.push(['Rule ID', metadata.ruleId]);
  } else if (metadata.type === 'CONSOLIDATE_RULE') {
    // The viewer had no branch for this type at all, so a consolidation opened
    // to an empty body. Added rather than re-inherited.
    rows.push(['New rule', metadata.createdRuleName]);
    rows.push(['New rule ID', metadata.createdRuleId]);
    rows.push(['Target groups', String(metadata.createdGroupIds.length)]);
    rows.push(['Rules retired', metadata.retiredRules.map((rule) => rule.name).join(', ')]);
  } else {
    rows.push(['User', `${metadata.userName} (${metadata.userLogin})`]);
    rows.push(['User ID', metadata.userId]);
  }

  return rows;
}

/** One `before → after` line, or a note that the prior value was never captured. */
const ChangeRow: React.FC<{ change: CapturedAttribute }> = ({ change }) => (
  <li className="text-sm">
    <span className="font-medium text-neutral-600">{change.label}:</span>{' '}
    {change.restorable ? (
      <span className="break-words text-neutral-900">
        {change.beforeDisplay === '' ? (
          <em className="text-neutral-500">empty</em>
        ) : (
          change.beforeDisplay
        )}
        <span aria-hidden="true"> → </span>
        <span className="sr-only"> changed to </span>
        {change.afterDisplay === '' ? (
          <em className="text-neutral-500">empty</em>
        ) : (
          change.afterDisplay
        )}
      </span>
    ) : (
      <span className="break-words text-neutral-900">
        {change.afterDisplay === '' ? (
          <em className="text-neutral-500">empty</em>
        ) : (
          change.afterDisplay
        )}{' '}
        <span className="text-xs text-neutral-600">(previous value not captured)</span>
      </span>
    )}
  </li>
);

/**
 * One row of the action history: description, type, time, and a disclosure
 * holding the per-type detail.
 *
 * @param props - See {@link AuditLogRowProps}.
 */
const AuditLogRow: React.FC<AuditLogRowProps> = ({
  action,
  isExpanded,
  onToggle,
  onUndo,
  undoability,
}) => {
  // `useId`, not the action id: a DOM id built from stored data is a selector
  // waiting to break, and React already hands out a unique one.
  const disclosureId = useId();
  const verdict = undoability(action);
  const statusBadge = STATUS_BADGE[action.status];
  const metadata = action.metadata;

  return (
    <ListRow
      density="compact"
      dataAttributes={{ 'data-action-id': action.id }}
      body={
        // `.disclose` animates `grid-template-rows` 0fr → 1fr with no JS
        // measurement, and `inert` keeps the closed body out of the tab order and
        // the accessibility tree.
        <div
          id={disclosureId}
          className="disclose"
          data-open={isExpanded}
          inert={!isExpanded || undefined}
        >
          <div>
            <div className="space-y-2 border-t border-neutral-200 px-3 pb-3 pt-2">
              {detailRows(action).map(([label, value]) => (
                <DetailRow key={label} label={label} value={value} />
              ))}

              {metadata.type === 'UPDATE_USER_PROFILE' && (
                <ul className="space-y-1">
                  {metadata.changes.map((change) => (
                    <ChangeRow key={change.name} change={change} />
                  ))}
                </ul>
              )}

              {/*
                Why there is no Undo button on this row. It lives here rather than
                as a disabled control with a tooltip: a disabled button says "not
                now" where this needs to say "not ever, and here is why".
              */}
              {!verdict.undoable && (
                <p className="text-xs text-pretty text-neutral-600">{verdict.reason}</p>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{action.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge>{TYPE_LABEL[action.type]}</Badge>
            {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
            <span className="text-xs text-neutral-500">{formatActionTime(action.timestamp)}</span>
          </div>
        </div>

        {verdict.undoable && onUndo && (
          <Button size="sm" className="shrink-0" onClick={() => onUndo(action)}>
            Undo
          </Button>
        )}

        <IconButton
          label={`${isExpanded ? 'Hide' : 'Show'} details for ${action.description}`}
          variant="ghost"
          size="sm"
          expanded={isExpanded}
          controls={disclosureId}
          className="shrink-0"
          onClick={() => onToggle(action.id)}
        >
          <Icon
            type="chevron-right"
            size="sm"
            className={`transition-transform duration-(--dur-quick) ${isExpanded ? 'rotate-90' : ''}`}
          />
        </IconButton>
      </div>
    </ListRow>
  );
};

export default AuditLogRow;
