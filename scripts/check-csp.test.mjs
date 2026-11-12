// Fixtures for scripts/check-csp.mjs; run by scripts/check.mjs. Each snippet must be flagged
// (bad) or pass (good) against a policy shaped like the real one. The bad snippets include the
// review-agent cases on epsilon-web#15.
import assert from "node:assert/strict";
import { checkCsp, checkPolicy } from "./check-csp.mjs";

const POLICY =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self' https://cloudflareinsights.com; form-action 'self' https://app.kit.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
const toml = (csp = POLICY, hsts = "max-age=31536000; includeSubDomains") => `[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "${hsts}"
    Content-Security-Policy = "${csp}"

[[headers]]
  for = "/styles.css"
  [headers.values]
    Cache-Control = "public, max-age=3600"
`;

const BAD = [
  // Inline styles and handlers in any quoting or case.
  `<div style='color:red'></div>`,
  `<div style=color:red></div>`,
  `<div STYLE="color:red"></div>`,
  `<a onclick='x()'>x</a>`,
  `<a onClick="x()">x</a>`,
  `<a onclick=x()>x</a>`,
  `<style>p{}</style>`,
  `<svg><style>p{}</style></svg>`,
  // Inline scripts, including a JSON-LD type that appears only inside another attribute.
  `<script>alert(1)</script>`,
  `<script data-x='type="application/ld+json"'>alert(1)</script>`,
  `<script type="application/ld+json-x">alert(1)</script>`,
  // Protocol-relative and other foreign URLs.
  `<script src="//evil.example/x.js"></script>`,
  `<script src='https://evil.example/x.js'></script>`,
  `<img src="//evil.example/x.png">`,
  `<img src="/a.png" srcset="/a.png 1x, https://evil.example/b.png 2x">`,
  `<picture><source srcset="https://evil.example/b.webp"></picture>`,
  // Stylesheets and preloads.
  `<link rel="Stylesheet" href="https://evil.example/x.css">`,
  `<link rel="alternate stylesheet" href="https://evil.example/x.css">`,
  `<link rel="preload" as="style" href="https://evil.example/x.css">`,
  `<link rel="preload" as="font" href="https://evil.example/x.woff2" crossorigin>`,
  // Media and embeds.
  `<video src="https://evil.example/v.mp4"></video>`,
  `<video src="/v.mp4" poster="https://evil.example/p.jpg"></video>`,
  `<audio src="https://evil.example/a.mp3"></audio>`,
  `<video><source src="https://evil.example/v.mp4"></video>`,
  `<input type="image" src="https://evil.example/b.png">`,
  `<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1"></iframe>`,
  `<embed src="/x.swf">`,
  `<object data="/x.pdf"></object>`,
  // Google Fonts is no longer allowed: the fonts are self-hosted.
  `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans" rel="stylesheet">`,
  // Form targets.
  `<form action='https://evil.example/post'></form>`,
  `<form action=https://evil.example/post></form>`,
  `<form action="/x"><button formaction="https://evil.example/post">Go</button></form>`,
  `<form action="/x"><input type="submit" formaction="//evil.example/post"></form>`,
  `<base href="https://evil.example/">`,
];

const GOOD = [
  `<script type="application/ld+json">{"@context":"https://schema.org","x":"<b>"}</script>`,
  `<script type="Application/LD+JSON">{}</script>`,
  `<script src="/analytics.js" defer></script>`,
  `<link rel="stylesheet" href="/styles.css">`,
  `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
  `<link rel="canonical" href="https://epsilonrecords.com/">`,
  `<img src="/images/a.png" srcset="/images/a.png 1x, https://epsilonrecords.com/images/b.png 2x" alt="">`,
  `<form id="signup-form" action="https://app.kit.com/forms/1/subscriptions" method="post"></form>`,
  `<a href="https://epsilonrecords.bandcamp.com">Shop</a>`,
  `<svg viewBox="0 0 1 1" fill="none"><path d="M0 0"/></svg>`,
  `<!-- <script>commented out</script> <div style="x"> -->`,
  `<p>Use style="..." and onclick= carefully</p>`,
];

export function checkCspFixtures() {
  const policy = toml();
  assert.deepEqual(checkPolicy(policy), [], "fixture policy passes");
  for (const html of BAD) assert.notDeepEqual(checkCsp("fixture", html, policy), [], `not flagged: ${html}`);
  for (const html of GOOD) assert.deepEqual(checkCsp("fixture", html, policy), [], `flagged: ${html}`);

  // The header block pins HSTS exactly and the three hardening directives.
  const drop = (name) => POLICY.split("; ").filter((d) => !d.startsWith(name)).join("; ");
  for (const name of ["frame-ancestors", "object-src", "base-uri"]) {
    assert.notDeepEqual(checkPolicy(toml(drop(name))), [], `missing ${name} not flagged`);
  }
  assert.notDeepEqual(checkPolicy(toml(POLICY.replace("frame-ancestors 'none'", "frame-ancestors 'self'"))), []);
  assert.notDeepEqual(checkPolicy(toml(POLICY, "max-age=300")), [], "weak HSTS not flagged");
  assert.notDeepEqual(checkPolicy(toml(POLICY, "max-age=31536000; includeSubDomains; preload")), [], "HSTS must be exact");
  // HSTS outside the "/*" block doesn't count.
  const elsewhere = toml().replace(/^\s*Strict-Transport-Security.*\n/m, "") +
    `\n[[headers]]\n  for = "/x"\n  [headers.values]\n    Strict-Transport-Security = "max-age=31536000; includeSubDomains"\n`;
  assert.notDeepEqual(checkPolicy(elsewhere), [], "HSTS outside /* not flagged");

  console.log(`csp check ok: ${BAD.length} bad and ${GOOD.length} good fixtures, policy pins`);
}
