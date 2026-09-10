# Privacy Policy for Okta Unbound

**Effective Date:** September 9, 2026
**Last Updated:** September 9, 2026

## Overview

Okta Unbound is a Chrome extension that provides group, user, application, and
rule management tools for Okta administrators. It runs entirely inside your
browser. It does not collect, transmit, or share any data with the developer,
with an analytics service, or with any other third party. The extension makes
exactly one kind of network request, and it goes to your own Okta org.

The extension does store a meaningful amount of your org's data on your own
machine, and some of that data is personal. This policy describes exactly what,
where, for how long, and how to get rid of it.

## Data Accessed

The extension reads the following from your own Okta tenant, using your existing
signed-in browser session:

- **User profile data.** Okta's base profile attributes — login, email, second
  email, first and last name, mobile phone, primary phone, street address, city,
  state, ZIP code, country code, department, title, manager, division,
  organization, cost center, employee number, user type, locale, time zone,
  gender pronouns — plus any custom attributes your org has defined on its user
  schema. Custom attributes are read as-is, so whatever your org has put there is
  what the extension reads.
- **Account state.** User status and the created, activated, status-changed, last
  login, last updated, and password-changed timestamps.
- **Credential material is deliberately excluded.** Okta returns password and
  recovery-question fields on some responses. These are stripped at the
  validation boundary before any code sees them, and the keys `password`,
  `credentials`, `securityQuestion`, `securityQuestionAnswer`, `recoveryQuestion`
  and `recoveryAnswer` are never displayed and can never be written.
- **MFA factors.** When you run an MFA scan on a group, the extension reads each
  member's enrolled factors (type, provider, status).
- **Group data.** Group names, descriptions, types, membership lists, member
  counts, and the org's group rules including their match expressions.
- **Application data.** The org's applications, their sign-on modes and
  provisioning features, which users are assigned to an app, and which groups an
  app pushes or sources.
- **Other org configuration.** Devices, network zones, authentication policies,
  and SAML/OIDC identity providers — read when you view or export them.
- **Website content.** The extension's content script reads the Okta admin
  console page you are on to extract the XSRF session token required for API
  authentication, and to detect which entity you are viewing (the ID comes from
  the page URL, the name from the page heading).

The extension does **not** read the Okta System Log.

## How Data Is Used

Everything the extension reads is used to render the side panel, to compute the
analyses it offers (rule impact, membership source breakdowns, MFA coverage, org
reports), to build the CSV files you ask it to export, and to carry out the
administrative operations described in the next section. None of it is used for
any other purpose, and none of it leaves your browser except back to your own
Okta org.

## Data Written Back to Okta

The extension is not read-only. When you take an action in the panel, it writes
to your Okta org. Every write is triggered by an explicit action you take in the
UI; nothing is written in the background or on a schedule. The complete set of
writes is:

- **Group membership.** Add a user to a group, and remove a user from a group —
  individually, in bulk, and as part of a group merge or a deprovisioned-user
  cleanup.
- **User profile attributes.** Editing a user's profile writes the changed
  attributes back to Okta. This modifies real user records in your directory.
  Security-sensitive keys (password, credentials, security and recovery
  questions) are refused by the extension and cannot be written through it.
- **User lifecycle.** Suspend a user, unsuspend a user, and trigger a password
  reset. The password reset asks Okta to send its password-reset email to that
  user.
- **Group rules.** Create a rule, activate a rule, deactivate a rule, and delete
  a rule. Consolidating rules creates a replacement rule and then deletes the
  originals.

The extension does **not** create or delete groups, does **not** change
application assignments, and does **not** modify policies, network zones, or
identity providers.

## Data Storage

All storage is local to your browser. Nothing is stored on any external server.
There are two storage areas: Chrome extension storage, and four IndexedDB
databases.

### Chrome extension storage

`chrome.storage.local` holds:

- The last-selected tab, and any group collections you have saved (group IDs and
  a collection name).
- **The pinned context** — a snapshot of the entity you pinned the panel to. For
  a group this is the group ID and name; for a user it is the user ID, display
  name, and, when the page reported it, their **email address** and status.
- **The working set** — the entities you pinned or recently viewed on the Home
  tab, scoped per Okta org. Each entry is an ID, a display name, and a timestamp.
  No email, no status, no profile, no member lists.
- **A cache of the org's group rules**, including their match expressions, with a
  5-minute lifetime.
- **Per-tab UI state** (filters, scroll positions, selections), with a 30-minute
  lifetime.
- **The action history** — the newest 50 mutating actions you performed. Each
  entry records the affected user's ID, **email address**, and display name, the
  group ID and name, and, for a profile edit, the **previous and new value of
  every attribute changed**, so the edit can be undone. Those values are tenant
  personal data held in plaintext. The capture is deliberately bounded: values
  longer than 1,024 characters are dropped entirely rather than truncated, and at
  most 25 attributes per edit are captured.
- **The API request log** — the newest 50 batches of Okta requests the extension
  made, with the reason for each batch. Endpoint strings are redacted before
  being written, because a search or filter query you typed can carry personal
  data.

`chrome.storage.session` holds one derived rate-limit threshold per org. It is
discarded when the browser session ends.

`chrome.storage.sync` holds only the extension version and two default settings,
written once at install. No org data is ever placed in synced storage.

### IndexedDB

The extension maintains four IndexedDB databases:

**1. `okta-unbound-audit` — the operation audit trail.** One record per
administrative operation the extension performed (add users, remove users,
export, activate rule, deactivate rule). Each record holds the action, the group
ID and name, the **email address of the admin who performed it**, the result, the
list of affected user **IDs** (not their emails), counts, timing, the number of
API requests made, and any error messages Okta returned. Affected users are
recorded by Okta ID to minimise the personal data retained; the acting admin is
recorded by email so the trail can name who did what.

**2. `okta-unbound-snapshot` — the org inventory.** This is the largest store and
deserves to be described plainly. The extension maintains a local inventory of
your Okta org so the panel can answer questions without re-querying Okta every
time. It holds:

- every **group** in the org — name, description, type, member count, and source
  application;
- every **application** in the org, with its status and provisioning features;
- every **group rule** in the org, including its match expression;
- every **application-to-group assignment**.

It **does not** hold user records, and it **does not** hold group membership
lists — the largest and most personal collection in an org is deliberately not
persisted to disk.

Every row is keyed by the **Okta origin** it came from (for example
`https://yourcompany.okta.com`). If you administer more than one org, each org's
inventory is stored separately and only the org you are currently connected to is
read. A background process refreshes the inventory roughly every 15 minutes while
an Okta tab is open, and re-derives application-to-group assignments at most once
every 6 hours; refreshes replace and prune rather than accumulate, so entities
deleted in Okta are removed locally on the next full pass. The inventory has **no
expiry** — it persists until you remove the extension. It is never uploaded,
never synced across your Chrome profiles, and never transmitted anywhere.

**3. `okta-unbound-export` — export presets.** The column selections you save on
the Export tab: a preset name, the enabled column IDs, and, if you saved one, the
filter expression you typed. A filter expression is text you wrote and can
contain a name or an email address, which is why it is saved only inside an
explicit, individually deletable preset. The separate "last used columns" record
holds column IDs only and never a filter.

**4. `okta-unbound-profile-display` — profile layout preferences.** One record per
Okta org describing how you want user profiles laid out: your category names,
attribute ordering, which attributes are hidden, and display toggles. It stores
attribute **names**, never attribute **values**.

### Data held only in memory

Group member lists, individual user records, MFA factor scans, and search results
are held in an in-memory cache for the life of the side-panel session only,
capped at 500 entries with a 5-minute freshness window. They are never written to
disk and are gone when the panel closes.

## Data Transmission

The extension communicates only with your own Okta org domain — for example
`yourcompany.okta.com`, `yourcompany.oktapreview.com`, or
`yourcompany.okta-emea.com` — using your existing authenticated browser session.
There is exactly one network call site in the entire extension. It lives in the
content script, it rejects any endpoint that is not a same-origin path on the
Okta page you are on, and it permits only the HTTP methods GET, POST, PUT, PATCH
and DELETE.

The XSRF token is read fresh from the page's DOM at the moment each request is
sent. It is never stored, never passed between extension components, and never
logged.

No data is sent to any other domain, server, or third party. The extension
contains no analytics, no telemetry, no crash reporting, and no remote
configuration, and its content security policy forbids loading any remote script.

## Data Export

Exports are always CSV, and always require an explicit click. Nothing downloads
automatically.

The Export tab can produce CSV files for: users, groups, group memberships, group
rules, applications, application users, application groups, devices,
authentication policies, network zones, identity providers, and three org
cleanup reports. Outside the Export tab you can also export the filtered groups
list, a selection of groups (optionally with their member lists as a second
file), and a group comparison result.

Every cell written to a CSV is escaped per RFC 4180 and guarded against
spreadsheet formula injection.

The panel also offers explicit **copy to clipboard** controls — a group's member
list, a profile attribute breakdown, an entity ID, and, in the API explorer, a
raw API response as JSON. These place data on your system clipboard when you
click them.

Exported files and clipboard contents are on your machine and under your control;
the extension does not transmit them anywhere.

## Data Sharing

This extension does not sell, transfer, or share any data with third parties for
any purpose.

## Data Retention

Retention differs per store. What is actually true today:

| Data                                         | Retained                                           |
| -------------------------------------------- | -------------------------------------------------- |
| Cached org group rules                       | 5 minutes                                          |
| Per-tab UI state                             | 30 minutes; expired entries pruned hourly          |
| Recently-viewed entities (working set)       | 14 days                                            |
| Pinned entities (working set)                | Until you unpin them                               |
| Pinned panel context                         | Until you unpin, or until no Okta tab remains open |
| Saved group collections, last-selected tab   | Until you delete them                              |
| Action history (with profile values)         | Newest 50 entries; older entries evicted           |
| API request log                              | Newest 50 batches; older batches evicted           |
| Audit trail (IndexedDB)                      | 90 days; pruned by a daily background task         |
| Org inventory snapshot (IndexedDB)           | Indefinitely, refreshed in place                   |
| Export presets (IndexedDB)                   | Until you delete them                              |
| Profile layout preferences (IndexedDB)       | Until you reset them                               |
| In-memory caches (members, users, MFA scans) | Until the side panel closes                        |

An earlier version of this policy stated a blanket 24-hour expiry for locally
cached data. That was not accurate, and the table above replaces it.

### Clearing data

The controls available inside the extension are:

- **Clear History** in the audit view — deletes the action history (including
  captured profile values) and the API request log immediately.
- **Delete** on an export preset — deletes that preset.
- **Reset to default** in the profile display settings — deletes that org's
  layout preferences.
- **Unpin / Forget** on a Home tab entry — removes that working-set entry.
- **Delete collection** — removes a saved group collection.

There is currently no in-app control that clears the IndexedDB audit trail or the
org inventory snapshot, and no single "delete everything" button. The audit trail
ages out at 90 days on its own; the org inventory does not age out. Data from an
org you previously connected to remains stored under that org's origin key.

**Removing the extension deletes all of it.** Uninstalling Okta Unbound causes
Chrome to delete the extension's Chrome storage and all four of its IndexedDB
databases. That is the reliable way to remove everything the extension has stored.

## Permissions

The extension requests these Chrome permissions:

- **Host access to `*.okta.com`, `*.oktapreview.com`, `*.okta-emea.com`** and
  **`activeTab`** — to read the Okta admin page you are on and to make API calls
  to your org. No other host is requested, and none can be reached.
- **`scripting`** — solely to re-inject the extension's own content script into
  already-open Okta tabs after the extension is installed or updated, so you do
  not have to reload each tab manually. The files and target pages are read back
  from the extension's own manifest, so injection can never reach beyond the Okta
  pages already listed above, and no other code is ever injected.
- **`storage`** — for the local storage described above.
- **`sidePanel`** — to present the extension's interface.
- **`alarms`** — for three background maintenance tasks: pruning the audit trail
  daily, pruning expired tab state hourly, and refreshing the org inventory.
- **`contextMenus`** — for the right-click "Open sidebar" entry.
- **`notifications`** — for a single message shown when you click the extension
  icon while not on an Okta page.

## Changes to This Policy

Any changes to this privacy policy will be reflected in this document with an
updated "Last Updated" date.

## Contact

For questions or concerns about this privacy policy, please open an issue at:
https://github.com/samdhenderson/okta-unbound/issues
