# epsilon-web

The public site for Epsilon Records ([epsilonrecords.com](https://epsilonrecords.com)): a front door for the label and its software — ERMS, AudioKit and Epsilon Audio. It links out to each product; it hosts no app.

Plain static HTML and one stylesheet, served by Netlify. **No framework, no Tailwind, no build step** (see [Why no build?](#why-no-build)).

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `public/index.html` | Landing: label + software positioning, three product cards, newsletter signup, Bandcamp strip |
| `/erms/` | `public/erms/index.html` | ERMS → [erms.epsilonrecords.com](https://erms.epsilonrecords.com) |
| `/audiokit/` | `public/audiokit/index.html` | AudioKit → [audiokit.ai](https://audiokit.ai) and [audiokit.ai/docs](https://audiokit.ai/docs) |
| `/epsilon-audio/` | `public/epsilon-audio/index.html` | Epsilon Audio → [plugins.epsilonrecords.com](https://plugins.epsilonrecords.com); also carries the newsletter signup |
| `/about/` | `public/about/index.html` | Label story and the software studio |
| `/contact/` | `public/contact/index.html` | Email and socials |
| `/demos/` | `public/demos/index.html` | How to send a demo: one email to demos@epsilonrecords.com with a private link ([epsilon-web 0010](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0010-demos-page-email-now-labelkit-later.md)); intake moves into LabelKit later |
| `/nieuwe-groove-collectief/`, `/diverse-records/`, `/collective/`, `/partners/` | `public/<slug>/index.html` | Label/collective pages kept by [0003](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0003-migration-redirects-host-and-dns.md); copy migrated from `epsilonrecords.nl` |
| `/anr-guide/` | `public/anr-guide/index.html` | A&R onboarding guide, kept as a public page by [0005](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0005-include-anr-guide.md) |
| `/privacy/` | `public/privacy/index.html` | Privacy notice covering epsilonrecords.com, plugins.epsilonrecords.com and the newsletter (shared 0026), drafted by agents per [shared 0012](https://github.com/epsilon-records/knowledge/blob/main/shared/decisions/0012-agents-draft-privacy-notices.md); linked from every footer |
| `/check-your-inbox/` | `public/check-your-inbox/index.html` | Newsletter sign-up page: Kit redirects here after the form is submitted, before the subscriber confirms. `noindex`, not in the sitemap, untracked by analytics |
| `/subscribed/` | `public/subscribed/index.html` | Newsletter confirmation page: Kit redirects subscribers here after they confirm. `noindex`, not in the sitemap, untracked by analytics |
| 404 | `public/404.html` | Not-found page (noindex) |

The newsletter signup (homepage and `/epsilon-audio/`) is a plain HTML POST to Kit form 10170855, with no Kit script ([shared 0027](https://github.com/epsilon-records/knowledge/blob/main/shared/decisions/0027-subscribe-forms-epsilon-and-audiokit-lists.md)). `scripts/check-analytics.mjs` allows exactly that one form and nothing else.

## Layout

```
public/                       the publish directory: served as-is
  index.html  404.html        one directory per page otherwise (see Pages)
  styles.css                  design tokens and all styles (one file)
  analytics.js                guarded Cloudflare Web Analytics loader (see Analytics)
  images/labels/              label logos for the label/collective pages
  favicon.svg  robots.txt  sitemap.xml
netlify.toml                  publish dir, security headers, redirects
scripts/check.mjs             dependency-free link/metadata/sitemap/redirect/privacy check (CI)
scripts/check-analytics.mjs   analytics loader and HTML coverage checks, run by check.mjs
scripts/analytics-contract.mjs  the reviewed list of tracked paths, shared by the checks
scripts/analytics.browser.mjs manual Playwright harness for the loader (not in CI)
.github/workflows/ci.yml      check on PRs and main; deploy to production from main
```

## Develop

There is nothing to install. Serve the publish directory and open it:

```bash
python3 -m http.server 8000 -d public
# http://localhost:8000
```

Check links, page metadata and sitemap coverage:

```bash
node scripts/check.mjs
```

## Why no build?

Fifteen hand-written pages and one stylesheet don't need templating, and the task was to stay dependency-light. The trade-off is deliberate:

- **Header, footer and `<head>` metadata are repeated in each page.** Editing the nav means editing every file; `scripts/check.mjs` catches broken links and missing metadata.
- **`sitemap.xml` and `robots.txt` are static.** Add a page and you must add it to `sitemap.xml`; the check fails if a page is missing from the sitemap.

Both are still manageable at this size, but the repetition is now real. If the site grows much further, add a small layout step like [`audiokit-web`](https://github.com/epsilon-records/audiokit-web) (`scripts/build.mjs`), which is where this shape came from.

## Design

The "B+C" direction ([epsilon-web 0002](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0002-private-static-site-b-plus-c.md), [ERMS 0009](https://github.com/epsilon-records/knowledge/blob/main/labelkit/decisions/0009-ui-direction-b-plus-c.md)): dark ground, one lime accent, a Swiss-grid structure, IBM Plex Sans + Mono, thin rules and square corners. The tokens at the top of `public/styles.css` are the same ones the ERMS UI uses, so the front doors share one language.

## Deploy

GitHub Actions deploys, not Netlify: Netlify Free can't continuous-deploy a private org repo, so the `deploy` job in `ci.yml` publishes `public/` with the Netlify CLI (`netlify deploy --prod`). It runs only on pushes to `main`, after `check` passes and after `node scripts/check.mjs --release` passes. Pull requests run `check` only. They get **no deploy previews**. There is no build command.

CLI deploys have a null `commit_ref` in Netlify. To match a deploy to a commit, use the deploy title (`github <sha>`).

The domain cutover is **live** (2026-11-08). `epsilonrecords.com` serves this site over HTTPS, `www` 301s to the apex, and the `.nl` hosts 301 to `.com`. Squarespace has been cancelled ([0008](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0008-proceed-with-squarespace-cancellation.md)). The Netlify badge is turned off for this site ([0004](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0004-disable-netlify-badge.md)).

## Redirects

Decided in [epsilon-web 0003](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0003-migration-redirects-host-and-dns.md), from the inventory in [#31](https://github.com/epsilon-records/knowledge/issues/31). They live in `netlify.toml` and `scripts/check.mjs` validates them.

| From | To | Status |
| --- | --- | --- |
| `https://www.epsilonrecords.com/*` | `https://epsilonrecords.com/:splat` | 301 |
| `https://epsilonrecords.nl/*` | `https://epsilonrecords.com/:splat` | 301 |
| `/epsilon-records` | `/` | 301 |
| `/about`, `/contact` | `/about/`, `/contact/` | 301 |
| `/nieuwe-groove-collectief`, `/diverse-records`, `/collective`, `/partners` | the same path with `/` | 301 |
| `/anr-guide` | `/anr-guide/` | 301 |
| `/merch`, `/merch/*` | `https://epsilonrecords.bandcamp.com` | 301 |
| `/join`, `/onboarding`, `/cart`, `/account/*` | — | 410 |

Since the cutover, the host rules are live.

**Placeholders:** content not yet migrated is marked with `data-placeholder` and shown in a dashed amber box, never as real copy. `node scripts/check.mjs` prints a warning for each page that still has one. Don't invent copy to fill them; take it from the old site.

**Required facts:** a fact only Nate can supply (the privacy notice's controller name, address and privacy contact) is additionally marked `data-required="<fact>"`. `node scripts/check.mjs` warns about it; `node scripts/check.mjs --release`, which the deploy job runs before publishing, fails until it is filled. If the privacy notice's facts change (a new vendor, script or font source), update `/privacy/` in the same change.

## Analytics

Cloudflare Web Analytics runs on the 11 content pages under [shared 0011](https://github.com/epsilon-records/knowledge/blob/main/shared/decisions/0011-cloudflare-web-analytics.md). That decision replaces the "no analytics" clause in 0003. It uses no other vendor. Cloudflare says its beacon uses no cookies or browser storage.

- Each tracked page loads `/analytics.js` once. The loader is fail-closed. It injects the beacon only on `https://epsilonrecords.com`, and only when the current URL, the navigation entry and any referrer are exact paths from its allowlist with no query or fragment.
- `/privacy/`, `/check-your-inbox/`, `/subscribed/` and the 404 page are not tracked.
- **Adding a tracked page:** add its path to the `paths` set in `public/analytics.js` *and* to `scripts/analytics-contract.mjs`. `check.mjs` fails in two cases: a contract path the loader would not track, or a page whose script tag doesn't match the contract. Keep `/privacy/` accurate in the same change.
- An empty `token` in `analytics.js` turns collection off completely.
- `scripts/analytics.browser.mjs` is a manual end-to-end check against real Chrome. It installs nothing: point `PLAYWRIGHT_MODULE` at an existing Playwright install.

**Hands off:** DNS and the Netlify domain attachment. Changes to either go through Nate.

— epsilon-web agent
