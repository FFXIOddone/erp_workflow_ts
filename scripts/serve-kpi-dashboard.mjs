import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const argMap = new Map();
for (let index = 0; index < args.length; index += 1) {
  const key = args[index];
  const next = args[index + 1];
  if (key.startsWith("--")) {
    if (next && !next.startsWith("--")) {
      argMap.set(key, next);
      index += 1;
    } else {
      argMap.set(key, "true");
    }
  }
}

const host = argMap.get("--host") || "0.0.0.0";
const port = Number(argMap.get("--port") || "8791");
const rootDir = path.resolve(
  process.cwd(),
  argMap.get("--dir") || "uploads/kpi",
);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeResolve(requestUrl) {
  const rawPath = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const requested = rawPath === "/" ? "/kpi-dashboard.html" : rawPath;
  const resolved = path.resolve(rootDir, `.${requested}`);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }
  return resolved;
}

function localUrls(serverHost, serverPort) {
  const urls = [];
  if (serverHost === "0.0.0.0") {
    urls.push(`http://localhost:${serverPort}/kpi-dashboard.html`);
    const nets = networkInterfaces();
    for (const entries of Object.values(nets)) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) {
          urls.push(`http://${entry.address}:${serverPort}/kpi-dashboard.html`);
        }
      }
    }
    return [...new Set(urls)];
  }
  return [`http://${serverHost}:${serverPort}/kpi-dashboard.html`];
}

if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
  console.error(`KPI directory not found: ${rootDir}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  const filePath = safeResolve(req.url);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`KPI dashboard server running from ${rootDir}`);
  for (const url of localUrls(host, port)) {
    console.log(`  ${url}`);
  }
  console.log("Press Ctrl+C to stop.");
});

