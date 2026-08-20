# Users and MFA

User state and authenticator enrolment are the two highest-traffic reporting
questions after group membership. Both have vocabulary traps that turn a correct
query into a wrong conclusion.

Marker legend lives in `../SKILL.md`.

## User status

`[verified: shared/schemas/okta → userStatusSchema]`

| Status             | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `STAGED`           | Created, activation never started. Cannot sign in.            |
| `PROVISIONED`      | Activation started, not completed. Cannot sign in yet.        |
| `ACTIVE`           | Normal, can sign in.                                          |
| `RECOVERY`         | In a password-recovery flow.                                  |
| `PASSWORD_EXPIRED` | Must set a new password before proceeding.                    |
| `LOCKED_OUT`       | Locked by failed sign-in attempts.                            |
| `SUSPENDED`        | Administratively disabled; retains group and app assignments. |
| `DEPROVISIONED`    | Deactivated. Cannot sign in.                                  |

**The reporting traps:**

- **`SUSPENDED` and `DEPROVISIONED` users keep their group memberships and app
  assignments.** Deactivating a user does not strip access grants; it stops them
  being usable. "Who can access X" and "who is assigned X" are different questions,
  and the second one includes these users. Report which one is being answered.
- **`STAGED` and `PROVISIONED` are not the same as `ACTIVE`.** A report counting
  "users who exist" and one counting "users who can sign in" differ by these two,
  plus `DEPROVISIONED` and `SUSPENDED`.
- **Group rules skip `DEPROVISIONED` and deleted users**, but do evaluate against
  `LOCKED_OUT`, `STAGED`, `SUSPENDED`, and password-reset states. `[docs]`
- Status vocabulary in the admin console differs from the API's. Normalise before
  comparing a console export with an API result.
  `[unverified: was shared/utils/statusNormalizer, retired as dead code in ADR-0022]`

Filter on it with `search`, not `filter`:

```
GET /api/v1/users?search=status eq "SUSPENDED"&limit=200
```

## User object

```
GET /api/v1/users/{userIdOrLogin}
GET /api/v1/users?search=…&limit=200
```

The path accepts a login or email as well as an id, which is convenient
interactively and a hazard programmatically — an email that looks like an id
resolves differently. Use ids in automation.

Timestamps worth knowing: `created`, `activated`, `statusChanged`, `lastLogin`,
`lastUpdated`, `passwordChanged`. `[verified: shared/schemas/okta → oktaUserSchema]`

**`lastLogin` is the closest thing to an activity signal**, and it is often the real
question behind "find stale accounts". It can be null for a user who has never
signed in — null is not a very old date, and sorting must not treat it as one.

`managedBy.rules` may appear on a user object, naming rules that manage them.
`[verified: shared/schemas/okta]`

### Profile

`profile` holds both Okta's default attributes (`login`, `email`, `firstName`,
`lastName`, `secondEmail`, `mobilePhone`, `department`, `title`, `manager`,
`managerId`, `userType`, …) and every custom attribute the org has defined.
`[verified: shared/schemas/okta → oktaProfileSchema]`

Treat the profile as **open**: never assume the documented attributes are all of
them, and never drop unknown keys when passing a profile through. Validate the
fields you use and let the rest pass.

Custom attributes are queryable with `search`, generally not with `filter`. To
discover what exists rather than guessing, read the schema:

```
GET /api/v1/meta/schemas/user/default      # default user type schema
GET /api/v1/meta/types/user                # user types in the org
```

`[unverified]` — endpoints are correct; the response shapes here are not
repo-exercised. Fetch the schema docs from `doc-sources.md` before depending on
field-level detail.

**`/default` is the schema of the default user type, not of every user.** A user
on a custom type is governed by that type's schema, reachable through
`/api/v1/meta/types/user` → `_links.schema.href`. A gate that reads `/default`
for everyone applies one type's `mutability` and `master` blocks to another
type's users. `[docs]`

## Profile sourcing (profile mastering)

The question — _"can I edit this attribute on this user, or does something else
own it?"_ — is answered by two facts that live in different responses, and
conflating them is how a panel comes to lock every attribute in the org.

### `master.type` has three values and they are not variations on a theme

`[docs]` `[verified: sidepanel/components/users/profileEditability, ADR-0037]`

| `master.type`    | Means                                                  | Carries `master.priority` |
| ---------------- | ------------------------------------------------------ | ------------------------- |
| `OKTA`           | Okta owns the attribute.                               | no                        |
| `PROFILE_MASTER` | Follows the **org's** profile-source order.            | **no**                    |
| `OVERRIDE`       | This attribute has its own source list, per attribute. | yes                       |

**`master.priority` is populated for `OVERRIDE` and only for `OVERRIDE`.** The
terraform provider states it outright — _"Prioritized list of profile sources
(required when 'master' is 'OVERRIDE')"_ — and its entries are
`{ type: 'APP', value: '<appInstanceId>' }` (AD and LDAP are app instances too).

This is the trap. `PROFILE_MASTER` is the value orgs carry on ordinary base
attributes, and it names **no sources at all**, because the order it follows is
org-level. Code that resolves a `PROFILE_MASTER` block by walking its `priority`
is reading a field that is never there — it will not error, it will simply always
find nothing, and whatever it does with "nothing" becomes its answer for the
entire org. This repo shipped that bug and had to write ADR-0037 about it.

### The profile source is on the app row — no extra call

`[verified: useOktaApi/userOperations → getUserApps, shared/schemas/okta →
isProfileSourceApp, ADR-0037]`

Asked whether a user's profile source is available through the API, Okta Support
answers _"currently, there is no API call to determine the user's profile
source."_ `[docs]` That is true of a dedicated endpoint and **false of the
question**. The Admin Console derives it from the ordinary assigned-apps call:

```
GET /api/v1/apps?filter=user.id eq "{userId}"&expand=user/{userId}&limit=200
```

Each row carries `features`, e.g.
`["IMPORT_PROFILE_UPDATES", "PROFILE_MASTERING", "IMPORT_NEW_USERS"]`. An app
whose `features` contain **`PROFILE_MASTERING`** is a profile source for the
users assigned to it. Since this is the same request a user's app list already
costs, the profile source is **free** — do not reach for `/api/v1/mappings` to
answer this.

Three things that make the difference between right and plausible:

- **`IMPORT_PROFILE_UPDATES` is not a synonym.** An app can import profile
  updates without being anyone's source of truth. Accepting it as equivalent
  locks attributes for every user of every provisioned app.
- **`orn` corroborates, it does not decide.** A Custom Identity Source app's
  `orn` carries a `custom_identity_source` segment, which names the _kind_ of
  source — but AD, LDAP and HR apps are profile sources without it.
- **No source attached means Okta is the source.** _"If an external profile
  source isn't identified, Okta is the source for all profiles."_ `[docs]` A user
  assigned to none of the org's profile-source apps is Okta-mastered, and their
  `PROFILE_MASTER` attributes are editable — including in orgs that do have a
  profile source, for every user that source has never heard of.

**Only one profile source per user at a time.** `[docs]` Several attached sources
are resolved by an org-level priority order Okta does not expose, so a user in two
of them has a source you can bound but cannot name. Say so; do not pick one.

**The residual.** Assignment is not confirmed matching. A user assigned to a
profile-source app that Okta has not linked them to is reported the same way as
one it has. The `expand=user/{userId}` embed carries `syncState` and `externalId`,
which narrow it — `[unverified]`, value vocabulary not confirmed here.

**`profile.userType` is a plain string and is not the same thing as a user _type_
object.** A rule or report keying on `profile.userType` is reading a profile field.
The user-type object from `/api/v1/meta/types/user` is a separate concept governing
which schema applies. Group rules validate only against the **default** Okta user
type, so a rule referencing a custom user type's attributes will not work as
written. `[docs]`

### Lifecycle operations

```
POST /api/v1/users/{id}/lifecycle/activate
POST /api/v1/users/{id}/lifecycle/reactivate
POST /api/v1/users/{id}/lifecycle/deactivate
POST /api/v1/users/{id}/lifecycle/suspend
POST /api/v1/users/{id}/lifecycle/unsuspend
POST /api/v1/users/{id}/lifecycle/unlock
POST /api/v1/users/{id}/lifecycle/expire_password
POST /api/v1/users/{id}/lifecycle/reset_password?sendEmail=true
```

`[verified: useOktaApi/userOperations]` (suspend, unsuspend, reset_password);
remainder `[docs]`.

Lifecycle transitions are constrained by current status — suspending a
`DEPROVISIONED` user is an error, not a no-op. Read status first, and treat a
lifecycle 4xx as "wrong starting state" before assuming a permissions problem.

`reset_password` with `sendEmail=true` mails the user; with `sendEmail=false` it
returns a one-time reset link instead. Choose deliberately — the second is a
credential-bearing value that must not be logged.

### A user's groups

```
GET /api/v1/users/{userId}/groups?limit=200      # memberships
GET /api/v1/users/{userId}/groups?limit=1        # count via x-total-count
```

No attribution embed and no membership timestamps exist here. See
`groups-and-rules.md`.

## MFA: factors and authenticators

### The distinction that changes the answer

Classic Engine used **factor** and **authenticator** interchangeably. Identity
Engine separates them: a _factor_ is the category of proof (knowledge, possession,
biometric), an _authenticator_ is a specific method or device. `[docs]`

Two API surfaces exist as a result:

| Surface                       | Endpoint                         | Use for                                             |
| ----------------------------- | -------------------------------- | --------------------------------------------------- |
| User Factors                  | `/api/v1/users/{userId}/factors` | Per-user enrolment reporting; works in both engines |
| Authenticators                | `/api/v1/authenticators`         | Org-level authenticator configuration               |
| User authenticator enrolments | per-user enrolment listing       | The Identity Engine-native equivalent of factors    |

For "which users have enrolled what", the User Factors API is the practical answer
and is what this skill's recipes use. `[verified: useOktaApi/userOperations →
scanGroupMfa]` For "what is this org configured to allow", read authenticators and
the `MFA_ENROLL` policy. `[docs]`

Okta documents real limitations on using the Factors API for _writes_ under Identity
Engine — notably that only the first Okta Verify factor can be enrolled through it,
and that Okta Verify authenticator settings are not enforced when enrolling that
way. `[docs]` Prefer the Factors API for **reads**; check current docs before using
it to enrol.

### Reading factors

```
GET /api/v1/users/{userId}/factors
```

**There is no bulk factors endpoint.** No `expand`, no org-wide listing, no batch
form. An MFA report over N users costs N calls, irreducibly. Budget it, run it at
low priority, and state the cost before starting.
`[verified: useOktaApi/userOperations]`

Degrade per user rather than aborting: one user's failed factor call should mark
that user unknown, not fail the report. Distinguish "no factors" from "could not
read factors" in the output — they are different findings.

### `factorType` vocabulary

`[verified: shared/utils/mfaUtils → factorLabel]` `[docs]`

| `factorType`              | Is                                                        |
| ------------------------- | --------------------------------------------------------- |
| `signed_nonce`            | **Okta FastPass** — the name gives no hint                |
| `push`                    | Okta Verify push                                          |
| `token:software:totp`     | TOTP app; `provider: GOOGLE` means Google Authenticator   |
| `token:hardware`          | Hardware OTP token (e.g. YubiKey OTP)                     |
| `token`, `token:hotp`     | Other OTP forms                                           |
| `webauthn`, `u2f`, `fido` | WebAuthn / FIDO security keys and platform authenticators |
| `sms`, `call`             | Phone-based                                               |
| `email`                   | Email OTP                                                 |
| `question`                | Security question                                         |

**Counting trap: one authenticator can produce several factor rows.** Enrolling
Okta Verify enrols `signed_nonce`, `push`, and `token:software:totp` together, so a
user with a single Okta Verify enrolment shows **three** rows. Unenrolling `push` or
`signed_nonce` also unenrols the sibling Okta Verify factors. `[docs]`

Counting rows therefore over-reports enrolment. Count _distinct authenticators_, or
report by capability ("has a phishing-resistant method"), not by row count.

**Strength is a judgement, not an API field.** Okta returns no strength ranking.
Any "weak MFA" report is applying a local policy — commonly that `sms`, `call`,
`email`, and `question` are weak, and `webauthn`/`u2f`/`fido` and `signed_nonce`
are phishing-resistant. State the policy in the report rather than presenting it as
an Okta verdict. `[verified: shared/utils/mfaUtils]` — the repo deliberately labels
factors and does not score them.

### Active factors

A factor counts as enrolled and usable when `status === 'ACTIVE'`. Exclude
`factorType === 'password'` — it is not MFA, and counting it makes every user look
covered. `[verified: shared/utils/mfaUtils → isActiveMfaFactor]`

Other statuses (`PENDING_ACTIVATION`, `NOT_SETUP`, and similar) represent
incomplete enrolment. A user whose only factor is pending is **not** covered, and
this is a common way an MFA-coverage report overstates itself.

## Sources

- Users API — https://developer.okta.com/docs/reference/api/users/
- User Factors API — https://developer.okta.com/docs/reference/api/factors/
- Authenticators overview —
  https://developer.okta.com/docs/guides/authenticators-overview/main/
- Multifactor authentication concepts — https://developer.okta.com/docs/concepts/mfa/
- Authenticator enrollment policy changes after upgrade —
  https://developer.okta.com/docs/guides/oie-upgrade-mfa-enroll-policy/main/
- User query options — https://developer.okta.com/docs/reference/user-query/

See `search-filter-syntax.md` for querying users, `groups-and-rules.md` for
membership, and `apps-and-policies.md` for what MFA a given app actually requires —
enrolment is not enforcement.
