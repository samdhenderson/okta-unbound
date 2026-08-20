/**
 * @module sidepanel/components/users/profileDraft
 * @description Turns the strings a form control produces back into the types the
 * org's schema declares, works out which attributes actually changed, and
 * validates the ones that did.
 *
 * No React and no I/O. Both editing surfaces hold their draft as a flat
 * `Record<attributeName, string>` — because every control this panel renders
 * (text, select, number, checkbox) produces a string — and this module is the
 * boundary where those strings become an Okta profile patch again.
 *
 * ## One stringifier, or the dirty check lies
 *
 * Whether a draft differs from the saved value is decided by comparing
 * {@link toDisplay} of the coerced draft with {@link toDisplay} of the saved
 * value. Using the raw values instead would make `5` and `'5'` a change, and
 * typing a character into a number field and deleting it again would arm Save
 * with nothing to save. This is the same reason `toDisplay` is exported from
 * `profileAttributes` rather than inlined at each reader.
 *
 * ## Empty means "clear it"
 *
 * An emptied `number` or `checkbox` field coerces to `undefined`, not to `0` or
 * `false`. Okta accepts `null` for an attribute being cleared, and an admin who
 * selects the contents of a number field and deletes them means "there is no
 * value here" — not "the value is zero". A `required` attribute emptied this way
 * is caught by {@link validateDraft} instead, which is where the reader can be
 * told about it.
 *
 * Security: draft values are org data and frequently PII. Nothing here logs, and
 * nothing here is persisted.
 */
import { toDisplay } from './profileAttributes';
import type { AttributeDescriptor } from './profileAttributes';
import { editControlFor } from './profileEditability';
import type { AttributeEditability, EditControl } from './profileEditability';

/** One attribute whose draft differs from the value currently saved in Okta. */
export interface DraftChange {
  /** The attribute's Okta name — the key of both the draft and the profile patch. */
  readonly name: string;
  /** Its human label, for a confirmation list that must not read as JSON. */
  readonly label: string;
  /** The saved value, stringified. `''` when the attribute was unset. */
  readonly beforeDisplay: string;
  /** The drafted value, stringified the same way. `''` when it is being cleared. */
  readonly afterDisplay: string;
  /** The drafted value in the schema's own type — what is sent to Okta. */
  readonly afterRaw: unknown;
  /**
   * `true` only for `login`. The one change in a profile patch that alters how
   * the user signs in, so a confirmation step can call it out separately rather
   * than listing it among the department changes.
   */
  readonly changesSignIn: boolean;
}

/** The successful/failed result of coercing one control's string. */
export type CoercionResult = { ok: true; value: unknown } | { ok: false; error: string };

/** The attribute whose change alters how the user signs in. */
const LOGIN_ATTRIBUTE = 'login';

/**
 * A complete decimal or exponent-notation number and nothing else.
 *
 * `Number()` alone is too permissive for a field an admin types into: it accepts
 * `'0x10'`, `'Infinity'` and `' '`, and turns each into a value the admin did not
 * write. Matching the literal first and converting second means only text that
 * reads as a number becomes one.
 */
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Turn one control's string back into the type the schema declares.
 *
 * @param raw - Exactly what the control produced, untrimmed.
 * @param control - The control it came from, from `attributeEditability`.
 * @returns The coerced value, or a message naming what is wrong with the text.
 *   An empty `number` or `checkbox` yields `undefined` — the attribute is being
 *   cleared. `text` and `select` pass their string through unchanged, including
 *   `''`, because an empty string is a legitimate value for a string attribute.
 *
 * @example
 * ```ts
 * coerceDraftValue('42', 'number');    // { ok: true, value: 42 }
 * coerceDraftValue('12abc', 'number'); // { ok: false, error: 'Enter a number.' }
 * coerceDraftValue('', 'number');      // { ok: true, value: undefined } — cleared
 * ```
 */
export function coerceDraftValue(raw: string, control: EditControl): CoercionResult {
  switch (control) {
    case 'number': {
      const trimmed = raw.trim();
      if (trimmed === '') return { ok: true, value: undefined };
      if (!NUMERIC.test(trimmed)) return { ok: false, error: 'Enter a number.' };
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return { ok: false, error: 'Enter a number.' };
      return { ok: true, value: parsed };
    }
    case 'checkbox': {
      const trimmed = raw.trim();
      if (trimmed === '') return { ok: true, value: undefined };
      if (trimmed === 'true') return { ok: true, value: true };
      if (trimmed === 'false') return { ok: true, value: false };
      return { ok: false, error: 'Choose either true or false.' };
    }
    case 'text':
    case 'select':
      return { ok: true, value: raw };
  }
}

/** The control an attribute's draft string came from; free text when unknown. */
function controlFor(attribute: AttributeDescriptor): EditControl {
  return editControlFor(attribute.property) ?? 'text';
}

/**
 * Every attribute whose draft differs from the value saved in Okta.
 *
 * An attribute with no draft entry is untouched and never appears. An attribute
 * whose draft coerces back to the saved value does not appear either — that is
 * what stops "type a character, delete it" from arming Save.
 *
 * A draft that cannot be coerced (`'12abc'` in a number field) *is* reported as a
 * change, carrying the raw string. It has to be: the reader edited the field, so
 * the surface must not quietly decide nothing happened. {@link validateDraft} is
 * what stops it being saved.
 *
 * @param attributes - The attribute inventory, in display order; the result
 *   follows that order.
 * @param draft - In-flight values keyed by Okta attribute name.
 * @returns One entry per genuinely changed attribute; empty when nothing changed.
 */
export function draftDiff(
  attributes: readonly AttributeDescriptor[],
  draft: Readonly<Record<string, string>>,
): DraftChange[] {
  const changes: DraftChange[] = [];

  for (const attribute of attributes) {
    const drafted = draft[attribute.name];
    if (drafted === undefined) continue;

    const beforeDisplay = toDisplay(attribute.raw);
    const coerced = coerceDraftValue(drafted, controlFor(attribute));
    const afterRaw = coerced.ok ? coerced.value : drafted;
    const afterDisplay = coerced.ok ? toDisplay(coerced.value) : drafted;
    if (afterDisplay === beforeDisplay) continue;

    changes.push({
      name: attribute.name,
      label: attribute.label,
      beforeDisplay,
      afterDisplay,
      afterRaw,
      changesSignIn: attribute.name === LOGIN_ATTRIBUTE,
    });
  }

  return changes;
}

/**
 * Client-side validation of the in-flight draft.
 *
 * Deliberately shallow: it catches only what can be decided here without asking
 * Okta — text that is not a number, and a required attribute left empty. Pattern,
 * length and uniqueness constraints are Okta's to enforce, and guessing at them
 * would block edits Okta would have accepted.
 *
 * A draft for an attribute this panel has locked is ignored rather than reported.
 * The cell renders no control for a locked attribute, so such an entry cannot
 * come from the reader, and an error message beside a field that is not there
 * would be unactionable.
 *
 * @param attributes - The attribute inventory.
 * @param editability - Verdicts from `attributeEditability`, keyed by Okta
 *   attribute name — the same key the draft uses.
 * @param draft - In-flight values keyed by Okta attribute name.
 * @returns Attribute name → message. Empty when the draft is ready to save.
 */
export function validateDraft(
  attributes: readonly AttributeDescriptor[],
  editability: ReadonlyMap<string, AttributeEditability>,
  draft: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  for (const attribute of attributes) {
    const drafted = draft[attribute.name];
    if (drafted === undefined) continue;

    const verdict = editability.get(attribute.name);
    if (verdict === undefined || !verdict.editable) continue;

    const coerced = coerceDraftValue(drafted, verdict.control);
    if (!coerced.ok) {
      errors[attribute.name] = coerced.error;
      continue;
    }

    if (verdict.required && (coerced.value === undefined || coerced.value === '')) {
      errors[attribute.name] = 'A value is required.';
    }
  }

  return errors;
}
