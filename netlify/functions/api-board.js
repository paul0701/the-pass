// GET /api/board?scope=day[&date=YYYY-MM-DD]   that day's Daily Service results
// GET /api/board?scope=all                      all-time: average daily score, days played, streaks
import { json, handle, requireMethod } from "../lib/http.js";
import { readAll } from "../lib/store.js";
import { todayUtc, dailyInfo, DATE_RE, prevDate } from "../../shared/daily.js";

const MIN_DAYS = 3; // all-time ranking needs a few services before an average means anything
const TOP = 100;

export default handle(async (req) => {
  requireMethod(req, "GET");
  const url = new URL(req.url);
  const today = todayUtc();
  if (url.searchParams.get("scope") === "all") {
    const rows = (await readAll("stats:")).filter((r) => r.finished > 0).map((r) => ({
      name: r.name,
      avg: Math.round((r.total / r.finished) * 10) / 10,
      best: r.best, days: r.days,
      streak: r.last === today || r.last === prevDate(today) ? r.streak : 0,
      bestStreak: r.bestStreak, ranked: r.finished >= MIN_DAYS
    }));
    rows.sort((a, b) => (b.ranked - a.ranked) || (b.avg - a.avg) || (b.days - a.days));
    return json(200, { ok: true, scope: "all", minDays: MIN_DAYS, rows: rows.slice(0, TOP) });
  }
  const q = url.searchParams.get("date");
  const date = q && DATE_RE.test(q) && q <= today ? q : today;
  const rows = (await readAll(`daily:${date}:`)).filter((r) => r.finished);
  rows.sort((a, b) => (b.pct - a.pct) || (a.finishedAt - b.finishedAt));
  return json(200, {
    ok: true, scope: "day", ...dailyInfo(date), played: rows.length,
    rows: rows.slice(0, TOP).map((r) => ({ name: r.name, pct: r.pct, stars: r.stars, grid: r.grid }))
  });
});

export const config = { path: "/api/board" };
