# The advertisement

A twenty eight second cut for the Chrome Web Store listing. It is **not** part of
the film: separate entry point, separate compositions, no captures, no
narration gate. Everything here is synthetic.

## Where it lives

| Thing                   | Where                               | Notes                                                      |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------- |
| The cut                 | `src/ad/script.ts`                  | Twelve shots, their holds, and where the sound lands       |
| A shot                  | `src/ad/stabs/<Name>.tsx`           | One idea, one to three seconds, its own tempo sheet        |
| The registry            | `src/ad/stabs/index.ts`             | `STABS`, and the preview compositions derived from it      |
| The rebuilt panel       | `src/ad/ui.tsx`                     | The product's surface, measured off the captures           |
| How a shot is presented | `src/ad/stage.tsx`                  | The dark ground, the tilted plate, the camera push, supers |
| Sound                   | `sfx.json` + `scripts/make-sfx.mjs` | ffmpeg synthesis, no samples, no licences                  |
| The entry point         | `src/ad-entry.ts`                   | Why it is separate: see `AdRoot.tsx`                       |

## Commands

```
npm run ad:look -- --list              what exists, and how long each shot runs
npm run ad:look -- stab-compare --sheet    a contact sheet of one shot
npm run ad:look -- stab-compare 40     one still, 40 frames in
npm run ad:draft                       the whole cut, cheap, with sound
npm run ad                             the delivery encode, 2560x1440
npm run sfx                            (re)synthesise the sound effects
npm run sfx:check                      fail if a WAV is missing or the wrong length
```

**Run `npm run sfx` once after a fresh clone.** `captures/` is gitignored, so the
WAVs are build output. A sound the generator has not written renders silent
rather than failing, which is deliberate: an ad being cut should not be blocked
on being scored.

## The rules this cut is held to

- **Nothing invented inside the panel.** Everything on the product's surface is
  something the product actually renders. The advertisement's own voice lives on
  the dark stage, in the supers, where it is obviously the ad talking. A first
  cut had a sentence of ad copy set inside a product card; that is the one thing
  a rebuilt UI must never do.
- **Never mistakable for a screenshot** (ADR-0045, rule 4). The panel is always
  tilted, lit, pushed past life size, and acted on by verbs. If a shot could be
  screen-captured as-is, it is wrong.
- **Fake data only.** The demo fixture's own names and ids, and the repo's
  placeholder convention: `00uFAKE...`, `Amara Okonkwo`, `user@example.com`. No
  real org, no real id, and no measured claim about anybody's tenant.
- **No dashes.** Em and en dashes are banned on screen, same as the film
  (ADR-0043); `check-verbs.mjs` scans this project too.
- **Sound is cued on cue names, never frames.** `{ cue: 'mark', sound: 'impact' }`
  resolves through the same sheet the picture draws from, so a retimed hold moves
  both.

## Narration

Optional. The cut is built to work muted, because most store page views are.
If it is voiced, one line per shot, read against the shot's own length from
`npm run ad:look -- --list`. Suggested read, about seventy words:

**hook** ~ "Who has this? What reads that field? Why did they get it? Six tabs later, you are still guessing."

**arrive** ~ "This opens beside the Okta tab you already have open."

**arrange** ~ "Twenty five fields. Group them, reorder them, hide the ones you never read."

**why** ~ "Every row says how it got there."

**compare** ~ "A rule reads a profile field. Theirs was mistyped by one character."

**weigh** ~ "Three group rules read that one field. Now you know what you are touching."

**predict** ~ "Before you switch a rule off, see exactly who falls out."

**blast** ~ "And before you save a value, see which groups it moves."

**fix** ~ "Fix it in place. The rule rereads it on save."

**prove** ~ "And the evidence walks out as a file."

**trust** ~ "No telemetry, no account to create, and your own Okta session is the only credential."

**end** ~ "Okta covers the basics. Unbind and discover more. Who, what, why, then take action."

Narration for the ad does **not** go in `NARRATION.md` and is not measured by
`check-vo.mjs`: that gate is per film act and would report twelve of these as
missing recordings forever. If the ad is ever voiced, it gets its own measured
map, the same way the film got `vo.generated.ts`.
