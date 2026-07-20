# Docs

Small, single-purpose specs. Read only the one(s) relevant to your task — this is
the same routing `CLAUDE.md` enforces, to keep context lean.

| Doc                                              | Read it when you are…                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)             | Understanding the message-passing pipeline, contexts, or `useOktaApi/`    |
| [security.md](./security.md)                     | Reviewing the security posture, threat model, controls, or residual risks |
| [design-system.md](./design-system.md)           | Touching colors, spacing, typography, or tokens                           |
| [components.md](./components.md)                 | Building or using a shared/feature component                              |
| [component-explorer.md](./component-explorer.md) | Running Storybook, writing a `.stories.tsx`, or checking story coverage   |
| [ux-guidelines.md](./ux-guidelines.md)           | Working on modals, a11y, or loading/empty/error states                    |
| [state-management.md](./state-management.md)     | Deciding hook vs context vs local state, or decomposing a component       |
| [development.md](./development.md)               | Dealing with logging, secrets, `any`, build, lint, CI, or versioning      |
| [testing.md](./testing.md)                       | Writing or fixing tests                                                   |
| [features-plan.md](./features-plan.md)           | Scoping or picking up new feature work — the ranked backlog + UX sketches |
| [adr/](./adr/README.md)                          | Looking up _why_ a convention exists                                      |

**Rule of thumb:** load the matching row(s), not everything. Depth lives here;
`CLAUDE.md` is only the router + hard rules.

Keep each doc under ~200 lines. If one outgrows that, split it rather than let it
bloat. The `docs-maintainer` agent keeps these in sync with the code.
