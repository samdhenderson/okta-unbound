/**
 * @module sidepanel/components/users/ProfileSaveModal
 * @description The last thing between an admin's profile edits and a live write
 * to Okta: it restates every change, offers the blast-radius analysis, and
 * confirms.
 *
 * Purely presentational. The draft, the diff and the request all live in
 * `useProfileEdit`, and the prediction lives in `useBlastRadius` — this component
 * receives `report`, `onAnalyze` and `isAnalyzing` as props rather than calling
 * the hook, so the modal can be rendered in a story or a test with any report
 * state and no hook, cache or storage behind it.
 *
 * ## Why it restates rather than summarises
 *
 * The edit surface behind this modal is a form: by the time an admin has typed
 * in four fields they are looking at four *new* values and no longer at the old
 * ones. So the confirmation lists every changed attribute with **both** sides,
 * and the two states a form cannot show are given words rather than blanks — an
 * unset prior value reads `— not set`, and an emptied new value reads
 * `— cleared`. A blank cell beside an arrow reads as a rendering bug, and
 * "cleared" is a decision an admin must be able to see they made.
 *
 * Values wrap and never truncate, for the same reason
 * {@link module:sidepanel/components/users/UserProfileAttributeList} does not: a
 * clipped value beside a `→` is not merely inconvenient, it is misleading about
 * what is being written.
 *
 * ## `login` gets its own warning
 *
 * Every other attribute in a profile patch is data about a person. `login` is
 * how that person gets in. `DraftChange.changesSignIn` marks it, and this
 * surface raises it to a `danger` alert of its own **in addition to** the
 * ordinary overwrite warning — never as one more line in the list — because the
 * consequence lands on someone who is not in the room.
 *
 * ## The analysis is opt-in and offered once
 *
 * The draft cannot change while this modal is open, so the report can only ever
 * be computed once for it: the Analyze button is replaced by its own answer
 * rather than becoming a re-run of a question with a fixed answer.
 * `BlastRadiusReport` renders nothing under `not-computed`, so it is mounted
 * unconditionally beneath the button.
 *
 * ## Security
 *
 * Attribute names, labels, every before/after value and the user's name are
 * end-user-controllable tenant data and frequently PII. They are rendered
 * through React's escaping only — no `dangerouslySetInnerHTML`, no hand-built
 * HTML — and **nothing in this module logs**.
 */
import React from 'react';
import { AlertMessage, Badge, Button, Eyebrow, Modal } from '../shared';
import BlastRadiusReport from './BlastRadiusReport';
import type { BlastRadiusReport as BlastRadiusReportData } from '../../../shared/membership/blastRadiusTypes';
import type { DraftChange } from './profileDraft';

/** Props for {@link ProfileSaveModal}. */
export interface ProfileSaveModalProps {
  /**
   * The changes awaiting confirmation — the nullable discriminant that opens the
   * modal, mirroring `useUserLifecycleActions`. `null` closes it. A parent sets
   * it only when the diff is non-empty (`useProfileEdit.requestSave`).
   */
  changes: readonly DraftChange[] | null;
  /** Whose profile this is, for the warning sentence. **PII** — escaped by React, never logged. */
  userName: string;
  /**
   * Dismiss without writing anything. Also fires on Escape, overlay click and
   * the close button — and those three belong to `Modal`, so unlike the Cancel
   * button they are **not** suppressed while `isSaving`. A parent that closes on
   * cancel should ignore one that arrives mid-write rather than tearing down a
   * request it cannot recall.
   */
  onCancel: () => void;
  /** Perform the write. The parent decides whether the modal then closes or stays open with an `error`. */
  onConfirm: () => void;
  /** True while the write is in flight; loads the confirm button and locks Cancel. */
  isSaving: boolean;
  /**
   * The blast-radius report from `useBlastRadius`. `not-computed` until the
   * reader asks, and it renders nothing in that state.
   */
  report: BlastRadiusReportData;
  /** Run the analysis. Costs no API calls; the engine is pure and synchronous. */
  onAnalyze: () => void;
  /** True while the analysis runs; loads the Analyze button. */
  isAnalyzing: boolean;
  /** Message from a previous save attempt that failed, if the parent kept the modal open. */
  error?: string;
}

/**
 * One side of a change. An empty string is a state, not a gap, so it is given
 * the word the admin needs rather than the blank the data has.
 */
const Value: React.FC<{ text: string; side: 'before' | 'after' }> = ({ text, side }) =>
  text === '' ? (
    <em className="text-neutral-500">{side === 'before' ? '— not set' : '— cleared'}</em>
  ) : (
    <span className={side === 'before' ? 'text-neutral-600' : 'font-medium text-neutral-900'}>
      {text}
    </span>
  );

/**
 * One attribute's `before → after` line. The arrow is decorative and carries a
 * spoken equivalent beside it; the values wrap rather than truncating.
 */
const ChangeRow: React.FC<{ change: DraftChange }> = ({ change }) => (
  <li className="px-(--sp-row-x) py-(--sp-row-y)">
    <div className="flex flex-wrap items-center justify-between gap-(--sp-inline)">
      <p className="text-sm font-semibold text-neutral-900">{change.label}</p>
      {change.changesSignIn && <Badge variant="danger">Sign-in</Badge>}
    </div>
    {change.name !== change.label && (
      <p className="font-mono text-xs text-neutral-500">{change.name}</p>
    )}
    <p className="mt-1 text-sm text-pretty break-words">
      <Value text={change.beforeDisplay} side="before" />
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> changes to </span>
      <Value text={change.afterDisplay} side="after" />
    </p>
  </li>
);

/**
 * Confirms a set of profile-attribute edits before they are written to Okta:
 * the overwrite warning, the change list, the optional blast-radius prediction,
 * and the destructive confirm.
 *
 * @param props - See {@link ProfileSaveModalProps}.
 *
 * @example
 * ```tsx
 * <ProfileSaveModal
 *   changes={edit.pendingSave}
 *   userName={displayName}
 *   onCancel={edit.cancelSave}
 *   onConfirm={edit.confirmSave}
 *   isSaving={edit.isSaving}
 *   report={blast.report}
 *   onAnalyze={() => blast.analyze(edit.draftPatch)}
 *   isAnalyzing={blast.isAnalyzing}
 * />
 * ```
 */
const ProfileSaveModal: React.FC<ProfileSaveModalProps> = ({
  changes,
  userName,
  onCancel,
  onConfirm,
  isSaving,
  report,
  onAnalyze,
  isAnalyzing,
  error,
}) => {
  const items = changes ?? [];
  const count = items.length;
  const changesSignIn = items.some((change) => change.changesSignIn);
  // Asked and answered. The draft is frozen for as long as this modal is open,
  // so a second run of the analysis could only return the same report.
  const analyzed = report.status !== 'not-computed';

  return (
    <Modal
      isOpen={changes !== null}
      onClose={onCancel}
      title="Save profile changes?"
      // `lg` rather than the confirm-modal default: a computed report brings its
      // own pills, section headings and per-group reasons, and at `md` those wrap
      // into an unreadable column on a docked panel. At 360px the viewport is the
      // constraint either way.
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          {/*
            `danger`, not `primary`: this overwrites live values in the org's
            directory, and the panel offers no undo of its own from here.
          */}
          <Button variant="danger" loading={isSaving} onClick={onConfirm}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-(--sp-rung)">
        {error !== undefined && <AlertMessage message={{ type: 'danger', text: error }} />}

        <AlertMessage
          message={{
            type: 'warning',
            text: `${count} attribute${count === 1 ? '' : 's'} on ${userName} will be overwritten in Okta. This is a live write.`,
          }}
        />

        {/*
          Separate from, and louder than, the overwrite warning. Everything else
          in a profile describes the person; `login` is how they get in.
        */}
        {changesSignIn && (
          <AlertMessage
            message={{
              type: 'danger',
              text: `This changes how ${userName} signs in. Their current sign-in value stops working as soon as this is saved, and Okta does not announce it — tell them yourself.`,
            }}
          />
        )}

        <section className="space-y-2">
          <Eyebrow as="h3">Changes</Eyebrow>
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {items.map((change) => (
              <ChangeRow key={change.name} change={change} />
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <Eyebrow as="h3">Blast radius</Eyebrow>
          <p className="text-xs text-pretty text-neutral-600">
            Group rules read profile attributes, so this edit can move group access. Anything shown
            here is a prediction, not a guarantee.
          </p>
          {!analyzed && (
            <Button
              variant="secondary"
              size="sm"
              icon="chart"
              loading={isAnalyzing}
              onClick={onAnalyze}
            >
              Analyze blast radius
            </Button>
          )}
          {/* Renders nothing at all under `not-computed`, so it needs no gate. */}
          <BlastRadiusReport report={report} />
        </section>
      </div>
    </Modal>
  );
};

export default ProfileSaveModal;
