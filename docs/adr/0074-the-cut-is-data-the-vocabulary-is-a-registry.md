# ADR-0074: The cut is data, the vocabulary is a registry

- Status: Proposed
- Date: 2026-09-05
- Amends: [ADR-0053](./0053-a-chapter-is-several-acts-on-one-tab.md). The act structure it
  introduced is untouched; what changes is how an act names the thing it puts on screen,
  and what `script.ts` is therefore allowed to import.
- Relates to: [ADR-0045](./0045-capture-thin-compose-in-react.md) (composition happens in
  React, and nothing in `reel/` is a capture-cache input - both still hold),
  [ADR-0073](./0073-the-reel-speaks.md) (the narration gate reads the cut, and is one of
  the scripts paying the cost this record removes)

## Context

The reel is expensive to change, and the expense is not where it looks. The composition
is 12,150 lines and the capture rig is another 4,000, but neither number is what makes a
session long. Three specific things do, and they share one root.

**The script says it is data, and is not.** `script.ts`'s module doc says "Nothing here
touches the browser." It imports `React`, `./diagrams` and `./showcase`, and builds
elements inline:

```ts
diagram: (m, plot, from) => React.createElement(Ratio, { ... })
```

So a set piece is named by a string id and looked up in `PIECES`, while a diagram - the
same idea, a synthetic visual the script points at - is a closure over a component
identifier. Two mechanisms for one concept, and the one that carries a closure is the one
that makes the file un-evaluable outside a bundler.

**Every build script therefore reads the script as text.** `parse-script.mjs` regexes
`script.ts` because it cannot import it, and once you are parsing text you cannot call
`buildRamp` either, so `ramp-lite.mjs` re-implements its arithmetic with the comment
"This must be updated by hand if buildRamp changes." `pieces-frames.mjs` regexes the
`PIECES` table for the same reason. Three files exist, and a fourth (`actKey`, copied
into `Chapter.tsx`, `vo.ts` and `parse-script.mjs`) is duplicated, entirely because the
cut cannot be read by a program.

**A registry that is hand-mirrored drifts, and has.** `Root.tsx` hand-lists its preview
compositions in a tuple array. `PIECES` currently registers four pieces; the array lists
two of them. `exploded-plates` and `placeholder` have no preview composition, so the two
set pieces a person is most likely to be working on are the two they cannot look at in
isolation. Nothing failed; the list just fell behind, which is what hand-mirrored lists
do.

The through-line: **the vocabulary is half-registered and the cut is half-declarative**,
so tooling cannot read either, so the tooling gets written twice and by hand, so changing
anything means finding every copy.

## Decision

### 1. `script.ts` is data, with no value imports

`script.ts` imports types only. No `React`, no component identifiers, no
`createElement`. A mark that wants a diagram names one:

```ts
diagram: { id: 'ratio', figures: ['unfilled', 'results'] }
```

The four figure shapes declared locally in `script.ts` (`Counts`, `Facet`, `Filter`,
`CoverageRow`) move next to the components that consume them. The script states _what_
the film shows; it does not construct it.

### 2. Everything the script can name lives in a registry

Three registries, one shape - an id maps to what to render and how long it runs:

| Registry   | Holds                                                           | Addressed from    |
| ---------- | --------------------------------------------------------------- | ----------------- |
| `PIECES`   | full-frame set pieces                                           | `PieceAct.piece`  |
| `DIAGRAMS` | enlarged figures and rebuilt product surfaces                   | `Mark.diagram.id` |
| `CARDS`    | the film's furniture: title, premise, seam, overture, panel ink | `Root.tsx` only   |

`DIAGRAMS` absorbs today's `diagrams/` and `showcase/` exports. The two directories keep
their distinction in source - a `Funnel` is a figure, a `RuleBoard` is a rebuilt product
surface, and ADR-0045's honesty rule reads differently for each - but they register
through one table, because a mark does not care which file a visual came from.

### 3. `Root.tsx` derives its compositions; it does not list them

Preview compositions are `.map`ped out of the registries, exactly as chapter
compositions are already `.map`ped out of `SCRIPT`. A registered piece is previewable
because it is registered. There is no second list to keep up to date, which is the only
way the drift already in the file does not come back.

### 4. A verb is one table entry

`VERB_TOTAL` and `VERB_EASE` collapse into a single `VERBS` table with
`VerbName = keyof typeof VERBS`, and `comp/Verbs.tsx` derives its demo matrix from it.
Adding a verb is a component file and one entry, not five edits across three files.

`Count` stays outside `VerbName`. Its roll and settle are two curves over two windows
with a per-column stagger, so it computes its own timeline; forcing it into a table of
single durations would be a lie about what it does. That asymmetry is deliberate and
documented, not an omission.

### 5. Because the cut is data, it is emitted, not parsed

With no value imports, `script.ts` and `ramp.ts` compile and run outside a bundler. The
resolved cut - acts, keys, frame ranges, beats, figures read - is emitted to
`reel/plan.generated.json`, generated and committed under the same contract as
`theme.generated.ts`: a "do not edit" header, a `--check` mode, and a CI assertion.

`parse-script.mjs`, `ramp-lite.mjs` and `pieces-frames.mjs` are then deleted, and
`actKey` collapses to one implementation.

## Consequences

**A new animated component is one file and one line.** Write it, register it, and it is
typed, previewable, and nameable from the script. That is the whole point of this record.

**The gates get more honest.** `vo-budget` and `check-vo` currently price narration
against a hand-mirrored copy of the ramp arithmetic. After this they read the frames the
composition will actually render. A retime that silently desynced the budget from the
picture stops being possible.

**A diagram loses its closure, and that costs something real.** Today a mark can compute
anything it likes from the manifest at cue time. After this it names an id and the
figures to feed it, and any per-mark cleverness has to live in the component. That is a
genuine loss of expressiveness. It is the price of the file being readable by a program,
and the cleverness it forbids is the kind that belongs in a component anyway - a mark
that needs bespoke logic is describing a new diagram, not a new mark.

**The mirroring cost moves before it disappears.** `scripts/lib/cut.mjs` currently
restates `actLengths` and `chapterLength` for the tooling added alongside this record. It
is one file rather than three, and §5 is what retires it. Until §5 lands, the mirror is
real and should be read as debt, not as design.

**`SCHEMA` is still a hand-kept pair.** `capture.mjs` and `captures.ts` each declare it,
and this record does not fix that - it is a value the type system cannot check across a
project boundary. It moves to a single shared constant module both import, so bumping it
is one edit rather than two that fail at render.

**Nothing is re-filmed.** ADR-0045 keeps `reel/` out of the capture fingerprint by
design, so every change here is free of the camera. The render must come out
frame-identical; that is the acceptance test, not a nice-to-have.

## Alternatives considered

**Keep the closures and give the build scripts a TypeScript loader.** The scripts could
evaluate `script.ts` through a bundler and keep `diagram` as a closure. Rejected: it
makes every gate depend on the bundler, adds a dependency the project rule forbids
without its own ADR, and leaves two mechanisms for naming a visual. The closures are the
problem; tooling around them is not a fix.

**Serialize the closures.** Rejected outright - Remotion serializes `defaultProps` to
JSON and silently drops functions, which is the documented reason `PIECES` is an id
registry in the first place. The mechanism this record extends already exists because
this alternative was already tried and already failed.

**Leave `Root.tsx`'s list and just add the two missing entries.** Rejected: it fixes the
instance and keeps the mechanism. The list drifted because it is a list; a third piece
would drift again.
