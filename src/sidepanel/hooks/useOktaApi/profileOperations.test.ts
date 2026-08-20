/**
 * Unit tests for the user-profile read + write operations.
 *
 * Driven through a fully-mocked `CoreApi` (see `makeCore`) — this repo mocks at
 * the `CoreApi` seam, not the network (`docs/testing.md`; MSW is not used here).
 * The write cases carry the weight: the pre-flight refusals must be provable to
 * have issued **zero** requests, and `'failed'` (Okta said no) must stay distinct
 * from `'unknown'` (the call threw and the write may have applied).
 *
 * The `getUserProfileSchema` block moved here verbatim with the operation itself
 * when it was split out of `userOperations` — same assertions, new home.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `example.okta.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createProfileOperations, assertNoExcludedKeys } from './profileOperations';
import type { CoreApi } from './core';
import { makeFakeCore } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    ...overrides,
  });

/** A user payload that satisfies `oktaUserSchema` (all required profile fields). */
const validUser = (overrides: Record<string, unknown> = {}) => ({
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'jane@example.com',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    department: 'Support',
  },
  ...overrides,
});

describe('assertNoExcludedKeys', () => {
  it('accepts a patch of ordinary attributes', () => {
    expect(() => assertNoExcludedKeys({ department: 'Support', title: 'Lead' })).not.toThrow();
  });

  it('throws for a security-sensitive key', () => {
    expect(() => assertNoExcludedKeys({ password: 'x' })).toThrow();
    expect(() => assertNoExcludedKeys({ securityQuestion: 'x' })).toThrow();
    expect(() => assertNoExcludedKeys({ credentials: {} })).toThrow();
  });

  it('matches a lower-cased spelling of an excluded key', () => {
    // `isExcludedProfileField` also tests `key.toLowerCase()`, so a shouted
    // spelling of an entry that is itself lower-cased in the set is caught.
    // Camel-cased entries (`securityQuestion`) are matched exactly — Okta
    // attribute names are case-sensitive, so the exact spelling is the one that
    // can actually reach a real attribute.
    expect(() => assertNoExcludedKeys({ PASSWORD: 'x' })).toThrow();
  });

  it('does not name the offending attribute in the message', () => {
    // Identifiers/counts/outcomes only: the thrown text can be rendered or
    // logged by a caller, so it carries a count, never the key.
    expect(() => assertNoExcludedKeys({ securityQuestionAnswer: 'x' })).toThrow(/1 security/);
  });
});

describe('getUserRaw', () => {
  it('returns the validated user for a well-formed payload', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: validUser() }),
    });
    const { getUserRaw } = createProfileOperations(core);

    const user = await getUserRaw('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1');
    expect(user?.id).toBe('00uFAKE1');
    expect(user?.profile.department).toBe('Support');
  });

  it('strips credential material the org returned alongside the user', async () => {
    // `oktaUserSchema.credentials` is deliberately not `.passthrough()`: Okta
    // returns `credentials.password` here, and the boundary is where it stops.
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: validUser({
          credentials: { provider: { type: 'OKTA' }, password: { value: 'x' } },
        }),
      }),
    });
    const { getUserRaw } = createProfileOperations(core);

    const user = await getUserRaw('00uFAKE1');

    expect(user?.credentials?.provider?.type).toBe('OKTA');
    expect(user?.credentials && 'password' in user.credentials).toBe(false);
  });

  it('returns null for a malformed payload', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: '00uFAKE1', profile: {} } }),
    });
    const { getUserRaw } = createProfileOperations(core);

    expect(await getUserRaw('00uFAKE1')).toBeNull();
  });

  it('returns null when the request is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'HTTP 404' }),
    });
    const { getUserRaw } = createProfileOperations(core);

    expect(await getUserRaw('00uFAKE1')).toBeNull();
  });

  it('returns null and swallows a thrown error', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('boom')) });
    const { getUserRaw } = createProfileOperations(core);

    expect(await getUserRaw('00uFAKE1')).toBeNull();
  });
});

describe('updateUserProfile', () => {
  it('issues exactly one sparse POST to the user endpoint', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue({ success: true, data: validUser() });
    const { updateUserProfile } = createProfileOperations(makeCore({ makeApiRequest }));

    const result = await updateUserProfile('00uFAKE1', { department: 'Support' });

    expect(makeApiRequest).toHaveBeenCalledTimes(1);
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1', 'POST', {
      profile: { department: 'Support' },
    });
    expect(result.kind).toBe('saved');
    expect(result.kind === 'saved' && result.user.id).toBe('00uFAKE1');
  });

  it('refuses a security-sensitive attribute before any request is issued', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue({ success: true, data: validUser() });
    const { updateUserProfile } = createProfileOperations(makeCore({ makeApiRequest }));

    await expect(updateUserProfile('00uFAKE1', { password: 'hunter2' })).rejects.toThrow();
    await expect(
      updateUserProfile('00uFAKE1', { department: 'Support', securityQuestion: 'pet' }),
    ).rejects.toThrow();

    // The refusal is the request never happening — not merely a throw after it.
    expect(makeApiRequest).not.toHaveBeenCalled();
  });

  it('refuses an empty patch without issuing a request', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue({ success: true, data: validUser() });
    const { updateUserProfile } = createProfileOperations(makeCore({ makeApiRequest }));

    await expect(updateUserProfile('00uFAKE1', {})).rejects.toThrow();
    expect(makeApiRequest).not.toHaveBeenCalled();
  });

  it("reports a rejected write as 'failed' — Okta answered, nothing changed", async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'HTTP 403' }),
    });
    const { updateUserProfile } = createProfileOperations(core);

    const result = await updateUserProfile('00uFAKE1', { department: 'Support' });

    expect(result.kind).toBe('failed');
    expect(result.kind === 'failed' && result.error).toBe('HTTP 403');
  });

  it("reports a thrown write as 'unknown' — it may have applied", async () => {
    // core.ts never retries a non-GET, so a dropped MV3 port throws here with the
    // write possibly already performed. Calling that 'failed' would be a false
    // statement about the user's data.
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockRejectedValue(new Error('The message port closed before a response was received.')),
    });
    const { updateUserProfile } = createProfileOperations(core);

    const result = await updateUserProfile('00uFAKE1', { department: 'Support' });

    expect(result.kind).toBe('unknown');
  });

  it('does not report a response that fails validation as saved', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: '00uFAKE1', profile: {} } }),
    });
    const { updateUserProfile } = createProfileOperations(core);

    const result = await updateUserProfile('00uFAKE1', { department: 'Support' });

    expect(result.kind).not.toBe('saved');
  });
});

describe('getUserProfileSchema', () => {
  /** A minimal org schema payload: one base and one custom attribute. */
  const schemaPayload = {
    id: 'https://example.okta.com/meta/schemas/user/default',
    definitions: {
      base: {
        properties: {
          login: {
            title: 'Username',
            type: 'string',
            required: true,
            mutability: 'READ_WRITE',
            master: { type: 'PROFILE_MASTER', priority: [{ type: 'APP' }] },
          },
        },
      },
      custom: {
        properties: {
          badgeId: { title: 'Badge ID', type: 'string', mutability: 'READ_ONLY' },
        },
      },
    },
    properties: { profile: { allOf: [{ $ref: '#/definitions/base' }] } },
  };

  it('reads the org schema endpoint and returns the validated payload', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: schemaPayload }),
    });
    const { getUserProfileSchema } = createProfileOperations(core);

    const result = await getUserProfileSchema();

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/meta/schemas/user/default');
    expect(result?.definitions?.base?.properties?.login).toMatchObject({
      title: 'Username',
      type: 'string',
      required: true,
      mutability: 'READ_WRITE',
    });
    // Captured now for the future attribute editor, which must skip
    // externally-mastered attributes.
    expect(result?.definitions?.base?.properties?.login?.master?.type).toBe('PROFILE_MASTER');
    expect(result?.definitions?.custom?.properties?.badgeId).toMatchObject({
      title: 'Badge ID',
      mutability: 'READ_ONLY',
    });
  });

  it('returns null when the request is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'HTTP 403' }),
    });
    const { getUserProfileSchema } = createProfileOperations(core);
    expect(await getUserProfileSchema()).toBeNull();
  });

  it('returns null when the payload is not a schema object', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: 'not a schema' }),
    });
    const { getUserProfileSchema } = createProfileOperations(core);
    expect(await getUserProfileSchema()).toBeNull();
  });

  it('returns null and swallows a thrown error', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { getUserProfileSchema } = createProfileOperations(core);
    expect(await getUserProfileSchema()).toBeNull();
  });

  it('drops a malformed property without dropping the rest of the schema', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: {
          definitions: {
            base: {
              properties: {
                login: { title: 'Username', type: 'string' },
                // Not an object at all — the one attribute is dropped, the
                // inventory is not (ADR-0006: degrade, never fail closed).
                broken: 'nonsense',
                alsoBroken: { title: 42 },
              },
            },
          },
        },
      }),
    });
    const { getUserProfileSchema } = createProfileOperations(core);

    const result = await getUserProfileSchema();

    expect(result).not.toBeNull();
    expect(Object.keys(result?.definitions?.base?.properties ?? {})).toEqual(['login']);
  });
});
