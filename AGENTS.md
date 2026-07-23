# AGENTS.md

This repo's working instructions live in **[CLAUDE.md](./CLAUDE.md)** and
**[docs/](./docs/README.md)**. This file is a thin, tool-agnostic pointer to them —
it deliberately does not duplicate their content. **Full routing table, hard rules,
and subagent definitions live in CLAUDE.md and docs/ — read those before making
changes, regardless of which tool you are.**

## Project

**Okta Unbound** — a Chrome MV3 side-panel extension for Okta group/user admin.
Stack: React 19, TypeScript 5.9 (`strict`), Tailwind v4, Vite + `@crxjs/vite-plugin`,
Vitest + Testing Library + MSW, `idb`. ~22k LOC.

## Commands

```
npm run dev           # dev build (load dist/ as an unpacked extension)
npm run build         # production build
npm run type-check    # tsc --noEmit
npm run lint          # eslint (0 errors required; warnings are legacy debt)
npm run format        # prettier --write
npm run test:run      # vitest jsdom unit project (browser-free)
npm run test:storybook   # run every story as a headless-browser test
npm run test:coverage # coverage (thresholds 80/75)
npm run docs             # TypeDoc → Markdown for the Storybook Internals section
npm run storybook        # component + docs explorer dev server (:6006)
npm run build-storybook  # static docs site (components + Internals + Documentation)
```

For everything else — the message-passing model, the hard rules and security
hardening rules, the doc routing table, and the plan-and-approval gate — see
[CLAUDE.md](./CLAUDE.md).
