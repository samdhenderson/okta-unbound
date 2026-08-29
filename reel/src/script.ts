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
 * `compare`, `attributes` and `reporting` are still their own chapters and are
 * still out of rail order. They are the captures waiting to be folded into
 * Users and Groups as acts; until they are, they run where they always did.
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
             * Held back until the id has actually resolved.
             *
             * With no offset this line was on screen while the field still read
             * `00`, so the film asserted what the lookup cost before the lookup had
             * happened. `figure()` guarantees the number came off the panel; it
             * cannot guarantee the frame it is printed over shows it.
             *
             * 530 frames is where the footnote appears, worked from the manifest
             * rather than guessed: the beat opens at 714ms and the read lands at
             * 13401ms, so 12687ms of footage plays at `half` against a retime of 3,
             * which is a rate of 1.5 and 8458ms of composition, or 507 frames, plus
             * the 42 frames of `holdMs` that precede the beat's own footage.
             */
            offset: 530,
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
        capture: 'users',
        plan: [
          { beat: 'search', speed: 'half', easeMs: 300 },
          { beat: 'open', speed: 'half', easeMs: 400, holdMs: 500 },
          { beat: 'groups', speed: 'dwell', easeMs: 400, holdMs: 600, tailMs: 1400 },
        ],
        marks: [
          {
            beat: 'search',
            stage: 'home',
            lines: [{ register: 'note', text: 'Type a few letters. The list narrows as you go.' }],
          },
          {
            beat: 'groups',
            lines: [
              {
                register: 'note',
                text: 'Open someone and the whole panel re-points at them, memberships first.',
              },
            ],
            diagram: (m, plot, from) =>
              React.createElement(Tally, {
                plot,
                from,
                entries: [{ label: 'group memberships', value: figure<number>(m, 'groupCount') }],
              }),
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
    id: 'compare',
    title: 'Compare',
    acts: [
      {
        capture: 'compare',
        plan: [
          { beat: 'subject', speed: 'half', easeMs: 400 },
          // Typing a second name into an empty comparison panel is a wait, not a
          // demonstration. Played fast: the shot is the result, not the search.
          { beat: 'compare', speed: 'natural', easeMs: 500, holdMs: 400 },
          { beat: 'tallies', speed: 'dwell', easeMs: 300, holdMs: 900 },
          { beat: 'memberships', speed: 'half', easeMs: 450, holdMs: 500 },
          { beat: 'worklist', speed: 'half', easeMs: 400, holdMs: 900, tailMs: 2000 },
        ],
        marks: [
          {
            beat: 'subject',
            stage: 'home',
            lines: [
              {
                register: 'claim',
                text: 'Two people who should have the same access, and do not.',
              },
            ],
          },
          {
            beat: 'tallies',
            lines: [
              {
                register: 'evidence',
                text: 'The panel diffs their groups, their apps and every profile attribute at once.',
              },
            ],
            diagram: (m, plot, from) => {
              const t = figure<{ groups: number; apps: number; attributes: number }>(m, 'tallies');
              return React.createElement(Tally, {
                plot,
                from,
                entries: [
                  { label: 'groups differ', value: t.groups },
                  { label: 'apps differ', value: t.apps },
                  { label: 'attributes differ', value: t.attributes },
                ],
              });
            },
          },
          {
            beat: 'worklist',
            stage: 'home',
            lines: [
              {
                register: 'proof',
                text: 'Each app difference is traced back to the group that grants it, so the fix is a membership rather than a guess.',
              },
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
