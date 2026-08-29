/**
 * Every selector the reel aims at, and the trap attached to each one.
 *
 * This file exists because the old system kept its selectors inline across
 * ~1,200 lines of choreography, each wrapped in the paragraph explaining why the
 * obvious selector was wrong. That made the knowledge unfindable and the
 * choreography unreadable, and it meant a selector used by three scenes was
 * explained in one of them and guessed at in the other two.
 *
 * So: one registry, each entry documented once, and a walk reads as a script.
 * **Nothing here was guessed.** Every one was found with `probe-scene.mjs`,
 * which dumps a story's buttons, tabs, inputs, expandables and headings; if you
 * add one, probe it rather than reasoning about the JSX.
 *
 * The house rule for this file: if a selector needs a sentence of explanation,
 * that sentence lives here and not at the call site.
 *
 * @module
 */

/** The app's single scroller. Every sticky band and scroll timeline resolves against it. */
export const SCROLL_ROOT = '[data-testid="app-scroll-root"]';

/** Escape a value for use inside a `[attr="…"]` selector. */
const attr = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Escape a string so it can sit inside a `RegExp` as a literal. */
const rx = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Match from the start of an accessible name, which is how rows are named. */
const startsWith = (value) => new RegExp(`^${rx(value)}`);

/* --- The shell ----------------------------------------------------------- */

/**
 * A tab in the vertical rail.
 *
 * `shared/Tabs.tsx` gives each rail tab `role="tab"` and `aria-label={label}`,
 * so the accessible name is the label whether or not it is visually unfurled.
 * That is the only reason this works while the rail is collapsed to glyphs.
 *
 * The nine labels, from `src/sidepanel/tabs.ts`: Home, Users, Groups, Apps,
 * Rules, Policies, Export, Explorer, History. Home replaced Overview — it is the
 * first tab now, not a missing one.
 */
export const railTab = (page, label) => page.getByRole('tab', { name: label, exact: true });

/**
 * The ActivityBar's operation meter.
 *
 * **Not a signal that anything is running.** It is mounted at rest, with
 * `aria-label="Operation progress"`, from the moment the panel loads — measured
 * on the coverage stage before a scan was even armed. So `waitFor(visible)` on
 * it passes instantly and `waitFor(hidden)` never resolves, which cost this
 * chapter a thirty-second timeout that read like a scan that never finished.
 *
 * Kept because it is worth *filming* — the bar moving is the shot — but the
 * edges of an operation come from {@link mfaScanningButton} and
 * {@link mfaRescanButton}, which change text only when the state does.
 */
export const progressBar = (page) => page.locator('[role="progressbar"]');

/* --- Home ------------------------------------------------------------------ */

/**
 * The jump bar's own scope.
 *
 * `JumpBar.tsx` wraps the field and its results in `<section aria-label="Jump
 * to an entity">`, so every lookup inside it can be scoped through this rather
 * than through the field's own accessible name — useful once the results list
 * is on screen and rows need disambiguating from the working set below them,
 * which sits in its own unrelated `<section>`.
 */
export const jumpBarSection = (page) => page.getByRole('region', { name: 'Jump to an entity' });

/**
 * The jump bar's text field.
 *
 * `Input`'s `ariaLabel` prop lands on the native `<input>` as `aria-label`, so
 * the accessible name is exactly `"Search groups, apps, users, rules"` — one
 * word short of the field's own placeholder (`"…rules, etc."`), which is a
 * separate string and not what the accessible name resolves to.
 *
 * **There is no submit button.** `JumpBar` wires only `onKeyDown`: Enter calls
 * `jump.submit()`, Escape clears. A chapter that types an id must press Enter
 * on the field itself — there is nothing else to click.
 */
export const jumpBarInput = (page) =>
  page.getByRole('textbox', { name: 'Search groups, apps, users, rules' });

/**
 * The jump bar's clear control.
 *
 * Rendered only once `jump.query` is non-empty (`IconButton label="Clear"`
 * beside the field). Absent on a cold bar — waiting on it before typing
 * anything times out.
 */
export const jumpBarClear = (page) => page.getByRole('button', { name: 'Clear' });

/**
 * The footnote under an id resolution.
 *
 * **Quote it exactly; do not paraphrase.** `JumpBar.tsx` renders one of two
 * literal strings, and only once `jump.resolution` is set (an id query that
 * resolved, never a name/email search):
 *
 * - `"Exact id match · no request"` — the snapshot answered locally.
 * - `"Exact id match · 1 request"` — Okta had to be asked.
 *
 * The separator is a middle dot (`·`, U+00B7) with a space on each side, not a
 * hyphen. There is no `data-testid` on this `<p>`; it is matched by its own
 * text, which is why the two variants are spelled out here rather than
 * inferred from `cost`.
 */
export const jumpResolutionFootnote = (page) => page.getByText(/^Exact id match ·/);

/**
 * A jump-bar result row, reachable in this build.
 *
 * `JumpResultRow` gives a reachable result `ListRow as="button"` with
 * `ariaLabel={`${name} — open in ${destinationLabel(kind)}`}` (an em dash,
 * U+2014, not a hyphen), so the accessible name starts with the entity's own
 * name — `startsWith` is enough, the same trick {@link personRow} uses.
 *
 * **An unreachable kind renders no button at all.** `onSelect` is omitted for
 * a kind `NavigationContext.canNavigateTo` refuses, which drops `ListRow` to
 * `as="div"` and swaps the row's trailing mark for an `OpenInOktaLink` — a
 * real anchor, not a disabled control. This selector only ever finds the
 * reachable form; an "Open in Okta" row is a link, matched by its own name
 * (`OpenInOktaLink`'s own accessible text), not by this.
 */
export const jumpResultRow = (page, name) =>
  jumpBarSection(page).getByRole('button', { name: startsWith(name) });

/**
 * The working set's own scope: `Pinned` or `Recent`.
 *
 * `WorkingSet.tsx` renders each as its own `<section aria-label="…">` — two
 * siblings, not one list with a heading each — so a row lookup has to be
 * scoped to the right one. `Recent` does not exist in the DOM at all until it
 * has rows (`WorkingSet.tsx`'s `recent.length > 0` gate); `Pinned` is always
 * present, empty or not, because its empty state is the affordance that
 * teaches pinning.
 */
export const workingSetSection = (page, label) => page.getByRole('region', { name: label });

/**
 * A working-set row, scoped to `Pinned` or `Recent`.
 *
 * **Not distinguishable by its own accessible name.** `WorkingSetRow` names its
 * `StretchedButton` `Open group` or `Open user` — the kind, not the entity —
 * so every pinned group row shares one accessible name with every other pinned
 * group row. The row's real name sits in a plain `<p>` beside the button, so
 * this filters the `<li>` by that text first and only then looks for the
 * (single, unambiguous once filtered) `Open …` button inside it — the same
 * move {@link previewImpactFor} makes for rule cards.
 *
 * @param section - `'Pinned'` or `'Recent'`, passed through {@link workingSetSection}.
 */
export const workingSetRow = (page, section, name) =>
  workingSetSection(page, section)
    .locator('li')
    .filter({ hasText: name })
    .getByRole('button', { name: /^Open (group|user)$/ });

/** The org findings card's own scope. */
export const orgSnapshotCard = (page) => page.getByRole('region', { name: 'This org' });

/**
 * One finding row in the org card, by its label text — `Groups with no
 * members`, `Groups no rule fills`, `Deactivated applications`, `Push apps
 * pushing nothing`, `Paused group rules`.
 *
 * **Not distinguishable by its own accessible name either**, and for the same
 * reason as {@link workingSetRow}: every finding's `StretchedButton` is named
 * `Open the filtered list`, identically, so this filters the row's `<li>` by
 * its label first. The number sits in a sibling span the button's
 * `aria-label` does not include, so nothing here needs to parse it out.
 */
export const orgFinding = (page, label) =>
  orgSnapshotCard(page)
    .locator('li')
    .filter({ hasText: label })
    .getByRole('button', { name: 'Open the filtered list' });

/**
 * The reports card's own scope.
 *
 * Directly beneath {@link orgSnapshotCard} and built from the same row idiom,
 * but its rows are disclosures rather than links to another tab — see
 * {@link reportDisclosure}.
 */
export const reportsCard = (page) => page.getByRole('region', { name: 'Reports' });

/**
 * A report row's disclosure control, by its label — `Empty groups nothing
 * fills`, `App access no rule maintains`.
 *
 * **Unlike a working-set or org-card row, this button carries a real, useful
 * accessible name — just not a clean one.** `Report.tsx` wraps the whole row
 * (the `FigureNumber` *and* the label) in one `<button aria-expanded>`, and
 * `FigureNumber` renders its digits as visible text rather than hiding them,
 * so the computed name is the count and the label run together with no
 * separator — `"12Empty groups nothing fills"`, the identical whitespace trap
 * {@link readMfaBreakdown} documents for the MFA breakdown rows.
 *
 * **Unanchored on both sides, and the trailing end is the one that matters.**
 * This was first written anchored to the end of the name, on the reasoning that
 * the count is a prefix and the label finishes the string. It does not:
 * `ReportLines` renders the report's `note` inside the same button, after the
 * label, so the real name runs on into a sentence about Workflows and SCIM. The
 * anchored form matched nothing and failed as "no element", which reads like a
 * report that is not rendering rather than a name that is longer than expected.
 * The two labels are distinct strings, so a substring match is still unique.
 *
 * **A report can legitimately have no button at all.** `Report.tsx` renders a
 * plain `<li>` when `value === null` or `findings.length === 0` — there is
 * nothing to disclose. A chapter that cannot find this control should check
 * whether the report has any findings before assuming the selector is wrong.
 */
export const reportDisclosure = (page, label) =>
  reportsCard(page).getByRole('button', { name: new RegExp(rx(label)) });

/**
 * Every named group inside an opened report.
 *
 * Same trap as {@link workingSetRow} and {@link orgFinding}: `FindingRow`'s
 * `StretchedButton` is named `Open this group` on every row of every report, so
 * the name identifies the kind and not the entity. That makes it useless for
 * picking one row and exactly right for counting them, which is what the Home
 * chapter needs — it checks the number on the disclosure against the number of
 * rows behind it rather than against a group name someone typed into a walk.
 */
export const reportRows = (page) =>
  reportsCard(page).getByRole('button', { name: 'Open this group' });

/**
 * Read one org-card finding's number off the panel.
 *
 * The label and the figure are siblings inside the row rather than one string,
 * and the row's accessible name is the identical `Open the filtered list` on
 * every finding, so neither can be read from the name. The row's text is taken
 * whole and the integer pulled out of it.
 *
 * Returns `null` when the row shows no number. That is a real state, not a
 * failure: `FigureNumber` renders a placeholder for a `subCount` whose
 * collection has not resolved, and a chapter that quietly turned that into `0`
 * would put a finding on camera claiming an org is clean when the truth is that
 * nobody has looked yet.
 */
export async function readOrgFinding(page, label) {
  const text = await orgSnapshotCard(page).locator('li').filter({ hasText: label }).innerText();
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Read one report's number off its disclosure.
 *
 * Straight off the control's own text, which `Report.tsx` composes as the count
 * and the label run together with no separator (see {@link reportDisclosure}).
 * That is a trap for matching and a gift for reading: the digits are the prefix.
 */
export async function readReportCount(page, label) {
  const text = await reportDisclosure(page, label).innerText();
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * How many rows the working set is holding, by section.
 *
 * Counted rather than asserted, because the seed is story-side and the cap is
 * app-side: `useWorkingSet` keeps at most five per section and expires entries
 * at fourteen days, so what a scene seeds and what the panel shows are two
 * different numbers and only one of them is on camera.
 */
export async function readWorkingSetCount(page, section) {
  return workingSetSection(page, section).locator('li').count();
}

/* --- Groups -------------------------------------------------------------- */

/**
 * The control that opens a group's detail rung.
 *
 * **Not the heading.** Each row lays a full-bleed `absolute inset-0` button
 * (`aria-label="View group details"`) over itself, which swallows every pointer
 * event aimed at the text — clicking the group's name does nothing at all, in
 * a way that looks exactly like a click that landed. The `title` carries the
 * group name, so it is both the real target and a unique one.
 */
export const groupRow = (page, name) =>
  page.locator(`[title="Open the detail view for ${attr(name)}"]`);

/**
 * The card that leads from a group's detail rung into its member roster.
 *
 * A deliberate choice over the `Members` tab, not a workaround: the card names
 * what it is about to show before it shows it, which is the better shot.
 *
 * Recorded because it cost an afternoon: this was first written up as "the tab
 * strip no longer renders", which was **wrong**. The strip renders fine. It was
 * blanked by an early capture stage that scaled a 980px panel inside a 1960px
 * viewport, which pins the docked action bar's `view-timeline` merge at its end
 * state — see `RENDER_SCALE` in `stage.mjs`. The lesson is the one this file
 * exists for: a selector that "does not work" may be reporting on the rig
 * rather than on the app, and the way to tell is to probe under the real
 * capture geometry.
 */
export const membershipCard = (page) =>
  page.getByRole('button', { name: /membership comes from/i });

/** The provenance filter chips above the roster: `All 94`, `<rule> 94 (100%)`, … */
export const attributionChip = (page, label) =>
  page.getByRole('button', { name: startsWith(label) });

/**
 * A member row's disclosure toggle.
 *
 * **Not the first `aria-expanded` node on the page** — that is the Composition
 * section, and aiming at it cost the first cut thirty seconds of frozen video.
 */
export const memberDisclosure = (page, name) =>
  page.getByRole('button', { name: startsWith(`Show details for ${name}`) });

/**
 * The heading `MemberExplorer` prints its counts in.
 *
 * Read with {@link readRosterCounts}, never with a regex that assumes a space:
 * the word "Members" is followed by a span separated by a *margin*, so
 * `textContent` reads `"Members16 of 94"`. A regex expecting `"Members 16 of
 * 94"` returns null, and the proof line silently falls back to generic wording.
 */
export const rosterHeading = (page) => page.getByRole('heading', { name: /^Members/ });

/**
 * Pull the roster's own figures out of the panel.
 *
 * The house rule is that no caption states a figure the panel does not display.
 * This is how that rule is kept honest, so it **throws** rather than returning
 * null: a chapter whose read-back failed must not quietly narrate prose instead
 * of evidence.
 *
 * @returns {Promise<{ shown: number, total: number }>}
 */
export async function readRosterCounts(page) {
  const text = await rosterHeading(page)
    .first()
    .textContent()
    .catch(() => null);
  const num = (v) => Number(String(v).replace(/,/g, ''));
  // Two forms, and both are real. Unfiltered the heading reads `Members94`;
  // once a facet narrows the roster it reads `Members16 of 94`. A reader that
  // knows only the second returns null on the first and the caption quietly
  // stops being evidence — which is the exact failure this throws to prevent.
  const narrowed = text && /Members\s*([\d,]+)\s*of\s*([\d,]+)/.exec(text);
  if (narrowed) return { shown: num(narrowed[1]), total: num(narrowed[2]) };
  const whole = text && /Members\s*([\d,]+)\s*$/.exec(text.trim());
  if (whole) return { shown: num(whole[1]), total: num(whole[1]) };
  throw new Error(
    `readRosterCounts: the roster heading read ${JSON.stringify(text)} — ` +
      'neither "Members N" nor "Members N of M", so there is no figure to caption',
  );
}

/**
 * A facet segment in the Composition spread bar.
 *
 * The segment carries `<Attribute>: <value>, N members` — precise and unique.
 * The legend pill beside it reads only `CONTRACTOR 15%`, which matches in more
 * than one facet and is the wrong thing to aim at.
 *
 * Facets are **discovered from this group's roster**, not from a fixed column
 * set (`discoverAttributeBreakdowns`), so which ones exist is a property of the
 * demo org and not a constant. The panel's own tab badge is the count of
 * record; enumerating them by hand produced seven where the panel said eight.
 */
export const facetSegment = (page, attribute, value) =>
  page.getByRole('button', { name: startsWith(`${attribute}: ${value}`) });

/**
 * Enumerate the facets the panel discovered, with their headcounts.
 *
 * This is the composition's raw material for the attribute diagram, and it is
 * **read** rather than imported for a specific reason: `AttributeSummary` rows
 * are derived from *this group's* roster, so the set is a property of the demo
 * org's data and changes when the org does. Hand-enumerating them once produced
 * seven where the panel's own badge said eight.
 *
 * Two things a caller has to respect, both of them `AttributeFacet.tsx`'s doing:
 *
 *  - **The bar is not the distribution.** It draws `summary.rows`, which is
 *    capped and rolls the tail into a single `Other` segment. `distinct` is the
 *    real number of values and is read separately off the card's header, so a
 *    diagram that says "7 values" is quoting the panel rather than counting
 *    segments.
 *  - **`Other` is not a filter.** That segment is rendered `disabled` and its
 *    click handler opens the full-distribution modal instead of toggling. It is
 *    returned with `filterable: false` rather than dropped, because a chapter
 *    that aims at it should fail loudly instead of quietly opening a modal
 *    mid-take.
 *
 * @returns {Promise<Array<{ attribute: string, distinct: number,
 *   values: Array<{ value: string, members: number, filterable: boolean }> }>>}
 */
export async function readFacets(page) {
  const rows = await page.getByRole('button').evaluateAll((els) =>
    els
      .map((el) => {
        // The spread-bar segment is the only control carrying this exact shape:
        // `<attribute>: <value>, <n> members`. The legend pill beside it reads
        // `Staff Engineer 20%`, which is ambiguous across facets.
        const name = (el.getAttribute('aria-label') ?? '').trim();
        const parsed = /^([^:]+):\s(.+),\s([\d,]+)\s+members?$/.exec(name);
        if (!parsed) return null;
        // Two hops out of the segment: the bar, then the card. The card's
        // header carries `Browse all N values`, which is the only place the
        // untruncated `distinct` is stated.
        const card = el.parentElement?.parentElement ?? null;
        const header = card?.querySelector('button[title^="Browse all "]');
        const distinct = /Browse all ([\d,]+)/.exec(header?.getAttribute('title') ?? '');
        return {
          attribute: parsed[1],
          value: parsed[2],
          members: Number(parsed[3].replace(/,/g, '')),
          filterable: !el.disabled,
          distinct: distinct ? Number(distinct[1].replace(/,/g, '')) : null,
        };
      })
      .filter(Boolean),
  );

  if (rows.length === 0) {
    throw new Error('readFacets: no facet segments on screen — is Composition open on Attributes?');
  }
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.attribute)) {
      grouped.set(row.attribute, { attribute: row.attribute, distinct: row.distinct, values: [] });
    }
    const facet = grouped.get(row.attribute);
    facet.values.push({ value: row.value, members: row.members, filterable: row.filterable });
  }
  return [...grouped.values()];
}

/**
 * A tab in the Composition section: `Attributes 8`, `MFA factors`.
 *
 * Scoped through the tablist's own accessible name for the reason
 * {@link userDetailTab} is scoped: several tab strips are mounted at once and
 * an unscoped `role=tab` lookup is a coin toss between them.
 *
 * **`Attributes` is already selected** when the section opens
 * (`CompositionReports` seeds its state to it), so clicking it is a no-op that
 * films as a dead beat. Only `MFA factors` is worth a click.
 */
export const compositionTab = (page, name) =>
  page
    .getByRole('tablist', { name: 'Group composition report' })
    .getByRole('tab', { name: startsWith(name) });

/**
 * A `Sort by` pill inside the Filters disclosure: `Name`, `Status`,
 * `Factor count`.
 *
 * Anchored to its own `Sort by` label rather than matched by name, because the
 * same panel renders status *filter* chips a few rows above and `Status` names
 * both. `SortPill` has no accessible name of its own beyond its text, so there
 * is nothing else to disambiguate on.
 *
 * `Factor count` exists only once an MFA scan has run.
 */
export const sortPill = (page, label) =>
  page
    .locator('xpath=//label[normalize-space()="Sort by"]/following-sibling::div[1]')
    .getByRole('button', { name: startsWith(label) });

export const compositionSection = (page) =>
  page.getByRole('button', { name: startsWith('Composition') });

/**
 * The Filters disclosure.
 *
 * With Filters shut, the `Sort by` pills are in the DOM at a zero box. A sort
 * beat has nothing to click unless this is opened first.
 */
export const filtersSection = (page) => page.getByRole('button', { name: startsWith('Filters') });

/* --- MFA ----------------------------------------------------------------- */

/**
 * The button that starts the real `scanGroupMfa`.
 *
 * `disabled` while `memberCount === 0` (`MfaScanButton.tsx`). Raw mouse events
 * bypass Playwright's actionability check, so a click on it while disabled
 * dispatches, does nothing, and records as landed unless the verb refuses.
 *
 * The scan is one `GET /api/v1/users/{id}/factors` per member — the single job
 * in this app that no query parameter collapses, and therefore the one place
 * the scheduler's progress bar reports on work an administrator really waits
 * for. `MFA_AUTO_THRESHOLD` is 500, so at 94 members no confirmation modal
 * appears.
 */
export const mfaScanButton = (page) => page.getByRole('button', { name: /^Run MFA scan/ });

/**
 * Read the MFA coverage breakdown the scan produced.
 *
 * The reporting chapter's whole claim is a number — "N of this group have no
 * second factor" — so it is read off the rendered rows rather than recomputed,
 * and it throws when there is nothing to read.
 *
 * **Not parsed from the row's accessible name.** `BreakdownReport` renders the
 * label, the count and the percentage as three adjacent nodes with no
 * separator, so a row reads `No factors enrolled2117%` — and `21` / `17%`
 * cannot be told apart from `2` / `117%` by any regex over that string. The two
 * spans are read as separate nodes instead, which is unambiguous.
 *
 * @returns {Promise<Array<{ label: string, count: number, pct: number }>>}
 */
export async function readMfaBreakdown(page) {
  const rows = await page.getByRole('button').evaluateAll((els) =>
    els
      .map((el) => {
        const labelSpan = el.querySelector('span[title]');
        const line = labelSpan?.parentElement;
        // The row is `<span title=label>…</span><span>count<span>pct%</span></span>`.
        // Anything without that exact pair is some other button entirely.
        if (!line || line.children.length !== 2) return null;
        const countSpan = line.lastElementChild;
        const pctSpan = countSpan.querySelector('span');
        if (!pctSpan) return null;
        const pct = Number.parseFloat(pctSpan.textContent ?? '');
        const count = Number(
          (countSpan.textContent ?? '').replace(pctSpan.textContent ?? '', '').replace(/,/g, ''),
        );
        if (!Number.isFinite(pct) || !Number.isFinite(count)) return null;
        return { label: labelSpan.getAttribute('title') ?? '', count, pct };
      })
      .filter(Boolean),
  );
  if (rows.length === 0) {
    throw new Error('readMfaBreakdown: no breakdown rows on screen — did the scan finish?');
  }
  return rows;
}

/**
 * The scan button mid-flight, which is the panel confirming the click armed it.
 *
 * There is deliberately no matching `Rescan` selector for the other edge. Once
 * `mfaResults` lands, `CompositionReports` replaces the MFA tab's entire empty
 * state — button included — with the `BreakdownReport`, so the only `Rescan`
 * left on the page is inside the collapsed Filters disclosure at a zero box.
 * Waiting on it is a thirty-second timeout that reads exactly like a scan that
 * never finished. The completion signal is {@link noFactorsRow}.
 */
export const mfaScanningButton = (page) => page.getByRole('button', { name: /^Scanning/ });

/**
 * The breakdown row for members with no factors.
 *
 * Its **existence is the completion signal** for the scan: `CompositionReports`
 * swaps the whole scan block for the `BreakdownReport` the instant `mfaResults`
 * lands. The scan is a ~7 second wall clock (`SCAN_WALL_CLOCK_MS` in
 * `demo/api.ts`) that nothing awaits, so sequencing it by arithmetic once
 * opened the following beat 39ms after it ended. Wait on this instead.
 *
 * The label is `No factors enrolled`. A guess at "No MFA" matched nothing.
 */
export const noFactorsRow = (page) => page.getByRole('button', { name: /^No factors enrolled/ });

/* --- Users and comparison ------------------------------------------------ */

/** The user detail rung. */
export const USER_DETAIL = '[data-testid="user-detail-view"]';

/**
 * The comparison surface.
 *
 * **Every tab lookup inside it must be scoped to this.** The app's own rail is
 * also `role="tab"` with Overview/Users/Groups/Apps, so an unscoped
 * `getByRole('tab', { name: /^Groups/ })` clicks the shell's Groups tab and
 * navigates straight out of the comparison — while reporting a landed click.
 *
 * `UsersTab.tsx` gives it `class="hidden"` until Compare opens, so if the
 * compare never opened, everything inside has a zero box.
 */
export const COMPARISON = '[data-testid="user-comparison-view"]';

/** Scope a lookup to the comparison surface. Use for every tab inside it. */
export const inComparison = (page) => page.locator(COMPARISON);

/**
 * A tab on the comparison surface: `Overview`, `Groups 5`, `Apps 1`, `Attributes 15`.
 *
 * Scoped, for the reason {@link COMPARISON} gives: unscoped, `Groups` and
 * `Apps` both resolve to the app's own rail and navigate out of the comparison.
 */
export const comparisonTab = (page, name) =>
  inComparison(page).getByRole('tab', { name: startsWith(name) });

/**
 * The comparison's own tallies, read off its tab badges.
 *
 * These are the figures the composition's set-difference diagram is built from,
 * so they come from the panel rather than from the demo fixtures — the two
 * should agree, and reading the panel is what proves it. Badge counts are
 * concatenated with no space (`Groups5`), the same trap as everywhere else.
 *
 * @returns {Promise<{ groups: number, apps: number, attributes: number }>}
 */
export async function readComparisonTallies(page) {
  const read = async (label) => {
    const text = await comparisonTab(page, label)
      .first()
      .textContent()
      .catch(() => null);
    const match = text && new RegExp(`^${label}\\s*([\\d,]+)`).exec(text.trim());
    if (!match) {
      throw new Error(
        `readComparisonTallies: the ${label} tab read ${JSON.stringify(text)} — no count in it`,
      );
    }
    return Number(match[1].replace(/,/g, ''));
  };
  return {
    groups: await read('Groups'),
    apps: await read('Apps'),
    attributes: await read('Attributes'),
  };
}

/**
 * A section heading on the comparison overview.
 *
 * `Group memberships`, `App assignments`, `What to fix` — the last of which is
 * the `CauseWorklist`, and it renders **failing clauses only**: a "pass" row is
 * a row the component cannot produce, so a caption promising a balanced
 * before/after is describing a component that does not exist.
 */
export const comparisonSection = (page, name) =>
  inComparison(page).getByRole('heading', { name: startsWith(name) });

/**
 * A search result row.
 *
 * Rows are buttons whose accessible name **begins with** the person's name, so
 * this anchors at the start. `getByText` matches a fragment and lets the click
 * fall through to the row behind it.
 */
export const personRow = (page, name) => page.getByRole('button', { name: startsWith(name) });

/**
 * The Users tab's own search field.
 *
 * Probed: the placeholder is `Search by email, name, or login...`, with a
 * trailing ellipsis. `getByPlaceholder` substring-matches by default, so the
 * ellipsis does not need to be spelled — but note that this placeholder is
 * **not** distinctive: the comparison surface's own search carries the same
 * text, which is why {@link comparisonSearch} scopes rather than relying on it.
 */
export const userSearch = (page) => page.getByPlaceholder('Search by email, name, or login');

/**
 * The comparison's own search field.
 *
 * Scoped to the comparison surface, because the Users tab search shares its
 * placeholder — and it mounts only after the compare phase transition, so a
 * locator resolved too early finds nothing and the chapter films an empty box.
 */
export const comparisonSearch = (page) =>
  inComparison(page).getByPlaceholder('Search by email, name, or login');

/**
 * A tab on the user detail rung: `Groups 9`, `Apps`, `Profile 41`.
 *
 * **Scoped to the rung, and it has to be.** The app's own rail is also
 * `role="tab"` and carries `aria-label="Groups"`, so an unscoped lookup
 * resolves to the rail's Groups tab — which does not merely fail, it reads back
 * the string `"Groups"` where the rung's tab reads `"Groups9"`, and a click on
 * it navigates out of the rung entirely. Measured: the users chapter read a
 * count of `undefined` off the wrong element.
 *
 * The badge count is concatenated with no space — `Groups9`, not `Groups 9` —
 * the same whitespace trap the roster heading has.
 */
export const userDetailTab = (page, name) =>
  page.locator(USER_DETAIL).getByRole('tab', { name: startsWith(name) });

/**
 * The Compare verb.
 *
 * `disabled` while the selected user's memberships load (`UserActionBar.tsx`).
 */
export const compareButton = (page) => page.getByRole('button', { name: /^Compare/ });

/**
 * The access-cause worklist.
 *
 * It labels its own section, which is the only stable way to scope to it: an
 * earlier crop used `view section, view > div > div` with `pick: 'largest'`,
 * which matched most of the comparison surface and therefore always succeeded,
 * proving nothing about what was under it.
 *
 * `CauseWorklist` renders **failing clauses only** — a "pass" row is a row the
 * component cannot produce — and it groups by *remedy*, not by rule, so its
 * headings read like `Fix a profile attribute`.
 */
export const causeWorklist = (page) =>
  page.locator('section[aria-labelledby="cause-worklist-heading"]');

/* --- Rules --------------------------------------------------------------- */

/**
 * The Rules tab opens on an explicit empty state behind this button.
 *
 * A chapter here must gate readiness on this text, not on the default
 * content-length heuristic: the empty state is around 200 characters and never
 * clears a >400 threshold, so the runner would wait out its whole timeout.
 */
export const loadRulesButton = (page) => page.getByRole('button', { name: /^Load Rules$/ });

/**
 * A rule card's `Preview Impact`, resolved through the rule's own id.
 *
 * **It cannot be selected by index.** All nine rule cards render one and all
 * nine report as visible, so `.first()` silently picks rule 1's — and the
 * earlier approach mixed two query engines that disagree on their population: a
 * DOM `querySelectorAll('button')` counts everything, while a role query
 * answers from the accessibility tree, which drops `aria-hidden`/`display:none`
 * subtrees, and `RuleCard` marks every collapsed card's body `inert`. An
 * off-by-one there does not fail — it captions the wrong rule's number over a
 * modal that opened perfectly.
 *
 * Held out of the reel for now regardless: `ruleImpact` narrates `D-052`, where
 * the app models deactivation as retracting membership and Okta does not.
 */
export const previewImpactFor = (page, ruleId) =>
  page
    .locator('.disclose[data-open="true"]')
    .filter({ hasText: ruleId })
    .getByRole('button', { name: /^Preview Impact$/ });

/**
 * A rule card's expander.
 *
 * The name is `Expand <rule>`, not the rule's own name — probed, because the
 * first version of this matched "a button whose name starts with the rule" and
 * there is no such button. A rule card's controls are all prefixed verbs
 * (`Expand`, `Open group`, `Copy rule id for`, …), and the rule's name appears
 * bare only in an `h3`, which is not clickable.
 */
export const ruleExpand = (page, name) =>
  page.getByRole('button', { name: `Expand ${attr(name)}` });

/** The Rules toolbar's buckets: `All Rules`, `Active Only`, `Conflicts (N)`. */
export const ruleFilter = (page, label) => page.getByRole('button', { name: startsWith(label) });

/**
 * Read the `RulesStatsGrid` cards: `Total Rules`, `Active`, `Inactive`,
 * `Conflicts`.
 *
 * **Settle before calling this.** `StatCard` runs its value through
 * `useCountUp`, so for the length of one `--dur-tell` the number on screen is a
 * number the org does not have. Reading mid-animation records a figure that is
 * real for two frames and wrong forever after, which is the exact failure the
 * read-back discipline exists to prevent.
 *
 * The card is two stacked `<p>`s with no wrapper of its own worth naming, so
 * the value is the title's next sibling.
 *
 * @returns {Promise<Record<string, number>>} keyed by card title.
 */
export async function readRuleStats(page) {
  const stats = await page.locator('p').evaluateAll((els) => {
    const out = {};
    for (const el of els) {
      const title = (el.textContent ?? '').trim();
      const value = Number((el.nextElementSibling?.textContent ?? '').replace(/,/g, ''));
      if (title && Number.isFinite(value) && el.nextElementSibling?.tagName === 'P') {
        out[title] = value;
      }
    }
    return out;
  });
  if (!('Total Rules' in stats)) {
    throw new Error(
      `readRuleStats: no stats grid on screen (saw ${Object.keys(stats).join(', ')})`,
    );
  }
  return stats;
}

/* --- Apps ---------------------------------------------------------------- */

/**
 * The Apps toolbar's status buckets: `All`, `Active`, `Inactive`.
 *
 * Scoped through `AppsToolbar`'s own `role="group"`, which is the reason that
 * markup is worth having: `Active` and `Inactive` are also the words every app
 * row prints as its status badge, so an unscoped lookup has a dozen decoys.
 */
export const appStatusFilter = (page, label) =>
  page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: label });

/** The Apps toolbar's sort fields: `Name`, `Status`, `Created`. Scoped for the same reason. */
export const appSort = (page, label) =>
  page
    .getByRole('group', { name: 'Sort applications' })
    .getByRole('button', { name: startsWith(label) });

/** The Apps search box. Note its own placeholder is not a stable target; the aria label is. */
export const appSearch = (page) => page.getByLabel('Search applications');

/**
 * Read the Apps toolbar's `Showing N of M`.
 *
 * **Anchored to the toolbar, and it has to be.** Six components in this app
 * print a `Showing N of M` line, and the first cut of this chapter read
 * `Showing 50 of 94` — the member list's paging, from a rung that was mounted
 * and scrolled away (ADR-0018). The number never moved when the filter was
 * clicked, and the take looked completely normal.
 *
 * So it is found by walking out from the status-filter group rather than by
 * text: that group is unique to `AppsToolbar`, and the count is its sibling.
 * Unlike the roster heading this string has real spaces, because it is one text
 * node rather than two boxes separated by a margin.
 *
 * @returns {Promise<{ shown: number, total: number }>}
 */
export async function readAppCounts(page) {
  const text = await page
    .locator(
      'xpath=//*[@role="group" and @aria-label="Filter by status"]' +
        '/following-sibling::span[starts-with(normalize-space(), "Showing")]',
    )
    .first()
    .textContent();
  const parsed = /Showing ([\d,]+) of ([\d,]+)/.exec(text ?? '');
  if (!parsed) throw new Error(`readAppCounts: could not read a count from "${text}"`);
  const num = (raw) => Number(raw.replace(/,/g, ''));
  return { shown: num(parsed[1]), total: num(parsed[2]) };
}

/** An app row's disclosure. Every row has one, so it is aimed at by app name. */
export const appRow = (page, name) =>
  page.getByRole('button', { name: `Copy application id for ${attr(name)}` });

/** The Apps tab's inventory toolbar lives above the list; its verb reads `Refresh`. */
export const appsRefresh = (page) => page.getByRole('button', { name: /^Refresh/ });

/* --- Readiness ----------------------------------------------------------- */

/**
 * How a chapter knows its stage has finished loading.
 *
 * The default is "the scroll root holds real content". It is deliberately not
 * Storybook's `storyRendered`: Storybook emits that only after
 * `waitForAnimations`, and a scroll-driven `.dock-band` holds it open for its
 * full 5s ceiling because its `finished` promise resolves at 100% range
 * progress. A chapter whose empty state is shorter than the threshold — Rules
 * is the known one — declares its own anchor instead.
 */
export const READY = {
  /** Characters of text in the scroll root that mean "this rung has rendered". */
  contentChars: 400,
  /** Per-chapter overrides, keyed by the anchor's Playwright selector. */
  rules: 'text=Load Rules',
};
