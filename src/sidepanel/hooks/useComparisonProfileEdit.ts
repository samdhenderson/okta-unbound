/**
 * @module sidepanel/hooks/useComparisonProfileEdit
 * @description Two independent profile editors — one per column of the two-user
 * Compare view — plus the one confirmation the surface may show at a time.
 *
 * The Compare view's Attributes tab puts two people's values for the same
 * attribute beside each other, so the edit an admin wants to make is nearly
 * always *"make this one look like that one"* — and which side that is depends
 * on which is right. Both sides are therefore editable, separately.
 *
 * ## Why two hook instances rather than one editor with a side switch
 *
 * {@link module:sidepanel/hooks/useProfileEdit} holds no module state and reads
 * nothing global, precisely so two of them can coexist. Composing two is what
 * gives each column its own edit mode, its own draft and its own in-flight save
 * for free; a single editor with a `side` discriminant would have to re-derive
 * all three, and would make "cancel the left column" a decision about the right
 * one.
 *
 * Each side also gets its **own** {@link module:sidepanel/hooks/useBlastRadius}.
 * A report is an answer about one person's memberships against one draft, and
 * one shared instance would be a report that has to be told which user it is
 * about — the exact shape of bug that ends in a confident, specific, wrong
 * answer beside the wrong name. Both instances retract on every draft change,
 * and `useBlastRadius` additionally retracts when its subject changes.
 *
 * ## The context side needs a host that can lift the result
 *
 * The compared user is local state inside `useUserComparison`, so lifting a
 * saved compared user is a `setState`. The **context** user is a prop — it is
 * the Users tab's `selectedUser` — so a save on the left column can only be
 * published by the host that owns it. Without
 * {@link UseComparisonProfileEditOptions.onContextUserUpdated} a context-side
 * save would leave every other surface rendering values Okta no longer holds,
 * so the left column offers **no edit affordance at all** until a host supplies
 * it. A missing affordance is recoverable; a screen quietly disagreeing with the
 * directory is not.
 *
 * ## Three outcomes, three different places to say so
 *
 * `useProfileEdit` answers `saved` / `failed` / `unknown` and this hook routes
 * each to the surface that can act on it:
 *
 * - `saved` — the confirmation closes, the draft is gone, nothing is said.
 * - `failed` — Okta answered and said no, and the draft survives, so the
 *   confirmation is **re-armed** with the message on it. The admin is still in
 *   the flow they were in, one fix away from retrying.
 * - `unknown` — the write may have landed. `useProfileEdit` has already left
 *   edit mode, so there is no confirmation left to hold the message: it becomes
 *   a warning on the tab itself, telling the admin to reload before editing
 *   again.
 *
 * ## Security
 *
 * Attribute names, labels, values and both users' display names are tenant data
 * and frequently PII. **Nothing in this module logs**, and every string it
 * produces is handed to React to escape.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfileEdit, type AttributeEditCell } from './useProfileEdit';
import { useBlastRadius } from './useBlastRadius';
import type { AttributeDescriptor } from '../components/users/profileAttributes';
import type { ProfileMastering } from '../components/users/profileEditability';
import type { DraftChange } from '../components/users/profileDraft';
import type {
  BlastRadiusReport,
  RuleInventoryState,
} from '../../shared/membership/blastRadiusTypes';
import type { GroupMembership, OktaUser } from '../../shared/types';

/** Which column of the comparison an editor belongs to. */
export type ComparisonEditSideKey = 'context' | 'compared';

/**
 * A message about a save that is no longer in flight.
 *
 * Carries its own severity because the two states are genuinely different:
 * `danger` is "Okta rejected this and nothing changed", `warning` is "this may
 * have applied and we cannot tell". Collapsing them would report an ambiguous
 * write as a failed one. ADR-0002: `danger`, never `error`.
 */
export interface ComparisonEditMessage {
  /** Severity, in the shared status vocabulary. */
  readonly type: 'danger' | 'warning';
  /** A complete sentence, safe to render as-is. **May name the user — PII.** */
  readonly text: string;
}

/**
 * One column's editing surface: everything the toolbar's controls and the rows'
 * cells need, and nothing about the other column.
 */
export interface ComparisonEditSide {
  /** Which column this is. */
  readonly key: ComparisonEditSideKey;
  /** The user's display name, for the affordance that names whose profile is being edited. **PII.** */
  readonly userName: string;
  /**
   * Attribute name → its cell. **Empty unless this column is editing**, so a row
   * may index it unconditionally and read `undefined` as "render me read-only".
   */
  readonly cells: Readonly<Record<string, AttributeEditCell>>;
  /** Whether this column is in edit mode. */
  readonly isEditing: boolean;
  /** Whether a confirmed write for this column is in flight. */
  readonly isSaving: boolean;
  /** Whether anything on this column would actually be written. */
  readonly hasChanges: boolean;
  /** Whether any drafted value on this column fails validation; blocks save. */
  readonly hasInvalid: boolean;
  /**
   * Whether this column may be edited here at all — a user is loaded, the
   * surface is visible (ADR-0018), and (context side only) the host can publish
   * the result. `false` renders no affordance rather than a disabled one.
   */
  readonly canEdit: boolean;
  /** The outcome of the last save, when it is this surface's job to say it. */
  readonly message?: ComparisonEditMessage;
  /** Enter edit mode on this column with a clean draft. */
  readonly begin: () => void;
  /** Leave edit mode on this column, discarding its draft. */
  readonly cancel: () => void;
  /** Arm this column's confirmation. */
  readonly requestSave: () => void;
}

/**
 * The single confirmation the comparison may be showing, tagged with the column
 * it belongs to.
 *
 * A nullable object rather than a flag beside two sets of props, for the reason
 * `useProfileEdit.pendingSave` is one: the changes being confirmed and whose
 * they are cannot then drift apart, and the modal renders the exact list the
 * write will use.
 */
export interface ComparisonPendingSave {
  /** Which column armed it. */
  readonly side: ComparisonEditSideKey;
  /** Whose profile is being written. **PII.** */
  readonly userName: string;
  /** The changes awaiting confirmation, in display order. */
  readonly changes: readonly DraftChange[];
  /** True while the confirmed write is in flight. */
  readonly isSaving: boolean;
  /** The blast-radius report for this column's draft; `not-computed` until asked. */
  readonly report: BlastRadiusReport;
  /** True while this column's analysis runs. */
  readonly isAnalyzing: boolean;
  /** A message from a previous attempt that failed, kept on the re-armed confirmation. */
  readonly error?: string;
  /** Run the analysis against this column's draft. Costs no API calls. */
  readonly analyze: () => void;
  /** Dismiss without writing. The draft and edit mode survive. */
  readonly cancel: () => void;
  /** Perform the write. */
  readonly confirm: () => void;
}

/** Options for {@link useComparisonProfileEdit}. */
export interface UseComparisonProfileEditOptions {
  /** The anchor user — the LEFT column. */
  readonly contextUser: OktaUser;
  /** The anchor user's display name. */
  readonly contextName: string;
  /** The anchor user's attribute inventory, exactly as the tab renders it. */
  readonly contextAttributes: readonly AttributeDescriptor[];
  /**
   * Which profile sources are attached to the anchor user, for the editability
   * gate — the app list `useComparisonApps` already walked, discarded when that
   * walk came back incomplete. Without it every `PROFILE_MASTER` attribute stays
   * locked ({@link module:sidepanel/components/users/profileEditability}).
   */
  readonly contextMastering: ProfileMastering;
  /** The anchor user's complete membership list, for the blast-radius engine. */
  readonly contextMemberships: readonly GroupMembership[];
  /**
   * Lifts a saved context user to whoever owns it. **Absent means the left
   * column is read-only** — see the module header.
   */
  readonly onContextUserUpdated?: (user: OktaUser) => void;
  /** The compared user — the RIGHT column. `null` in the search phase. */
  readonly comparedUser: OktaUser | null;
  /** The compared user's display name; `''` when none is picked. */
  readonly comparedName: string;
  /** The compared user's attribute inventory. */
  readonly comparedAttributes: readonly AttributeDescriptor[];
  /** The same, for the compared user. See {@link UseComparisonProfileEditOptions.contextMastering}. */
  readonly comparedMastering: ProfileMastering;
  /** The compared user's complete membership list. */
  readonly comparedMemberships: readonly GroupMembership[];
  /** Lifts a saved compared user — `setComparedUser` in `useUserComparison`. */
  readonly onComparedUserUpdated: (user: OktaUser) => void;
  /** The org rule inventory, three-state, shared by both columns' predictions. */
  readonly rules: RuleInventoryState;
  /** Connected org origin, so the blast-radius report can label group ids. */
  readonly oktaOrigin?: string | null;
  /** Tab whose scheduler runs the writes. */
  readonly targetTabId: number | undefined;
  /**
   * Whether the comparison is on screen AND a second user is picked. `false`
   * blocks entering edit mode and blocks every write (ADR-0018/ADR-0026).
   */
  readonly enabled: boolean;
}

/** What {@link useComparisonProfileEdit} returns. */
export interface UseComparisonProfileEditReturn {
  /** The left column's editor. */
  readonly context: ComparisonEditSide;
  /** The right column's editor. */
  readonly compared: ComparisonEditSide;
  /** The one confirmation on screen, or `null`. */
  readonly pendingSave: ComparisonPendingSave | null;
}

/** Options for one column's editor. */
interface SideOptions {
  readonly key: ComparisonEditSideKey;
  readonly user: OktaUser | null;
  readonly userName: string;
  readonly attributes: readonly AttributeDescriptor[];
  readonly mastering: ProfileMastering;
  readonly memberships: readonly GroupMembership[];
  readonly onUserUpdated?: (user: OktaUser) => void;
  readonly rules: RuleInventoryState;
  readonly oktaOrigin?: string | null;
  readonly targetTabId: number | undefined;
  readonly enabled: boolean;
}

/** One column's editor, and the confirmation it is showing (if any). */
interface SideResult {
  readonly side: ComparisonEditSide;
  readonly pending: ComparisonPendingSave | null;
}

/** Nothing was lifted, because nothing can be. Shared so the hook's deps stay stable. */
const NO_LIFT = (): void => {};

/**
 * Everything one column of the comparison needs in order to edit one user.
 *
 * A hook rather than a plain helper because it *calls* hooks; it is invoked
 * exactly twice, unconditionally, from {@link useComparisonProfileEdit}.
 *
 * @param options - See {@link SideOptions}.
 * @returns This column's {@link ComparisonEditSide} and its pending confirmation.
 */
function useComparisonEditSide({
  key,
  user,
  userName,
  attributes,
  mastering,
  memberships,
  onUserUpdated,
  rules,
  oktaOrigin,
  targetTabId,
  enabled,
}: SideOptions): SideResult {
  const [message, setMessage] = useState<ComparisonEditMessage | undefined>(undefined);

  // A save nobody can publish is a screen that disagrees with the directory, so
  // a column without a lift is a column with no edit affordance.
  const canPublish = onUserUpdated !== undefined;

  const edit = useProfileEdit({
    user,
    attributes,
    mastering,
    targetTabId,
    onUserUpdated: onUserUpdated ?? NO_LIFT,
    enabled: enabled && canPublish,
  });

  const blast = useBlastRadius({ user, memberships, rules, oktaOrigin });

  const { draftPatch, requestSave, dismissSave, confirmSave, begin, cancel } = edit;
  const { analyze, reset: resetBlast } = blast;

  // The report is true for exactly one draft. `draftPatch`'s identity changes
  // only when the draft behind it does (it is memoised on the draft), so this
  // retracts on a keystroke and on nothing else.
  useEffect(() => {
    resetBlast();
  }, [draftPatch, resetBlast]);

  // `confirmSave` clears its own `pendingSave` *before* the request goes out, so
  // a confirmation bound straight to it would vanish the instant the admin
  // confirmed — taking the in-flight state with it. The armed list is therefore
  // captured here as well, at the moment it is armed and from the same `changes`
  // the write will use, and the confirmation is shown for as long as the editor
  // itself says something is armed **or** a write is in flight. It cannot outlive
  // either: a draft reset (a save on the other surface) clears both.
  const [armed, setArmed] = useState<readonly DraftChange[] | null>(null);
  const confirming = edit.pendingSave ?? (edit.isSaving ? armed : null);

  const beginSide = useCallback(() => {
    setMessage(undefined);
    setArmed(null);
    begin();
  }, [begin]);

  const cancelSide = useCallback(() => {
    setMessage(undefined);
    setArmed(null);
    cancel();
  }, [cancel]);

  const { changes, hasChanges, hasInvalid } = edit;

  const requestSaveSide = useCallback(() => {
    // The same guard `requestSave` applies, so the captured list and the
    // editor's own can never disagree about whether anything was armed.
    if (!hasChanges || hasInvalid) return;
    setArmed(changes);
    requestSave();
  }, [hasChanges, hasInvalid, changes, requestSave]);

  const dismiss = useCallback(() => {
    setArmed(null);
    dismissSave();
  }, [dismissSave]);

  const confirm = useCallback(() => {
    void (async () => {
      setMessage(undefined);
      const outcome = await confirmSave();
      if (outcome.kind === 'saved') {
        setArmed(null);
        return;
      }
      if (outcome.kind === 'failed') {
        setMessage({ type: 'danger', text: outcome.error });
        // The draft survived, so re-arm rather than dropping the admin back into
        // a form with no statement of what just happened. This also restores the
        // list a retry would write.
        requestSave();
        return;
      }
      setArmed(null);
      setMessage({
        type: 'warning',
        text: `This panel could not confirm whether the change to ${userName} was saved. Reload the comparison to check before editing again.`,
      });
    })();
  }, [confirmSave, requestSave, userName]);

  const analyzeSide = useCallback(() => {
    analyze(draftPatch);
  }, [analyze, draftPatch]);

  const side = useMemo<ComparisonEditSide>(
    () => ({
      key,
      userName,
      cells: edit.cells,
      isEditing: edit.isEditing,
      isSaving: edit.isSaving,
      hasChanges: edit.hasChanges,
      hasInvalid: edit.hasInvalid,
      canEdit: enabled && canPublish && user !== null,
      // Suppressed while the confirmation is showing it — one message, one place.
      ...(message !== undefined && confirming === null ? { message } : {}),
      begin: beginSide,
      cancel: cancelSide,
      requestSave: requestSaveSide,
    }),
    [
      key,
      userName,
      edit.cells,
      edit.isEditing,
      edit.isSaving,
      edit.hasChanges,
      edit.hasInvalid,
      enabled,
      canPublish,
      user,
      message,
      confirming,
      beginSide,
      cancelSide,
      requestSaveSide,
    ],
  );

  const pending = useMemo<ComparisonPendingSave | null>(
    () =>
      confirming === null
        ? null
        : {
            side: key,
            userName,
            changes: confirming,
            isSaving: edit.isSaving,
            report: blast.report,
            isAnalyzing: blast.isAnalyzing,
            ...(message?.type === 'danger' ? { error: message.text } : {}),
            analyze: analyzeSide,
            cancel: dismiss,
            confirm,
          },
    [
      confirming,
      key,
      userName,
      edit.isSaving,
      blast.report,
      blast.isAnalyzing,
      message,
      analyzeSide,
      dismiss,
      confirm,
    ],
  );

  return { side, pending };
}

/**
 * Editing state for both columns of the two-user comparison.
 *
 * @param options - See {@link UseComparisonProfileEditOptions}.
 * @returns Both columns' editors and the single confirmation on screen. See
 *   {@link UseComparisonProfileEditReturn}.
 *
 * @remarks Only one confirmation is reachable at a time — arming one puts a
 * modal over the controls that would arm the other — but the context column wins
 * if both are ever armed, so the surface can never be asked to show two.
 *
 * @example
 * ```tsx
 * const attributeEdit = useComparisonProfileEdit({ …, enabled: isActive && comparedUser !== null });
 * <ComparisonAttributesTab contextEdit={attributeEdit.context} comparedEdit={attributeEdit.compared} … />
 * ```
 */
export function useComparisonProfileEdit({
  contextUser,
  contextName,
  contextAttributes,
  contextMastering,
  contextMemberships,
  onContextUserUpdated,
  comparedUser,
  comparedName,
  comparedAttributes,
  comparedMastering,
  comparedMemberships,
  onComparedUserUpdated,
  rules,
  oktaOrigin,
  targetTabId,
  enabled,
}: UseComparisonProfileEditOptions): UseComparisonProfileEditReturn {
  const context = useComparisonEditSide({
    key: 'context',
    user: contextUser,
    userName: contextName,
    attributes: contextAttributes,
    mastering: contextMastering,
    memberships: contextMemberships,
    ...(onContextUserUpdated === undefined ? {} : { onUserUpdated: onContextUserUpdated }),
    rules,
    oktaOrigin,
    targetTabId,
    enabled,
  });

  const compared = useComparisonEditSide({
    key: 'compared',
    user: comparedUser,
    userName: comparedName,
    attributes: comparedAttributes,
    mastering: comparedMastering,
    memberships: comparedMemberships,
    onUserUpdated: onComparedUserUpdated,
    rules,
    oktaOrigin,
    targetTabId,
    enabled,
  });

  return {
    context: context.side,
    compared: compared.side,
    pendingSave: context.pending ?? compared.pending,
  };
}
