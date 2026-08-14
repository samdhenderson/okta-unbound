/**
 * @module sidepanel/components/groups/detail/GroupMetadataSection
 * @description Group id and Okta's own timestamps — real fields only.
 *
 * Last of the sections because it answers the rarest question. It renders exactly
 * three facts Okta actually returns: the group id (copyable, since it is what
 * every API call and rule condition keys off), `created`, and `lastUpdated`. A
 * missing timestamp renders as "Not reported by Okta" rather than a placeholder
 * date.
 *
 * There is deliberately no "last membership change" field: Okta exposes none, and
 * the one that used to be rendered here was always `undefined` outside fixtures.
 */
import React from 'react';
import { CopyButton, DetailSection } from '../../shared';
import { formatDate } from '../../../../shared/utils/dateFormat';

/** Props for {@link GroupMetadataSection}. */
interface GroupMetadataSectionProps {
  /** The group's Okta id. */
  groupId: string;
  /** When Okta created the group, if the payload carried it. */
  created?: Date;
  /** When Okta last updated the group *profile*, if the payload carried it. */
  lastUpdated?: Date;
}

/** One label-above-value field. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-medium text-neutral-600">{label}</div>
    <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
  </div>
);

/** Renders the group's id plus its Okta-reported created/last-updated timestamps. */
const GroupMetadataSection: React.FC<GroupMetadataSectionProps> = ({
  groupId,
  created,
  lastUpdated,
}) => (
  <DetailSection title="Metadata">
    <div className="space-y-3">
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
        <Field label="Last updated">
          {lastUpdated ? (
            formatDate(lastUpdated)
          ) : (
            <span className="text-neutral-500 italic">Not reported by Okta</span>
          )}
        </Field>
      </div>
    </div>
  </DetailSection>
);

export default GroupMetadataSection;
