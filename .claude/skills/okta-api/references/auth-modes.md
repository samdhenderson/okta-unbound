# Authentication modes

Three ways to authenticate against the Okta Management API. The choice is usually
made once per project and then never revisited — but it determines which endpoints
are reachable, how failures present, and what the blast radius is when a credential
leaks.

Marker legend lives in `../SKILL.md`.

## Choosing

|                   | SSWS API token              | OAuth 2.0 service app             | Browser session                   |
| ----------------- | --------------------------- | --------------------------------- | --------------------------------- |
| Credential        | Static token string         | Private key + minted access token | Existing admin session cookie     |
| Privilege model   | Inherits the creating admin | Explicitly granted scopes         | The signed-in admin's roles       |
| Scope granularity | None — all-or-nothing       | Per-scope, least-privilege        | None                              |
| Expiry            | 30 days, sliding            | Short-lived access tokens         | Session lifetime                  |
| Best for          | Scripts, quick automation   | Production services               | Browser tools acting as the admin |

**Prefer the OAuth service app for anything durable.** It is the only mode with real
least-privilege, and the only one where a leaked credential does not immediately
confer everything its creator can do.

## SSWS API token

```
Authorization: SSWS {token}
```

The `SSWS` prefix names Okta's proprietary scheme — it is not `Bearer`, and using
`Bearer` fails with an authentication error rather than a helpful one. `[docs]`

Three properties that matter operationally: `[docs]`

- **Expiry is 30 days from creation or last use**, refreshing on every call. A token
  used daily never expires; one used monthly may already be dead. The 30-day period
  is fixed per org and cannot be changed. A job that runs quarterly will fail on a
  token that worked when it was written.
- **Privileges are inherited from the creating admin, and track that admin over
  time.** If the admin's role is later reduced, the token's access reduces with it —
  a script can start returning 403 with no change to the script. Conversely a token
  created by a super admin _is_ a super admin credential.
- **Rate limits default to 50% of each API maximum per token**, adjustable in the
  admin console. Two tokens in the same org still contend for the org bucket.

Because the token carries no scoping, treat it as a high-value secret: never commit
it, never log it, never put it in a URL, and prefer a dedicated service admin
account over a human's token so revocation does not depend on a person.

## OAuth 2.0 service app

The production path, and the only one supporting least privilege.

**Only the client credentials flow mints access tokens containing Okta scopes**, and
**`private_key_jwt` is the only supported client authentication method** for it.
`[docs]` A shared client secret is not an option here — the constraint is not a
preference.

Shape of the flow:

1. Register an OAuth service app; publish its public key in the app's JWKS. Okta
   supports RSA and EC key pairs. `[docs]`
2. Grant the specific Okta API scopes the app needs, per scope, in the admin
   console. `[docs]`
3. Build a JWT and sign it with the private key; send it as the `client_assertion`
   to `/oauth2/v1/token` with `grant_type=client_credentials` and the scopes wanted.
4. Call the Management API with `Authorization: Bearer {access_token}` — `Bearer`
   here, unlike SSWS.
5. Re-mint on expiry. Cache the access token for its lifetime rather than minting
   per request; token minting has its own rate limit.

### Scopes

Scopes follow `okta.{resource}.{read|manage}`, where `manage` implies read:

```
okta.users.read        okta.users.manage
okta.groups.read       okta.groups.manage
okta.apps.read         okta.apps.manage
okta.policies.read     okta.policies.manage
okta.logs.read
okta.roles.read        okta.roles.manage
okta.devices.read      okta.devices.manage
okta.schemas.read      okta.schemas.manage
```

`[unverified]` as an exhaustive list — the naming convention is documented and
stable, but grant only what the app needs and confirm the exact strings against the
scopes list in `doc-sources.md`. Requesting an ungranted scope fails at token
minting, which is a clearer failure than discovering it mid-report.

**Least privilege is the point.** A reporting service almost always needs only the
`.read` scopes. Granting `manage` so that "it just works" discards the main
advantage this mode has over an API token.

**DPoP** binds the access token to the client's key, so a stolen token is unusable
without the key. Worth adopting for anything long-lived. `[docs]`

## Browser session

An admin already signed in to the Okta admin console has a session cookie, and
requests issued from that origin authenticate with it — no token required. This is
how browser extensions and console-adjacent tools operate.

Requirements:

- Send the session cookie (`credentials: 'include'` for same-origin fetches).
- Send the XSRF token Okta expects for state-changing requests, read from the page
  at request time.
- Requests must originate from the Okta origin itself.

Constraints worth knowing before choosing this mode:

- Access is exactly the signed-in admin's, no more and no less — including their
  403s. A tool built this way inherits whatever role the operator holds, which
  varies per user and cannot be assumed.
- There is no unattended operation. Session expiry ends the job.
- It is unsuitable for servers and schedulers by construction.

**Handling rules for the XSRF token**, which apply wherever this mode is used:
read it from the page at fetch time; never persist it to storage of any kind; never
send it across a message channel; never log it. It is a per-request value, and
treating it as a stored credential is how it leaks.
`[verified: okta-unbound content script, docs/security.md]`

## Diagnosing 401 and 403

| Symptom                                 | Likely cause                                           |
| --------------------------------------- | ------------------------------------------------------ |
| 401 on every endpoint                   | Wrong scheme (`Bearer` vs `SSWS`), or an expired token |
| 401 after a period of inactivity        | SSWS 30-day sliding expiry lapsed                      |
| 403 on one endpoint family only         | Missing scope (OAuth), or insufficient admin role      |
| 403 that appeared without a code change | The creating admin's role was reduced                  |
| 403 on policy endpoints specifically    | Policy reads commonly require super admin              |

**403 is about authorisation, not correctness.** A 403 on
`GET /api/v1/policies?type=ACCESS_POLICY` usually means the caller is not a super
admin, not that the request is malformed. Design reports to degrade — omit the
policy column and say so — rather than fail. `[verified: useOktaApi/policyOperations]`

Diagnose reachability with a cheap authenticated call — `GET /api/v1/users/me` for
session mode, or a scoped read for token modes — before attributing failures to the
target endpoint.

## Secret handling

Applies to every mode, and to anything generated while using this skill:

- Never commit or log a token, private key, session cookie, or XSRF token. Not in
  tests, fixtures, stories, or docs — use obvious placeholders (`00gFAKE…`,
  `user@example.com`).
- Never place credentials in query strings; they land in logs and history.
- Prefer short-lived, narrowly scoped credentials, and rotate on a schedule rather
  than on incident.
- Store nothing in plaintext client storage. Browser storage and IndexedDB are not
  secret stores.

## Sources

- Create an API token — https://developer.okta.com/docs/guides/create-an-api-token/main/
- Manage Okta API tokens — https://help.okta.com/en-us/content/topics/security/api.htm
- Implement OAuth for Okta with a service app —
  https://developer.okta.com/docs/guides/implement-oauth-for-okta-serviceapp/main/
- Set up Okta for OAuth API access —
  https://developer.okta.com/docs/guides/set-up-oauth-api/main/
- Client authentication methods —
  https://developer.okta.com/docs/api/openapi/okta-oauth/guides/client-auth
- Build a JWT for client authentication —
  https://developer.okta.com/docs/guides/build-self-signed-jwt/js/main/
- DPoP — https://developer.okta.com/blog/2024/10/23/dpop-oauth-node
- Rate limits — https://developer.okta.com/docs/reference/rate-limits/

See `pagination-and-limits.md` for the rate-limit interaction and
`internal-apis.md` for why undocumented endpoints are reachable in session mode but
often not with a token.
