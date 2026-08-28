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
 * ## Absent is not zero
 *
 * A builder **omits** a fact it cannot answer yet rather than emitting a zero. Okta reports
 * a group's `usedInRuleCount` only once the rules payload has loaded, and a user's
 * `managedBy.rules` only when the membership analysis has run; rendering "0 references" in
 * the meantime would state as fact something the panel has not asked. An empty row is
 * dropped entirely, so the region shrinks to what is actually known.
 *
 * ## What the descriptor deliberately does not carry
 *
 * No `oktaOrigin`, and no resolved URL. A builder takes an entity and returns data; the
 * origin is ambient panel state the tab already holds, so the tab renders
 * {@link sidepanel/components/shared/OpenInOktaLink.OpenInOktaLink} from
 * {@link EntityIdentityDescriptor.link} itself. That is what keeps the builders pure.
 */
import type { IconType } from '../shared/Icon';
import type { OktaAdminEntityType } from '../../../shared/utils/oktaUrl';
import type { BadgeVariant } from './Badge';

/** One fact in the header's expanded region. */
export type IdentityFact =
  /** A counted fact: `1,284 members`. The value is emphasised, the label is not. */
  | { kind: 'metric'; icon: IconType; value: string; label: string; title?: string }
  /** A plain fact: `Created 12 Mar 2021`. */
  | { kind: 'text'; icon?: IconType; text: string; title?: string }
  /** The entity's Okta id, rendered with an inline copy control. */
  | { kind: 'id'; value: string; copyLabel: string };

/**
 * Facts that share one line, separated by a middot and wrapping together.
 *
 * Grouping is the builder's call, and it is a layout decision with a reason: in a 360px
 * panel one fact per line would push the whole page down, while packing unrelated facts
 * onto one line makes them read as a single sentence. The convention is one row per
 * category — identity, counts, timestamps.
 */
export type IdentityRow = IdentityFact[];

/**
 * Everything the header needs to describe one entity.
 *
 * `name`, `badge` and `link` are consumed by the *tab*, which spreads them onto
 * `PageHeader`'s existing `title` / `badge` / `actions` props — they live here anyway so
 * that the builder remains the single place those decisions are made, and so that all
 * three stay on screen when the region collapses under a pinned header. Only
 * {@link EntityIdentityDescriptor.rows} is rendered by `EntityIdentity`.
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
  /** The trailing mark beside the Okta link: group type, or user status. */
  badge?: { text: string; variant?: BadgeVariant };
  /** Rows of facts for the expanded region, in render order. Empty rows are dropped. */
  rows: IdentityRow[];
  /** Admin Console deep-link target, when the entity kind supports one. */
  link?: { entityType: OktaAdminEntityType; entityId: string };
}
