// Dependency-free checks for the static site.
//
// Runs in CI (`.github/workflows/ci.yml`): `node scripts/check.mjs`. No install needed.
//
// - required files exist in public/
// - every internal link in public/**/*.html resolves to a file
// - every page has a title, a meta description and a canonical link (404 excepted)
// - sitemap.xml lists every indexable page (noindex pages are exempt)
// - pages carrying data-placeholder (content not yet migrated) are listed as warnings
// - every page's footer links the privacy notice (/privacy/)
// - data-required="<fact>" marks a fact only Nate can supply (e.g. the privacy
//   notice's controller and contact). A warning by default, so PR checks stay
//   green while a draft is reviewed; with --release (the deploy job) it fails,
//   so production cannot publish a notice with the facts unfilled
// - every page fits the Content-Security-Policy in netlify.toml: no inline scripts,
//   styles or event handlers, and every script, stylesheet and form target is allowed
// - every redirect in netlify.toml is well formed, unique, and points at a real
//   file when its destination is internal

import { checkAnalytics } from "./check-analytics.mjs";
import { checkCsp } from "./check-csp.mjs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const release = process.argv.includes("--release");
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

// Netlify accepts these for a redirect rule; anything else is a typo.
const REDIRECT_STATUSES = new Set([200, 301, 302, 303, 307, 308, 404, 410]);

// Resolve an internal redirect destination to the file Netlify would serve.
async function resolveInternal(to) {
  const path = to.split("#")[0].split("?")[0];
  if (!path.startsWith("/")) return null; // external or splat destination
  if (path.includes(":")) return null; // :splat / :placeholder — resolved at request time
  let target = join(pub, path);
  if (path.endsWith("/")) target = join(target, "index.html");
  else if (!path.split("/").pop().includes(".")) {
    const asDir = join(target, "index.html");
    if (await exists(asDir)) target = asDir;
  }
  return (await exists(target)) ? null : path;
}

async function checkRedirects(pages) {
  const problems = [];
  const toml = await readFile(join(root, "netlify.toml"), "utf8");
  const blocks = toml.split(/^\[\[redirects\]\]$/m).slice(1);
  const seen = new Map();

  for (const block of blocks) {
    const body = block.split(/^\[/m)[0];
    // Values are either quoted strings or bare numbers (status = 301).
    const field = (name) => {
      const m = new RegExp(`^\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^\\s#]+))`, "m").exec(body);
      return m?.[1] ?? m?.[2];
    };
    const from = field("from");
    const to = field("to");
    const status = Number(field("status"));

    if (!from) {
      problems.push("netlify.toml: a [[redirects]] block has no from");
      continue;
    }
    if (!to) problems.push(`netlify.toml: ${from} has no to`);
    if (!REDIRECT_STATUSES.has(status)) {
      problems.push(`netlify.toml: ${from} has status ${field("status") ?? "(none)"}`);
    }
    if (seen.has(from)) problems.push(`netlify.toml: duplicate from ${from}`);
    seen.set(from, status);

    // A redirect that shadows a real page is almost always a mistake. A
    // redirect from the extension-less form (/about) to the page (/about/) is
    // the intended pattern, so only an exact match counts.
    if (pages.has(from)) {
      problems.push(`netlify.toml: ${from} shadows a real page`);
    }

    if (to && status !== 410) {
      const missing = await resolveInternal(to);
      if (missing) problems.push(`netlify.toml: ${from} -> ${missing} (no such file)`);
    }
  }

  return problems;
}

async function main() {
  await checkAnalytics();
  const files = await walk(pub);
  const html = files.filter((f) => f.endsWith(".html"));
  const problems = [];

  for (const rel of ["index.html", "404.html", "styles.css", "favicon.svg", "sitemap.xml", "robots.txt"]) {
    if (!(await exists(join(pub, rel)))) problems.push(`missing public/${rel}`);
  }

  const csp = await readFile(join(root, "netlify.toml"), "utf8");
  const pages = new Set();
  const noindex = new Set(); // pages marked noindex stay out of the sitemap
  const placeholders = [];
  const required = [];
  for (const file of html) {
    const rel = relative(pub, file);
    const url = rel.endsWith("index.html") ? "/" + rel.slice(0, -"index.html".length) : "/" + rel;
    pages.add(url);

    const src = await readFile(file, "utf8");
    if (/<meta name="robots" content="noindex">/.test(src)) noindex.add(url);
    const is404 = rel === "404.html";
    if (/data-placeholder/.test(src)) placeholders.push(rel);
    for (const [, fact] of src.matchAll(/data-required="([^"]+)"/g)) required.push(`${rel}: ${fact}`);
    problems.push(...checkCsp(rel, src, csp));
    const footer = /<footer[\s\S]*<\/footer>/.exec(src)?.[0] ?? "";
    if (!footer.includes('href="/privacy/"')) problems.push(`${rel}: footer does not link /privacy/`);
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
    if (url === "/404.html" || noindex.has(url)) continue;
    if (!locs.includes(url)) problems.push(`sitemap.xml: missing ${url}`);
  }

  problems.push(...(await checkRedirects(pages)));

  if (release) {
    for (const r of required) problems.push(`unfilled required fact (release): ${r}`);
  }

  if (problems.length) {
    console.error(`check failed (${problems.length}):`);
    for (const problem of problems) console.error("  - " + problem);
    process.exit(1);
  }
  // Placeholders are allowed (content still being migrated) but never silent.
  for (const rel of placeholders) console.warn(`warning: ${rel} has placeholder content`);
  for (const r of required) console.warn(`warning: unfilled required fact: ${r} (fails with --release)`);
  console.log(`check ok: ${html.length} pages, ${locs.length} sitemap urls`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
