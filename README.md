# The Pass

A daily kitchen service game. You are the head chef at the pass on a four hour service squeezed into about four
real minutes: tickets print, you fire dishes to the sections, check on them, and send each table out together while
the food is still at its best. Everyone gets the same service each day, once, then shares their card. Like Wordle,
there is no leaderboard: just your result, your streak and your stats.

Single-file HTML5 PWA (vanilla JS, inline SVG, Web Audio). Backend is Netlify Functions plus Netlify Blobs,
following the Guess the Opening (daily) and Rum to Riches (name and PIN accounts) patterns. See `docs/BRIEF.md`.

## Accounts are optional
Guests play exactly like Wordle: one go a day, streak and stats kept on the phone. Signing in with a name and PIN
is optional. It makes the one-go rule hold across browsers and devices, and carries the streak, stats, best scores,
unlocks, Stage progress and settings between devices.

## What's in it

| Mode | What it is |
| --- | --- |
| Daily Service | Same seeded service for everyone, keyed to the UTC date. One attempt, recorded when the service **starts**. Share card, streak of days played, and a Wordle-style stats screen (played, average, streaks, star rating chart). |
| The Stage | Six short guided services. The head chef talks you through one skill at a time: reading a ticket, long cooks first, checking the pan, bin and refire, splitting a table, then a proper rush. Ends with a chef's verdict. Never scored on a leaderboard. |
| Practice | The original Friday Night, Saturday Night and Christmas Eve modes, unlimited, full five and a half minutes. |

### Weekday difficulty
The daily uses the existing mode dials (`int`, `rush`, `pan`). Edit `shared/daily.js` **and** the inline copy in
`index.html` (a test fails if they drift).

| Day | Feel | Dials |
| --- | --- | --- |
| Mon | Quiet Monday | gentler than Friday Night practice |
| Tue | Tuesday | |
| Wed | Midweek | = Friday Night |
| Thu | Thursday Push | |
| Fri | Friday Night | = Saturday Night mode |
| Sat | Saturday Slam | = Christmas Eve mode |
| Sun | Sunday Roast | roast menu, about Wednesday pace |

The daily service runs 240 real seconds (practice keeps 330). `LAUNCH` in the same files sets day #1.

## Layout

```
index.html                    The whole game. Online layer is the "online:" section near the bottom.
sw.js                         Network-first service worker. Never touches /.netlify/ or /api/.
manifest.json, icon-*.png     PWA
shared/daily.js               Daily calendar: LAUNCH, weekday table, day numbers
shared/pin.js                 PIN rules (from Rum to Riches)
netlify/functions/api-auth.js      POST /api/auth      register, login, logout (name + PIN)
netlify/functions/api-daily.js     GET/POST /api/daily today's service, your status and stats; start (one attempt) and finish
netlify/functions/api-progress.js  GET/POST /api/progress  best scores, unlocks, Stage, settings across devices
netlify/lib/                  http, store (Blobs), auth (scrypt PIN, sessions, lockout, rate limits), names, score, progress
tests/                        node --test suites, plus devserver.mjs for local play
```

### Blobs layout (store `the-pass`)
- `player:<id>` account: name, PIN hash, sessions, synced progress, daily stats and streak
- `daily:<date>:<id>` one attempt, created with `onlyIfNew` at the start of the service
- `limit:<kind>:<hash>:<hour>` rate limit counters

No environment variables are needed. Blobs is configured automatically on Netlify.

## Determinism
Every gameplay roll uses a seeded generator keyed to the service seed plus a purpose (`ticket|n`, `fire|dish|n`,
`check|dish|n`, `run|n`), so the tickets are the same whoever is playing and the same actions always give the same
result. `Math.random` is only used for sound and cosmetic speech. `tests/determinism.test.js` proves it by running
bots on the real page with a different fake `Math.random` each run.

## Running locally

```
npm install
npm test                      # API, calendar and determinism tests (determinism needs Playwright)
node tests/devserver.mjs      # play on http://localhost:8899 with working accounts
```

## Deploying
Connect the repo to a Netlify site. Build command and publish folder come from `netlify.toml`; no build step.

## Support the Burnt Chef Project
Built but switched off: set `CHARITY.enabled = true` in `index.html` once the charity has given permission.
All wording (Paul's note, support line, disclaimer, report line) lives in that one object.
