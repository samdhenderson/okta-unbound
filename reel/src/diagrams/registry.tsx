/**
 * @module reel/diagrams/registry
 * @description Every diagram the script can name, and the figures each one
 * reads.
 *
 * A **diagram** is what the film draws in the plot beside the panel: an
 * enlarged figure (`Funnel`, `Tally`, `Ratio`) or a rebuilt product surface
 * (`FacetBoard`, `FactorLadder`, `RuleBoard`). A mark names one by id.
 *
 * ## Why the diagram reads its own figures
 *
 * A mark used to carry a closure:
 *
 * ```ts
 * diagram: (m, plot, from) => React.createElement(Ratio, { plot, from, ... })
 * ```
 *
 * which is why `script.ts` imported React and six component identifiers while
 * its own module doc claimed nothing in it touched the browser, and why no
 * program could read the cut without a bundler. Every build script therefore
 * parsed the script as text, and once you are parsing text you cannot call
 * `buildRamp` either - which is where the hand-mirrored copy of its arithmetic
 * came from. One closure, four consequences. (ADR-0074 §1.)
 *
 * The prop-building those closures did was real work, though, and it had to go
 * somewhere. It went here: a diagram takes the manifest and reads what it
 * needs. That is the honest split - the script says *which* diagram, the
 * diagram says *what it is made of* - and it is why an entry is a small adapter
 * rather than a bare component reference.
 *
 * ## Two entries may share a component
 *
 * `inactive-ratio` and `sole-ratio` are both a `Ratio`, reading different
 * figures with different labels. They are two diagrams, not one diagram used
 * twice: the film is making two different arguments, and an id per argument is
 * what lets a mark name one without also describing it. Naming them for the
 * argument rather than the component is deliberate.
 *
 * ## The honesty rule still holds here
 *
 * Every number below comes from `figure()`, which throws when a key was never
 * read off the panel on camera. Nothing here may invent a value, and a diagram
 * that wants a number the walk did not record is a walk that needs to record
 * it. (ADR-0045.)
 */
import React from 'react';
import type { FC } from 'react';
import { figure, type Manifest } from '../captures';
import type { Counts, CoverageRow, Facet, Filter } from '../figures';
import type { Rect } from '../layout';
import { FacetBoard, FactorLadder, RuleBoard } from '../showcase';
import { Funnel, Ratio, Tally } from './index';

/* --- The registry --------------------------------------------------------- */

/** What every diagram is handed. */
export interface DiagramProps {
  /** The footage this diagram's figures were read from. */
  manifest: Manifest;
  /** The rectangle to draw into: the plot of whichever stage was current at the cue. */
  plot: Rect;
  /** The absolute composition frame this diagram is cued at. */
  from: number;
}

/** Every diagram a mark may name. */
export const DIAGRAMS = {
  /** Groups: the roster's size, as one enlarged figure. */
  'roster-tally': ({ manifest, plot, from }) => (
    <Tally
      plot={plot}
      from={from}
      entries={[{ label: 'members', value: figure<Counts>(manifest, 'roster').total }]}
    />
  ),

  /**
   * Attributes: the whole board, not one attribute.
   *
   * The claim is about a *set* of dimensions being discovered, so an
   * enlargement of a single spread would argue something narrower than the
   * slide beside it.
   */
  'facet-board': ({ manifest, plot, from }) => (
    <FacetBoard plot={plot} from={from} facets={figure<Facet[]>(manifest, 'facets')} />
  ),

  /** Attributes: two filters stacked, and the population that survives both. */
  'filter-funnel': ({ manifest, plot, from }) => (
    <Funnel
      plot={plot}
      from={from}
      steps={[
        { label: 'members', value: figure<Counts>(manifest, 'rosterBefore').shown },
        {
          label: figure<Filter>(manifest, 'firstFilter').value,
          value: figure<Counts>(manifest, 'rosterFiltered').shown,
        },
        {
          // The panel's own casing. Lower-casing it produced "and employee",
          // which reads as prose rather than as the value the viewer just
          // watched being clicked.
          label: `and ${figure<Filter>(manifest, 'secondFilter').value}`,
          value: figure<Counts>(manifest, 'rosterComposed').shown,
        },
      ]}
    />
  ),

  /** Reporting: the authentication posture, one rung per factor count. */
  'factor-ladder': ({ manifest, plot, from }) => (
    <FactorLadder
      plot={plot}
      from={from}
      rows={figure<CoverageRow[]>(manifest, 'coverage')}
      highlight="No factors enrolled"
    />
  ),

  /** Apps: the inventory against the part of it nobody switched back on. */
  'inactive-ratio': ({ manifest, plot, from }) => (
    <Ratio
      plot={plot}
      from={from}
      before={{ label: 'applications', value: figure<Counts>(manifest, 'inventory').shown }}
      after={{ label: 'inactive', value: figure<Counts>(manifest, 'inactive').shown }}
    />
  ),

  /** Rules: the whole rule set, and how much of it is actually in force. */
  'rule-board': ({ manifest, plot, from }) => {
    const stats = figure<Record<string, number>>(manifest, 'stats');
    const total = stats['Total Rules'] ?? 0;
    return (
      <RuleBoard
        plot={plot}
        from={from}
        total={total}
        active={stats.Active ?? total}
        stats={[
          { label: 'rules', value: total },
          { label: 'active', value: stats.Active ?? 0 },
          { label: 'dormant', value: stats.Inactive ?? 0 },
          { label: 'conflicts', value: stats.Conflicts ?? 0 },
        ]}
      />
    );
  },

  /** Rules impact: the members this one rule is the only thing holding. */
  'sole-ratio': ({ manifest, plot, from }) => {
    const sole = figure<{ heldSolely: number; members: number }>(manifest, 'sole');
    return (
      <Ratio
        plot={plot}
        from={from}
        before={{ label: 'members', value: sole.members }}
        after={{ label: 'held by this rule alone', value: sole.heldSolely }}
      />
    );
  },
} as const satisfies Record<string, FC<DiagramProps>>;

/** A diagram with a component behind it. */
export type DiagramId = keyof typeof DIAGRAMS;

/** Look a diagram up, or fail naming what the film does have. */
export function diagram(id: DiagramId): FC<DiagramProps> {
  const found = DIAGRAMS[id];
  if (!found) {
    throw new Error(`No diagram "${id}". Known: ${Object.keys(DIAGRAMS).join(', ')}`);
  }
  return found;
}
