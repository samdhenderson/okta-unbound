# The gates

Run the ones your change can affect. Every one of these is cheap except the
last two.

| Gate                                         | Catches                                                                                                                                                                                                                 | Red means                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix reel run type-check`           | everything static in `reel/`                                                                                                                                                                                            | `reel/` is eslint-ignored, so this is the **only** static gate — but it does not set `noUnusedLocals`, so it will not catch an orphaned import. |
| `npm run reel:plan:check`                    | `plan.generated.json` / `CUT.generated.md` behind `script.ts`                                                                                                                                                           | run `npm run reel:plan`. If it reports a compile error instead, the composition does not build.                                                 |
| `npm --prefix reel run check-verbs`          | a `spring()` added past the ratchet; an `EASE` token that stopped parsing; an em/en dash in a string; a registered verb that is not exported or has no row in the matrix; a verb part scheduled past its own verb's end | the dash ban is ADR-0043. The spring ratchet fails on an **increase and on a decrease** without lowering the baseline.                          |
| `npm run reel:theme:check`                   | `theme.generated.ts` out of step with `tailwind.css`                                                                                                                                                                    | run `npm run reel:theme`.                                                                                                                       |
| `npm run reel:vo:check`                      | an act with no WAV; narration longer than its picture; dead audio; a digit in a spoken line                                                                                                                             | **currently red with 15 "no narration recorded"** — the known state. Any other failure, or any other count, is yours.                           |
| `npm run capture:check`                      | footage that never settled, a scroller that did not move, a bad opening frame                                                                                                                                           | only relevant after a re-shoot.                                                                                                                 |
| `npm run reel:identical -- --against <name>` | a refactor that moved the picture                                                                                                                                                                                       | save the baseline **before** you change anything.                                                                                               |
| `npm run reel`                               | the delivery encode                                                                                                                                                                                                     | minutes. Last.                                                                                                                                  |

Root gates that also cover reel files: `node scripts/check-control-chars.mjs`
and `node scripts/check-cited-paths.mjs` (docs, skills, and the two ledgers).

## What a green result does not prove

- **`reel:identical` passing** proves nothing about a composition it does not
  sample: preview compositions, the `verbs` matrix, and any act with
  `frames: null`. Confirm coverage by breaking the thing on purpose - and break
  something the **film** renders, not a prop only the matrix passes. See
  `traps.md`.
- **`type-check` passing** does not mean an import is used. See `traps.md`.
- **`reel:plan:check` passing** only says the plan matches the script. It says
  nothing about whether the cut is any good.
- **A still** cannot show a transition; **a contact sheet** cannot show motion.

## Order

1. `type-check` — fastest, catches most.
2. `reel:plan:check` — cheap, and everything downstream reads the plan.
3. `check-verbs`, `theme:check`, `vo:check` — cheap.
4. `reel:look` / `reel:draft` — actually look at it.
5. `reel:identical` — only for a no-visible-change refactor. ~60s.
6. `npm run reel` — only when shipping.
