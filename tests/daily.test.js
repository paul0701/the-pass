import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAYS, LAUNCH, DAILY_DURATION, dailyInfo, dailyNumber, prevDate } from "../shared/daily.js";
import { markPlayed, liveStreak, starCount } from "../netlify/lib/score.js";
import { mergeProgress } from "../netlify/lib/progress.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("index.html carries the same calendar as shared/daily.js", () => {
  assert.match(html, new RegExp(`const LAUNCH = '${LAUNCH}';`));
  assert.match(html, new RegExp(`const DAILY_DURATION = ${DAILY_DURATION};`));
  const block = html.slice(html.indexOf("const DAYS = ["), html.indexOf("];", html.indexOf("const DAYS = [")));
  const rows = [...block.matchAll(/\{short:'(\w+)', name:'(\w+)',\s+title:'([^']+)',\s+int:([\d.]+),\s+rush:([\d.]+),\s+pan:([\d.]+),\s+menu:'(\w+)'\}/g)];
  assert.equal(rows.length, 7);
  rows.forEach((m, i) => {
    const d = DAYS[i];
    assert.deepEqual([m[1], m[2], m[3], +m[4], +m[5], +m[6], m[7]], [d.short, d.name, d.title, d.int, d.rush, d.pan, d.menu], d.name);
  });
});

test("weekday difficulty builds through the week and Sunday is a roast", () => {
  const order = [1, 2, 3, 4, 5, 6].map((i) => DAYS[i].int);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] < order[i - 1], "each day busier than the last");
  assert.equal(DAYS[0].menu, "roast");
});

test("day numbers and dates", () => {
  assert.equal(dailyNumber(LAUNCH), 1);
  assert.equal(dailyInfo("2026-11-27").short, "Fri");
  assert.equal(prevDate("2027-01-01"), "2026-12-31");
});

test("streak: consecutive days, reset after a gap, live view", () => {
  let d = markPlayed(null, "2026-12-05");
  d = markPlayed(d, "2026-12-06");
  d = markPlayed(d, "2026-12-06");
  assert.equal(d.streak, 2);
  assert.equal(liveStreak(d, "2026-12-07"), 2);
  assert.equal(liveStreak(d, "2026-12-08"), 0);
  d = markPlayed(d, "2026-12-09");
  assert.equal(d.streak, 1);
  assert.equal(d.bestStreak, 2);
});

test("stars match the client thresholds", () => {
  assert.deepEqual([92, 91, 82, 70, 55, 35, 34].map(starCount), [5, 4, 4, 3, 2, 1, 0]);
});

test("progress merge keeps the best of both", () => {
  const m = mergeProgress({ best: [80, 0, 0], unlocked: 1, stage: 2 }, { best: [60, 72, 0], unlocked: 0, stage: 4, muted: true });
  assert.deepEqual(m.best, [80, 72, 0]);
  assert.equal(m.unlocked, 1);
  assert.equal(m.stage, 4);
  assert.equal(m.muted, true);
});
