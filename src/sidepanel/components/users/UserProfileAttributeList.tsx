/**
 * @module sidepanel/components/users/UserProfileAttributeList
 * @description Renders one block's worth of profile attributes in whichever of the
 * three layouts the admin chose — the label/value half of `UserProfilePane`.
 *
 * Split out of the pane so the pane keeps only its state and its derivation, and
 * so the one place a layout decision is made is a `Record<layout, string>` lookup
 * rather than three branches scattered through a render tree.
 *
 * ## No truncation, ever
 *
 * The card this replaces laid attributes out as fixed two-column tiles and
 * clipped anything that did not fit, which meant a street address and a long
 * login — the two attributes most likely to be *why* an admin opened the profile
 * — were the two that could not be read, with no affordance to see the rest.
 * Every layout here wraps (`break-words` plus `text-pretty`); the value column
 * gets whatever height it needs. That is the specific defect this component
 * exists to fix, so a future `truncate` here would be a regression, not a tidy-up.
 *
 * ## Security
 *
 * Attribute values are end-user-controllable tenant data and frequently PII, as
 * are the rule names in a chip's tooltip. They are rendered through React's
 * escaping only — no `dangerouslySetInnerHTML`, no hand-built HTML — and nothing
 * in this module logs.
 */
import React from 'react';
import { Badge } from '../shared';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';

/** The three presentations of an attribute list, from `ProfileDisplayConfig.layout`. */
export type ProfileAttributeLayout = ProfileDisplayConfig['layout'];

/** Props for {@link UserProfileAttributeList}. */
export interface UserProfileAttributeListProps {
  /** The attributes of one category block, already filtered and in display order. */
  attributes: readonly AttributeDescriptor[];
  /** Which presentation to render. */
  layout: ProfileAttributeLayout;
  /** Show the Okta attribute name (`department`, in mono) instead of its human label. */
  showApiNames: boolean;
  /** Whether the "read by rules" chips render at all. */
  showRuleChips: boolean;
  /**
   * Attribute Okta name to the rule names that read it, from `profileRuleReads`.
   * An attribute absent from the map gets no chip.
   */
  ruleReads: Record<string, string[]>;
}

/** Outer list box: the gap between fields, and the grid track in `grid`. */
const listClasses: Record<ProfileAttributeLayout, string> = {
  rows: 'space-y-2',
  compact: 'space-y-1',
  // `auto-fit` has no Tailwind utility and no scale equivalent; the 150px floor
  // is what keeps two cards per line at the 360px panel width and lets the grid
  // grow to three or four when the panel is docked wider.
  grid: 'grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2',
};

/** One field's box. `rows`/`compact` are a label column beside a value column. */
const fieldClasses: Record<ProfileAttributeLayout, string> = {
  rows: 'flex gap-3',
  compact: 'flex gap-2',
  grid: 'rounded-md bg-canvas p-2',
};

/**
 * The label cell. The fixed column is expressed on the spacing scale (`w-28` /
 * `w-24`) rather than as an arbitrary pixel width, and `shrink-0` is what stops a
 * long value from squeezing the labels out of alignment down the block.
 */
const labelClasses: Record<ProfileAttributeLayout, string> = {
  rows: 'w-28 shrink-0',
  compact: 'w-24 shrink-0',
  grid: 'block mb-1',
};

/** The value cell — also the flex line the rules chip shares with the value. */
const valueClasses: Record<ProfileAttributeLayout, string> = {
  rows: 'min-w-0 flex-1 flex flex-wrap items-center gap-2',
  compact: 'min-w-0 flex-1 flex flex-wrap items-center gap-2',
  grid: 'flex flex-wrap items-center gap-2',
};

/** The field-label type recipe from the design system, label-above-value form. */
const LABEL_TYPE = 'text-xs font-medium text-neutral-600';

/** The value type recipe. `break-words`/`text-pretty` are the no-truncation contract. */
const VALUE_TYPE = 'min-w-0 break-words text-pretty text-sm font-medium text-neutral-900';

/** `1 rule` / `3 rules` — the chip never says "rules" for one. */
function ruleChipLabel(count: number): string {
  return count === 1 ? '1 rule' : `${count} rules`;
}

/**
 * One category block's attributes, laid out per the admin's chosen layout.
 *
 * Rendered as a `<dl>` so each label is programmatically tied to its value rather
 * than merely sitting to its left, which is what makes the pane readable in a
 * screen reader's list-of-terms view.
 *
 * @example
 * ```tsx
 * <UserProfileAttributeList
 *   attributes={block.attributes}
 *   layout={config.layout}
 *   showApiNames={config.showApiNames}
 *   showRuleChips={config.showRuleChips}
 *   ruleReads={ruleReads}
 * />
 * ```
 */
const UserProfileAttributeList: React.FC<UserProfileAttributeListProps> = ({
  attributes,
  layout,
  showApiNames,
  showRuleChips,
  ruleReads,
}) => (
  <dl className={listClasses[layout]}>
    {attributes.map((attribute) => {
      const readers = ruleReads[attribute.name];
      const chip = showRuleChips && readers && readers.length > 0 ? readers : undefined;

      return (
        <div key={attribute.key} className={fieldClasses[layout]}>
          <dt
            className={`${labelClasses[layout]} ${LABEL_TYPE} ${
              showApiNames ? 'font-mono break-words' : ''
            }`}
          >
            {showApiNames ? attribute.name : attribute.label}
          </dt>
          <dd className={valueClasses[layout]}>
            {attribute.isEmpty ? (
              <span className="text-sm text-neutral-400" title="No value">
                —
              </span>
            ) : (
              <span className={`${VALUE_TYPE} ${attribute.mono ? 'font-mono' : ''}`}>
                {attribute.value}
              </span>
            )}
            {chip && (
              <Badge variant="primary" title={`Read by: ${chip.join(', ')}`}>
                {ruleChipLabel(chip.length)}
              </Badge>
            )}
          </dd>
        </div>
      );
    })}
  </dl>
);

export default UserProfileAttributeList;
