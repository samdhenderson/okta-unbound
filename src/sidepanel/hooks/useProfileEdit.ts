/**
 * @module sidepanel/hooks/useProfileEdit
 * @description The one hook that drives profile-attribute editing, on both
 * surfaces that offer it.
 *
 * The Users tab's Profile pane and the two-user Compare view each edit a user's
 * profile, and the Compare view needs **two** editors at once — one per column.
 * This hook therefore holds no module state and reads nothing global: every
 * instance owns its own edit mode, its own draft, and its own in-flight save, so
 * two of them over two different users (or, transiently, over the *same* user)
 * are independent.
 *
 * It is a composition, not a re-implementation. The three decisions that have to
 * be identical everywhere already live in pure modules and are simply called
 * from here:
 * {@link module:sidepanel/components/users/profileEditability} decides what may
 * be edited, {@link module:sidepanel/components/users/profileDraft} coerces and
 * diffs the draft, and
 * {@link module:sidepanel/hooks/useOktaApi/profileOperations} performs the write.
 *
 * ## A draft never outlives the user it was typed against
 *
 * The Compare view's *context user* IS the Users tab's `selectedUser`, and both
 * rungs stay mounted (ADR-0018), so two instances of this hook can be holding
 * drafts over the same person at the same time. When either one saves, the
 * refreshed user is lifted to the shared owner and arrives here with a new
 * `lastUpdated` — which is the signal that the other instance's draft was typed
 * against a profile that no longer exists. Both `id` and `lastUpdated` are
 * watched, and either changing resets the draft and leaves edit mode.
 *
 * That reset is an **adjustment during render**, the pattern
 * {@link module:sidepanel/hooks/useUserDetailPanes} documents: React re-renders
 * immediately without committing the intermediate frame, so no reader ever sees
 * a frame in which the outgoing user's draft is displayed over the incoming
 * user's saved values. An effect would lag exactly one commit — and that commit
 * is a form showing one person's edits against another person's data.
 *
 * ## The patch is built from the gate, never from the draft
 *
 * {@link UseProfileEditReturn.confirmSave} rebuilds the request body from
 * {@link module:sidepanel/components/users/profileEditability}'s verdicts, not
 * from the draft record. A draft key whose attribute is locked is dropped on the
 * way out even if some earlier state let it in, so the deny-by-default gate is
 * enforced at the boundary that actually matters rather than only at the one
 * that renders controls.
 *
 * ## Three outcomes, and `'unknown'` is not `'failed'`
 *
 * `updateUserProfile` answers `'saved'`, `'failed'` or `'unknown'`, and this
 * hook passes all three through rather than collapsing them:
 *
 * - `'saved'` — lift the returned user, invalidate the user's memberships (a
 *   profile write can change rule-driven membership), clear the draft, leave
 *   edit mode, record history.
 * - `'unknown'` — the write **may have applied**. Leave edit mode and still
 *   record history, with `status: 'partial'`. Recording nothing about a write
 *   that may have landed is worse than recording an ambiguous outcome: the admin
 *   would have no trace of an edit that is now live.
 * - `'failed'` — Okta answered and said no. Record nothing, stay in edit mode
 *   with the draft intact so the admin can fix and retry.
 *
 * ## Security
 *
 * Attribute names and values are tenant data and frequently PII. Nothing here
 * logs a name, a value, a patch or a response body — user ids, counts and
 * outcomes only. The draft lives in React state and is never persisted; the
 * history entry is written by {@link module:shared/undoManager}, which applies
 * its own capture caps.
 */

import { useCallback, useMemo, useState } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { logProfileUpdateAction, type AttributeChange } from '../../shared/undoManager';
import { invalidate } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import type { AttributeDescriptor } from '../components/users/profileAttributes';
import {
  attributeEditability,
  type AttributeEditability,
} from '../components/users/profileEditability';
import {
  coerceDraftValue,
  draftDiff,
  validateDraft,
  type DraftChange,
} from '../components/users/profileDraft';
import { useOktaApi } from './useOktaApi';

const log = createLogger('useProfileEdit');

/** Shared empty results, so a non-editing render allocates nothing. */
const NO_CELLS: Readonly<Record<string, AttributeEditCell>> = Object.freeze({});
const NO_CHANGES: readonly DraftChange[] = Object.freeze([]);
const NO_ERRORS: Readonly<Record<string, string>> = Object.freeze({});
const NO_PATCH: Readonly<Record<string, unknown>> = Object.freeze({});

/** Everything one attribute's control needs to render itself and report a change. */
export interface AttributeEditCell {
  /** The attribute's bare Okta name — the key of the draft, the patch and this map. */
  readonly name: string;
  /** Whether it may be edited here, or why it may not. */
  readonly editability: AttributeEditability;
  /** In-flight value. Absent means no edit made; the cell shows the saved value. */
  readonly draft?: string;
  /** `true` when the draft differs from the value saved in Okta. */
  readonly dirty: boolean;
  /** Validation message; blocks save. */
  readonly invalid?: string;
  /** Absent when the attribute is locked. */
  readonly onChange?: (value: string) => void;
}

/**
 * What a confirmed save concluded — the three-state result of
 * {@link module:sidepanel/hooks/useOktaApi/profileOperations.UpdateProfileResult},
 * narrowed to what a surface needs to say.
 *
 * `'unknown'` carries no message because there is only one true thing to say
 * about it, and the surface owns that copy: the result could not be confirmed
 * and the user should be reloaded to check.
 */
export type ProfileSaveOutcome =
  | { readonly kind: 'saved'; readonly user: OktaUser }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'unknown' };

/** Options for {@link useProfileEdit}. */
export interface UseProfileEditOptions {
  /** The user being edited; every action no-ops when `null`. */
  readonly user: OktaUser | null;
  /**
   * The attribute inventory, exactly as the surface renders it.
   *
   * Taken rather than derived because both call sites already hold it
   * (`useUserDetailPanes` memoizes `allProfileAttributes(user, schema)`), and a
   * second derivation here could disagree with the list on screen — an editor
   * offering a control for an attribute the reader cannot see, or refusing one
   * they can.
   */
  readonly attributes: readonly AttributeDescriptor[];
  /** Tab whose scheduler runs the write. */
  readonly targetTabId: number | undefined;
  /** Lifts the user Okta returned, so every surface sees the new truth. */
  readonly onUserUpdated: (user: OktaUser) => void;
  /** Whether the surface is visible. `false` blocks entering edit mode and blocks the write (ADR-0018). */
  readonly enabled: boolean;
}

/** What {@link useProfileEdit} returns. */
export interface UseProfileEditReturn {
  /** Whether the surface is in edit mode. */
  readonly isEditing: boolean;
  /** Enters edit mode with a clean draft. No-op without a user, or when disabled. */
  readonly begin: () => void;
  /** Leaves edit mode, discarding every draft. */
  readonly cancel: () => void;
  /** name → cell. Empty when not editing, so callers may index unconditionally. */
  readonly cells: Readonly<Record<string, AttributeEditCell>>;
  /** Every attribute whose draft differs from what Okta has, in display order. */
  readonly changes: readonly DraftChange[];
  /** Whether anything would actually be written. */
  readonly hasChanges: boolean;
  /** Whether any drafted value fails client-side validation; blocks save. */
  readonly hasInvalid: boolean;
  /**
   * The changes awaiting confirmation, or `null`.
   *
   * A nullable discriminant rather than a boolean beside a list, for the reason
   * {@link module:sidepanel/hooks/useUserLifecycleActions} uses one: the thing
   * being confirmed and the fact that something is being confirmed cannot then
   * drift apart, and the modal renders the exact list the write will use.
   */
  readonly pendingSave: readonly DraftChange[] | null;
  /** Arms the confirmation. No-op with nothing to save, or with a validation error outstanding. */
  readonly requestSave: () => void;
  /** Dismisses the confirmation, leaving the draft and edit mode untouched. */
  readonly dismissSave: () => void;
  /** Performs the armed write. */
  readonly confirmSave: () => Promise<ProfileSaveOutcome>;
  /** `true` while a confirmed write is in flight. */
  readonly isSaving: boolean;
  /**
   * The patch this draft *would* send — name → coerced raw value — for the
   * blast-radius engine, which must answer "what would this change break?"
   * before the admin commits to anything. Built through the same gate as the
   * real patch, so the hypothetical and the actual can never disagree.
   */
  readonly draftPatch: Readonly<Record<string, unknown>>;
}

/** One attribute's verdict paired with the descriptor it was decided from. */
interface AttributeEntry {
  readonly attribute: AttributeDescriptor;
  readonly editability: AttributeEditability;
}

/**
 * Index the inventory by bare attribute name — the key the draft, the patch and
 * the editability map all share.
 *
 * A name can legitimately appear twice (a top-level `status` field beside a
 * custom `status` profile attribute), and the two descriptors can disagree about
 * whether the name is editable. **The locked verdict wins**, matching the gate's
 * own deny-by-default posture: a wrong lock costs an admin a trip to the Okta
 * console, a wrong unlock costs a write to the wrong attribute.
 */
function indexAttributes(
  attributes: readonly AttributeDescriptor[],
  user: OktaUser,
): ReadonlyMap<string, AttributeEntry> {
  const entries = new Map<string, AttributeEntry>();

  for (const attribute of attributes) {
    const editability = attributeEditability(attribute, user);
    const existing = entries.get(attribute.name);
    if (existing === undefined || (existing.editability.editable && !editability.editable)) {
      entries.set(attribute.name, { attribute, editability });
    }
  }

  return entries;
}

/** The result of turning a set of changes back into an Okta profile patch. */
interface PatchBuild {
  /** Attribute name → the value to write. Only editable, coercible changes appear. */
  readonly patch: Record<string, unknown>;
  /** Names whose drafted text could not be coerced — a validation error, not a silent skip. */
  readonly uncoercible: readonly string[];
}

/**
 * Rebuild the profile patch from the editability gate's verdicts.
 *
 * @param changes - The diffed changes to write.
 * @param draft - The in-flight draft strings.
 * @param entries - The indexed inventory, carrying each attribute's verdict.
 * @returns The sparse patch plus any names that failed coercion.
 * @remarks A locked attribute is **dropped**, whatever the draft holds for it.
 * The controls already refuse to produce one, so this is defence in depth
 * against a future caller seeding a draft directly.
 *
 * A cleared `number` or `checkbox` coerces to `undefined`, which `JSON`
 * serialization would silently omit — leaving the attribute at its old value
 * rather than clearing it. It is sent as `null`, which is what Okta reads as
 * "unset this".
 */
function buildPatch(
  changes: readonly DraftChange[],
  draft: Readonly<Record<string, string>>,
  entries: ReadonlyMap<string, AttributeEntry>,
): PatchBuild {
  const patch: Record<string, unknown> = {};
  const uncoercible: string[] = [];

  for (const change of changes) {
    const entry = entries.get(change.name);
    if (entry === undefined || !entry.editability.editable) continue;

    const raw = draft[change.name];
    if (raw === undefined) continue;

    const coerced = coerceDraftValue(raw, entry.editability.control);
    if (!coerced.ok) {
      uncoercible.push(change.name);
      continue;
    }

    patch[change.name] = coerced.value === undefined ? null : coerced.value;
  }

  return { patch, uncoercible };
}

/** `Jane Doe`, falling back to the login when the name fields are empty. */
function displayName(user: OktaUser): string {
  const composed = `${user.profile.firstName ?? ''} ${user.profile.lastName ?? ''}`.trim();
  return composed === '' ? user.profile.login : composed;
}

/**
 * Editing state for one user's profile, on one surface.
 *
 * @param options - See {@link UseProfileEditOptions}.
 * @returns The edit-mode flag, one {@link AttributeEditCell} per attribute while
 * editing, the diff, the confirmation state, and the write.
 *
 * @example
 * ```tsx
 * const edit = useProfileEdit({ user, attributes, targetTabId, onUserUpdated, enabled });
 * const cell = edit.cells[attribute.name];
 * // …render `cell?.onChange` as the control's handler…
 * if (edit.pendingSave) return <SaveModal changes={edit.pendingSave} onConfirm={edit.confirmSave} />;
 * ```
 */
export function useProfileEdit({
  user,
  attributes,
  targetTabId,
  onUserUpdated,
  enabled,
}: UseProfileEditOptions): UseProfileEditReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Readonly<Record<string, string>>>({});
  const [pendingSave, setPendingSave] = useState<readonly DraftChange[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { updateUserProfile } = useOktaApi({ targetTabId: targetTabId ?? null });

  // Identity of the profile the current draft was typed against. `lastUpdated`
  // is part of it because a save on the *other* surface changes the same user
  // underneath this one, and a draft typed against the old values must not
  // survive to be written over the new ones. See the module header for why this
  // is a render-time adjustment rather than an effect.
  const identity = user === null ? null : `${user.id}|${user.lastUpdated ?? ''}`;
  const [draftIdentity, setDraftIdentity] = useState<string | null>(identity);
  if (draftIdentity !== identity) {
    setDraftIdentity(identity);
    setIsEditing(false);
    setDraft({});
    setPendingSave(null);
  }

  const entries = useMemo(
    () => (user === null ? new Map<string, AttributeEntry>() : indexAttributes(attributes, user)),
    [attributes, user],
  );

  // Nothing below is computed unless the surface is actually editing: a rung
  // sitting in read mode — including a hidden one — does no work at all.
  const changes = useMemo(() => {
    if (!isEditing) return NO_CHANGES;
    // A name can appear twice in the inventory (see `indexAttributes`); the
    // patch would dedupe it by key, but the confirmation list and the history
    // entry would show it twice.
    const seen = new Set<string>();
    return draftDiff(attributes, draft).filter((change) => {
      if (seen.has(change.name)) return false;
      seen.add(change.name);
      return true;
    });
  }, [isEditing, attributes, draft]);

  const errors = useMemo(() => {
    if (!isEditing) return NO_ERRORS;
    const editability = new Map<string, AttributeEditability>();
    for (const [name, entry] of entries) editability.set(name, entry.editability);
    return validateDraft(attributes, editability, draft);
  }, [isEditing, attributes, entries, draft]);

  const draftPatch = useMemo(
    () => (isEditing ? buildPatch(changes, draft, entries).patch : NO_PATCH),
    [isEditing, changes, draft, entries],
  );

  const setValue = useCallback((name: string, value: string) => {
    setDraft((current) => ({ ...current, [name]: value }));
  }, []);

  const cells = useMemo(() => {
    if (!isEditing) return NO_CELLS;

    const changed = new Set(changes.map((change) => change.name));
    const built: Record<string, AttributeEditCell> = {};

    for (const [name, entry] of entries) {
      const drafted = draft[name];
      const invalid = errors[name];
      built[name] = {
        name,
        editability: entry.editability,
        ...(drafted === undefined ? {} : { draft: drafted }),
        dirty: changed.has(name),
        ...(invalid === undefined ? {} : { invalid }),
        ...(entry.editability.editable
          ? { onChange: (value: string) => setValue(name, value) }
          : {}),
      };
    }

    return built;
  }, [isEditing, entries, draft, changes, errors, setValue]);

  const hasChanges = changes.length > 0;
  const hasInvalid = Object.keys(errors).length > 0;

  const begin = useCallback(() => {
    if (!enabled || user === null) return;
    setDraft({});
    setPendingSave(null);
    setIsEditing(true);
  }, [enabled, user]);

  const cancel = useCallback(() => {
    setDraft({});
    setPendingSave(null);
    setIsEditing(false);
  }, []);

  const requestSave = useCallback(() => {
    if (!hasChanges || hasInvalid) return;
    setPendingSave(changes);
  }, [hasChanges, hasInvalid, changes]);

  const dismissSave = useCallback(() => {
    setPendingSave(null);
  }, []);

  const confirmSave = useCallback(async (): Promise<ProfileSaveOutcome> => {
    // ADR-0018: a hidden surface spends no scheduler budget and, more to the
    // point, does not write to someone's profile out of view.
    if (!enabled) return { kind: 'failed', error: 'This view is not active.' };
    if (user === null || pendingSave === null) {
      return { kind: 'failed', error: 'There is nothing to save.' };
    }

    // Captured before clearing, per `useUserLifecycleActions`: the write must
    // use the list the admin confirmed, not whatever the draft becomes next.
    const confirmed = pendingSave;
    const { patch, uncoercible } = buildPatch(confirmed, draft, entries);

    if (uncoercible.length > 0) {
      // A value that will not coerce is a validation failure, never a key
      // quietly dropped from a patch the admin believes they approved.
      return { kind: 'failed', error: 'Some values are not valid. Fix them and try again.' };
    }
    if (Object.keys(patch).length === 0) {
      return { kind: 'failed', error: 'None of these attributes can be edited here.' };
    }

    const userId = user.id;
    const attributeCount = Object.keys(patch).length;

    setPendingSave(null);
    setIsSaving(true);

    try {
      // A throw escaping `updateUserProfile` is pre-flight only (an empty or
      // security-sensitive patch); it never reached Okta, so it is a plain
      // failure rather than the ambiguous `'unknown'`.
      const result = await updateUserProfile(userId, patch).catch((error: unknown) => ({
        kind: 'failed' as const,
        error: error instanceof Error ? error.message : 'The update could not be sent.',
      }));

      if (result.kind === 'failed') {
        // Okta answered and rejected it: stay in edit mode with the draft
        // intact so the admin can correct and retry, and record nothing —
        // nothing happened.
        log.warn('Profile update rejected', { userId, attributeCount });
        return { kind: 'failed', error: result.error };
      }

      const changesForHistory = confirmed
        .filter((change) => Object.prototype.hasOwnProperty.call(patch, change.name))
        .map((change): AttributeChange => ({
          name: change.name,
          label: change.label,
          beforeDisplay: change.beforeDisplay,
          beforeRaw: entries.get(change.name)?.attribute.raw,
          afterDisplay: change.afterDisplay,
        }));

      if (result.kind === 'unknown') {
        // The write MAY have applied. Leave edit mode — re-offering the same
        // draft would invite a second write of a change that already landed —
        // and record the attempt as `partial` so there is a trace of it.
        log.warn('Profile update outcome unknown', { userId, attributeCount });
        setDraft({});
        setIsEditing(false);
        await recordHistory(userId, user, changesForHistory, 'partial');
        return { kind: 'unknown' };
      }

      onUserUpdated(result.user);
      // A profile write can change rule-driven membership, so the user's
      // memberships are no longer known to be current.
      invalidate(cacheKeys.userMemberships(userId));
      setDraft({});
      setIsEditing(false);
      log.info('Profile updated', { userId, attributeCount });
      await recordHistory(userId, user, changesForHistory, 'completed');
      return { kind: 'saved', user: result.user };
    } finally {
      setIsSaving(false);
    }
  }, [enabled, user, pendingSave, draft, entries, updateUserProfile, onUserUpdated]);

  return {
    isEditing,
    begin,
    cancel,
    cells,
    changes,
    hasChanges,
    hasInvalid,
    pendingSave,
    requestSave,
    dismissSave,
    confirmSave,
    isSaving,
    draftPatch,
  };
}

/**
 * Write the history entry for a completed or ambiguous profile write.
 *
 * @remarks A history failure must never turn a successful save into a failed
 * one, so it is caught here and reported as an outcome — with the user id and a
 * count, never an attribute name or value.
 */
async function recordHistory(
  userId: string,
  user: OktaUser,
  changes: AttributeChange[],
  status: 'completed' | 'partial',
): Promise<void> {
  try {
    await logProfileUpdateAction(userId, user.profile.login, displayName(user), changes, {
      status,
    });
  } catch {
    log.warn('Could not record the profile update in history', {
      userId,
      attributeCount: changes.length,
    });
  }
}
