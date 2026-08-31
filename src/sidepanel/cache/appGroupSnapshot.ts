/**
 * @module sidepanel/cache/appGroupSnapshot
 * @description Reads app→group assignments the org snapshot has already walked,
 * so a caller that needs them does not re-ask Okta for an answer sitting on disk.
 *
 * The `appGroups` collection is a fan-out: one `GET /api/v1/apps/{id}/groups`
 * per push-enabled app, refreshed every six hours (ADR-0040, `APP_GROUPS_SPEC`).
 * Its rows are keyed by the app id and the group id joined by
 * `SHARD_KEY_SEPARATOR` — the app id is composed in because Okta returns the
 * *group's* id as the assignment's id, so two apps assigning the same group
 * would otherwise collide. `splitShardedId` is the only thing that takes that
 * key apart; this module never parses it by hand.
 *
 * ## What absence means here, and what it does not
 *
 * The snapshot walks this collection **only for apps Okta flags `GROUP_PUSH`**.
 * So an app with no rows is overwhelmingly likely to be an app nobody asked
 * about — not an app with no group assignments. Treating the two the same would
 * manufacture a confident "no group grants this" out of a question never put,
 * which is exactly the defect ADR-0020 removed from the attribution paths.
 *
 * The map this returns therefore carries **only apps that actually have rows**.
 * A caller reads it as: present → these are the assignments, free; absent →
 * unknown, ask Okta as before. There is no third state and no inference.
 */

import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import { splitShardedId } from '../../shared/snapshot/types';

/**
 * The app→group assignments the snapshot currently holds for one org.
 *
 * @param origin - Org origin. A null/empty origin returns an empty map rather
 * than reading across orgs — snapshot rows are origin-scoped, and an unscoped
 * read would file one org's assignments under another's question.
 * @returns App id → assigned group ids, for apps with stored rows only. Never
 * throws; a failed read is an empty map, which degrades to asking Okta.
 */
export async function readAppGroupsFromSnapshot(
  origin: string | null | undefined,
): Promise<Map<string, string[]>> {
  const byApp = new Map<string, string[]>();
  if (!origin) return byApp;

  const records = await orgSnapshotStore.getRecords('appGroups', origin);
  for (const record of records) {
    const split = splitShardedId(record.id);
    // A row whose id does not split is not attributable to an app, so it is
    // dropped rather than filed under a guessed key.
    if (!split) continue;
    const existing = byApp.get(split.shardKey);
    if (existing) existing.push(split.entityId);
    else byApp.set(split.shardKey, [split.entityId]);
  }

  return byApp;
}
