/**
 * @module sidepanel/components/shared/EntityIdentity
 * @description Renders the metadata lines of the header's expanded identity region.
 *
 * The one home for the identity-line vocabulary. It takes the `lines` of an
 * {@link sidepanel/components/shared/identityDescriptor.EntityIdentityDescriptor} — built by a
 * pure per-entity function — and renders them to the secondary-text contract in
 * `docs/design-system.md`: `text-xs text-neutral-600`, with a `metric`'s value emphasised to
 * `font-semibold text-neutral-900` so the number reads before its unit.
 *
 * It renders lines only. The entity's name and badge belong to the header's title row and
 * its Okta link to the header's actions slot, so the tab spreads those from the same
 * descriptor rather than nesting them here — that is what keeps a pinned, collapsed header
 * still showing the name, the badge and the link.
 */
import React from 'react';
import Icon from '../overview/shared/Icon';
import type { IdentityLine } from './identityDescriptor';

/** Props for {@link EntityIdentity}. */
export interface EntityIdentityProps {
  /** The descriptor's metadata lines, in render order. Renders nothing when empty. */
  lines: IdentityLine[];
}

/**
 * Render the identity region's metadata lines.
 *
 * @example
 * ```tsx
 * const identity = groupIdentity(group);
 * <PageHeader
 *   title={identity.name}
 *   badge={identity.badge}
 *   identityKey={identity.key}
 *   identity={<EntityIdentity lines={identity.lines} />}
 * />
 * ```
 */
const EntityIdentity: React.FC<EntityIdentityProps> = ({ lines }) => {
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, index) => (
        <p
          // Lines are a fixed, builder-authored sequence with no identity of their own and
          // no reordering — the index is the stable key here.
          key={index}
          className="flex items-center gap-1.5 text-xs text-neutral-600"
        >
          {line.kind === 'metric' ? (
            <>
              <span aria-hidden="true" className="flex text-neutral-400">
                <Icon type={line.icon} size="sm" />
              </span>
              <span className="font-semibold text-neutral-900">{line.value}</span>
              <span>{line.label}</span>
            </>
          ) : (
            <>
              {line.icon && (
                <span aria-hidden="true" className="flex text-neutral-400">
                  <Icon type={line.icon} size="sm" />
                </span>
              )}
              <span className="truncate">{line.text}</span>
            </>
          )}
        </p>
      ))}
    </div>
  );
};

export default EntityIdentity;
