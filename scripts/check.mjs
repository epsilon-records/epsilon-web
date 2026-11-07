// Dependency-free checks for the static site.
//
// Runs in CI (`.github/workflows/ci.yml`): `node scripts/check.mjs`. No install needed.
//
// - required files exist in public/
// - every internal link in public/**/*.html resolves to a file
// - every page has a title, a meta description and a canonical link (404 excepted)
// - sitemap.xml lists every indexable page

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

const exists = (path) => stat(path).then((s) => s.isFile(), () => false);

async function main() {
  const files = await walk(pub);
  const html = files.filter((f) => f.endsWith(".html"));
  const problems = [];

  for (const rel of ["index.html", "404.html", "styles.css", "favicon.svg", "sitemap.xml", "robots.txt"]) {
    if (!(await exists(join(pub, rel)))) problems.push(`missing public/${rel}`);
  }

  const pages = new Set();
  for (const file of html) {
    const rel = relative(pub, file);
    const url = rel.endsWith("index.html") ? "/" + rel.slice(0, -"index.html".length) : "/" + rel;
    pages.add(url);

    const src = await readFile(file, "utf8");
    const is404 = rel === "404.html";
    if (!/<title>[^<]+<\/title>/.test(src)) problems.push(`${rel}: no <title>`);
    if (!is404 && !/<meta name="description" content="[^"]+"/.test(src)) {
      problems.push(`${rel}: no meta description`);
    }
    if (!is404 && !/<link rel="canonical" href="https:\/\/epsilonrecords\.com/.test(src)) {
      problems.push(`${rel}: no canonical link`);
    }

    for (const [, href] of src.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const path = href.split("#")[0].split("?")[0];
      if (!path) continue;
      if (!path.startsWith("/")) {
        problems.push(`${rel}: ${href} (internal links must be absolute)`);
        continue;
      }
      let target = join(pub, path);
      if (path.endsWith("/")) {
        target = join(target, "index.html");
      } else if (!path.split("/").pop().includes(".")) {
        const asDir = join(target, "index.html");
        if (await exists(asDir)) target = asDir;
      }
      if (!(await exists(target))) problems.push(`${rel}: ${href} (no such file)`);
    }
  }

  const sitemap = await readFile(join(pub, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>https:\/\/epsilonrecords\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const url of pages) {
    if (url === "/404.html") continue;
    if (!locs.includes(url)) problems.push(`sitemap.xml: missing ${url}`);
  }

  if (problems.length) {
    console.error(`check failed (${problems.length}):`);
    for (const problem of problems) console.error("  - " + problem);
    process.exit(1);
  }
  console.log(`check ok: ${html.length} pages, ${locs.length} sitemap urls`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
