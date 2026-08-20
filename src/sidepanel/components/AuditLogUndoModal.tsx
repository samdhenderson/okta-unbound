/**
 * @module sidepanel/components/AuditLogUndoModal
 * @description The confirmation for undoing a recorded profile write — and the
 * place a refusal is explained.
 *
 * Undo in this extension is a **forward write**: Okta has no rollback, so
 * restoring an attribute means issuing a new update that happens to set the old
 * value. The dialog says so out loud, because the two differ in ways the admin
 * can see: the restore can fail, it costs a rate-limit slot, and it appears in
 * the history as its own entry rather than erasing the one it undoes.
 *
 * ## Three bodies, one dialog
 *
 * - **Confirm** — every attribute that will be restored, `after → before`, plus
 *   the ones that cannot be and why. A partial restore is stated as "3 of 5",
 *   never performed quietly: silently restoring a subset would be a lie, and
 *   refusing the whole thing would strand the attributes we *can* put back.
 * - **Drifted** — the executor re-read the user and found an attribute is no
 *   longer what the original write set, so someone else owns it now. This is a
 *   **refusal**, not a failure the admin caused, and it is worded as one. Only
 *   the attribute *names* are shown; a drifted value is never rendered or
 *   messaged.
 * - **Failed** — an ordinary `danger` alert above the confirm body, so the
 *   action can be retried without reopening.
 *
 * Security: attribute names, labels and values here are tenant PII rendered
 * through React's escaping. This component logs nothing.
 */
import React from 'react';
import { AlertMessage, Badge, Button, Modal } from './shared';
import type { CaptureOmission, CapturedAttribute, UndoAction } from '../../shared/undoTypes';

/** Why a captured attribute has no prior value to put back, in the admin's words. */
const OMISSION_REASON: Record<CaptureOmission, string> = {
  'too-large': 'Previous value was not captured (too large)',
  'too-many': 'Previous value was not captured (too many attributes changed at once)',
};

/**
 * Fallback for an unrestorable change with no `omitted` code — only reachable
 * from a history entry written by an older build.
 */
const OMISSION_FALLBACK = 'Previous value was not captured';

/** Props for {@link AuditLogUndoModal}. */
export interface AuditLogUndoModalProps {
  /** The entry being undone. `null` closes the dialog. */
  action: UndoAction | null;
  /** Called on Cancel, Escape, overlay click, or the header close button. */
  onClose: () => void;
  /** Runs the restoring write. The dialog never calls Okta itself. */
  onConfirm: () => void;
  /** Whether the restoring write is in flight; drives the confirm button's spinner. */
  isUndoing: boolean;
  /**
   * Attributes the executor found changed in Okta since the original write.
   * Present means the undo was **refused** — names only, never values.
   */
  drifted?: readonly string[];
  /** Message from a restore that was attempted and did not succeed. */
  error?: string;
}

/** A value that may legitimately be the empty string, rendered so you can tell. */
const Value: React.FC<{ text: string; muted?: boolean }> = ({ text, muted = false }) =>
  text === '' ? (
    <em className="text-neutral-500">empty</em>
  ) : (
    <span className={muted ? 'text-neutral-600 line-through' : 'text-neutral-900'}>{text}</span>
  );

/** One `after → before` line for an attribute that will be put back. */
const RestoreRow: React.FC<{ change: CapturedAttribute }> = ({ change }) => (
  <li>
    <p className="text-xs font-medium text-neutral-700">{change.label}</p>
    <p className="text-sm text-pretty break-words">
      <Value text={change.afterDisplay} muted />
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> will be restored to </span>
      <Value text={change.beforeDisplay ?? ''} />
    </p>
  </li>
);

/** One line for an attribute whose prior value was never captured. */
const SkippedRow: React.FC<{ change: CapturedAttribute }> = ({ change }) => (
  <li className="flex items-start justify-between gap-2">
    <span className="text-xs font-medium text-neutral-700">{change.label}</span>
    <span className="text-right text-xs text-neutral-600">
      {change.omitted ? OMISSION_REASON[change.omitted] : OMISSION_FALLBACK}
    </span>
  </li>
);

/**
 * The confirm body: what will be restored, what cannot be, and the reminder that
 * this is a write of its own.
 */
const ConfirmBody: React.FC<{ changes: CapturedAttribute[] }> = ({ changes }) => {
  const restorable = changes.filter((change) => change.restorable);
  const skipped = changes.filter((change) => !change.restorable);

  return (
    <div className="space-y-4">
      <p className="text-sm text-pretty text-neutral-700">
        {restorable.length === changes.length
          ? `The previous value of ${restorable.length} attribute${restorable.length === 1 ? '' : 's'} will be written back to Okta.`
          : `${restorable.length} of ${changes.length} attributes can be restored.`}
      </p>

      <ul className="space-y-2">
        {restorable.map((change) => (
          <RestoreRow key={change.name} change={change} />
        ))}
      </ul>

      {skipped.length > 0 && (
        <div className="space-y-2 border-t border-neutral-200 pt-3">
          <p className="text-xs font-semibold text-neutral-700">
            Left unchanged ({skipped.length})
          </p>
          <ul className="space-y-1">
            {skipped.map((change) => (
              <SkippedRow key={change.name} change={change} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-pretty text-neutral-600">
        Okta has no rollback, so this is a new write rather than a reversal. It gets its own entry
        in this history, linked to the one it undoes — nothing is erased.
      </p>
    </div>
  );
};

/**
 * The refusal body. Named attributes changed in Okta after the original write,
 * so restoring would overwrite whoever changed them.
 */
const DriftedBody: React.FC<{ attributeNames: readonly string[] }> = ({ attributeNames }) => (
  <div className="space-y-4">
    <AlertMessage
      message={{
        type: 'warning',
        text: 'Nothing was written. These attributes are no longer what this edit set.',
      }}
    />

    <ul className="flex flex-wrap gap-2">
      {attributeNames.map((name) => (
        <li key={name}>
          <Badge variant="warning">{name}</Badge>
        </li>
      ))}
    </ul>

    <p className="text-sm text-pretty text-neutral-700">
      Someone or something else has changed {attributeNames.length === 1 ? 'it' : 'them'} since.
      Putting the previous values back would overwrite that change, so the undo was refused rather
      than performed.
    </p>
    <p className="text-xs text-pretty text-neutral-600">
      Open the user in Okta to see the current values and decide what should stand.
    </p>
  </div>
);

/**
 * Confirms — or explains the refusal of — an undo of a recorded profile write.
 *
 * @param props - See {@link AuditLogUndoModalProps}.
 *
 * @example
 * ```tsx
 * <AuditLogUndoModal
 *   action={pending}
 *   onClose={() => setPending(null)}
 *   onConfirm={runUndo}
 *   isUndoing={undoingActionId === pending?.id}
 *   drifted={outcome?.kind === 'drifted' ? outcome.attributeNames : undefined}
 * />
 * ```
 */
const AuditLogUndoModal: React.FC<AuditLogUndoModalProps> = ({
  action,
  onClose,
  onConfirm,
  isUndoing,
  drifted,
  error,
}) => {
  const isDrifted = drifted !== undefined && drifted.length > 0;
  const metadata = action?.metadata;
  const changes = metadata?.type === 'UPDATE_USER_PROFILE' ? metadata.changes : [];

  return (
    <Modal
      isOpen={action !== null}
      onClose={onClose}
      title={isDrifted ? 'Undo refused' : 'Restore previous values'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {isDrifted ? 'Close' : 'Cancel'}
          </Button>
          {/* A refusal has nothing to confirm — re-offering the action here would
              invite the admin to press past a guard that just protected them. */}
          {!isDrifted && (
            <Button variant="primary" loading={isUndoing} onClick={onConfirm}>
              Restore
            </Button>
          )}
        </>
      }
    >
      {isDrifted ? (
        <DriftedBody attributeNames={drifted} />
      ) : (
        <div className="space-y-4">
          {error !== undefined && <AlertMessage message={{ type: 'danger', text: error }} />}
          {changes.length > 0 ? (
            <ConfirmBody changes={changes} />
          ) : (
            <p className="text-sm text-neutral-700">
              This entry has no captured previous values, so there is nothing to restore.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AuditLogUndoModal;
