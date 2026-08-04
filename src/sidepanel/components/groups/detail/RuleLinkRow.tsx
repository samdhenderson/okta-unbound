/**
 * @module sidepanel/components/groups/detail/RuleLinkRow
 * @description One rule in a Group Detail rule list, optionally linking into the Rules tab.
 *
 * Shared by the membership-source and rules sections so a rule looks and behaves
 * the same wherever it is listed. With `onSelect` it renders as a real `<button>`
 * whose accessible name names the rule (never a bare "Open"); without one it is
 * inert markup.
 */
import React from 'react';
import Icon from '../../overview/shared/Icon';

/** Props for {@link RuleLinkRow}. */
interface RuleLinkRowProps {
  /** Rule name — the row's visible label and the basis of its accessible name. */
  name: string;
  /** Optional right-aligned node (a status pill, a member count). */
  trailing?: React.ReactNode;
  /** Optional secondary line under the name (e.g. the condition expression). */
  detail?: string;
  /** Deep-links this rule in the Rules tab. Omit to render a non-interactive row. */
  onSelect?: () => void;
}

const rowClasses = 'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2';

/**
 * Renders one rule row, as a button when it can deep-link into the Rules tab.
 *
 * @example
 * ```tsx
 * <RuleLinkRow name="All Engineers" trailing={<RuleStatusPill status="ACTIVE" />} onSelect={open} />
 * ```
 */
const RuleLinkRow: React.FC<RuleLinkRowProps> = ({ name, trailing, detail, onSelect }) => {
  const body = (
    <>
      <span className="flex min-w-0 flex-col items-start text-left">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm text-neutral-900">{name}</span>
          {onSelect && (
            <span aria-hidden="true" className="flex shrink-0 text-neutral-400">
              <Icon type="chevron-right" size="sm" />
            </span>
          )}
        </span>
        {detail && (
          <span className="mt-0.5 truncate font-mono text-xs text-neutral-500">{detail}</span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );

  if (!onSelect) {
    return <div className={`${rowClasses} border-neutral-200`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Open rule ${name} in the Rules tab`}
      className={`${rowClasses} border-neutral-200 text-left transition-colors duration-(--dur-instant) hover:border-primary hover:bg-primary-light focus:outline-2 focus:outline-offset-2 focus:outline-primary`}
    >
      {body}
    </button>
  );
};

export default RuleLinkRow;
