// Same seed + same bot = identical service. Runs the real index.html in headless Chromium through window.__pass.
// Needs Playwright (pre-installed in Claude Code cloud sessions; locally: npm i -D playwright && npx playwright install chromium).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { /* skipped below */ }
const page_url = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
let browser, page;

before(async () => {
  if (!chromium) return;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.goto(page_url);
  await page.evaluate(() => window.__pass.headless(true));
});
after(async () => { if (browser) await browser.close(); });

// Runs one whole service in the page. bot: "careful" | "masher". noise: seed for a fake Math.random,
// so two runs with different cosmetic randomness must still match exactly.
const run = (opts) => page.evaluate(({ seed, bot, mode, daily, noise }) => {
  const P = window.__pass;
  const realRandom = Math.random;
  const nr = P.seeded("noise|" + noise);
  Math.random = () => nr();
  try {
    P.newGame(mode ?? 0, daily ? { kind: "daily", daily: P.dailyInfo(daily) } : { kind: "practice", seed });
    const G = P.state();
    const step = 1 / 20;
    let next = 0;
    while (!G.over && G.t < 900) {
      P.update(step);
      if (G.t < next) continue;
      next = G.t + 0.25;
      const open = G.tickets.filter((t) => !t.done);
      for (const t of open) {
        for (const d of t.dishes) if (d.dead) P.bin(d);
        const live = t.dishes.filter((d) => d.state === "unfired" || d.state === "cooking");
        if (bot === "masher") {
          live.forEach((d) => d.state === "unfired" && P.fire(d));
          if (t.dishes.some((d) => d.state === "plated" && !d.dead)) P.sendTicket(t);
          continue;
        }
        const land = Math.max(0, ...live.map((d) => (d.state === "cooking" ? d.rem : d.base)));
        for (const d of live) if (d.state === "unfired" && d.base >= land - 1) P.fire(d);
        const plated = t.dishes.filter((d) => d.state === "plated" && !d.dead);
        const waiting = t.dishes.filter((d) => d.state === "unfired" || d.state === "cooking" || d.dead).length;
        if (plated.length && (!waiting || plated.some((d) => d.q < 45))) P.sendTicket(t);
      }
    }
    const r = G.result || {};
    return { rating: r.rating, grid: r.grid, covers: r.covers, dead: r.dead, refires: r.refires, clean: r.clean,
      awkward: r.awkward, avgTicket: r.avgTicket, t: G.t, log: G.log, reason: r.reason };
  } finally {
    Math.random = realRandom;
  }
}, opts);

const skip = !chromium && "playwright is not installed";

test("same seed and same bot give an identical service", { skip }, async () => {
  const a = await run({ seed: "test-1", bot: "careful", noise: 1 });
  const b = await run({ seed: "test-1", bot: "careful", noise: 2 });
  assert.ok(a.log.length > 20, "a real service ran");
  assert.deepEqual(b, a);
});

test("the masher bot is deterministic too", { skip }, async () => {
  const a = await run({ seed: "test-2", bot: "masher", noise: 3 });
  const b = await run({ seed: "test-2", bot: "masher", noise: 4 });
  assert.deepEqual(b, a);
});

test("same seed gives the same tickets whoever is playing", { skip }, async () => {
  const a = await run({ seed: "test-3", bot: "careful", noise: 5 });
  const b = await run({ seed: "test-3", bot: "masher", noise: 6 });
  const n = Math.min(a.log.length, b.log.length);
  assert.ok(n > 20);
  assert.deepEqual(b.log.slice(0, n), a.log.slice(0, n));
});

test("a different seed gives a different night", { skip }, async () => {
  const a = await run({ seed: "test-4", bot: "careful", noise: 7 });
  const b = await run({ seed: "test-5", bot: "careful", noise: 7 });
  assert.notDeepEqual(b.log, a.log);
});

test("the daily service is keyed to the date", { skip }, async () => {
  const a = await run({ daily: "2026-11-27", bot: "careful", noise: 8, mode: -1 });
  const b = await run({ daily: "2026-11-27", bot: "careful", noise: 9, mode: -1 });
  const c = await run({ daily: "2026-11-28", bot: "careful", noise: 8, mode: -1 });
  assert.deepEqual(b, a);
  assert.notDeepEqual(c.log, a.log);
  assert.ok(a.t < 300, "a daily service runs about four minutes");
});

test("bot scores across the week (printed for tuning, not asserted)", { skip }, async () => {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const c = await run({ seed: "friday-" + i, bot: "careful", noise: i });
    const m = await run({ seed: "friday-" + i, bot: "masher", noise: i });
    rows.push(`Practice Friday seed ${i}: careful ${c.rating}%  masher ${m.rating}%`);
  }
  for (let day = 22; day <= 28; day++) {
    const date = `2026-11-${day}`;
    const c = await run({ daily: date, bot: "careful", noise: 1, mode: -1 });
    const m = await run({ daily: date, bot: "masher", noise: 1, mode: -1 });
    const dow = new Date(date + "T00:00:00Z").toUTCString().slice(0, 3);
    rows.push(`Daily ${date} ${dow}: ${c.log.length} tickets, careful ${c.rating}%  masher ${m.rating}%  (${Math.round(c.t)}s)`);
  }
  console.log("\n" + rows.join("\n"));
});
