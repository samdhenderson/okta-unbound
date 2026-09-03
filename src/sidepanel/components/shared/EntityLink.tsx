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
 * ## Two entities, one name
 *
 * A display name is not unique — two groups, two rules, two app instances can
 * legitimately share one (I-009). So the chip's accessible name folds the id in
 * (`"Open <type> <name> (<id>)"`), the same convention the `copyId` control's
 * derived default already used: the id is the one part guaranteed unique, and
 * folding it in means two same-named chips stay distinguishable without either
 * caller passing an override.
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
 * ## Known only by an id
 *
 * The mirror image of the case above: an id is in hand and **no name is**. Passing
 * the id in as the `name` puts an identifier in a name's slot, indistinguishable
 * from a resolved one — the defect I-003 removed from three views, each of which
 * then grew its own local chip to say so (I-017). Omit `name` instead and the
 * reference renders as a stated absence (`"Group name not loaded"`) beside the raw
 * id in the identifier register, and — this is the part the three local copies
 * could not do — it still **opens** the entity when the id is navigable, because a
 * valid id is a valid destination whether or not this view learned its name.
 *
 * Its chrome follows the house non-answer convention that
 * {@link sidepanel/components/users/comparison/AppScopeIndicator} and
 * {@link sidepanel/components/users/comparison/GroupSourceIndicator} state
 * explicitly: **a chip is a proven answer; a non-answer is muted italic text and
 * is never chipped**, so it cannot be mistaken at a glance for a resolved name.
 * The three copies disagreed on this — one wore a dashed-border pill, two were
 * plain text — and the convention wins. What survives from the pill is the type
 * glyph and the chevron, since those say *what kind* and *this goes somewhere*,
 * which is information rather than weight.
 *
 * Not to be confused with a reference whose entity is **gone**: "this org has no
 * group with that id" is a proven answer and takes a warning's weight and a chip
 * (`RuleDetailView`'s `MissingGroupChip`, D-061). Only the non-answer lives here.
 *
 * Entity names are end-user-controllable Okta data: they are rendered as React
 * text (escaped) and truncate rather than overflow their row.
 */
import React from 'react';
import Icon, { type IconType } from '../shared/Icon';
import CopyIconButton from './CopyIconButton';
import CopyableId from './CopyableId';
import { useEntityNavigation, type EntityType } from '../../contexts/NavigationContext';

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

/** Every kind's noun with its first letter capitalised, for the start of a sentence. */
const capitalisedNoun = (type: EntityType): string =>
  typeNoun[type].charAt(0).toUpperCase() + typeNoun[type].slice(1);

/** The props both modes share. */
interface EntityLinkBaseProps {
  /** Which kind of entity this is — picks the glyph and the destination tab. */
  type: EntityType;
  /**
   * Why this reference cannot be opened, shown as the tooltip on the plain-text
   * fallback. Defaults to a generic "no id available" sentence — override it
   * where the real reason is more interesting (a name that could match several
   * groups, a group that lives in another product).
   */
  unlinkableReason?: string;
  /**
   * The words shown in place of the missing name, in the id-only mode. Defaults
   * to `"<Type> name not loaded"`. Override it where this view knows something
   * sharper — "Name not returned by Okta" is a different fact from "this view
   * never asked". Keep it a **statement of absence**: it sits where a name would,
   * so anything that could be read as one re-creates the defect.
   */
  unresolvedLabel?: string;
  /**
   * The tooltip on that stated absence — why the name is missing here. Defaults
   * to a generic "only the id was loaded" sentence.
   */
  unresolvedReason?: string;
  /**
   * Show a ghost copy-to-clipboard control for the raw `id` beside the chip. Ignored
   * when no `id` is given — there would be nothing to copy, and an affordance that
   * cannot work is worse than none. Independent of whether the chip itself is
   * openable: an id this build cannot navigate to is still an id worth copying.
   *
   * Ignored in the id-only mode too, where the id is always rendered through
   * {@link CopyableId} — it is the only thing known, so it is shown rather than
   * hidden behind a control, and that already carries a copy button.
   */
  copyId?: boolean;
  /**
   * Accessible name for that copy control, e.g. `"Copy group id"`. Defaults to
   * `"Copy <type> id for <name> (<id>)"` — several of these can share a screen,
   * so the name has to say copy *what*, the way {@link CopyableId}'s required
   * `label` does. The id is folded into the default itself (not just the name)
   * because two entities can legitimately share a display name (I-009); the id
   * is guaranteed unique, so the derived default never collides even when the
   * caller does not pass this prop. In the id-only mode there is no name to
   * name, so the default is `"Copy <type> id <id>"`.
   */
  copyIdLabel?: string;
  /** Extra classes merged after the chip classes. */
  className?: string;
  /** Optional test handle. */
  testId?: string;
}

/**
 * Props for {@link EntityLink}.
 *
 * A reference carries a **name**, an **id**, or both. Omitting `name` selects the
 * id-only mode; omitting `id` selects the plain-text fallback. Both are optional
 * in the type because Storybook's `Meta`/`StoryObj` inference collapses a
 * discriminated union of props to `never`, so the invariant is stated here and
 * held at runtime rather than by the compiler: with neither, the reference
 * degrades to the stated absence with no id beside it — the honest rendering of
 * "nothing is known about this reference", never a crash.
 */
export interface EntityLinkProps extends EntityLinkBaseProps {
  /**
   * The visible name. Truncates rather than overflowing. **Omit when this view
   * loaded only the id** — never pass the id here, since an id in a name's slot
   * is indistinguishable from a resolved name (I-003).
   */
  name?: string;
  /**
   * The entity's Okta id. **Omit when the reference carries only a name**; the
   * chip then renders as plain text rather than as a control that cannot work.
   * With a `name` omitted instead, the id is what the reference is rendered from.
   */
  id?: string;
}

/** Chip and fallback share these, so a linked and an unlinked name sit on the same baseline. */
const sharedClasses = 'inline-flex max-w-full items-center gap-1 text-xs font-medium';

/**
 * The **non-answer** register, for the id-only mode: muted italic text, never a chip.
 *
 * The house convention ({@link sidepanel/components/users/comparison/AppScopeIndicator})
 * reserves chip chrome for a proven answer, so a missing name must not wear one — it
 * would carry an answer's weight while saying nothing. `text-neutral-600` is #6e6e6e:
 * 4.64:1 on `neutral-50` and 5.10:1 on white, both over the 4.5:1 AA floor. The two
 * indicators' own `text-neutral-400` measures 2.02:1 and fails; that is filed as D-108
 * and is not the precedent to copy.
 */
const nonAnswerClasses =
  'inline-flex max-w-full items-center gap-1 text-xs italic text-neutral-600';

/**
 * A reference to another entity: a chip that opens it, plain text when it cannot
 * be opened, or — with no `name` — a stated absence beside the raw id that still
 * opens the entity. Optionally accompanied by a copy control for that id.
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
 *
 * // A target group this view knows only by id — states the absence, shows the id,
 * // and still opens the group:
 * <EntityLink type="group" id={groupId} />
 * ```
 */
const EntityLink: React.FC<EntityLinkProps> = ({
  type,
  id,
  name,
  unlinkableReason,
  unresolvedLabel,
  unresolvedReason,
  copyId = false,
  copyIdLabel,
  className = '',
  testId,
}) => {
  const { navigateTo, canNavigateTo } = useEntityNavigation();
  const linkable = Boolean(id) && canNavigateTo(type);

  // An id and no name: state the absence, show the id, and still open the entity
  // when the id is navigable (I-017). Handled before the chip because the chip's
  // whole job — putting a name in front of the reader — has no input here.
  if (name === undefined) {
    const label = unresolvedLabel ?? `${capitalisedNoun(type)} name not loaded`;
    const reason =
      unresolvedReason ??
      `Only this ${typeNoun[type]}'s id was loaded into this view, so its name cannot be shown here.`;
    const glyph = <Icon type={typeIcon[type]} size="xs" className="shrink-0 text-neutral-500" />;

    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
        {linkable ? (
          <button
            type="button"
            onClick={() => navigateTo({ type, id: id as string })}
            // The visible words open the accessible name (WCAG "Label in Name"),
            // and the id follows because it is the only thing distinguishing two
            // unresolved references — there is no name to tell them apart, which
            // is the very reason D-107's argument for dropping the id from the
            // resolved chip's name does not reach this branch.
            aria-label={`${label} — open ${typeNoun[type]} ${id}`}
            title={`${reason} It can still be opened by id.`}
            data-testid={testId}
            className={`${nonAnswerClasses} rounded-sm hover:underline transition-colors duration-(--dur-instant) focus:outline-2 focus:outline-offset-2 focus:outline-primary ${className}`}
          >
            {glyph}
            <span className="truncate">{label}</span>
            <Icon type="chevron-right" size="xs" className="shrink-0 opacity-60" />
          </button>
        ) : (
          <span className={`${nonAnswerClasses} ${className}`} title={reason} data-testid={testId}>
            {glyph}
            <span className="truncate">{label}</span>
          </span>
        )}
        {id !== undefined && (
          <CopyableId value={id} label={copyIdLabel ?? `Copy ${typeNoun[type]} id ${id}`} />
        )}
      </span>
    );
  }

  const chip = linkable ? (
    <button
      type="button"
      onClick={() => navigateTo({ type, id: id as string })}
      // The visible name is contained in the accessible name (WCAG "Label in
      // Name"); the verb is what the chevron conveys visually.
      //
      // The id is folded in the same way `copyIdLabel`'s derived default
      // folds it in (I-009): two entities can legitimately share a display
      // name (this module's own header calls out the case), and the id is
      // the one part guaranteed unique even when the caller passes no
      // override at all.
      // Deliberately NOT `${name} (${id})`. Folding the id in here makes every
      // chip unique, but a screen reader then reads ~20 opaque characters on
      // every row of every list to disambiguate a collision that is usually
      // absent — a constant cost for a rare problem. The copy control below
      // keeps its id because the id is the thing that control copies. Two
      // same-named entities still sound alike when opened: see `D-107`.
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
      <CopyIconButton
        value={id}
        label={copyIdLabel ?? `Copy ${typeNoun[type]} id for ${name} (${id})`}
      />
    </span>
  );
};

export default EntityLink;
