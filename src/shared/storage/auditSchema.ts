/**
 * @module shared/storage/auditSchema
 * @description Zod schema for an audit-trail row as read back out of IndexedDB.
 *
 * ADR-0006 validates *Okta* responses at the content-script boundary because
 * they are attacker-controllable. IndexedDB read-back is a different boundary
 * but the same failure mode one storage layer down (`D-043`): the database is
 * plaintext, long-lived, and readable/writable by anyone with devtools, and a
 * row can also predate the current shape — `D-032` already documented rows
 * written before `actorResolution` existed. Nothing stopped a row whose
 * `actorResolution` (or any other field) had been altered to a value that
 * merely *types* as correct from reaching a caller that branches on it.
 *
 * **Drop vs. degrade, decided per field, not for the row as a whole:**
 *
 * - `actorResolution` is the one field the type already models as legacy-absent
 *   (`PersistedAuditLogEntry.actorResolution?`). A row carrying a garbage value
 *   there degrades that single field to `undefined` — the same "attribution
 *   unknown" state a genuinely pre-`D-013a` row reports — rather than losing an
 *   otherwise-intact audit entry over one cosmetic field. Inventing a
 *   replacement value (coercing to `'resolved'` or `'unavailable'`) would
 *   attach a claim nobody made, which is exactly what `D-032` ruled out.
 * - Every other field is required by {@link PersistedAuditLogEntry} and feeds
 *   either display (`groupName`, `performedBy`) or arithmetic a caller trusts
 *   (`details.apiRequestCount` summed in `getStats`, `affectedUsers.length`,
 *   sorting by `timestamp`). A row that fails validation on any of these is not
 *   safely presentable evidence — showing a wrong count or an unparsable date
 *   is worse than omitting the row — so the **whole row is dropped**. Dropping
 *   evidence from an audit log is itself a problem, so a drop is never silent:
 *   {@link parsePersistedAuditRows} logs a single counts-only warning (never the
 *   row, never a field value — audit rows carry actor emails and entity names).
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';
import type { PersistedAuditLogEntry } from '../types';

const log = createLogger('AuditSchema');

/** Mirrors {@link AuditLogEntry.action}'s closed union. */
const auditActionSchema = z.enum([
  'remove_users',
  'add_users',
  'export',
  'activate_rule',
  'deactivate_rule',
]);

/** Mirrors {@link AuditLogEntry.result}'s closed union. */
const auditResultSchema = z.enum(['success', 'partial', 'failed']);

/** Mirrors {@link ActorResolution}. Applied leniently below via `.catch()`. */
const actorResolutionSchema = z.enum(['resolved', 'unavailable']);

/**
 * A `Date` value that is actually a valid instant. `getHistory` sorts and
 * range-filters on this field, so a value that survived as something other
 * than a real `Date` (or as an Invalid Date, e.g. `new Date('garbage')`) is
 * rejected here rather than silently sorting first/last.
 */
const timestampSchema = z
  .date()
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'invalid timestamp' });

/** Mirrors {@link AuditLogEntry.details}. */
const auditDetailsSchema = z.object({
  usersSucceeded: z.number(),
  usersFailed: z.number(),
  apiRequestCount: z.number(),
  durationMs: z.number(),
  errorMessages: z.array(z.string()).optional(),
});

/**
 * The row shape {@link auditStore.getHistory} and {@link auditStore.getStats}
 * trust back out of the `operations` store. See the module doc for the
 * drop-vs-degrade split between `actorResolution` and everything else.
 */
export const persistedAuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: timestampSchema,
  action: auditActionSchema,
  groupId: z.string(),
  groupName: z.string(),
  performedBy: z.string().nullable(),
  actorResolution: actorResolutionSchema.optional().catch(undefined),
  affectedUsers: z.array(z.string()),
  result: auditResultSchema,
  details: auditDetailsSchema,
});

/**
 * Validate an array of raw rows read out of the audit `operations` store,
 * dropping (never throwing on) a row that fails validation.
 *
 * @param rows - The raw array `idb` returned (`db.getAll` / `db.getAllFromIndex`).
 * @param context - Human-readable label for the log line (e.g. `'getHistory'`).
 * @returns The rows that validated, in their original order. Never throws.
 * @remarks On a drop, logs one counts-only warning (`{ context, dropped, total }`)
 * — never the offending row or any field value, since audit rows carry actor
 * emails and entity names (PII).
 */
export function parsePersistedAuditRows(
  rows: unknown[],
  context: string,
): PersistedAuditLogEntry[] {
  const valid: PersistedAuditLogEntry[] = [];
  let dropped = 0;

  for (const row of rows) {
    const result = persistedAuditLogEntrySchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    log.warn('Dropped malformed audit rows on read', { context, dropped, total: rows.length });
  }

  return valid;
}
