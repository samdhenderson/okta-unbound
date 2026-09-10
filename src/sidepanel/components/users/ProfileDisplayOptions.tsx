/**
 * @module sidepanel/components/users/ProfileDisplayOptions
 * @description The four display options at the top of customize mode: how the
 * profile is laid out, and the three marks it can carry.
 *
 * Lifted from the Categories tab of the configuration modal this replaces, so
 * nothing lost a home when the modal went away. Every control is controlled by
 * the caller's draft config and emits a single field change — this component
 * holds no state at all.
 *
 * The "show attributes with no value" checkbox states the exact count it governs
 * ("1 of 5 attributes are empty on this user."), because the option is otherwise
 * a guess about a profile the admin cannot currently see.
 *
 * Security: attribute names and values are untrusted tenant data. Nothing here
 * logs, and only the empty *count* is rendered — never a value.
 */
import React from 'react';
import { Checkbox, Eyebrow, FilterPill } from '../shared';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/** Props for {@link ProfileDisplayOptions}. */
export interface ProfileDisplayOptionsProps {
  /** Every attribute on the profile — the source of the empty count. */
  attributes: readonly AttributeDescriptor[];
  /** The draft configuration being edited. */
  config: ProfileDisplayConfig;
  /** Set the attribute list's layout. */
  onLayoutChange: (layout: ProfileDisplayConfig['layout']) => void;
  /** Show the raw Okta key beside each attribute's label. */
  onShowApiNamesChange: (showApiNames: boolean) => void;
  /** Mark each attribute a group rule reads. */
  onShowRuleChipsChange: (showRuleChips: boolean) => void;
  /** Render attributes that are empty on this user. */
  onShowEmptyChange: (showEmpty: boolean) => void;
}

/** The three layouts, in the order they are offered. */
const LAYOUT_OPTIONS: ReadonlyArray<{ value: ProfileDisplayConfig['layout']; label: string }> = [
  { value: 'rows', label: 'Label + value rows' },
  { value: 'compact', label: 'Compact rows' },
  { value: 'grid', label: 'Two-column cards' },
];

/**
 * Layout and the three display marks.
 *
 * @example
 * ```tsx
 * <ProfileDisplayOptions
 *   attributes={attributes}
 *   config={editor.draft}
 *   onLayoutChange={(layout) => editor.setOption('layout', layout)}
 *   … />
 * ```
 */
const ProfileDisplayOptions: React.FC<ProfileDisplayOptionsProps> = ({
  attributes,
  config,
  onLayoutChange,
  onShowApiNamesChange,
  onShowRuleChipsChange,
  onShowEmptyChange,
}) => {
  const emptyCount = attributes.filter((attribute) => attribute.isEmpty).length;

  return (
    <section className="flex flex-col gap-2">
      <Eyebrow as="h3">Layout</Eyebrow>
      <div className="flex flex-wrap gap-(--sp-inline)" role="group" aria-label="Layout">
        {LAYOUT_OPTIONS.map((option) => (
          <FilterPill
            key={option.value}
            active={config.layout === option.value}
            onClick={() => onLayoutChange(option.value)}
          >
            {option.label}
          </FilterPill>
        ))}
      </div>

      <div className="mt-1 flex flex-col gap-(--sp-field)">
        <Checkbox
          checked={config.showApiNames}
          onChange={onShowApiNamesChange}
          label="Show Okta attribute names"
          description={
            <>
              Renders <span className="font-mono">department</span> instead of Department.
            </>
          }
        />
        <Checkbox
          checked={config.showRuleChips}
          onChange={onShowRuleChipsChange}
          label="Mark attributes read by rules"
          description="Flags each attribute a group rule reads to decide membership."
        />
        <Checkbox
          checked={config.showEmpty}
          onChange={onShowEmptyChange}
          label="Show attributes with no value"
          description={`${emptyCount} of ${attributes.length} ${
            attributes.length === 1 ? 'attribute is' : 'attributes are'
          } empty on this user.`}
        />
      </div>
    </section>
  );
};

export default ProfileDisplayOptions;
