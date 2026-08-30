/**
 * @module sidepanel/components/groups/detail/GroupMetadataSection
 * @description The group's own reference facts: description, id, and Okta's timestamps.
 *
 * It renders only fields Okta actually returns: the description, the group id
 * (copyable, since it is what every API call and rule condition keys off),
 * `created`, `lastUpdated`, and `lastMembershipUpdated`. A missing timestamp
 * renders as "Not reported by Okta" rather than a placeholder date.
 *
 * The description moved here when the page header took over the group's identity: the
 * header's expanded region carries the facts you navigate by — name, type, member count —
 * and a description is reference material, not a wayfinding aid. It is not dropped, since
 * nothing else in the app renders it.
 *
 * This module used to say: *"There is deliberately no 'last membership change'
 * field: Okta exposes none, and the one that used to be rendered here was always
 * `undefined` outside fixtures."* Both halves were wrong, and the second caused
 * the first. Okta returns `lastMembershipUpdated` on **every** group — on the
 * `/api/v1/groups` LIST response, not merely the single-group GET. The reason it
 * arrived `undefined` is that `oktaGroupSchema` stripped it at the boundary and
 * neither group mapper carried it, so an app-side bug was written down here as an
 * Okta limitation and the field was removed rather than fixed.
 *
 * Recording it because the failure mode generalises: a field that is always empty
 * is evidence about *our* parsing until the boundary has been checked, and a
 * stripping zod object gives no signal at all when it discards something.
 *
 * Body-only: it answers the rarest questions of the four Group Detail tabs, so its
 * one caller, {@link module:sidepanel/components/groups/detail/GroupInsightsPane},
 * folds this component's *content* into a `CollapsibleSection` titled "About this
 * group" (default closed) rather than its own always-visible card — this component
 * carries no section chrome of its own so it nests there cleanly.
 */
import React from 'react';
import { CopyButton } from '../../shared';
import { formatDate } from '../../../../shared/utils/dateFormat';

/** Props for {@link GroupMetadataSection}. */
interface GroupMetadataSectionProps {
  /** The group's Okta id. */
  groupId: string;
  /** The group's Okta description, if it has one. */
  description?: string;
  /** When Okta created the group, if the payload carried it. */
  created?: Date;
  /** When Okta last updated the group *profile*, if the payload carried it. */
  lastUpdated?: Date;
  /**
   * When the group's *membership* last changed, if the payload carried it.
   *
   * Absent on a snapshot synced before this field was parsed — it fills in on the
   * next walk — so "Not reported by Okta" here means "not stored yet" as often as
   * it means Okta omitted it.
   */
  lastMembershipUpdated?: Date;
}

/** One label-above-value field. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-medium text-neutral-600">{label}</div>
    <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
  </div>
);

/** Renders the group's description and id plus its Okta-reported timestamps. */
const GroupMetadataSection: React.FC<GroupMetadataSectionProps> = ({
  groupId,
  description,
  created,
  lastUpdated,
  lastMembershipUpdated,
}) => (
  <div className="space-y-3">
    <Field label="Description">
      {description?.trim() ? (
        description
      ) : (
        <span className="text-neutral-500 italic">No description in Okta.</span>
      )}
    </Field>

    <Field label="Group ID">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-900">
          {groupId}
        </code>
        <CopyButton label="Copy ID" getText={() => groupId} />
      </div>
    </Field>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Created">
        {created ? (
          formatDate(created)
        ) : (
          <span className="text-neutral-500 italic">Not reported by Okta</span>
        )}
      </Field>
      <Field label="Profile updated">
        {lastUpdated ? (
          formatDate(lastUpdated)
        ) : (
          <span className="text-neutral-500 italic">Not reported by Okta</span>
        )}
      </Field>
      <Field label="Membership changed">
        {lastMembershipUpdated ? (
          formatDate(lastMembershipUpdated)
        ) : (
          <span className="text-neutral-500 italic">Not reported by Okta</span>
        )}
      </Field>
    </div>
  </div>
);

export default GroupMetadataSection;
