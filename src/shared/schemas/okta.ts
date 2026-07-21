/**
 * Zod schemas for Okta API responses (ADR-0006).
 *
 * These validate untrusted JSON at the content-script fetch boundary, so a shape
 * change from Okta surfaces as a clear, localized error instead of a mystery crash
 * far away. Prefer the `z.infer` types over hand-written `any`-laden interfaces.
 *
 * This is the seed of the boundary-validation rollout — hot paths (user, group,
 * membership) first, then broaden. Add new response schemas here.
 *
 * @module schemas/okta
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';

const log = createLogger('Schema');

/** Enum of valid Okta account lifecycle statuses. */
export const userStatusSchema = z.enum([
  'ACTIVE',
  'DEPROVISIONED',
  'SUSPENDED',
  'STAGED',
  'PROVISIONED',
  'RECOVERY',
  'LOCKED_OUT',
  'PASSWORD_EXPIRED',
]);

/**
 * A user's profile. Known fields are typed; unknown extra attributes are allowed
 * (Okta profiles are org-extensible) via `.passthrough()`.
 */
export const oktaProfileSchema = z
  .object({
    login: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    secondEmail: z.string().optional(),
    // Okta may return `null`; normalize to `undefined` to match the `OktaUser` domain type.
    mobilePhone: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    department: z.string().optional(),
    title: z.string().optional(),
    manager: z.string().optional(),
    managerId: z.string().optional(),
  })
  .passthrough();

/** A user from `GET /api/v1/users/{id}` — identity, status, and profile. */
export const oktaUserSchema = z.object({
  id: z.string(),
  status: userStatusSchema,
  created: z.string().optional(),
  activated: z.string().optional(),
  statusChanged: z.string().optional(),
  lastLogin: z.string().nullish(),
  lastUpdated: z.string().optional(),
  passwordChanged: z.string().nullish(),
  managedBy: z
    .object({
      rules: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    })
    .optional(),
  profile: oktaProfileSchema,
});

/** A group as returned by GET /api/v1/groups/{id}. */
export const oktaGroupSchema = z.object({
  id: z.string(),
  profile: z.object({
    name: z.string(),
    description: z.string().nullish(),
  }),
});

/**
 * A group rule as returned by `POST`/`GET /api/v1/groups/rules`. Only the fields
 * the consolidation flow relies on are typed; org-specific extras pass through.
 */
export const oktaGroupRuleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    type: z.string().optional(),
    conditions: z
      .object({
        expression: z.object({ value: z.string(), type: z.string() }).partial().optional(),
        people: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    actions: z
      .object({
        assignUserToGroups: z.object({ groupIds: z.array(z.string()) }).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Source classification for a group, mirroring the `GroupType` domain union. */
export const groupTypeSchema = z.enum(['OKTA_GROUP', 'APP_GROUP', 'BUILT_IN']);

/**
 * A user as it appears in a *list* response (search results, group membership).
 *
 * Identical to {@link oktaUserSchema} but `.passthrough()` at the top level, so
 * endpoint- or org-specific extras (`_links`, `credentials`, …) survive
 * validation instead of being silently stripped. Use with {@link parseOktaList}.
 */
export const oktaUserListItemSchema = oktaUserSchema.passthrough();

/**
 * A group as it appears in a *list* response (search results, membership).
 *
 * Deliberately lenient so a real list row is (almost) never dropped: only `id`
 * is required; `type` and `profile` are optional. Crucially it `.passthrough()`es
 * unknown fields, so `type`, `_embedded` member counts, `lastUpdated`, etc. are
 * *preserved* rather than silently stripped — the exact `APP_GROUP`→`DIRECT`
 * corruption ADR-0006 warned against. `description` is normalized `null →
 * undefined` to match the `OktaGroup` domain type. Use with {@link parseOktaList}.
 */
export const oktaGroupListItemSchema = z
  .object({
    id: z.string(),
    type: groupTypeSchema.optional(),
    profile: z
      .object({
        name: z.string(),
        description: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * An app as it appears in a *list* response (`GET /api/v1/apps`).
 *
 * Deliberately lenient — only `id` is required; identity fields are optional and
 * unknown fields `.passthrough()` (org/app-specific settings, `_links`, etc.).
 * Shared by the app search op and the Apps export descriptor. Use with
 * {@link parseOktaList}.
 */
export const oktaAppListItemSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    label: z.string().optional(),
    status: z.string().optional(),
    signOnMode: z.string().optional(),
    created: z.string().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaAppListItemSchema} row. */
export type OktaAppListItem = z.infer<typeof oktaAppListItemSchema>;

/** Inferred type of a validated {@link oktaUserSchema} response. */
export type OktaUserResponse = z.infer<typeof oktaUserSchema>;
/** Inferred type of a validated {@link oktaGroupSchema} response. */
export type OktaGroupResponse = z.infer<typeof oktaGroupSchema>;
/** Inferred type of a validated {@link oktaGroupRuleSchema} response. */
export type OktaGroupRuleResponse = z.infer<typeof oktaGroupRuleSchema>;
/** Inferred type of a validated {@link oktaUserListItemSchema} row. */
export type OktaUserListItem = z.infer<typeof oktaUserListItemSchema>;
/** Inferred type of a validated {@link oktaGroupListItemSchema} row. */
export type OktaGroupListItem = z.infer<typeof oktaGroupListItemSchema>;

/**
 * Parse an Okta response with a schema, throwing a descriptive error on mismatch.
 * Use at the content-script boundary immediately after `response.json()`.
 *
 * @example
 * const user = parseOkta(oktaUserSchema, await res.json(), 'GET /users/{id}');
 */
export function parseOkta<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Log only issue paths + codes — never zod's default message, which echoes the
    // received values and would leak PII (identifiers and outcomes only).
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
    }));
    throw new Error(`Okta response validation failed (${context}): ${JSON.stringify(issues)}`);
  }
  return result.data;
}

/**
 * Parse an Okta *list* response leniently: validate each item, keep the valid
 * ones, and drop (never throw on) the malformed ones. These are the highest-traffic
 * paths (search / list / membership), where a single malformed row must not break
 * the entire result — so this **degrades** instead of failing closed.
 *
 * Behavior:
 * - If `data` is not an array, log a warning (path/code style, no values) and
 *   return `[]`.
 * - Otherwise validate every item with `itemSchema.safeParse`, collecting the
 *   valid rows. If any were dropped, log a single warning carrying only
 *   `{ context, dropped, total }` — never field values or PII.
 *
 * @param itemSchema - Schema applied to each element (e.g. {@link oktaUserListItemSchema}).
 * @param data - The raw `response.data` from the content-script fetch boundary.
 * @param context - Human-readable request label for logs (e.g. `GET /api/v1/users?q`).
 * @returns The array of validated items (possibly empty). Never throws.
 *
 * @example
 * const users = parseOktaList(oktaUserListItemSchema, response.data, 'GET /users?q');
 */
export function parseOktaList<S extends z.ZodTypeAny>(
  itemSchema: S,
  data: unknown,
  context: string,
): z.infer<S>[] {
  if (!Array.isArray(data)) {
    // Path/code style, no values: the payload's contents are never logged.
    log.warn('Okta list response was not an array', { context, code: 'not_an_array' });
    return [];
  }

  const valid: z.infer<S>[] = [];
  let dropped = 0;
  for (const item of data) {
    const result = itemSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      // Count only — never log the offending item or its issues (may carry PII).
      dropped += 1;
    }
  }

  if (dropped > 0) {
    // One warning per call, counts only — no field values / PII.
    log.warn('Dropped malformed items from Okta list response', {
      context,
      dropped,
      total: data.length,
    });
  }

  return valid;
}
