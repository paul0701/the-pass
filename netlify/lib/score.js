import { prevDate, LAUNCH } from "../../shared/daily.js";

// Same thresholds as stars() in index.html.
export const starCount = (r) => (r >= 92 ? 5 : r >= 82 ? 4 : r >= 70 ? 3 : r >= 55 ? 2 : r >= 35 ? 1 : 0);

// Share grid: one character per table. g = went out well (a clean split counts), a = a struggle (awkward split or
// a ticket well over its time), r = walkout or refire.
export const GRID_RE = /^[gar]{0,80}$/;

// Preview days before launch don't carry over: on and after launch day, a record last played before it starts clean.
const preview = (d, today) => !!d && !!d.last && d.last < LAUNCH && today >= LAUNCH;

// The streak as it stands today: it only survives if the last service was today or yesterday.
export function liveStreak(d, today) {
  if (!d || !d.last || preview(d, today)) return 0;
  return d.last === today || d.last === prevDate(today) ? d.streak || 0 : 0;
}

// Wordle-style personal stats. dist[n] = services finished with n stars.
export function publicStats(d, today) {
  const x = d && !preview(d, today) ? d : {};
  return {
    played: x.days || 0, finished: x.finished || 0,
    avg: x.finished ? Math.round(x.total / x.finished) : 0, best: x.best || 0,
    streak: liveStreak(x, today), bestStreak: x.bestStreak || 0,
    dist: Array.isArray(x.dist) && x.dist.length === 6 ? x.dist : [0, 0, 0, 0, 0, 0]
  };
}

// Called when a player STARTS a daily service. A started service counts as a day played.
export function markPlayed(d, date) {
  const cur = (d && !preview(d, date) && d) || { last: null, streak: 0, bestStreak: 0, days: 0, finished: 0, total: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] };
  if (cur.last === date) return cur;
  cur.streak = cur.last === prevDate(date) ? (cur.streak || 0) + 1 : 1;
  cur.bestStreak = Math.max(cur.bestStreak || 0, cur.streak);
  cur.last = date;
  cur.days = (cur.days || 0) + 1;
  return cur;
}
