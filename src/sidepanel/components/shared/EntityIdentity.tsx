/**
 * @module sidepanel/components/shared/EntityIdentity
 * @description Renders the fact rows of the header's expanded identity region.
 *
 * The one home for the identity-line vocabulary. It takes the `rows` of an
 * {@link sidepanel/components/shared/identityDescriptor.EntityIdentityDescriptor} — built
 * by a pure per-entity function — and renders them to the secondary-text contract in
 * `docs/design-system.md`: `text-xs text-neutral-600`, with a `metric`'s value emphasised
 * to `font-semibold text-neutral-900` so the number reads before its unit, and an `id`
 * through the shared {@link CopyableId}.
 *
 * Facts inside a row wrap together and are separated by a middot; an empty row is dropped
 * rather than rendered as blank space, which is how "Okta has not told us yet" collapses
 * out of the layout instead of showing a zero.
 *
 * It renders rows only. The entity's name, its badge and its Okta link belong to the
 * header's title row, so the tab spreads those from the same descriptor rather than
 * nesting them here — that is what keeps all three on screen when the header is pinned and
 * this region is collapsed.
 *
 * ## The `status` fact
 *
 * A calmer-than-`danger` status is demoted here rather than living in the header's trailing
 * badge column (`docs/design-system.md`'s "demoted to facts" treatment): a 6px dot in the
 * status colour, then the label at the same secondary-text weight as every other fact. Same
 * information as a badge, roughly a third of the visual weight, and — unlike a badge — it
 * cannot push the header to a third line, because it wraps with the row instead of reserving
 * a fixed trailing column.
 */
import React from 'react';
import Icon, { type IconType } from '../shared/Icon';
import CopyableId from './CopyableId';
import type { BadgeVariant } from './Badge';
import type { IdentityFact, IdentityRow } from './identityDescriptor';

/** Props for {@link EntityIdentity}. */
export interface EntityIdentityProps {
  /** The descriptor's fact rows, in render order. Renders nothing when all are empty. */
  rows: IdentityRow[];
}

/**
 * A `status` fact's dot fill per {@link BadgeVariant}. Deliberately mirrors the background
 * token {@link sidepanel/components/shared/Badge.Badge}'s solid treatment uses for the same
 * variant, rather than a fifth badge palette — this codebase already paid once for four
 * divergent copies of this exact vocabulary.
 */
const STATUS_DOT_BG: Record<BadgeVariant, string> = {
  primary: 'bg-primary',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-neutral-400',
};

/** A fact's leading glyph. Decorative — the fact's own text carries the meaning. */
const FactIcon: React.FC<{ type: IconType }> = ({ type }) => (
  <span aria-hidden="true" className="flex shrink-0 text-neutral-400">
    <Icon type={type} size="sm" />
  </span>
);

/** One fact: a count, a plain statement, a copyable id, or a demoted status. */
const Fact: React.FC<{ fact: IdentityFact }> = ({ fact }) => {
  if (fact.kind === 'id') {
    return <CopyableId value={fact.value} label={fact.copyLabel} />;
  }

  if (fact.kind === 'metric') {
    return (
      <span className="inline-flex items-center gap-1.5" title={fact.title}>
        <FactIcon type={fact.icon} />
        <span className="font-semibold text-neutral-900">{fact.value}</span>
        <span>{fact.label}</span>
      </span>
    );
  }

  if (fact.kind === 'status') {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_BG[fact.variant]}`}
        />
        {/* Okta status names are long (`PASSWORD_EXPIRED`); without `min-w-0` the
            flex item refuses to shrink and overruns the title column at 360px.
            Truncating rather than wrapping is deliberate — a status that wraps puts
            the header's height back under the entity's control, which is the whole
            thing demoting badges to facts was meant to fix. `title` keeps the full
            value reachable; assistive tech reads it regardless, since `truncate` is
            purely visual. */}
        <span className="truncate" title={fact.text}>
          {fact.text}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={fact.title}>
      {fact.icon && <FactIcon type={fact.icon} />}
      <span className="truncate">{fact.text}</span>
    </span>
  );
};

/**
 * Render the identity region's fact rows.
 *
 * @example
 * ```tsx
 * const identity = groupIdentity(group);
 * <PageHeader
 *   title={identity.name}
 *   badge={identity.badge}
 *   identityKey={identity.key}
 *   identity={<EntityIdentity rows={identity.rows} />}
 * />
 * ```
 */
const EntityIdentity: React.FC<EntityIdentityProps> = ({ rows }) => {
  const populated = rows.filter((row) => row.length > 0);
  if (populated.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {populated.map((row, rowIndex) => (
        // Rows are a fixed, builder-authored sequence with no identity of their own and no
        // reordering — the index is the stable key here.
        <div
          key={rowIndex}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600"
        >
          {row.map((fact, factIndex) => (
            // The separator is bound to the fact that follows it, in one flex item,
            // rather than sitting beside it as a sibling. A sibling separator wraps
            // independently of its fact: when the row breaks, the middot stays behind
            // and orphans at the end of the previous line with nothing after it. That
            // was visible at 480px the moment a row carried three facts.
            <span key={factIndex} className="inline-flex min-w-0 items-center gap-x-2">
              {factIndex > 0 && (
                <span aria-hidden="true" className="text-neutral-300">
                  ·
                </span>
              )}
              <Fact fact={fact} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EntityIdentity;
