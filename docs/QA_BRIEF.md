# The Pass: QA test brief

You are testing **The Pass**, a daily kitchen service game, before and during its public beta. Play it like a real
player on a phone, try to break it, and report what you find. Do not change any code.

- Live site: https://the-pass.agnosticsolutions.co.uk
- Code: https://github.com/paul0701/the-pass (public). `README.md` explains the layout, `docs/BRIEF.md` the original design.
- Made by Paul Jones, an ex-chef (almost two decades, including Hawksmoor, Sam's Chophouse and the Moss Nook).
  His test for everything: "does this feel like a real Saturday night?"

## The game in one paragraph
You are head chef at the pass. Tickets print with a table number and dishes. Tap a dish to fire it to its station
(grill, pan, larder, fryer). Tap a cooking dish to ask the chef how long (the pan chef is optimistic). Cooked plates
land in the window at the bottom and cool every second. When a table's plates are up, tap SEND (green) or SPLIT
(amber, sends what's ready; you then have about 28 seconds to land the rest). Dead plates must be binned and refired.
**The core skill is running many tickets at once.** The Daily Service is the same night for everyone, once a day,
then you share a Wordle-style card. Practice and the Stage (guided lessons) are unlimited.

## Ground rules (important)
1. **Do not create accounts on the live site.** Sign in / sign up writes to the real database. Test accounts only on a
   local copy (see "Local copy" below).
2. Playing the live daily **as a guest** is fine: a guest result stays in that browser only. Use a fresh browser
   profile or private window each time.
3. Phone first. Test at a phone size (for example Pixel 7, 412x915, or iPhone 13). Paul plays on Android Chrome.
4. Report facts with steps to reproduce. Screenshots help.

## How to test
**If you are Claude Code:** Chromium and Playwright are usually pre-installed. Use
`devices['Pixel 7']`. The page exposes a test API on `window.__pass`:
`state()`, `newGame(mode, opts)`, `update(dt)`, `render()`, `fire(dish)`, `check(dish)`, `sendTicket(ticket)`,
`bin(dish)`, `help(stationKey)`, `endGame(reason)`, `headless(true|false)` (stops the real-time loop so you can step
`update` yourself), `dailyInfo(date)`, `shareText(result)`, `receiptCanvas(result)`, `save()`.
Prefer real taps for anything a player touches; use the API only to fast-forward long services.

**If you control a browser by clicking:** just play it. A full daily is about 4 to 5 minutes.

**Local copy (for accounts and anything that writes data):**
```
git clone https://github.com/paul0701/the-pass && cd the-pass && npm install
node tests/devserver.mjs      # http://localhost:8899, real functions on a throwaway database
npm test                      # the existing 23 tests should pass
```
On the local copy, `GET /__skew?s=300` moves the server clock forward 300 seconds (lets you finish a daily without
waiting the minimum time).

## Checklist
### First visit
- [ ] Fresh browser: dark "Tap to start service" screen appears. Tapping plays the kitchen intro (about 7 seconds,
      sound), then the start screen. SKIP and tapping anywhere both skip it.
- [ ] Reload: the intro does not play again. Practice menu has "Watch the intro".
- [ ] Start screen: big Daily card (PREVIEW before 29 Nov 2026, then Daily #1, #2...), "First time on the pass? Try the
      Stage", Stats, Sign in, "Practice & the Stage" link. Nothing overlaps; nothing hidden under the "Powered by
      Netlify" badge in the bottom right.

### Daily Service (guest, live site)
- [ ] START SERVICE opens the intro card with "How it works", then START THE SERVICE begins the service.
- [ ] Play a full service. Then try to start the daily again in the same browser: it must refuse (one go a day).
- [ ] Report: score, stars, coloured squares (green = went well, including clean splits; amber = awkward split or a
      ticket well over time; red = walkout or refire), the chef's verdict, "What cost you" (when something did).
- [ ] SHARE text is correct and has no spoilers beyond the squares. SAVE AS IMAGE produces a readable receipt picture.
- [ ] STATS: played, average, streaks, star chart, countdown to the next service.
- [ ] Leave mid-service (pause, LEAVE THE PASS): it counts as your go, and the start screen says so.
- [ ] After 22:00 on the game clock the kitchen keeps serving until the rail is clear; tables are not cut off.

### New player experience (this matters most)
- [ ] Play like someone who has never worked in a kitchen. Is it obvious you can fire more than one ticket at a time?
      (A real tester did not realise this.) In the first few services, the head chef should nudge you in the speech
      bubble if a ticket sits untouched while another cooks.
- [ ] Play all six Stage lessons. Does each one teach its skill? Are the chef's lines clear and short?
- [ ] Where did you get confused? Where did you feel punished unfairly? What felt good?

### Practice
- [ ] Practice menu: the Stage, Friday Night, then Saturday Night and Christmas Eve (locked until you score 70% on
      Friday and 75% on Saturday). GO AGAIN works from the report.
- [ ] Larder helping out: when the larder has nothing cooking, tap a buried station tile. It should glow
      "+larder 15s", larder should show "on grill" (or similar), larder dishes cannot be fired meanwhile, 2 per service.

### Accounts (LOCAL COPY ONLY)
- [ ] Sign up with a name and PIN, sign out, sign in. Wrong PIN five times locks the name for 15 minutes.
- [ ] Signed in, the daily is one go per day even after clearing the browser or using a second browser.
- [ ] Stats and streak follow you to a second browser.

### Robustness
- [ ] Rotate the phone, resize, switch tabs mid-service (it should pause), turn sound off and on.
- [ ] Watch the browser console for errors throughout.
- [ ] Slow or no network: the game should still load (it is an installable app) and say clearly when it cannot reach
      the server.

## House rules to check while you play
- No em dashes anywhere in the game's text.
- Kitchen speech should sound like real chefs: short and blunt. Swearing is implied, not spelled out ("bloody" is
  Paul's own choice in some end-of-service comments and is fine).
- Nothing paid, no pay-to-skip.

## How to report
Group findings into:
1. **Broken**: things that do not work. Steps to reproduce, what you expected, what happened, device size, screenshot.
2. **Confusing**: where a new player would get stuck, with your best guess why.
3. **Feel**: difficulty, pacing, stress, fun. Give your score per service and what it felt like.
4. **Small stuff**: typos, layout, overlaps, sounds.

Keep each point to a few lines. Do not suggest big new features unless something is clearly missing for launch.
