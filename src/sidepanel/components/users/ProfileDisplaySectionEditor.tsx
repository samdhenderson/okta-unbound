/**
 * @module sidepanel/components/users/ProfileDisplaySectionEditor
 * @description One section of the profile while it is being customized: its
 * grip, its name, how many attributes it holds, its delete control, and the rows
 * filed under it.
 *
 * **The name is a button until it is clicked.** A section list rendered as a
 * column of text fields reads as a form to be filled in; a name that becomes a
 * field only when you aim at it reads as a label you can correct. Enter and blur
 * both commit, Escape reverts — a rename is undoable by the editor's Cancel in
 * any case, so committing on blur cannot lose work.
 *
 * **Deleting confirms inline, and states the consequence.** The count in the
 * confirmation ("Its 4 attributes return to Uncategorized") is the whole point:
 * an admin should not have to guess whether a delete takes attributes off the
 * profile with it. It does not.
 *
 * Uncategorized has no grip and no delete, and the editor pins it last: it is the
 * block that guarantees no attribute can drop out of sight, so it can neither be
 * moved nor removed.
 *
 * Security: category names are admin-authored tenant data. Nothing here logs.
 */
import React, { useState } from 'react';
import { Badge, Button, Eyebrow, IconButton, Input } from '../shared';
import Icon from '../shared/Icon';
import ProfileDisplayGrip from './ProfileDisplayGrip';
import type { AttributeStep } from './profileDisplayOps';

/** Props for {@link ProfileDisplaySectionEditor}. */
export interface ProfileDisplaySectionEditorProps {
  /** The section's stable key; `''` is Uncategorized. */
  sectionKey: string;
  /** The section's current name in the draft. */
  name: string;
  /** How many of the profile's attributes are filed under it. */
  fieldCount: number;
  /**
   * `true` for Uncategorized: renders with no grip and no delete, because it can
   * neither be moved nor removed.
   */
  isFixed?: boolean;
  /** `true` while this section is the one lifted. */
  isLifted?: boolean;
  /** Turns the grip off while the pane's filter is narrowing the list. */
  isReorderDisabled?: boolean;
  /** `id` of the element describing the grip's keyboard contract. */
  gripDescribedBy?: string;
  /** Commit a new name for this section. */
  onRename?: (name: string) => void;
  /** Delete this section, returning its attributes to Uncategorized. */
  onDelete?: () => void;
  /** Start a pointer drag from the grip. */
  onGripPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** Lift this section with the keyboard. */
  onLift?: () => void;
  /** Move the lifted section one step. */
  onStep?: (direction: AttributeStep) => void;
  /** Drop the lifted section. */
  onDrop?: () => void;
  /** Abandon the lift. */
  onCancelLift?: () => void;
  /** The section's attribute rows, and any drop indicator between them. */
  children: React.ReactNode;
}

/** `1 field` / `4 fields`. */
function fieldCountLabel(count: number): string {
  return count === 1 ? '1 field' : `${count} fields`;
}

/** `its 1 attribute` / `its 4 attributes`, for the delete confirmation. */
function consequence(count: number): string {
  if (count === 0) return 'It holds no attributes.';
  return `Its ${count} ${count === 1 ? 'attribute returns' : 'attributes return'} to Uncategorized.`;
}

/**
 * One editable section and the rows inside it.
 *
 * @example
 * ```tsx
 * <ProfileDisplaySectionEditor
 *   sectionKey={section.key}
 *   name={section.name}
 *   fieldCount={names.length}
 *   onRename={(next) => editor.rename(section.key, next)}
 *   onDelete={() => editor.remove(section.key)}
 * >
 *   {rows}
 * </ProfileDisplaySectionEditor>
 * ```
 */
const ProfileDisplaySectionEditor: React.FC<ProfileDisplaySectionEditorProps> = ({
  sectionKey,
  name,
  fieldCount,
  isFixed = false,
  isLifted = false,
  isReorderDisabled = false,
  gripDescribedBy,
  onRename,
  onDelete,
  onGripPointerDown,
  onLift,
  onStep,
  onDrop,
  onCancelLift,
  children,
}) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const commitName = (): void => {
    const next = editing?.trim() ?? '';
    setEditing(null);
    if (next !== '' && next !== name) onRename?.(next);
  };

  return (
    <section
      data-section={sectionKey}
      aria-label={name}
      className={`border-t border-neutral-200 px-(--sp-card) py-(--sp-field) first:border-t-0 ${
        isLifted ? 'bg-primary-light' : ''
      }`}
    >
      <div className="mb-1 flex min-w-0 items-center gap-(--sp-inline)">
        {isFixed ? null : (
          <ProfileDisplayGrip
            label={name}
            lifted={isLifted}
            disabled={isReorderDisabled}
            describedBy={gripDescribedBy}
            onPointerDown={onGripPointerDown ?? (() => undefined)}
            onLift={onLift ?? (() => undefined)}
            onStep={onStep ?? (() => undefined)}
            onDrop={onDrop ?? (() => undefined)}
            onCancel={onCancelLift ?? (() => undefined)}
          />
        )}

        {isFixed ? (
          <Eyebrow as="h3" className="min-w-0 flex-1 truncate">
            {name}
          </Eyebrow>
        ) : editing === null ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setEditing(name)}
            ariaLabel={`Rename ${name}`}
            className="min-w-0 flex-1 justify-start truncate font-semibold tracking-wide text-neutral-500 uppercase"
          >
            {name}
          </Button>
        ) : (
          <div className="min-w-0 flex-1">
            <Input
              size="sm"
              autoFocus
              value={editing}
              onChange={setEditing}
              ariaLabel={`Rename ${name}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitName();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditing(null);
                }
              }}
              onBlur={commitName}
            />
          </div>
        )}

        <Badge variant="neutral">{fieldCountLabel(fieldCount)}</Badge>

        {isFixed ? null : (
          <IconButton
            size="sm"
            variant="danger"
            label={`Delete ${name}`}
            active={isConfirmingDelete}
            onClick={() => setIsConfirmingDelete((open) => !open)}
          >
            <Icon type="close" size="xs" />
          </IconButton>
        )}
      </div>

      {isConfirmingDelete && (
        <div className="mb-1 flex flex-wrap items-center gap-(--sp-inline) rounded-md bg-neutral-50 px-(--sp-row-x) py-(--sp-row-y)">
          <p className="min-w-0 flex-1 text-xs text-neutral-700">
            Delete {name}? {consequence(fieldCount)}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setIsConfirmingDelete(false)}>
            Keep
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setIsConfirmingDelete(false);
              onDelete?.();
            }}
          >
            Delete
          </Button>
        </div>
      )}

      <div>{children}</div>
    </section>
  );
};

export default ProfileDisplaySectionEditor;
