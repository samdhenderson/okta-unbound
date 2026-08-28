/**
 * @module shared/utils/oktaId
 * @description Classifies an Okta entity id by its prefix, for surfaces that
 * resolve a pasted id rather than searching for a name.
 *
 * The Home tab's jump bar exists because an admin usually already has the id:
 * it is in the URL they came from, in a ticket, in a log line. Pasting it should
 * go straight to the entity rather than running a name search that cannot match
 * it. That requires deciding, locally and with no request, *what kind of thing*
 * an id refers to.
 *
 * ## Why this lives in `shared/` and knows nothing about tabs
 *
 * Two surfaces resolve ids — the jump bar and the ⌘K palette — and a third
 * (`shared/utils/redact.ts`) recognises the same prefixes for a completely
 * different reason. Mapping a kind to a *destination tab* is side-panel UI
 * knowledge, so it lives in `sidepanel/components/home/jumpDestinations.ts`.
 * `src/shared/` must not import `src/sidepanel/`, and keeping the split here is
 * what lets both surfaces share one classifier.
 *
 * ## What is deliberately not recognised
 *
 * **Policies.** Okta issues policy ids under at least two prefixes (`00p` and
 * `rst`, as this repo's own `POLICY_ID_PATTERN` already accepts), the prefix
 * varies by policy type, and {@link module:shared/utils/oktaUrl}'s
 * `OktaAdminEntityType` has no `policy` member — so there is nowhere correct to
 * send the reader. A wrong guess navigates an admin to the wrong tab, which is
 * worse than falling through to a name search. `aus` (authorization servers) is
 * omitted for the same reason: nothing in this app browses them.
 *
 * An unrecognised candidate is {@link OktaIdKind | `null`}, never a guess. The
 * caller then treats the input as a name or email and searches, which costs one
 * request and is always safe — the deliberate asymmetry of this module.
 */

/** The entity kinds this app can identify from an id prefix alone. */
export type OktaIdKind = 'group' | 'user' | 'app' | 'rule';

/**
 * Prefix → entity kind, for the kinds this app can actually navigate to.
 *
 * Every prefix is three characters, which {@link OKTA_ID_BODY_LENGTH} depends
 * on. Kept as a literal map rather than derived from
 * {@link module:shared/utils/redact}'s table: that one exists to *hide* ids and
 * so covers kinds this app cannot browse (`00p`/`rst` policies, `aus`
 * authorization servers), while this one exists to *reach* them and covers a
 * kind redaction does not (`0pr` group rules). The two overlap; they are not the
 * same list, and collapsing them would drag a security module into a UI concern.
 * `oktaId.test.ts` pins the overlap so they cannot drift apart silently.
 */
const ID_PREFIX_KINDS: ReadonlyMap<string, OktaIdKind> = new Map([
  ['00g', 'group' as const],
  ['00u', 'user' as const],
  ['0oa', 'app' as const],
  ['0pr', 'rule' as const],
]);

/** Length of every prefix in {@link ID_PREFIX_KINDS}. */
const OKTA_ID_PREFIX_LENGTH = 3;

/**
 * Characters following the prefix in a generated Okta id.
 *
 * Seventeen, giving a total length of twenty. This matches
 * {@link module:shared/utils/redact}'s `KNOWN_ID_RE`, which documents the same
 * figure as Okta's actual generated-id length.
 */
const OKTA_ID_BODY_LENGTH = 17;

/** A well-formed id: a known prefix followed by exactly 17 alphanumerics. */
const OKTA_ID_RE = new RegExp(
  `^(${[...ID_PREFIX_KINDS.keys()].join('|')})[A-Za-z0-9]{${OKTA_ID_BODY_LENGTH}}$`,
);

/**
 * Classify a candidate string as an Okta entity id.
 *
 * Surrounding whitespace is trimmed, because the overwhelmingly common way an
 * id reaches this function is a paste. Nothing else is normalised: Okta ids are
 * case-sensitive, so lowercasing one would produce a plausible id that does not
 * exist.
 *
 * @param candidate - Raw user input — a pasted id, a typed name, an email, or
 * anything else.
 * @returns The entity kind, or `null` when the input is not a well-formed id of
 * a kind this app can reach. `null` is the signal to search by name instead.
 *
 * @example
 * ```ts
 * oktaIdKind('00gFAKE0000000000001');   // 'group'
 * oktaIdKind('  0prFAKE0000000000001'); // 'rule'   (pasted with whitespace)
 * oktaIdKind('00pFAKE0000000000001');   // null     (policy — no destination)
 * oktaIdKind('00gTOOSHORT');            // null     (right prefix, wrong shape)
 * oktaIdKind('ada@example.com');        // null     (search this instead)
 * ```
 */
export function oktaIdKind(candidate: string): OktaIdKind | null {
  const trimmed = candidate.trim();
  if (!OKTA_ID_RE.test(trimmed)) return null;
  return ID_PREFIX_KINDS.get(trimmed.slice(0, OKTA_ID_PREFIX_LENGTH)) ?? null;
}
