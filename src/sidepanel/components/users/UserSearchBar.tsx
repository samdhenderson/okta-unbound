/**
 * @module sidepanel/components/users/UserSearchBar
 * @description Controlled search input for user search, with inline spinner and clear button.
 *
 * A thin controlled wrapper over the shared `Input`, following the
 * `MemberSearchBar` pattern: leading `Icon` for the magnifier, trailing
 * `IconButton` + `Icon` for clear, and `LoadingSpinner` for the in-flight state.
 */
import React, { useRef } from 'react';
import { IconButton, Input, LoadingSpinner } from '../shared';
import Icon from '../overview/shared/Icon';

/** Props for {@link UserSearchBar}. */
interface UserSearchBarProps {
  /** Current search text (controlled). */
  searchQuery: string;
  /** Called with the new query on every keystroke. */
  onSearchChange: (query: string) => void;
  /** Clears the query; also refocuses the input. */
  onClear: () => void;
  /** When true, shows the inline loading spinner. */
  isSearching: boolean;
  /** When true, shows the clear (×) button. */
  showClearButton: boolean;
  /** Placeholder text; defaults to a generic email/name/login hint. */
  placeholder?: string;
}

/**
 * Search bar for user search with an inline loading indicator and a clear button
 * that refocuses the input.
 *
 * `size="lg"` reproduces the original hand-rolled field exactly: `lg`'s
 * `pl-11`/`pr-12`/`py-3` match the pre-migration `pl-11 pr-12 py-3`. The spinner
 * and clear button share `Input`'s single `trailing` slot (the original could
 * show both at once — the clear button flush against the edge, the spinner
 * offset further in) laid out as a row so both can appear together without
 * overlapping.
 */
const UserSearchBar: React.FC<UserSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onClear,
  isSearching,
  showClearButton,
  placeholder = 'Search by email, name, or login...',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on clear
  const handleClear = () => {
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <Input
        inputRef={inputRef}
        type="text"
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={placeholder}
        size="lg"
        icon={<Icon type="search" size="md" />}
        trailing={
          <div className="flex items-center gap-1">
            {isSearching && <LoadingSpinner size="sm" />}
            {showClearButton && (
              <IconButton label="Clear search" onClick={handleClear} variant="ghost" size="sm">
                <Icon type="close" size="md" />
              </IconButton>
            )}
          </div>
        }
        trailingInteractive={showClearButton}
      />
    </div>
  );
};

export default UserSearchBar;
