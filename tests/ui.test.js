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

async function page() {
  const p = await (await browser.newContext({ ...pw.devices["Pixel 7"] })).newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
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
  assert.match(said, /Don't wait, chef/);
  assert.deepEqual(p.errors, []);
});
