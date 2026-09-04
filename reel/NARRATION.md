# Narration

The recording script for the demo reel's voiceover. Sam reads this aloud; this
file states what to say and roughly how long the picture gives it, and
`captures/vo/` is where the WAVs land.

## House rules

- **No figure is written down.** `SCRIPT.md`'s rule for the film's own
  captions holds here too: a spoken number names a `figure()` key instead of
  a digit typed by hand, so a line stays true after a re-shoot changes the
  count. Write a figure reference inside backticks as `` `figure:KEY` `` (a
  dotted path for a figure that reads as an object, e.g. `` `figure:tallies.groups` ``)
  and read the number the capture actually measured when you record. Every
  other digit is banned outright: `check-vo.mjs` scans every spoken line (the
  `>` blockquote lines below, not the headings or the target-duration notes
  above them) and fails on any digit that is not sitting inside a
  `` `figure:...` `` reference.
- **No em dash or en dash.** They read as a hitch in the voice as much as a
  kern problem on screen. Use a comma or a full stop instead.
- **One WAV per act**, mono, 48kHz, named `captures/vo/<act-key>.wav`. The
  act key is exactly the heading below (`home-0`, `users-gap-0`, ...): the
  same string `actKey()` in `src/comp/Chapter.tsx` computes for that act, so
  the file lands on the right `<Series.Sequence>` automatically.
- **Target durations are `TBD` until you run the budget.** `npm run
reel:vo:budget` derives them from `SCRIPT`'s current timing and the shoot's
  own manifests, so a retime moves the number here rather than leaving it
  stale. Fill the `Target:` line in by hand from that output; it is not
  parsed back out of this file.
- Read to the target, not past it. `check-vo.mjs` fails a recording whose
  measured length runs long against the picture it is laid under. The film
  does not wait for narration; the narration has to fit the film.

---

## Home

### home-0

Target: TBD

> TBD

### piece-unpacking-1

Target: TBD

> TBD

## Users

### users-gap-0 (The gap)

Target: TBD

> TBD

### users-cause-1 (The cause)

Target: TBD

> TBD

### piece-exploded-plates-2

Target: TBD

> TBD

### users-fix-3 (The fix)

Target: TBD

> TBD

### piece-ledger-4

Target: TBD

> TBD

### users-fix-5 (The fix)

Target: TBD

> TBD

## Groups

### groups-0

Target: TBD

> TBD

## Apps

### apps-0

Target: TBD

> TBD

## Rules

### rules-0 (The inventory)

Target: TBD

> TBD

### rules-impact-1 (The consequence)

Target: TBD

> TBD

## Attributes

### attributes-0

Target: TBD

> TBD

## Reporting

### reporting-0

Target: TBD

> TBD
