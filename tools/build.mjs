import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
async function files(dir, prefix = "") {
  let out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isDirectory())
      out.push(...(await files(path.join(dir, item.name), name + "/")));
    else out.push(name);
  }
  return out.sort();
}
export async function build() {
  const out = path.join(root, "dist");
  await mkdir(out, { recursive: true });
  await cp(path.join(root, "src"), out, { recursive: true });
  const resources = (await files(path.join(root, "src"))).filter(
    (x) => x !== "sw.js",
  );
  const hash = createHash("sha256");
  for (const f of resources) {
    hash.update(f + "\0");
    hash.update(await readFile(path.join(root, "src", f)));
  }
  let worker = await readFile(path.join(root, "src/sw.js"), "utf8");
  hash.update(worker);
  const version = hash.digest("hex").slice(0, 16);
  const metadata = {
    version,
    resources: ["./", ...resources.map((x) => "./" + x)],
  };
  worker = worker.replace("__BUILD_CONFIG__", JSON.stringify(metadata));
  await writeFile(path.join(out, "sw.js"), worker);
  await writeFile(path.join(out, "version.json"), JSON.stringify(metadata));
  await writeFile(path.join(out, ".nojekyll"), "");
  console.log(
    `Built Journey ${version} → dist (${resources.length} resources)`,
  );
  return out;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await build();
