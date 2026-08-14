# Dead-code detection

`tsconfig`'s `noUnusedLocals` and eslint's `no-unused-vars` are both **file-local** —
neither can ever flag an unused _export_. Nothing in CI could see a module that no
production code imports. [knip](https://knip.dev) closes that gap; `madge` covers
import cycles.

```
npm run knip              # unused files, exports, and dependencies
npm run knip:production   # reachability from the manifest entry points only
npm run knip:circular     # import cycles (madge)
```

## Two configs, two different questions

**`knip.json` → `npm run knip`.** "Is this referenced by anything at all?" Tests and
stories count as consumers, because they are legitimate entry points. Catches modules
nothing imports, unused exports, and unused dependencies.

**`knip.production.json` → `npm run knip:production`.** "Is this reachable from the
three manifest entry points?" — `src/background/index.ts`, `src/content/index.ts`,
`src/sidepanel/main.tsx`, plus the export descriptors. Tests and stories are excluded
from the project entirely.

The second config exists because the first one **structurally cannot** find the most
expensive class of dead code in this repo: a module with no production callers that
stays "referenced" purely because its own test file imports it.
`src/shared/utils/statusNormalizer.ts` — 396 LOC, 6 exports, zero production callers,
524 LOC of tests — is invisible to `npm run knip` and lands at the top of
`npm run knip:production`.

Dependency and duplicate-export checks are switched off in the production config;
they are the default config's job and would otherwise report every test-only
devDependency as unused.

## How to act on the output

`npm run knip` findings are **actionable**. An unused file or export is dead until
someone shows otherwise.

`npm run knip:production` findings need **judgment**, which is why it is advisory and
never a CI gate. Three legitimate reasons an export appears there:

1. **A testing seam** — an internal helper exported so a unit test can reach it
   (`normalizeRuleName`, `checkRuleOverlap`, `clusterSimilarRules`). Real, but
   consider whether the test should go through the public surface instead.
2. **A public API with no current caller** — a shared primitive or type kept for
   symmetry. Check the barrel; an unexported sibling is usually the bug.
3. **Genuinely dead** — nothing reaches it, and the only thing keeping it alive is its
   own test. Delete both. Deleting a test whose subject is deleted is not test
   tampering: no failure is being silenced, and ADR-0012 does not apply.

### Known false positives

- **Export descriptors** (`src/sidepanel/export/descriptors/*.ts`) are loaded at build
  time via `import.meta.glob` in `src/sidepanel/export/registry.ts`. Static analysis
  cannot see that, so they are declared as explicit entry points in both configs.
  Their **named** exports genuinely have no production consumer — the registry uses
  the default export — so they surface as "duplicate exports". That is expected.
- **`tailwindcss`** is consumed through the `@tailwindcss/vite` plugin and a CSS
  `@import`, not a JS import. Listed in `ignoreDependencies`.
- **`.storybook/`** is excluded. It is not in `tsconfig.json`'s `include`, so knip
  falls back to a non-JSX parser and fails on `preview.tsx`. (That same gap means
  `npm run type-check` does not cover `.storybook/` either — tracked separately.)

## CI

`npm run knip` and `npm run knip:production` run in the `verify` job with
`continue-on-error: true`; `npm run knip:circular` is already a hard gate (there are
no cycles, and there should not be a first one).

**`npm run knip` becomes a hard gate once the backlog below reaches zero** — drop its
`continue-on-error` at that point. `knip:production` stays advisory permanently.

## Baseline — 2026-08-13

Recorded when the tooling landed, so later runs have something to diff against.

| Check                  | `npm run knip` | `npm run knip:production` |
| ---------------------- | -------------- | ------------------------- |
| Unused files           | 3              | **4**                     |
| Unused exports         | 31             | 44                        |
| Unused exported types  | 27             | 27                        |
| Unused devDependencies | 1 (`esbuild`)  | n/a                       |
| Duplicate exports      | 14             | n/a                       |
| Circular dependencies  | 0              | 0                         |

The four unreachable files (1,450 LOC including their tests):

| File                                    | LOC | Note                                                                                                      |
| --------------------------------------- | --- | --------------------------------------------------------------------------------------------------------- |
| `src/shared/utils/statusNormalizer.ts`  | 396 | 6 exports, no production callers; only importer is its own 524-LOC test. Invisible to the default config. |
| `src/shared/utils/validation.ts`        | 303 | 11 validators, no references, no test file                                                                |
| `src/sidepanel/hooks/useValidation.tsx` | 130 | no references anywhere; sole importer of `validation.ts`                                                  |
| `src/shared/cache.ts`                   | 97  | no mentions in `src/`                                                                                     |

Also worth noting from the baseline run:

- `esbuild` is an unused devDependency — vite provides it transitively.
- `msw` does not appear as unused only because `src/test/mocks/handlers.ts` imports
  it. That file's `handlers` export has no consumer and no test uses MSW, so `msw`
  becomes removable once `handlers` goes.
- Three `ruleEvaluator.ts` exports — `evaluateRuleExpression`,
  `canEvaluateClientSide`, `tryEvaluateRuleExpressionDetailed` — are reachable only
  from tests. ADR-0017 retained them deliberately; removing them needs that decision
  revisited, not a silent delete.
- `package.json`'s `"main": "index.js"` points at a file that does not exist (this is
  an extension, not a library) — knip reports it as a configuration hint.
