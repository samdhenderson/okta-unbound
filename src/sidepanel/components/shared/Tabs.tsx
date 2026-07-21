/**
 * @module sidepanel/components/shared/Tabs
 * @description Accessible tab bar with `underline` and `segmented` variants.
 *
 * Renders the tab strip only — callers own the panels and toggle them on the
 * active key. Implements the ARIA tablist pattern (`role="tablist"`/`role="tab"`,
 * `aria-selected`, roving `tabindex`) with Left/Right/Home/End keyboard
 * navigation and automatic activation. Prefer this over hand-rolling tab bars.
 */
import React, { useRef } from 'react';

/** A single tab descriptor. */
export interface TabItem {
  /** Stable identity for the tab; matched against `activeKey`. */
  key: string;
  /** Visible label. */
  label: string;
  /** Optional count rendered as a small badge after the label. */
  count?: number;
}

/** Visual treatment for the tab strip. */
export type TabsVariant = 'underline' | 'segmented';

/** Props for {@link Tabs}. */
interface TabsProps {
  /** Tabs to render, in display order. */
  tabs: TabItem[];
  /** Key of the currently selected tab. */
  activeKey: string;
  /** Invoked with the newly selected tab key. */
  onChange: (key: string) => void;
  /** `underline` (default) for section navigation; `segmented` for compact toggles. */
  variant?: TabsVariant;
  /** Accessible label for the tablist (e.g. "User profile sections"). */
  ariaLabel?: string;
  /** Extra classes merged onto the tablist container. */
  className?: string;
}

const HEADING_FONT = { fontFamily: 'var(--font-heading)' };

/**
 * Accessible tab bar. Selection is controlled by the caller via
 * `activeKey`/`onChange`; only the tab strip is rendered here.
 *
 * @example
 * ```tsx
 * <Tabs
 *   tabs={[{ key: 'account', label: 'Account' }, { key: 'org', label: 'Org' }]}
 *   activeKey={active}
 *   onChange={setActive}
 *   ariaLabel="User profile sections"
 * />
 * ```
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  ariaLabel,
  className = '',
}) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const clamped = (index + tabs.length) % tabs.length;
    const tab = tabs[clamped];
    if (!tab) return;
    onChange(tab.key);
    buttonRefs.current[clamped]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  const isSegmented = variant === 'segmented';

  const listClasses = isSegmented
    ? `flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1 ${className}`
    : `flex items-center gap-1 border-b border-neutral-200 overflow-x-auto ${className}`;

  return (
    <div role="tablist" aria-label={ariaLabel} className={listClasses}>
      {tabs.map((tab, index) => {
        const active = tab.key === activeKey;

        const tabClasses = isSegmented
          ? `relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`
          : `relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'text-primary border-primary'
                : 'text-neutral-600 border-transparent hover:text-neutral-900'
            }`;

        const badgeClasses = isSegmented
          ? active
            ? 'bg-primary text-white'
            : 'bg-neutral-200 text-neutral-700'
          : active
            ? 'bg-primary-light text-primary-text'
            : 'bg-neutral-100 text-neutral-600';

        return (
          <button
            key={tab.key}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClasses}
            style={HEADING_FONT}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${badgeClasses}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
