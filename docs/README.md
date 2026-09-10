# Docs

Small, single-purpose specs. Read only the one(s) relevant to your task — this is
the same routing `CLAUDE.md` enforces, to keep context lean.

## Product and system

| Doc                                          | Read it when you are…                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| [product.md](./product.md)                   | Scoping a feature, adding a tab, or judging whether a write verb earns it |
| [claims.md](./claims.md)                     | Putting a worked-out fact on screen, or writing any user-facing copy      |
| [architecture.md](./architecture.md)         | Understanding the message-passing pipeline, contexts, or `useOktaApi/`    |
| [scheduler.md](./scheduler.md)               | Touching rate limits, concurrency, the plan ledger, or 401 handling       |
| [state-management.md](./state-management.md) | Deciding hook vs context vs local state, or decomposing a component       |

## Security

| Doc                                      | Read it when you are…                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| [security.md](./security.md)             | Reviewing the trust model, threat model, or the boundary controls |
| [security-risks.md](./security-risks.md) | Looking up a residual risk, or verifying the posture yourself     |

## Interface

| Doc                                                  | Read it when you are…                                           |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [design-system.md](./design-system.md)               | Touching colors, typography, spacing roles, or density          |
| [surfaces.md](./surfaces.md)                         | Touching card chrome, elevation, or a list row                  |
| [components.md](./components.md)                     | Building or using a shared/feature component                    |
| [component-primitives.md](./component-primitives.md) | Looking up one primitive's prop contract                        |
| [action-bars.md](./action-bars.md)                   | Placing a verb, ranking `primary`, or touching a strip          |
| [page-shell.md](./page-shell.md)                     | Working on the shell, the rail, sticky bands, or the view stack |
| [ux-guidelines.md](./ux-guidelines.md)               | Working on modals, a11y, or loading/empty/error states          |
| [motion.md](./motion.md)                             | Touching durations, easings, primitives, or reduced motion      |
| [motion-recipes.md](./motion-recipes.md)             | Building a scroll-driven or multi-band choreography             |

## Working on the repo

| Doc                                              | Read it when you are…                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| [development.md](./development.md)               | Dealing with logging, secrets, `any`, build, lint, or CI    |
| [testing.md](./testing.md)                       | Writing, fixing, or removing tests                          |
| [component-explorer.md](./component-explorer.md) | Running Storybook or writing a `.stories.tsx`               |
| [storybook-infra.md](./storybook-infra.md)       | Touching viewports, framing, or stories-as-browser-tests    |
| [dead-code.md](./dead-code.md)                   | Hunting unused files/exports/deps, or reading a knip report |
| [reel.md](./reel.md)                             | Working on the demo reel or the store-page ad               |

## Backlogs and records

| Doc                                                  | Read it when you are…                                     |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [features-plan.md](./features-plan.md)               | Scoping or picking up new feature work                    |
| [rockstar-parity-plan.md](./rockstar-parity-plan.md) | Building toward full rockstar replacement                 |
| [adr/](./adr/README.md)                              | Writing down a decision whose _reasoning_ must outlive it |

---

**Rule of thumb:** load the matching row(s), not everything. Depth lives here;
`CLAUDE.md` is only the router + hard rules.

**Keep each doc under ~200 lines.** If one outgrows that, split it rather than
let it bloat. One deliberate exception: `security.md` runs longer, because a
reviewer auditing the trust boundary needs it in one piece — fragmenting the
posture across files makes it harder to verify, not easier.

**A rule belongs in one of these docs, not in an ADR.** `adr/` holds the argument
behind a decision; the doc holds the instruction. If a reader needs `adr/` to do
their job, the rule was filed in the wrong place.

The `docs-maintainer` agent keeps these in sync with the code.
