/**
 * @module sidepanel/components/users/UserSearchBar
 * @description Controlled search input for user search, with inline spinner and clear button.
 */
import React, { useRef } from 'react';
import { IconButton } from '../shared';

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
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        className="w-full pl-11 pr-12 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100 shadow-sm hover:shadow"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {showClearButton && (
        <IconButton
          label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={handleClear}
          variant="ghost"
          size="sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      )}
      {isSearching && (
        <div className="absolute inset-y-0 right-12 flex items-center pr-3">
          <div className="w-4 h-4 border-2 border-neutral-200 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default UserSearchBar;
