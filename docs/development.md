# Development practices

## Commands

| Script                      | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `npm run dev`               | Vite dev build (load `dist/` as an unpacked extension) |
| `npm run build`             | Production build                                       |
| `npm run type-check`        | `tsc --noEmit`                                         |
| `npm run lint` / `lint:fix` | ESLint                                                 |
| `npm run format`            | Prettier (added — ADR-0003)                            |
| `npm run test` / `test:run` | Vitest (watch / once)                                  |
| `npm run test:coverage`     | Coverage against 80/75 thresholds                      |

## Logging policy (hard rule)

- **No raw `console.*` in committed code.** Use the level-gated `logger` util.
  `no-console` is an ESLint `error` with a narrow exception only for the logger
  module itself (ADR-0004).
- **Never log secrets or payloads** — no XSRF tokens, no request/response bodies,
  no user PII. (Current leaks: `useOktaApi/core.ts:30-32`, `content/index.ts:182-184`.)
- Log levels are gated by build mode; debug logs must not ship enabled in production.

## Type safety policy

- `strict` is on. **No new `any`.** `@typescript-eslint/no-explicit-any` becomes an
  `error` after the boundary-validation burndown (ADR-0004/0006).
- Validate external data (Okta responses) at the boundary with **zod**; use inferred
  types instead of hand-written `any`-laden interfaces.

## Quality gates

- **Prettier** is the formatter (ADR-0003); it runs in `lint-staged` and CI. Don't
  fight it with manual formatting.
- **Husky + lint-staged** run `eslint --fix`, `prettier --write`, and
  `vitest related --run` on staged `*.{ts,tsx}`.
- **PR CI** (`.github/workflows/ci.yml`, ADR-0005) runs lint (`--max-warnings=0`) +
  type-check + test + coverage on every PR. Green CI is required to merge.
- `beta-release.yml` remains tag-triggered for releases — don't repurpose it for PRs.

## Versioning

`package.json` `version` is the single source of truth (ADR-0007). The manifest
version is derived at build; runtime reads one injected constant. **Never hardcode a
version** (remove `'0.3.0'` in `background/index.ts:210,221`).

## Conventions

- Feature-based folders; separation of concerns (components render, hooks hold
  logic, `shared/utils` holds pure helpers). See [state-management.md](./state-management.md).
- One error model: async ops return `{ success, error }` envelopes at boundaries;
  don't mix throw/return/swallow for the same layer.
- Deduplicate shared logic (`isOktaUrl`, date formatting) into `shared/utils` — don't
  copy-paste.
- Fill real repo/author metadata in `package.json` (currently placeholders).
