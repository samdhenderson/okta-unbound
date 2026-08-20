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
  /**
   * Account-level mastering. `provider.type` is `'OKTA'` when Okta owns the
   * credential, or `'ACTIVE_DIRECTORY'` / `'IMPORT'` / `'FEDERATION'` when an
   * external directory does — the signal that decides whether `login` is
   * editable.
   *
   * **Deliberately not `.passthrough()`, unlike its siblings in this file.** Okta
   * returns `credentials.password` and `credentials.recovery_question` on this
   * object; passthrough would carry credential material through the boundary and
   * into React state, where anything that serializes a user would pick it up.
   * Stripping it here is the whole point of validating at the boundary.
   */
  credentials: z
    .object({
      provider: z
        .object({
          type: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
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
    // The provisioning features Okta has enabled on this app instance. Named
    // here — rather than left to `.passthrough()` — because `PROFILE_MASTERING`
    // is how Okta reports that an app is a **profile source**, which is the
    // per-user half of the profile-attribute editability gate
    // (`sidepanel/components/users/profileEditability`). It rides the app rows
    // `getUserApps` already requests, so reading it costs no request at all;
    // see {@link isProfileSourceApp}.
    //
    // `.catch(undefined)` for the same reason as `oktaAppUserSchema._links`:
    // `parseOktaList` DROPS a row that fails validation (ADR-0006), so a
    // `features` of an unexpected shape must degrade to "we cannot say whether
    // this app is a profile source" — never to a missing app. Absence is a lock,
    // not an unlock, so degrading here is safe in the direction that matters.
    features: z.array(z.string()).optional().catch(undefined),
    // The app's Okta Resource Name, e.g.
    // `orn:okta:idp:00oFAKE:custom_identity_source:0oaFAKE`. Corroborating only:
    // its resource segment identifies a Custom Identity Source, but Active
    // Directory, LDAP and HR apps are profile sources without it, so
    // {@link isProfileSourceApp} gates on `features` instead. Kept because it is
    // what lets a surface say what *kind* of source an app is.
    orn: z.string().optional().catch(undefined),
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
    // Typed for exactly one reason: `expand=user/{userId}` on `GET /api/v1/apps`
    // embeds this object, and when the assignment reaches the user through a
    // group Okta names that group here as `_links.group.href`. It already
    // survived `.passthrough()`; naming it makes it reachable from TypeScript so
    // `getUserApps` can say WHICH group grants an app without spending a request
    // per app. Shape mirrors {@link oktaAppGroupAssignmentSchema}'s `_links`.
    //
    // `.catch(undefined)` is load-bearing leniency (ADR-0006), not decoration.
    // This schema is applied through `parseOktaList` on the App Users walks,
    // which DROP a row that fails validation, and it also gates
    // {@link extractAppAssignmentScope}'s read of `scope`. Without the catch a
    // `_links` of an unexpected shape would cost a whole app-user row on one
    // path and a perfectly good `scope` on the other. A malformed link must
    // degrade to "Okta named no group" — never to a missing app.
    _links: z
      .object({
        group: z.object({ href: z.string().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional()
      .catch(undefined),
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
 * The `features` value that means an app instance is a **profile source** — what
 * Okta's admin console calls the profile master for the users assigned to it.
 *
 * `IMPORT_PROFILE_UPDATES` is deliberately not accepted as a synonym. An app can
 * import profile updates without being anyone's source of truth; `PROFILE_MASTERING`
 * is the flag Okta sets when the app actually owns the profile, and it is the one
 * the console reads.
 */
const PROFILE_SOURCE_FEATURE = 'PROFILE_MASTERING';

/**
 * Whether Okta reports this app instance as a profile source.
 *
 * This is the fact that turns an org-wide `master.type: 'PROFILE_MASTER'` on a
 * schema property into a verdict about one person: an attribute that follows the
 * org's profile-source order is owned by Okta for a user attached to no profile
 * source, and editable in the console. See
 * {@link module:sidepanel/components/users/profileEditability}.
 *
 * Pure and total. `undefined` — Okta named no features, or the array failed
 * validation and {@link oktaAppListItemSchema} caught it — returns `false`, which
 * the gate reads as "not a source we can name". That is the safe direction only
 * because the gate never unlocks on this alone: an unknown app list keeps every
 * mastered attribute locked regardless.
 *
 * @param features - The app row's `features` array, or `undefined`.
 * @returns `true` when the array contains `PROFILE_MASTERING`.
 * @example
 * isProfileSourceApp(['IMPORT_NEW_USERS', 'PROFILE_MASTERING']); // true
 */
export function isProfileSourceApp(features: readonly string[] | undefined): boolean {
  return features !== undefined && features.includes(PROFILE_SOURCE_FEATURE);
}

/**
 * Shape a string must match to be accepted as an Okta group id: the `00g`
 * prefix followed by an alphanumeric body, 18+ characters in total.
 *
 * Guards {@link extractAppGrantGroupId}. The value it filters arrives inside an
 * untrusted Okta response body and is destined for interpolation into a request
 * path, so it is checked rather than trusted — the same posture
 * `POLICY_ID_PATTERN` (`useOktaApi/policyOperations`) applies to the
 * `_links.accessPolicy` href, and the reason `shared/utils/oktaUrl` parses
 * hostnames instead of substring-matching them (`docs/security.md` §6).
 */
const GROUP_ID_PATTERN = /^00g[A-Za-z0-9]{15,}$/;

/**
 * Take the last non-empty path segment of an href.
 *
 * @param href - Raw href value; may be absolute or relative.
 * @returns The trailing segment, or `undefined` when there is none.
 * @remarks Query string and fragment are stripped first and trailing slashes
 * ignored, so `.../groups/{id}/?x=1` still yields `{id}`. Deliberately a string
 * scan rather than `new URL`, so a relative href parses too and no origin is
 * ever inferred from response data.
 */
function trailingPathSegment(href: string): string | undefined {
  const path = href.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const segment = path.split('/').pop();
  return segment ? segment : undefined;
}

/**
 * Read the id of the group Okta named as the source of an app assignment, out of
 * an app list row's `_embedded` value (populated by
 * `GET /api/v1/apps?...&expand=user/{userId}`).
 *
 * Sibling of {@link extractAppAssignmentScope} over the same embed: that one
 * reads *how* the assignment was granted, this one reads *which group* granted
 * it, from `_embedded.user._links.group.href`. Both are pure, total, and
 * side-effect free, and both cost zero additional requests — the data is already
 * in a response the caller holds.
 *
 * **This is not the complement of `scope`.** Okta reports a single `scope` per
 * app-user and prefers `'USER'`, so a user who is both directly assigned *and*
 * reached by an assigned group reports `'USER'` — and may still carry a group
 * link. A `'USER'` row with a group id is not a contradiction; both facts are
 * true, and callers must be able to state both.
 *
 * **A missing answer is `undefined`, never "direct".** An absent, malformed, or
 * rejected link means Okta named no group *here* — it is not a claim that no
 * group path exists (ADR-0020: a failed or silent lookup is never rendered as an
 * attribution).
 *
 * @param embedded - The row's raw `_embedded` value (shape not guaranteed).
 * @returns The granting group's Okta id, or `undefined` when the embed is
 * missing or malformed, carries no group link, or yields a trailing segment that
 * does not match {@link GROUP_ID_PATTERN}. Never throws, never guesses.
 * @remarks The extracted segment is validated before it is returned because it
 * originates in an untrusted response body and callers interpolate it into a
 * request path; anything that fails the pattern is discarded rather than passed
 * on. The href itself is never logged (it can carry tenant identifiers).
 * @example
 * const groupId = extractAppGrantGroupId(app._embedded); // '00g…' | undefined
 */
export function extractAppGrantGroupId(embedded: unknown): string | undefined {
  if (typeof embedded !== 'object' || embedded === null) return undefined;

  // Same embed, same shape, same schema as `extractAppAssignmentScope` reads.
  const parsed = oktaAppUserSchema.safeParse((embedded as Record<string, unknown>).user);
  if (!parsed.success) return undefined;

  const href = parsed.data._links?.group?.href;
  if (typeof href !== 'string' || href.length === 0) return undefined;

  const candidate = trailingPathSegment(href);
  return candidate && GROUP_ID_PATTERN.test(candidate) ? candidate : undefined;
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
export function parseOkta<T>(
  // The third type argument leaves the schema's *input* type unconstrained. Zod
  // defaults it to the output type, which stops inference dead on any schema
  // whose two differ — `.catch()`, `.transform()`, `.default()`. Without it,
  // adding a `.catch()` to a field of a schema parsed through here becomes a
  // compile error at every call site, which is a reason not to make a schema more
  // lenient, and ADR-0006 wants the opposite pressure.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  data: unknown,
  context: string,
): T {
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

/**
 * One property of the org's user-profile schema
 * (`GET /api/v1/meta/schemas/user/default`) — a single attribute's metadata, not
 * a value.
 *
 * Deliberately lenient, following the {@link oktaAppListItemSchema} precedent:
 * **every** field is optional and unknown fields `.passthrough()`, because Okta
 * emits a different subset per property type (a string attribute carries
 * `pattern`/`maxLength`, an enum carries `enum`/`oneOf`, an array carries
 * `items`) and org-defined attributes add their own. A property that fails this
 * shape is dropped by {@link oktaUserProfileSchemaSchema}, never thrown on — a
 * single malformed attribute must not cost the caller the whole inventory.
 *
 * Several fields are captured **ahead of their first reader** so the editing work
 * ("C. Bulk Attribute Editor" in `docs/features-plan.md`) does not have to reopen
 * this schema. Nothing renders them today:
 * - `mutability` — `READ_WRITE` | `READ_ONLY` | `WRITE_ONLY`. An editor must not
 *   offer a field Okta will refuse to write.
 * - `master` — where the attribute is mastered (`PROFILE_MASTER` = an external
 *   source such as AD/LDAP/an app owns it, `OKTA` = Okta owns it, `OVERRIDE`).
 *   Skipping externally-mastered attributes is the editor's stated differentiator.
 * - `required`, `type`, `enum`, `oneOf` — what an editor needs to render and
 *   validate an input for the attribute.
 *
 * `mutability`, `type` and the `master.type` are plain `z.string()`, not enums:
 * an unrecognized value from a future Okta release must survive validation and be
 * narrowed by the reader, rather than dropping the property.
 */
export const oktaUserSchemaPropertySchema = z
  .object({
    /** Human label Okta shows for the attribute; falls back to the key when absent. */
    title: z.string().optional(),
    /** JSON-schema type, e.g. `string`, `boolean`, `number`, `array`. */
    type: z.string().optional(),
    /** `READ_WRITE` | `READ_ONLY` | `WRITE_ONLY` — kept for the future editor. */
    mutability: z.string().optional(),
    /** Whether Okta requires a value. Kept for the future editor. */
    required: z.boolean().optional(),
    /** Allowed values, when the attribute is an enum. Values are org-defined JSON. */
    enum: z.array(z.unknown()).optional(),
    /**
     * Labelled enum variants (`{ const, title }`). `z.unknown()` per entry for the
     * same reason as `enum`: the value type is whatever the attribute's `type` is.
     */
    oneOf: z.array(z.unknown()).optional(),
    /**
     * Profile-mastering block. `type` is the mastering mode and `priority` the
     * ordered source list; the latter is `z.unknown()` because its entries vary by
     * mastering source and nothing reads into it yet.
     */
    master: z
      .object({
        type: z.string().optional(),
        priority: z.unknown().optional(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaUserSchemaPropertySchema}. */
export type OktaUserSchemaProperty = z.infer<typeof oktaUserSchemaPropertySchema>;

/**
 * A `{ properties: … }` block, validated **per property**.
 *
 * The transform is the lenient contract of {@link parseOktaList} applied to an
 * object instead of an array: each property is `safeParse`d on its own, the valid
 * ones are kept and the malformed ones are dropped with a counts-only warning.
 * A plain `z.record(oktaUserSchemaPropertySchema)` would instead fail the entire
 * block over one bad attribute, which would silently empty the inventory.
 */
const oktaUserSchemaPropertiesSchema = z.record(z.string(), z.unknown()).transform((raw, ctx) => {
  const properties: Record<string, OktaUserSchemaProperty> = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(raw)) {
    const result = oktaUserSchemaPropertySchema.safeParse(value);
    if (result.success) {
      properties[key] = result.data;
    } else {
      // Count only — never the key or the value: org-defined attribute names
      // and titles are org data.
      dropped += 1;
    }
  }
  if (dropped > 0) {
    log.warn('Dropped malformed properties from Okta user schema', {
      context: ctx.path.join('.') || 'definitions',
      dropped,
      total: Object.keys(raw).length,
    });
  }
  return properties;
});

/** A `{ properties }` definition block (`definitions.base` / `definitions.custom`). */
const oktaUserSchemaDefinitionSchema = z
  .object({
    properties: oktaUserSchemaPropertiesSchema.optional(),
  })
  .passthrough();

/**
 * The org's user-profile schema, from `GET /api/v1/meta/schemas/user/default`.
 *
 * This is the only source of the **complete** attribute inventory: every base and
 * org-defined (custom) property, including the ones that are unset on any given
 * user and therefore absent from that user's `profile` object. One cached call per
 * org (`cacheKeys.userSchema`) backs the Users tab's "all attributes" view and,
 * later, the attribute editor.
 *
 * Deliberately lenient, following the {@link oktaAppListItemSchema} precedent:
 * nothing is required, unknown fields `.passthrough()`, and a malformed individual
 * property is dropped rather than failing the payload (see
 * {@link oktaUserSchemaPropertySchema}). `properties.profile.allOf` — Okta's
 * JSON-schema composition pointer — is `z.unknown()`: it is not read, it only
 * survives via passthrough so a future reader can reach it without a schema change.
 */
export const oktaUserProfileSchemaSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    definitions: z
      .object({
        base: oktaUserSchemaDefinitionSchema.optional(),
        custom: oktaUserSchemaDefinitionSchema.optional(),
      })
      .passthrough()
      .optional(),
    properties: z
      .object({
        profile: z
          .object({
            allOf: z.unknown().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Inferred type of a validated {@link oktaUserProfileSchemaSchema} response. */
export type OktaUserProfileSchema = z.infer<typeof oktaUserProfileSchemaSchema>;
