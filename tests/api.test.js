// End-to-end tests for the Netlify functions against a local Blobs server (no Netlify account needed).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";

const dir = mkdtempSync(join(tmpdir(), "the-pass-blobs-"));
const token = "test-token";
let server, auth, daily, progress;
const realNow = Date.now;
let skew = 0;

before(async () => {
  server = new BlobsServer({ directory: dir, token, port: 0 });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, token, siteID: "site" })).toString("base64");
  Date.now = () => realNow() + skew;
  auth = (await import("../netlify/functions/api-auth.js")).default;
  daily = (await import("../netlify/functions/api-daily.js")).default;
  progress = (await import("../netlify/functions/api-progress.js")).default;
});
after(async () => {
  Date.now = realNow;
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (fn, method, body, tok, query = "") => {
  const headers = { "Content-Type": "application/json" };
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const req = new Request("http://x/api" + query, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const res = await fn(req, { ip: "1.2.3.4" });
  return { status: res.status, data: await res.json() };
};
const today = () => new Date(Date.now()).toISOString().slice(0, 10);

test("register, sign in, wrong PIN, and taken names with suggestions", async () => {
  let r = await call(auth, "POST", { action: "register", name: "Paul Jones", pin: "1357", progress: { best: [80, 0, 0], unlocked: 1 } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.token, /^paul-jones\./);
  assert.deepEqual(r.data.progress.best, [80, 0, 0]);
  r = await call(auth, "POST", { action: "register", name: "paul jones", pin: "2468" });
  assert.equal(r.status, 409);
  assert.ok(r.data.suggestions.length > 0, JSON.stringify(r.data));
  r = await call(auth, "POST", { action: "register", name: "Sarah", pin: "1111" });
  assert.equal(r.status, 400, "obvious PIN refused");
  r = await call(auth, "POST", { action: "login", name: "Paul Jones", pin: "9999" });
  assert.equal(r.status, 401);
  r = await call(auth, "POST", { action: "login", name: "Paul Jones", pin: "1357", progress: { best: [70, 66, 0], unlocked: 2 } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.progress.best, [80, 66, 0], "merge keeps the best of both devices");
  assert.equal(r.data.progress.unlocked, 2);
});

test("progress sync merges and never goes backwards", async () => {
  const { data } = await call(auth, "POST", { action: "login", name: "Paul Jones", pin: "1357" });
  let r = await call(progress, "POST", { progress: { best: [10, 90, 50], stage: 3, muted: true } }, data.token);
  assert.deepEqual(r.data.progress.best, [80, 90, 50]);
  assert.equal(r.data.progress.stage, 3);
  r = await call(progress, "GET", null, data.token);
  assert.equal(r.data.progress.muted, true);
  r = await call(progress, "GET", null, "paul-jones." + "0".repeat(64));
  assert.equal(r.status, 401);
});

test("daily: one attempt, recorded at the start, result once, stats and streak", async () => {
  const { data } = await call(auth, "POST", { action: "login", name: "Paul Jones", pin: "1357" });
  const t = data.token;
  let r = await call(daily, "GET", null, t);
  assert.equal(r.data.today.date, today());
  assert.equal(r.data.status, null);

  r = await call(daily, "POST", { action: "finish", date: today(), pct: 90, grid: "gga" }, t);
  assert.equal(r.status, 409, "cannot finish without starting");

  r = await call(daily, "POST", { action: "start", date: "2001-01-01" }, t);
  assert.equal(r.status, 400, "only today's service");

  r = await call(daily, "POST", { action: "start", date: today() }, t);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.streak, 1);

  r = await call(daily, "POST", { action: "start", date: today() }, t);
  assert.equal(r.status, 409, "second start refused, so closing the tab is not a retry");

  r = await call(daily, "GET", null, t);
  assert.deepEqual(r.data.status, { started: true, finished: false, pct: null, stars: null, grid: "" });

  r = await call(daily, "POST", { action: "finish", date: today(), pct: 84, grid: "ggar" }, t);
  assert.equal(r.status, 400, "too quick to be a real service");

  skew += 200 * 1000;
  r = await call(daily, "POST", { action: "finish", date: today(), pct: 101, grid: "g" }, t);
  assert.equal(r.status, 400, "score out of range");
  r = await call(daily, "POST", { action: "finish", date: today(), pct: 84, grid: "ggar", covers: 61 }, t);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.status.stars, 4);
  assert.deepEqual(r.data.stats, { played: 1, finished: 1, avg: 84, best: 84, streak: 1, bestStreak: 1, dist: [0, 0, 0, 0, 1, 0] });
  r = await call(daily, "POST", { action: "finish", date: today(), pct: 99, grid: "g" }, t);
  assert.equal(r.status, 409, "result only once");

  r = await call(daily, "GET", null, t);
  assert.equal(r.data.stats.avg, 84);
  assert.equal(r.data.status.pct, 84);

  // Next day: the streak goes up.
  skew += 86400 * 1000;
  r = await call(daily, "GET", null, t);
  assert.equal(r.data.status, null);
  assert.equal(r.data.streak, 1, "yesterday still counts until today is missed");
  r = await call(daily, "POST", { action: "start", date: today() }, t);
  assert.equal(r.data.streak, 2);
  // Two days missed: the streak shows as 0.
  skew += 3 * 86400 * 1000;
  r = await call(daily, "GET", null, t);
  assert.equal(r.data.streak, 0);
});

test("lockout after five wrong PINs", async () => {
  await call(auth, "POST", { action: "register", name: "Sarah", pin: "2468" });
  for (let i = 0; i < 5; i++) await call(auth, "POST", { action: "login", name: "Sarah", pin: "0000" });
  const r = await call(auth, "POST", { action: "login", name: "Sarah", pin: "2468" });
  assert.equal(r.status, 429);
});
