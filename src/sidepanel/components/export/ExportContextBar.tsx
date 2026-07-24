/**
 * @module sidepanel/components/export/ExportContextBar
 * @description Search-to-select context picker for the Export tab.
 *
 * For descriptors scoped to a parent entity (a group, an app), the admin first
 * picks that entity off-page. Composes {@link useSearchWithDropdown} with the
 * shared {@link SearchDropdown}; the chosen {@link EntityContextOption} is handed
 * up to the tab hook, which builds the list endpoint from its id.
 */
import React from 'react';
import { SearchDropdown } from '../shared';
import { useSearchWithDropdown } from '../../hooks/useSearchWithDropdown';
import type { EntityContextOption } from '../../export/types';

/** Props for {@link ExportContextBar}. */
interface ExportContextBarProps {
  /** Field label for the picker (e.g. `Group`). */
  label: string;
  /** Placeholder for the search input. */
  placeholder: string;
  /** Type-ahead search over candidate context entities. */
  search: (query: string) => Promise<EntityContextOption[]>;
  /** Called with the chosen entity, or `null` when the selection is cleared. */
  onSelect: (option: EntityContextOption | null) => void;
  /** Pre-selected entity to show on mount (e.g. a deep-linked pre-scoped context). */
  initialSelected?: EntityContextOption | null;
}

/**
 * Renders the context entity picker. Selecting a result reports it upward;
 * clearing reports `null`.
 */
const ExportContextBar: React.FC<ExportContextBarProps> = ({
  label,
  placeholder,
  search,
  onSelect,
  initialSelected = null,
}) => {
  const dropdown = useSearchWithDropdown<EntityContextOption>({
    searchFn: search,
    onSelect,
    initialSelected,
  });

  return (
    <SearchDropdown<EntityContextOption>
      label={label}
      placeholder={placeholder}
      query={dropdown.query}
      onQueryChange={dropdown.setQuery}
      isSearching={dropdown.isSearching}
      results={dropdown.results}
      showDropdown={dropdown.showDropdown}
      onSelect={dropdown.selectItem}
      selectedItem={dropdown.selectedItem}
      onClear={() => {
        dropdown.clearSearch();
        onSelect(null);
      }}
      renderResult={(option) => (
        <div>
          <div className="font-medium text-neutral-900">{option.label}</div>
          {option.sublabel && <div className="text-xs text-neutral-500">{option.sublabel}</div>}
        </div>
      )}
      renderSelected={(option) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-900">{option.label}</span>
          {option.sublabel && <span className="text-xs text-neutral-500">{option.sublabel}</span>}
        </div>
      )}
    />
  );
};

export default ExportContextBar;
