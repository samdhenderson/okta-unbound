/**
 * Rules — a tour chapter.
 *
 * Rules used to be the one tab that would not load itself, and this chapter
 * opened on the ask. ADR-0069 moved the fetch onto tab activation
 * (`useOwedLoad`, `src/sidepanel/components/RulesTab.tsx`), so the list is
 * already arriving by the time this walk gets a beat — the `load` beat is kept
 * (its name is filmed and played by `reel/src/script.ts`) but it now waits for
 * the list rather than asking for it. The empty state behind `Load Rules` only
 * renders if the auto-fetch itself failed, so there is nothing left to click.
 *
 * It ends on the one rule that is switched off, and on its expression. It stops
 * short of `Preview Impact` deliberately: that flow models deactivation as
 * retracting membership, which is not how Okta behaves, and a reel must not
 * narrate a bug as a feature (`D-052`).
 *
 * @module
 */
import { ruleExpand, ruleFilter } from '../selectors.mjs';

/** The demo org's one INACTIVE rule, and the longest expression in it. */
const DORMANT = 'Interns → cohort group';

export async function walk({ page, drive, beat }) {
  await beat('load', async () => {
    // This beat used to press `Load Rules` and read the stats grid's own
    // `Inactive` count as proof the chapter had a subject. ADR-0069 moved the
    // fetch onto tab activation (`useOwedLoad`, `RulesTab.tsx`), so the list
    // has already started arriving by the time this beat gets the camera —
    // there is nothing left to click. `Load Rules` still exists, but only as
    // the list panel's own empty-state prompt for when the auto-fetch itself
    // failed, so a click on it here would land on nothing.
    //
    // The stats grid is no longer the free read it used to be either: it now
    // sits behind the strip's `Stats` toggle, itself behind `More` (`RulesListActionBar.tsx`
    // gives it `priority: 'tier'`), so reading it here would cost two clicks
    // this beat has no narrative use for. Waiting on the chapter's own
    // subject — the one inactive rule `dormant` opens — proves the load
    // finished and gives `dormant` a specific fault to name if it did not.
    await drive.waitFor(ruleExpand(page, DORMANT), {
      why: 'the rules list never finished loading, or the demo org lost its one inactive rule',
    });
    await drive.settle(1200);
  });

  await beat('active', async () => {
    // The narrowing is the argument: the difference between every rule and the
    // ones actually in force is exactly the rule nobody remembered to delete.
    await drive.click(ruleFilter(page, 'Active Only'));
    await drive.settle(1600);
    await drive.click(ruleFilter(page, 'All Rules'));
    await drive.settle(1200);
  });

  await beat('dormant', async () => {
    await drive.scrollTo(ruleExpand(page, DORMANT));
    await drive.click(ruleExpand(page, DORMANT));
    await drive.settle(1800);
  });
}
