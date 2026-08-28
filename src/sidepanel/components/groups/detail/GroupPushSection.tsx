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
 *
 * The same discipline applies one level down, to the app itself. `appName` is
 * optional, and this section used to fall back to printing `appId` in the name's
 * own slot — an opaque `0oa…` that read as though it *were* the app's name. A
 * named app is now the shared `EntityLink` (opens the app, copies its id); an
 * un-named one says its name is missing, beside the raw id in the identifier
 * register (I-003). Neither path fetches anything to close the gap.
 */
import React from 'react';
import { CopyableId, DetailSection, EntityLink } from '../../shared';
import Icon from '../../shared/Icon';
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
 * A push target this section knows only by id.
 *
 * Deliberately not an `EntityLink`: that chip needs a name, and passing the id in
 * as the name is the defect being fixed. The absence is stated in the muted-italic
 * non-answer register, and the id goes through `CopyableId` so it reads as an
 * identifier and can be pasted into a search.
 *
 * Sized `text-xs` to match `EntityLink`, which is what the named row in this same
 * list renders as. The field was `text-sm` before this fix, and keeping that here
 * would have put a named and an un-named mapping in the same slot a type size
 * apart — the row-inconsistency `docs/design-system.md` calls out by name.
 */
const UnnamedPushApp: React.FC<{
  /** The Okta app id the mapping pushes into. */
  appId: string;
}> = ({ appId }) => (
  <span
    className="inline-flex max-w-full items-center gap-1 text-xs"
    title="Okta returned no name for this application, so only its id is known here."
  >
    <Icon type="app" size="xs" className="shrink-0 text-neutral-500" />
    <span className="shrink-0 italic text-neutral-600">App name not loaded</span>
    <CopyableId value={appId} label={`Copy application id ${appId}`} />
  </span>
);

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
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-(--sp-row-x) py-(--sp-row-y)"
          >
            <span className="flex min-w-0 flex-col items-start">
              {mapping.appName ? (
                <EntityLink
                  type="app"
                  id={mapping.appId}
                  name={mapping.appName}
                  copyId
                  // Several mappings can share a screen and two apps can share a
                  // label, so the copy control names the id, not the app (I-009).
                  copyIdLabel={`Copy application id ${mapping.appId}`}
                />
              ) : (
                <UnnamedPushApp appId={mapping.appId} />
              )}
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
