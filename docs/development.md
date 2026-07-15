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
| `npm run docs`              | Regenerate `docs/api/` (TypeDoc from source comments)  |
| `npm run docs:clean`        | Delete the generated `docs/api/`                       |

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

## Documentation comments (TypeDoc)

API docs are generated from source comments with **TypeDoc** (`npm run docs` →
`docs/api/`). The config (`typedoc.json`) expands over all of `src` **except**
`*.test`/`*.spec` files, so every non-test module is part of the public API surface
and is expected to carry doc comments. When you add or move a module, document it in
the same change — treat it like the type-check gate, not a follow-up.

- **Every module file** opens with a header block: `@module <path within src>` plus a
  one-line `@description` of what it is and why it exists.
- **Exported functions, hooks, and components** get a summary sentence; add
  `@param`/`@returns` where they carry signal and `@example` for non-obvious helpers.
- **Exported interfaces/types and their fields** get brief doc comments — each renders
  as its own TypeDoc page, so a bare `interface` reads as undocumented.
- Keep the "why" _in_ the comment: preserve `CHARACTERIZED:` / intentional-quirk notes
  as prose so the rationale ships with the symbol (see the `groups/` hooks for the
  pattern).
- `docs/api/` is **generated output** — never hand-edit it. Change the source comment
  and re-run `npm run docs`.

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
