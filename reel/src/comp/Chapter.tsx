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
import { capture, clip, type CaptureId, type Manifest } from '../captures';
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
import { SCRIPT, type Act, type FilmAct, type PieceAct, type Scene } from '../script';
import { PIECES, piece } from '../pieces';
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
  lines: { kind: Line['kind']; text: string }[];
  diagram?: (manifest: Manifest, plot: Rect, from: number) => React.ReactNode;
}

/**
 * The footage an act is about: what it plays, or what a set piece dramatises.
 *
 * A piece plays no frames, and it is still tied to a capture - its figures came
 * off that panel, and it films the same tab, so everything that reasons about a
 * chapter's footage reasons about a piece's `from` too. One accessor rather
 * than a `kind` check at each of those call sites.
 */
export function actCapture(act: Act): CaptureId {
  return act.kind === 'piece' ? act.from : act.capture;
}

/** A stable key for an act within its chapter. Pieces have no capture to name. */
function actKey(act: Act, index: number): string {
  return `${act.kind === 'piece' ? `piece-${act.piece}` : act.capture}-${index}`;
}

/** How long each act runs, in order. The chapter's own layout, and the band's. */
export function actLengths(scene: Scene): number[] {
  return scene.acts.map((act) =>
    act.kind === 'piece'
      ? // A literal from the piece's own module, never a computation. `Reel`
        // builds `CHAPTERS` at module scope, so anything that can throw on this
        // path takes the whole bundle down instead of one composition. See
        // `pieces/index.ts`.
        PIECES[act.piece].frames
      : buildRamp(capture(act.capture), act.plan, FRAME.fps).durationInFrames,
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
  const tabs = scene.acts.map((act) => capture(actCapture(act)).tab);
  const [tab] = tabs;
  const stray = scene.acts.find((act, i) => tabs[i] !== tab);
  if (stray) {
    throw new Error(
      `Chapter "${scene.id}" films tab "${tab}" but its act "${actCapture(stray)}" films ` +
        `"${capture(actCapture(stray)).tab}". A chapter is one tab (ADR-0053).`,
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

/**
 * What the band should say beside the chapter counter at a frame.
 *
 * A set piece has no label of its own and inherits the one belonging to the act
 * it interrupts. Reading `actAt(...).act.label` directly was fine while every
 * act was footage; with a piece between two acts of one movement it blinks the
 * label off for the piece's whole slot and back on afterwards, which reads as a
 * fault rather than as a movement ending. So the search walks backwards to the
 * nearest film act, which is the act the piece is part of.
 */
export function actLabelAt(scene: Scene, frame: number): string | undefined {
  const { index } = actAt(scene, frame);
  for (let i = index; i >= 0; i -= 1) {
    const act = scene.acts[i]!;
    if (act.kind !== 'piece') return act.label;
  }
  // A chapter opening on a piece has nothing to inherit. Legal, and unlabelled.
  return undefined;
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
  // Narrowed rather than assumed: `Chapter` picks the renderer off `kind`, so
  // arriving here with a piece means the two disagree, and a wrong renderer on
  // the right slot would otherwise fail somewhere deep in a manifest read.
  if (act.kind === 'piece') {
    throw new Error(`Chapter "${chapter}" act ${index} is the set piece "${act.piece}", not film.`);
  }
  const film: FilmAct = act;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const manifest = capture(film.capture);

  if (manifest.panel.width !== 840 || manifest.panel.height !== 980) {
    throw new Error(
      `${film.capture}: captured at ${manifest.panel.width}x${manifest.panel.height}, ` +
        'but the composition lays out for 840x980.',
    );
  }

  const ramp = useMemo(() => buildRamp(manifest, film.plan, fps), [manifest, film.plan, fps]);

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

  /**
   * The stretch of clip this act plays, in clip ms.
   *
   * The plan is in reel order, so the window is the first planned beat's start
   * to the last planned beat's end. It exists to make {@link Ramp.frameAtClipMs}
   * fail loudly, because outside this window it does not fail at all: it clamps
   * to frame 0 for a moment before the act and returns the act's last frame for
   * a moment after it, both of which render a perfectly good chapter with a
   * caption in the wrong place. That became reachable the moment one capture
   * could be cut into two acts - a mark left behind in act A cued to a figure
   * the panel showed during act B is exactly the mistake a split invites, and
   * the guard below is what makes splitting an act safe to do again.
   */
  const played = useMemo(() => {
    const byName = new Map(manifest.beats.map((beat) => [beat.name, beat]));
    // `buildRamp` has already refused a plan naming a beat that was never
    // filmed, so every lookup here resolves.
    const planned = film.plan.map((entry) => byName.get(entry.beat)!);
    return { at: planned[0]!.at, endAt: planned[planned.length - 1]!.endAt };
  }, [film.plan, manifest]);

  const cues = useMemo<Cue[]>(() => {
    let stage: StageName = WORKING_STAGE;
    let crop = bare;
    return film.marks.map((mark) => {
      const cue = ramp.cues[mark.beat];
      if (!cue) {
        throw new Error(
          `${film.capture}: mark on beat "${mark.beat}", which the plan does not include. ` +
            `Planned: ${film.plan.map((p) => p.beat).join(', ')}`,
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
            `${film.capture}: mark cued after figure "${mark.after}", which was never read. ` +
              `Read: ${Object.keys(manifest.figures).join(', ') || '(none)'}`,
          );
        }
        if (read.at < played.at || read.at > played.endAt) {
          throw new Error(
            `${film.capture}: mark cued after figure "${mark.after}", read at ${read.at}ms, ` +
              `which is outside act ${index}'s window of ${played.at}-${played.endAt}ms. ` +
              'The act does not play that moment, so the cue would land silently at one ' +
              'end of it. Move the mark to the act that plays the figure.',
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
        lines: [
          ...(mark.headline === undefined
            ? []
            : [{ kind: 'headline' as const, text: mark.headline }]),
          ...(mark.points ?? []).map((point) => ({
            kind: 'point' as const,
            text: typeof point === 'function' ? point(manifest) : point,
          })),
        ],
        diagram: mark.diagram,
      };
    });
  }, [film, bare, index, manifest, ramp, played]);

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

  /**
   * The slide on screen: the most recent headline, plus the points cued since.
   *
   * Slides replace rather than accumulate. The old margin let every band stay
   * for the rest of the chapter, on the reasoning that a claim which scrolls
   * away takes its evidence's subject with it - true of a band, false of a
   * slide, because a slide carries its own subject in its headline. What
   * accumulation actually produced was six lines by the end of a chapter with
   * the newest at the bottom, which is the opposite of where the eye goes.
   *
   * Points cued before the first headline still show. A chapter is allowed to
   * open on a point; it just has nothing to clear.
   */
  const arrived = cues.filter((cue) => frame >= cue.from);
  const lastHeadline = arrived.reduce(
    (found, cue, i) => (cue.lines.some((line) => line.kind === 'headline') ? i : found),
    -1,
  );
  const lines: Line[] = arrived
    .slice(Math.max(0, lastHeadline))
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
        src={clip(film.capture)}
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

/**
 * One act with no footage: a set piece on the dark stage.
 *
 * The sibling of {@link ActFilm} and deliberately much thinner. There is no
 * ramp, no clip, no cursor and no margin - a piece carries its own copy,
 * because the whole reason it exists is that it can say a thing the margin
 * beside a video cannot. What it shares with an act of film is the backdrop and
 * the frame's own clock.
 *
 * **The piece is not wrapped in a `<Sequence>` of its own.** `Chapter`'s
 * `<Series>` already places this act, so `useCurrentFrame()` here starts at 0
 * on the piece's first frame - which is the clock every verb in `reel/verbs` is
 * authored against. A further `<Sequence>` inside a piece would remap that to 0
 * again and silently freeze every verb at its first pose. See
 * `verbs/useVerb.ts`.
 */
const ActPiece: React.FC<ActProps> = ({ chapter, index }) => {
  const scene = sceneById(chapter);
  const act = scene.acts[index];
  if (!act) {
    throw new Error(`Chapter "${chapter}" has no act ${index}; it has ${scene.acts.length}.`);
  }
  if (act.kind !== 'piece') {
    throw new Error(
      `Chapter "${chapter}" act ${index} is footage ("${act.capture}"), not a piece.`,
    );
  }
  const set: PieceAct = act;
  const { component: Piece, frames } = piece(set.piece);

  // The `focus` stage's plot: the rectangle a showcase gets when the panel has
  // left. A piece is the same situation with no footage underneath, so it draws
  // into the same place rather than inventing a second geometry for it.
  const { plot } = STAGES.focus;

  return (
    <AbsoluteFill style={{ fontFamily: INTER, color: STAGE.ink }}>
      <Backdrop focusX={plot.x + plot.width / 2} />
      <Piece id={set.piece} frames={frames} plot={plot} manifest={capture(set.from)} />
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
          // Keyed off the piece id or the capture, never `act.capture` alone -
          // a piece has none, so every piece act keyed as `undefined-N`.
          <Series.Sequence key={actKey(act, index)} durationInFrames={lengths[index]!}>
            {act.kind === 'piece' ? (
              <ActPiece chapter={scene.id} index={index} />
            ) : (
              <ActFilm chapter={scene.id} index={index} />
            )}
          </Series.Sequence>
        ))}
      </Series>
      {rail && (
        <FilmIndex
          at={SCRIPT.findIndex((s) => s.id === scene.id)}
          tab={chapterTab(scene)}
          count={SCRIPT.length}
          title={scene.title}
          label={actLabelAt(scene, frame)}
        />
      )}
    </AbsoluteFill>
  );
};
