/**
 * Export — a tour chapter.
 *
 * Home's `report` beat opens "App access no rule maintains" in place, on the
 * Home rung, and reads its row count off the disclosure. This chapter closes
 * the loop the rest of the film only states structurally: the identical
 * finding, `unmaintainedAppAccessReportDescriptor`
 * (`src/sidepanel/export/descriptors/orgReports.ts`), is one entity in the
 * Export tab's own catalog — findable without going through Home first, and
 * downloadable as a file rather than merely browsable in place.
 *
 * The second idea is the one `ExportTab.tsx`'s own module doc argues: a
 * snapshot-sourced descriptor (`source: { kind: 'snapshot', … }`) joins its
 * rows out of collections the shell already holds — `useOrgEntityIndex`'s
 * groups, rules, apps and app-groups — so this report, unlike a live search
 * export, **costs zero requests**. `columns` is the beat that makes that
 * argument visible: toggling a column re-renders the preview instantly, which
 * is only unremarkable if you already believe nothing was fetched to produce
 * it.
 *
 * ## What this chapter does not do
 *
 * It never presses `Download CSV`. The capture runner has no download
 * handling, and a save dialog would end the take — `Preview` is the verb this
 * chapter uses instead, and it renders the same projected rows the CSV would.
 *
 * @module
 */
import {
  exportColumnToggle,
  exportEntityCard,
  exportHeading,
  exportPreviewButton,
  railTab,
  readExportPreviewRows,
} from '../selectors.mjs';

/** The finding Home's `report` beat opens, and the descriptor that hands it back as a file. */
const REPORT = 'Report: App access no rule maintains';

/** A column every row carries but no reader needs to see twice — see the `columns` beat. */
const DROPPABLE_COLUMN = 'Group ID';

export async function walk({ page, drive, beat }) {
  await beat('open', async () => {
    // This chapter shares the Home stage, exactly as `apps.mjs` does — the
    // rail's tabs carry `role="tab"`, so a click here is a real navigation and
    // not a scroll within Home.
    await drive.click(railTab(page, 'Export'), { navigates: true });
    await drive.settle(1800);
  });

  await beat('pick', async () => {
    await drive.scrollTo(exportEntityCard(page, REPORT));
    await drive.click(exportEntityCard(page, REPORT));
    await drive.settle(1400);

    // The configure phase's own heading is the proof the right descriptor
    // opened — the entity hub's cards share no distinguishing accessible name
    // beyond their own text, so this is the one place worth reading rather
    // than assuming.
    const opened = await drive.read('descriptor', () => exportHeading(page).innerText());
    if (!opened.includes(REPORT)) {
      throw new Error(
        `picking "${REPORT}" opened onto "${opened}" instead — the chapter would be ` +
          'narrating one report while filming another',
      );
    }
  });

  await beat('columns', async () => {
    // Toggling a column off and straight into an unchanged preview is the
    // shot: nothing was refetched to produce it, because nothing was fetched
    // to produce the first render either.
    await drive.click(exportColumnToggle(page, DROPPABLE_COLUMN));
    await drive.settle(900);
  });

  await beat('preview', async () => {
    await drive.click(exportPreviewButton(page));
    await drive.settle(1800);

    const shown = await drive.read('previewRows', () => readExportPreviewRows(page));

    /*
      There is deliberately no match count read here, and the absence is a fact
      about this descriptor rather than an omission. `REPORT_SHAPE` declares
      `filter: { kind: 'none' }` (`orgReports.ts`), and `ExportTab` renders the
      filter box only when the kind is something else, so there is no match
      count on screen at all for a report.

      Reading one anyway is the trap this comment exists to close. The reader
      returns `null` for "no number on screen", `null` is not `0`, and a guard
      written as `shown > matched` then compares against `null`, which JavaScript
      coerces to zero: every honest take fails, claiming the preview showed more
      rows than matched. The number this beat can actually stand behind is the
      one the table rendered.
    */
    if (shown === null) {
      throw new Error('the preview table never rendered — there is no row count to read');
    }

    // Home named this finding as a real one; a preview that comes back empty
    // would contradict the very claim this chapter exists to pay off.
    if (shown === 0) {
      throw new Error(
        `"${REPORT}" previewed 0 rows — Home's report beat named this finding, so handing ` +
          'back nothing here would contradict it on camera',
      );
    }
    await drive.settle(1400);
  });
}
