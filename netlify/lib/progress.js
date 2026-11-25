// Cross-device progress: best scores, unlocks, Stage progress and settings.
// Both sides keep a copy; merging always keeps the better of the two, so no device can wipe another.
export const emptyProgress = () => ({ best: [0, 0, 0], streak: 0, unlocked: 0, played: 0, stage: 0, muted: false, seen: false });

const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
};

export function cleanProgress(p) {
  const out = emptyProgress();
  if (!p || typeof p !== "object") return out;
  const best = Array.isArray(p.best) ? p.best : [];
  out.best = [0, 1, 2].map((i) => int(best[i], 0, 100));
  out.streak = int(p.streak, 0, 999);
  out.unlocked = int(p.unlocked, 0, 2);
  out.played = int(p.played, 0, 1e6);
  out.stage = int(p.stage, 0, 99);
  out.muted = !!p.muted;
  out.seen = !!p.seen;
  return out;
}

// Keeps the best of both. Settings (muted) follow the device that sent them.
export function mergeProgress(server, incoming) {
  const a = cleanProgress(server), b = cleanProgress(incoming);
  return {
    best: a.best.map((v, i) => Math.max(v, b.best[i])),
    streak: Math.max(a.streak, b.streak),
    unlocked: Math.max(a.unlocked, b.unlocked),
    played: Math.max(a.played, b.played),
    stage: Math.max(a.stage, b.stage),
    muted: incoming && typeof incoming.muted === "boolean" ? incoming.muted : a.muted,
    seen: a.seen || b.seen
  };
}
