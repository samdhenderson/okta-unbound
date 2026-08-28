/**
 * Users — the tour chapter.
 *
 * Type a name, pick a person, the rung re-points to them. One interaction.
 *
 * @module
 */
import { personRow, userDetailTab, userSearch } from '../selectors.mjs';

/** The demo org's hero person: Engineering, FULL_TIME, Seattle. */
const HERO = 'Amara Okonkwo';

export async function walk({ page, drive, beat }) {
  await beat('search', async () => {
    // Typed at a human cadence rather than filled, because the type-ahead is
    // the point of the shot: each keystroke narrows the list on camera.
    await drive.type(userSearch(page), HERO);
    await drive.settle(1400);
  });

  await beat('open', async () => {
    // Result rows are buttons whose accessible name runs name + email + status
    // with no separators — `Amara Okonkwoamara.okonkwo@example.comACTIVE` — so
    // the match anchors at the start and nothing else is safe to assume.
    await drive.click(personRow(page, HERO), { navigates: true });
    await drive.settle(1600);
  });

  await beat('groups', async () => {
    // The detail rung opens on Groups. Reading the tab's own badge is the
    // chapter's evidence: it is the panel's count, not ours.
    const label = await userDetailTab(page, 'Groups').first().textContent();
    const count = Number(/(\d+)/.exec(label ?? '')?.[1]);
    if (!Number.isFinite(count)) {
      throw new Error(`groups: the Groups tab read ${JSON.stringify(label)} — no count in it`);
    }
    await drive.read('groupCount', async () => count);
    await drive.scrollBy(360, 1400);
    await drive.settle(900);
  });
}
