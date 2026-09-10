/**
 * @module sidepanel/components/users/ProfileDisplayEditor
 * @description Customize mode's body and its footer bar: the display options,
 * every section with every attribute under it, the add-section form, and the
 * Reset / Cancel / Done controls.
 *
 * This replaces the two-tab configuration modal. The modal wrote live — a click
 * landed in IndexedDB — and asked an admin to arrange a profile they could not
 * see while they arranged it. Here the rows being reordered *are* the profile's
 * rows, and nothing is written until Done.
 *
 * The editor renders its own footer bar rather than leaving it to the pane
 * header, because the three verbs there act on the draft this component owns:
 * a header that could commit a draft it does not hold would need the draft
 * lifted into it, and the pane would gain a mode's worth of state it has no
 * other use for.
 *
 * **Every attribute is on screen, including the hidden ones**, struck through
 * with the eye closed. An attribute whose row disappeared when you hid it is an
 * attribute you cannot restore where it lives.
 *
 * **A live filter disables the grips.** The filter stays usable as a *find*, but
 * a drop into a partly-rendered list would compute a position against rows that
 * are not all there, so the handles turn off and the reason is stated on screen
 * rather than left to be discovered.
 *
 * Security: attribute labels, Okta names, values and category names are
 * untrusted tenant data and frequently PII. They are rendered through React's
 * escaping only, and nothing here logs.
 */
import React, { useMemo, useState } from 'react';
import { Button, Input } from '../shared';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import { UNCATEGORIZED } from './profileAttributeBlocks';
import ProfileDisplayAttributeEditRow from './ProfileDisplayAttributeEditRow';
import ProfileDisplayDragGhost from './ProfileDisplayDragGhost';
import ProfileDisplayOptions from './ProfileDisplayOptions';
import ProfileDisplaySectionEditor from './ProfileDisplaySectionEditor';
import { useProfileDisplayEditor } from '../../hooks/useProfileDisplayEditor';

/** Props for {@link ProfileDisplayEditor}. */
export interface ProfileDisplayEditorProps {
  /** Every attribute on this profile, empty ones included. */
  attributes: readonly AttributeDescriptor[];
  /** The reconciled configuration the draft starts from. */
  config: ProfileDisplayConfig;
  /** Done — receives the whole edited configuration. */
  onCommit: (config: ProfileDisplayConfig) => void;
  /** Cancel — the draft is discarded and nothing is written. */
  onCancel: () => void;
  /** Attribute Okta name → the rules that read it. Absent means rules are unknown. */
  ruleReads?: Record<string, string[]>;
  /** The pane's live free-text filter. A non-empty filter disables reordering. */
  filter?: string;
}

/** `id` of the paragraph every grip points at with `aria-describedby`. */
const HELP_ID = 'profile-display-reorder-help';

/** Case-insensitive match across an attribute's label, Okta name and value. */
function matches(attribute: AttributeDescriptor, needle: string): boolean {
  return (
    attribute.label.toLowerCase().includes(needle) ||
    attribute.name.toLowerCase().includes(needle) ||
    attribute.value.toLowerCase().includes(needle)
  );
}

/** What a section says when the filter has taken every one of its rows away. */
function filteredOutLabel(count: number): string {
  return count === 1
    ? '1 field, hidden by the filter'
    : `${count} fields, all hidden by the filter`;
}

/** The line that shows where a lifted item would land. */
const DropIndicator: React.FC = () => (
  <div aria-hidden="true" className="my-0.5 h-0.5 rounded-full bg-primary" />
);

/**
 * The Profile pane in customize mode.
 *
 * @example
 * ```tsx
 * <ProfileDisplayEditor
 *   attributes={attributes}
 *   config={config}
 *   onCommit={update}
 *   onCancel={() => setCustomizing(false)}
 *   ruleReads={ruleReads}
 *   filter={filter}
 * />
 * ```
 */
const ProfileDisplayEditor: React.FC<ProfileDisplayEditorProps> = ({
  attributes,
  config,
  onCommit,
  onCancel,
  ruleReads,
  filter = '',
}) => {
  const editor = useProfileDisplayEditor({ attributes, config, onCommit, onCancel });
  const [newSectionName, setNewSectionName] = useState('');

  const needle = filter.trim().toLowerCase();
  const isFiltering = needle !== '';

  const byName = useMemo(() => {
    const map = new Map<string, AttributeDescriptor>();
    for (const attribute of attributes) {
      if (!map.has(attribute.name)) map.set(attribute.name, attribute);
    }
    return map;
  }, [attributes]);

  /**
   * Section key → its attribute names, in draft order. Built here rather than
   * read straight off `attrOrder` so an attribute the org has grown since the
   * config was written still gets a row instead of vanishing from the editor.
   */
  const namesBySection = useMemo(() => {
    const keys = new Set(editor.draft.categories.map((category) => category.key));
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const name of editor.draft.attrOrder) {
      if (byName.has(name) && !seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
    for (const name of byName.keys()) {
      if (!seen.has(name)) ordered.push(name);
    }

    const buckets = new Map<string, string[]>();
    for (const section of editor.sections) buckets.set(section.key, []);
    for (const name of ordered) {
      const assigned = editor.draft.assign[name] ?? UNCATEGORIZED;
      const key = keys.has(assigned) ? assigned : UNCATEGORIZED;
      buckets.get(key)?.push(name);
    }
    return buckets;
  }, [
    byName,
    editor.draft.assign,
    editor.draft.attrOrder,
    editor.draft.categories,
    editor.sections,
  ]);

  const liftedAttribute = editor.drag?.kind === 'attr' ? editor.drag.id : null;
  const liftedSection = editor.drag?.kind === 'section' ? editor.drag.id : null;
  const attributeTarget = editor.dropTarget?.kind === 'attr' ? editor.dropTarget : null;
  const sectionTarget = editor.dropTarget?.kind === 'section' ? editor.dropTarget : null;

  /** One section's rows, with the drop indicator spliced in at the target slot. */
  const rowsFor = (sectionKey: string): React.ReactNode[] => {
    const names = namesBySection.get(sectionKey) ?? [];
    const showIndicator = attributeTarget?.key === sectionKey;
    const rendered: React.ReactNode[] = [];
    let slot = 0;
    let shown = 0;

    for (const name of names) {
      const attribute = byName.get(name);
      if (!attribute) continue;
      const isLifted = name === liftedAttribute;
      if (showIndicator && !isLifted && slot === attributeTarget.index) {
        rendered.push(<DropIndicator key={`drop-${name}`} />);
      }
      if (!isLifted) slot += 1;
      if (isFiltering && !matches(attribute, needle)) continue;
      shown += 1;
      rendered.push(
        <ProfileDisplayAttributeEditRow
          key={name}
          attribute={attribute}
          isHidden={editor.draft.hidden[name] === true}
          isLifted={isLifted}
          ruleNames={ruleReads?.[name] ?? []}
          isReorderDisabled={isFiltering}
          gripDescribedBy={HELP_ID}
          onToggleHidden={() => editor.toggleHidden(name)}
          onGripPointerDown={(event) => editor.beginDrag('attr', name, event)}
          onLift={() => editor.lift('attr', name)}
          onStep={editor.step}
          onDrop={editor.drop}
          onCancelLift={editor.cancelDrag}
        />,
      );
    }
    if (showIndicator && slot === attributeTarget.index) {
      rendered.push(<DropIndicator key="drop-end" />);
    }
    // A section keeps its true `fieldCount` badge under a filter, because that
    // count is what the delete consequence is measured in. Without this line the
    // badge would sit above an empty body and read as a contradiction, so the
    // section says where the missing rows went instead of going silent.
    if (isFiltering && shown === 0 && names.length > 0) {
      rendered.push(
        <p key="all-filtered" className="px-(--sp-row-x) py-1 text-xs text-neutral-500">
          {filteredOutLabel(names.length)}
        </p>,
      );
    }
    return rendered;
  };

  const sectionNodes: React.ReactNode[] = [];
  let sectionSlot = 0;
  for (const section of editor.sections) {
    const isFixed = section.key === UNCATEGORIZED;
    const isLifted = section.key === liftedSection;
    if (!isFixed) {
      if (sectionTarget && !isLifted && sectionSlot === sectionTarget.index) {
        sectionNodes.push(<DropIndicator key={`section-drop-${section.key}`} />);
      }
      if (!isLifted) sectionSlot += 1;
    }
    sectionNodes.push(
      <ProfileDisplaySectionEditor
        key={section.key || 'uncategorized'}
        sectionKey={section.key}
        name={section.name}
        fieldCount={(namesBySection.get(section.key) ?? []).length}
        isFixed={isFixed}
        isLifted={isLifted}
        isReorderDisabled={isFiltering}
        gripDescribedBy={HELP_ID}
        onRename={(name) => editor.rename(section.key, name)}
        onDelete={() => editor.remove(section.key)}
        onGripPointerDown={(event) => editor.beginDrag('section', section.key, event)}
        onLift={() => editor.lift('section', section.key)}
        onStep={editor.step}
        onDrop={editor.drop}
        onCancelLift={editor.cancelDrag}
      >
        {rowsFor(section.key)}
      </ProfileDisplaySectionEditor>,
    );
  }

  const addSection = (): void => {
    editor.add(newSectionName);
    setNewSectionName('');
  };

  return (
    <div>
      <div className="px-(--sp-card) pb-(--sp-card)">
        <ProfileDisplayOptions
          attributes={attributes}
          config={editor.draft}
          onLayoutChange={(layout) => editor.setOption('layout', layout)}
          onShowApiNamesChange={(value) => editor.setOption('showApiNames', value)}
          onShowRuleChipsChange={(value) => editor.setOption('showRuleChips', value)}
          onShowEmptyChange={(value) => editor.setOption('showEmpty', value)}
        />
      </div>

      <p id={HELP_ID} className="sr-only">
        Press Space to lift, the arrow keys to move it, Enter to drop, Escape to cancel.
      </p>

      {sectionNodes}

      <div className="flex items-center gap-(--sp-field) border-t border-neutral-200 px-(--sp-card) py-(--sp-field)">
        <div className="min-w-0 flex-1">
          <Input
            size="sm"
            value={newSectionName}
            onChange={setNewSectionName}
            ariaLabel="New section name"
            placeholder="New section"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addSection();
            }}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          disabled={newSectionName.trim() === ''}
          onClick={addSection}
        >
          Add section
        </Button>
      </div>

      {isFiltering && (
        <p className="px-(--sp-card) pb-(--sp-field) text-xs text-neutral-500">
          Clear the filter to reorder
        </p>
      )}

      <div className="flex items-center gap-(--sp-inline) border-t border-neutral-200 px-(--sp-card) py-(--sp-field)">
        <Button variant="ghost" size="sm" onClick={editor.resetToDefault}>
          Reset to default
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={editor.cancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={editor.commit}>
          Done
        </Button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {editor.announcement}
      </div>

      {editor.drag && editor.ghost && (
        <ProfileDisplayDragGhost
          label={editor.drag.label}
          x={editor.ghost.x}
          y={editor.ghost.y}
          reducedMotion={editor.reducedMotion}
        />
      )}
    </div>
  );
};

export default ProfileDisplayEditor;
