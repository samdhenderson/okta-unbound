# ADR-0072: The lane is the budget, not the shape of the work

- Status: Accepted (2026-09-03)
- Date: 2026-09-03
- Extends: [ADR-0070](./0070-a-slot-per-bucket-and-a-bucket-that-stays.md), which made a
  bucket's row persist and fixed what a remembered row is allowed to say
- Relates to: [ADR-0059](./0059-one-bucket-is-not-the-org.md) (one bucket is not the
  org), [ADR-0060](./0060-declared-work-is-inventory.md) (the plan ledger the lane's
  dashed segment draws), [ADR-0008](./0008-activity-bar-and-cancellation.md) (the bar's
  no-reflow contract), [ADR-0022](./0022-test-lifecycle.md) (how the retargeted
  assertions were handled)

## Context

The activity bar's bucket rack shipped on the design program branch without the
visual design return in hand. The kickoff brief was explicit that no UI code for
that item should land until the matching return was approved; the return was not
in the repo, and the rack was built from a one-line brief plus a commit note. It
came out wrong in one way that matters more than the cosmetic ones.

### The track measured the wrong thing

`BucketRow`'s fill was:

```ts
const share = (n: number) => (work > 0 ? `${(n / work) * 100}%` : '0%');
```

where `work = active + queued + planned`. The segments were shares **of each
other**. So the track was full whenever anything was running — four requests
against an untouched quota drew the same picture as four hundred against an
exhausted one — and the only quantity a reader can act on, headroom, appeared as
a `480/600` text pair riding on top of the bar.

That is a bar that cannot answer the question the rack exists to ask. ADR-0059
split the rate-limit surface per family precisely so a reader could see _which_
family is the one about to gate. A fill normalised to its own contents is
invariant to the budget; stacking twelve of them side by side compares nothing.

The design's sentence was the opposite: _"The bar is the bucket's remaining
rate-limit budget; active requests fill from the left in solid indigo, queued
work continues as a dashed extension, and the pale remainder is headroom."_

### Two filters answering a question the scheduler had already answered

The rack also filtered. First to buckets under strain; then, once ADR-0070 gave a
bucket ten minutes of memory, to strain **or** recent use (`deservesTrack`), with
a six-lane cap and the remainder collapsed onto a `3 buckets idle · meta, zones`
line.

Both filters restated a decision that had already been made one layer down.
`buildBucketStates` emits a lane only for a family that has been observed, has
work against it, is planned for, or settled a request inside the memory window,
and ADR-0070 §5 bounds that at twelve with LRU eviction. Filtering the result
again meant the view answered a second, differently-shaped question — and the two
answers disagreed at the worst possible moment, because **a bucket stops being
strained on its last settle**, which is the exact instant the memory exists to
cover. The strain clause had to be patched with a recency clause to stop it
deleting the row ADR-0070 had just decided to keep. That patch is the smell: the
filter was fighting the retention policy rather than rendering it.

## Decision

**The lane's track is scaled to the bucket's `remaining` budget, and the rack
renders every bucket the scheduler publishes.**

### 1. The denominator is `remaining`, not `limit`

```
den      = remaining                      // null ⇒ no scale is drawn at all
running  = min(active / den, 1)
queued   = min((queued + planned) / den, 1 - running)
headroom = 1 - running - queued           // the pale tail
```

`remaining` rather than `limit` because of the question being asked. Scaled to
the full quota, the lane answers "how much of this window is already gone" —
which is history, and which the reader cannot act on. Scaled to what is left, it
answers "will the work I have queued fit in what I have", which is a decision.

**Saturation is a feature, not an overflow to guard against.** When the declared
work exceeds `remaining`, the two segments consume the whole track and the pale
tail disappears. That is the lane saying _this will not fit_ — before the
cooldown says it, and early enough to cancel. Clamping is therefore part of the
design, not defensive arithmetic: the segments are clamped so they always sum to
exactly the track, and the vanished tail is the signal.

A `remaining` of zero or less yields **no denominator**, not a zero one. An
exhausted bucket has no room to draw work against, and dividing by it produces
`Infinity`, which compares false against every clamp and would render as calm —
the same class of defect `percentRemaining`'s guard removed in D-094.

### 2. Queued and planned are one segment on the track and two words on the line

The track answers "how much is coming"; the label line answers "how much of it is
committed" (ADR-0060's declared-but-unenqueued work). Splitting the track into
three fills would need a third tone in a family that has already spent its tonal
room on solid-versus-dashed, at eight pixels tall. Words carry the distinction
because words carry it better here.

### 3. A lane with no budget reading draws no scale — and says so with a form of its own

This is where ADR-0070 §6 binds. A remembered-idle bucket and a never-observed
bucket both report `limit`/`remaining`/`resetAt` as `null`, and _"the retained
thing is the row's existence, never a number."_ A lane that computed a fill from
work alone when the budget was unknown would be exactly the defect that section
forbids, arrived at from a new direction.

So there are four mutually exclusive forms, and two of them draw nothing:

| Form                    | Track                   | Words                   |
| ----------------------- | ----------------------- | ----------------------- |
| gated                   | cooldown hatch, whole   | `cooling down · 24s`    |
| working, budget known   | running → queued → tail | `4 running · 61 queued` |
| working, budget unknown | faint hatch, whole      | `2 running · 8 queued`  |
| at rest                 | empty                   | `at rest · 40s ago`     |

The unknown-budget form gets a hatch of its own rather than simply drawing
nothing, and the reason is worth stating: an empty track beside the words "4
running" reads as a _bug_, not as an absence. The hatch says "there is no reading
here" in a form distinguishable from both the solid fills and the empty at-rest
ground, without saying anything about magnitude, because there is nothing to say.
This is the one place the design return was extended rather than followed, and it
was extended to keep ADR-0070's guarantee rather than to add decoration.

### 4. No lane prints a `remaining/limit` pair

The track carries the budget; the exact figures move to the track's accessible
name (`role="img"` + `aria-label`), where precision is available to anyone who
wants it and to every screen reader, without a number competing with the shape it
duplicates. `budget not reported` is what that name says when there is no
reading — never a resurrected figure, and never `0/0`.

### 5. The rack shows every published bucket

No `deservesTrack`, no `maxRows`, no summary line. A lane appears when the
scheduler starts tracking a bucket and disappears when the scheduler forgets it,
on one clock, decided in one place. `isStrained` and `deservesTrack` are deleted
with their only consumer.

Height is bounded by **scrolling, not truncating**. Truncating would reintroduce
the filter one layer down, and the summary line it fed had the same defect the
rest of this record is about: it hid a busy bucket behind prose a reader has to
expand something to resolve. The expanded tree is opt-in on a panel this narrow —
`ActivityBar` collapses below 640px and a Chrome side panel is about 400px — so a
reader looking at the rack asked for it.

### 6. The header keeps what the rack cannot say, and drops what it can

`ActivitySummary`'s `Queue · Rate · ETA` line is removed. `Rate` was a single
org-wide `remaining/limit` pair standing in for a per-family quantity, which is
the confusion ADR-0059 exists to end; every lane now draws its own. `Queue` is
the sum of the lanes' queued segments. `ETA` moves to the header's right-hand
standing slot, which also carries the cooldown countdown and, when nothing is
running, the number of buckets the rack is accounting for.

The `N done · N active` breakdown goes for the same reason the **Active** metric
tile went before it: `done` is `current / total` restated, and `active` is a
scheduler-internal that changes several times a second and that every lane draws.
`N failed` stays, because a failure is the one thing in that cluster a reader has
to act on.

## Consequences

- **The rack can now be compared across families, which was its entire premise.**
  Twelve tracks with a common meaning are a chart; twelve self-normalised fills
  were twelve unrelated bars sharing a column.
- **The lane can be wrong in a new way, and the guard is arithmetic rather than
  judgement.** A budget-scaled track is only as good as `remaining`, so a stale or
  absent reading must produce _no scale_ rather than a plausible one. That is
  enforced by `budgetDenominator` returning `null` for anything non-positive or
  unreadable, and by two of the four forms drawing nothing at all.
- **The idle bar is taller than it was, deliberately.** Every tracked bucket keeps
  a two-line lane for ADR-0070's ten minutes. This was already flagged as an open
  question on the design program PR; it is now the accepted answer, mitigated by
  the rack scrolling and by the expanded tree being opt-in at panel width.
- **`ResetTimeline` is now largely redundant.** Every gated lane carries its own
  countdown and every lane is always visible, so the shared axis restates what the
  rack already shows. It is left in place and filed rather than removed here —
  one concern per change, and its removal is not this record's decision.
- **Assertions were retargeted, not weakened (ADR-0022).** `BucketList.test.tsx`
  lost its `isStrained`/`deservesTrack` suites because both functions are deleted;
  the NaN-guard cases they contained were **kept** and moved onto `activeAt`'s
  surviving behaviour, since that guard is the D-fix for `last active NaNh ago`
  and is untouched by this change. `ActivityBarView.test.tsx`'s three slot-id
  assertions were pointed at the header's standing slot and at the lanes that
  replaced them, and `ActivityBar.test.tsx`'s three waits on the `Queue` slot were
  pointed at Cancel-enablement — the precondition those cases actually needed. A
  new `BucketRow.test.tsx` asserts the geometry directly.
- **The geometry is proved by unit assertions, not by stories.** Widths are inline
  styles specifically so a jsdom test can read them: the headless story runner
  loads no Tailwind, so a class-based fill would be invisible to every gate in the
  ladder and a green story would be evidence of nothing.
- **No scheduler behaviour changes.** This record is entirely presentational.
  `BucketState` is unchanged, no new field crosses the worker boundary, no message
  action is added, and the rate-limit surface is untouched.

## Alternatives considered

**Scale to `limit`, with the org's warning threshold marked as a tick.** The
richest option: a dark leading zone for already-consumed budget, the work drawn
into what remains, and a tick where the scheduler starts backing off — which
would have made ADR-0059 §3's org-learned threshold visible for the first time.
Rejected for now because it answers "how much of the window is gone" as its
primary reading, and because it needs four zones plus a tick where the design has
three. The tick remains placeable on a remaining-scaled track — at
`(remaining − limit × low/100) / remaining` — if surfacing the threshold is ever
wanted on its own merits.

**Keep the work-composition fill and only restyle.** The smallest diff, and it
leaves the central defect exactly where it was: a bar that reads full against an
untouched quota.

**Draw a work-composition fill only when the budget is unknown.** Tempting as a
fallback for cold start, and rejected outright: it gives one geometry two
incompatible meanings, distinguishable only by a `null` the reader cannot see.
That is precisely the "a memory must never pass for a reading" failure with the
words changed.

**Keep the lane cap and scroll nothing.** Rejected with the filter it belongs to.
A cap is a filter that has stopped explaining itself, and the summary line it
requires hides the busy bucket a reader is looking for.
