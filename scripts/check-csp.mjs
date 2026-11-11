// The Content-Security-Policy check (EPSILON-118); included by scripts/check.mjs.
//
// checkPolicy(toml) checks the header block in netlify.toml: the CSP's hardening directives
// are pinned and HSTS is exact. checkCsp(rel, src, toml) checks one page against that policy:
// no inline scripts, styles or event handlers, and every URL the page can load or submit to is
// allowed by its directive. Fixtures for both live in scripts/check-csp.test.mjs.

const ORIGIN = "https://epsilonrecords.com";
const HSTS = "max-age=31536000; includeSubDomains";
const PINNED = { "frame-ancestors": ["'none'"], "object-src": ["'none'"], "base-uri": ["'self'"] };

// Directives that fall back to default-src when absent (CSP Level 3). form-action, base-uri
// and frame-ancestors do not fall back.
const FALLBACK = {
  "script-src": "default-src",
  "style-src": "default-src",
  "font-src": "default-src",
  "img-src": "default-src",
  "media-src": "default-src",
  "connect-src": "default-src",
  "object-src": "default-src",
  "frame-src": "child-src",
  "child-src": "default-src",
};

/** The `/*` [[headers]] block's values, as a name → value map. */
function rootHeaders(toml) {
  const block = toml
    .split(/^\[\[headers\]\]\s*$/m)
    .slice(1)
    .map((b) => b.split(/^\[\[/m)[0])
    .find((b) => /^\s*for\s*=\s*"\/\*"\s*$/m.test(b));
  if (!block) return null;
  const values = new Map();
  for (const [, name, value] of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)) {
    if (name !== "for") values.set(name, value);
  }
  return values;
}

const cache = new Map();
function parse(toml) {
  if (cache.has(toml)) return cache.get(toml);
  const header = rootHeaders(toml)?.get("Content-Security-Policy");
  const policy = header
    ? new Map(
        header
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => d.split(/\s+/))
          .map(([name, ...sources]) => [name.toLowerCase(), sources]),
      )
    : null;
  cache.set(toml, policy);
  return policy;
}

/** Problems with the netlify.toml header block itself. */
export function checkPolicy(toml) {
  const headers = rootHeaders(toml);
  if (!headers) return ['netlify.toml: no [[headers]] block for "/*"'];
  const problems = [];
  if (headers.get("Strict-Transport-Security") !== HSTS) {
    problems.push(`netlify.toml: "/*" Strict-Transport-Security must be exactly "${HSTS}"`);
  }
  const policy = parse(toml);
  if (!policy) return [...problems, 'netlify.toml: "/*" has no Content-Security-Policy'];
  for (const [name, expected] of Object.entries(PINNED)) {
    const actual = policy.get(name);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`netlify.toml: CSP ${name} must be ${expected.join(" ")}, got ${actual?.join(" ") ?? "(none)"}`);
    }
  }
  return problems;
}

function sourcesFor(policy, directive) {
  for (let d = directive; d; d = FALLBACK[d]) if (policy.has(d)) return policy.get(d);
  return null; // no directive and no fallback: unrestricted
}

function allows(policy, directive, raw) {
  const sources = sourcesFor(policy, directive);
  if (!sources) return true;
  const value = raw.trim();
  if (/^data:/i.test(value)) return sources.includes("data:");
  if (/^blob:/i.test(value)) return sources.includes("blob:");
  let url;
  try {
    url = new URL(value, `${ORIGIN}/`);
  } catch {
    return false;
  }
  if (url.origin === ORIGIN && sources.includes("'self'")) return true;
  return sources.includes(url.origin);
}

// Tags with their attributes. Attribute names are lowercased; values may be double-quoted,
// single-quoted or unquoted.
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function tags(html) {
  // Comments are dropped; script and style bodies are emptied so their text isn't read as tags.
  const doc = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, "$1$3");
  const out = [];
  for (const [, name, rawAttrs] of doc.matchAll(TAG)) {
    const attrs = new Map();
    for (const [, key, dq, sq, uq] of rawAttrs.matchAll(ATTR)) {
      const k = key.toLowerCase();
      if (!attrs.has(k)) attrs.set(k, dq ?? sq ?? uq ?? "");
    }
    out.push({ name: name.toLowerCase(), attrs });
  }
  return out;
}

const srcsetUrls = (value) =>
  value
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);

// <link rel=preload|modulepreload as=…> → directive.
const PRELOAD = { style: "style-src", font: "font-src", script: "script-src", image: "img-src", fetch: "connect-src", audio: "media-src", video: "media-src", track: "media-src" };

/** Problems with one page. `toml` is netlify.toml's text. */
export function checkCsp(rel, src, toml) {
  const policy = parse(toml);
  if (!policy) return ['netlify.toml: "/*" has no Content-Security-Policy'];
  const problems = [];
  const need = (directive, url, what) => {
    if (url != null && !allows(policy, directive, url)) {
      problems.push(`${rel}: ${directive} does not allow ${url} (${what})`);
    }
  };

  const out = tags(src);
  for (const { name, attrs } of out) {
    for (const key of attrs.keys()) {
      if (key === "style") problems.push(`${rel}: inline style attribute on <${name}> (CSP blocks it)`);
      else if (/^on[a-z]+$/.test(key)) problems.push(`${rel}: inline event handler ${key} on <${name}> (CSP blocks it)`);
    }
    const get = (k) => (attrs.has(k) ? attrs.get(k) : null);
    switch (name) {
      case "style":
        problems.push(`${rel}: inline <style> (CSP blocks it)`);
        break;
      case "script": {
        // A JSON-LD block is data, never executed, so CSP doesn't apply. The type attribute
        // itself must say so exactly; any other <script> without src is inline code.
        if ((get("type") ?? "").trim().toLowerCase() === "application/ld+json" && get("src") == null) break;
        if (get("src") == null) problems.push(`${rel}: inline script (CSP blocks it)`);
        else need("script-src", get("src"), "<script src>");
        break;
      }
      case "link": {
        const rels = (get("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const href = get("href");
        if (rels.includes("stylesheet")) need("style-src", href, "<link rel=stylesheet>");
        if (rels.includes("icon") || rels.includes("apple-touch-icon")) need("img-src", href, "<link rel=icon>");
        if (rels.includes("modulepreload")) need("script-src", href, "<link rel=modulepreload>");
        if (rels.includes("preload")) {
          const directive = PRELOAD[(get("as") ?? "").toLowerCase()];
          if (directive) need(directive, href, `<link rel=preload as=${get("as")}>`);
          else problems.push(`${rel}: <link rel=preload> without a known "as" (${href})`);
        }
        break;
      }
      case "img":
        need("img-src", get("src"), "<img src>");
        for (const url of srcsetUrls(get("srcset") ?? "")) need("img-src", url, "<img srcset>");
        break;
      case "source":
        need("media-src", get("src"), "<source src>");
        for (const url of srcsetUrls(get("srcset") ?? "")) need("img-src", url, "<source srcset>");
        break;
      case "video":
        need("media-src", get("src"), "<video src>");
        need("img-src", get("poster"), "<video poster>");
        break;
      case "audio":
        need("media-src", get("src"), "<audio src>");
        break;
      case "track":
        need("media-src", get("src"), "<track src>");
        break;
      case "input":
        if ((get("type") ?? "").toLowerCase() === "image") need("img-src", get("src"), "<input type=image>");
        need("form-action", get("formaction"), "<input formaction>");
        break;
      case "button":
        need("form-action", get("formaction"), "<button formaction>");
        break;
      case "form":
        need("form-action", get("action"), "<form action>");
        break;
      case "iframe":
      case "frame":
        need("frame-src", get("src"), `<${name}>`);
        break;
      case "embed":
        need("object-src", get("src") ?? "", "<embed>");
        break;
      case "object":
        need("object-src", get("data") ?? "", "<object>");
        break;
      case "base":
        need("base-uri", get("href") ?? "", "<base>");
        break;
    }
  }
  return problems;
}
