# Tools, and the specific ways each one lies

Every tool below answers a slightly different question from the one you asked. This
file records the gap for each.

---

## `grep` / `git grep` / ripgrep

### Failure mode 1: silent binary skip

`grep(1)` classifies a file as binary if it contains a NUL or other raw control byte,
and then **skips it without saying so** — no warning, no non-zero exit, just absence
from the results.

`src/sidepanel/hooks/useAppsData.ts` carried a literal NUL inside a template string as a
`(tabId, origin)` key separator. It ran correctly and was invisible in every editor and
diff. For months, every grep-based scan of this tree — `git grep`, ripgrep, knip, and
every human and agent searching for a symbol — reported "no matches" for things plainly
present in that file. It is the exact failure the dead-code tooling exists to prevent,
one layer down: a tool reporting "nothing here" when it never looked.

`npm run lint:control-chars` (`scripts/check-control-chars.mjs`) now fails CI on any
tracked text file containing a raw control byte other than tab, newline, or carriage
return. That closes this instance. It does not close the class.

**The rule:** when a search returns nothing and you expected something, verify the
search before believing it.

```
file -b src/sidepanel/hooks/useAppsData.ts
# "Java source, Unicode text, UTF-8 text"  -> grep read it
# anything containing "data"               -> grep skipped it silently
```

Other reasons a search silently under-reports, worth ruling out in the same breath:

- `.gitignore` / `.eslintignore` exclusions that ripgrep honours by default (`rg -uu`)
- A glob that misses `.tsx` while you were thinking about `.ts`
- Searching `src/` when the answer is in `scripts/`, `.storybook/`, or `docs/`
- A symbol reached through re-export, so the importing file names the barrel instead

### Failure mode 2: substring false positives

A grep for `play:` over the 115 story files returns **17** files. A grep for `  play:`
— anchored on the indentation of a real story property — returns **6**. The other
eleven are `display:` inside inline style objects.

That 3x inflation was carried straight into a plan ("45 components could collapse"),
published, and had to be publicly corrected. It is the cheapest possible error and the
most embarrassing one.

**Before trusting any grep count:**

1. Anchor the pattern — leading whitespace, `\b`, `^`, or the full declaration form.
2. Run the same search with `-o` and eyeball the matched text, not the filenames.
3. Ask what _else_ ends in your token. `play:` / `display:`. `error` / `errorMessage` /
   `onError` / `// error handling`. `Status` / `StatusBadge` / `statusText`.

### Failure mode 3: counting comments and docs as code

Doc comments, TypeDoc blocks, ADR quotations, and `.stories.tsx` files all match the
same patterns as production code. This repo documents heavily, so the inflation is
large. Exclude explicitly, or classify per item (`claim-types.md`, count claims).

---

## `npm run knip` vs `npm run knip:production`

These answer **different questions**, and picking the wrong one is why "nothing uses
this" claims survive review.

|                                 | `knip.json` (`npm run knip`)         | `knip.production.json` (`npm run knip:production`)            |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `project`                       | all of `src/**`                      | `src/**` **minus** `*.test.*`, `*.stories.tsx`, `src/test/**` |
| Tests / stories as entry points | yes                                  | no                                                            |
| Answers                         | "is anything at all importing this?" | "is this reachable from the manifest entry points?"           |

The consequence: **`npm run knip` structurally cannot see a module that is kept alive
only by its own test.** The test is an entry point, the test imports the module, so the
module is used — by a consumer that exists solely to consume it. Only the production
config drops the tests and lets that module surface.

Rules:

- A reachability claim about _production_ code is checked with `knip:production`.
- A green `knip` run is **not** evidence a module is used by anything that ships.
- Neither tool sees dynamic reach. `src/sidepanel/export/registry.ts` picks descriptors
  up through `import.meta.glob`, which is why the descriptor glob is an explicit entry
  in both configs. Any similar pattern you add needs the same treatment.
- Neither tool can see through a control byte (see grep, above). knip is grep-adjacent
  here.
- `npm run knip:circular` (madge) answers a third question entirely — import cycles —
  and says nothing about reachability.

Full rationale: `docs/dead-code.md`.

---

## Git archaeology

The claim "it was always like this" and the claim "the refactor changed it" are both
settled by reading the old file, not by reasoning about the diff.

```
git log --oneline -- <path>                 # what touched it
git show <commit>^:<path>                   # the file as it was BEFORE that commit
git show <commit>^:<path> | diff - <path>   # exactly what that commit changed in it
git log -S'<symbol>' --oneline -- <path>    # commits that added or removed the symbol
git log --diff-filter=D --oneline -- <path> # the commit that deleted it, if it is gone
```

`git show <commit>^:<path>` is the one to reach for first: it prints a historical
version to stdout without a checkout, a stash, or any working-tree change. Use it to
recover the ground truth a refactor erased before deciding whether the refactor's
description of itself is accurate.

`git log -S` is the honest way to answer "when did this stop being used" — it searches
for commits where the _count_ of the string changed, so it finds the removal rather
than every commit that touched the file.

Note that a doc's claim may be a _correct description of a past state_. That is
especially true of ADRs, which `docs/adr/README.md` holds immutable precisely so they
keep describing the moment they were written. "The ADR is wrong" and "the ADR has been
overtaken" are different findings and get different write-ups.

---

## Proving a test is not vacuous

A green test is evidence of nothing until you have seen it go red. Two situations
require the check:

- You are about to **delete or merge past** a behaviour because "a test pins it".
- You are **adding a regression test** for a bug you just fixed.

The technique is the same in both: break the production code, not the test.

```
# 1. Change the source so the claimed behaviour no longer holds.
#    e.g. `if (!needle) return policies;` -> `return [...policies];`
# 2. Run only the suite that is supposed to catch it, with a hard external timeout.
perl -e 'alarm 180; exec @ARGV' npx vitest run src/sidepanel/components/policies/policyFilters.test.ts
# 3. Restore.
git checkout -- src/sidepanel/components/policies/policyFilters.ts
```

Red → the pin is real. You may not merge past it without an explicit decision.
Green → the "pinned behaviour" is not pinned, and whatever you were protecting is
imaginary.

The external timeout is mandatory for any local `vitest run`: `--testTimeout` does not
stop a render loop, because an infinite loop starves the timer. Reap the runner after
the run with `pkill -9 -f 'node_modules/(\.bin/)?vitest'`, as a **separate, final**
command — never chained after the run and never chained before something that still
needs to happen (such as the `git checkout --` that restores the source file you
mutated). `pkill -f` matches the full command line of every process, so a chained
`pkill`, or a broader pattern such as bare `vitest` or `node.*vitest`, SIGKILLs the
invoking shell and silently drops the rest of the command — which is how a mutated
file gets stranded in the working tree. See `docs/testing.md`.

**Never** edit the assertion to see whether it matters. Rewriting an assertion to
observe its behaviour is indistinguishable from weakening it, and ADR-0012 forbids it
outright.

---

## What a passing story does and does not prove

A story with no `play` function asserts exactly two things: it **renders without
throwing**, and it is **axe-clean**. It does not assert behaviour, state transitions,
or handler wiring. Six of 115 story files have a `play` function.

So "there is a story for it" is not evidence that behaviour is covered, and a
test+story pair is almost never redundant. Any claim of the form "the story already
covers this" is an equivalence claim and gets checked as one — read the `play`
function, or there is nothing to read. `docs/testing.md`, ADR-0022, ADR-0023.

---

## The gates that already encode a past lesson

Two CI scripts exist because a claim-check failed and nobody wanted to repeat it. Both
scan `.claude/` as well as `docs/`, so anything written under this skill is subject to
them:

```
node scripts/check-cited-paths.mjs     # npm run lint:cited-paths
node scripts/check-control-chars.mjs   # npm run lint:control-chars
```

`check-cited-paths.mjs` fails on any backticked or markdown-linked `src/…` path, in a
tracked `.md` file, that does not resolve on disk — because 5 of 44 cited paths pointed
at files that had been deleted or renamed. It deliberately skips globs, directory
references (no trailing extension), fenced code blocks, and everything under
`docs/adr/`.

Both scan **tracked** files only. A new, uncommitted file is not yet in `git ls-files`,
so a clean run does not mean your new file passed — check it by hand, or stage it, before
claiming it did.
