// The Content-Security-Policy check (EPSILON-118); included by scripts/check.mjs.
// `toml` is netlify.toml's text. Returns a list of problems for one page.

const cache = new Map();

function parse(toml) {
  if (cache.has(toml)) return cache.get(toml);
  const header = /^\s*Content-Security-Policy = "([^"]+)"/m.exec(toml)?.[1];
  const policy = header
    ? new Map(header.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]))
    : null;
  cache.set(toml, policy);
  return policy;
}

export function checkCsp(rel, src, toml) {
  const policy = parse(toml);
  if (!policy) return ["netlify.toml: no Content-Security-Policy"];
  const problems = [];
  if (!/Strict-Transport-Security = "max-age=31536000; includeSubDomains"/.test(toml)) {
    problems.push("netlify.toml: no Strict-Transport-Security");
  }
  const allows = (directive, url) => {
    const sources = policy.get(directive) ?? policy.get("default-src") ?? [];
    return url.startsWith("/") ? sources.includes("'self'") : sources.includes(new URL(url).origin);
  };
  for (const [tag] of src.matchAll(/<script\b[^>]*>/g)) {
    if (/type="application\/ld\+json"/.test(tag)) continue; // data, not a script
    const url = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    if (!url) problems.push(`${rel}: inline script (CSP blocks it)`);
    else if (!allows("script-src", url)) problems.push(`${rel}: script-src does not allow ${url}`);
  }
  if (/<style\b/.test(src)) problems.push(`${rel}: inline <style> (CSP blocks it)`);
  if (/<[^>]+\sstyle="/.test(src)) problems.push(`${rel}: inline style attribute (CSP blocks it)`);
  if (/<[^>]+\son[a-z]+="/.test(src)) problems.push(`${rel}: inline event handler (CSP blocks it)`);
  for (const [tag] of src.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)) {
    const url = /\shref="([^"]+)"/.exec(tag)?.[1];
    if (url && !allows("style-src", url)) problems.push(`${rel}: style-src does not allow ${url}`);
  }
  for (const [, url] of src.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) {
    if (!allows("img-src", url)) problems.push(`${rel}: img-src does not allow ${url}`);
  }
  for (const [, url] of src.matchAll(/<form\b[^>]*\saction="([^"]+)"/g)) {
    if (!allows("form-action", url)) problems.push(`${rel}: form-action does not allow ${url}`);
  }
  return problems;
}
