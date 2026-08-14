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
        icon={<Icon type="search" size="sm" />}
      />
      {showClearButton && (
        <IconButton
          label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={handleClear}
          variant="ghost"
          size="sm"
        >
          <Icon type="close" size="md" />
        </IconButton>
      )}
      {isSearching && (
        <div className="absolute inset-y-0 right-12 flex items-center pr-3">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
  );
};

export default UserSearchBar;
