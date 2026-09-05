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

Target: 29.45s (budget ~77 words)

> You already have an id in your hand when you open this panel. Type it, and
> the record is here.
>
> Pin what you keep coming back to, and stop searching for the same person
> twice in a day.
>
> Home does not wait for a question. It already found `figure:unfilled`
> groups nobody is filling and `figure:pausedRules` rule left switched off.
> Every finding opens to the names behind it.

### piece-unpacking-1

Target: 4.50s (budget ~12 words)

_Near silent. The proportion on screen is the argument; one line is enough
to point at it._

> This is what that count is actually made of.

## Users

### users-gap-0 (The gap)

Target: 12.57s (budget ~33 words)

> Onboarding said finished. Nobody checked what finished actually granted
> her.
>
> `figure:groups` groups on her badge, and not the one her own team runs on.
> A checklist would have missed this too.

### users-cause-1 (The cause)

Target: 24.78s (budget ~64 words)

> The fastest way to find what is missing is to stand her next to someone
> the job already works for.
>
> `figure:tallies.groups` groups apart, `figure:tallies.apps` apps,
> `figure:tallies.attributes` attributes. Any tool can count a difference
> like that.
>
> Counting is not the diagnosis. One profile field was typed wrong, and the
> rule reading it has been quietly rejecting her ever since.

### piece-exploded-plates-2

Target: 3.70s (budget ~10 words)

_Near silent. Held side by side, the two plates make the case without help._

> Held side by side, the gap is one character.

### users-fix-3 (The fix)

Target: 21.18s (budget ~55 words)

> Fixing this used to mean a ticket to someone else with database access.
> It is one field, right where you found it.
>
> Before you save, you get to see what saving does. Every rule that reads
> this attribute gets tested against the draft first.

### piece-ledger-4

Target: 4.00s (budget ~10 words)

_Near silent. The piece is still a placeholder in this edit; kept spare so a
reshoot of it never strands a line of narration._

> A prediction, about to become true.

### users-fix-5 (The fix)

Target: 13.47s (budget ~35 words)

> No batch job, no overnight sync. The moment the attribute saved, the rule
> reread it, and her groups went from `figure:groupsBefore` to
> `figure:groupsAfter` before you clicked anywhere else.

## Groups

### groups-0 (The source)

Target: 16.15s (budget ~42 words)

_Near silent. The walk itself refuses a slide over the plain list; the
provenance grouping is the only claim worth a line._

> Provenance the tab already tracks. `figure:roster.total` people, sorted by
> how each one actually got here, not by name.

### attributes-1 (The match)

Target: 42.37s (budget ~110 words)

> Before you write a rule keyed on an attribute, see what this group
> actually varies along. Every dimension it has, discovered, not assumed.
>
> `figure:firstFilter.value` alone narrows `figure:rosterBefore.total` down
> to `figure:rosterFiltered.shown`. Add `figure:secondFilter.value` and you
> are down to `figure:rosterComposed.shown`, the exact population a rule
> targeting both would match.
>
> That is the audit a rule author never runs before shipping the clause.

### reporting-2 (The exposure)

Target: 34.15s (budget ~89 words)

> Deprecating SMS raises one question you cannot answer by looking at the
> group itself: who still depends on it.
>
> The breakdown maps what every member actually has enrolled.
> `figure:rosterUnenrolled.shown` of `figure:rosterBefore.total` have no
> second factor at all.
>
> A finding here is not a slide you close. Click it, and you already have
> the names.

## Apps

### apps-0

Target: 13.88s (budget ~36 words)

_Near silent. A tour chapter with one small, self evident claim; the
toolbar's own count carries the rest._

> An inactive app is not a feature. It is a subscription nobody remembered
> to cancel.

## Rules

### rules-0 (The inventory)

Target: 21.72s (budget ~56 words)

> Automation logic deserves the same inspection as the access it grants.
> This list loads the moment you arrive.
>
> A dormant rule in this list looks identical to one everything still
> depends on. The list alone cannot tell you which is which.

### rules-impact-1 (The consequence)

Target: 32.62s (budget ~85 words)

> Before you switch a rule off, find out what happens to the people it
> placed. This preview writes nothing. It only tells you.
>
> Every member of `figure:target.group` is held by this rule alone. Not
> most of them. All of them.
>
> Deactivate moves nobody. They stay, unexplained, reversibly. Delete is the
> only verb that can remove them, and it does not reverse.

## Export

### export-0

Target: 26.37s (budget ~69 words)

> This is the same finding Home named on the first screen, found again here
> on its own.
>
> `figure:previewRows` rows, joined entirely out of what the panel already
> held before you opened this tab.
>
> A finding, closed out as a file instead of a slide.

## Explorer

### explorer-0

Target: 33.42s (budget ~87 words)

> Some questions this product has no opinion on. That is a direct line to
> Okta, not a dead end.
>
> Same rules the Rules tab renders, fetched live, nothing invented for the
> camera.
>
> The response opens on its shape. Every field, typed, before a single
> value shows.
>
> Proof the data is real, without proof of whose it is. Redacted is the
> default; one click gets you further.
