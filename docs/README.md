# Docs

Small, single-purpose specs. Read only the one(s) relevant to your task — this is
the same routing `CLAUDE.md` enforces, to keep context lean.

| Doc                                          | Read it when you are…                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)         | Understanding the message-passing pipeline, contexts, or `useOktaApi/`     |
| [design-system.md](./design-system.md)       | Touching colors, spacing, typography, or tokens                            |
| [components.md](./components.md)             | Building or using a shared/feature component                               |
| [ux-guidelines.md](./ux-guidelines.md)       | Working on modals, a11y, or loading/empty/error states                     |
| [state-management.md](./state-management.md) | Deciding hook vs context vs local state, or decomposing a component        |
| [development.md](./development.md)           | Dealing with logging, secrets, `any`, build, lint, CI, or versioning       |
| [testing.md](./testing.md)                   | Writing or fixing tests                                                    |
| [refactoring-plan.md](./refactoring-plan.md) | Picking up the remaining maintainability work — **start here** to refactor |
| [adr/](./adr/)                               | Looking up _why_ a convention exists                                       |
| [audit/](./audit/)                           | Reviewing the maintainability baseline + backlog                           |

**Rule of thumb:** load the matching row(s), not everything. Depth lives here;
`CLAUDE.md` is only the router + hard rules.

Keep each doc under ~200 lines. If one outgrows that, split it rather than let it
bloat. The `docs-maintainer` agent keeps these in sync with the code.
