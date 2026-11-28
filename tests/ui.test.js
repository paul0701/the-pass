// Taps through the real menus on a phone-sized page, so a broken button never ships again.
// Needs Playwright (pre-installed in Claude Code cloud sessions).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { /* skipped below */ }
const url = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
const skip = !pw && "playwright is not installed";
let browser;
before(async () => { if (pw) browser = await pw.chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

async function page(fresh) {
  const p = await (await browser.newContext({ ...pw.devices["Pixel 7"] })).newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  if (!fresh) await p.addInitScript(() => { if (!localStorage.getItem("thepass.save.v1")) localStorage.setItem("thepass.save.v1", JSON.stringify({ seenIntro: true })); });
  await p.goto(url);
  await p.waitForSelector(".hero");
  return p;
}
const kind = (p) => p.evaluate(() => { const G = window.__pass.state(); return G && !G.over ? G.kind : null; });

test("the daily starts from the big card", { skip }, async () => {
  const p = await page();
  await p.click(".hero [data-act=dailybrief]");
  await p.click("[data-act=dailygo]");
  await p.waitForTimeout(200);
  assert.equal(await kind(p), "daily");
  assert.deepEqual(p.errors, []);
});

test("Practice menu starts a free service, and the Stage starts from it", { skip }, async () => {
  const p = await page();
  await p.click(".hint [data-act=practice]");
  await p.click("[data-act=mode][data-i='0']");
  await p.waitForTimeout(200);
  assert.equal(await kind(p), "practice");
  await p.click("#btnPause");
  await p.click("[data-act=quit]");
  await p.click(".hint [data-act=practice]");
  await p.click("[data-act=stages]");
  await p.click("[data-act=stage][data-i='0']");
  await p.waitForTimeout(200);
  assert.equal(await kind(p), "stage");
  assert.deepEqual(p.errors, []);
});

test("every menu button has something behind it", { skip }, async () => {
  const p = await page();
  for (const [open, sel] of [["", ".links [data-act=stats]"], ["", ".links [data-act=account]"], ["", ".hint [data-act=practice]"], ["", ".hint [data-act=stages]"]]) {
    await p.goto(url); await p.waitForSelector(".hero");
    await p.click(sel);
    await p.waitForTimeout(100);
    assert.ok(await p.$("#ov .card h1"), sel + " opened a screen");
  }
  assert.deepEqual(p.errors, []);
});

test("a new player who waits on one ticket gets told to fire the next", { skip }, async () => {
  const p = await page();
  await p.click(".hint [data-act=practice]");
  await p.click("[data-act=mode][data-i='0']");
  const said = await p.evaluate(() => {
    const P = window.__pass; P.headless(true); const G = P.state();
    while (G.tickets.length < 1) P.update(0.05);
    G.tickets[0].dishes.forEach((d) => P.fire(d));
    while (G.tickets.length < 2) P.update(0.05);
    for (let i = 0; i < 200; i++) P.update(0.05);
    return document.querySelector("#bubble").textContent;
  });
  assert.match(said, /Don't wait/);
  assert.deepEqual(p.errors, []);
});

test("first visit: tap to start, the kitchen intro plays, then the start screen", { skip }, async () => {
  const p = await page(true);
  assert.ok(await p.$("#intro .gate"), "a first-time visitor sees the tap to start gate");
  await p.click("#intro .gate button");
  await p.waitForTimeout(600);
  assert.ok(await p.$("#intro"), "the intro is playing");
  assert.equal(await p.$("#intro .gate"), null);
  await p.waitForSelector("#intro", { state: "detached", timeout: 9000 });
  assert.ok(await p.$(".hero"), "start screen underneath");
  await p.reload();
  await p.waitForSelector(".hero");
  assert.equal(await p.$("#intro"), null, "the intro only plays once");
  assert.deepEqual(p.errors, []);
});

test("the intro can be skipped", { skip }, async () => {
  const p = await page(true);
  await p.click("#intro .gate button");
  await p.click("#intro .iskip");
  await p.waitForSelector("#intro", { state: "detached", timeout: 2000 });
  await p.click(".hero [data-act=dailybrief]");
  assert.ok(await p.$("[data-act=dailygo]"));
  assert.deepEqual(p.errors, []);
});

test("signing in with no network says so instead of hanging", { skip }, async () => {
  const p = await page();
  await p.route("**/api/**", (route) => route.abort());
  await p.click(".links [data-act=account]");
  await p.fill("#accName", "Paul Jones");
  await p.fill("#accPin", "1357");
  await p.click("[data-act=login]");
  await p.waitForTimeout(300);
  assert.match(await p.textContent("#accErr"), /Can't reach the pass/);
  assert.deepEqual(p.errors, []);
});

test("Stage 5: splitting the moment chef says so is a clean split", { skip }, async () => {
  const p = await page();
  const out = await p.evaluate(() => {
    const P = window.__pass; P.headless(true); P.newGame(0, { kind: "stage", stage: 4 }); const G = P.state();
    while (!G.tickets.length) P.update(0.05);
    const t = G.tickets[0]; t.dishes.forEach((d) => P.fire(d));
    while (!G.sv.hint && G.t < 120) P.update(0.05);
    P.sendTicket(t);
    while (!t.done && G.t < 200) { P.update(0.05); if (t.dishes.some((d) => d.state === "plated" && !d.dead)) P.sendTicket(t); }
    return { hinted: !!G.sv.hint, clean: G.clean, awkward: G.awkward };
  });
  assert.ok(out.hinted);
  assert.deepEqual([out.clean, out.awkward], [1, 0]);
});

test("leaving the daily early never scores better than playing on badly", { skip }, async () => {
  const p = await page();
  const out = await p.evaluate(() => {
    const P = window.__pass; P.headless(true);
    const play = (leaveAt) => {
      P.newGame(-1, { kind: "daily", daily: P.dailyInfo("2026-12-05") }); const G = P.state(); let next = 0;
      while (!G.over && G.t < 900) {
        P.update(0.05);
        if (leaveAt && G.t >= leaveAt) { P.endGame("left"); break; }
        if (G.t < next) continue; next = G.t + 1;
        const t = G.tickets.find((x) => !x.done); if (!t) continue;   // one ticket at a time, like a beginner
        t.dishes.forEach((d) => { if (d.dead) P.bin(d); if (d.state === "unfired") P.fire(d); });
        if (t.dishes.some((d) => d.state === "plated" && !d.dead)) P.sendTicket(t);
      }
      return G.result.rating;
    };
    return { full: play(0), early: play(40) };
  });
  assert.ok(out.early <= out.full, JSON.stringify(out));
});
