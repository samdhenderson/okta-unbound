/**
 * @module sidepanel/components/shared/identityDescriptor
 * @description The descriptor a tab hands the header to describe the entity you are browsing.
 *
 * ## Why a descriptor and not JSX
 *
 * ADR-0029 settled that a shared primitive owns chrome and never the interior, so
 * {@link sidepanel/components/shared/PageHeader.PageHeader} takes its identity region as an
 * opaque `ReactNode` and must not learn what a group or a user is. But leaving each tab to
 * hand-roll that interior is how this codebase ended up with four badge palettes for one
 * vocabulary. The descriptor is the seam between those two pressures: a **pure function**
 * per entity kind turns the entity into this plain data, one shared renderer
 * ({@link sidepanel/components/shared/EntityIdentity.EntityIdentity}) turns the data into
 * markup, and the header stays chrome.
 *
 * The practical payoff: adding an entity kind is one new pure function plus one cheap unit
 * test, with no edit to anything shared — and the badge decision, the pluralisation and the
 * empty-state fallbacks are all testable without rendering anything.
 *
 * ## What the descriptor deliberately does not carry
 *
 * No `oktaOrigin`, and no resolved URL. A builder takes an entity and returns data; the
 * origin is ambient panel state the tab already holds, so the tab renders
 * {@link sidepanel/components/shared/OpenInOktaLink.OpenInOktaLink} from
 * {@link EntityIdentityDescriptor.link} itself. That is what keeps the builders pure.
 */
import type { IconType } from '../overview/shared/Icon';
import type { OktaAdminEntityType } from '../../../shared/utils/oktaUrl';
import type { BadgeVariant } from './Badge';

/**
 * One metadata line in the header's expanded region.
 *
 * Only the two kinds the header actually shows today. A copyable-id line and a
 * free-form description line were both considered and left out: the id is already in the
 * context bar, and the group description now lives in `GroupMetadataSection`. Adding either
 * is a new member here plus a branch in `EntityIdentity` — deliberately not pre-built.
 */
export type IdentityLine =
  /** A counted fact: `1,284 members`. The value is emphasised, the label is not. */
  | { kind: 'metric'; icon: IconType; value: string; label: string }
  /** A plain fact: `Sourced from Workday`. */
  | { kind: 'text'; icon?: IconType; text: string };

/**
 * Everything the header needs to describe one entity.
 *
 * `name`, `badge` and `link` are consumed by the *tab*, which spreads them onto
 * `PageHeader`'s existing `title` / `badge` / `actions` props — they live here anyway so
 * that the builder remains the single place those decisions are made. Only
 * {@link EntityIdentityDescriptor.lines} is rendered by `EntityIdentity`.
 */
export interface EntityIdentityDescriptor {
  /**
   * Stable identity of the described entity — normally its Okta id. Drives the header's
   * crossfade: a changed key means a different entity and animates, an unchanged key means
   * the same entity's data refreshed and swaps silently.
   */
  key: string;
  /** The entity's display name, for the header's `<h1>`. */
  name: string;
  /** The title-row mark: group type, or user status. */
  badge?: { text: string; variant?: BadgeVariant };
  /** Metadata lines for the expanded region, in render order. May be empty. */
  lines: IdentityLine[];
  /** Admin Console deep-link target, when the entity kind supports one. */
  link?: { entityType: OktaAdminEntityType; entityId: string };
}
