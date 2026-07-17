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
    mobilePhone: z.string().nullish(),
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

/** Inferred type of a validated {@link oktaUserSchema} response. */
export type OktaUserResponse = z.infer<typeof oktaUserSchema>;
/** Inferred type of a validated {@link oktaGroupSchema} response. */
export type OktaGroupResponse = z.infer<typeof oktaGroupSchema>;
/** Inferred type of a validated {@link oktaGroupRuleSchema} response. */
export type OktaGroupRuleResponse = z.infer<typeof oktaGroupRuleSchema>;

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
