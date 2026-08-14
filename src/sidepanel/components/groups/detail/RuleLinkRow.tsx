/**
 * @module sidepanel/components/groups/detail/RuleLinkRow
 * @description One rule in a Group Detail rule list, optionally linking into the Rules tab.
 *
 * Shared by the membership-source and rules sections so a rule looks and behaves
 * the same wherever it is listed. With `onSelect` it renders as a real `<button>`
 * whose accessible name names the rule (never a bare "Open"); without one it is
 * inert markup.
 *
 * The card is {@link sidepanel/components/shared/ListRow} at `compact` density
 * (ADR-0029), with `as` following the same `onSelect` switch the row already made
 * by hand. The row used to carry its own chrome string — including a
 * `hover:border-primary hover:bg-primary-light` treatment that was one of the five
 * the ADR consolidates, and which is now the shared `hover:border-neutral-500`.
 */
import React from 'react';
import Icon from '../../overview/shared/Icon';
import { ListRow } from '../../shared';

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

/**
 * Renders one rule row, as a button when it can deep-link into the Rules tab.
 *
 * @example
 * ```tsx
 * <RuleLinkRow name="All Engineers" trailing={<RuleStatusPill status="ACTIVE" />} onSelect={open} />
 * ```
 */
const RuleLinkRow: React.FC<RuleLinkRowProps> = ({ name, trailing, detail, onSelect }) => (
  // Both callers already wrap this in their own <li>, so the row stays a button
  // (when it deep-links) or a plain container (when it does not).
  <ListRow
    as={onSelect ? 'button' : 'div'}
    density="compact"
    onClick={onSelect}
    ariaLabel={onSelect ? `Open rule ${name} in the Rules tab` : undefined}
    className="flex w-full items-center justify-between gap-3"
  >
    <span className="flex min-w-0 flex-col items-start text-left">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-neutral-900">{name}</span>
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
  </ListRow>
);

export default RuleLinkRow;
