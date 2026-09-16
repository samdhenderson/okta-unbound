import{j as n}from"./iframe-tAvKsVeF.js";import{u as s,M as r,c as i}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const o=`# Shared utilities



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / downloadCSV

# Function: downloadCSV()

> **downloadCSV**(\`content\`, \`filename\`, \`mimeType?\`): \`void\`

Defined in: [src/shared/utils/csvUtils.ts:81](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L81)

Trigger a browser download of CSV content as a file. Requires a DOM (runs in
the side panel).

## Parameters

### content

\`string\`

### filename

\`string\`

Suggested download filename, including the \`.csv\` extension.

### mimeType?

\`string\` = \`'text/csv;charset=utf-8;'\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / escapeCSV

# Function: escapeCSV()

> **escapeCSV**(\`value\`): \`string\`

Defined in: [src/shared/utils/csvUtils.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L45)

Escape a single value for safe inclusion in a CSV field.

Values containing a comma, newline, or double quote are quoted per RFC 4180,
and a string starting with a formula trigger (\`=\`, \`+\`, \`-\`, \`@\`, tab, CR) is
prefixed with \`'\` so a spreadsheet renders it as text. Exports carry
end-user-controlled Okta data, so **every** cell goes through this function.

## Parameters

### value

\`string\` \\| \`number\` \\| \`boolean\` \\| \`null\` \\| \`undefined\`

The cell value to escape; nullish becomes an empty field.

## Returns

\`string\`

The escaped field string.

## Example

\`\`\`ts
escapeCSV('a,b');   // => '"a,b"'
escapeCSV('he "x"'); // => '"he ""x"""'
escapeCSV('=SUM(A1)'); // => "'=SUM(A1)"
escapeCSV(null);     // => ''
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / formatDateForCSV

# Function: formatDateForCSV()

> **formatDateForCSV**(\`date\`): \`string\`

Defined in: [src/shared/utils/csvUtils.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L21)

Format a date for CSV export in \`YYYY-MM-DD\` form.

## Parameters

### date

\`string\` \\| \`Date\` \\| \`null\` \\| \`undefined\`

A \`Date\`, an ISO/parseable date string, or nullish.

## Returns

\`string\`

The date portion of the ISO string, or \`'N/A'\` for nullish or
  unparseable input.

## Example

\`\`\`ts
formatDateForCSV('2026-03-05T14:30:00Z'); // => '2026-03-05'
formatDateForCSV(null); // => 'N/A'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / generateCSV

# Function: generateCSV()

> **generateCSV**(\`headers\`, \`rows\`): \`string\`

Defined in: [src/shared/utils/csvUtils.ts:66](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L66)

Assemble a full CSV document from a header row and data rows. Every cell,
headers included, is passed through escapeCSV.

## Parameters

### headers

\`string\`[]

### rows

(\`string\` \\| \`number\` \\| \`boolean\` \\| \`null\` \\| \`undefined\`)[][]

Data rows; each is an array of cells aligned to \`headers\`.

## Returns

\`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / getDateForFilename

# Function: getDateForFilename()

> **getDateForFilename**(): \`string\`

Defined in: [src/shared/utils/csvUtils.ts:117](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L117)

Current date in \`YYYY-MM-DD\` form, for stamping export filenames.

## Returns

\`string\`

Today's date as an ISO date string (date portion only).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/csvUtils / sanitizeFilename

# Function: sanitizeFilename()

> **sanitizeFilename**(\`name\`): \`string\`

Defined in: [src/shared/utils/csvUtils.ts:108](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/csvUtils.ts#L108)

Sanitize a string for use in a filename: every non-alphanumeric character
becomes \`_\` and the result is lower-cased.

## Parameters

### name

\`string\`

## Returns

\`string\`

A filesystem-safe, lower-cased token.

## Example

\`\`\`ts
sanitizeFilename('Sales Team (EMEA)'); // => 'sales_team__emea_'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/dateFormat / formatDate

# Function: formatDate()

> **formatDate**(\`date\`): \`string\`

Defined in: [src/shared/utils/dateFormat.ts:17](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/dateFormat.ts#L17)

Human-friendly absolute date with time, e.g. "Mar 5, 2026, 02:30 PM".

## Parameters

### date

\`DateInput\`

A \`Date\`, epoch-ms number, ISO/parseable date string, or nullish.

## Returns

\`string\`

The localized date-time string; \`'Never'\` for nullish input, or the
  stringified raw input if \`Date\` construction throws.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/dateFormat / formatDateShort

# Function: formatDateShort()

> **formatDateShort**(\`date\`): \`string\`

Defined in: [src/shared/utils/dateFormat.ts:40](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/dateFormat.ts#L40)

Date-only variant, e.g. "Mar 5, 2026" (no time). Used where a compact date is
preferred over the full timestamp.

## Parameters

### date

\`DateInput\`

A \`Date\`, epoch-ms number, ISO/parseable date string, or nullish.

## Returns

\`string\`

The localized date string; \`'Never'\`/the stringified raw input on the
  same conditions as formatDate.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/dateFormat / getRelativeTime

# Function: getRelativeTime()

> **getRelativeTime**(\`dateString\`): \`string\` \\| \`null\`

Defined in: [src/shared/utils/dateFormat.ts:74](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/dateFormat.ts#L74)

Coarse relative time from now, bucketed by days/weeks/months/years.

Buckets: \`'today'\`, \`'yesterday'\`, then \`N days ago\`, \`N weeks ago\`,
\`N months ago\`, \`N years ago\`.

## Parameters

### dateString

\`string\` \\| \`null\` \\| \`undefined\`

An ISO/parseable date string, or nullish.

## Returns

\`string\` \\| \`null\`

The relative-time label, or \`null\` for nullish/unparseable input.

## Example

\`\`\`ts
getRelativeTime(new Date(Date.now() - 3 * 864e5).toISOString()); // => '3 days ago'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/dateFormat / DateInput

# Type Alias: DateInput

> **DateInput** = \`Date\` \\| \`number\` \\| \`string\` \\| \`null\` \\| \`undefined\`

Defined in: [src/shared/utils/dateFormat.ts:8](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/dateFormat.ts#L8)

Accepted date inputs: a \`Date\`, an epoch-ms number, an ISO/parseable string, or nullish.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / analyzeMemberships

# Function: analyzeMemberships()

> **analyzeMemberships**(\`groups\`, \`rules\`, \`user\`, \`options?\`): \`GroupMembership\`[]

Defined in: [src/shared/utils/membershipAnalysis.ts:286](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L286)

Classify each of a user's groups as \`RULE_BASED\` or \`DIRECT\`.

The ladder, in order:
1. \`APP_GROUP\`s are always application-managed → \`RULE_BASED\`, no rule,
   \`attribution: 'exact'\`.
2. A group with no targeting ACTIVE rule → \`DIRECT\` (\`exact\`).
3. A user excluded from EVERY targeting ACTIVE rule — by name, or by being in
   a group the rule excludes — yet still in the group → \`DIRECT\` (\`exact\`);
   they were added manually despite the rules.
4. The user satisfies one or more non-excluding ACTIVE rules' conditions →
   \`RULE_BASED\` (\`exact\`), attributed to **all** of them. Two rules really can
   both put the same user in the same group; reporting only the first would be
   a fabricated singular answer.
5. Every non-excluding ACTIVE rule's condition was evaluated and none matched
   → \`DIRECT\` (\`exact\`) — a manual add into a rule-fed group.
6. Some condition is outside the client-side evaluable subset → \`RULE_BASED\`
   via the coarse scorer, over the candidates the evaluator did **not** rule
   out. Labelled \`inferred\` when the scorer found evidence or exactly one
   candidate survived; \`ambiguous\` when several indistinguishable candidates
   survived and no evidence separates them.

Only case 6 guesses, and it says which kind of guess it made.

## Parameters

### groups

\`OktaGroup\`[]

### rules

\`MembershipRule\`[]

### user

\`OktaUser\`

### options?

\`MembershipAnalysisOptions\` = \`{}\`

See MembershipAnalysisOptions. Supplying \`groups\` is
  what lets an \`isMemberOf*\` rule be answered rather than deferred.

## Returns

\`GroupMembership\`[]

One GroupMembership per input group, annotated with the
  evidence behind its classification and, when rule-based, the attributed
  rules.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / attributionNamesRules

# Function: attributionNamesRules()

> **attributionNamesRules**(\`attribution\`): \`boolean\`

Defined in: [src/shared/utils/membershipAnalysis.ts:101](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L101)

Whether an attribution licenses naming the rules it carries as the
membership's source — crediting them in a tally, deep-linking them as
"added by".

## Parameters

### attribution

\`MembershipAttribution\`

## Returns

\`boolean\`

\`true\` when each carried rule is at least a plausible source.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / attributionSemantics

# Function: attributionSemantics()

> **attributionSemantics**(\`attribution\`): \`AttributionSemantics\`

Defined in: [src/shared/utils/membershipAnalysis.ts:80](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L80)

How to act on one attribution class — see AttributionSemantics.

## Parameters

### attribution

\`MembershipAttribution\`

## Returns

\`AttributionSemantics\`

Its evidence kind and whether its rules may be named as the source.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / isDeducedAttribution

# Function: isDeducedAttribution()

> **isDeducedAttribution**(\`attribution\`): \`boolean\`

Defined in: [src/shared/utils/membershipAnalysis.ts:90](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L90)

Whether an attribution is a deduction rather than a fact — i.e. whether a
caller must present it as unconfirmed.

## Parameters

### attribution

\`MembershipAttribution\`

## Returns

\`boolean\`

\`true\` for every guessing class, \`false\` only for \`exact\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / isUserExcluded

# Function: isUserExcluded()

> **isUserExcluded**(\`rule\`, \`userId\`, \`groups\`): \`boolean\`

Defined in: [src/shared/utils/membershipAnalysis.ts:163](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L163)

Either exclusion route: the rule names this user, or names a group they are
in. Exported so the comparison's access-cause classifier asks this question
through one implementation rather than keeping its own.

## Parameters

### rule

\`MembershipRule\`

The rule, raw or formatted.

### userId

\`string\`

### groups

\`RuleGroupContext\` \\| \`undefined\`

The user's complete group list, or \`undefined\` when the caller
  has none; the group route is then not answerable and is not claimed.

## Returns

\`boolean\`

\`true\` when the rule is established to exclude this user.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / unclassifiedMemberships

# Function: unclassifiedMemberships()

> **unclassifiedMemberships**(\`groups\`): \`GroupMembership\`[]

Defined in: [src/shared/utils/membershipAnalysis.ts:232](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L232)

The answer for groups that could **not** be classified, because the inputs the
classifier needs were unavailable. Use it instead of calling
analyzeMemberships with a partial rule list, which would come back
\`DIRECT\`/\`exact\` — a fact claim manufactured out of a failed fetch.

\`UNKNOWN\` plus \`ambiguous\` is the vocabulary's way to say "not classified".
Callers must not cache the result as an analysis: it describes the load that
failed, not the org.

## Parameters

### groups

\`OktaGroup\`[]

## Returns

\`GroupMembership\`[]

One unclassified GroupMembership per group, in input order.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / AttributionSemantics

# Interface: AttributionSemantics

Defined in: [src/shared/utils/membershipAnalysis.ts:49](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L49)

What an attribution class means to a consumer that has to act on it.

## Properties

### evidence

> **evidence**: \`"fact"\` \\| \`"deduction"\`

Defined in: [src/shared/utils/membershipAnalysis.ts:55](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L55)

\`fact\` when the classification was proven from data; \`deduction\` when the
classifier guessed. A \`deduction\` must never be rendered with the visual
weight of an answer, and is what the group meter counts as indeterminate.

***

### namesRules

> **namesRules**: \`boolean\`

Defined in: [src/shared/utils/membershipAnalysis.ts:61](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L61)

Whether the rules the membership carries may be **named** as its source.
\`false\` for \`ambiguous\`: the list is a candidate set, so crediting any of
its entries would manufacture an attribution the classifier does not have.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/membershipAnalysis / MembershipAnalysisOptions

# Interface: MembershipAnalysisOptions

Defined in: [src/shared/utils/membershipAnalysis.ts:242](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L242)

Options for analyzeMemberships.

## Properties

### groups?

> \`readonly\` \`optional\` **groups?**: \`RuleGroupContext\`

Defined in: [src/shared/utils/membershipAnalysis.ts:253](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/membershipAnalysis.ts#L253)

The user's **complete** group list, which turns every \`isMemberOf*\` clause
and every group-based rule exclusion from unevaluable into a real verdict.

**Never derived from the \`groups\` argument.** \`groupSource\` and
\`memberSourceIndex\` call this with a one-group array — one member of one
group, not a person's whole access — so deriving a context there would turn
every group that member belongs to into a confident "they are not in it".
Omit it rather than passing a subset; see RuleGroupContext.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/mfaUtils / factorLabel

# Function: factorLabel()

> **factorLabel**(\`factorType\`, \`provider?\`): \`string\`

Defined in: [src/shared/utils/mfaUtils.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/mfaUtils.ts#L23)

Map an Okta factor (\`factorType\` + \`provider\`) to a friendly display label.

TOTP labels are further disambiguated by provider; an unknown type falls back
to a prettified \`factorType\`.

## Parameters

### factorType

\`string\`

### provider?

\`string\`

Optional Okta provider, e.g. \`'GOOGLE'\` or \`'OKTA'\`.

## Returns

\`string\`

A human-friendly label; \`'Unknown'\` if \`factorType\` is empty.

## Example

\`\`\`ts
factorLabel('token:software:totp', 'GOOGLE'); // => 'Google Authenticator'
factorLabel('webauthn'); // => 'Security Key (WebAuthn)'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/mfaUtils / isActiveMfaFactor

# Function: isActiveMfaFactor()

> **isActiveMfaFactor**(\`factor\`): \`boolean\`

Defined in: [src/shared/utils/mfaUtils.ts:72](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/mfaUtils.ts#L72)

Whether a factor counts toward MFA enrollment. Excludes the \`password\`
factor (which is base credentials, not a second factor) and only counts
\`ACTIVE\` factors.

## Parameters

### factor

\`OktaFactor\`

The Okta factor to test.

## Returns

\`boolean\`

\`true\` if the factor is active and is not a password factor.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/mfaUtils / summarizeFactors

# Function: summarizeFactors()

> **summarizeFactors**(\`userId\`, \`factors\`): \`MemberMfaResult\`

Defined in: [src/shared/utils/mfaUtils.ts:84](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/mfaUtils.ts#L84)

Summarize a user's factors into a MemberMfaResult. Counts only
active MFA factors and collects their
de-duplicated, sorted labels; \`factors\` is preserved
unchanged.

## Parameters

### userId

\`string\`

### factors

\`OktaFactor\`[]

The user's factors; nullish is treated as empty.

## Returns

\`MemberMfaResult\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaId / oktaIdKind

# Function: oktaIdKind()

> **oktaIdKind**(\`candidate\`): \`OktaIdKind\` \\| \`null\`

Defined in: [src/shared/utils/oktaId.ts:73](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaId.ts#L73)

Classify a candidate string as an Okta entity id.

Surrounding whitespace is trimmed, since ids usually arrive pasted. Nothing
else is normalised: Okta ids are case-sensitive, so lowercasing one produces
a plausible id that does not exist.

## Parameters

### candidate

\`string\`

## Returns

\`OktaIdKind\` \\| \`null\`

The entity kind, or \`null\` when the input is not a well-formed id of
a kind this app can reach. \`null\` is the signal to search by name instead.

## Example

\`\`\`ts
oktaIdKind('00gFAKE0000000000001');   // 'group'
oktaIdKind('  0prFAKE0000000000001'); // 'rule'   (pasted with whitespace)
oktaIdKind('00pFAKE0000000000001');   // null     (policy — no destination)
oktaIdKind('00gTOOSHORT');            // null     (right prefix, wrong shape)
oktaIdKind('ada@example.com');        // null     (search this instead)
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaId / OktaIdKind

# Type Alias: OktaIdKind

> **OktaIdKind** = \`"group"\` \\| \`"user"\` \\| \`"app"\` \\| \`"rule"\`

Defined in: [src/shared/utils/oktaId.ts:20](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaId.ts#L20)

The entity kinds this app can identify from an id prefix alone.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / PaginatedFetchError

# Class: PaginatedFetchError

Defined in: [src/shared/utils/oktaPagination.ts:150](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L150)

Thrown by fetchAllPages when a page request fails, carrying the status
the failing PaginatedPageResult reported. Callers narrow on
\`error instanceof PaginatedFetchError\` rather than re-deriving a status from
the message string.

## Extends

- \`Error\`

## Constructors

### Constructor

> **new PaginatedFetchError**(\`message\`, \`status?\`): \`PaginatedFetchError\`

Defined in: [src/shared/utils/oktaPagination.ts:154](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L154)

#### Parameters

##### message

\`string\`

##### status?

\`number\`

#### Returns

\`PaginatedFetchError\`

#### Overrides

\`Error.constructor\`

## Properties

### status?

> \`readonly\` \`optional\` **status?**: \`number\`

Defined in: [src/shared/utils/oktaPagination.ts:152](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L152)

The failing page's HTTP status, or \`undefined\` when none was reported.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / fetchAllPages

# Function: fetchAllPages()

> **fetchAllPages**\\<\`T\`\\>(\`request\`, \`firstUrl\`, \`options?\`): \`Promise\`\\<\`T\`[]\\>

Defined in: [src/shared/utils/oktaPagination.ts:215](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L215)

Fetch every page of an Okta list endpoint, following \`Link\` pagination with
the nextPageUrl guard so a misbehaving endpoint cannot loop forever.

## Type Parameters

### T

\`T\` = \`unknown\`

## Parameters

### request

(\`url\`) => \`Promise\`\\<\`PaginatedPageResult\`\\>

Issues one page request; its result is any
PaginatedPageResult-shaped object.

### firstUrl

\`string\`

Origin-relative URL of the first page.

### options?

\`FetchAllPagesOptions\`\\<\`T\`\\> = \`{}\`

## Returns

\`Promise\`\\<\`T\`[]\\>

All items accumulated across pages, validated when \`schema\` is given.

## Throws

PaginatedFetchError when any page returns \`success: false\`,
carrying the response's HTTP status so a caller can tell why the walk
stopped. Callers that prefer partial results accumulate via \`onPage\` and
catch.

## Remarks

The termination guard keys off the RAW page length, before schema
validation, so an all-malformed page still advances the cursor rather than
truncating the walk.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / nextPageUrl

# Function: nextPageUrl()

> **nextPageUrl**(\`currentUrl\`, \`linkHeader\`, \`pageSize\`): \`string\` \\| \`null\`

Defined in: [src/shared/utils/oktaPagination.ts:57](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L57)

Decide the next page URL for a \`Link\`-header pagination loop, guarding against
Okta returning a \`rel="next"\` link that would never terminate.

Some Okta list endpoints hand back a \`next\` link on an empty or
self-referential final page, so a loop trusting the link alone pages forever.
This stops when there is no next link, when the page was empty, or when the
cursor did not advance.

## Parameters

### currentUrl

\`string\`

### linkHeader

\`string\` \\| \`undefined\`

### pageSize

\`number\`

Number of items the page returned.

## Returns

\`string\` \\| \`null\`

The next page URL, or \`null\` to stop paginating.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / parseNextLink

# Function: parseNextLink()

> **parseNextLink**(\`linkHeader?\`): \`string\` \\| \`null\`

Defined in: [src/shared/utils/oktaPagination.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L29)

Extract the \`rel="next"\` pagination target from an Okta \`Link\` response header.

## Parameters

### linkHeader?

\`string\`

Raw \`Link\` header value, possibly several comma-separated
links.

## Returns

\`string\` \\| \`null\`

The next page as an origin-relative \`pathname + search\`, or \`null\`
when there is none. Relative so a caller can re-issue it through
\`CoreApi.makeApiRequest\` without carrying the absolute Okta origin.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / FetchAllPagesOptions

# Interface: FetchAllPagesOptions\\<T\\>

Defined in: [src/shared/utils/oktaPagination.ts:162](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L162)

Options for fetchAllPages.

## Type Parameters

### T

\`T\`

## Properties

### onPage?

> \`optional\` **onPage?**: (\`items\`, \`totalSoFar\`) => \`void\`

Defined in: [src/shared/utils/oktaPagination.ts:164](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L164)

Called after each page with that page's (validated) items and the running total.

#### Parameters

##### items

\`T\`[]

##### totalSoFar

\`number\`

#### Returns

\`void\`

***

### onBeforePage?

> \`optional\` **onBeforePage?**: (\`pageNumber\`) => \`void\`

Defined in: [src/shared/utils/oktaPagination.ts:166](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L166)

Called before each page request with the 1-based page number (progress messaging).

#### Parameters

##### pageNumber

\`number\`

#### Returns

\`void\`

***

### schema?

> \`optional\` **schema?**: \`ZodType\`\\<\`T\`, \`ZodTypeDef\`, \`unknown\`\\>

Defined in: [src/shared/utils/oktaPagination.ts:171](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L171)

Per-item zod schema applied to each page via \`parseOktaList\` — lenient, so
malformed rows are dropped and counted in a log warning, never thrown on.

***

### preserveParams?

> \`optional\` **preserveParams?**: \`string\`[]

Defined in: [src/shared/utils/oktaPagination.ts:177](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L177)

Query parameter names that must survive onto every page, because Okta does
not always echo a first-page parameter into its \`rel="next"\` link. Opt-in:
omit it and the walk's URLs are byte-for-byte the ones Okta handed back.

***

### onCursor?

> \`optional\` **onCursor?**: (\`nextUrl\`, \`pageNumber\`) => \`void\`

Defined in: [src/shared/utils/oktaPagination.ts:183](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L183)

Called after each page with the URL the walk will fetch next, or \`null\` when
the page just handled was the last — so a caller that persists progress can
record a resume point without re-implementing the walk.

#### Parameters

##### nextUrl

\`string\` \\| \`null\`

##### pageNumber

\`number\`

#### Returns

\`void\`

***

### paramSource?

> \`optional\` **paramSource?**: \`string\`

Defined in: [src/shared/utils/oktaPagination.ts:190](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L190)

Where preserveParams reads its values from, when that is not
\`firstUrl\`. A resumed walk starts at a cursor URL, so its parameters must
come from the canonical first URL — reading them from the cursor would
re-apply only what Okta already echoed. Defaults to \`firstUrl\`.

***

### maxPages?

> \`optional\` **maxPages?**: \`number\`

Defined in: [src/shared/utils/oktaPagination.ts:192](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L192)

Hard cap on the number of pages fetched; unlimited when omitted.

***

### context?

> \`optional\` **context?**: \`string\`

Defined in: [src/shared/utils/oktaPagination.ts:194](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L194)

Label for validation/log messages; defaults to the first URL's path (query stripped).

***

### errorMessage?

> \`optional\` **errorMessage?**: \`string\`

Defined in: [src/shared/utils/oktaPagination.ts:196](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L196)

Error message thrown for a failed page whose response carries no \`error\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / PaginatedPageResult

# Interface: PaginatedPageResult

Defined in: [src/shared/utils/oktaPagination.ts:126](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L126)

The per-page transport result fetchAllPages consumes — a structural
subset of the scheduler's \`RequestResult\` (\`shared/scheduler/types\`) and the
content script's \`ApiResponse\`, so both transports plug in unchanged.

## Properties

### success

> **success**: \`boolean\`

Defined in: [src/shared/utils/oktaPagination.ts:128](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L128)

Whether the page request succeeded.

***

### data?

> \`optional\` **data?**: \`unknown\`

Defined in: [src/shared/utils/oktaPagination.ts:130](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L130)

Raw response payload; expected to be the page's item array.

***

### headers?

> \`optional\` **headers?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/utils/oktaPagination.ts:132](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L132)

Response headers (the \`link\` header drives pagination).

***

### error?

> \`optional\` **error?**: \`string\`

Defined in: [src/shared/utils/oktaPagination.ts:134](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L134)

Transport/HTTP error message when \`success\` is \`false\`.

***

### status?

> \`optional\` **status?**: \`number\`

Defined in: [src/shared/utils/oktaPagination.ts:141](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L141)

HTTP status of the page request, when the transport supplied one, or
\`NO_HTTP_STATUS\` when the request never produced a response. Optional, so a
caller that cares *why* a walk stopped treats an absent status as unknown,
never as success.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaPagination / OKTA\\_PAGE\\_SIZE

# Variable: OKTA\\_PAGE\\_SIZE

> \`const\` **OKTA\\_PAGE\\_SIZE**: \`200\` = \`200\`

Defined in: [src/shared/utils/oktaPagination.ts:18](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaPagination.ts#L18)

The standard page size for Okta list endpoints (\`?limit=200\`) — the maximum
most collection endpoints accept, so a full walk issues the fewest requests.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaUrl / isOktaUrl

# Function: isOktaUrl()

> **isOktaUrl**(\`url\`): \`boolean\`

Defined in: [src/shared/utils/oktaUrl.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaUrl.ts#L26)

Whether \`url\` points at an Okta org (commercial, preview, or EMEA).

Matches the parsed **hostname** (exact or dot-separated subdomain) over HTTPS
only, so \`https://okta.com.evil.com/\` cannot pass — this check gates which tab
the extension treats as the authenticated Okta session. Nullish and
unparseable input are not Okta, so callers can pass \`tab.url\` directly.

## Parameters

### url

\`string\` \\| \`null\` \\| \`undefined\`

## Returns

\`boolean\`

\`true\` if the URL's hostname is a known Okta domain.

## Example

\`\`\`ts
isOktaUrl('https://acme.okta.com/admin'); // => true
isOktaUrl('https://okta.com.evil.com/'); // => false
isOktaUrl(undefined); // => false
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaUrl / oktaAdminEntityUrl

# Function: oktaAdminEntityUrl()

> **oktaAdminEntityUrl**(\`origin\`, \`target\`): \`string\` \\| \`null\`

Defined in: [src/shared/utils/oktaUrl.ts:95](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaUrl.ts#L95)

Build the Okta Admin Console deep link for a single entity, so every "Open in
Okta" affordance targets the same paths.

## Parameters

### origin

\`string\` \\| \`null\` \\| \`undefined\`

The Okta org origin (e.g. \`https://acme.okta.com\`), or nullish.

### target

\`OktaAdminTarget\`

## Returns

\`string\` \\| \`null\`

The absolute admin URL, or \`null\` when any part of the target is
missing — a link that cannot be built correctly is not rendered at all.

## Example

\`\`\`ts
oktaAdminEntityUrl('https://acme.okta.com', { type: 'user', id: '00u1' });
// => .../admin/user/profile/view/00u1
oktaAdminEntityUrl('https://acme.okta.com', { type: 'app', id: '0oa1', name: 'oidc_client' });
// => .../admin/app/oidc_client/instance/0oa1
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaUrl / oktaOriginOf

# Function: oktaOriginOf()

> **oktaOriginOf**(\`url\`): \`string\` \\| \`null\`

Defined in: [src/shared/utils/oktaUrl.ts:50](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaUrl.ts#L50)

The Okta org origin a URL belongs to — the key the org snapshot is scoped by.
Same parsing rules as isOktaUrl, so no caller slices an origin out of
a URL string by hand.

## Parameters

### url

\`string\` \\| \`null\` \\| \`undefined\`

## Returns

\`string\` \\| \`null\`

The \`https://host\` origin when the URL is an Okta org, else \`null\`.

## Example

\`\`\`ts
oktaOriginOf('https://acme.okta.com/admin/groups'); // => 'https://acme.okta.com'
oktaOriginOf('https://okta.com.evil.com/'); // => null
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/oktaUrl / OktaAdminTarget

# Type Alias: OktaAdminTarget

> **OktaAdminTarget** = \\{ \`type\`: \`"group"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \\} \\| \\{ \`type\`: \`"user"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \\} \\| \\{ \`type\`: \`"app"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \`name\`: \`string\` \\| \`null\` \\| \`undefined\`; \\}

Defined in: [src/shared/utils/oktaUrl.ts:67](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/oktaUrl.ts#L67)

What to deep-link to — and, by its members, the only entity kinds that have an
Okta Admin Console deep link at all.

A union rather than a \`(type, id)\` pair because an app's Admin Console route
is keyed by the app **type** (its Okta \`name\`, e.g. \`oidc_client\`) as well as
its instance id, and the id alone cannot produce a working URL.

## Union Members

### Type Literal

\\{ \`type\`: \`"group"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \\}

***

### Type Literal

\\{ \`type\`: \`"user"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \\}

***

### Type Literal

\\{ \`type\`: \`"app"\`; \`id\`: \`string\` \\| \`null\` \\| \`undefined\`; \`name\`: \`string\` \\| \`null\` \\| \`undefined\`; \\}

#### type

> **type**: \`"app"\`

#### id

> **id**: \`string\` \\| \`null\` \\| \`undefined\`

#### name

> **name**: \`string\` \\| \`null\` \\| \`undefined\`

The app's Okta \`name\` — the app type key, not its display label.
Nullish when the org did not report one (\`oktaAppListItemSchema\` catches
the field), in which case no link is built rather than a broken one.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / pluralNoun

# Function: pluralNoun()

> **pluralNoun**(\`count\`, \`noun\`): \`string\`

Defined in: [src/shared/utils/plural.ts:61](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L61)

The noun alone, in the form the count calls for — no number.

## Parameters

### count

\`number\`

### noun

\`Noun\`

Singular string, or explicit NounForms for an irregular.

## Returns

\`string\`

The singular form at a count of one, the plural form otherwise.

## Example

\`\`\`ts
pluralNoun(1, 'group'); // => 'group'
pluralNoun(0, 'group'); // => 'groups'
pluralNoun(1, { one: 'Policy', other: 'Policies' }); // => 'Policy'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / pluralSuffix

# Function: pluralSuffix()

> **pluralSuffix**(\`count\`): \`string\`

Defined in: [src/shared/utils/plural.ts:46](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L46)

The bare plural suffix — \`''\` at one, \`'s'\` otherwise.

For copy already assembled around the noun, as in
\`\` \`\${n} match\${pluralSuffix(n) && 'es'}\` \`\`. Prefer pluralNoun when
the whole noun is available.

## Parameters

### count

\`number\`

## Returns

\`string\`

\`''\` when \`count\` is exactly \`1\`, otherwise \`'s'\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / pluralize

# Function: pluralize()

> **pluralize**(\`count\`, \`noun\`): \`string\`

Defined in: [src/shared/utils/plural.ts:77](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L77)

A count and its noun as one phrase, with the number localised.

## Parameters

### count

\`number\`

How many; rendered with \`toLocaleString()\`.

### noun

\`Noun\`

Singular string, or explicit NounForms for an irregular.

## Returns

\`string\`

\`"<count> <noun>"\`, e.g. \`'1 group'\`, \`'1,204 applications'\`.

## Example

\`\`\`ts
pluralize(1, 'application'); // => '1 application'
pluralize(3, { one: 'Policy', other: 'Policies' }); // => '3 Policies'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / singularOf

# Function: singularOf()

> **singularOf**(\`plural\`): \`string\`

Defined in: [src/shared/utils/plural.ts:97](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L97)

Best-effort singular of a regular English plural.

Regular plurals only: \`-ies → -y\`, \`-sses/-shes/-ches/-xes/-zes\` drop the
\`es\`, a doubled \`ss\` (\`access\`) is left alone, anything else drops a trailing
\`s\`. **Not an inflector** — it will not know \`people\` or \`indices\`. A caller
with an irregular noun states both forms via NounForms instead.

## Parameters

### plural

\`string\`

The plural noun, e.g. \`'group rules'\`.

## Returns

\`string\`

The derived singular, or \`plural\` unchanged when it does not end in \`s\`.

## Example

\`\`\`ts
singularOf('applications'); // => 'application'
singularOf('policies');     // => 'policy'
singularOf('group rules');  // => 'group rule'
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / NounForms

# Interface: NounForms

Defined in: [src/shared/utils/plural.ts:17](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L17)

A noun whose plural is not the singular plus \`s\` — \`{ one: 'Policy', other: 'Policies' }\`.

## Properties

### one

> **one**: \`string\`

Defined in: [src/shared/utils/plural.ts:19](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L19)

The form used at a count of exactly one.

***

### other

> **other**: \`string\`

Defined in: [src/shared/utils/plural.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L21)

The form used at every other count, zero and fractions included.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/plural / Noun

# Type Alias: Noun

> **Noun** = \`string\` \\| \`NounForms\`

Defined in: [src/shared/utils/plural.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/plural.ts#L30)

A noun, in either of the two ways callers hold one.

A bare string is the **singular**, and its plural is that string plus \`s\`.
Anything irregular is spelled out as NounForms.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/profileFields / getCustomProfileFields

# Function: getCustomProfileFields()

> **getCustomProfileFields**(\`profile\`): \\[\`string\`, \`unknown\`\\][]

Defined in: [src/shared/utils/profileFields.ts:77](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/profileFields.ts#L77)

Return the non-standard, non-excluded, non-empty profile entries to render as
"Custom Attributes".

## Parameters

### profile

\`Record\`\\<\`string\`, \`unknown\`\\>

The user's Okta profile object.

## Returns

\\[\`string\`, \`unknown\`\\][]

\`[key, value]\` pairs for every field that is not a standard field,
  not a security-sensitive field, and whose
  value is not \`null\`/\`undefined\`/\`''\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/profileFields / isExcludedProfileField

# Function: isExcludedProfileField()

> **isExcludedProfileField**(\`key\`): \`boolean\`

Defined in: [src/shared/utils/profileFields.ts:64](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/profileFields.ts#L64)

Whether a profile key is security-sensitive and
must never be surfaced in the UI. Matches both the raw and lower-cased key.
Single source of truth for the exclusion so every consumer (custom-attributes
and the "All attributes" view) stays in sync.

## Parameters

### key

\`string\`

The profile attribute name.

## Returns

\`boolean\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/profileFields / BASE\\_PROFILE\\_ATTRIBUTES

# Variable: BASE\\_PROFILE\\_ATTRIBUTES

> \`const\` **BASE\\_PROFILE\\_ATTRIBUTES**: readonly \`string\`[]

Defined in: [src/shared/utils/profileFields.ts:101](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/profileFields.ts#L101)

Okta's base user-profile attributes, in the order Okta's own documentation
lists them.

**Fallback only.** The authoritative list is the org's own schema
(\`getUserProfileSchema\`), which carries titles, types, mutability, and the
org's custom attributes. Use this only when that call returns \`null\`, so the
inventory still shows every base attribute rather than collapsing to the keys
present on one profile.

Not filtered here: consumers must still run every key through
isExcludedProfileField.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/profileFields / EXCLUDED\\_PROFILE\\_FIELDS

# Variable: EXCLUDED\\_PROFILE\\_FIELDS

> \`const\` **EXCLUDED\\_PROFILE\\_FIELDS**: \`Set\`\\<\`string\`\\>

Defined in: [src/shared/utils/profileFields.ts:13](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/profileFields.ts#L13)

Security-sensitive profile field names that must never be rendered in the UI.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/profileFields / STANDARD\\_PROFILE\\_FIELDS

# Variable: STANDARD\\_PROFILE\\_FIELDS

> \`const\` **STANDARD\\_PROFILE\\_FIELDS**: \`Set\`\\<\`string\`\\>

Defined in: [src/shared/utils/profileFields.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/profileFields.ts#L29)

Profile keys the Users tab already renders in dedicated sections (Account,
Organization, Contact, Preferences, identity header). Anything not in this set
— and not excluded — is treated as a custom attribute.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/redact / redactJson

# Function: redactJson()

> **redactJson**(\`value\`, \`oktaOrigin?\`): \`RedactionResult\`

Defined in: [src/shared/utils/redact.ts:152](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/redact.ts#L152)

Redact PII and Okta entity ids from an arbitrary parsed JSON value.

## Parameters

### value

\`unknown\`

Parsed JSON (object, array, or primitive) to redact.

### oktaOrigin?

\`string\`

The live org's origin, used to scrub the org's own
hostname out of embedded URLs. Omit when unavailable; hostname redaction is
then skipped.

## Returns

\`RedactionResult\`

The redacted value plus a count of substitutions made.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/redact / RedactionResult

# Interface: RedactionResult

Defined in: [src/shared/utils/redact.ts:19](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/redact.ts#L19)

One redaction pass over a JSON value, plus how many substitutions it made.

## Properties

### data

> **data**: \`unknown\`

Defined in: [src/shared/utils/redact.ts:20](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/redact.ts#L20)

***

### redactedCount

> **redactedCount**: \`number\`

Defined in: [src/shared/utils/redact.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/redact.ts#L21)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/regexQuery / parseRegexQuery

# Function: parseRegexQuery()

> **parseRegexQuery**(\`query\`): \`RegExp\` \\| \`null\`

Defined in: [src/shared/utils/regexQuery.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/regexQuery.ts#L23)

Parse a rockstar-style \`/pattern/flags\` regex query.

The \`g\` and \`y\` flags are stripped because they make \`.test()\` stateful
across the many calls one filter pass makes; \`i\`/\`m\`/\`s\`/\`u\` are preserved.

## Parameters

### query

\`string\`

## Returns

\`RegExp\` \\| \`null\`

A compiled regex, or \`null\` when the query is not slash-wrapped or
the pattern is invalid — the caller then falls back to substring matching.

## Example

\`\`\`ts
parseRegexQuery('/^sales-/i'); // => a RegExp matching names starting "sales-"
parseRegexQuery('sales');      // => null (plain substring query)
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / formatShape

# Function: formatShape()

> **formatShape**(\`shape\`, \`indent?\`): \`string\`

Defined in: [src/shared/utils/shapeInference.ts:133](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L133)

Render a ShapeType as a readable, TypeScript-like type outline —
field names and structure only, no values.

## Parameters

### shape

\`ShapeType\`

### indent?

\`number\` = \`0\`

## Returns

\`string\`

## Example

\`\`\`ts
formatShape(inferShape({ id: '00u123', active: true }));
// "{\\n  active: boolean;\\n  id: string;\\n}"
\`\`\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / inferShape

# Function: inferShape()

> **inferShape**(\`value\`): \`ShapeType\`

Defined in: [src/shared/utils/shapeInference.ts:33](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L33)

Infer the structural shape of a single JSON value.

## Parameters

### value

\`unknown\`

## Returns

\`ShapeType\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / mergeShapes

# Function: mergeShapes()

> **mergeShapes**(\`shapes\`): \`ShapeType\`

Defined in: [src/shared/utils/shapeInference.ts:106](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L106)

Collapse several shapes (e.g. one per array item) into one representative
shape. All-object inputs merge field-by-field; anything else dedupes by
structural signature and, if more than one distinct shape remains, becomes a
union.

## Parameters

### shapes

\`ShapeType\`[]

## Returns

\`ShapeType\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / shapeOutline

# Function: shapeOutline()

> **shapeOutline**(\`value\`): \`string\`

Defined in: [src/shared/utils/shapeInference.ts:160](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L160)

Infer and render a value's shape outline in one call — the API Explorer's Shape view.

## Parameters

### value

\`unknown\`

## Returns

\`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / ShapeField

# Interface: ShapeField

Defined in: [src/shared/utils/shapeInference.ts:25](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L25)

One field of an inferred object shape.

## Properties

### key

> **key**: \`string\`

Defined in: [src/shared/utils/shapeInference.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L26)

***

### type

> **type**: \`ShapeType\`

Defined in: [src/shared/utils/shapeInference.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L27)

***

### optional

> **optional**: \`boolean\`

Defined in: [src/shared/utils/shapeInference.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L29)

Set when the field was absent from at least one merged array item.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/shapeInference / ShapeType

# Type Alias: ShapeType

> **ShapeType** = \\{ \`kind\`: \`"string"\`; \\} \\| \\{ \`kind\`: \`"number"\`; \\} \\| \\{ \`kind\`: \`"boolean"\`; \\} \\| \\{ \`kind\`: \`"null"\`; \\} \\| \\{ \`kind\`: \`"unknown"\`; \\} \\| \\{ \`kind\`: \`"array"\`; \`element\`: \`ShapeType\`; \\} \\| \\{ \`kind\`: \`"object"\`; \`fields\`: \`ShapeField\`[]; \\} \\| \\{ \`kind\`: \`"union"\`; \`options\`: \`ShapeType\`[]; \\}

Defined in: [src/shared/utils/shapeInference.ts:14](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/shapeInference.ts#L14)

A structural type node — never carries a value, only shape.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/userDisplay / hueFromId

# Function: hueFromId()

> **hueFromId**(\`id\`): \`number\`

Defined in: [src/shared/utils/userDisplay.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/userDisplay.ts#L47)

Deterministic hue (0–359) derived from a user id, so avatar colors stay
consistent across renders: a \`* 31\` rolling hash mod 360. The exact arithmetic
is a rendering contract for the avatar gradient — do not "simplify" it.

## Parameters

### id

\`string\`

## Returns

\`number\`

An integer hue in the range 0–359.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/userDisplay / initialsOf

# Function: initialsOf()

> **initialsOf**(\`user\`): \`string\`

Defined in: [src/shared/utils/userDisplay.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/userDisplay.ts#L30)

Two-letter initials for an avatar, derived from first/last name, else the
first two characters of login/email, upper-cased.

## Parameters

### user

\`OktaUser\`

## Returns

\`string\`

Up to two upper-cased characters; \`'?'\` when no source is available.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/utils/userDisplay / userDisplayName

# Function: userDisplayName()

> **userDisplayName**(\`user\`): \`string\`

Defined in: [src/shared/utils/userDisplay.ts:19](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/utils/userDisplay.ts#L19)

Display name for an Okta user: "First Last", falling back to login, then email,
then the literal \`'User'\`.

NOTE: not consolidated with \`memberAnalytics.memberFullName\`, which falls
back to \`name || login || ''\` rather than \`name || login || email || 'User'\`.
A swap would change rendered text.

## Parameters

### user

\`OktaUser\`

## Returns

\`string\`

A non-empty display string.`;function a(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(r,{title:"Internals/Shared utilities"}),`
`,n.jsx(i,{children:o})]})}function h(e={}){const{wrapper:t}={...s(),...e.components};return t?n.jsx(t,{...e,children:n.jsx(a,{...e})}):a()}export{h as default};
