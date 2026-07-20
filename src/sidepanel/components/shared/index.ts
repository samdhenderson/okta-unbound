/**
 * @module sidepanel/components/shared
 * @description Barrel for the shared design-system UI primitives.
 *
 * Import buttons, inputs, modal, and other reusable components from here rather
 * than reaching into individual files. Per the project hard rules, always reuse
 * these primitives instead of hand-rolling `<button>/<input>/<select>/<textarea>`.
 * Also re-exports the commonly used variant/data types.
 */

// Shared UI components following Overview tab design standards
export { default as Button } from './Button';
export { default as IconButton } from './IconButton';
export { default as FilterPill } from './FilterPill';
export { default as SortPill } from './SortPill';
export { default as CopyButton } from './CopyButton';
export { default as OpenInOktaLink } from './OpenInOktaLink';
export { default as Modal } from './Modal';
export { default as Input } from './Input';
export { default as Checkbox } from './Checkbox';
export { default as Select } from './Select';
export { default as Textarea } from './Textarea';
export { default as PageHeader } from './PageHeader';
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as AlertMessage } from './AlertMessage';
export { default as EmptyState } from './EmptyState';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ScrollableList } from './ScrollableList';
export { default as SearchDropdown } from './SearchDropdown';
export { default as SelectionChips } from './SelectionChips';

// Re-export commonly used types
export type { ButtonVariant, ButtonSize } from './Button';
export type { IconButtonVariant, IconButtonSize } from './IconButton';
export type { AlertMessageData, AlertAction } from './AlertMessage';
export type { StatusType } from './status';
