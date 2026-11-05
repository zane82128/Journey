// Adapted from workout_calendar/tools/preview.mjs: local-only static server.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export async function startServer({
  directory = path.join(root, "dist"),
  port = 5174,
  basePath = "/",
} = {}) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath))
    throw Error("Invalid preview base path");
  const base = path.resolve(directory);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
  };
  const server = createServer(async (req, res) => {
    try {
      let relative = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!relative.startsWith(basePath)) throw Error();
      relative = relative.slice(basePath.length);
      if (!relative || relative.endsWith("/")) relative += "index.html";
      const target = path.resolve(base, relative);
      if (!target.startsWith(base + path.sep) || !(await stat(target)).isFile())
        throw Error();
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(await readFile(target));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}${basePath}`,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { url } = await startServer({
    basePath: process.env.BASE_PATH || "/",
    directory: path.join(root, process.argv.includes("--src") ? "src" : "dist"),
    port:
      Number(process.env.PORT) ||
      (process.argv.includes("--src") ? 5175 : 5174),
  });
  console.log(`Journey: ${url}`);
}
