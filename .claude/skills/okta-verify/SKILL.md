---
name: okta-verify
version: 1.0.0
description: >-
  How to verify a change in Okta Unbound — the full gate ladder in order, which
  gates are hard CI blockers versus advisory, the mandatory external-timeout
  wrapper for local vitest runs, and which passing results are not actually
  evidence (a story with no play function, a grep on a file with a control byte,
  a coverage number that can't see dead code, a new test that passes for the
  wrong reason). Use before saying a change is done, when asked to "verify this",
  "run the checks", "make sure this passes CI", "is this safe to merge", when a
  test or story is green but something still feels off, when a grep or knip run
  reports suspiciously few or zero matches, or when deciding how much of the
  ladder a given change actually needs.
---

# Verifying a change

Nine tools, one gate at release time, and results from several of them lie by
omission rather than by error. This skill is the order to run them in, which
ones actually block a merge, and the specific ways a green result here has been
wrong before in this repo.

## The ladder, in order

Run top to bottom; stop at the first red result and fix before continuing —
each later step assumes the earlier ones pass.

| #   | Command                                                              | Catches                                                                                                                                                      | Gate                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run type-check`                                                 | Type errors (`tsc --noEmit`, `strict`)                                                                                                                       | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 2   | `npm run lint`                                                       | ESLint rules: no raw `console.*`, no new `any`-adjacent patterns, unused-disable-directives, hooks rules                                                     | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 3   | `npm run format:check` (or `npm run format` to fix)                  | Prettier formatting                                                                                                                                          | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 4   | `npm run test:run` (dev loop) / `npm run test:coverage` (matches CI) | Unit + component tests, jsdom, browser-free; `test:coverage` also enforces the thresholds below                                                              | **Hard** — `verify` job runs `test:coverage`                                                                                                                                                                                                                                    |
| 5   | `npm run test:storybook`                                             | Every story rendered headless in real Chromium + an axe accessibility check; the handful of stories with a `play` function also get interaction assertions   | **Hard** — separate `storybook` job, no `continue-on-error`                                                                                                                                                                                                                     |
| 6   | `npm run knip`                                                       | Unused files, exports, and dependencies — the class of dead code `noUnusedLocals`/`no-unused-vars` structurally cannot see (both are file-local)             | **Advisory** — `continue-on-error: true`, becomes hard once the current backlog reaches zero (`docs/dead-code.md`)                                                                                                                                                              |
| 7   | `npm run knip:production`                                            | Reachability from the three manifest entry points only, tests/stories excluded from the project — surfaces code alive _only_ because its own test imports it | **Advisory permanently** — needs human judgment (see `docs/dead-code.md`'s three-reasons list)                                                                                                                                                                                  |
| 8   | `npm run knip:circular`                                              | Import cycles (`madge`)                                                                                                                                      | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 9   | `npm run lint:control-chars`                                         | Raw control bytes outside tab/LF/CR in tracked text files                                                                                                    | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 10  | `npm run lint:cited-paths`                                           | Every `src/…` path cited in `docs/`, `.claude/`, `CLAUDE.md`, `AGENTS.md` (excluding `docs/adr/`) still resolves on disk                                     | **Hard** — `verify` job                                                                                                                                                                                                                                                         |
| 11  | `npm run build`                                                      | Production Vite/`@crxjs` bundle actually compiles (manifest, chunking, MV3-specific bundling that `tsc --noEmit` does not exercise)                          | **Not run by `ci.yml` at all.** Only gates at tag-push time, in `beta-release.yml`. Still worth running locally on anything touching `vite.config.ts`, the manifest, or `src/background`/`src/content` entry points — a break there won't show up until someone cuts a release. |
| 12  | `npm run build-storybook`                                            | The component-explorer static site builds (feeds `test:storybook`'s browser project and `deploy-pages.yml`)                                                  | **Hard** — first step of the `storybook` job, before `test:storybook` runs against it                                                                                                                                                                                           |

Two things the table doesn't show:

- **`test:coverage` is the only test command that feeds the coverage gate.**
  `test:run` (no coverage flag) is the right command for the local dev loop —
  faster, same test set — but confirming a PR is clean means `test:coverage`,
  because that's what CI actually runs.
- **`format:check` runs before `lint` in CI**, not after — `ci.yml`'s order is
  format, lint, type-check, test:coverage, knip, knip:production, knip:circular,
  control-chars, cited-paths. The ladder above orders by "what a local session
  should run first" (type errors are usually the fastest, cheapest signal),
  which is a different question from "what order CI executes in." Either order
  reaches the same gates; don't infer CI's order from this table.

## The timeout wrapper is mandatory, not optional

Never run `npx vitest run <file>` bare. `--testTimeout` does **not** stop a
render loop — an infinite loop starves the very timer that would cancel it.
Always wrap the process from outside:

```
perl -e 'alarm 240; exec @ARGV' npx vitest run <file>
```

then `pkill -9 -f vitest` afterward regardless of whether it returned. This
matters beyond the one command hanging: husky's pre-commit runs
`vitest related --run` against staged files, resolving imports on disk — a
test file that hangs in isolation will also hang every future commit that
happens to import it, until someone notices and kills it manually.

(`docs/testing.md`'s external-timeout section is the source of this rule; it
also has the container-specific `VITEST_BROWSER_EXECUTABLE` pin for
`test:storybook` if that command tries to download a browser instead of using
the installed one.)

## Results you should not trust

A gate returning green, or a search returning empty, is not the same claim in
every case below. Each of these has produced a false "all clear" in this repo.

**"No matches" is not evidence of absence.** A literal NUL byte in
`src/sidepanel/hooks/useAppsData.ts` made the file _binary_ to `grep(1)`, and
grep skips binary files silently — no warning, no non-zero exit.
`grep -c appsCacheKey` on the very file that defined `appsCacheKey` returned
nothing. This is exactly why `lint:control-chars` (step 9) exists and is a hard
gate — but it only catches the byte, not the stale conclusions someone already
drew from the grep before the gate existed. When a search comes back
suspiciously empty on a file you expect to match, cross-check with
`file -b <path>` before trusting the "no matches."

**Substring matches masquerade as real hits.** A grep for `play:` also matches
`display:`. Anchor the pattern (word boundaries, or grep for the fuller token)
before trusting a match count either direction.

**Concurrent test runs fake a hang.** Six agents running vitest at once made
one file appear to hang past 580 seconds; run alone, it finishes in 29 seconds.
Before concluding a file hangs, re-run it by itself.

**Coverage cannot see dead code, in either direction.** `coverage.all` is off
in `vitest.config.ts`, so v8 only instruments files a test actually loads. An
untested dead module never appears in the report at all — it's absent from the
denominator, not scored 0%. A fully-tested dead module scores 100% and
inflates the average, so _deleting_ it makes the reported percentage go down
even though the codebase got healthier (`statusNormalizer.ts` cost the average
~0.1 points on removal). A small coverage drop on a deletion PR is expected,
not a regression — `npm run knip:production` (step 7) is the tool that actually
finds this class of dead code; coverage numbers cannot.

**A green story with no `play` function is a weak signal.** It asserts exactly
two things — it rendered without throwing, and it is axe-clean
(`docs/testing.md`, ADR-0011, ADR-0014). It does not check that the right text
appeared, that a callback fired, or that a derived value is correct. At last
count 6 of 115 story files have a `play` function; treat the other 109 as
"doesn't crash," not "behaves correctly." This also means "there's already a
story" is never on its own grounds to delete a `.test.tsx` under ADR-0022 — a
2026-08-13 audit of 45 components carrying both found none where the story
covered the same ground as the test.

**A passing new test can pass for the wrong reason.** Before trusting a test
you just wrote to prove a fix, prove it fails without the fix: revert the
source change, re-run the single test file (with the timeout wrapper), confirm
it goes red, then restore the fix and re-run to confirm green. A test that
never goes red at any point in that sequence is vacuous — it was passing
before your change too, and proves nothing.

## Scaling effort to the change

Not every change needs the full ladder. A one-line doc fix or a comment change
needs steps 1–3 and `lint:cited-paths` if it added a citation — not the browser
suite. Anything touching a `components/shared` primitive, `src/sidepanel/cache/`,
the `useOktaApi` message-passing path, or a zod schema at the Okta-response
boundary needs the full ladder including `test:storybook`, because those are
exactly the surfaces where a passing unit suite and a broken UI or a broken
cross-tab cache disagree. When in doubt, the routing table in the top-level
`CLAUDE.md` names which `docs/*.md` covers the surface you're touching — read
that first; it usually answers whether this is a narrow or wide change.

## Source of truth

`package.json` scripts, `.github/workflows/ci.yml` (PR gate) and
`.github/workflows/beta-release.yml` (release-time build), `vitest.config.ts`
(the two projects and the coverage thresholds), `docs/testing.md`, and
`docs/dead-code.md`. When this skill and those disagree, they win — file an
update here.
