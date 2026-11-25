// POST /api/auth  { action: "register" | "login" | "logout", name, pin, progress? }
// Copied from the Rum to Riches account pattern, without the email recovery.
import { json, handle, readJson, requireMethod, HttpError } from "../lib/http.js";
import { loadRecord, createRecord, updateRecord } from "../lib/store.js";
import { validateName, cleanName, chefId, suggestNames } from "../lib/names.js";
import { pinProblem } from "../../shared/pin.js";
import { PIN_RE, makeSecret, verifySecret, assertNotLocked, registerFailure, issueSession, parseToken, revokeSession, allow } from "../lib/auth.js";
import { cleanProgress, mergeProgress } from "../lib/progress.js";
import { liveStreak } from "../lib/score.js";
import { todayUtc } from "../../shared/daily.js";

const TAKEN = "That name is already on the rota. Sign in or pick another.";
const NOT_FOUND = "No chef by that name. Sign up first.";
const NAME_OPTS = { min: 3, max: 20, label: "Chef name" };

const requirePin = (pin) => {
  if (typeof pin !== "string" || !PIN_RE.test(pin)) throw new HttpError(400, "PIN must be 4 to 6 digits.");
};
const requireStrongPin = (pin) => {
  requirePin(pin);
  const problem = pinProblem(pin);
  if (problem) throw new HttpError(400, problem);
};

async function takenError(name) {
  const suggestions = await suggestNames(name, async (n) => !!(await loadRecord(chefId(n))), NAME_OPTS);
  return new HttpError(409, TAKEN, { suggestions });
}

const requireName = (name) => {
  if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "Chef name is required.");
  const id = chefId(name);
  if (!id) throw new HttpError(400, "Chef name is invalid.");
  return id;
};

const sessionReply = (record, token) => ({
  ok: true, token, playerId: record.id, name: record.name,
  progress: record.progress, streak: liveStreak(record.daily, todayUtc())
});

const unwrap = (result) => {
  if (result.error) throw result.error;
  return json(200, result);
};

async function register({ name, pin, progress }, ip) {
  const err = validateName(name, NAME_OPTS);
  if (err) throw new HttpError(400, err);
  requireStrongPin(pin);
  if (!(await allow("register-ip", ip, 10))) throw new HttpError(429, "Too many sign ups from here. Try again in an hour.");
  const id = chefId(name);
  if (await loadRecord(id)) throw await takenError(name);
  const now = Date.now();
  const record = {
    id,
    name: cleanName(name),
    auth: { pin: makeSecret(pin), sessions: [], failed: 0, lockUntil: 0 },
    progress: cleanProgress(progress),
    daily: null,
    createdAt: new Date(now).toISOString()
  };
  const token = issueSession(record, now);
  if (!(await createRecord(record))) throw await takenError(name);
  return json(200, sessionReply(record, token));
}

async function login({ name, pin, progress }, ip) {
  const id = requireName(name);
  requirePin(pin);
  if (!(await allow("login-ip", ip, 60))) throw new HttpError(429, "Too many sign ins from here. Try again in an hour.");
  const result = await updateRecord(id, (record) => {
    if (!record) throw new HttpError(404, NOT_FOUND);
    const now = Date.now();
    assertNotLocked(record.auth, now);
    if (!verifySecret(pin, record.auth.pin)) {
      registerFailure(record.auth, now);
      return { changed: true, result: { error: new HttpError(401, "Wrong PIN.") } };
    }
    // Anything this device earned before signing in is kept.
    if (progress) record.progress = mergeProgress(record.progress, { ...progress, muted: undefined });
    return { changed: true, result: sessionReply(record, issueSession(record, now)) };
  });
  return unwrap(result);
}

async function logout(req) {
  const { playerId, secret } = parseToken(req);
  await updateRecord(playerId, (record) => {
    if (!record) return { changed: false, result: null };
    revokeSession(record, secret);
    return { changed: true, result: null };
  });
  return json(200, { ok: true });
}

export default handle(async (req, context) => {
  requireMethod(req, "POST");
  const body = await readJson(req);
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "x";
  switch (body.action) {
    case "register": return register(body, ip);
    case "login": return login(body, ip);
    case "logout": return logout(req);
    default: throw new HttpError(400, "action must be one of: register, login, logout.");
  }
});

export const config = { path: "/api/auth" };
