import{j as n}from"./iframe-tAvKsVeF.js";import{u as r,M as o,c as s}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const i=`# Content script



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/apiRequest / handleMakeApiRequest

# Function: handleMakeApiRequest()

> **handleMakeApiRequest**(\`endpoint\`, \`method?\`, \`body?\`): \`Promise\`\\<\`ApiResponse\`\\<\`any\`\\>\\>

Defined in: [src/content/apiRequest.ts:105](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/apiRequest.ts#L105)

Perform an authenticated same-origin fetch against the Okta org and normalize
the result into an ApiResponse. The endpoint must be a same-origin path
and the method must be allow-listed.

## Parameters

### endpoint

\`string\`

Same-origin API path (must start with a single \`/\`).

### method?

\`string\` = \`'GET'\`

### body?

\`unknown\`

Optional JSON body (ignored for \`GET\`).

## Returns

\`Promise\`\\<\`ApiResponse\`\\<\`any\`\\>\\>

A normalized response. Every failure carries a \`status\` — the real one
when Okta answered, else NO\\_HTTP\\_STATUS.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/apiRequest / isSameOriginPath

# Function: isSameOriginPath()

> **isSameOriginPath**(\`endpoint\`): \`boolean\`

Defined in: [src/content/apiRequest.ts:84](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/apiRequest.ts#L84)

Whether \`endpoint\` is a plain same-origin path (\`/api/...\`). Rejects absolute
URLs and protocol-relative \`//host\` forms so a malformed or hostile message
can never redirect the authenticated fetch off the Okta org.

## Parameters

### endpoint

\`string\`

## Returns

\`boolean\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/groupHandlers / handleGetGroupInfo

# Function: handleGetGroupInfo()

> **handleGetGroupInfo**(): \`Promise\`\\<\`MessageResponse\`\\<\`GroupInfo\`\\>\\>

Defined in: [src/content/groupHandlers.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/groupHandlers.ts#L24)

Resolve the current page's group ID and name.

The name is taken from the DOM when present, otherwise fetched from the API
(zod-validated), otherwise reported as \`Unknown\`.

## Returns

\`Promise\`\\<\`MessageResponse\`\\<\`GroupInfo\`\\>\\>

A response carrying GroupInfo, or an error when not on a group page.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/indicator / injectIndicator

# Function: injectIndicator()

> **injectIndicator**(): \`void\`

Defined in: [src/content/indicator.ts:11](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/indicator.ts#L11)

Inject the "Okta Unbound Active" badge into the page, then fade and remove it
after a short delay.

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractAppIdFromUrl

# Function: extractAppIdFromUrl()

> **extractAppIdFromUrl**(\`url\`): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:200](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L200)

Extract an Okta app ID from a page URL.

Tries a prioritized list of admin/app route patterns and query-parameter forms,
rejecting obvious non-ID segments and requiring the candidate to look like an
Okta app ID (starts with \`0oa\` or is at least 18 characters).

## Parameters

### url

\`string\`

The page URL to parse.

## Returns

\`string\` \\| \`null\`

The app ID, or \`null\` if none matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractAppNameFromPage

# Function: extractAppNameFromPage()

> **extractAppNameFromPage**(): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:250](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L250)

Scrape the app's display name from the current page DOM, trying a prioritized
list of selectors and skipping generic labels like "Application" or "Settings".

## Returns

\`string\` \\| \`null\`

The trimmed app name, or \`null\` if no usable selector matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractGroupIdFromUrl

# Function: extractGroupIdFromUrl()

> **extractGroupIdFromUrl**(\`url\`): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L21)

Extract an Okta group ID from a page URL.

Matches both the classic \`/admin/group/{id}\` admin route and the generic
\`/groups/{id}\` route, in that order of preference.

## Parameters

### url

\`string\`

The page URL to parse.

## Returns

\`string\` \\| \`null\`

The group ID, or \`null\` if none matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractGroupNameFromPage

# Function: extractGroupNameFromPage()

> **extractGroupNameFromPage**(): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:37](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L37)

Scrape the group name from the current page DOM, trying a prioritized list of
selectors used across Okta's admin surfaces.

## Returns

\`string\` \\| \`null\`

The trimmed group name, or \`null\` if no known selector matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractPolicyIdFromUrl

# Function: extractPolicyIdFromUrl()

> **extractPolicyIdFromUrl**(\`url\`): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:315](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L315)

Extract an Okta authentication/access policy ID from a page URL.

Tries a prioritized list of admin policy routes (the OIE \`/admin/authn/policies\`
and \`/admin/access/policies\` surfaces, plus the older generic \`/admin/policy/…\`
forms), the API path, and query-parameter forms. Rejects obvious non-ID segments
and requires the candidate to match POLICY\\_ID\\_PATTERN.

## Parameters

### url

\`string\`

The page URL to parse.

## Returns

\`string\` \\| \`null\`

The policy ID, or \`null\` if none matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractPolicyNameFromPage

# Function: extractPolicyNameFromPage()

> **extractPolicyNameFromPage**(): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:373](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L373)

Scrape the policy's display name from the page DOM, skipping generic labels like
"Policy" or "Authentication". Identity only — policy settings and rules are read
from the API, never scraped from the page markup.

## Returns

\`string\` \\| \`null\`

The trimmed policy name, or \`null\` if no usable selector matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractUserIdFromUrl

# Function: extractUserIdFromUrl()

> **extractUserIdFromUrl**(\`url\`): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:66](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L66)

Extract an Okta user ID from a page URL.

Tries a prioritized list of route patterns (OIE, classic admin, directory,
end-user, API, report, and query-parameter forms) and rejects obvious non-ID
path segments such as \`settings\` or \`profile\`.

## Parameters

### url

\`string\`

The page URL to parse.

## Returns

\`string\` \\| \`null\`

The user ID, or \`null\` if none matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/pageContext / extractUserNameFromPage

# Function: extractUserNameFromPage()

> **extractUserNameFromPage**(): \`string\` \\| \`null\`

Defined in: [src/content/pageContext.ts:137](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/pageContext.ts#L137)

Scrape the user's display name from the current page DOM, trying a prioritized
list of selectors and skipping generic labels like "User Profile" or "Settings".

## Returns

\`string\` \\| \`null\`

The trimmed user name, or \`null\` if no usable selector matched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / content/userHandlers / handleGetUserInfo

# Function: handleGetUserInfo()

> **handleGetUserInfo**(): \`Promise\`\\<\`MessageResponse\`\\<\`UserInfo\`\\>\\>

Defined in: [src/content/userHandlers.ts:22](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/content/userHandlers.ts#L22)

Resolve the current page's user ID, display name, email, and status.

Prefers zod-validated API data, falling back to page scraping for the name.

## Returns

\`Promise\`\\<\`MessageResponse\`\\<\`UserInfo\`\\>\\>

A response carrying UserInfo, or an error when not on a user page.`;function a(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(o,{title:"Internals/Content script"}),`
`,n.jsx(s,{children:i})]})}function u(e={}){const{wrapper:t}={...r(),...e.components};return t?n.jsx(t,{...e,children:n.jsx(a,{...e})}):a()}export{u as default};
