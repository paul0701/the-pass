# The Pass: Developer Brief (v2)

Written 25 November 2026 for Claude Code. Start from the existing playable client in this repo (index.html, manifest.json, sw.js, icons). Read the whole brief, then work through the "Build order" at the end.

## 1. What it is

The Pass is a single-file HTML5 PWA kitchen game by Paul Jones, an ex-chef (seven years at Sam's Chophouse in Manchester, three to four of them on the meat section). You are the head chef standing at the pass, the hot shelf between kitchen and dining room, running a four hour service from 18:00 to 22:00 compressed into about five and a half real minutes. Tickets print, you fire dishes to the stations, check on them, and send tables out together while the food is still at its best.

Paul's test for everything is "does this feel like a real Saturday night?" The printer noise, the stress and the sense of the night closing in all matter. Paul knows service in his hands. His wife Sarah picked it up cold and was binning plates straight away, which is exactly the gap the Stage mode below is for.

The game is built for phones first. No frameworks, no external assets: vanilla JS and CSS, inline SVG, and every sound generated with the Web Audio API.

## 2. What is already built (do not rebuild, extend it)

### Core loop
A ticket arrives with a table number, a cover count and several dishes. Each dish belongs to a station: grill, pan, larder or fryer (shown as GARNISH in the header, called the fryer in the game). Tap a dish tile to fire it. It cooks, lands in the window as a plate and starts losing quality the moment it is ready. Tap a cooking tile to check on the station and the chef answers in a speech bubble. The pan chef is optimistic and sometimes lies that he is fine, which is the trap. When a ticket has plates ready, a send button appears on that ticket: green for the whole table, amber for a split. A split starts a grace window of about 28 seconds to land the remaining plates. Dead plates have to be binned and refired. Allergy tickets are flagged and punished harder for lateness.

### Layout (the "full board")
Paul's main usability note was that opening one ticket at a time hides the real picture, because a real pass shows everything at once. So:
- A thin strip shows the printer, tickets on the rail, tickets away and the runners (two runners, each busy 6 to 8 seconds per send).
- Every open ticket is shown at once, oldest first, each with a timer, tags (VIP, RUSH, allergy) and a three column grid of dish tiles coloured by station, with live status (FIRE Ns, cooking, quality percentage, HELD, BIN IT).
- Each ticket has its own send button.
- The window at the bottom shows plates with a freshness ring. Tap a plate to select its ticket, tap again to toggle whether it goes out.
- The header station tiles show load and the number of dishes outstanding on each station.

Do not sort the tiles by cook time. Paul rejected that on purpose: reading the ticket and working out the firing order is the skill.

### Stations (real kitchens do not have two hands per section)
A grill can carry eight steaks at different temperatures, and two ducks ordered ten seconds apart go in the same pan. Capacity is generous and only slows when a section is genuinely buried.

| Station | Full speed up to | Hard cap | Notes |
| --- | --- | --- | --- |
| Grill | 6 | 10 | slow decay |
| Pan | 4 | 8 | medium decay, optimistic ETA |
| Larder | 6 | 10 | fast decay, can drop plates early |
| Fryer | 6 | 10 | fastest decay |

Past the full speed number, cook rate is 1 / (1 + slow x (n - free)). The constants live in the ST object near the top of the script.

### Waves and modes
Four waves: Early Doors, Building Heat, The Slam, Last Orders. Spawn intervals in seconds: 11 to 15, 8 to 11, 5 to 8 and 8 to 12. Up to 10 tickets open at once (spawn throttle: open >= 10 or load > 34). Allergies, rush tickets, extra cooking time (XC) and VIPs build through the night.

Three modes: Friday Night (classic), Saturday Night (unlocks at 70 percent on Friday, faster tickets, edgier pan), Christmas Eve (unlocks at 75 percent on Saturday, stretch mode).

### Scoring
Each table is half freshness of plates when they land and half time against a par (par = (45 + 6 x dishes) seconds, rush x0.78, VIP x0.9, walkout at 2.2x par). Splits, refires (10 points each) and walkouts cost points. A dining room satisfaction bar drifts with performance. The service ends with a Pass report: covers, tables away, average ticket time, freshness, clean and awkward splits, dead plates and refires, best streak, star rating.

### Sound and look
Stainless steel and warm amber, off-white paper tickets, monospace type. Procedural sound: thermal printer bursts, paper swipe, tap, ceramic clink, a bell on send, a spike snap, an error buzz. The printer noise should stay slightly unpleasant. Paul says it is half of why a real Saturday gives him stress.

### Technical state
- Save key: localStorage "thepass.save.v1" (best per mode, streak, unlocked, muted, played, seen).
- Hook: window.PASS_HOOKS.onServiceEnd(result) fires at the end of each service with { mode, rating, covers, avgTicket, freshness, clean, awkward, dead, refires, streak, reason }.
- Test API on window.__pass: newGame, update(dt), render, state, fire, check, select, send, bin, endGame, save. Bots built on this scored roughly 75 to 80 (careful) and 55 to 70 (button masher) on Friday. Tune against bots, then trust Paul's own plays over them.
- Service worker is network first and must keep skipping /.netlify/ paths.

## 3. What to build next

### 3.1 The Daily Service (the main goal)
Paul wants The Pass to be a daily game like Wordle. There is no secret to protect, so it can be fully public. Everyone gets the same service, once a day.

1. **Seeded service.** Replace every Math.random in gameplay with a seeded generator keyed to the date (UTC date string). That covers ticket timing, tables, dishes, modifiers, and the random events inside cooking, such as the larder dropping a plate early and the pan chef's false "nearly there". Same seed must give the same night for every player. Keep Math.random only for cosmetic things (sound variation, animation). Add a test that two runs with the same seed and the same bot produce identical results.
2. **One attempt per day, enforced server side.** Not localStorage alone, because that can be cleared. Record the attempt when the service starts, not when it ends, so closing the tab does not give a free retry. Practice and Stage runs stay unlimited and never touch the daily record.
3. **Weekday difficulty.** The difficulty follows the day of the week: gentle Monday, building through the week, a rough Friday, a full Saturday slam, and a Sunday service of its own (a roast service is a good idea, different dish mix). Use the existing modes as the dial rather than inventing new systems. Trim the service to about four real minutes if possible, since five and a half is long for a daily.
4. **Share card.** Wordle style, no spoilers needed. One coloured square per table in order (green clean send, amber split, red walkout or refire), then the percentage and star rating and the date. Copy to clipboard and use the Web Share API where available. Example:
   `The Pass #12 (Fri) 84% ★★★★☆` followed by rows of squares.
5. **Daily leaderboard and streaks.** Per day and all time, plus a streak of consecutive days played.

### 3.2 Accounts and sync (standing requirement for every Paul game)
Every Paul game is a PWA with an online leaderboard on Netlify functions and Netlify Blobs, with cross-device progress through a name and PIN account: best scores, unlocks, trophies and settings follow him between devices. **Copy the pattern from the Guess the Opening repo**, which is a live daily game with the same needs: one puzzle per day for everyone, accounts, leaderboard and share result. Use the Rum to Riches repo as a second reference for the persistent account side. Reuse their function structure, Blobs layout, name and PIN handling and rate limiting instead of inventing new ones. Hook everything into PASS_HOOKS.onServiceEnd.

### 3.3 The Stage
Mode name: **Stage** (pronounced "stahj"). In a real kitchen a stage is an unpaid placement where you work somewhere good for weeks or months so the chefs will teach you the trade. It is not a trial and not a test. In the game it is a teaching mode: you are the new stagiaire, and the head chef talks you through it live.

- A series of short guided services, each adding one skill: reading a ticket, firing in the right order (long cooks first), checking the pan, binning and refiring, splitting a table, then a proper rush.
- The head chef speaks in short, blunt, in-service lines through the existing speech bubble system. Encouraging but never soft.
- Learning is by doing: start playing in seconds, introduce detail as it becomes relevant, no tutorial wall of text. (Paul learns top-down and switches off at granular foundations.)
- Each stage can end with a short chef's verdict.
- Stage runs are unlimited and unscored on the leaderboards. Passing the stages can be what opens up the daily service for new players, but never lock Paul out of anything.
- Replace the current dense how-to paragraph on the start screen with this.

### 3.4 Support the Burnt Chef Project
Paul wants a separate, respectful section supporting The Burnt Chef Project, a UK charity (a Community Interest Company) giving free, confidential mental health support to hospitality workers worldwide, because people in high pressure kitchens suffer.
- Link straight to their site (theburntchefproject.com) for donations. Do not take money, add affiliate codes or handle donations in the game.
- Never in the way of gameplay. Put a short line on the Pass report, for example "If you enjoyed this, please consider supporting the people who live this for real", and give it its own small page from the menu with a short note from Paul about why it matters.
- Add a plain line pointing hospitality workers to the free support the charity offers, not just the donate link.
- State on the page that the game is independent and not affiliated with the charity. Paul will contact them before launch to ask permission to use their name and for any preferred wording. Keep the content easy to change.

### 3.5 Smaller items
- Paul found the Slam brutal ("PTSD") but also said it is exactly how a Saturday feels. A proposal to ease Friday while keeping Saturday as the real thing is on the table, not confirmed. Do not change difficulty without checking with him.
- Weighting tickets so nearly every table carries a grill dish (meat is the most stressful section) is also unconfirmed.
- If ten open tickets scroll too much on a phone, make the tickets more compact. Do not add auto-sorting.

## 4. Rules

- No em dashes anywhere in the game text, copy, comments or commit messages. Paul never wants them.
- Kitchen speech should sound like real chefs: short, blunt. Swearing is implied, not spelled out.
- Free to play. No pay-to-skip, no paid anything.
- Keep it pick up and play on any device.
- Test on a phone viewport. Paul plays on an Android phone.
- Ask Paul before changing difficulty, scoring or the feel of the service. He is an ex-chef and will notice immediately.

## 5. Build order

1. Put the existing client in the repo as it is, check it deploys on Netlify as a PWA.
2. Seeded RNG and the determinism test.
3. Daily endpoint with server side one attempt rule, copying the Guess the Opening function pattern.
4. Name and PIN accounts, daily and all time leaderboards, streaks.
5. Share card.
6. Weekday difficulty and trimming the service length.
7. Stage mode.
8. Burnt Chef page, after Paul has heard back from the charity.
