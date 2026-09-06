/**
 * Attributes — a deep chapter.
 *
 * A group read as a population. The panel discovers the profile attributes for
 * itself, and each one is a filter: two of them are applied in turn, and the
 * second genuinely ANDs onto the first — a smaller population survives both
 * than survives either alone.
 *
 * The argument the composition makes over this footage is that **nothing here
 * is refetched**. Every count moves against members the panel already holds,
 * which is why applying a second cut on top of the first costs nothing — and
 * why the before and after figures are read off the panel rather than asserted.
 *
 * ## Two different surfaces, on purpose
 *
 * The first cut is still applied from the **Composition report on Insights**
 * (`facetSegment`): a single value click there is honest — it narrows the
 * roster it lands on, full stop. The second cut is applied from the **Members
 * filter drawer** (`attributeFilterRow` → the value picker `valuePickerRow`),
 * not by going back to Composition for a second value.
 *
 * That is not a style choice. `CompositionReports.tsx`'s own module doc says
 * "a value click there therefore **leaves**: it applies the filter on the
 * Members tab and moves" — every click on that surface switches
 * `GroupDetailView`'s `activeTab` to Members, and because that view mounts one
 * tab pane at a time, a second visit to Insights does not refine the
 * `MemberExplorer` instance the first visit left filtered; it starts over,
 * so the second click replaces the first rather than composing with it. A
 * previous take proved this numerically: it read `firstFilter` = Title/Staff
 * Engineer (19), then `secondFilter` = User type/Contractor (14), and the
 * "composed" figure it filmed was **also 14** — exactly the second facet's own
 * population, not an intersection of the two. That is what this rewrite fixes.
 *
 * The Members filter drawer's attribute rows and value picker
 * (`AttributeFilterList` → `BreakdownDetailsModal`) apply to the *same live
 * filter set* the first click already put a value into —
 * `useMemberFilters`' own doc states the grammar: "`filterMembers` reads OR
 * within a dimension and AND across dimensions." Picking a second attribute's
 * value there adds to what is already filtering rather than tearing it down,
 * because nothing here switches tabs or remounts the explorer.
 *
 * This chapter opens through Members regardless — the roster is still the
 * population the facets narrow — and switches to Insights only once, to read
 * the discovered facets and apply the first cut.
 *
 * @module
 */
import {
  attributeFilterRow,
  compositionSection,
  facetSegment,
  groupRow,
  insightsTab,
  memberFilterToggle,
  membershipCard,
  readFacets,
  readRosterCounts,
  SCROLL_ROOT,
  valuePickerDone,
  valuePickerRow,
} from '../selectors.mjs';

const HERO = 'Engineering - All';

/**
 * Pick a facet by name, falling back to position, and one of its filterable values.
 *
 * **Single-valued facets are excluded, and that is the interesting part.** The
 * demo group's `Department` is Engineering for all 94 members, so filtering on
 * it selects everyone. A facet with one value is a fact *about* the group, not
 * a filter *of* it, and the panel is right to offer it — but a chapter arguing
 * that filters compose has to choose ones that can actually narrow.
 *
 * Both callers below take the **largest** filterable value of their facet.
 * Two large, independently-assigned attributes (the demo org's profile fields
 * are rolled per user, not correlated by construction — see
 * `src/sidepanel/demo/users.ts`) give an intersection room to be a real,
 * visibly-nonzero subset rather than the near-certain empty roster two rare
 * cuts would produce. `compose`'s own guard is what actually proves the two
 * values chosen here intersect properly; this function only gives it a
 * reasonable pair to test.
 */
function choose(facets, match, skip = []) {
  const usable = facets.filter((f) => f.values.filter((v) => v.filterable).length > 1);
  const facet =
    usable.find((f) => match.test(f.attribute) && !skip.includes(f.attribute)) ??
    usable.find((f) => !skip.includes(f.attribute));
  if (!facet)
    throw new Error(`no multi-valued facet left to filter on (skipping ${skip.join(', ')})`);
  // `Other` is rendered disabled and opens the distribution modal instead of
  // filtering — see `readFacets`. Aiming at it mid-take would open a dialog the
  // rest of the walk then clicks behind.
  const ordered = facet.values.filter((v) => v.filterable).sort((a, b) => b.members - a.members);
  const value = ordered[0];
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
    // Read while still on Members: `GroupDetailView` renders one pane per tab
    // (`activeTab === 'members' && (...)`), it does not keep both mounted like
    // the scroll-preserving rungs ADR-0016 covers, so the `Members N` heading
    // this reads stops existing the moment `facets` switches to Insights.
    await drive.read('rosterBefore', () => readRosterCounts(page));
  });

  await beat('facets', async () => {
    // Composition lives on its own Insights tab, not on Members — folded into
    // this beat rather than given its own, because `reel/src/script.ts`
    // already names `facets` in its plan and mark, and a tab switch on the way
    // to opening Composition is a precondition for the shot, not a shot of its
    // own (the same idiom `open` already uses for its own run of clicks).
    await drive.click(insightsTab(page), { navigates: true });
    await drive.settle(1200);
    // The Insights tab stacks an MFA coverage summary above Composition, so the
    // section header lands well below the fold at this viewport height — a
    // fixed capture geometry (`stage.mjs`'s `RENDER_SCALE`), not a scroll
    // position this walk controls. `drive.click` narrows to onstage elements
    // before resolving (see its own doc), so an unscrolled click here refuses
    // with "none of them onstage" even though the header is genuinely on the
    // page. Scroll it into the frame first, the same way `filter` does for a
    // facet segment below the fold.
    await drive.scrollTo(compositionSection(page));
    // Composition is a `CollapsibleSection` with `defaultOpen={false}`; nothing
    // inside it is reachable until it is opened, and a collapsed `.disclose` is
    // a real element with a zero box, so a locator resolves and then cannot be
    // clicked. Its Attributes tab is already selected once it opens, so there
    // is deliberately no click on it.
    await drive.click(compositionSection(page));
    await drive.settle(1600);
    await drive.read('facets', () => readFacets(page));
  });

  const facets = await readFacets(page);
  const first = choose(facets, /title|role|job/i);
  const second = choose(facets, /type|location|city|team/i, [first.attribute]);
  /** The narrowed counts, carried from `filter` into `compose` to be compared. */
  let filtered;

  await beat('filter', async () => {
    await drive.scrollTo(facetSegment(page, first.attribute, first.value));
    // `onToggle` in `CompositionReports.tsx` always calls `jumpToMembers`, which
    // switches `activeTab` to Members and snaps the scroller to the top of that
    // pane. Undeclared, that reads as the app drifting on its own —
    // `navigates: true` is what opens the window the jump is filmed inside of.
    await drive.click(facetSegment(page, first.attribute, first.value), { navigates: true });
    await drive.settle(1500);
    // The heading now reads `Members19 of 94` rather than `Members94`, which is
    // the whole reason the reader knows both forms.
    filtered = await drive.read('rosterFiltered', () => readRosterCounts(page));
    await drive.read('firstFilter', async () => first);
  });

  await beat('compose', async () => {
    // The second cut is applied from the Members filter drawer, not by
    // returning to Composition for a second value click.
    //
    // WHY NOT the Composition report again: `CompositionReports.tsx`'s own
    // module doc says a value click there "leaves: it applies the filter on
    // the Members tab and moves" — `GroupDetailView` mounts one tab pane at a
    // time, so a second trip to Insights does not refine the `MemberExplorer`
    // instance `filter` just narrowed, it starts a fresh one over the full 94.
    // A previous take of this chapter did exactly that and filmed a "composed"
    // figure that was really just the second facet's own population (94 → 19
    // → 14, where 14 was Contractor's own count, not an intersection). The
    // Members drawer's attribute rows apply onto the *same* live filter set
    // `filter` already put a value into — `useMemberFilters` reads OR within a
    // dimension and AND across dimensions — so this is the one surface where
    // stacking two values actually stacks them.
    await drive.scrollTo(memberFilterToggle(page));
    await drive.click(memberFilterToggle(page));
    await drive.settle(1200);
    await drive.scrollTo(attributeFilterRow(page, second.attribute));
    await drive.click(attributeFilterRow(page, second.attribute));
    await drive.settle(1200);
    // The value picker (`BreakdownDetailsModal`) opens as a dialog layered over
    // the page — no scroll of the app's own root, so no `navigates` here.
    await drive.scrollTo(valuePickerRow(page, second.value));
    await drive.click(valuePickerRow(page, second.value));
    await drive.settle(1400);
    // Close the picker before reading the roster back: the heading behind it
    // never stops existing (the modal is an overlay, not a replacement pane),
    // but the shot should land on the roster, not on the dialog that filtered
    // it.
    await drive.click(valuePickerDone(page));
    await drive.settle(900);
    const composed = await drive.read('rosterComposed', () => readRosterCounts(page));
    await drive.read('secondFilter', async () => second);

    // Refuse to ship a take that does not show what the chapter claims. A
    // stack of two filters is only a proof of composition if the survivors are
    // fewer than either filter's own population — anything else (equal to one
    // of them, or bigger) is either a replacement or a no-op wearing a
    // "composed" caption, which is the exact defect this rewrite exists to
    // remove. See the module doc for the take this caught the last time.
    if (composed.shown >= filtered.shown || composed.shown >= second.members) {
      throw new Error(
        `${first.attribute}: ${first.value} (${filtered.shown}) and ${second.attribute}: ` +
          `${second.value} (${second.members}) did not compose — the roster read ` +
          `${composed.shown}, which is not smaller than both. That means the two filters ` +
          'replaced one another instead of intersecting, and the chapter would be claiming ' +
          'a stack over a replacement. Pick a different pair of facet values.',
      );
    }
  });

  await beat('roster', async () => {
    // Close on the survivors: the same rows, re-ordered, never re-fetched.
    // `scrollBy` throws on a nonzero ask that produces zero motion (a declared
    // window with nothing in it is worse than no scroll at all), so ask for no
    // more than the room actually left below the fold.
    const room = await page.evaluate(
      (selector) => {
        const el = document.querySelector(selector);
        return el ? el.scrollHeight - el.clientHeight - el.scrollTop : 0;
      },
      SCROLL_ROOT,
    );
    if (room > 20) {
      await drive.scrollBy(Math.min(420, room), 1500);
      await drive.settle(1200);
    }
  });
}
