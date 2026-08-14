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
    // Declared as `z.unknown()` (the same choice as `oktaGroupRuleSchema` below)
    // because the link set varies per app and per endpoint, and none of it is
    // contractually stable. It survived `.passthrough()` already; naming it here
    // only makes it reachable from TypeScript, so the app Overview can derive an
    // attached access-policy id from a record it already holds instead of issuing a
    // second `GET /api/v1/apps/{id}`. Readers must validate what they pull out of it
    // — see `extractAccessPolicyId`.
    _links: z.unknown().optional(),
    // Declared as `z.unknown()` for the same reason as `_links` above: what Okta
    // embeds here depends entirely on the request's `expand` parameter (this list
    // endpoint is also read with no `expand` at all), so no shape here is
    // contractually stable. It survived `.passthrough()` already; naming it only
    // makes it reachable from TypeScript, so `getUserApps` can read the app-user
    // `scope` Okta embeds under `expand=user/{userId}` off a row it already holds
    // instead of issuing a second request per app.
    //
    // `z.unknown()` — never a `z.object` — is load-bearing here: `parseOktaList`
    // DROPS a row that fails validation (ADR-0006, "degrade, never crash"), so a
    // stricter `_embedded` would make a malformed embed silently remove an app
    // from a user's list, under-reporting access. A missing badge is cheap; a
    // missing app is not. Readers must validate what they pull out of it — see
    // {@link extractAppAssignmentScope}.
    _embedded: z.unknown().optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaAppListItemSchema} row. */
export type OktaAppListItem = z.infer<typeof oktaAppListItemSchema>;

/**
 * A group assignment as it appears in `GET /api/v1/apps/{appId}/groups`.
 *
 * Deliberately lenient, following the {@link oktaAppListItemSchema} precedent:
 * only `id` (the assigned group's id) is required. The push-mapping fields the
 * UI reads — `priority`, the `profile` name variants, and the `_links.group`
 * href — are optional, and unknown fields `.passthrough()`. Use with
 * {@link parseOktaList}.
 */
export const oktaAppGroupAssignmentSchema = z
  .object({
    id: z.string(),
    priority: z.number().optional(),
    profile: z
      .object({
        name: z.string().optional(),
        groupName: z.string().optional(),
      })
      .passthrough()
      .nullish(),
    _links: z
      .object({
        group: z.object({ href: z.string().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaAppGroupAssignmentSchema} row. */
export type OktaAppGroupAssignment = z.infer<typeof oktaAppGroupAssignmentSchema>;

/**
 * A user's assignment to an application, as returned by
 * `GET /api/v1/apps/{appId}/users`.
 *
 * Deliberately lenient, following the {@link oktaAppListItemSchema} precedent:
 * only `id` is required; the assignment lifecycle fields (`status`, `scope`,
 * `syncState`, dates) and the embedded `credentials.userName` are optional, and
 * unknown fields `.passthrough()` so org-specific credential/profile extras
 * survive validation. Shared with the App Users export descriptor. Use with
 * {@link parseOktaList}.
 */
export const oktaAppUserSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    scope: z.string().optional(),
    syncState: z.string().optional(),
    created: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    credentials: z.object({ userName: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaAppUserSchema} row. */
export type OktaAppUser = z.infer<typeof oktaAppUserSchema>;

/**
 * How Okta reports the origin of an app assignment on an app-user object.
 *
 * - `'USER'` — the user **has a direct assignment** to the app.
 * - `'GROUP'` — the assignment reaching this user comes from a group.
 *
 * IMPORTANT — this is not an exclusive classification. Okta reports a **single**
 * `scope` per app-user: a user who is both directly assigned *and* a member of an
 * assigned group is reported as `'USER'`. So `'USER'` means "has a direct
 * assignment", **not** "direct only / no group path also exists" — never present
 * it as the latter (that is why there is no `isDirectOnly` anywhere). `'GROUP'`
 * is the only one of the two that is exclusive: it does imply no direct assignment.
 */
export type AppAssignmentScope = 'USER' | 'GROUP';

/**
 * Read the app-assignment {@link AppAssignmentScope} out of an app list row's
 * `_embedded` value (populated by `GET /api/v1/apps?…&expand=user/{userId}`).
 *
 * Pure, total, and side-effect free: the argument is typed `unknown` because
 * {@link oktaAppListItemSchema} deliberately does not constrain `_embedded` (see
 * the comment there), and every failure mode — absent, `null`, a string, an array,
 * a `user` that is not an app-user object, an unrecognized `scope` string — maps to
 * `undefined` rather than an exception. The caller keeps the app either way; only
 * the scope is unknown.
 *
 * @param embedded - The row's raw `_embedded` value (shape not guaranteed).
 * @returns `'USER'` or `'GROUP'`, or `undefined` when the embed is missing,
 * malformed, or carries a scope value this app does not recognize. Never throws,
 * never guesses.
 * @example
 * const scope = extractAppAssignmentScope(app._embedded); // 'USER' | 'GROUP' | undefined
 */
export function extractAppAssignmentScope(embedded: unknown): AppAssignmentScope | undefined {
  if (typeof embedded !== 'object' || embedded === null) return undefined;

  // The embedded object is the app-user for this app/user pair — the same shape
  // `GET /api/v1/apps/{appId}/users` returns, so it reuses `oktaAppUserSchema`
  // rather than declaring a second schema for it.
  const parsed = oktaAppUserSchema.safeParse((embedded as Record<string, unknown>).user);
  if (!parsed.success) return undefined;

  const { scope } = parsed.data;
  return scope === 'USER' || scope === 'GROUP' ? scope : undefined;
}

/**
 * An app-group assignment row as consumed by the App Groups export descriptor
 * (`GET /api/v1/apps/{appId}/groups`).
 *
 * Sibling of {@link oktaAppGroupAssignmentSchema} over the same endpoint: that
 * schema types the push-mapping fields (profile name variants, `_links.group`
 * href) the enrichment path reads, while this one types the export columns
 * (`priority`, `lastUpdated`) and keeps `profile` fully generic. Only `id` is
 * required and unknown fields `.passthrough()`, per the
 * {@link oktaAppListItemSchema} precedent. Use with {@link parseOktaList}.
 */
export const oktaAppGroupSchema = z
  .object({
    id: z.string(),
    priority: z.number().optional(),
    lastUpdated: z.string().nullish(),
    profile: z.record(z.unknown()).optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaAppGroupSchema} row. */
export type OktaAppGroup = z.infer<typeof oktaAppGroupSchema>;

/**
 * A policy as it appears in a *list* response (`GET /api/v1/policies?type=…`),
 * covering every policy type (`ACCESS_POLICY`, `OKTA_SIGN_ON`, `MFA_ENROLL`,
 * `PASSWORD`, …).
 *
 * Deliberately lenient, following the {@link oktaAppListItemSchema} precedent:
 * only `id` is required and unknown fields `.passthrough()`. Policy payloads
 * differ per type and Okta adds fields over time, so stripping unknown keys here
 * would silently drop data the UI (or a later feature) reads — the exact class of
 * corruption ADR-0006 warns about. `_links` is declared as `z.unknown()` because
 * its shape varies by policy type; consumers must narrow it defensively rather
 * than trust a typed shape. Use with {@link parseOktaList}.
 */
export const oktaPolicyListItemSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    priority: z.number().nullish(),
    description: z.string().nullish(),
    system: z.boolean().optional(),
    created: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    _links: z.unknown().optional(),
  })
  .passthrough();

/**
 * A policy rule as returned by `GET /api/v1/policies/{policyId}/rules`.
 *
 * Same lenient contract as {@link oktaPolicyListItemSchema}: only `id` is
 * required and unknown fields `.passthrough()`. `conditions` and `actions` are
 * `z.unknown()` on purpose — their deep shapes vary by policy type (an access
 * policy rule's `actions.appSignOn` looks nothing like a password policy rule's),
 * and the UI renders only the validated scalar fields; anything reading into
 * those trees must narrow them defensively. Use with {@link parseOktaList}.
 */
export const oktaPolicyRuleSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    priority: z.number().nullish(),
    system: z.boolean().optional(),
    conditions: z.unknown().optional(),
    actions: z.unknown().optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaPolicyListItemSchema} row. */
export type OktaPolicyListItem = z.infer<typeof oktaPolicyListItemSchema>;

/** Inferred type of a validated {@link oktaPolicyRuleSchema} row. */
export type OktaPolicyRule = z.infer<typeof oktaPolicyRuleSchema>;

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
