/**
 * @module sidepanel/components/shared/CopyableId
 * @description An Okta identifier shown inline, with a one-click copy.
 *
 * The single home for the inline id recipe — a truncating `<code>` beside a ghost
 * {@link IconButton} whose glyph and accessible name flip to a confirmation for ~1.5s.
 * It was hand-rolled identically in `ContextBar` and the user identity card, both of
 * which also pinned the glyph to an arbitrary `w-3.5 h-3.5` and the text to an arbitrary
 * `text-[11px]` — sizes the design system's identifier contract (`font-mono text-xs
 * text-neutral-500`) and `Icon`'s own scale already answer.
 *
 * Distinct from {@link CopyButton}, which is a labelled `Button` for copying a *body* of
 * text (a list of emails, a CSV). This is for a single identifier sitting in a line of
 * metadata, where a full button would outweigh the value beside it.
 */
import React from 'react';
import CopyIconButton from './CopyIconButton';

/** Props for {@link CopyableId}. */
export interface CopyableIdProps {
  /** The identifier to render and copy, e.g. an Okta group id. */
  value: string;
  /**
   * Accessible name for the copy control, e.g. `"Copy group id"`. Required: several of
   * these can share a screen, and "Copy" alone would not say copy *what*.
   */
  label: string;
  /** Extra classes merged onto the wrapper. */
  className?: string;
}

/**
 * Render an identifier with an inline copy control.
 *
 * @example
 * ```tsx
 * <CopyableId value={group.id} label="Copy group id" />
 * ```
 */
const CopyableId: React.FC<CopyableIdProps> = ({ value, label, className = '' }) => {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <code className="min-w-0 truncate font-mono text-xs text-neutral-500">{value}</code>
      <CopyIconButton value={value} label={label} />
    </span>
  );
};

export default CopyableId;
