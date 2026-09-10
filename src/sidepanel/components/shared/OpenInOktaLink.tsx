/**
 * @module sidepanel/components/shared/OpenInOktaLink
 * @description Shared "Open in Okta" deep link into the Admin Console for an entity.
 *
 * A single, consistent affordance replacing the three ad-hoc Okta links that used
 * to live in the context banner, group overview footer, and user profile card.
 * Renders nothing when the org origin (or any part of the target) is unknown, so
 * callers can drop it in unconditionally. The target is an
 * {@link module:shared/utils/oktaUrl.OktaAdminTarget}, which is what forces an
 * app link to carry the app type key its Admin Console route is built from.
 */
import React from 'react';
import Icon from '../shared/Icon';
import { oktaAdminEntityUrl, type OktaAdminTarget } from '../../../shared/utils/oktaUrl';

/** Props for {@link OpenInOktaLink}. */
interface OpenInOktaLinkProps {
  /** Okta org origin used to build the admin URL; the link hides when absent. */
  oktaOrigin?: string | null;
  /**
   * What to link to. A union rather than a `(type, id)` pair, so an app target
   * cannot be declared without the app type key its route is built from — see
   * {@link module:shared/utils/oktaUrl.OktaAdminTarget}.
   */
  target: OktaAdminTarget;
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
 * page in a new tab. Returns `null` when the target URL cannot be built — a
 * missing origin or id, or, for an app, a missing app type key.
 *
 * @example
 * ```tsx
 * <OpenInOktaLink oktaOrigin={oktaOrigin} target={{ type: 'group', id: groupId }} />
 * <OpenInOktaLink oktaOrigin={oktaOrigin} target={{ type: 'app', id: app.id, name: app.name }} />
 * ```
 */
const OpenInOktaLink: React.FC<OpenInOktaLinkProps> = ({
  oktaOrigin,
  target,
  label = 'Open in Okta',
  size = 'sm',
  className = '',
}) => {
  const href = oktaAdminEntityUrl(oktaOrigin, target);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open this ${target.type} in the Okta Admin Console`}
      className={`inline-flex items-center ${sizeClasses[size]} font-medium bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-(--dur-instant) ${className}`}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      <span>{label}</span>
      <Icon type="external-link" size="sm" />
    </a>
  );
};

export default OpenInOktaLink;
