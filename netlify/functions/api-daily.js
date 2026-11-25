// GET  /api/daily                      today's service number and weekday, plus your status and stats if signed in
// POST /api/daily {action:"start", date}   records the attempt BEFORE play, so closing the tab is not a free retry
// POST /api/daily {action:"finish", date, pct, grid, ...}  records the result of the attempt you started
import { json, handle, readJson, HttpError } from "../lib/http.js";
import { parseToken, verifySession, withPlayer } from "../lib/auth.js";
import { loadRecord, loadJson, createJson, updateJson, dailyKey } from "../lib/store.js";
import { todayUtc, dailyInfo, DAILY_DURATION } from "../../shared/daily.js";
import { starCount, GRID_RE, liveStreak, markPlayed, publicStats } from "../lib/score.js";

// A result can not arrive sooner than this after the start (the service itself is DAILY_DURATION seconds).
const MIN_PLAY_MS = Math.round(DAILY_DURATION * 0.6) * 1000;
// Generous ceiling: pauses are allowed, but not finishing tomorrow.
const MAX_PLAY_MS = 6 * 3600 * 1000;

const publicAttempt = (a) => a && ({
  started: true, finished: !!a.finished, pct: a.finished ? a.pct : null,
  stars: a.finished ? a.stars : null, grid: a.finished ? a.grid : ""
});

async function signedIn(req) {
  const tok = parseToken(req, true);
  if (!tok) return null;
  const record = await loadRecord(tok.playerId);
  verifySession(record, tok.secret, Date.now());
  return record;
}

const requireToday = (date) => {
  const today = todayUtc();
  if (date !== today) throw new HttpError(400, "That service has closed. Today's is " + today + ".");
  return today;
};

async function start(req, body) {
  const date = requireToday(body.date);
  const now = Date.now();
  const reply = await withPlayer(req, (record) => ({ changed: false, result: record }));
  const created = await createJson(dailyKey(date, reply.id), { id: reply.id, name: reply.name, date, startedAt: now, finished: false });
  if (!created) {
    const a = await loadJson(dailyKey(date, reply.id));
    throw new HttpError(409, "You've already run today's service. Back tomorrow, chef.", { status: publicAttempt(a) });
  }
  const out = await withPlayer(req, (record) => {
    record.daily = markPlayed(record.daily, date);
    return { changed: true, result: { ok: true, streak: record.daily.streak, stats: publicStats(record.daily, date) } };
  });
  return json(200, out);
}

async function finish(req, body) {
  const date = requireToday(body.date);
  const pct = body.pct;
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new HttpError(400, "Invalid score.");
  const grid = typeof body.grid === "string" && GRID_RE.test(body.grid) ? body.grid : "";
  const extra = {};
  for (const k of ["covers", "tables", "walked", "dead", "refires", "clean", "awkward", "freshness", "avgTicket"]) {
    const v = Number(body[k]);
    if (Number.isFinite(v) && v >= 0 && v < 1e5) extra[k] = Math.round(v);
  }
  const me = await withPlayer(req, (record) => ({ changed: false, result: { id: record.id, name: record.name } }));
  const now = Date.now();
  const attempt = await updateJson(dailyKey(date, me.id), (a) => {
    if (!a) throw new HttpError(409, "No service was started today, so there's nothing to record.");
    if (a.finished) throw new HttpError(409, "Today's result is already in.");
    if (now - a.startedAt < MIN_PLAY_MS) throw new HttpError(400, "That was quicker than a service can run.");
    if (now - a.startedAt > MAX_PLAY_MS) throw new HttpError(400, "That service ran too long to count.");
    Object.assign(a, { finished: true, pct, stars: starCount(pct), grid, finishedAt: now, ...extra });
    return { changed: true, value: a, result: a };
  });
  const out = await withPlayer(req, (record) => {
    const d = (record.daily = markPlayed(record.daily, date));
    d.finished = (d.finished || 0) + 1;
    d.total = (d.total || 0) + pct;
    d.best = Math.max(d.best || 0, pct);
    if (!Array.isArray(d.dist) || d.dist.length !== 6) d.dist = [0, 0, 0, 0, 0, 0];
    d.dist[starCount(pct)]++;
    return { changed: true, result: publicStats(d, date) };
  });
  return json(200, { ok: true, status: publicAttempt(attempt), streak: out.streak, stats: out });
}

export default handle(async (req) => {
  if (req.method === "GET") {
    const today = todayUtc();
    const out = { ok: true, serverNow: Date.now(), today: dailyInfo(today), status: null, streak: 0, stats: null };
    const record = await signedIn(req);
    if (record) {
      out.status = publicAttempt(await loadJson(dailyKey(today, record.id)));
      out.streak = liveStreak(record.daily, today);
      out.stats = publicStats(record.daily, today);
    }
    return json(200, out);
  }
  if (req.method !== "POST") throw new HttpError(405, "Use GET or POST.");
  const body = await readJson(req);
  if (body.action === "start") return start(req, body);
  if (body.action === "finish") return finish(req, body);
  throw new HttpError(400, "action must be start or finish.");
});

export const config = { path: "/api/daily" };
