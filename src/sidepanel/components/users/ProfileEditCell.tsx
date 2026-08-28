/**
 * @module sidepanel/components/users/ProfileEditCell
 * @description One profile attribute's **value cell**, in whichever of its three
 * states applies: read-only, an editable control, or locked with the reason said
 * out loud.
 *
 * The cell renders the value only — never the label. Its two surfaces disagree
 * about what a label is (the Profile pane pairs a `<dt>` with a `<dd>`; the
 * Compare view puts one label across two user columns), so the label stays with
 * the surface and the control takes its accessible name from
 * {@link AttributeDescriptor.label} via `ariaLabel`. Sharing this cell is what
 * keeps both surfaces inside their line budgets while guaranteeing that an
 * attribute locked in one is locked identically in the other.
 *
 * ## The three states
 *
 * | `editing` | `editability` | Renders                              |
 * | --------- | ------------- | ------------------------------------ |
 * | `false`   | either        | the saved value, read-only           |
 * | `true`    | editable      | the control for its type             |
 * | `true`    | locked        | the value, dimmed, plus the reason   |
 *
 * A locked attribute explains itself **only in edit mode**. Outside it there is
 * nothing to explain — every attribute is read-only then, and a lock beside all
 * of them would say nothing.
 *
 * **`editing` is a prop, not an inference from `onChange`.** It used to be the
 * latter, and that quietly cost the third state: a producer that omits
 * `onChange` for a locked attribute — a reasonable thing to do, since the value
 * cannot be changed — made the lock and its reason unreachable, so an admin in
 * edit mode saw untouchable fields with no explanation of why. Two consumers
 * then diverged, one passing a no-op handler to get the reason back. The mode is
 * the surface's fact to state, so the surface states it.
 *
 * ## No truncation, ever
 *
 * Same contract as {@link module:sidepanel/components/users/UserProfileAttributeList}:
 * values wrap (`break-words` plus `text-pretty`) and the cell takes whatever
 * height it needs. A long login and a street address are exactly the values an
 * admin opened the profile to read, and they were the two the clipped layout
 * could not show. A `truncate` here would be a regression, not a tidy-up.
 *
 * ## Security
 *
 * The attribute's name, label, value and the mastering `source` in a lock reason
 * are all end-user-controllable tenant data, frequently PII. They render through
 * React's escaping only — no `dangerouslySetInnerHTML`, no hand-built HTML — and
 * nothing in this module logs.
 */
import React from 'react';
import { Checkbox, Input, Select } from '../shared';
import Icon from '../shared/Icon';
import type { AttributeDescriptor } from './profileAttributes';
import type { AttributeEditability, EditOption } from './profileEditability';

/** Props for {@link ProfileEditCell}. */
export interface ProfileEditCellProps {
  /** The attribute whose value this cell renders. */
  attribute: AttributeDescriptor;
  /** The verdict from `attributeEditability` — how to edit it, or why it is locked. */
  editability: AttributeEditability;
  /** The in-flight value. Absent means the reader has not edited this attribute. */
  draft?: string;
  /**
   * Whether the surface is in edit mode.
   *
   * Defaults to `onChange !== undefined`, which is the right answer for an
   * editable attribute and the wrong one for a locked attribute whose producer
   * declined to hand out a handler it would never call. Pass it explicitly.
   */
  editing?: boolean;
  /**
   * Called with the control's new string value. Absent for a locked attribute —
   * there is nothing to call it with.
   */
  onChange?: (value: string) => void;
  /** Validation message for this attribute, from `validateDraft`. */
  invalid?: string;
  /** Render the value in a monospace font (ids and similar). */
  mono?: boolean;
}

/** The value type recipe. `break-words`/`text-pretty` are the no-truncation contract. */
const VALUE_TYPE = 'min-w-0 break-words text-pretty text-sm font-medium text-neutral-900';

/** The em dash an unset attribute renders, matching `UserProfileAttributeList`. */
const EmptyValue: React.FC = () => (
  <span className="text-sm text-neutral-400" title="No value">
    —
  </span>
);

/**
 * The choices a `select` offers, widened so the control can always show what it
 * is currently holding.
 *
 * A schema's enum does not always contain the value already on the user — an
 * attribute that was populated before a choice was retired, or an unset optional
 * one. A native `<select>` given a value it has no option for silently displays
 * the first option instead, which would misreport the saved value as a different
 * one and then write that misreading back on save.
 */
function optionsWithCurrent(options: readonly EditOption[], value: string): EditOption[] {
  if (options.some((option) => option.value === value)) return [...options];
  return value === ''
    ? [{ value: '', label: '—' }, ...options]
    : [...options, { value, label: value }];
}

/**
 * One attribute's value cell — read-only, editable, or locked with its reason.
 *
 * @example
 * ```tsx
 * <ProfileEditCell
 *   attribute={attribute}
 *   editability={editability.get(attribute.name)!}
 *   draft={draft[attribute.name]}
 *   onChange={isEditing ? (value) => setDraft(attribute.name, value) : undefined}
 *   invalid={errors[attribute.name]}
 * />
 * ```
 */
const ProfileEditCell: React.FC<ProfileEditCellProps> = ({
  attribute,
  editability,
  draft,
  editing,
  onChange,
  invalid,
  mono = false,
}) => {
  const value = draft ?? attribute.value;

  const isEditing = editing ?? onChange !== undefined;

  const savedValue =
    attribute.value === '' ? (
      <EmptyValue />
    ) : (
      <span className={`${VALUE_TYPE} ${mono ? 'font-mono' : ''}`}>{attribute.value}</span>
    );

  if (!isEditing) return savedValue;

  if (!editability.editable) {
    return (
      <div className="min-w-0 space-y-1">
        <div className="flex items-start gap-1.5 text-neutral-500">
          <Icon type="lock" size="xs" className="mt-1 shrink-0" />
          <span className="sr-only">Locked:</span>
          {attribute.value === '' ? (
            <EmptyValue />
          ) : (
            <span className={`min-w-0 break-words text-pretty text-sm ${mono ? 'font-mono' : ''}`}>
              {attribute.value}
            </span>
          )}
        </div>
        <p className="text-pretty text-xs text-neutral-600">{editability.explanation}</p>
      </div>
    );
  }

  // Editable but handed no handler: render the value rather than a control whose
  // keystrokes go nowhere. Also what narrows `onChange` for the controls below.
  if (onChange === undefined) return savedValue;

  if (editability.control === 'checkbox') {
    return (
      <div className="min-w-0">
        <Checkbox
          checked={value === 'true'}
          onChange={(checked) => onChange(String(checked))}
          aria-label={attribute.label}
        />
        {invalid && <p className="mt-1 text-xs text-danger-text">{invalid}</p>}
      </div>
    );
  }

  if (editability.control === 'select') {
    return (
      <Select
        value={value}
        onChange={onChange}
        options={optionsWithCurrent(editability.options ?? [], value)}
        ariaLabel={attribute.label}
        error={invalid}
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={onChange}
      type={editability.control === 'number' ? 'number' : 'text'}
      size="sm"
      ariaLabel={attribute.label}
      error={invalid}
    />
  );
};

export default ProfileEditCell;
