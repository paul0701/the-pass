// Local dev server without a Netlify account: serves the game and runs the real functions on a throwaway Blobs store.
//   node tests/devserver.mjs   then open http://localhost:8899
// GET /__skew?s=300 moves the server clock forward 300 seconds (lets a test finish a daily without waiting).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
const root = new URL("..", import.meta.url).pathname;
const bs = new BlobsServer({ directory: mkdtempSync(join(tmpdir(), "the-pass-dev-")), token: "t", port: 0 });
const { port } = await bs.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}`, token: "t", siteID: "s" })).toString("base64");
let skew = 0; { const r = Date.now; Date.now = () => r() + skew; }
const fns = {};
for (const n of ["auth", "daily", "board", "progress"]) fns["/api/" + n] = (await import(`../netlify/functions/api-${n}.js`)).default;
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__skew") { skew += Number(u.searchParams.get("s")) * 1000; res.end("ok"); return; }
  if (fns[u.pathname]) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await fns[u.pathname](new Request("http://x" + req.url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) }), { ip: "127.0.0.1" });
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(await r.text()); return;
  }
  const p = u.pathname === "/" ? "/index.html" : u.pathname;
  try { const b = await readFile(root + p); res.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".png") ? "image/png" : "application/json" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(8899, () => console.log("The Pass on http://localhost:8899"));
