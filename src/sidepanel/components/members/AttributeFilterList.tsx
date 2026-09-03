/**
 * @module sidepanel/components/members/AttributeFilterList
 * @description The discovered profile attributes, as a list of ways in — not as a report.
 *
 * Inside the member explorer's filter drawer, an attribute is a *route to a
 * value*: pick `Department` and the reveal opens with every department in the
 * group and their counts, and picking one there filters the list. So the
 * attribute itself needs one row, not a card with a spread bar and a legend.
 *
 * ## Why this is not the composition report
 *
 * `CompositionReports` drew a grid of {@link AttributeFacet} cards, each with its
 * own bar, legend and "view all". That is a distribution — analysis — and it now
 * lives on the Insights tab where analysis belongs. What a filtering surface
 * needs from the same data is much smaller: the attribute's name, how many
 * distinct values it has (so a reader can tell a two-value attribute from a
 * ninety-value one before opening it), and whether it is currently filtering.
 *
 * ## Why the reveal, rather than a second picker
 *
 * {@link module:sidepanel/components/members/BreakdownDetailsModal} already is
 * the value picker: the full distribution, scrollable, copyable, with each row
 * toggling a filter. Both the Insights tab and this drawer open it. Building a
 * second one here would be a second place for the "(none)"/"Other" sentinel
 * handling and the active-value highlighting to drift.
 */
import React from 'react';
import { ListRow } from '../shared';
import Icon from '../shared/Icon';
import type { AttributeSummary } from './memberAnalytics';

/** Props for {@link AttributeFilterList}. */
export interface AttributeFilterListProps {
  /** Discovered profile attributes, in `discoverAttributeBreakdowns` order. */
  attributes: AttributeSummary[];
  /**
   * Attribute keys with at least one active filter. Drives the row's `selected`
   * state, so a reader can see which attribute a chip above came from without
   * opening anything.
   */
  filteredKeys: ReadonlySet<string>;
  /** Open the value picker for one attribute key. */
  onSelect: (attributeKey: string) => void;
}

/**
 * One row per discovered profile attribute; each opens the value picker.
 *
 * @param props - See {@link AttributeFilterListProps}.
 */
const AttributeFilterList: React.FC<AttributeFilterListProps> = ({
  attributes,
  filteredKeys,
  onSelect,
}) => {
  if (attributes.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No profile attribute (department, title, location…) is populated for this group, so there is
        nothing to filter by.
      </p>
    );
  }

  return (
    <ul className="space-y-(--sp-inline)">
      {attributes.map((attribute) => {
        const active = filteredKeys.has(attribute.key);
        return (
          <li key={attribute.key}>
            <ListRow
              as="button"
              density="compact"
              state={active ? 'selected' : 'default'}
              onClick={() => onSelect(attribute.key)}
              /* The visible text is the attribute name alone, which in a list of
                 rows all doing the same thing does not say what activating one
                 does. The name states it. */
              ariaLabel={`${attribute.label}: choose a value to filter by`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-neutral-900">
                  {attribute.label}
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="text-xs tabular-nums text-neutral-600">
                    {attribute.distinct.toLocaleString()} value
                    {attribute.distinct === 1 ? '' : 's'}
                  </span>
                  <Icon type="chevron-right" size="xs" className="text-neutral-400" />
                </span>
              </span>
            </ListRow>
          </li>
        );
      })}
    </ul>
  );
};

export default AttributeFilterList;
