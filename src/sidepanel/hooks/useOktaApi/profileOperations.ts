/**
 * @module hooks/useOktaApi/profileOperations
 * @description User-profile reads and the extension's first profile **write**.
 *
 * Split out of `userOperations` because a write has obligations a read does not:
 * a pre-flight refusal of security-sensitive attributes, boundary validation of
 * what comes back, and — the subtle one — an honest answer when we cannot tell
 * whether the write landed.
 *
 * ## The three-state result (read this before touching {@link UpdateProfileResult})
 *
 * `makeApiRequest` (see `core.ts`) retries a dropped MV3 message port **only for
 * `GET`**: a port error is ambiguous about whether the scheduled request already
 * executed, and re-enqueuing a write risks a double execute. So a non-GET that
 * loses its port *throws*, and at that point the write may well have been
 * performed by the content script — we simply never heard the answer.
 *
 * That gives three genuinely different outcomes, and collapsing them loses
 * information about someone's data:
 *
 * - `'saved'`  — Okta accepted the write and returned a user we could validate.
 * - `'failed'` — the transport returned `{ success: false }`. Okta was reached
 *   and said no; the profile is unchanged. Safe to tell the admin "not saved".
 * - `'unknown'` — the call **threw**, or came back unreadable. The write MAY
 *   HAVE APPLIED. Reporting this as "failed" is a false statement about the
 *   user's data: the admin would re-check nothing and walk away believing the
 *   old value stands. Callers must surface it as "we could not confirm — reload
 *   to check", never as an error that implies no change.
 *
 * ## Logging
 *
 * Profile attribute names and values are tenant PII. Nothing in this module logs
 * an attribute name, a value, a patch, or a response body — identifiers,
 * counts, and outcomes only.
 */

import type { CoreApi } from './core';
import type { OktaUser } from '@/shared/types';
import {
  oktaUserSchema,
  oktaUserProfileSchemaSchema,
  type OktaUserProfileSchema,
} from '@/shared/schemas/okta';
import { isExcludedProfileField } from '@/shared/utils/profileFields';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * The outcome of a profile write — deliberately three-state, not a boolean.
 *
 * See the module header for why `'failed'` and `'unknown'` must not be merged:
 * `'failed'` means Okta answered and rejected the write, `'unknown'` means we
 * never got an answer and the write may have applied.
 */
export type UpdateProfileResult =
  | { readonly kind: 'saved'; readonly user: OktaUser }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'unknown'; readonly error: string };

/**
 * Throw unless every key in `patch` is safe to write.
 *
 * @param patch - The sparse profile patch about to be sent.
 * @throws When any key is {@link isExcludedProfileField security-sensitive}
 * (`password`, `securityQuestion`, `credentials`, …).
 * @remarks Exported and called at the **request boundary** rather than in the
 * editing UI on purpose. The UI already filters these attributes out of the
 * attribute inventory, but that is a rendering decision; making the write itself
 * refuse means no future caller — a bulk editor, an undo replay, a test harness
 * — can reach the endpoint with a credential field in hand by simply forgetting
 * to filter.
 *
 * The thrown message carries a **count, not the offending names**, keeping this
 * module's "identifiers and outcomes only" rule true even for text that may end
 * up rendered or logged by a caller.
 */
export function assertNoExcludedKeys(patch: Record<string, unknown>): void {
  let excluded = 0;
  for (const key of Object.keys(patch)) {
    if (isExcludedProfileField(key)) {
      excluded += 1;
    }
  }

  if (excluded > 0) {
    throw new Error(
      `Refusing to write ${excluded} security-sensitive profile attribute${excluded === 1 ? '' : 's'}`,
    );
  }
}

/**
 * Build the user-profile read and write operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns The org profile-schema read, a raw single-user read, and the profile
 * write.
 */
export function createProfileOperations(coreApi: CoreApi) {
  /**
   * Read the org's user-profile schema — the definition of every base and
   * org-defined (custom) profile attribute.
   *
   * @returns The validated {@link OktaUserProfileSchema}, or `null` when the
   * request fails, returns no data, or returns a payload that does not validate.
   * Never throws.
   * @remarks One org-wide `GET /api/v1/meta/schemas/user/default`. This is the
   * only way to learn about an attribute that is **unset** on the user being
   * viewed — such an attribute is absent from that user's `profile` object, so a
   * schema-less inventory silently under-reports what the org actually defines.
   * Cache it under `cacheKeys.userSchema(oktaOrigin)` (org-wide, `TTL_LONG`)
   * rather than re-asking per user.
   *
   * `null` is a first-class answer, not an error to surface: the caller falls
   * back to `BASE_PROFILE_ATTRIBUTES` and renders the user's own profile keys, so
   * a schema-endpoint failure costs custom-attribute *discovery*, never the view.
   *
   * Validation is lenient (ADR-0006): a malformed individual property is dropped
   * and the rest of the schema is kept. Nothing about the response body is logged
   * — profile schemas carry org-specific attribute names and labels.
   */
  const getUserProfileSchema = async (): Promise<OktaUserProfileSchema | null> => {
    try {
      const response = await coreApi.makeApiRequest('/api/v1/meta/schemas/user/default');
      if (!response.success || !response.data) {
        // Outcome only — never the payload or the error body.
        log.error('Failed to fetch user profile schema', { success: response.success });
        return null;
      }

      const parsed = oktaUserProfileSchemaSchema.safeParse(response.data);
      if (!parsed.success) {
        // Issue paths/codes only: zod's messages echo received values.
        log.error('User profile schema failed validation', {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
          })),
        });
        return null;
      }

      return parsed.data;
    } catch (error) {
      log.error('getUserProfileSchema error:', error);
      return null;
    }
  };

  /**
   * Fetch one user by id as a **whole, validated** {@link OktaUser}.
   *
   * @param userId - User id to look up.
   * @returns The validated user, or `null` when the request fails, returns no
   * data, or returns a payload that does not validate. Never throws.
   * @remarks Deliberately separate from `userOperations.getUserById`, which
   * returns a flat six-field projection three call sites depend on. Widening
   * that projection would change its contract for every one of them; an editor
   * needs the entire `profile` object (every custom attribute included) plus
   * `credentials.provider` to decide what is editable, so it gets its own read.
   *
   * Validation is strict here, not lenient (ADR-0006): a single user response
   * that does not parse is not a row to drop, it is the whole answer — and this
   * value seeds an edit form whose diff becomes a write. `null` (nothing to
   * edit) beats a half-understood profile.
   *
   * `oktaUserSchema`'s `credentials` block is deliberately **not**
   * `.passthrough()`, so `credentials.password` / `recovery_question` are
   * stripped here and never reach React state.
   */
  const getUserRaw = async (userId: string): Promise<OktaUser | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
      if (!response.success || !response.data) {
        // Identifier + outcome only.
        log.error('Failed to fetch user', { userId, success: response.success });
        return null;
      }

      const parsed = oktaUserSchema.safeParse(response.data);
      if (!parsed.success) {
        // Issue paths/codes only: zod's messages echo received values (PII).
        log.error('User response failed validation', {
          userId,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
          })),
        });
        return null;
      }

      return parsed.data;
    } catch {
      // Identifier + outcome only: a rejected transport error can carry the
      // request body in its message on some paths.
      log.error('getUserRaw error', { userId });
      return null;
    }
  };

  /**
   * Write a **sparse patch** of profile attributes onto a user.
   *
   * @param userId - User to update.
   * @param patch - Attribute name → new value, containing **only** the changed
   * attributes.
   * @returns An {@link UpdateProfileResult} — `'saved'`, `'failed'`, or
   * `'unknown'`. See the module header; `'unknown'` means the write may have
   * applied and must never be shown as a plain failure.
   * @throws Before issuing any request, when `patch` is empty or contains a
   * security-sensitive key (see {@link assertNoExcludedKeys}). Both rejections
   * happen strictly *pre-flight*, so a caller can never confuse them with the
   * `'unknown'` outcome: no request was scheduled.
   *
   * @remarks
   * **Merge semantics.** `POST /api/v1/users/{id}` with `{ profile: patch }` is
   * documented by Okta as a *partial* update: attributes absent from the body
   * are left untouched. That behavior is **documented-but-unverified in this
   * repo** — nothing here has exercised it against a live org. If verification
   * ever shows Okta *replaces* the profile instead, the fallback is to send the
   * full profile (the user's current attributes merged with the patch) with
   * every attribute whose schema `mutability !== 'READ_WRITE'` stripped out,
   * since Okta rejects writes to those. That fallback is deliberately confined
   * to this function: no caller passes anything but a sparse patch, so the fix
   * would be one function body, not a call-site migration.
   *
   * The response is validated with `oktaUserSchema` (ADR-0006) — the returned
   * user is what the caller renders as the new truth, so an unvalidated body
   * would put unverified Okta data straight into the view.
   */
  const updateUserProfile = async (
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<UpdateProfileResult> => {
    const attributeCount = Object.keys(patch).length;
    if (attributeCount === 0) {
      // A no-op write still costs a rate-limit slot and still produces a history
      // entry that claims something changed. Refuse it at the boundary.
      throw new Error('Refusing to write an empty profile patch');
    }
    assertNoExcludedKeys(patch);

    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`, 'POST', {
        profile: patch,
      });

      if (!response.success) {
        // Okta was reached and said no: the profile is unchanged.
        log.error('Profile update rejected', { userId, attributeCount });
        return { kind: 'failed', error: response.error || 'Okta rejected the profile update' };
      }

      const parsed = oktaUserSchema.safeParse(response.data);
      if (!parsed.success) {
        // The transport reported success, so the write most likely landed — we
        // just cannot state the resulting profile. That is `'unknown'`, not
        // `'failed'`: saying "failed" here would tell the admin their edit did
        // not happen when it probably did.
        log.error('Profile update response failed validation', {
          userId,
          attributeCount,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
          })),
        });
        return {
          kind: 'unknown',
          error: 'Okta accepted the update but returned an unreadable response',
        };
      }

      log.info('Profile updated', { userId, attributeCount });
      return { kind: 'saved', user: parsed.data };
    } catch {
      // A throw from a non-GET is ambiguous by construction (core.ts never
      // retries a write). Never downgrade this to `'failed'`.
      log.error('Profile update outcome unknown', { userId, attributeCount });
      return {
        kind: 'unknown',
        error: 'The update could not be confirmed. Reload the user to check whether it applied.',
      };
    }
  };

  return {
    getUserProfileSchema,
    getUserRaw,
    updateUserProfile,
  };
}
