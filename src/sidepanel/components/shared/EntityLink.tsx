/**
 * @module sidepanel/components/shared/EntityLink
 * @description A named entity, rendered as a chip that opens it on its own tab (ADR-0030).
 *
 * One component for every "that rule / that group / that user / that app"
 * reference, so a cross-reference looks and behaves the same wherever it appears.
 * The chip carries a type glyph and a trailing chevron, which is the whole point:
 * `RuleCard` currently renders its target groups as pills that look exactly like
 * the neighbouring *attribute* pills and do nothing when clicked. A glyph plus a
 * chevron says "this goes somewhere" and, just as importantly, says it only when
 * that is true.
 *
 * ## Not every name can be linked
 *
 * Three references in this app carry a name and no id, and inventing a target for
 * them would be a guess rendered as a fact:
 *
 * - a rule condition's `isMemberOfGroupName("sales")` — one name can match an Okta
 *   group *and* a Workday group *and* a Salesforce group;
 * - `PushGroupMapping.targetGroupName` — a group inside the downstream app, which
 *   is not an Okta entity at all;
 * - `profile.manager` when no `managerId` accompanies it.
 *
 * Omit `id` for those and the name renders as plain text with a tooltip saying
 * why. The same fallback covers an entity kind this build cannot reach yet
 * ({@link sidepanel/contexts/NavigationContext.EntityNavigation.canNavigateTo}),
 * so a link is never a control that does nothing.
 *
 * ## Copying the raw id
 *
 * Set `copyId` and the chip gains a sibling ghost copy control for the raw Okta id —
 * name badge, copy-id, and open-in-detail from one import, for the views that show a
 * resolved name but still need the id itself to paste into a ticket or a search.
 * The control is a *sibling* of the chip, never a child: the chip is a `<button>`, and
 * a button inside a button is neither valid HTML nor reachable. It appears only when an
 * `id` is present — with nothing to copy there is no half-working control, only the name.
 * An id that exists but cannot be navigated to still copies: `copyId` follows the id,
 * `open` follows navigability, and the two are independent.
 *
 * Entity names are end-user-controllable Okta data: they are rendered as React
 * text (escaped) and truncate rather than overflow their row.
 */
import React from 'react';
import Icon, { type IconType } from '../shared/Icon';
import IconButton from './IconButton';
import { useEntityNavigation, type EntityType } from '../../contexts/NavigationContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

/** The glyph that identifies each entity kind, from the shared `Icon` registry. */
const typeIcon: Record<EntityType, IconType> = {
  rule: 'bolt',
  group: 'users',
  user: 'user',
  app: 'app',
  policy: 'shield',
};

/** How each entity kind is named in an accessible label or a tooltip. */
const typeNoun: Record<EntityType, string> = {
  rule: 'rule',
  group: 'group',
  user: 'user',
  app: 'app',
  policy: 'policy',
};

/** Props for {@link EntityLink}. */
export interface EntityLinkProps {
  /** Which kind of entity this is — picks the glyph and the destination tab. */
  type: EntityType;
  /**
   * The entity's Okta id. **Omit when the reference carries only a name**; the
   * chip then renders as plain text rather than as a control that cannot work.
   */
  id?: string;
  /** The visible name. Truncates rather than overflowing. */
  name: string;
  /**
   * Why this reference cannot be opened, shown as the tooltip on the plain-text
   * fallback. Defaults to a generic "no id available" sentence — override it
   * where the real reason is more interesting (a name that could match several
   * groups, a group that lives in another product).
   */
  unlinkableReason?: string;
  /**
   * Show a ghost copy-to-clipboard control for the raw `id` beside the chip. Ignored
   * when no `id` is given — there would be nothing to copy, and an affordance that
   * cannot work is worse than none. Independent of whether the chip itself is
   * openable: an id this build cannot navigate to is still an id worth copying.
   */
  copyId?: boolean;
  /**
   * Accessible name for that copy control, e.g. `"Copy group id"`. Defaults to
   * `"Copy <type> id for <name>"` — several of these can share a screen, so the name
   * has to say copy *what*, the way {@link CopyableId}'s required `label` does.
   */
  copyIdLabel?: string;
  /** Extra classes merged after the chip classes. */
  className?: string;
  /** Optional test handle. */
  testId?: string;
}

/** Chip and fallback share these, so a linked and an unlinked name sit on the same baseline. */
const sharedClasses = 'inline-flex max-w-full items-center gap-1 text-xs font-medium';

/**
 * A reference to another entity: a chip that opens it, or plain text when it
 * cannot be opened — optionally beside a copy control for its raw id.
 *
 * @example
 * ```tsx
 * <EntityLink type="rule" id={rule.id} name={rule.name} />
 *
 * // Name badge + copy-id + open, from one import:
 * <EntityLink type="group" id={group.id} name={group.profile.name} copyId />
 *
 * // A rule condition names a group but carries no id:
 * <EntityLink
 *   type="group"
 *   name={groupName}
 *   unlinkableReason="This rule matches the group by name, and a name can match groups from more than one source, so there is no single group to open."
 * />
 * ```
 */
const EntityLink: React.FC<EntityLinkProps> = ({
  type,
  id,
  name,
  unlinkableReason,
  copyId = false,
  copyIdLabel,
  className = '',
  testId,
}) => {
  const { navigateTo, canNavigateTo } = useEntityNavigation();
  const { copied, copy } = useCopyToClipboard();
  const linkable = Boolean(id) && canNavigateTo(type);

  const chip = linkable ? (
    <button
      type="button"
      onClick={() => navigateTo({ type, id: id as string })}
      // The visible name is contained in the accessible name (WCAG "Label in
      // Name"); the verb is what the chevron conveys visually.
      aria-label={`Open ${typeNoun[type]} ${name}`}
      title={`Open ${typeNoun[type]} ${name}`}
      data-testid={testId}
      className={`
        ${sharedClasses}
        rounded-md border border-primary-highlight bg-primary-light px-2 py-0.5
        text-primary-text hover:bg-primary-highlight
        transition-colors duration-(--dur-instant)
        focus:outline-2 focus:outline-offset-2 focus:outline-primary
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      <Icon type={typeIcon[type]} size="xs" className="shrink-0" />
      <span className="truncate">{name}</span>
      <Icon type="chevron-right" size="xs" className="shrink-0 opacity-60" />
    </button>
  ) : (
    <span
      className={`${sharedClasses} text-neutral-700 border-b border-dotted border-neutral-400 ${className}`}
      title={
        unlinkableReason ??
        `${name} — no ${typeNoun[type]} id is available for this reference, so it cannot be opened.`
      }
      data-testid={testId}
    >
      <Icon type={typeIcon[type]} size="xs" className="shrink-0 text-neutral-500" />
      <span className="truncate">{name}</span>
    </span>
  );

  // No id means nothing to copy, so the affordance is absent rather than inert.
  if (!copyId || !id) return chip;

  // Sibling, not child: the chip is a `<button>`, and nesting one inside it would
  // be invalid HTML and unreachable for assistive tech.
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      {chip}
      <IconButton
        label={copied ? 'Copied!' : (copyIdLabel ?? `Copy ${typeNoun[type]} id for ${name}`)}
        onClick={() => copy(id)}
        variant="ghost"
        size="sm"
        className="shrink-0"
      >
        <Icon
          type={copied ? 'clipboard-check' : 'clipboard'}
          size="sm"
          className={copied ? 'text-success-text' : ''}
        />
      </IconButton>
    </span>
  );
};

export default EntityLink;
