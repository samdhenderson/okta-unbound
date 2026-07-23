# Architecture Decision Records

Each ADR captures one significant decision — its context, the decision, and its
consequences. ADRs are **immutable once accepted**: a later decision _supersedes_ an
earlier one rather than rewriting it. Read an ADR when you want the _why_ behind a
convention; the specs in [`../`](../README.md) describe the _what_.

| ADR                                             | Title                                                           | Status   | Notes                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions                                   | Accepted | Establishes the ADR process.                                               |
| [0002](./0002-status-vocabulary-danger.md)      | Standardize status vocabulary on `danger`                       | Accepted | `danger`, not `error`, across UI status.                                   |
| [0003](./0003-adopt-prettier.md)                | Adopt Prettier for formatting                                   | Accepted | `format` / `format:check` scripts; CI gate.                                |
| [0004](./0004-eslint-error-policy.md)           | Tighten ESLint from warn to error                               | Accepted | `no-console` / `no-explicit-any` at `error`; `--max-warnings=0` deferred.  |
| [0005](./0005-pr-ci.md)                         | Add PR continuous integration                                   | Accepted | Later extended by the format-check step and the Storybook job (0010/0011). |
| [0006](./0006-zod-boundary-validation.md)       | Validate Okta API responses at the boundary with zod            | Accepted | List-path validation deferred.                                             |
| [0007](./0007-version-source-of-truth.md)       | Single source of truth for version                              | Accepted | `package.json` is canonical; manifest derived at build.                    |
| [0008](./0008-activity-bar-and-cancellation.md) | Unified activity bar and one cancellation path                  | Accepted | Replaced `LoadingBar` + `SchedulerStatusBar`.                              |
| [0009](./0009-batch-operation-runner.md)        | One batch runner for all multi-call Okta operations             | Accepted | Builds on 0008.                                                            |
| [0010](./0010-component-explorer.md)            | Adopt Storybook as the component explorer                       | Accepted | Partly superseded by 0011.                                                 |
| [0011](./0011-storybook-single-docs-site.md)    | Storybook is the single documentation site; browser story tests | Accepted | Supersedes parts of 0010.                                                  |
| [0012](./0012-no-test-tampering.md)             | Never modify or delete a test to make it pass                   | Accepted | Squash-merge hides test-first ordering; enforce at authoring time.         |

## Adding an ADR

Number sequentially, use the Context / Decision / Consequences shape, and set
`Status: Accepted` with a date. When a new decision changes an old one, add a fresh ADR
and note the supersession in both — never edit an accepted record in place.
