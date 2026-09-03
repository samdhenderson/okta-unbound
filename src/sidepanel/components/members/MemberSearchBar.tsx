/**
 * @module sidepanel/components/members/MemberSearchBar
 * @description Search input for the member list, with a leading icon and a clear button.
 *
 * A thin controlled wrapper over the shared Input; the parent
 * (`MemberExplorer`) owns the value and debounces it before filtering. The
 * clear button is composed through `Input`'s `trailing`/`trailingInteractive`
 * slot rather than layered on top of the field as a separate sibling — that
 * routing is what lets the shared primitive suppress the browser's own
 * `type="search"` cancel-button and avoid a double clear affordance.
 */
import React from 'react';
import Input from '../shared/Input';
import { IconButton } from '../shared';
import Icon from '../shared/Icon';

/** Props for {@link MemberSearchBar}. */
interface MemberSearchBarProps {
  /** Current query text (controlled). */
  value: string;
  /** Called with the new query on each change / clear. */
  onChange: (value: string) => void;
  /** Optional placeholder override. */
  placeholder?: string;
}

/** Renders the member search field; shows a clear button when non-empty. */
const MemberSearchBar: React.FC<MemberSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search members by name, email, or login…',
}) => {
  return (
    <Input
      value={value}
      onChange={onChange}
      type="search"
      placeholder={placeholder}
      icon={<Icon type="search" size="sm" />}
      trailingInteractive={Boolean(value)}
      trailing={
        value ? (
          <IconButton label="Clear search" onClick={() => onChange('')} variant="ghost" size="sm">
            <Icon type="close" size="sm" />
          </IconButton>
        ) : undefined
      }
    />
  );
};

export default MemberSearchBar;
