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
import type { Register } from './comp/Margin';
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
   * Margin copy. Bands accumulate down the chapter; they do not replace.
   *
   * A line may be a function of the capture, and a proof line usually is: that
   * is how a sentence states a figure the panel displayed rather than one
   * somebody typed. `figure()` throws when the read-back is missing, so the
   * render fails instead of printing a stale number.
   */
  lines?: { register: Register; text: string | ((manifest: Manifest) => string) }[];
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
export interface Act {
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
        plan: [
          { beat: 'jump', speed: 'half', easeMs: 300, holdMs: 700, tailMs: 1800 },
          { beat: 'working-set', speed: 'natural', easeMs: 350, holdMs: 500 },
          { beat: 'findings', speed: 'half', easeMs: 400, holdMs: 900 },
          { beat: 'report', speed: 'half', easeMs: 350, holdMs: 500, tailMs: 2000 },
        ],
        marks: [
          {
            beat: 'jump',
            stage: 'home',
            lines: [{ register: 'claim', text: 'A ticket gives you an id, not a name.' }],
          },
          {
            beat: 'jump',
            /*
             * Held until the id has actually resolved.
             *
             * With no cue this line was on screen while the field still read
             * `00`, so the film asserted what the lookup cost before the lookup
             * had happened. `figure()` guarantees the number came off the
             * panel; it cannot guarantee the frame it is printed over shows it.
             *
             * This used to be a hand-worked frame number with six lines of
             * arithmetic under it. `after` reads the moment off the figure
             * itself, so it cannot drift when the beat is retimed.
             */
            after: 'jumpCost',
            lines: [
              {
                register: 'proof',
                text: (m) => `The org was already in hand. ${figure<string>(m, 'jumpCost')}.`,
              },
            ],
          },
          {
            beat: 'working-set',
            lines: [
              {
                register: 'evidence',
                text: 'Where you were last time, per org, capped and expiring. An id, a name and a pane, because local storage is plain text and that is all a row needs to redraw.',
              },
            ],
          },
          {
            beat: 'findings',
            lines: [
              {
                register: 'claim',
                text: 'And the other half of the question: what is wrong here, before anybody asks.',
              },
              {
                register: 'proof',
                text: (m) =>
                  `${figure<number>(m, 'unruled')} groups no rule fills. ` +
                  `${figure<number>(m, 'emptyGroups')} with nobody in them. ` +
                  `${figure<number>(m, 'pausedRules')} rule switched off and left there.`,
              },
            ],
          },
          {
            beat: 'report',
            lines: [
              {
                register: 'proof',
                text: (m) =>
                  `${figure<number>(m, 'reportCount')} groups hold app access no rule maintains, ` +
                  `and pressing the number names all ${figure<number>(m, 'reportNamed')} without leaving Home.`,
              },
            ],
          },
        ],
      },
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
          { beat: 'arrive', speed: 'sprint', easeMs: 300 },
          { beat: 'gap', speed: 'dwell', easeMs: 400, holdMs: 700, tailMs: 1600 },
        ],
        marks: [
          {
            beat: 'arrive',
            stage: 'home',
            lines: [
              {
                register: 'claim',
                text: 'A new hire was set up on Monday. By Wednesday she still cannot get into anything her team can.',
              },
            ],
          },
          {
            beat: 'gap',
            lines: [
              {
                register: 'evidence',
                text: (m) =>
                  `Four groups. Her whole membership list fits on one screen, and the one her team ` +
                  `lives in is not on it. ${figure<number>(m, 'groups')} groups is the number to hold on to.`,
              },
            ],
          },
        ],
      },
      {
        capture: 'users-cause',
        label: 'The cause',
        plan: [
          { beat: 'subject', speed: 'sprint', easeMs: 300 },
          { beat: 'against', speed: 'brisk', easeMs: 400, holdMs: 400 },
          { beat: 'difference', speed: 'half', easeMs: 400, holdMs: 700 },
          { beat: 'cause', speed: 'dwell', easeMs: 400, holdMs: 800, tailMs: 2000 },
        ],
        marks: [
          {
            beat: 'subject',
            stage: 'home',
            lines: [
              {
                register: 'claim',
                text: 'Against someone who does the same job on the same team, and can.',
              },
            ],
          },
          {
            beat: 'difference',
            lines: [
              {
                register: 'evidence',
                text: (m) => {
                  const t = figure<{ groups: number; apps: number; attributes: number }>(
                    m,
                    'tallies',
                  );
                  return (
                    `${t.groups} groups apart, ${t.apps} apps apart, ${t.attributes} attributes ` +
                    'apart. Every tool can tell you that much.'
                  );
                },
              },
            ],
          },
          {
            /*
             * Held until the worklist row is legible.
             *
             * The clause and the value beside it are the whole chapter, and a
             * line stating them over a section still scrolling into place would
             * be asserting a reading the viewer has not been given yet.
             */
            beat: 'cause',
            after: 'cause',
            lines: [
              {
                register: 'proof',
                text: (m) => {
                  const cause = figure<{ clause: string; resolved: string }>(m, 'cause');
                  return `The rule wanted ${cause.clause}. Her profile says ${cause.resolved}. Somebody mistyped it the day the account was made.`;
                },
              },
            ],
          },
        ],
      },
      {
        capture: 'users-fix',
        label: 'The fix',
        plan: [
          { beat: 'open', speed: 'sprint', easeMs: 300 },
          { beat: 'edit', speed: 'brisk', easeMs: 400, holdMs: 500 },
          { beat: 'predict', speed: 'half', easeMs: 400, holdMs: 700 },
          { beat: 'land', speed: 'half', easeMs: 400, holdMs: 600, tailMs: 2200 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            lines: [{ register: 'claim', text: 'So correct it here.' }],
          },
          {
            beat: 'predict',
            lines: [
              {
                register: 'evidence',
                text: 'Before it writes anything, it evaluates every rule that reads the attribute against the drafted profile.',
              },
            ],
          },
          {
            beat: 'predict',
            after: 'added',
            lines: [
              {
                register: 'proof',
                text: (m) =>
                  `It names them: ${figure<string[]>(m, 'added').join(' and ')}. That is the ` +
                  'prediction, made before the write, not a report afterwards.',
              },
            ],
          },
          {
            beat: 'land',
            after: 'groupsAfter',
            lines: [
              {
                register: 'proof',
                text: (m) =>
                  `${figure<string>(m, 'saved')} The rule applied and the group arrived, without ` +
                  'a reload and without leaving the tab.',
              },
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
          { beat: 'open-group', speed: 'half', easeMs: 450, holdMs: 400 },
          { beat: 'members', speed: 'dwell', easeMs: 400, holdMs: 700, tailMs: 1600 },
        ],
        marks: [
          {
            beat: 'cascade',
            stage: 'home',
            lines: [{ register: 'note', text: 'Every group in the org, in one list.' }],
          },
          {
            beat: 'members',
            lines: [
              {
                register: 'note',
                text: 'Open one and it leads with the question people actually ask: why is anybody in here?',
              },
            ],
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
          { beat: 'filter', speed: 'half', easeMs: 400, holdMs: 400 },
          { beat: 'sort', speed: 'natural', easeMs: 350, holdMs: 500, tailMs: 1500 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            lines: [
              { register: 'note', text: 'The application inventory, and what state it is in.' },
            ],
          },
          {
            beat: 'filter',
            lines: [{ register: 'note', text: 'One click to the apps nobody switched back on.' }],
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
        plan: [
          { beat: 'load', speed: 'half', easeMs: 350 },
          { beat: 'active', speed: 'natural', easeMs: 400, holdMs: 400 },
          { beat: 'dormant', speed: 'dwell', easeMs: 450, holdMs: 800, tailMs: 1800 },
        ],
        marks: [
          {
            beat: 'load',
            stage: 'home',
            lines: [
              {
                register: 'note',
                text: 'Rules never load themselves. Nothing is fetched until you ask.',
              },
            ],
          },
          {
            beat: 'dormant',
            stage: 'focus',
            lines: [
              {
                register: 'note',
                text: 'The gap between every rule and the ones in force is the rule nobody deleted.',
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
    ],
  },

  {
    id: 'attributes',
    title: 'Attributes',
    acts: [
      {
        capture: 'attributes',
        plan: [
          { beat: 'open', speed: 'brisk', easeMs: 400 },
          // Held, and held longer than the walk took. The facet board is the
          // chapter's whole evidence and it has six cards to deal out; at the beat's
          // own length it arrived and left before the last one had finished
          // arriving. The panel is off frame here, so the hold costs nothing but
          // time and buys the only look at the thing being claimed.
          { beat: 'facets', speed: 'dwell', easeMs: 500, holdMs: 2000 },
          { beat: 'filter', speed: 'half', easeMs: 400, holdMs: 500 },
          { beat: 'compose', speed: 'half', easeMs: 350, holdMs: 700 },
          { beat: 'roster', speed: 'dwell', easeMs: 350, holdMs: 800, tailMs: 1800 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            lines: [{ register: 'claim', text: 'A group is a population, not a list of names.' }],
          },
          {
            beat: 'facets',
            stage: 'focus',
            lines: [
              {
                register: 'evidence',
                text: 'The panel finds its own dimensions. These are the attributes this group actually varies along, not a fixed column set.',
              },
            ],
            // The whole board, not one attribute. The claim is about a *set* of
            // dimensions being discovered, so an enlargement of a single spread
            // would be arguing something narrower than the sentence beside it.
            diagram: (m, plot, from) =>
              React.createElement(FacetBoard, { plot, from, facets: figure<Facet[]>(m, 'facets') }),
          },
          // The panel comes back for the clicking. The board says what the
          // dimensions are; only the product can show them being used.
          { beat: 'filter', stage: 'home' },
          {
            beat: 'compose',
            lines: [
              {
                register: 'proof',
                text: 'Two filters compose over the same roster. Nothing is fetched again.',
              },
            ],
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
          { beat: 'open', speed: 'brisk', easeMs: 400 },
          { beat: 'arm', speed: 'half', easeMs: 400, holdMs: 500 },
          // The scan is the one genuinely irreducible operation in the app, and the
          // only place a progress bar is showing work somebody waits on. It is
          // played fast because the wait is the subject, not the spectacle.
          { beat: 'scan', speed: 'sprint', easeMs: 500, holdMs: 400 },
          { beat: 'breakdown', speed: 'dwell', easeMs: 400, holdMs: 2000 },
          { beat: 'unenrolled', speed: 'half', easeMs: 450, holdMs: 1000, tailMs: 2000 },
        ],
        marks: [
          {
            beat: 'open',
            stage: 'home',
            lines: [
              { register: 'claim', text: 'Coverage you can act on, not a number in a slide.' },
            ],
          },
          {
            beat: 'arm',
            lines: [
              {
                register: 'evidence',
                text: 'One factors call per member. The panel never runs this on its own, and it says so before it starts.',
              },
            ],
          },
          {
            beat: 'breakdown',
            stage: 'focus',
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
            lines: [
              {
                register: 'proof',
                text: (m) => {
                  const gap = figure<CoverageRow[]>(m, 'coverage').find(
                    (r) => r.label === 'No factors enrolled',
                  );
                  const roster = figure<Counts>(m, 'rosterUnenrolled');
                  if (!gap) throw new Error('reporting: the coverage scan found no unenrolled row');
                  return `${gap.count} of ${roster.total} have no second factor, and clicking the finding hands you the ${roster.shown} people it means.`;
                },
              },
            ],
          },
        ],
      },
    ],
  },
];
