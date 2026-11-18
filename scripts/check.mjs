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
// - the "/*" header block pins HSTS and the CSP's frame-ancestors, object-src and base-uri,
//   and every page fits that CSP: no inline scripts, styles or event handlers, and every
//   URL a page loads or submits to is allowed (scripts/check-csp.mjs, fixtures in
//   scripts/check-csp.test.mjs)
// - every llms.txt page entry agrees with its page (descriptionDrift, fixtures in checkDescriptionFixtures)
// - every redirect in netlify.toml is well formed, unique, and points at a real
//   file when its destination is internal

import { checkAnalytics } from "./check-analytics.mjs";
import { checkCsp, checkPolicy } from "./check-csp.mjs";
import { checkCspFixtures } from "./check-csp.test.mjs";
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

// A page entry in llms.txt drifts from its page when the summary uses words the page doesn't:
// at least 70% of its content words (5+ letters) must appear in the page's text. The generic
// placeholders the descriptions replaced always fail.
const GENERIC = [/^an? (label\/collective|label) page of epsilon records$/i, /^partners of the label$/i];
const words = (t) => (t.replace(/\(?https?:\/\/\S+/g, " ").toLowerCase().match(/[a-z&][a-z&-]{4,}/g) ?? []);
export function descriptionDrift(desc, pageText) {
  if (GENERIC.some((g) => g.test(desc.trim()))) return "is a generic placeholder";
  const page = new Set(words(pageText));
  const own = [...new Set(words(desc))];
  const missing = own.filter((w) => !page.has(w));
  return own.length && missing.length / own.length > 0.3 ? `uses words the page doesn't (${missing.join(", ")})` : null;
}
// "- [Name](page): description" entries, with any Markdown bullet (-, * or +), possibly indented.
const llmsEntries = (text) =>
  [...text.matchAll(/^\s*[-*+]\s+\[[^\]]+\]\((https:\/\/epsilonrecords\.com\/[^)\s]*)\):\s*(.+)$/gm)].map((m) => [m[1], m[2]]);
function checkDescriptionFixtures() {
  const star = llmsEntries("* [LabelKit](https://epsilonrecords.com/labelkit/): a label page of Epsilon Records");
  if (star.length !== 1 || !descriptionDrift(star[0][1], "LabelKit")) throw new Error("description fixture: an asterisk-bullet placeholder should be checked and fail");
  const page = "Nieuwe Groove Collectief is an Amsterdam sublabel of Epsilon Records, launched in 2024, for organic electronic, future soul, nu-disco and funky house.";
  if (descriptionDrift("an Amsterdam sublabel of Epsilon Records, launched in 2024, for organic electronic, future soul, nu-disco and funky house", page)) throw new Error("description fixture: current description should pass");
  if (!descriptionDrift("a Berlin label for drum and bass, hardstyle and gabber", page)) throw new Error("description fixture: wrong description should fail");
  if (!descriptionDrift("a label page of Epsilon Records", page)) throw new Error("description fixture: placeholder should fail");
}

// llms.txt is what AI assistants read about the label, so it must agree with the site:
// every epsilonrecords.com link is a sitemap page, and "Elsewhere" lists exactly the profiles
// in the home page's Organization sameAs.
async function checkLlms(locs) {
  const problems = [];
  // CRLF-safe, so an editor's line endings can't hide the Elsewhere section.
  const llms = (await readFile(join(pub, "llms.txt"), "utf8")).replace(/\r\n?/g, "\n");
  // Every inline-link destination, whatever its scheme and with or without a "title".
  const destinations = (text) => [...text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);
  for (const dest of destinations(llms)) {
    let url;
    try {
      url = new URL(dest);
    } catch {
      problems.push(`llms.txt: ${dest} is not an absolute URL`);
      continue;
    }
    if (!/^(www\.)?epsilonrecords\.com$/.test(url.hostname)) continue;
    if (url.origin !== "https://epsilonrecords.com") {
      problems.push(`llms.txt: ${dest} should be https://epsilonrecords.com${url.pathname}`);
    }
    if (!locs.includes(url.pathname)) problems.push(`llms.txt: ${url.pathname} is not a sitemap page`);
  }
  // Each "- [Name](page): description" entry must agree with the page it links.
  for (const [href, desc] of llmsEntries(llms)) {
    const path = new URL(href).pathname;
    const file = join(pub, path, "index.html");
    if (!(await exists(file))) continue;
    const html = await readFile(file, "utf8");
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>|&[a-z]+;/g, (m) => (m.startsWith("<") ? " " : m === "&amp;" ? "&" : " "));
    const meta = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
    const drift = descriptionDrift(desc, `${meta} ${text}`);
    if (drift) problems.push(`llms.txt: the ${path} description ${drift}`);
  }
  const home = await readFile(join(pub, "index.html"), "utf8");
  // sameAs of the home page's Organization node, read from its JSON-LD, not the first match.
  const nodes = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((m) => {
      const data = JSON.parse(m[1]);
      return data["@graph"] ?? (Array.isArray(data) ? data : [data]);
    });
  const org = nodes.find((n) => n["@type"] === "Organization" && n.url?.replace(/\/$/, "") === "https://epsilonrecords.com")
    ?? nodes.find((n) => n["@type"] === "Organization");
  const sameAs = org?.sameAs ?? [];
  const elsewhere = /## Elsewhere\n([\s\S]*?)(\n## |$)/.exec(llms)?.[1] ?? "";
  const listed = destinations(elsewhere);
  for (const url of sameAs) {
    if (!listed.includes(url)) problems.push(`llms.txt: Elsewhere is missing ${url} (in sameAs)`);
  }
  for (const url of listed) {
    if (!sameAs.includes(url)) problems.push(`llms.txt: Elsewhere lists ${url}, which sameAs does not`);
  }
  if (sameAs.length === 0) problems.push("index.html: no Organization sameAs found");
  return problems;
}

async function main() {
  await checkAnalytics();
  checkCspFixtures();
  checkDescriptionFixtures();
  const files = await walk(pub);
  const html = files.filter((f) => f.endsWith(".html"));
  const problems = [];

  for (const rel of ["index.html", "404.html", "styles.css", "favicon.svg", "sitemap.xml", "robots.txt", "llms.txt", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest", "images/og.png", "images/logo.png"]) {
    if (!(await exists(join(pub, rel)))) problems.push(`missing public/${rel}`);
  }

  const csp = await readFile(join(root, "netlify.toml"), "utf8");
  problems.push(...checkPolicy(csp));
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

  problems.push(...(await checkLlms(locs)));
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
