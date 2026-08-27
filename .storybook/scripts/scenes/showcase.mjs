/**
 * Camera equipment: the 16:9 stage, the amplified motion layer, the drawn
 * cursor, and the margin. Injected at film time; none of it ships.
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
 * space used for the margin. A bare 900px-wide portrait recording is not a
 * shareable video.
 *
 * ## The margin is the record, and it never empties
 *
 * The left column is not a poster beside the panel. It is the admin's working
 * margin: the claim the scene is making, the evidence the panel produces, and
 * the proof line that settles it. Three bands on one grid, all hanging off a
 * single rail at x=96 — which is also what fixes the drift the first cut had,
 * where each caption computed its own `top` from whatever element it was
 * anchored to and every beat landed on a different baseline.
 *
 * The middle band is a *stack of blocks*, and a block can be any register the
 * scene's argument needs: evidence lines, a counting tally, a set diff, a
 * typed trace. That is what keeps a fixed grid from reading as a fixed
 * template.
 *
 * Nothing in the margin exits mid-scene. Blocks are replaced in place or they
 * accrete; the only exit in the reel is the chapter wipe between scenes. The
 * first cut called `clearCaption()` at the end of most beats and kept filming,
 * so 45% of the frame sat empty for seconds at a time.
 *
 * ## Palette
 *
 * Every value is derived from `src/sidepanel/tailwind.css`, none invented. The
 * first cut accented on `#7dd3fc` / `#38bdf8` — Tailwind's `sky`, a palette
 * this repo does not own — so the furniture was cyan around an indigo product.
 * `signal` below is `--color-primary` lifted for legibility on ink at the same
 * hue, and `paper` is `--color-canvas` verbatim, so the display type is cut
 * from the same stock as the panel's own canvas.
 */

/** The finished frame. 16:9, the shape every player and slide deck expects. */
export const STAGE = { width: 1920, height: 1080 };

/** The panel inside the frame — wide enough to look like real daily use. */
export const PANEL = { width: 900, height: 980, right: 72 };

/** The rail every margin element hangs off. */
export const RAIL_X = 96;

/** Stage framing, amplified motion, cursor, and the margin's registers. */
export const SHOWCASE_CSS = `
  :root {
    --ink: #12152b;
    --ink-raised: #1c2140;
    --signal: #8b9dff;
    --paper: #f4f4f4;
    --quiet: #9aa2bd;
    --affirm: #45c27e;
    --alarm: #ff7a5e;

    --reel-display: var(--font-primary, 'Inter', ui-sans-serif, system-ui, sans-serif);
    --reel-mono: var(--font-mono, 'Roboto Mono', ui-monospace, monospace);
  }

  html, body {
    width: ${STAGE.width}px;
    height: ${STAGE.height}px;
    overflow: hidden !important;
    /* Flat, not a two-blob gradient. The white panel is the only bright object
       in frame, and it should stay that way. */
    background: var(--ink);
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
    transition:
      opacity 620ms cubic-bezier(0.22, 1.1, 0.36, 1),
      filter 620ms cubic-bezier(0.22, 1.1, 0.36, 1),
      transform 620ms cubic-bezier(0.22, 1.1, 0.36, 1);
  }

  /* Behind a chapter. Dimmed rather than covered, but dimmed far enough that a
     tab-load spinner cannot be read — which is the job the first cut's opaque
     full-frame title card was actually doing. */
  #storybook-root[data-recede='true'] {
    opacity: 0.08;
    filter: blur(3px);
    transform: translateZ(0) scale(0.965);
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

  /* --- The rail: the one continuous motion in the frame ------------------ */

  #demo-rail {
    position: fixed;
    left: ${RAIL_X}px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--ink-raised);
    z-index: 2147483000;
    pointer-events: none;
  }
  #demo-rail-fill {
    width: 100%;
    height: 0;
    background: var(--signal);
    /* Beat-to-beat, so it wants the reel's slowest curve rather than a snap. */
    transition: height 900ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* --- The margin -------------------------------------------------------- */

  #demo-margin {
    position: fixed;
    left: ${RAIL_X + 32}px;
    top: 150px;
    bottom: 150px;
    width: ${STAGE.width - PANEL.width - PANEL.right - RAIL_X - 120}px;
    z-index: 2147483000;
    pointer-events: none;
    display: grid;
    /* Claim / body / proof. The rows are reserved whether or not they are
       filled, so a proof line landing late does not reflow the evidence above
       it — on camera a reflow reads as a mistake. */
    grid-template-rows: auto 1fr auto;
    gap: 44px;
    font-family: var(--reel-display);
    color: var(--paper);
    transition: opacity 520ms cubic-bezier(0.22, 1.1, 0.36, 1);
  }

  /* Scroll and resize beats: the panel carries the frame alone for a moment. */
  #demo-margin[data-strip='true'] #demo-body,
  #demo-margin[data-strip='true'] #demo-proof { opacity: 0.28; }
  #demo-body, #demo-proof { transition: opacity 520ms cubic-bezier(0.22, 1.1, 0.36, 1); }

  /* One entrance device for the whole margin: a mask reveal off the rail.
     Fade-plus-translate is the default everything else reaches for. */
  @keyframes margin-in {
    from { clip-path: inset(0 0 100% 0); transform: translateY(10px); }
    to   { clip-path: inset(0 0 0 0); transform: none; }
  }
  .m-in { animation: margin-in 620ms cubic-bezier(0.16, 1, 0.3, 1) both; }

  .m-label {
    font-family: var(--reel-mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--signal);
    margin-bottom: 18px;
  }

  #demo-claim .m-claim {
    /* Claims carry deliberate line breaks; textContent would otherwise let them
       collapse and re-wrap wherever the column happened to end. */
    white-space: pre-line;
    font-size: 56px;
    line-height: 1.04;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0;
  }

  #demo-body {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 30px;
    min-height: 0;
  }

  #demo-proof .m-proof {
    font-size: 30px;
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.012em;
    margin: 0;
    color: var(--paper);
  }
  #demo-proof .m-proof-note {
    font-size: 21px;
    line-height: 1.45;
    font-weight: 420;
    color: var(--quiet);
    margin: 12px 0 0;
  }

  /* --- Register: evidence ------------------------------------------------ */

  .m-evidence {
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-left: 2px solid var(--ink-raised);
    padding-left: 22px;
  }
  .m-ev {
    font-family: var(--reel-mono);
    font-size: 19px;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1.4;
    color: rgb(244 244 244 / 0.85);
  }

  /* --- Register: tally --------------------------------------------------- */

  .m-tally { display: flex; align-items: baseline; gap: 26px; }
  .m-tally-num {
    /* Tabular is load-bearing: without it a counting number changes width every
       frame and the whole block jitters. */
    font-variant-numeric: tabular-nums;
    font-size: 128px;
    line-height: 0.9;
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  .m-tally-delta {
    font-variant-numeric: tabular-nums;
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .m-tally-delta[data-tone='alarm'] { color: var(--alarm); }
  .m-tally-delta[data-tone='affirm'] { color: var(--affirm); }
  .m-tally-delta[data-tone='signal'] { color: var(--signal); }
  .m-tally-label {
    font-family: var(--reel-mono);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--quiet);
    margin-top: 14px;
  }

  /* --- Register: diff ---------------------------------------------------- */

  /* Two dot columns wide enough to caption. At 34px the two names ran together
     into one unreadable word in the header. */
  .m-diff { display: flex; flex-direction: column; gap: 12px; }
  .m-diff-head {
    display: grid;
    grid-template-columns: 68px 68px 1fr;
    gap: 16px;
    font-family: var(--reel-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--quiet);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--ink-raised);
  }
  .m-diff-head > div { text-align: center; }
  .m-diff-row {
    display: grid;
    grid-template-columns: 68px 68px 1fr;
    gap: 16px;
    align-items: center;
    font-family: var(--reel-mono);
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--paper);
  }
  /* Shrink the name to its text. As a plain grid cell it filled the 1fr track,
     so the strike-through below ran on for the width of the whole column. */
  .m-diff-name { justify-self: start; }
  .m-dot {
    width: 11px; height: 11px;
    border-radius: 9999px;
    border: 2px solid var(--quiet);
    justify-self: center;
  }
  .m-dot[data-on='true'] { background: var(--signal); border-color: var(--signal); }
  /* Shared items are struck as they are found: the diff is the argument, so the
     things both people have should visibly drop out of it. */
  .m-diff-row[data-state='shared'] { color: var(--quiet); }
  .m-diff-row[data-state='shared'] .m-diff-name {
    background-image: linear-gradient(var(--quiet), var(--quiet));
    background-repeat: no-repeat;
    background-position: 0 55%;
    background-size: 0% 1px;
    animation: strike 520ms cubic-bezier(0.22, 1, 0.36, 1) 180ms forwards;
  }
  .m-diff-row[data-state='cause'] { color: var(--signal); }
  @keyframes strike { to { background-size: 100% 1px; } }

  /* --- Register: trace --------------------------------------------------- */

  .m-trace {
    display: flex;
    flex-direction: column;
    gap: 9px;
    background: var(--ink-raised);
    border-radius: 10px;
    padding: 20px 22px;
  }
  .m-trace-line {
    font-family: var(--reel-mono);
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgb(244 244 244 / 0.82);
    white-space: pre;
  }
  .m-trace-line[data-tone='affirm'] { color: var(--affirm); }
  .m-trace-line[data-tone='signal'] { color: var(--signal); }

  /* --- Register: callout ------------------------------------------------- */

  #demo-overlays {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483200;
    font-family: var(--reel-display);
  }
  .m-callout {
    position: absolute;
    left: ${RAIL_X + 32}px;
    width: ${STAGE.width - PANEL.width - PANEL.right - RAIL_X - 120}px;
    font-size: 40px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: var(--paper);
    white-space: pre-line;
  }

  /* A ring drawn around the element under discussion. */
  .demo-spotlight {
    position: fixed;
    border-radius: 12px;
    border: 2px solid var(--signal);
    box-shadow:
      0 0 0 6px rgb(139 157 255 / 0.16),
      0 0 34px 4px rgb(139 157 255 / 0.3);
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
    box-shadow: 0 0 0 2px rgb(18 21 43 / 0.8), 0 8px 22px rgb(0 0 0 / 0.45);
    pointer-events: none;
    transition:
      transform 130ms cubic-bezier(0.22, 1.2, 0.36, 1),
      opacity 380ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }
  #demo-cursor[data-down='true'] { transform: scale(0.7); }
  /* A pointer parked in the middle of the margin is a white dot floating in
     empty space, and the runner parks it off the panel before every scene. It
     fades out whenever it stops moving and comes straight back when it does. */
  #demo-cursor[data-idle='true'] { opacity: 0; }

  .demo-ripple {
    position: fixed;
    z-index: 2147483646;
    width: 16px; height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: 9999px;
    border: 2px solid var(--signal);
    pointer-events: none;
    animation: demo-ripple 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes demo-ripple {
    from { opacity: 0.95; transform: scale(0.4); }
    to   { opacity: 0; transform: scale(6); }
  }

  /* --- Chapter: the margin at full frame --------------------------------- */

  /* Deliberately the same object as the margin, scaled up, rather than a second
     caption system. The first cut ran a full-bleed title card whose anatomy
     (kicker / headline / sub / gradient rule) duplicated the caption's exactly,
     so the reel had two ways of saying the same thing and no change of register
     between them. */
  #demo-chapter {
    position: fixed;
    inset: 0;
    z-index: 2147483500;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: ${RAIL_X + 32}px;
    padding-right: 200px;
    background: var(--ink);
    font-family: var(--reel-display);
    color: var(--paper);
    pointer-events: none;
  }
  #demo-chapter[data-leaving='true'] { animation: chapter-out 620ms cubic-bezier(0.5, 0, 0.75, 0) both; }
  @keyframes chapter-out { to { opacity: 0; } }

  #demo-chapter .m-label { margin-bottom: 26px; }
  #demo-chapter .c-title {
    font-size: 84px;
    line-height: 1.02;
    letter-spacing: -0.032em;
    font-weight: 800;
    margin: 0;
    max-width: 1180px;
    white-space: pre-line;
  }
  #demo-chapter .c-blurb {
    font-size: 26px;
    line-height: 1.45;
    font-weight: 420;
    color: var(--quiet);
    max-width: 980px;
    margin: 32px 0 0;
  }
`;

/**
 * Install the cursor, the rail, the margin, and the helpers the script calls
 * into.
 *
 * Everything is published on `window.__DEMO_STAGE__` so the film script can
 * drive a register with one `page.evaluate` per movement.
 *
 * **This function must stay closure-free.** `film-scenes.mjs` serializes it with
 * `toString()` and injects it as an init script, which is what keeps this file
 * the single source of truth rather than forcing a second, drifting copy inline
 * there. It may touch only `document`, `window`, `addEventListener`,
 * `setTimeout`, `requestAnimationFrame` and `performance`.
 */
export function installStage() {
  const make = (tag, cls, parent) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  };

  const rail = make('div', null, document.body);
  rail.id = 'demo-rail';
  const railFill = make('div', null, rail);
  railFill.id = 'demo-rail-fill';

  const margin = make('div', null, document.body);
  margin.id = 'demo-margin';
  const claimBand = make('div', null, margin);
  claimBand.id = 'demo-claim';
  const bodyBand = make('div', null, margin);
  bodyBand.id = 'demo-body';
  const proofBand = make('div', null, margin);
  proofBand.id = 'demo-proof';

  const overlays = make('div', null, document.body);
  overlays.id = 'demo-overlays';

  const cursor = make('div', null, document.body);
  cursor.id = 'demo-cursor';

  let x = -200;
  let y = -200;
  let idleTimer = 0;
  cursor.dataset.idle = 'true';
  const place = () => {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };
  const wake = () => {
    cursor.dataset.idle = 'false';
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      cursor.dataset.idle = 'true';
    }, 1100);
  };
  addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      place();
      wake();
    },
    true,
  );
  addEventListener(
    'mousedown',
    () => {
      cursor.dataset.down = 'true';
      wake();
      const ripple = make('div', 'demo-ripple', document.body);
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      setTimeout(() => ripple.remove(), 800);
    },
    true,
  );
  addEventListener(
    'mouseup',
    () => {
      cursor.dataset.down = 'false';
    },
    true,
  );
  place();

  const stage = {
    /** Fraction of the current scene's beats that have started, 0 to 1. */
    progress(fraction) {
      const clamped = Math.max(0, Math.min(1, Number(fraction) || 0));
      document.getElementById('demo-rail-fill').style.height = `${clamped * 100}%`;
    },

    /**
     * Set the margin's claim. Replaces in place — the margin never blanks
     * between beats, which is the whole point of the band being reserved.
     */
    claim({ label, text }) {
      const band = document.getElementById('demo-claim');
      band.textContent = '';
      const wrap = make('div', 'm-in', band);
      if (label) {
        const l = make('div', 'm-label', wrap);
        l.textContent = label;
      }
      const h = make('h2', 'm-claim', wrap);
      h.textContent = text ?? '';
    },

    /**
     * Land the proof line: the one literal fact that settles the claim.
     *
     * Never a restatement of the claim. If it reads as a rephrase, the claim was
     * doing the proof's job and one of them is redundant.
     */
    proof({ text, note }) {
      const band = document.getElementById('demo-proof');
      band.textContent = '';
      const wrap = make('div', 'm-in', band);
      const p = make('p', 'm-proof', wrap);
      p.textContent = text ?? '';
      if (note) {
        const n = make('p', 'm-proof-note', wrap);
        n.textContent = note;
      }
    },

    /** Empty the middle band. Blocks accrete into it until a register changes. */
    clearBody() {
      document.getElementById('demo-body').textContent = '';
    },

    /**
     * Open an evidence block. Lines are appended with `evidence()` as the panel
     * produces them, so the stack accretes rather than flashing whole.
     */
    evidenceBlock() {
      const block = make('div', 'm-evidence m-in', document.getElementById('demo-body'));
      block.dataset.role = 'evidence';
    },

    /** Append one evidence line: a literal artifact, quoted, never prose. */
    evidence(text) {
      const blocks = document.querySelectorAll('[data-role="evidence"]');
      const block = blocks[blocks.length - 1];
      if (!block) return false;
      const line = make('div', 'm-ev m-in', block);
      line.textContent = text;
      return true;
    },

    /**
     * A counting tally. `from`/`to` animate; the delta is coloured only when it
     * is a real consequence, never for emphasis.
     */
    tally({ from, to, label, delta, tone, suffix }) {
      const block = make('div', 'm-in', document.getElementById('demo-body'));
      const row = make('div', 'm-tally', block);
      const num = make('div', 'm-tally-num', row);
      num.textContent = String(from ?? 0);
      if (delta) {
        const d = make('div', 'm-tally-delta', row);
        d.dataset.tone = tone ?? 'signal';
        d.textContent = delta;
      }
      if (label) {
        const l = make('div', 'm-tally-label', block);
        l.textContent = label;
      }

      const start = performance.now();
      const a = Number(from ?? 0);
      const b = Number(to ?? 0);
      const ms = 1400;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = 1 - (1 - t) ** 3;
        num.textContent = `${Math.round(a + (b - a) * eased)}${suffix ?? ''}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },

    /** Retarget the most recent tally's number without rebuilding the block. */
    tallyTo(value, suffix) {
      const nums = document.querySelectorAll('.m-tally-num');
      const num = nums[nums.length - 1];
      if (!num) return false;
      num.textContent = `${value}${suffix ?? ''}`;
      return true;
    },

    /** Open a two-person set diff. Rows land one at a time via `diffRow()`. */
    diffBlock({ a, b }) {
      const block = make('div', 'm-diff m-in', document.getElementById('demo-body'));
      block.dataset.role = 'diff';
      const head = make('div', 'm-diff-head', block);
      const ha = make('div', null, head);
      ha.textContent = a ?? 'A';
      const hb = make('div', null, head);
      hb.textContent = b ?? 'B';
      make('div', null, head);
    },

    /**
     * One row of the diff. `state` is derived, not decorative: `shared` strikes
     * through (both have it, so it cannot explain the difference), `only` holds,
     * `cause` is the attribute that explains the rest.
     */
    diffRow({ name, a, b, state }) {
      const blocks = document.querySelectorAll('[data-role="diff"]');
      const block = blocks[blocks.length - 1];
      if (!block) return false;
      const row = make('div', 'm-diff-row m-in', block);
      row.dataset.state = state ?? 'only';
      const da = make('div', 'm-dot', row);
      da.dataset.on = a ? 'true' : 'false';
      const db = make('div', 'm-dot', row);
      db.dataset.on = b ? 'true' : 'false';
      const label = make('div', 'm-diff-name', row);
      label.textContent = name;
      return true;
    },

    /** Open a trace block: the scheduler and audit lines, typed in one by one. */
    traceBlock() {
      const block = make('div', 'm-trace m-in', document.getElementById('demo-body'));
      block.dataset.role = 'trace';
    },

    /** Append one trace line. */
    trace(text, tone) {
      const blocks = document.querySelectorAll('[data-role="trace"]');
      const block = blocks[blocks.length - 1];
      if (!block) return false;
      const line = make('div', 'm-trace-line m-in', block);
      if (tone) line.dataset.tone = tone;
      line.textContent = text;
      return true;
    },

    /** Dim the margin's body so the panel carries a scroll or resize beat alone. */
    strip(on) {
      document.getElementById('demo-margin').dataset.strip = on ? 'true' : 'false';
    },

    /**
     * A short line pinned to the vertical centre of an element, for "look at
     * this". Cleared by the next `callout()` or by `clearOverlays()`.
     */
    callout(text, selector) {
      stage.clearOverlays();
      const layer = document.getElementById('demo-overlays');
      const node = make('div', 'm-callout m-in', layer);
      node.textContent = text;
      let top = 420;
      if (selector) {
        const target = document.querySelector(selector);
        if (target) {
          const box = target.getBoundingClientRect();
          top = Math.min(Math.max(box.top + box.height / 2 - 40, 90), 900);
        }
      }
      node.style.top = `${top}px`;
    },

    /**
     * Ring an element the margin is talking about.
     *
     * Separate from the registers because it needs the element to be on screen
     * and settled, which is a decision the choreography makes.
     */
    spotlight(selector) {
      const target = document.querySelector(selector);
      if (!target) return false;
      const box = target.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      const ring = make('div', 'demo-spotlight', document.getElementById('demo-overlays'));
      ring.style.left = `${box.left - 6}px`;
      ring.style.top = `${box.top - 6}px`;
      ring.style.width = `${box.width + 12}px`;
      ring.style.height = `${box.height + 12}px`;
      return true;
    },

    /** Drop spotlights and callouts. Does not touch the margin. */
    clearOverlays() {
      document.getElementById('demo-overlays').textContent = '';
    },

    /** Wipe the whole margin. Scene boundaries only — never between beats. */
    resetMargin() {
      document.getElementById('demo-claim').textContent = '';
      document.getElementById('demo-body').textContent = '';
      document.getElementById('demo-proof').textContent = '';
      document.getElementById('demo-margin').dataset.strip = 'false';
      stage.clearOverlays();
      stage.progress(0);
    },

    /** The margin at full frame, with the panel receding behind it. */
    chapter({ label, title, blurb }) {
      const root = document.getElementById('storybook-root');
      if (root) root.dataset.recede = 'true';
      const existing = document.getElementById('demo-chapter');
      if (existing) existing.remove();
      const el = make('div', null, document.body);
      el.id = 'demo-chapter';
      if (label) {
        const l = make('div', 'm-label m-in', el);
        l.textContent = label;
      }
      const h = make('h1', 'c-title m-in', el);
      h.textContent = title ?? '';
      h.style.animationDelay = '110ms';
      if (blurb) {
        const p = make('p', 'c-blurb m-in', el);
        p.textContent = blurb;
        p.style.animationDelay = '240ms';
      }
    },

    /** Bring the panel back and take the chapter away. */
    dropChapter() {
      const root = document.getElementById('storybook-root');
      if (root) root.dataset.recede = 'false';
      const el = document.getElementById('demo-chapter');
      if (!el) return;
      el.dataset.leaving = 'true';
      setTimeout(() => el.remove(), 640);
    },
  };

  window.__DEMO_STAGE__ = stage;
}
