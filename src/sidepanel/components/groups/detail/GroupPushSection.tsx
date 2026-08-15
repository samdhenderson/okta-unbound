/**
 * @module sidepanel/components/groups/detail/GroupPushSection
 * @description Apps this group is pushed to, and the target group each push writes into.
 *
 * Deliberately carries **no activation status**. `GET /api/v1/apps/{appId}/groups`
 * returns none, so an ACTIVE/INACTIVE pill here would be an inference dressed up
 * as an Okta fact. `priority` is the real returned field and is labelled as a
 * priority, never as a state.
 *
 * Distinguishes "not pushed anywhere" (an empty array — a loaded fact) from "push
 * mappings were never loaded" (`undefined` — the group load's push enrichment is
 * non-fatal and can be skipped), so an unknown is never rendered as a zero.
 */
import React from 'react';
import { DetailSection } from '../../shared';
import type { PushGroupMapping } from '../../../../shared/types';

/** Props for {@link GroupPushSection}. */
interface GroupPushSectionProps {
  /**
   * The group's push mappings. `undefined` means the enrichment did not run for
   * this group and is rendered as unknown, not as "none".
   */
  mappings?: PushGroupMapping[];
}

/**
 * Renders one row per push mapping: the target app, the group it writes into, and
 * Okta's assignment priority where present.
 */
const GroupPushSection: React.FC<GroupPushSectionProps> = ({ mappings }) => (
  <DetailSection
    title="App push"
    description="Applications this group's membership is pushed out to."
  >
    {mappings === undefined ? (
      <p className="text-sm text-neutral-500">
        Push mappings were not loaded for this group — reload the groups list to check.
      </p>
    ) : mappings.length === 0 ? (
      <p className="text-sm text-neutral-500">Not pushed to any application.</p>
    ) : (
      <ul className="space-y-1.5">
        {mappings.map((mapping) => (
          <li
            key={mapping.mappingId}
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm text-neutral-900">
                {mapping.appName || mapping.appId}
              </span>
              {mapping.targetGroupName && (
                <span className="mt-0.5 truncate text-xs text-neutral-500">
                  Target group: {mapping.targetGroupName}
                </span>
              )}
            </span>
            {mapping.priority !== undefined && (
              <span
                className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600"
                title="Okta assignment priority — not an activation status"
              >
                Priority {mapping.priority}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </DetailSection>
);

export default GroupPushSection;
