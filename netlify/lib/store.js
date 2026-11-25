import { getStore } from "@netlify/blobs";
import { HttpError } from "./http.js";

// One Blobs store for the whole game. Key layout:
//   player:<id>          the account: name, PIN hash, sessions, synced progress, daily history
//   daily:<date>:<id>    one Daily Service attempt, created with onlyIfNew when the service STARTS
//   limit:<kind>:<h>:<hour>  rate limit counters
export const STORE_NAME = "the-pass";
export const playerKey = (id) => `player:${id}`;
export const dailyKey = (date, id) => `daily:${date}:${id}`;
const MAX_RETRIES = 6;

export const store = () => getStore({ name: STORE_NAME, consistency: "strong" });
const stamp = (record) => {
  record.updatedAt = new Date().toISOString();
  return record;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const loadJson = (key) => store().get(key, { type: "json" });
export const loadRecord = (id) => loadJson(playerKey(id));

// Writes a value only if the key does not exist yet. Returns false if it was already there.
export async function createJson(key, value) {
  const { modified } = await store().setJSON(key, stamp(value), { onlyIfNew: true });
  return modified;
}
export const createRecord = (record) => createJson(playerKey(record.id), record);
export const putJson = (key, value) => store().setJSON(key, stamp(value));

// Read-modify-write with ETag optimistic locking so parallel requests never overwrite each other.
// mutate(value|null) returns { result, changed }; it is re-run on a fresh copy after a conflict.
export async function updateJson(key, mutate) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const entry = await store().getWithMetadata(key, { type: "json" });
    const { result, changed, value } = await mutate(entry ? entry.data : null);
    if (!changed) return result;
    const next = value || (entry && entry.data);
    // No entry: only create. Entry with an ETag: only overwrite that exact version.
    // (The local test server returns no ETag on reads; then it writes unconditionally, as Rum to Riches does.)
    const cond = !entry ? { onlyIfNew: true } : entry.etag ? { onlyIfMatch: entry.etag } : {};
    const { modified } = await store().setJSON(key, stamp(next), cond);
    if (modified) return result;
    await sleep(20 + Math.random() * 60 * (attempt + 1));
  }
  throw new HttpError(409, "The pass is busy. Try again, chef.");
}
export const updateRecord = (id, mutate) => updateJson(playerKey(id), mutate);

// Every JSON value under a key prefix.
export async function readAll(prefix) {
  const { blobs } = await store().list({ prefix });
  const rows = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return rows.filter(Boolean);
}
