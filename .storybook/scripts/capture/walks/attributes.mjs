/**
 * Attributes — a deep chapter.
 *
 * A group read as a population. The panel discovers the profile attributes for
 * itself, and each one is a filter: two of them compose, narrowing the same
 * roster twice, and then the survivors are re-sorted.
 *
 * The argument the composition makes over this footage is that **nothing here
 * is refetched**. Every count moves against members the panel already holds,
 * which is why it can afford to compose filters at all — and why the before and
 * after figures are read off the panel rather than asserted.
 *
 * @module
 */
import {
  compositionSection,
  compositionTab,
  facetSegment,
  filtersSection,
  groupRow,
  membershipCard,
  readFacets,
  readRosterCounts,
  sortPill,
} from '../selectors.mjs';

const HERO = 'Engineering - All';

/**
 * Pick a facet by name, falling back to position, and its largest filterable value.
 *
 * **Single-valued facets are excluded, and that is the interesting part.** The
 * demo group's `Department` is Engineering for all 94 members, so filtering on
 * it selects everyone: the first cut of this chapter composed `Title` with
 * `Department` and filmed the roster going from 19 to 19. A facet with one
 * value is a fact *about* the group, not a filter *of* it, and the panel is
 * right to offer it — but a chapter arguing that filters compose has to choose
 * one that can actually narrow.
 *
 * The largest value is taken rather than the smallest for a related reason: an
 * intersection of two rare values is a plausible way to land on an empty
 * roster, which films as a mistake.
 */
function choose(facets, match, skip = []) {
  const usable = facets.filter((f) => f.values.filter((v) => v.filterable).length > 1);
  const facet =
    usable.find((f) => match.test(f.attribute) && !skip.includes(f.attribute)) ??
    usable.find((f) => !skip.includes(f.attribute));
  if (!facet) throw new Error(`no multi-valued facet left to filter on (skipping ${skip.join(', ')})`);
  // `Other` is rendered disabled and opens the distribution modal instead of
  // filtering — see `readFacets`. Aiming at it mid-take would open a dialog the
  // rest of the walk then clicks behind.
  const value = facet.values.filter((v) => v.filterable).sort((a, b) => b.members - a.members)[0];
  if (!value) throw new Error(`facet "${facet.attribute}" has no filterable value`);
  return { attribute: facet.attribute, distinct: facet.distinct, ...value };
}

export async function walk({ page, drive, beat }) {
  await beat('open', async () => {
    await drive.scrollTo(groupRow(page, HERO));
    await drive.click(groupRow(page, HERO), { navigates: true });
    await drive.settle(1200);
    await drive.click(membershipCard(page), { navigates: true });
    await drive.settle(1400);
  });

  await beat('facets', async () => {
    // Composition is a `CollapsibleSection` with `defaultOpen={false}`; nothing
    // inside it is reachable until it is opened, and a collapsed `.disclose` is
    // a real element with a zero box, so a locator resolves and then cannot be
    // clicked. Its Attributes tab is already selected once it opens, so there
    // is deliberately no click on it.
    await drive.click(compositionSection(page));
    await drive.settle(1600);
    await drive.read('facets', () => readFacets(page));
    await drive.read('rosterBefore', () => readRosterCounts(page));
  });

  const facets = await readFacets(page);
  const first = choose(facets, /title|role|job/i);
  const second = choose(facets, /type|location|city|team/i, [first.attribute]);
  /** The narrowed counts, carried from `filter` into `compose` to be compared. */
  let filtered;

  await beat('filter', async () => {
    await drive.scrollTo(facetSegment(page, first.attribute, first.value));
    await drive.click(facetSegment(page, first.attribute, first.value));
    await drive.settle(1500);
    // The heading now reads `Members19 of 94` rather than `Members94`, which is
    // the whole reason the reader knows both forms.
    filtered = await drive.read('rosterFiltered', () => readRosterCounts(page));
    await drive.read('firstFilter', async () => first);
  });

  await beat('compose', async () => {
    await drive.click(facetSegment(page, second.attribute, second.value));
    await drive.settle(1500);
    const composed = await drive.read('rosterComposed', () => readRosterCounts(page));
    await drive.read('secondFilter', async () => second);
    // Refuse to ship a take that does not show what the chapter claims. Two
    // filters that compose to the same roster is not an argument, and it is
    // invisible at playback speed unless someone reads the numbers.
    if (composed.shown >= filtered.shown) {
      throw new Error(
        `composing ${second.attribute} did not narrow the roster ` +
          `(${filtered.shown} → ${composed.shown}) — the chapter has nothing to show`,
      );
    }
    if (composed.shown === 0) {
      throw new Error(`${first.value} ∩ ${second.value} is empty — pick a broader second facet`);
    }
  });

  await beat('sort', async () => {
    // With Filters shut, the `Sort by` pills sit in the DOM at a zero box, so
    // this disclosure has to be opened before there is anything to click.
    await drive.scrollTo(filtersSection(page));
    await drive.click(filtersSection(page));
    await drive.settle(1000);
    await drive.click(sortPill(page, 'Status'));
    await drive.settle(1300);
  });

  await beat('roster', async () => {
    // Close on the survivors: the same rows, re-ordered, never re-fetched.
    await drive.scrollBy(420, 1500);
    await drive.settle(1200);
  });
}
