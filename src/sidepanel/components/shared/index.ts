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
export { default as StretchedButton } from './StretchedButton';
export { default as FilterPill } from './FilterPill';
export { default as SortPill } from './SortPill';
export { default as CopyButton } from './CopyButton';
export { default as CopyableId } from './CopyableId';
export { default as CopyIconButton } from './CopyIconButton';
export { default as OpenInOktaLink } from './OpenInOktaLink';
export { default as Modal } from './Modal';
export { default as Input } from './Input';
export { default as Checkbox } from './Checkbox';
export { default as Select } from './Select';
export { default as Textarea } from './Textarea';
export { default as PageHeader } from './PageHeader';
export { default as WorkingSetPinButton } from './WorkingSetPinButton';
export { default as Breadcrumbs } from './Breadcrumbs';
export { default as Tabs } from './Tabs';
export { default as Tooltip } from './Tooltip';
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as DetailSection } from './DetailSection';
export { default as ActionBar } from './ActionBar';
export { default as Badge } from './Badge';
export { default as EntityIdentity } from './EntityIdentity';
export { default as EntityLink } from './EntityLink';
export { default as FilterToggle } from './FilterToggle';
export { default as Eyebrow } from './Eyebrow';
export { default as StableWidth } from './StableWidth';
export { default as AlertMessage } from './AlertMessage';
export { default as EmptyState } from './EmptyState';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as Skeleton } from './Skeleton';
export { default as ListRow } from './ListRow';
export { default as ScrollableList } from './ScrollableList';
export { default as SearchDropdown } from './SearchDropdown';
export { default as SelectionChips } from './SelectionChips';
export { default as JsonViewer } from './JsonViewer';
export { default as JsonNode } from './JsonNode';

// Re-export commonly used types
export type { ButtonVariant, ButtonSize } from './Button';
export type { IconButtonVariant, IconButtonSize } from './IconButton';
export type { InputSize } from './Input';
export type { SpinnerSize } from './LoadingSpinner';
export type { SkeletonVariant, SkeletonSize } from './Skeleton';
export type { ListRowDensity, ListRowState, ListRowAs, ListRowProps } from './ListRow';
export type { AlertMessageData, AlertAction } from './AlertMessage';
export type { DetailSectionProps } from './DetailSection';
export type { ActionBarProps, ActionDescriptor, ActionPriority } from './ActionBar';
export type { BadgeVariant, BadgeProps } from './Badge';
export type { EntityLinkProps } from './EntityLink';
export type { FilterToggleProps } from './FilterToggle';
export type { EyebrowProps } from './Eyebrow';
export type { StableWidthProps } from './StableWidth';
export type { StatusType, UserStatusVariant } from './status';
export { userStatusVariant } from './status';
export type { TabItem, TabsVariant } from './Tabs';
export type { TooltipTriggerProps } from './Tooltip';
export type { BreadcrumbItem, BreadcrumbsSize } from './Breadcrumbs';
