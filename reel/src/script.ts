/**
 * @module reel/script
 * @description The reel, as data. This is the file you edit.
 *
 * Everything about how the film reads lives here: chapter order, what each beat
 * is played at, what the margin says, where the panel sits, and which figure a
 * diagram enlarges. Nothing here touches the browser, so changing a caption or
 * a speed is a hot reload rather than a re-shoot. That is the number the whole
 * re-architecture was for.
 *
 * Two rules this file is held to:
 *
 *  1. **No figure is written down.** A diagram or a proof line names a `figures`
 *     key and `figure()` fetches it; a key that stopped being read throws at
 *     render rather than going quietly stale on screen.
 *  2. **No em dash or en dash on camera.** They kern badly at this size and the
 *     old reel's captions were full of them (ADR-0043). Hyphens, or a rewrite.
 */
import React from 'react';
import type { CaptureId, Manifest } from './captures';
import { figure } from './captures';
import type { BeatPlan } from './ramp';
import type { Crop, StageName } from './layout';
import type { PieceId } from './pieces';
import type { Plot } from './diagrams';
import { Funnel, Ratio, Tally } from './diagrams';
import { FacetBoard, FactorLadder, RuleBoard } from './showcase';

/** What the margin says, and what the camera does, from one beat onward. */
export interface Mark {
  /** The beat this mark is cued to. Must be a beat the chapter plans. */
  beat: string;
  /** Frames after the beat starts. Lets two marks share one beat. */
  offset?: number;
  /**
   * Cue this mark at the moment a figure was read off the panel, plus `offset`.
   *
   * The honest way to hold a proof line back. `figure()` guarantees a number
   * came off the panel; it cannot guarantee the frame it is printed over is
   * showing it, and a line that states what a lookup cost while the field still
   * reads `00` is asserting a result before the result exists. Every figure in a
   * manifest carries the clip ms it was read at, so the frame is a lookup
   * (`frameAtClipMs`) rather than arithmetic somebody did once - and it stays
   * right when the beat is retimed, which the arithmetic does not.
   *
   * Named beats still decide *which* beat a mark belongs to. This decides where
   * inside it.
   */
  after?: string;
  /**
   * The slide's headline. Starts a new slide, clearing the one before it.
   *
   * A headline is the question the beat answers, in the words an admin would
   * use. Omit it to add points to the slide already up.
   */
  headline?: string;
  /**
   * The slide's points. Short enough to take in at a glance, never a paragraph.
   *
   * A point may be a function of the capture, and one carrying a number always
   * is: that is how a point states a figure the panel displayed rather than one
   * somebody typed. `figure()` throws when the read-back is missing, so the
   * render fails instead of printing a stale number. Start a point with its
   * figure and the margin sets that figure apart from the words after it.
   */
  points?: (string | ((manifest: Manifest) => string))[];
  /** How the frame is arranged from here. Held from the previous mark when omitted. */
  stage?: StageName;
  /** What part of the panel fills its rectangle. Held when omitted. */
  crop?: Crop;
  /** A figure, enlarged. Given the plot it may draw in and the frame it arrives on. */
  diagram?: (manifest: Manifest, plot: Plot, from: number) => React.ReactNode;
}

/**
 * One act: a single capture, retimed and captioned.
 *
 * An act is the unit of shooting. A chapter that carries three scenarios is
 * three captures rather than one long one, so a caption change stays free and a
 * walk change re-films the twenty seconds it touched instead of the whole
 * chapter. It is also the unit of failure: a beat that misses ends its act, not
 * the argument either side of it. (ADR-0053)
 */
export interface FilmAct {
  /**
   * Which kind of act this is. Optional, and only on this variant.
   *
   * An act was footage and nothing else until set pieces arrived, so making the
   * discriminant required would have meant touching every act in this file to
   * say the thing it already was. Omitted means film, which is what an act
   * written before there was anything else to be already meant.
   */
  kind?: 'film';
  /** The footage this act plays. Several acts in a chapter, several clips. */
  capture: CaptureId;
  /**
   * What the band calls this act, beside the chapter counter.
   *
   * Omitted on a one-act chapter, and that is the point: the slot used to carry
   * `The tour` / `In depth` on every chapter, which named nothing once every
   * chapter became an argument. A label earns the slot only when a chapter has
   * more than one movement to distinguish.
   */
  label?: string;
  plan: BeatPlan[];
  marks: Mark[];
}

/**
 * One act with no footage under it: a set piece takes the frame.
 *
 * The panel is gone and a recreation of one of its own components is on the
 * dark stage, enlarged, exploded, counted. `SCRIPT.md`'s "synthetic layer"
 * carries the rules; the one that shapes this type is that **every figure a
 * piece prints has to be a figure the rig read**. So a piece act names the
 * capture it dramatises even though it plays none of its frames: `from` is
 * where its numbers come from, not what is on screen.
 *
 * A piece act carries no `label`. The band names the act a piece interrupts,
 * not the piece - see `actLabelAt` in `comp/Chapter.tsx`. A piece that named
 * itself would blink the label off mid-chapter and back on again, which reads
 * as a fault rather than as a movement ending.
 */
export interface PieceAct {
  kind: 'piece';
  /** Which piece, by id. Resolved through the registry, never passed as a component. */
  piece: PieceId;
  /** The footage whose figures this piece dramatises. None of its frames are played. */
  from: CaptureId;
}

/**
 * One act of a chapter: footage, or a set piece standing in place of it.
 *
 * Narrow on `kind` before reading anything else. A piece has no `capture`, no
 * `plan` and no `marks`, and the two are sequenced by the same `<Series>`.
 */
export type Act = FilmAct | PieceAct;

/**
 * One chapter of the reel: one tab, one or more acts.
 *
 * The id is the chapter's, not a capture's. They coincide while a chapter has a
 * single act and stop coinciding as soon as it does not, so nothing may assume
 * `scene.id` names footage - `chapterTab` and `Chapter` read `act.capture`.
 */
export interface Scene {
  id: string;
  /** The chapter card's title. Not the manifest's, so the reel can retitle a shot. */
  title: string;
  acts: Act[];
}

/* --- Figure shapes, as read by the walks ---------------------------------- */

interface Counts {
  shown: number;
  total: number;
}
interface Facet {
  attribute: string;
  distinct: number;
  values: { value: string; members: number; filterable: boolean }[];
}
interface Filter {
  attribute: string;
  value: string;
  members: number;
}
interface CoverageRow {
  label: string;
  count: number;
  pct: number;
}

/* --- The reel ------------------------------------------------------------- */

/**
 * Chapters in order.
 *
 * Rail order, forwards only, and a tab is visited once. That ordering is the
 * restructure: the old cut toured four tabs across seven chapters and came back
 * to Groups three times, so the viewer was asked to re-enter a place the film
 * had already finished with. A chapter now holds every scenario its tab has,
 * which is what acts are for.
 *
 * Users is the first chapter to be three acts on one tab, and the `compare`
 * chapter is gone into it: the comparison was never a place, it was how the gap
 * gets diagnosed. `attributes` and `reporting` are still their own chapters and
 * still out of rail order - they are the two captures waiting to be folded into
 * Groups the same way, and until they are they run where they always did.
 */
export const SCRIPT: Scene[] = [
  {
    id: 'home',
    title: 'Home',
    acts: [
      {
        capture: 'home',
        /*
         * Holds, and long ones.
         *
         * Every beat that raises a slide freezes on its first frame while the
         * slide lands, so the viewer reads it before anything moves, then
         * watches the move with the slide still up. That is the rhythm the
         * whole film is cut to now: read, then watch, never both at once. The
         * numbers are long on purpose - the previous cut gave a slide about
         * two and a half seconds and expected it to be read while the panel
         * was scrolling under it.
         */
        plan: [
          { beat: 'jump', speed: 'half', easeMs: 300, holdMs: 3000, tailMs: 2400 },
          { beat: 'working-set', speed: 'natural', easeMs: 350, holdMs: 3200 },
          { beat: 'findings', speed: 'half', easeMs: 400, holdMs: 3400, tailMs: 3200 },
        ],
        marks: [
          {
            beat: 'jump',
            stage: 'home',
            headline: 'Search your directory instantly.',
            points: ['Type an email, get the person.'],
          },
          {
            beat: 'jump',
            /*
             * Held until the search has actually answered.
             *
             * With no cue this point was on screen while the field was still
             * empty, so the film stated a result before the lookup had
             * happened. `figure()` guarantees the number came off the panel; it
             * cannot guarantee the frame it is printed over shows it.
             */
            after: 'results',
            points: [(m) => `${figure<number>(m, 'results')} result, without leaving the tab.`],
          },
          {
            beat: 'working-set',
            headline: 'Resume your workflow without searching.',
            points: [
              (m) =>
                `${figure<number>(m, 'pinned')} pinned, ${figure<number>(m, 'recent')} recent.`,
              'Stored locally per org. Automatically expires.',
            ],
          },
          {
            beat: 'findings',
            headline: 'Spot actionable items right away.',
            points: [
              (m) => `${figure<number>(m, 'unruled')} groups with no rule filling them.`,
              (m) => `${figure<number>(m, 'emptyGroups')} empty groups with nobody in them.`,
              (m) => `${figure<number>(m, 'pausedRules')} inactive rule left behind.`,
            ],
          },
          /*
           * The `report` beat is filmed and not played.
           *
           * Pressing a finding and getting the group names back is a good
           * moment, and Home is not where it earns its runtime: Reporting ends
           * on the same move against a scan nobody could run by hand, which is
           * the version worth the seconds. The walk still shoots it, and still
           * refuses a capture where the count and the rows behind it disagree,
           * so the fixture assertion survives the cut. Name the beat in the
           * plan and the words come back with it.
           */
        ],
      },
      // B3, the unpacking. It follows `findings` and reads that beat's own
      // figures, so the proportion it draws is the one the panel was showing
      // when the camera left it. Home's footage plus its own set piece is one
      // movement, not two, so neither act carries a label and the band keeps
      // saying the same thing across the join.
      { kind: 'piece', piece: 'unpacking', from: 'home' },
    ],
  },

  {
    id: 'users',
    title: 'Users',
    acts: [
      {
        capture: 'users-gap',
        label: 'The gap',
        plan: [
          { beat: 'arrive', speed: 'sprint', easeMs: 300, holdMs: 3200 },
          { beat: 'gap', speed: 'dwell', easeMs: 400, holdMs: 2600, tailMs: 3200 },
        ],
        marks: [
          {
            beat: 'arrive',
            stage: 'home',
            headline: 'A new hire files an access ticket.',
            points: ['Onboarding finished, but her core access never arrived.'],
          },
          {
            beat: 'gap',
            points: [
              (m) =>
                `${figure<number>(m, 'groups')} assigned groups, missing her core team access.`,
              'View the complete assignment list on one screen.',
            ],
          },
        ],
      },
      {
        capture: 'users-cause',
        label: 'The cause',
        plan: [
          { beat: 'subject', speed: 'sprint', easeMs: 300, holdMs: 3000 },
          { beat: 'against', speed: 'brisk', easeMs: 400, holdMs: 1200 },
          { beat: 'difference', speed: 'half', easeMs: 400, holdMs: 3400 },
          { beat: 'cause', speed: 'dwell', easeMs: 400, holdMs: 3200, tailMs: 3600 },
        ],
        marks: [
          {
            beat: 'subject',
            stage: 'home',
            headline: 'Benchmark against a working coworker.',
            points: ['Same title and team. Different application access.'],
          },
          {
            beat: 'difference',
            points: [
              (m) => {
                const t = figure<{ groups: number; apps: number; attributes: number }>(
                  m,
                  'tallies',
                );
                return `${t.groups} groups, ${t.apps} apps, ${t.attributes} attributes apart.`;
              },
              'Every tool can tell you that much.',
            ],
          },
          {
            /*
             * Held until the worklist row is legible.
             *
             * The clause and the value beside it are the whole chapter, and a
             * slide stating them over a section still scrolling into place
             * would be asserting a reading the viewer has not been given yet.
             */
            beat: 'cause',
            after: 'cause',
            headline: 'Unbound reveals the root cause.',
            points: [
              (m) => `The mapping rule requires ${figure<{ clause: string }>(m, 'cause').clause}`,
              (m) => `The user profile says ${figure<{ resolved: string }>(m, 'cause').resolved}`,
              'An attribute typo broke the automated provisioning.',
            ],
          },
        ],
      },
      // B1, the film's payoff. It follows `cause` and reads that beat's own
      // figure, so it dramatises the card the camera has just left rather than
      // a card it is about to reach: `from` is `users-cause`, whose `cause`
      // figure carries both of the strings the piece holds up against each
      // other.
      { kind: 'piece', piece: 'exploded-plates', from: 'users-cause' },
      /*
       * The fix, in two acts around a set piece.
       *
       * One capture, cut in two: the ledger belongs between the prediction and
       * what the prediction turned out to be worth, and an act is the only
       * thing a piece can sit between. **This cost no re-shoot.** `buildRamp`
       * takes any subset of a capture's beats in reel order and a segment's
       * `trimBefore` derives from the beat's own absolute `at`, so the second
       * act seeks into the same clip rather than needing one of its own.
       *
       * It did cost one editorial change, and it is not obvious: see `land`'s
       * missing `easeMs` below. Re-shooting nothing is true of the footage and
       * false of the cut.
       */
      {
        capture: 'users-fix',
        label: 'The fix',
        plan: [
          { beat: 'open', speed: 'sprint', easeMs: 300, holdMs: 2600 },
          { beat: 'edit', speed: 'brisk', easeMs: 400, holdMs: 1600 },
          { beat: 'predict', speed: 'half', easeMs: 400, holdMs: 3400 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            headline: 'Remediate directly from the investigation screen.',
            points: ['Edit the attribute right inside the panel.'],
          },
          {
            beat: 'predict',
            headline: 'Preview the blast radius before saving.',
            points: ['Test the draft against all dependent rules.'],
          },
          {
            beat: 'predict',
            after: 'added',
            points: [(m) => `Predicted: ${figure<string[]>(m, 'added').join(', ')}`],
          },
        ],
      },
      // The ledger's slot. A placeholder until the piece itself is built, and
      // visibly one on camera, so an empty slot cannot be mistaken for a piece
      // that rendered nothing.
      { kind: 'piece', piece: 'ledger', from: 'users-fix' },
      {
        capture: 'users-fix',
        label: 'The fix',
        plan: [
          /*
           * No `easeMs`, where the single act had 400.
           *
           * `buildRamp` resets `previousRate` to natural at the start of every
           * ramp, so an ease is only ever applied against the rate the previous
           * beat *in this act* ended on. While `predict` and `land` were one
           * act they were both `half`, the rates matched, and the ease was
           * never run. Split, `land` starts from natural and would ramp down
           * across its first 400ms of clip - a speed change the cut never had
           * and nobody asked for, on the beat the whole chapter resolves on.
           */
          { beat: 'land', speed: 'half', holdMs: 2600, tailMs: 4000 },
        ],
        marks: [
          {
            beat: 'land',
            after: 'groupsAfter',
            headline: 'The automation triggers immediately.',
            points: [
              (m) => figure<string>(m, 'saved'),
              (m) =>
                `${figure<number>(m, 'groupsBefore')} groups before, ` +
                `${figure<number>(m, 'groupsAfter')} after.`,
              'Resolved without a single page reload.',
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'groups',
    title: 'Groups',
    acts: [
      {
        capture: 'groups',
        plan: [
          { beat: 'cascade', speed: 'half', easeMs: 350 },
          { beat: 'open-group', speed: 'half', easeMs: 450, holdMs: 800 },
          { beat: 'members', speed: 'dwell', easeMs: 400, holdMs: 3200, tailMs: 3400 },
        ],
        marks: [
          // No slide over the list itself. "Every group in the org, in one
          // list" was true of every admin tool built in the last fifteen years,
          // which is the test a line has to pass to earn the screen.
          { beat: 'cascade', stage: 'home' },
          {
            beat: 'members',
            headline: 'Audit membership provenance instantly.',
            points: ['Grouped by assignment source instead of alphabetical order.'],
            diagram: (m, plot, from) =>
              React.createElement(Tally, {
                plot,
                from,
                entries: [{ label: 'members', value: figure<Counts>(m, 'roster').total }],
              }),
          },
        ],
      },
    ],
  },

  {
    id: 'apps',
    title: 'Apps',
    acts: [
      {
        capture: 'apps',
        plan: [
          { beat: 'open', speed: 'natural', easeMs: 350 },
          { beat: 'filter', speed: 'half', easeMs: 400, holdMs: 3000 },
          { beat: 'sort', speed: 'natural', easeMs: 350, holdMs: 800, tailMs: 3000 },
        ],
        marks: [
          { beat: 'open', stage: 'home' },
          {
            beat: 'filter',
            headline: 'Identify the applications nobody switched back on.',
            diagram: (m, plot, from) =>
              React.createElement(Ratio, {
                plot,
                from,
                before: { label: 'applications', value: figure<Counts>(m, 'inventory').shown },
                after: { label: 'inactive', value: figure<Counts>(m, 'inactive').shown },
              }),
          },
        ],
      },
    ],
  },

  {
    id: 'rules',
    title: 'Rules',
    acts: [
      {
        capture: 'rules',
        label: 'The inventory',
        plan: [
          { beat: 'load', speed: 'half', easeMs: 350, holdMs: 2800 },
          { beat: 'active', speed: 'natural', easeMs: 400, holdMs: 900 },
          { beat: 'dormant', speed: 'dwell', easeMs: 450, holdMs: 3400, tailMs: 3400 },
        ],
        marks: [
          {
            beat: 'load',
            stage: 'home',
            headline: 'Audit your automation logic directly.',
            points: ['Rules are fetched when you ask, and not before.'],
          },
          {
            beat: 'dormant',
            stage: 'focus',
            headline: 'Locate inactive logic cluttering the environment.',
            points: [
              (m) => {
                const stats = figure<Record<string, number>>(m, 'stats');
                return `${stats.Active ?? 0} of ${stats['Total Rules'] ?? 0} rules are in force.`;
              },
            ],
            diagram: (m, plot, from) => {
              const stats = figure<Record<string, number>>(m, 'stats');
              const total = stats['Total Rules'] ?? 0;
              return React.createElement(RuleBoard, {
                plot,
                from,
                total,
                active: stats.Active ?? total,
                stats: [
                  { label: 'rules', value: total },
                  { label: 'active', value: stats.Active ?? 0 },
                  { label: 'dormant', value: stats.Inactive ?? 0 },
                  { label: 'conflicts', value: stats.Conflicts ?? 0 },
                ],
              });
            },
          },
        ],
      },
      /*
       * The chapter ADR-0043 held out, back arguing both verbs (`I-029`).
       *
       * It was pulled because the product was making a claim that was not true:
       * `ruleImpact` modelled deactivation as retracting membership, so the
       * scene captioned an access loss over a modal that had counted something
       * else (`D-052`). The model and the copy were fixed; the note in ADR-0043
       * said what the scene should argue when it came back, and this is it.
       *
       * One population, two verbs, and the difference between them is the
       * whole act. Nothing here states which verb does what from this file's
       * own knowledge - `walks/rules-impact.mjs` reads the panel's own sentence
       * in each mode and refuses a take where it stopped saying it, because a
       * cut of the fix and a cut of the defect look identical at playback
       * speed.
       *
       * `load` is filmed and not played, the same way Home's `report` is: the
       * list has to be fetched before there is a rule to open, and the act
       * above already spent the seconds on the ask. Naming the beat in this
       * plan is all it would take to bring it back.
       */
      {
        capture: 'rules-impact',
        label: 'The consequence',
        plan: [
          { beat: 'open', speed: 'sprint', easeMs: 300, holdMs: 2800 },
          { beat: 'holds', speed: 'dwell', easeMs: 400, holdMs: 3600 },
          { beat: 'deactivate', speed: 'half', easeMs: 400, holdMs: 3600, tailMs: 3600 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            headline: 'Before you switch a rule off, find out what it is holding up.',
            points: ['Open the rule. The preview is read only; it writes nothing.'],
          },
          {
            beat: 'holds',
            /*
             * Held until the analysis has answered. The dialog spends its first
             * moment on a spinner with two stat cards that do not exist yet,
             * and a slide stating a count over that frame would be asserting a
             * result before the result exists.
             */
            after: 'sole',
            headline: 'The panel counts the members no other rule explains.',
            points: [
              (m) => {
                const sole = figure<{ heldSolely: number; members: number }>(m, 'sole');
                return `${sole.heldSolely} of ${sole.members} members are held by this rule alone.`;
              },
              (m) => `All of them in ${figure<{ group: string }>(m, 'target').group}.`,
            ],
            diagram: (m, plot, from) => {
              const sole = figure<{ heldSolely: number; members: number }>(m, 'sole');
              return React.createElement(Ratio, {
                plot,
                from,
                before: { label: 'members', value: sole.members },
                after: { label: 'held by this rule alone', value: sole.heldSolely },
              });
            },
          },
          {
            beat: 'deactivate',
            headline: 'One number, two verbs, two different outcomes.',
            points: [
              'Deactivate removes nobody. They stay, with no rule left to explain them.',
              'Only delete can take them out, and removeUsers decides whether it does.',
              'Deactivating is reversible. Neither branch of the delete is.',
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'attributes',
    title: 'Attributes',
    acts: [
      {
        capture: 'attributes',
        plan: [
          { beat: 'open', speed: 'brisk', easeMs: 400, holdMs: 3000 },
          // Held, and held longer than the walk took. The facet board is the
          // chapter's whole evidence and it has six cards to deal out; at the beat's
          // own length it arrived and left before the last one had finished
          // arriving. The panel is off frame here, so the hold costs nothing but
          // time and buys the only look at the thing being claimed.
          { beat: 'facets', speed: 'dwell', easeMs: 500, holdMs: 3600 },
          { beat: 'filter', speed: 'half', easeMs: 400, holdMs: 1400 },
          { beat: 'compose', speed: 'half', easeMs: 350, holdMs: 3200 },
          { beat: 'roster', speed: 'dwell', easeMs: 350, holdMs: 1200, tailMs: 3200 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            headline: 'Before you write a rule, see what you are matching on.',
          },
          {
            beat: 'facets',
            stage: 'focus',
            headline: 'Every attribute this group actually varies along.',
            points: ['Values, counts, and which ones a rule can filter on.'],
            // The whole board, not one attribute. The claim is about a *set* of
            // dimensions being discovered, so an enlargement of a single spread
            // would be arguing something narrower than the slide beside it.
            diagram: (m, plot, from) =>
              React.createElement(FacetBoard, { plot, from, facets: figure<Facet[]>(m, 'facets') }),
          },
          // The panel comes back for the clicking. The board says what the
          // dimensions are; only the product can show them being used.
          { beat: 'filter', stage: 'home' },
          {
            beat: 'compose',
            headline: 'Stack two filters and you have the population a rule would match.',
            points: ['Counted locally, without reloading the page.'],
            diagram: (m, plot, from) =>
              React.createElement(Funnel, {
                plot,
                from,
                steps: [
                  { label: 'members', value: figure<Counts>(m, 'rosterBefore').shown },
                  {
                    label: figure<Filter>(m, 'firstFilter').value,
                    value: figure<Counts>(m, 'rosterFiltered').shown,
                  },
                  {
                    // The panel's own casing. Lower-casing it produced "and
                    // employee", which reads as prose rather than as the value the
                    // viewer just watched being clicked.
                    label: `and ${figure<Filter>(m, 'secondFilter').value}`,
                    value: figure<Counts>(m, 'rosterComposed').shown,
                  },
                ],
              }),
          },
          { beat: 'roster' },
        ],
      },
    ],
  },

  {
    id: 'reporting',
    title: 'Reporting',
    acts: [
      {
        capture: 'reporting',
        plan: [
          { beat: 'open', speed: 'brisk', easeMs: 400, holdMs: 3000 },
          { beat: 'arm', speed: 'half', easeMs: 400, holdMs: 3200 },
          // The scan is the one genuinely irreducible operation in the app, and the
          // only place a progress bar is showing work somebody waits on. It is
          // played fast because the wait is the subject, not the spectacle.
          { beat: 'scan', speed: 'sprint', easeMs: 500, holdMs: 600 },
          { beat: 'breakdown', speed: 'dwell', easeMs: 400, holdMs: 3600 },
          { beat: 'unenrolled', speed: 'half', easeMs: 450, holdMs: 3000, tailMs: 4000 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            headline: 'Deprecating SMS authentication. Who is exposed?',
          },
          {
            beat: 'arm',
            points: [
              'Calculates the exact cost before running the scan.',
              'One API call per member. It never runs on its own.',
            ],
          },
          {
            beat: 'breakdown',
            stage: 'focus',
            headline: 'Map the exact authentication posture.',
            diagram: (m, plot, from) =>
              React.createElement(FactorLadder, {
                plot,
                from,
                rows: figure<CoverageRow[]>(m, 'coverage'),
                highlight: 'No factors enrolled',
              }),
          },
          {
            beat: 'unenrolled',
            stage: 'home',
            headline: 'Turn reports into actionable target lists.',
            points: [
              (m) => {
                const gap = figure<CoverageRow[]>(m, 'coverage').find(
                  (r) => r.label === 'No factors enrolled',
                );
                if (!gap) throw new Error('reporting: the coverage scan found no unenrolled row');
                const roster = figure<Counts>(m, 'rosterUnenrolled');
                return `${gap.count} of ${roster.total} have no secure second factor.`;
              },
              'Click the finding to reveal the vulnerable accounts.',
            ],
          },
        ],
      },
    ],
  },
];
