import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (e) =>
        e.isDirectory() ? files(dir + "/" + e.name) : [dir + "/" + e.name],
      ),
    )
  ).flat();
}
const assets = (await files("dist"))
    .filter((f) => !f.endsWith("sw.js"))
    .map((f) => "/" + f.slice(5)),
  version = createHash("sha256")
    .update(await readFile("dist/index.html"))
    .digest("hex")
    .slice(0, 12),
  source = await readFile("public/sw.js", "utf8");
await writeFile(
  "dist/sw.js",
  `const CACHE='yen-shell-${version}',ASSETS=${JSON.stringify(assets)};\n` +
    source,
);
