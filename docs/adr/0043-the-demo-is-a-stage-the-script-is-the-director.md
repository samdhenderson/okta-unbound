# ADR-0043: The demo is a stage; the script is the director

- Status: Accepted
- Date: 2026-08-26

## Context

Okta Unbound had no way to show itself. Demonstrating it meant pointing a screen
recorder at a real org, and every real org is someone's private directory — so
the extension could be described but never shown.

Storybook already held everything a fake org needs: a `useOktaApi` facade mock
wired through a Vite alias, a `chrome.*` fake, Playwright as a dependency, and a
headless screenshot script. What it did not hold was anything that shows the
product _moving_. No story mounted `App`, so tab navigation, view push/pop and
the ActivityBar had no stage. `preview.tsx` stamps `data-motion="off"` on every
story and `tailwind.css` clamps animation to `1ms` under it, so the default state
of the entire catalogue is motionless. And the shared fixtures — 250 users named
`First{n} Last{n}`, one group called `Test Group` — read as unfinished on camera.

## Decision

Add a `Demo/` story set filmed by a Playwright script, and split the two
responsibilities strictly:

**A scene is a stage.** `src/sidepanel/demo/scenes.stories.tsx` seeds the demo
org, sets the initial state, mounts `App`, and stops. Scenes carry **no `play`
functions**.

**The script is the director.** `.storybook/scripts/film-scenes.mjs` drives every
movement, draws the cursor, and places the captions.

Four mechanical reasons, not a stylistic preference:

1. `docs/component-explorer.md` already forbids the combination — "keep `play`
   functions off motion-enabled stories" — and every scene is motion-enabled by
   construction.
2. **A `play` has no wheel and no viewport.** `useStaggerReveal` only cascades
   rows that genuinely cross the viewport, and `actionBarFit` only re-splits when
   the panel width really changes. `page.mouse.wheel()` and `setViewportSize()`
   exist; `userEvent` equivalents do not.
3. **A `play` blocks the ready signal.** Storybook emits `storyRendered` only
   after `waitForAnimations`, and a scroll-driven `.dock-band` holds that open for
   its full 5s ceiling — its `finished` promise resolves at 100% range progress.
   The script waits on a DOM anchor instead.
4. **A throw inside `play` paints an error overlay mid-take**, ruining footage in
   a way nobody notices until playback.

Supporting decisions:

- **Demo data lives in `src/sidepanel/demo/`**, not `.storybook/`. It does not
  ship — Rollup follows the manifest entry graph and nothing there reaches it —
  and living in `src` keeps it under tsc, eslint and knip, which matters because
  it mirrors `shared/types.ts` and `groupSummary.ts` and must not drift. It is
  added to `coverage.exclude`: it has no behaviour to assert.
- **Memberships are derived, not asserted.** Each rule-fed group's membership is
  computed by applying the predicate its rule expresses, so a member row claiming
  rule-based provenance is telling the truth and a group cannot advertise a
  headcount it does not hold.
- **Scenes are `tags: ['!test']`** — a 30-second staged scene has no business in
  the browser suite — with `a11y` and `actions` disabled. They still type-check
  and still build, which is the gate that matters (`build-storybook` and
  `test:storybook` are separate CI steps).
- **Showcase motion is injected, not authored.** The reel needs motion roughly
  2.6× the product's own scale; rather than animate around the design system, the
  film script overrides the same `--dur-*` / `--ease-*` custom properties the app
  consumes. Nothing enters `tailwind.css`; it is a gel on the light, not a change
  to the set.

## Consequences

- `npm run film` regenerates every clip after a UI change; `--reel` produces one
  continuous 16:9 video with title cards, so there is a publishable artefact
  without an ffmpeg dependency.
- Choreography is coupled to real selectors, so a renamed control breaks a beat.
  Beats are isolated and timestamped into `clips/manifest.json`, and a missed
  mark is reported rather than silently filmed — the first cut hid an empty
  search box behind a beat that reported success.
- `.storybook/mocks/chrome.ts` gained a real `runtime.onMessage` registry, a
  seedable `storage.local`, `tabs.get`/`tabs.reload`, and stagers for page
  context and scheduler state. These make the fake usable by ordinary stories
  too.
- The `useOktaApi` mock gained the seven facade keys it was missing; without
  `getUserProfileSchema` the comparison surface could not render at all.
