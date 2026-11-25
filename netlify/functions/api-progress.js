// GET  /api/progress            the signed-in chef's synced progress
// POST /api/progress {progress} merge this device's progress in and return the result
import { json, handle, readJson, HttpError } from "../lib/http.js";
import { withPlayer } from "../lib/auth.js";
import { mergeProgress } from "../lib/progress.js";
import { liveStreak } from "../lib/score.js";
import { todayUtc } from "../../shared/daily.js";

export default handle(async (req) => {
  if (req.method === "GET") {
    const out = await withPlayer(req, (record) => ({
      changed: false,
      result: { ok: true, name: record.name, progress: record.progress, streak: liveStreak(record.daily, todayUtc()) }
    }));
    return json(200, out);
  }
  if (req.method !== "POST") throw new HttpError(405, "Use GET or POST.");
  const body = await readJson(req);
  const out = await withPlayer(req, (record) => {
    record.progress = mergeProgress(record.progress, body.progress);
    return { changed: true, result: { ok: true, progress: record.progress } };
  });
  return json(200, out);
});

export const config = { path: "/api/progress" };
