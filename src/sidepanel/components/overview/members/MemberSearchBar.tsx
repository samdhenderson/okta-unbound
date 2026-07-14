import React from 'react';
import Input from '../../shared/Input';
import Icon from '../shared/Icon';

interface MemberSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MemberSearchBar: React.FC<MemberSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search members by name, email, or login…',
}) => {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={onChange}
        type="search"
        placeholder={placeholder}
        icon={<Icon type="search" size="sm" />}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors duration-100"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MemberSearchBar;
