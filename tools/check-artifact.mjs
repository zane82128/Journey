import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { root } from "./build.mjs";

const dist = path.join(root, "dist");
const metadata = JSON.parse(
  await readFile(path.join(dist, "version.json"), "utf8"),
);
if (
  !/^[a-f0-9]{16}$/.test(metadata.version) ||
  !Array.isArray(metadata.resources)
)
  throw Error("Invalid build metadata");
async function requireFile(relative) {
  const target = path.resolve(dist, relative);
  if (!target.startsWith(dist + path.sep) || !(await stat(target)).isFile())
    throw Error(`Invalid or missing artifact: ${relative}`);
}
for (const resource of metadata.resources) {
  if (!resource.startsWith("./"))
    throw Error(`Resource must be relative: ${resource}`);
  await requireFile(resource === "./" ? "index.html" : resource.slice(2));
}
const worker = await readFile(path.join(dist, "sw.js"), "utf8");
if (
  worker.includes("__BUILD_CONFIG__") ||
  !worker.includes(JSON.stringify(metadata))
)
  throw Error("Worker and artifact metadata mismatch");
const html = await readFile(path.join(dist, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(?:https?:|data:)/.test(match[1]))
    throw Error("Unexpected external page dependency");
  await requireFile(match[1].split("#")[0]);
}
const manifest = JSON.parse(
  await readFile(path.join(dist, "manifest.webmanifest"), "utf8"),
);
if (
  manifest.start_url !== "./" ||
  manifest.scope !== "./" ||
  manifest.id !== "./"
)
  throw Error("Manifest must support project subpaths");
for (const icon of manifest.icons) await requireFile(icon.src);
await requireFile(".nojekyll");
console.log(
  `Artifact verified: ${metadata.version}, ${metadata.resources.length} offline resources, relative Pages paths`,
);
