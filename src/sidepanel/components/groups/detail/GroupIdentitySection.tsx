/**
 * @module sidepanel/components/groups/detail/GroupIdentitySection
 * @description Identity card of the Group Detail view — type, description, and the Okta deep link.
 *
 * The first section because it settles the most common question ("is this the
 * group I meant?") before any async data arrives. Renders synchronously from the
 * already-loaded {@link GroupSummary}; nothing here fetches.
 */
import React from 'react';
import { OpenInOktaLink } from '../../shared';
import Icon from '../../overview/shared/Icon';
import type { GroupSummary, GroupType } from '../../../../shared/types';

/** Label + token classes for each Okta group type. */
const typeBadges: Record<GroupType, { label: string; classes: string }> = {
  OKTA_GROUP: {
    label: 'Okta group',
    classes: 'bg-primary-light text-primary-text border-primary-highlight',
  },
  APP_GROUP: {
    label: 'App group',
    classes: 'bg-warning-light text-warning-text border-warning-light',
  },
  BUILT_IN: {
    label: 'Built-in',
    classes: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  },
};

/** Props for {@link GroupIdentitySection}. */
interface GroupIdentitySectionProps {
  /** The group being shown. */
  group: GroupSummary;
  /** Okta org origin; the "Open in Okta" link hides when absent. */
  oktaOrigin?: string;
}

/**
 * Renders the group's name, type, source app (for an app-sourced group),
 * description and member count, plus the Admin Console deep link.
 */
const GroupIdentitySection: React.FC<GroupIdentitySectionProps> = ({ group, oktaOrigin }) => {
  const badge = typeBadges[group.type] ?? typeBadges.BUILT_IN;

  return (
    <section
      aria-label="Group identity"
      className="rounded-md border border-neutral-200 bg-white px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="text-base font-semibold text-neutral-900 break-words"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {group.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${badge.classes}`}>
              {badge.label}
            </span>
            {group.type === 'APP_GROUP' && group.sourceAppName && (
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium border bg-neutral-50 text-neutral-700 border-neutral-200"
                title="Application this group is sourced from"
              >
                Sourced from {group.sourceAppName}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="group" entityId={group.id} />
        </div>
      </div>

      <p className="mt-3 text-sm text-neutral-700">
        {group.description?.trim() ? (
          group.description
        ) : (
          <span className="text-neutral-500 italic">No description in Okta.</span>
        )}
      </p>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-600">
        <span aria-hidden="true" className="flex text-neutral-400">
          <Icon type="users" size="sm" />
        </span>
        <span className="font-semibold text-neutral-900">{group.memberCount.toLocaleString()}</span>
        <span>member{group.memberCount === 1 ? '' : 's'}</span>
      </p>
    </section>
  );
};

export default GroupIdentitySection;
