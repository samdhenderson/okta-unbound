/**
 * Dress the page for capture. Everything here, and nothing more.
 *
 * The old system's stage was 2,991 lines because the camera, the captions, the
 * chapter cards, the vignette and the cursor all lived in the page being
 * filmed. None of that is here — the composition owns all of it. What survives
 * is the short list of things that must be true of the *browser* before a frame
 * is worth keeping, and each one is here because a take was lost to it.
 *
 * @module
 */

/** The panel's own geometry. The app lays out at exactly this size. */
export const PANEL = { width: 840, height: 980 };

/**
 * How many device pixels we render per CSS pixel. **Measured answer: 1.**
 *
 * This started at 2 and had to come back down, so the reasoning is recorded
 * rather than the conclusion alone.
 *
 * `deviceScaleFactor` cannot do this job: with Playwright's
 * `deviceScaleFactor: 3`, `Page.startScreencast` still hands back 840x980 —
 * frames are captured at the CSS viewport size, and `maxWidth`/`maxHeight` are
 * caps rather than targets. So the supersampling the old system paid ~4x
 * encoder load for never reached the file at all. `Emulation.setPageScaleFactor`
 * does not change it either; both were measured.
 *
 * The only way to get more pixels out of a screencast is a bigger CSS viewport,
 * with the app scaled up into it. Both routes were built and both work
 * geometrically — a `transform: scale()` and a CSS `zoom`, each verified
 * end to end at 1680x1960 and 2520x2940, CFR 60.
 *
 * **And both break the product.** The app's docked action bar merges over the
 * detail tab strip on a scroll-driven `view-timeline`, and view progress is
 * measured against the viewport. Make the viewport 1960 tall around a 980 panel
 * and the merge sits pinned at its end state: the `Groups 9 / Apps / Profile 41`
 * strip renders as a blank grey band, while remaining perfectly present in the
 * DOM. Measured on both the Users and Groups detail rungs, with `transform` and
 * with `zoom`, and *not* at scale 1 — where a no-op `scale(1)` still establishes
 * a containing block, which is what rules the transform itself out as the cause.
 *
 * A clip like that is the worst kind: it plays fine and quietly omits a control.
 *
 * So the viewport is the panel, exactly, and sharpness is bought a different
 * way — the composition holds the panel at roughly 1:1 and takes its emphasis
 * from vector overlays drawn at full frame resolution, rather than from zooming
 * into soft video. Raise this only if the dock band stops being viewport-coupled.
 */
export const RENDER_SCALE = Number(process.env.CAPTURE_SCALE ?? 1);

/**
 * How much slower than life the app runs while being filmed.
 *
 * This is the speed-ramp budget, and it is a capture-time decision that no
 * amount of post can recover. Remotion can resample a clip onto any time curve,
 * but it can only show frames that exist: measured on a real product scroll,
 * the compositor produced roughly 10 frames per second of genuine motion, so
 * slowing that moment 4x in the composition would play at 2.5fps and read as a
 * stutter rather than as emphasis.
 *
 * So the app is filmed slowly and sped back up. At `RETIME = 3` every product
 * transition takes three times as long, the compositor emits about three times
 * as many real frames across it, and the composition plays that stretch at 3x
 * to restore natural speed — leaving 3x of genuine slow-motion headroom for the
 * moments worth dwelling on, with real frames behind every one of them.
 *
 * **Raised from 2 to 3 after watching the first cut.** At 2 the headroom ran
 * out exactly where it was wanted: a beat played at `dwell` (0.35x) was already
 * within a whisker of the captured frame rate, so the moments the film most
 * needed to slow down were the ones that had the least left to give. The cost
 * is linear shoot time and nothing else — the same walks, filmed slower.
 *
 * This is only half of the pacing story, and the smaller half. `RETIME` slows
 * the app's *own* transitions; it does nothing to how fast the driver moves the
 * pointer or presses a key, because those are wall-clock actions rather than
 * CSS. Those are retimed one by one in `drive.mjs` — see `TRAVEL_MS`,
 * `NOTICE_MS` and `type`.
 *
 * Written into the manifest, because the composition cannot infer it and a
 * wrong guess makes every chapter play at the wrong speed.
 */
export const RETIME = Number(process.env.CAPTURE_RETIME ?? 3);

/**
 * The app's own duration tokens, retimed.
 *
 * Overriding `--dur-*` rather than animating around the design system is the
 * one idea worth keeping from the old stage: the app consumes these tokens for
 * every transition it owns, so multiplying them is a gel on the light rather
 * than a change to the set. Values are `src/sidepanel/tailwind.css`'s own.
 */
const DURATIONS = { instant: 80, quick: 140, move: 220, travel: 320, tell: 500 };

/** The stylesheet, built for a given render scale and retime factor. */
export const stageCss = (scale = RENDER_SCALE, retime = RETIME) => `
  html, body {
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
    /* The composition draws the backdrop. Anything painted out here is a
       letterbox artefact around the panel, so there is nothing to style. */
  }

  /* The app lays out at panel size and rasterizes at \`scale\`. See RENDER_SCALE
     for why that scale is currently 1 and what breaks when it is not. */
  #storybook-root {
    position: fixed;
    top: 0;
    left: 0;
    width: ${PANEL.width}px;
    height: ${PANEL.height}px;
    transform: scale(${scale});
    transform-origin: 0 0;
    overflow: hidden;
  }

  /* The app root is \`h-screen\`. At \`RENDER_SCALE\` 1 the viewport IS the panel,
     so this is a harmless restatement — kept because it stops being harmless the
     moment anyone raises the scale. Measured at scale 2 without it: a scroller
     1960px tall inside a 980px panel, so the 33-group list had 29px of travel
     and a scroll beat filmed a still page. The symptom is not an error; it is a
     chapter that looks like it simply has nothing in it. */
  [data-testid='app-scroll-root'] {
    height: 100% !important;
    max-height: 100% !important;
  }

  /* Reserve the scrollbar's channel.
     \`tailwind.css\` styles \`.scrollable-list::-webkit-scrollbar\` with an explicit
     width, which opts the box out of Chrome's overlay scrollbars and gives it a
     classic one that takes its width out of the content box. So the instant a
     list crosses from fitting to overflowing, every box beside it loses 6px and
     any string under a truncate re-wraps on camera. There is no quiet period to
     wait out — the width simply changes — so it is reserved instead. */
  .scrollable-list,
  [data-testid='app-scroll-root'] {
    scrollbar-gutter: stable;
  }

  /* Storybook's loading overlay is a full-bleed white div that paints ON TOP of
     whatever the backdrop is. It is dressed rather than hidden: \`display: none\`
     would also throw away Storybook's error display, and an error rendered
     invisibly during a shoot is worse than a flash. */
  .sb-preparing-story,
  .sb-preparing-docs,
  .sb-wrapper,
  .sb-show-main {
    background: #000 !important;
  }

  /* Retimed product motion. The app consumes these for every transition it
     owns; multiplying them is what buys the slow-motion headroom. */
  :root, [data-motion='on'] {
${Object.entries(DURATIONS)
  .map(([name, ms]) => `    --dur-${name}: ${Math.round(ms * retime)}ms;`)
  .join('\n')}
  }
`;

/**
 * The init script: install the stylesheet before the first painted frame.
 *
 * Two phases, and the fallback is not optional. `addInitScript` runs at
 * document-start, and at document-start **`document.documentElement` can still
 * be null** — an earlier version observed it directly, threw
 * `TypeError: parameter 1 is not of type 'Node'`, and took the entire
 * stylesheet down with it. Nothing reported that: the shoot ran, the clip was
 * written, and the panel was simply unscaled and unstyled for the whole take.
 * Observing `document` works because `document` always exists.
 *
 * Under Vite dev this matters more than it looks. `DOMContentLoaded` fires only
 * after the whole module graph has executed — seconds and hundreds of requests
 * later — so anything that waits for it is far too late to affect first paint.
 */
export const stageInit = (scale = RENDER_SCALE, retime = RETIME) => `
(() => {
  const CSS = ${JSON.stringify(stageCss(scale, retime))};
  const install = () => {
    if (document.getElementById('capture-stage')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const el = document.createElement('style');
    el.id = 'capture-stage';
    el.textContent = CSS;
    host.appendChild(el);
    return true;
  };
  if (!install()) {
    // \`document\`, never \`document.documentElement\` — see above.
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  }
})();
`;

/**
 * Assert the stage actually took, and say so loudly if it did not.
 *
 * Every fault this module guards against is silent by nature — a missing
 * stylesheet, an unscaled root, a scroller sized to the wrong box — and all
 * three produce a clip that plays perfectly and shows the wrong thing. So the
 * runner checks rather than assumes, and a chapter that fails this never
 * reaches the composition.
 *
 * @returns {Promise<{ ok: boolean, problems: string[], measured: object }>}
 */
export async function verifyStage(page, scale = RENDER_SCALE) {
  const measured = await page.evaluate(
    ([panelW, panelH, want]) => {
      const root = document.getElementById('storybook-root');
      const scroller = document.querySelector('[data-testid="app-scroll-root"]');
      const box = root?.getBoundingClientRect();
      return {
        styled: Boolean(document.getElementById('capture-stage')),
        // The transform makes the painted box `scale` times the layout box, so
        // this is the one measurement that proves the scale is really applied.
        renderedWidth: box ? Math.round(box.width) : null,
        wantedWidth: panelW * want,
        layoutWidth: root ? Math.round(root.offsetWidth) : null,
        wantedLayoutWidth: panelW,
        scrollerHeight: scroller?.clientHeight ?? null,
        wantedScrollerHeight: panelH,
        scrollTravel: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
      };
    },
    [PANEL.width, PANEL.height, scale],
  );

  const problems = [];
  if (!measured.styled) problems.push('the stage stylesheet was never installed');
  if (measured.renderedWidth !== measured.wantedWidth) {
    problems.push(
      `panel renders ${measured.renderedWidth}px wide, wanted ${measured.wantedWidth}px ` +
        `— the scale transform is not applied, so the clip is at ${
          measured.renderedWidth && measured.wantedWidth
            ? (measured.renderedWidth / (measured.wantedWidth / scale)).toFixed(2)
            : '?'
        }x instead of ${scale}x`,
    );
  }
  if (measured.layoutWidth !== measured.wantedLayoutWidth) {
    problems.push(
      `app lays out at ${measured.layoutWidth}px, wanted ${measured.wantedLayoutWidth}px ` +
        '— it is not seeing itself as a side panel',
    );
  }
  if (measured.scrollerHeight !== measured.wantedScrollerHeight) {
    problems.push(
      `scroller is ${measured.scrollerHeight}px tall, wanted ${measured.wantedScrollerHeight}px ` +
        '— the h-screen override missed and scroll beats will film a still page',
    );
  }
  return { ok: problems.length === 0, problems, measured };
}
