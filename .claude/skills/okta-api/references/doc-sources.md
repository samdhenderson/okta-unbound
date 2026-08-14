# Documentation sources

Topic → official Okta documentation URL. This file holds **only** links and scope
notes, never restated content, so it cannot drift out of sync with the references.

Use it when a task needs Okta detail this skill does not carry: find the topic,
fetch the URL, read the authoritative source.

## Fetching notes

Two practical facts about Okta's documentation site, learned while authoring this
skill:

- **The `/docs/api/openapi/…` pages are client-rendered.** A plain fetch returns a
  shell containing only the page heading. Reading them needs a JavaScript-capable
  fetch, or a web search that surfaces the content in its result snippets.
- **The older `/docs/reference/api/{resource}/` pages are more fetchable** but have
  been progressively replaced by the OpenAPI pages, and some now 404 or return
  shells too.

When a fetch returns a near-empty page, that is the renderer, not a missing doc —
search for the specific fact instead of concluding it is undocumented.

## Start here

| Topic                                                                                       | URL                                                                         |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| API reference overview — filtering, operators, pagination, the undocumented-endpoint policy | https://developer.okta.com/docs/api/                                        |
| Core Okta API index                                                                         | https://developer.okta.com/docs/reference/core-okta-api/                    |
| Management API overview                                                                     | https://developer.okta.com/docs/api/openapi/okta-management/guides/overview |
| Error codes                                                                                 | https://developer.okta.com/docs/reference/error-codes/                      |

## Pagination and rate limits

| Topic                                                     | URL                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Pagination, `Link` header, opaque cursors                 | https://developer.okta.com/docs/api/#pagination                                                |
| Rate limits — bucket model, quota variability             | https://developer.okta.com/docs/reference/rate-limits/                                         |
| Rate limit best practices — the header trio, 429 guidance | https://developer.okta.com/docs/reference/rl-best-practices/                                   |
| Monitoring and troubleshooting rate limits                | https://developer.okta.com/docs/reference/rl2-monitor/                                         |
| Token and OAuth 2.0 application rate limits               | https://developer.okta.com/docs/reference/rl2-token-oauth/                                     |
| Authentication and end-user rate limits                   | https://developer.okta.com/docs/reference/rl-global-enduser/                                   |
| Additional rate limits                                    | https://developer.okta.com/docs/reference/rl-additional-limits/                                |
| Principal rate limits                                     | https://developer.okta.com/docs/api/openapi/okta-management/management/tag/PrincipalRateLimit/ |

## Users

| Topic                                            | URL                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Users API                                        | https://developer.okta.com/docs/reference/api/users/                             |
| User query options — `q` vs `search` vs `filter` | https://developer.okta.com/docs/reference/user-query/                            |
| User API (OpenAPI)                               | https://developer.okta.com/docs/api/openapi/okta-management/management/tag/User/ |
| Contains-operator search behaviour               | https://support.okta.com/help/s/article/search-for-user-using-contains-operator  |

## Groups and rules

| Topic                                                          | URL                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Groups API                                                     | https://developer.okta.com/docs/reference/api/groups/                                                                |
| Groups (OpenAPI)                                               | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/group                                    |
| Group Rules (OpenAPI)                                          | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/grouprule                                |
| Group rules concepts                                           | https://help.okta.com/en-us/content/topics/users-groups-profiles/usgp-about-group-rules.htm                          |
| **Group rule limitations and restrictions** — the limits table | https://support.okta.com/help/s/article/okta-group-rule-limitations-and-restrictions                                 |
| Groups, group push, and group rules limits                     | https://support.okta.com/help/s/article/groups-group-push-and-group-rules-limits                                     |
| Creating group rules                                           | https://help.okta.com/en-us/content/topics/users-groups-profiles/usgp-create-group-rules.htm                         |
| Manage groups with Terraform — worked rule payloads            | https://developer.okta.com/docs/guides/terraform-manage-groups/main/                                                 |
| **List all group rules for a user** (GA Jun 2026)              | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/group/other/listgrouprulesforuseringroup |
| List all member users — the documented `expand` parameter      | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/group/other/listgroupusers               |

## Expression language

| Topic                                                  | URL                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Okta Expression Language overview — function reference | https://developer.okta.com/docs/reference/okta-expression-language/                                      |
| Okta Expression Language in Identity Engine            | https://developer.okta.com/docs/reference/okta-expression-language-in-identity-engine/                   |
| Expression examples                                    | https://help.okta.com/en-us/content/topics/identity-governance/access-certification/iga-el-examples.htm  |
| Attribute mapping expressions                          | https://help.okta.com/en-us/Content/Topics/users-groups-profiles/usgp-attribute-mappings-expressions.htm |

## Apps

| Topic                                                  | URL                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Applications API                                       | https://developer.okta.com/docs/reference/api/apps/                                                     |
| Application Users — assignment `scope`                 | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationusers            |
| Application Groups — `expand=group`, `expand=metadata` | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgroups           |
| Group Push Mapping API                                 | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgrouppushmapping |

## Policies

| Topic                                    | URL                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Policies concepts                        | https://developer.okta.com/docs/concepts/policies/                                 |
| Policies (OpenAPI)                       | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/policy |
| Configure an access policy               | https://developer.okta.com/docs/guides/configure-access-policy/main/               |
| Configure sign-on policies               | https://developer.okta.com/docs/guides/configure-signon-policy/                    |
| Policy simulation — test before applying | https://developer.okta.com/docs/guides/policy-simulation/main/                     |

## MFA, factors, authenticators

| Topic                                                 | URL                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| User Factors API — `factorType` enum                  | https://developer.okta.com/docs/reference/api/factors/                        |
| Factors administration                                | https://developer.okta.com/docs/reference/api/factor-admin/                   |
| Authenticators overview                               | https://developer.okta.com/docs/guides/authenticators-overview/main/          |
| Multifactor authentication concepts                   | https://developer.okta.com/docs/concepts/mfa/                                 |
| Authenticator enrollment policy changes after upgrade | https://developer.okta.com/docs/guides/oie-upgrade-mfa-enroll-policy/main/    |
| Authentication factors concepts                       | https://developer.okta.com/docs/concepts/iam-overview-authentication-factors/ |
| Identity Engine limitations                           | https://developer.okta.com/docs/guides/ie-limitations/main/                   |

## System Log

| Topic                                         | URL                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| System Log (OpenAPI)                          | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/systemlog |
| System Log query — polling vs bounded         | https://developer.okta.com/docs/reference/system-log-query/                           |
| **Event Types reference — the complete list** | https://developer.okta.com/docs/reference/api/event-types/                            |
| System Log filters and search                 | https://help.okta.com/en-us/content/topics/reports/syslog-filters.htm                 |
| Getting started with the System Log           | https://support.okta.com/help/s/article/getting-started-with-okta-system-logs         |
| Data retention policy                         | https://support.okta.com/help/s/article/Customer-Data-Retention-Policy                |

## Authentication

| Topic                                         | URL                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Create an API token                           | https://developer.okta.com/docs/guides/create-an-api-token/main/                 |
| Manage Okta API tokens                        | https://help.okta.com/en-us/content/topics/security/api.htm                      |
| Implement OAuth for Okta with a service app   | https://developer.okta.com/docs/guides/implement-oauth-for-okta-serviceapp/main/ |
| Set up Okta for OAuth API access — scope list | https://developer.okta.com/docs/guides/set-up-oauth-api/main/                    |
| Client authentication methods                 | https://developer.okta.com/docs/api/openapi/okta-oauth/guides/client-auth        |
| Build a JWT for client authentication         | https://developer.okta.com/docs/guides/build-self-signed-jwt/js/main/            |
| DPoP                                          | https://developer.okta.com/blog/2024/10/23/dpop-oauth-node                       |
| OAuth 2.0 scopes                              | https://developer.okta.com/docs/api/oauth2                                       |

## Roles and org surfaces

| Topic                    | URL                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Roles in Okta            | https://developer.okta.com/docs/api/openapi/okta-management/guides/roles                         |
| Role assignment concepts | https://developer.okta.com/docs/concepts/role-assignment/                                        |
| User role assignments    | https://developer.okta.com/docs/api/openapi/okta-management/management/tags/roleassignmentauser  |
| Group role assignments   | https://developer.okta.com/docs/api/openapi/okta-management/management/tag/RoleAssignmentBGroup/ |
| Identity providers       | https://developer.okta.com/docs/reference/api/idps/                                              |

## Outside this skill

| Topic                              | URL                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| SCIM 2.0                           | https://developer.okta.com/docs/api/openapi/okta-scim/guides/scim-20 |
| OpenID Connect & OAuth 2.0 runtime | https://developer.okta.com/docs/api/openapi/okta-oauth/oauth/        |
| Authentication API (Classic)       | https://developer.okta.com/docs/reference/api/authn/                 |

## Release notes — check when behaviour changes unexpectedly

| Topic                             | URL                                                                      |
| --------------------------------- | ------------------------------------------------------------------------ |
| Identity Engine API release notes | https://developer.okta.com/docs/release-notes/2026-okta-identity-engine/ |
| Classic Engine API release notes  | https://developer.okta.com/docs/release-notes/2026/                      |

Release notes are the first place to check when a call that used to work changes
shape — for documented endpoints. Internal endpoints do not appear here at all,
which is one of the costs described in `internal-apis.md`.

They are also where **promotions** land: `expand=group-rules` going GA on 3 June
2026 was announced only here. The notes are far easier to search in the docs source
repo than on the rendered site, which is client-rendered and resists fetching:

```
gh api repos/okta/okta-developer-docs/contents/packages/@okta/vuepress-site/docs/release-notes/2026-okta-identity-engine/index.md \
  --jq '.content' | base64 -d | grep -i -A 5 'groups api'
```

The SDK reference is the other good structured source — method signatures document
permitted parameter values (for example `listGroups` documenting `expand` as
accepting `stats` and `app`):
https://developer.okta.com/okta-sdk-java/apidocs/com/okta/sdk/resource/api/GroupApi.html

## Community tools

| Resource             | Why it is useful                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| rockstar (source)    | The reference implementation for bulk Okta admin work; uses only documented endpoints — https://github.com/gabrielsroka/gabrielsroka.github.io |
| rockstar (extension) | https://gabrielsroka.github.io/rockstar/                                                                                                       |
| OktaAPI.psm1         | PowerShell patterns for the same endpoints — https://github.com/gabrielsroka/OktaAPI.psm1                                                      |
