/**
 * API Explorer — a tour chapter.
 *
 * Explorer has no seat in the icon rail — `src/sidepanel/tabs.ts` marks it
 * `railHidden` (ADR-0063) because it is a destination you go to on purpose
 * rather than one you browse into, and the icon rail has nine sections and no
 * room to spare. Its route is the ⌘K palette
 * (`src/sidepanel/hooks/useCommandPalette.ts`), so summoning the palette is
 * not a mechanical precondition to film past — it is the opening idea, and it
 * gets its own beat.
 *
 * The payoff is `ApiExplorerTab.tsx`'s own argument: the response viewer opens
 * on a **values-free Shape view**, with Redacted and Raw one click away. That
 * is both the interesting product idea (you can see what an endpoint returns
 * without seeing whose data it is) and the reason this tab is safe to put in
 * front of a camera at all.
 *
 * The request itself asks nothing invented: `/api/v1/groups/rules` is a path
 * `demoMakeApiRequest` (`src/sidepanel/demo/api.ts`) actually routes, to the
 * same demo rules the Rules tab renders — so the response on screen is real
 * demo data, not a stub built to look like one.
 *
 * ## What this chapter does not do
 *
 * It never lands on Raw without narrating Redacted first — Raw carries its own
 * on-screen warning that it is unredacted, and a chapter that skipped straight
 * to it would be demonstrating the one view this tab warns you to be careful
 * with, without showing the safer default that makes the tab worth having.
 * Nothing here resembles a real org: the path is a fixed literal and the demo
 * fixtures never carry a real hostname, user, or token.
 *
 * @module
 */
import {
  explorerPathInput,
  explorerSend,
  explorerViewTab,
  palette,
  paletteInput,
  readExplorerStatus,
} from '../selectors.mjs';

/** A path `demoMakeApiRequest` actually routes — the same rules the Rules tab renders. */
const PATH = '/api/v1/groups/rules';

export async function walk({ page, drive, beat }) {
  await beat('summon', async () => {
    // The opening idea: there is no rail seat to click. ⌘K is the whole route.
    await page.keyboard.press('Meta+k');
    await drive.waitFor(palette(page), { why: 'the command palette never opened' });
    await drive.settle(700);
    await drive.type(paletteInput(page), 'Explorer');
    await drive.settle(900);
    // No result-row selector is exposed for this palette — the field itself
    // has no submit button either (the same shape `jumpBarInput` uses on
    // Home), so Enter on the filtered top row is the only route in. This is a
    // real cross-tab navigation and it does not run through `drive.click`, so
    // it is not declared the way a click's `navigates` option would be — the
    // settle below is carrying that weight instead.
    await page.keyboard.press('Enter');

    // Waited on, not settled into. A palette that filtered to nothing, or a
    // row order that put another section on top, leaves Enter as a no-op and
    // the panel sitting on Home. A settle alone would film that happily and
    // the failure would surface two beats later as "the path field is not
    // there", which reads as a broken selector rather than as a navigation
    // that never happened.
    await drive.waitFor(explorerPathInput(page), {
      why: 'the palette never landed on Explorer',
    });
    await drive.settle(1800);
  });

  await beat('request', async () => {
    await drive.type(explorerPathInput(page), PATH);
    await drive.click(explorerSend(page));
    await drive.waitFor(explorerViewTab(page, 'Shape'), {
      why: 'the request never returned a response to view',
    });
    const status = await drive.read('status', () => readExplorerStatus(page));
    if (status === null) {
      throw new Error('the response landed with no status to read');
    }
    if (status < 200 || status >= 300) {
      throw new Error(`the request answered ${status} — this chapter has no response to show`);
    }
    await drive.settle(1400);
  });

  await beat('shape', async () => {
    // Shape is already the active view the instant a response lands
    // (`JsonViewer` opens on it) — the same "already selected" idiom
    // `compositionTab` documents for Attributes, so there is deliberately no
    // click here, only the hold that lets a viewer read it.
    await drive.settle(1800);
  });

  await beat('values', async () => {
    // Redacted, not Raw: the safer default's neighbour, and the view that
    // shows values exist without showing which ones are whose.
    await drive.click(explorerViewTab(page, 'Redacted'));
    await drive.settle(1600);
  });
}
