/**
 * Camera equipment: the 16:9 stage, the amplified motion layer, the drawn
 * cursor, and the caption system. Injected at film time; none of it ships.
 *
 * ## Why the motion is not the product's motion
 *
 * `docs/motion.md` is deliberate that a side panel should feel quick: 80ms to
 * 320ms, overshoot reserved for confirmation alone. That is right for the
 * extension and wrong for a reel, where 220ms is about six frames and reads as a
 * cut rather than a movement. Rather than animate *around* the design system,
 * this scales it *up* — it overrides the same `--dur-*` / `--ease-*` custom
 * properties the whole app already consumes, and redefines the keyframes with
 * larger travel. One seam, amplified.
 *
 * ## Why there is a stage
 *
 * The panel is filmed wide (people run it wide on a big monitor, not at its
 * 360px floor), framed as a device on a 1920x1080 field, with the remaining
 * space used for captions. A bare 900px-wide portrait recording is not a
 * shareable video.
 */

/** The finished frame. 16:9, the shape every player and slide deck expects. */
export const STAGE = { width: 1920, height: 1080 };

/** The panel inside the frame — wide enough to look like real daily use. */
export const PANEL = { width: 900, height: 980, right: 72 };

/** Stage framing, amplified motion, cursor and caption styling. */
export const SHOWCASE_CSS = `
  html, body {
    width: ${STAGE.width}px;
    height: ${STAGE.height}px;
    overflow: hidden !important;
    background:
      radial-gradient(1200px 700px at 22% 18%, #1f2a44 0%, transparent 60%),
      radial-gradient(900px 600px at 85% 85%, #24324f 0%, transparent 55%),
      linear-gradient(160deg, #0d1424 0%, #131c30 100%);
  }

  /* The panel, framed as a device. The transform is load-bearing: it
     establishes a containing block, so the app's fixed ActivityBar and its
     portalled modal overlays anchor to this frame instead of escaping to the
     whole 1920x1080 field. Same trick the repo's own inSidePanelFrame uses. */
  #storybook-root {
    position: fixed !important;
    top: ${(STAGE.height - PANEL.height) / 2}px;
    right: ${PANEL.right}px;
    width: ${PANEL.width}px;
    height: ${PANEL.height}px;
    border-radius: 20px;
    overflow: hidden;
    transform: translateZ(0);
    box-shadow:
      0 40px 90px -20px rgb(0 0 0 / 0.55),
      0 0 0 1px rgb(255 255 255 / 0.08);
    animation: stage-panel-in 900ms cubic-bezier(0.16, 1.1, 0.3, 1) both;
  }

  /* The app root is h-screen, which would resolve to the 1080px field rather
     than to the frame it now lives in. */
  [data-testid='app-scroll-root'] {
    height: 100% !important;
    max-height: 100% !important;
  }

  @keyframes stage-panel-in {
    from { opacity: 0; transform: translateZ(0) translateY(28px) scale(0.97); }
    to   { opacity: 1; transform: translateZ(0) translateY(0) scale(1); }
  }

  /* --- Amplified product motion ----------------------------------------- */

  :root, [data-motion='on'] {
    --dur-instant: 200ms;
    --dur-quick: 380ms;
    --dur-move: 560ms;
    --dur-travel: 820ms;
    --dur-tell: 1100ms;
    --ease-standard: cubic-bezier(0.22, 1.2, 0.36, 1);
    --ease-entrance: cubic-bezier(0.16, 1.36, 0.3, 1);
    --ease-exit: cubic-bezier(0.5, 0, 0.75, 0);
    --ease-affirm: cubic-bezier(0.18, 1.8, 0.32, 1);
  }

  @keyframes rise-in {
    from { opacity: 0; transform: translateY(22px) scale(0.965); }
    60%  { opacity: 1; }
    to   { opacity: 1; transform: none; }
  }
  @keyframes collapse-out {
    from { opacity: 1; transform: none; }
    to   { opacity: 0; transform: translateX(48px) scale(0.94); }
  }
  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.9) translateY(28px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes push-in {
    from { opacity: 0; transform: translateX(46%) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes pop-in {
    from { opacity: 0; transform: translateX(-46%) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes affirm-flash {
    0%   { background-color: var(--color-success-light); box-shadow: 0 0 0 3px var(--color-success); }
    45%  { background-color: var(--color-success-light); box-shadow: 0 0 0 3px var(--color-success); }
    100% { background-color: transparent; box-shadow: 0 0 0 0 transparent; }
  }
  @keyframes skeleton-sweep {
    from { background-position: 240% 0; }
    to   { background-position: -240% 0; }
  }

  /* Stretch the stagger ladder: 24ms per row is one frame on camera. */
  .rise-in-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .rise-in-stagger > *:nth-child(2) { animation-delay: 70ms; }
  .rise-in-stagger > *:nth-child(3) { animation-delay: 140ms; }
  .rise-in-stagger > *:nth-child(4) { animation-delay: 210ms; }
  .rise-in-stagger > *:nth-child(5) { animation-delay: 280ms; }
  .rise-in-stagger > *:nth-child(6) { animation-delay: 350ms; }
  .rise-in-stagger > *:nth-child(7) { animation-delay: 420ms; }
  .rise-in-stagger > *:nth-child(8) { animation-delay: 490ms; }

  /* --- Captions ---------------------------------------------------------- */

  #demo-captions {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483000;
    font-family: var(--font-primary, ui-sans-serif, system-ui, sans-serif);
  }

  .demo-caption {
    position: absolute;
    left: 96px;
    width: ${STAGE.width - PANEL.width - PANEL.right - 200}px;
    color: #f8fafc;
  }

  .demo-caption .kicker {
    display: inline-block;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7dd3fc;
    margin-bottom: 14px;
    opacity: 0;
    transform: translateY(14px);
    animation: cap-in 620ms cubic-bezier(0.16, 1.2, 0.3, 1) 60ms both;
  }

  .demo-caption .headline {
    /* Headlines carry deliberate line breaks; textContent would otherwise let
       them collapse and re-wrap wherever the column happened to end. */
    white-space: pre-line;
    font-size: 54px;
    line-height: 1.06;
    font-weight: 760;
    letter-spacing: -0.022em;
    margin: 0;
    opacity: 0;
    transform: translateY(26px);
    animation: cap-in 760ms cubic-bezier(0.16, 1.2, 0.3, 1) 150ms both;
  }

  .demo-caption .sub {
    font-size: 24px;
    line-height: 1.45;
    font-weight: 420;
    color: #b5c3da;
    margin: 20px 0 0;
    opacity: 0;
    transform: translateY(20px);
    animation: cap-in 720ms cubic-bezier(0.16, 1.2, 0.3, 1) 300ms both;
  }

  .demo-caption .rule {
    height: 3px;
    width: 0;
    background: linear-gradient(90deg, #38bdf8, transparent);
    margin-top: 26px;
    animation: cap-rule 900ms cubic-bezier(0.16, 1, 0.3, 1) 420ms both;
  }

  .demo-caption[data-leaving='true'] > * {
    animation: cap-out 340ms cubic-bezier(0.5, 0, 0.75, 0) both;
  }

  @keyframes cap-in {
    to { opacity: 1; transform: none; }
  }
  @keyframes cap-out {
    to { opacity: 0; transform: translateY(-16px); }
  }
  @keyframes cap-rule {
    to { width: 190px; }
  }

  /* A ring drawn around the element under discussion. */
  .demo-spotlight {
    position: fixed;
    border-radius: 12px;
    border: 2px solid rgb(56 189 248 / 0.95);
    box-shadow:
      0 0 0 6px rgb(56 189 248 / 0.16),
      0 0 34px 4px rgb(56 189 248 / 0.35);
    pointer-events: none;
    z-index: 2147483200;
    animation: spotlight-in 520ms cubic-bezier(0.16, 1.25, 0.3, 1) both;
  }
  @keyframes spotlight-in {
    from { opacity: 0; transform: scale(1.12); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* --- The drawn cursor -------------------------------------------------- */

  #demo-cursor {
    position: fixed;
    top: 0; left: 0;
    z-index: 2147483647;
    width: 24px; height: 24px;
    margin: -12px 0 0 -12px;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.92);
    box-shadow: 0 0 0 2px rgb(15 23 42 / 0.8), 0 8px 22px rgb(0 0 0 / 0.45);
    pointer-events: none;
    transition: transform 130ms cubic-bezier(0.22, 1.2, 0.36, 1);
    will-change: transform;
  }
  #demo-cursor[data-down='true'] { transform: scale(0.7); }

  /* --- Title cards ------------------------------------------------------- */

  #demo-titlecard {
    position: fixed;
    inset: 0;
    z-index: 2147483500;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 180px;
    background:
      radial-gradient(1100px 700px at 30% 40%, rgb(23 33 56 / 0.98) 0%, rgb(10 16 28 / 0.99) 70%),
      linear-gradient(160deg, #0b1120 0%, #131c30 100%);
    font-family: var(--font-primary, ui-sans-serif, system-ui, sans-serif);
    color: #f8fafc;
  }
  #demo-titlecard[data-leaving='true'] { animation: card-out 620ms cubic-bezier(0.5, 0, 0.75, 0) both; }
  @keyframes card-out { to { opacity: 0; transform: scale(1.04); } }

  #demo-titlecard .index {
    font-size: 17px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    font-weight: 700;
    color: #7dd3fc;
    opacity: 0;
    transform: translateY(16px);
    animation: cap-in 640ms cubic-bezier(0.16, 1.2, 0.3, 1) 120ms both;
  }
  #demo-titlecard .title {
    font-size: 92px;
    line-height: 1.02;
    letter-spacing: -0.03em;
    font-weight: 780;
    margin: 26px 0 0;
    white-space: pre-line;
    opacity: 0;
    transform: translateY(34px);
    animation: cap-in 820ms cubic-bezier(0.16, 1.2, 0.3, 1) 240ms both;
  }
  #demo-titlecard .blurb {
    font-size: 27px;
    line-height: 1.45;
    color: #b5c3da;
    max-width: 1080px;
    margin: 30px 0 0;
    opacity: 0;
    transform: translateY(24px);
    animation: cap-in 780ms cubic-bezier(0.16, 1.2, 0.3, 1) 420ms both;
  }
  #demo-titlecard .bar {
    height: 4px;
    width: 0;
    margin-top: 44px;
    background: linear-gradient(90deg, #38bdf8, rgb(56 189 248 / 0));
    animation: cap-rule 1000ms cubic-bezier(0.16, 1, 0.3, 1) 560ms both;
  }

  .demo-ripple {
    position: fixed;
    z-index: 2147483646;
    width: 16px; height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: 9999px;
    border: 2px solid rgb(56 189 248 / 0.9);
    pointer-events: none;
    animation: demo-ripple 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes demo-ripple {
    from { opacity: 0.95; transform: scale(0.4); }
    to   { opacity: 0; transform: scale(6); }
  }
`;

/**
 * Install the cursor, the caption layer, and the helpers the script calls into.
 *
 * Everything is published on `window.__DEMO_STAGE__` so the film script can
 * drive captions and spotlights with one `page.evaluate` per beat.
 */
export function installStage() {
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  document.body.appendChild(cursor);

  const captions = document.createElement('div');
  captions.id = 'demo-captions';
  document.body.appendChild(captions);

  let x = -200;
  let y = -200;
  const place = () => {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };
  addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      place();
    },
    true,
  );
  addEventListener(
    'mousedown',
    () => {
      cursor.dataset.down = 'true';
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 800);
    },
    true,
  );
  addEventListener('mouseup', () => {
    cursor.dataset.down = 'false';
  }, true);
  place();

  const stage = {
    /**
     * Show a caption. Anchoring it to a selector aligns it vertically with that
     * element and draws a connector to it, so the words sit beside the thing
     * they are about rather than floating in the corner.
     */
    caption({ kicker, headline, sub, anchor }) {
      stage.clear();

      const el = document.createElement('div');
      el.className = 'demo-caption';

      let top = 380;
      let anchorBox = null;
      if (anchor) {
        const target = document.querySelector(anchor);
        if (target) {
          anchorBox = target.getBoundingClientRect();
          top = Math.min(Math.max(anchorBox.top + anchorBox.height / 2 - 120, 70), 760);
        }
      }
      el.style.top = `${top}px`;

      el.innerHTML =
        (kicker ? `<div class="kicker"></div>` : '') +
        `<h2 class="headline"></h2>` +
        (sub ? `<p class="sub"></p>` : '') +
        `<div class="rule"></div>`;
      if (kicker) el.querySelector('.kicker').textContent = kicker;
      el.querySelector('.headline').textContent = headline ?? '';
      if (sub) el.querySelector('.sub').textContent = sub;

      document.getElementById('demo-captions').appendChild(el);

      // A connector line from caption to element was tried and dropped: the
      // caption's own box is not laid out until after this frame, so the line
      // start was computed from a stale width and landed off-stage. Aligning the
      // caption to the element's vertical centre already reads as "about this",
      // and `spotlight()` below marks the element itself when a beat needs it.
    },

    /**
     * Ring an element the caption is talking about.
     *
     * Separate from `caption` because it needs the element to be on screen and
     * settled, which is a decision the choreography makes, not the caption.
     */
    spotlight(selector) {
      const target = document.querySelector(selector);
      if (!target) return false;
      const box = target.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      const ring = document.createElement('div');
      ring.className = 'demo-spotlight';
      ring.style.left = `${box.left - 6}px`;
      ring.style.top = `${box.top - 6}px`;
      ring.style.width = `${box.width + 12}px`;
      ring.style.height = `${box.height + 12}px`;
      document.getElementById('demo-captions').appendChild(ring);
      return true;
    },

    /** Full-frame title card, for the reel's scene breaks. */
    titleCard({ index, total, title, blurb }) {
      const el = document.createElement('div');
      el.id = 'demo-titlecard';
      el.innerHTML =
        `<div class="index"></div><h1 class="title"></h1>` +
        (blurb ? `<p class="blurb"></p>` : '') +
        `<div class="bar"></div>`;
      el.querySelector('.index').textContent =
        index && total ? `Scene ${index} of ${total}` : 'Okta Unbound';
      el.querySelector('.title').textContent = title ?? '';
      if (blurb) el.querySelector('.blurb').textContent = blurb;
      document.body.appendChild(el);
    },

    /** Animate the title card away, revealing the staged panel behind it. */
    dropTitleCard() {
      const el = document.getElementById('demo-titlecard');
      if (!el) return;
      el.dataset.leaving = 'true';
      setTimeout(() => el.remove(), 640);
    },

    /** Animate the current caption out and remove it. */
    clear() {
      const layer = document.getElementById('demo-captions');
      for (const node of [...layer.children]) {
        if (node.classList.contains('demo-caption')) {
          node.dataset.leaving = 'true';
          setTimeout(() => node.remove(), 360);
        } else {
          node.remove();
        }
      }
    },
  };

  window.__DEMO_STAGE__ = stage;
}
