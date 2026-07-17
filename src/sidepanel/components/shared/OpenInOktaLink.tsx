/**
 * @module sidepanel/components/shared/OpenInOktaLink
 * @description Shared "Open in Okta" deep link into the Admin Console for an entity.
 *
 * A single, consistent affordance replacing the three ad-hoc Okta links that used
 * to live in the context banner, group overview footer, and user profile card.
 * Renders nothing when the org origin (or id) is unknown, so callers can drop it
 * in unconditionally.
 */
import React from 'react';
import Icon from '../overview/shared/Icon';
import { oktaAdminEntityUrl, type OktaAdminEntityType } from '../../../shared/utils/oktaUrl';

/** Props for {@link OpenInOktaLink}. */
interface OpenInOktaLinkProps {
  /** Okta org origin used to build the admin URL; the link hides when absent. */
  oktaOrigin?: string | null;
  /** Which kind of entity to deep-link to. */
  entityType: OktaAdminEntityType;
  /** The entity's Okta id; the link hides when absent. */
  entityId: string | null | undefined;
  /** Link text. Defaults to `Open in Okta`. */
  label?: string;
  /** Compact (`sm`) or standard (`md`) sizing. Defaults to `sm`. */
  size?: 'sm' | 'md';
  /** Extra classes merged onto the anchor. */
  className?: string;
}

const sizeClasses: Record<'sm' | 'md', string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3 py-1.5 text-sm gap-2',
};

/**
 * Renders a bordered "Open in Okta" link that opens the entity's Admin Console
 * page in a new tab. Returns `null` when the target URL cannot be built (missing
 * origin or id).
 *
 * @example
 * ```tsx
 * <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="group" entityId={groupId} />
 * ```
 */
const OpenInOktaLink: React.FC<OpenInOktaLinkProps> = ({
  oktaOrigin,
  entityType,
  entityId,
  label = 'Open in Okta',
  size = 'sm',
  className = '',
}) => {
  const href = oktaAdminEntityUrl(oktaOrigin, entityType, entityId);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open this ${entityType} in the Okta Admin Console`}
      className={`inline-flex items-center ${sizeClasses[size]} font-medium bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-100 ${className}`}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      <span>{label}</span>
      <Icon type="external-link" size="sm" />
    </a>
  );
};

export default OpenInOktaLink;
