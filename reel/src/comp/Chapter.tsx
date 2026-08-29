/**
 * @module reel/comp/Chapter
 * @description One chapter: one tab, one or more acts, and the argument beside them.
 *
 * A chapter is a `<Series>` of acts and an act is one capture (ADR-0053). A
 * chapter that carries three scenarios is three clips, so a walk change
 * re-films the twenty seconds it touched rather than the whole chapter, and a
 * beat that misses ends its act rather than the argument either side of it. A
 * one-act chapter is the degenerate case and needs no special handling.
 *
 * The whole assembly is derived from two inputs — the capture's manifest and
 * the chapter's entry in `script.ts` — and nothing here holds state. Change the
 * script and the chapter re-renders; the footage is untouched, which is the
 * entire point of splitting capture from composition.
 *
 * Marks are cued to *beats*, never to frame numbers. A beat's position moves
 * whenever its speed changes, so a caption pinned to a frame would silently
 * drift off its subject the first time anyone retimed the chapter. Pinning to
 * the beat means the caption follows.
 */
import React, { useMemo } from 'react';
import { AbsoluteFill, Series, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { capture, clip, type Manifest } from '../captures';
import { buildRamp } from '../ramp';
import {
  STAGES,
  WORKING_STAGE,
  FULL_CROP,
  fitCrop,
  PANEL_RECT,
  type Crop,
  type Rect,
  type StageName,
} from '../layout';
import { SCRIPT, type Act, type Scene } from '../script';
import { Backdrop } from './Backdrop';
import { TAB_DEFS } from '../../../src/sidepanel/tabs';
import { FilmIndex } from './FilmIndex';
import { Cursor } from './Cursor';
import { Margin, type Line } from './Margin';
import { Panel } from './Panel';
import { FRAME, INTER, STAGE } from '../theme';

/**
 * Frames a stage change takes.
 *
 * Shorter than it was, because the panel no longer travels: a fade needs less
 * time to be legible than a 976px slide did, and every frame of the change is a
 * frame where the outgoing thing has gone and the incoming one has not arrived.
 */
const MOVE_FRAMES = 20;

/** Frames one diagram takes to replace another. */
const DIAGRAM_SWAP_FRAMES = 16;

/** Frames the margin takes to get out of the way of a moving panel. */
const MARGIN_CLEAR_FRAMES = 6;

/** Frames it takes to come back once the panel has settled. */
const MARGIN_SET_FRAMES = 8;

/** A resolved mark: the same data, with its frame worked out. */
interface Cue {
  from: number;
  stage: StageName;
  crop: Crop;
  /** Did this mark move the camera? A diagram's lifetime ends at the next one that did. */
  movesCamera: boolean;
  lines: { register: Line['register']; text: string }[];
  diagram?: (manifest: Manifest, plot: Rect, from: number) => React.ReactNode;
}

/** How long each act runs, in order. The chapter's own layout, and the band's. */
export function actLengths(scene: Scene): number[] {
  return scene.acts.map(
    (act) => buildRamp(capture(act.capture), act.plan, FRAME.fps).durationInFrames,
  );
}

/** How long a whole chapter runs. Needed before rendering to lay out the series. */
export function chapterLength(scene: Scene): number {
  return actLengths(scene).reduce((total, length) => total + length, 0);
}

/**
 * Which tab a chapter films, as an index into `TAB_DEFS`.
 *
 * The registry is the source, not a transcription, so a renamed or reordered
 * tab cannot silently desync the film's index from the product's navigation.
 *
 * **And every act in a chapter has to film the same tab.** That is the one
 * invariant acts exist to hold: a chapter is a tab, visited once, and a second
 * act shot somewhere else would put the film's rail back where the restructure
 * took it from - moving backwards inside a chapter, with the band still naming
 * the tab it left. Checked here rather than trusted, because the tab is a
 * property of the footage and nothing in the script states it.
 */
export function chapterTab(scene: Scene): number {
  const tabs = scene.acts.map((act) => capture(act.capture).tab);
  const [tab] = tabs;
  const stray = scene.acts.find((act, i) => tabs[i] !== tab);
  if (stray) {
    throw new Error(
      `Chapter "${scene.id}" films tab "${tab}" but its act "${stray.capture}" films ` +
        `"${capture(stray.capture).tab}". A chapter is one tab (ADR-0053).`,
    );
  }
  const index = TAB_DEFS.findIndex((t) => t.id === tab);
  if (index < 0) {
    throw new Error(`Chapter "${scene.id}" films tab "${tab}", which is not in TAB_DEFS.`);
  }
  return index;
}

/** The act running at a frame within a chapter, and where it started. */
export function actAt(scene: Scene, frame: number): { act: Act; index: number; from: number } {
  const lengths = actLengths(scene);
  let from = 0;
  for (const [index, length] of lengths.entries()) {
    if (frame < from + length || index === lengths.length - 1) {
      return { act: scene.acts[index]!, index, from };
    }
    from += length;
  }
  /* istanbul ignore next - unreachable: acts is non-empty and the loop returns on the last. */
  throw new Error(`Chapter "${scene.id}" has no acts.`);
}

/** Look a chapter up, or fail naming what the film does have. */
function sceneById(id: string): Scene {
  const scene = SCRIPT.find((s) => s.id === id);
  if (!scene) {
    throw new Error(`No chapter "${id}" in SCRIPT. Known: ${SCRIPT.map((s) => s.id).join(', ')}`);
  }
  return scene;
}

type ActProps = {
  /** The chapter this act belongs to. Resolved from `SCRIPT`, never passed. */
  chapter: string;
  /** Which act, by position. */
  index: number;
};

/**
 * One act: one clip, retimed, with its own margin and its own camera.
 *
 * The margin accumulates *within* an act and starts clean at the next one.
 * That is deliberate rather than a limit of the sequencing: bands stack, and a
 * three-act chapter that never cleared would be arguing its third scenario
 * underneath six lines about the first two. An act is a scenario, and a
 * scenario's evidence belongs to it.
 */
const ActFilm: React.FC<ActProps> = ({ chapter, index }) => {
  const scene = sceneById(chapter);
  const act = scene.acts[index];
  if (!act) {
    throw new Error(`Chapter "${chapter}" has no act ${index}; it has ${scene.acts.length}.`);
  }
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const manifest = capture(act.capture);

  if (manifest.panel.width !== 840 || manifest.panel.height !== 980) {
    throw new Error(
      `${act.capture}: captured at ${manifest.panel.width}x${manifest.panel.height}, ` +
        'but the composition lays out for 840x980.',
    );
  }

  const ramp = useMemo(() => buildRamp(manifest, act.plan, fps), [manifest, act.plan, fps]);

  /**
   * Marks resolved to frames, with the stage and crop carried forward.
   *
   * Carried rather than defaulted: a mark that says nothing about the camera
   * means "hold what we have", and a chapter reading as a series of unexplained
   * returns to a neutral stage was the first version's mistake.
   */
  // The whole capture, uncropped: the app's context bar and its own rail are
  // part of the product and stay on camera. See `PANEL_RECT` in the layout.
  const bare = FULL_CROP;

  const cues = useMemo<Cue[]>(() => {
    let stage: StageName = WORKING_STAGE;
    let crop = bare;
    return act.marks.map((mark) => {
      const cue = ramp.cues[mark.beat];
      if (!cue) {
        throw new Error(
          `${act.capture}: mark on beat "${mark.beat}", which the plan does not include. ` +
            `Planned: ${act.plan.map((p) => p.beat).join(', ')}`,
        );
      }
      const wasStage = stage;
      const wasCrop = crop;
      if (mark.stage) stage = mark.stage;
      crop = mark.crop ? fitCrop(mark.crop, PANEL_RECT) : bare;
      // A mark cued to a figure lands where the panel was showing it. Resolved
      // here so an unknown key fails the render rather than silently cueing at
      // the beat's own start, which is the drift this exists to stop.
      let base = cue.from;
      if (mark.after !== undefined) {
        const read = manifest.figures[mark.after];
        if (!read) {
          throw new Error(
            `${act.capture}: mark cued after figure "${mark.after}", which was never read. ` +
              `Read: ${Object.keys(manifest.figures).join(', ') || '(none)'}`,
          );
        }
        base = ramp.frameAtClipMs(read.at);
      }
      return {
        from: base + (mark.offset ?? 0),
        stage,
        crop,
        // Whether the camera *moved*, not whether the mark mentioned it. A mark
        // that names the stage it is already on is a no-op, and counting it as
        // a move would end the diagram beside it for nothing — which is what
        // happened the moment every chapter started by naming its home stage.
        movesCamera: stage !== wasStage || crop !== wasCrop,
        lines: (mark.lines ?? []).map((line) => ({
          register: line.register,
          text: typeof line.text === 'function' ? line.text(manifest) : line.text,
        })),
        diagram: mark.diagram,
      };
    });
  }, [act, bare, manifest, ramp]);

  // The active cue is the last one that has arrived, and the camera eases from
  // the one before it. Two cues, one interpolation: no state, no accumulation.
  const activeIndex = Math.max(
    0,
    cues.reduce((found, cue, i) => (frame >= cue.from ? i : found), 0),
  );
  const active: Cue = cues[activeIndex] ?? {
    from: 0,
    stage: WORKING_STAGE,
    crop: bare,
    movesCamera: false,
    lines: [],
  };
  const previous = cues[activeIndex - 1] ?? active;
  const move = interpolate(frame - active.from, [0, MOVE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Eased, because a linear camera move looks mechanical at 60fps in a way a
  // linear anything else does not.
  const eased = move < 0.5 ? 4 * move ** 3 : 1 - (-2 * move + 2) ** 3 / 2;
  const panel = PANEL_RECT;
  /**
   * The panel fades and settles rather than travelling. See `Stage.showsPanel`.
   *
   * `reveal` covers the chapter's own opening; this covers a showcase taking
   * the frame mid-chapter. They multiply, so a chapter that opens on a showcase
   * would do both, and neither has to know about the other.
   */
  const here = STAGES[active.stage].showsPanel ? 1 : 0;
  const was = STAGES[previous.stage].showsPanel ? 1 : 0;
  const panelOn = was + (here - was) * eased;
  const crop = {
    x: previous.crop.x + (active.crop.x - previous.crop.x) * eased,
    y: previous.crop.y + (active.crop.y - previous.crop.y) * eased,
    width: previous.crop.width + (active.crop.width - previous.crop.width) * eased,
    height: previous.crop.height + (active.crop.height - previous.crop.height) * eased,
  };

  /**
   * The margin clears and re-sets; it does not travel.
   *
   * Interpolating the box was the obvious repair and it is the wrong one. Two
   * stages put the copy on opposite sides of the frame, and so does the panel,
   * so a margin that slides right crosses a panel sliding left and the copy
   * spends a third of the move printed across the product. Re-wrapping 1180px
   * of copy into 872px a frame at a time does not help either.
   *
   * So the block goes out, the box changes while nothing is on screen, and it
   * comes back in its new place. Same rule the diagrams follow: one slot, and
   * the handover happens at zero.
   *
   * **The gap covers the whole move, not its middle.** A first attempt dipped
   * the opacity on a curve keyed to the move's own progress, which put the
   * margin back at a fifth of its strength while the panel was still four
   * fifths of the way across it: the copy printed over the product for a dozen
   * frames at both ends of every swap. The two only stop overlapping once the
   * panel has actually arrived, so that is when the copy comes back.
   */
  const moving = previous.stage !== active.stage;
  const age = frame - active.from;
  const marginOpacity = !moving
    ? 1
    : Math.max(
        interpolate(age, [0, MARGIN_CLEAR_FRAMES], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        interpolate(age, [MOVE_FRAMES - 8, MOVE_FRAMES + MARGIN_SET_FRAMES], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      );
  // Switched once the copy is off screen, never while it can be seen.
  const marginBox =
    STAGES[!moving || age >= MARGIN_CLEAR_FRAMES ? active.stage : previous.stage].margin;

  /** Every line that has arrived, in order. Bands accumulate; they never replace. */
  const lines: Line[] = cues
    .filter((cue) => frame >= cue.from)
    .flatMap((cue) => cue.lines.map((line) => ({ ...line, from: cue.from })));

  /**
   * The live diagram, plus whichever one it is still fading over.
   *
   * **A diagram is drawn into the stage that was current when it was cued, and
   * it ends at the next cue that either draws its own diagram or moves the
   * camera.** All three parts are load-bearing, and the last two were each
   * learned from a bad frame:
   *
   *  - *Ends when the camera moves*, or the reporting chapter's coverage chart
   *    stays pinned to the plot it was drawn into after the panel returns to
   *    its working stage, and paints across both the panel and the margin.
   *  - *Ends when another diagram arrives*, or the attributes chapter draws its
   *    composition funnel straight over the attribute spread it supersedes. The
   *    two share a stage, so nothing moved, so nothing ended it - the plot is
   *    one slot and the newest occupant takes it.
   *
   * The fade-out **completes** on the ending cue rather than starting there,
   * and that one choice covers both endings without a special case. A successor
   * cues at exactly the frame its predecessor's lifetime ends, so the outgoing
   * plot is already gone when the incoming one starts to arrive: a handover
   * with neither a hole nor a moment of two charts stacked in one slot. And a
   * plot ended by a camera move has cleared the frame before the panel starts
   * travelling through where it was.
   *
   * Margin bands are the opposite and stay: a claim that leaves takes its
   * evidence's subject with it.
   */
  const drawn = (() => {
    const live: { cue: Cue; opacity: number }[] = [];
    for (const [i, cue] of cues.entries()) {
      if (!cue.diagram) continue;
      // A plot cued by a stage change waits for most of it, so it is not
      // arriving on top of a panel that is still fading out of the same column.
      // Not all of it: the frames where nothing at all is on screen are the
      // ones that read as a fault rather than as a transition.
      const arrives = cue.from + (cue.movesCamera ? MOVE_FRAMES - 8 : 0);
      if (frame < arrives) continue;
      const ends =
        cues.slice(i + 1).find((later) => later.diagram || later.movesCamera)?.from ?? Infinity;
      // Never let the two windows cross on a beat shorter than the fade.
      const leaves = Math.max(ends - DIAGRAM_SWAP_FRAMES, arrives);
      const opacity =
        interpolate(frame - arrives, [0, DIAGRAM_SWAP_FRAMES], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) *
        interpolate(frame - leaves, [0, DIAGRAM_SWAP_FRAMES], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      if (opacity > 0) live.push({ cue, opacity });
    }
    return live;
  })();

  const reveal = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The pool of light follows whatever is lit. The panel's box no longer moves,
  // so this tracks its *presence*: once it has faded out the light would
  // otherwise go on pooling under an empty column.
  const panelCentre = panel.x + panel.width / 2;
  const { plot } = STAGES[active.stage];
  const focusX = panelCentre + (plot.x + plot.width / 2 - panelCentre) * (1 - panelOn);

  return (
    <AbsoluteFill style={{ fontFamily: INTER, color: STAGE.ink }}>
      <Backdrop focusX={focusX} />

      <Panel
        src={clip(act.capture)}
        ramp={ramp}
        pose={panel}
        crop={crop}
        reveal={reveal * panelOn}
      />
      {panelOn > 0.02 && (
        <div style={{ opacity: panelOn }}>
          <Cursor
            pointer={manifest.pointer}
            clipMs={ramp.clipMsAt(frame)}
            pose={panel}
            crop={crop}
          />
        </div>
      )}

      {lines.length > 0 && (
        <div style={{ opacity: marginOpacity }}>
          <Margin lines={lines} box={marginBox} />
        </div>
      )}

      {drawn.map((entry) => (
        <div key={`diagram-${entry.cue.from}`} style={{ opacity: entry.opacity }}>
          {entry.cue.diagram?.(manifest, STAGES[entry.cue.stage].plot, entry.cue.from)}
        </div>
      ))}
    </AbsoluteFill>
  );
};

type ChapterProps = {
  id: string;
  /**
   * Draw the rail.
   *
   * `Reel` sets this false and draws one continuous rail of its own across
   * every chapter, which is the only way the highlight can slide *between*
   * them. A chapter rendered on its own draws a static one, so the per-chapter
   * compositions still look like the film.
   */
  rail?: boolean;
};

/**
 * A chapter is addressed by id, never handed its own `Scene`.
 *
 * That is a Remotion constraint with teeth: `defaultProps` on a `<Composition>`
 * are serialized to JSON so the studio can edit them, and **every function in
 * them is silently dropped**. Passing the scene object through props therefore
 * delivered a chapter with its captions intact and every `diagram` and every
 * computed proof line quietly missing — a render that succeeded and showed less
 * than it was asked to. Resolving from `SCRIPT` here keeps the functions.
 *
 * The band is drawn here rather than inside each act, and reads the running
 * act's label off the chapter's own clock. Inside an act it would remount at
 * every act boundary, and the counter is a property of the film.
 */
export const Chapter: React.FC<ChapterProps> = ({ id, rail = true }) => {
  const scene = sceneById(id);
  const frame = useCurrentFrame();
  const lengths = actLengths(scene);

  return (
    <AbsoluteFill style={{ fontFamily: INTER, color: STAGE.ink }}>
      <Series>
        {scene.acts.map((act, index) => (
          <Series.Sequence key={`${act.capture}-${index}`} durationInFrames={lengths[index]!}>
            <ActFilm chapter={scene.id} index={index} />
          </Series.Sequence>
        ))}
      </Series>
      {rail && (
        <FilmIndex
          at={SCRIPT.findIndex((s) => s.id === scene.id)}
          tab={chapterTab(scene)}
          count={SCRIPT.length}
          title={scene.title}
          label={actAt(scene, frame).act.label}
        />
      )}
    </AbsoluteFill>
  );
};
