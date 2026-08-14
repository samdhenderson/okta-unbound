# Architecture Decision Records

Each ADR captures one significant decision — its context, the decision, and its
consequences. ADRs are **immutable once accepted**: a later decision _supersedes_ an
earlier one rather than rewriting it. Read an ADR when you want the _why_ behind a
convention; the specs in [`../`](../README.md) describe the _what_.

| ADR                                                               | Title                                                                             | Status   | Notes                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| [0001](./0001-record-architecture-decisions.md)                   | Record architecture decisions                                                     | Accepted | Establishes the ADR process.                                               |
| [0002](./0002-status-vocabulary-danger.md)                        | Standardize status vocabulary on `danger`                                         | Accepted | `danger`, not `error`, across UI status.                                   |
| [0003](./0003-adopt-prettier.md)                                  | Adopt Prettier for formatting                                                     | Accepted | `format` / `format:check` scripts; CI gate.                                |
| [0004](./0004-eslint-error-policy.md)                             | Tighten ESLint from warn to error                                                 | Accepted | `no-console` / `no-explicit-any` at `error`; `--max-warnings=0` deferred.  |
| [0005](./0005-pr-ci.md)                                           | Add PR continuous integration                                                     | Accepted | Later extended by the format-check step and the Storybook job (0010/0011). |
| [0006](./0006-zod-boundary-validation.md)                         | Validate Okta API responses at the boundary with zod                              | Accepted | List-path validation deferred.                                             |
| [0007](./0007-version-source-of-truth.md)                         | Single source of truth for version                                                | Accepted | `package.json` is canonical; manifest derived at build.                    |
| [0008](./0008-activity-bar-and-cancellation.md)                   | Unified activity bar and one cancellation path                                    | Accepted | Replaced `LoadingBar` + `SchedulerStatusBar`.                              |
| [0009](./0009-batch-operation-runner.md)                          | One batch runner for all multi-call Okta operations                               | Accepted | Builds on 0008.                                                            |
| [0010](./0010-component-explorer.md)                              | Adopt Storybook as the component explorer                                         | Accepted | Partly superseded by 0011.                                                 |
| [0011](./0011-storybook-single-docs-site.md)                      | Storybook is the single documentation site; browser story tests                   | Accepted | Supersedes parts of 0010.                                                  |
| [0012](./0012-no-test-tampering.md)                               | Never modify or delete a test to make it pass                                     | Accepted | Still in force; amended by 0022, which names when removal is legitimate.   |
| [0013](./0013-plan-and-approval-gate.md)                          | Lightweight plan-and-approval gate before bigger changes                          | Accepted | Rationale + plan contents stand; its ">~2 files" trigger is now 0024's.    |
| [0014](./0014-storybook-hardening.md)                             | Storybook hardening — enforce a11y, side-panel viewports, fixed-element framing   | Accepted | Closes 0011's a11y `todo → error` follow-up.                               |
| [0015](./0015-scripting-permission-content-script-reinjection.md) | Add the `scripting` permission to re-inject content scripts after install/update  | Accepted | Injection bounded by existing Okta host permissions; `onInstalled` only.   |
| [0016](./0016-in-tab-view-stack-navigation.md)                    | In-tab sub-navigation via a per-tab view stack                                    | Accepted | `useViewStack` + `Breadcrumbs`; no focus trap (not an overlay).            |
| [0017](./0017-jsep-expression-evaluation.md)                      | Parse Okta rule expressions with jsep plus an allow-list evaluator                | Accepted | AST-only parser + allow-list evaluator; `unevaluable` is never `no-match`. |
| [0018](./0018-tabs-stay-mounted.md)                               | Keep every tab mounted; gate background work on `isActive`                        | Accepted | Every tab gates its mount effects on `isActive` — see the obligation.      |
| [0019](./0019-coverage-threshold-recalibration.md)                | Recalibrate the coverage gate and stop restating its numbers                      | Accepted | Amends 0005's thresholds; `vitest.config.ts` is the single source.         |
| [0020](./0020-attribution-provenance-not-a-fourth-level.md)       | Reconcile the two attribution paths by provenance, not a fourth attribution level | Accepted | Parity test pins where the group and user views may differ.                |
| [0021](./0021-group-context-rule-evaluation.md)                   | Answer `isMemberOf*` rule clauses from the user's own group list                  | Accepted | Optional, complete group list; the regex variant is still never run.       |
| [0022](./0022-test-lifecycle.md)                                  | Test lifecycle — when a test may be removed or retargeted                         | Accepted | Amends 0012 with four carve-outs; each needs a PR note.                    |
| [0023](./0023-test-value-policy.md)                               | Test value policy — what we don't test                                            | Accepted | Bans class/identity/mocked-child assertions; one runner per pure render.   |
| [0024](./0024-risk-based-plan-gate.md)                            | Trigger the plan gate on risk, not on a file count                                | Accepted | Supersedes 0013's ">~2 files" trigger; mechanical mass changes exempt.     |

## Adding an ADR

Number sequentially, use the Context / Decision / Consequences shape, and set
`Status: Accepted` with a date. When a new decision changes an old one, add a fresh ADR
and note the supersession in both — never edit an accepted record in place.
