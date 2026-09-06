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

### 1. `script.ts` names visuals; it does not build them

No `React`, no component identifiers, no `createElement`. A mark that wants a
diagram names one by id:

```ts
diagram: 'inactive-ratio';
```

> **Two corrections, at implementation.**
>
> **It is not "types only".** `script.ts` still imports `figure` from `./captures`,
> because a `points:` entry may be a `(manifest) => string` closure that reads a figure
> to write a line of margin copy. That is a value import and it stays. It costs nothing
> that matters: `captures.ts` is plain TypeScript over JSON with no React and no `.tsx`
> in its graph, so the script remains compilable and runnable outside a bundler, which
> is the property §5 actually needs. "No component imports" is the real rule; "types
> only" was an overstatement of it.
>
> **`{ id, figures }` was too simple.** The sketch above assumed a diagram needs only a
> list of figure keys. The real closures did per-mark work - composing a `Funnel`'s three
> steps from four figures, defaulting a `RuleBoard`'s stats with `??`, labelling a
> `Ratio`'s two sides differently at each of its two call sites. So a mark names an id
> and nothing else, and the diagram reads its own figures off the manifest. Where two
> marks used the same component for different arguments, they became two registry
> entries (`inactive-ratio`, `sole-ratio`), named for the argument rather than the
> component.

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
`VerbName = keyof typeof VERBS`. Adding a verb is a component file and one entry, not two
maps and a union listing the same names.

> **Extended, at implementation.** One table was not enough, because the table was not
> the only place a verb's timing lived. `ease.ts`'s flat `FRAMES` bag held the rest of it
>
> - totals under three different naming conventions (`dockTotal`, `lift`, `fanTotal`)
>   alongside sub-beats (`splitDeltaBarAt`, `fanStagger`, `recedeOpacityWindow`) - and
>   four of the six verbs never called `useVerb` at all, hand-rolling their own clamped
>   `interpolate` against those keys. `Split` did it twice. So the registry moved to its
>   own module, `verbs/registry.ts`, and absorbed **all** of it: total, curve, named
>   sub-windows (`parts`, relative to the verb's own start) and `stagger`, in one entry
>   that cannot be half declared. `FRAMES` survives as a derived _view_ over that table,
>   because 95 call sites across 19 files read it and rewriting them is a large diff whose
>   only gate is that the picture did not move.
>
> `useVerbPart(verb, part, from)` replaces the arithmetic each component was doing
> against those loose keys, which is what removes the class of bug where a window's
> offset is added correctly in one of the two places it appears.

> **Correction, at implementation.** This section originally also claimed
> `comp/Verbs.tsx` would derive its demo matrix from the table. It does not, and the
> claim was wrong. Each row of that matrix is a different component with its own period
> expression - `dock` draws plates, `count` draws digits, `split` opens a pair - so there
> is no uniform body to map over and only the `ROW_STAGGER` index would have been
> derived. Deriving one integer while leaving seven bespoke rows in place is churn in a
> 621-line file that the frame-identity check does not sample. The demo matrix stays
> hand-written, and a new verb adds a row to it by hand.
>
> **Revisited.** The bodies stay hand-written for the reason above, and that is settled.
> What was wrong was concluding that nothing could be done: a row is now addressed as
> `<Row verb="split">` rather than `name="SPLIT"`, its heading derived from the verb
> name, and `check-verbs.mjs` fails a registered verb with no row. Deriving the _body_
> was never the valuable part; making the omission **fail** was, and that needed only a
> machine-readable handle on each row. The same gate also fails a verb the barrel does
> not export, and a `part` scheduled past the end of the verb that owns it.

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

### 6. A set piece's time is a sheet of named cues

A set piece opened with a wall of absolute frame constants - 18 in `ExplodedPlates`, 21
in `Ledger`, 26 in `Unpacking` - and a separate hand-typed total. Every constant is a sum
somebody worked out once, and every **pause is an implicit subtraction that appears
nowhere**: how long the plates stay apart is `CLOSE_AT - SPLIT_AT - 19`. A piece's pacing
was therefore the one editorial quantity in the film that could not be stated, only
recomputed.

`reel/tempo.ts` states the choreography as named cues, each starting where the last
finished, with `gap` in frames (spacing between moves, read against verb budgets of 13 to 26) and `hold` in seconds (the pause an editor asks for, in the language of the cut). The
two units are deliberate: each quantity is written in the unit the person choosing it is
thinking in.

`PieceAct.holds` then lets `script.ts` retune those holds by cue name. The piece states
the pacing it was built at; the cut gets to disagree; neither opens the other's file.
`pieceFrames()` replays the same arithmetic so `Reel.tsx` can size an act at module scope
without asking the component, and `emit-plan` calls the same function so the generated
cut cannot describe a length the film will not render.

**On the frame-count literal.** ADR-0053 and `pieces/index.ts` required a piece's length
to be a bare literal, because `Reel.tsx` resolves every act's length during module
evaluation and `capture()`/`figure()` throw by design - a throw there takes down the whole
bundle rather than the one composition that wanted it. A piece may now export
`SHEET.frames` instead. The rule it relaxes was never "no computation"; it was **"nothing
that can throw."** `tempo()` reads no manifest, no figure and no capture, and takes a
`VerbName` that a typo makes a type error rather than a runtime lookup miss, so there is
no input to it that produces an exception. The original prohibition stands wherever it
was actually aimed.

The sheet also absorbs the `- 1` every piece was carrying against its own total. A verb
starting at `f` reaches its final pose _on_ frame `f + n`, and a piece of N frames renders
0 through N-1, so a piece sized at the cursor never renders the frame its last verb
completes on - the film's last frame kept the object on screen at about 17 percent,
composited over the footage it cut back to. Each piece had rediscovered that by rendering
its last frame. It is accounted for once now, in `tempo()`.

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
