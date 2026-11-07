# epsilon-web

The public site for Epsilon Records ([epsilonrecords.com](https://epsilonrecords.com)): a front door for the label and its software — ERMS, AudioKit and Epsilon Audio. It links out to each product; it hosts no app.

Plain static HTML and one stylesheet, served by Netlify. **No framework, no Tailwind, no build step** (see [Why no build?](#why-no-build)).

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `public/index.html` | Landing: label + software positioning, three product cards, Bandcamp strip |
| `/erms/` | `public/erms/index.html` | ERMS → [erms.epsilonrecords.com](https://erms.epsilonrecords.com) |
| `/audiokit/` | `public/audiokit/index.html` | AudioKit → [audiokit.ai](https://audiokit.ai) and [audiokit.ai/docs](https://audiokit.ai/docs) |
| `/epsilon-audio/` | `public/epsilon-audio/index.html` | Epsilon Audio → [plugins.epsilonrecords.com](https://plugins.epsilonrecords.com) |
| `/about/` | `public/about/index.html` | Label story and the software studio |
| `/contact/` | `public/contact/index.html` | Email and socials |
| `/nieuwe-groove-collectief/`, `/diverse-records/`, `/collective/`, `/partners/` | `public/<slug>/index.html` | Label/collective pages kept by [0003](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0003-migration-redirects-host-and-dns.md); copy migrated from `epsilonrecords.nl` |
| `/anr-guide/` | `public/anr-guide/index.html` | A&R onboarding guide, kept as a public page by [0005](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0005-include-anr-guide.md) |
| 404 | `public/404.html` | Not-found page (noindex) |

## Layout

```
public/                 the publish directory: served as-is
  index.html  erms/  audiokit/  epsilon-audio/  about/  contact/  404.html
  styles.css            design tokens and all styles (one file)
  favicon.svg  robots.txt  sitemap.xml
netlify.toml            publish dir, security headers, redirects
scripts/check.mjs       dependency-free link/metadata/sitemap check (CI)
.github/workflows/ci.yml  runs the check on pushes to main and on PRs
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

Six hand-written pages and one stylesheet don't need templating, and the task was to stay dependency-light. The trade-off is deliberate:

- **Header, footer and `<head>` metadata are repeated in each page.** Editing the nav means editing every file; `scripts/check.mjs` catches broken links and missing metadata.
- **`sitemap.xml` and `robots.txt` are static.** Add a page and you must add it to `sitemap.xml`; the check fails if a page is missing from the sitemap.

Both are fine at this size. If the site grows past a handful of pages, add a small layout step like [`audiokit-web`](https://github.com/epsilon-records/audiokit-web) (`scripts/build.mjs`), which is where this shape came from.

## Design

The "B+C" direction ([epsilon-web 0002](https://github.com/epsilon-records/knowledge/blob/main/epsilon-web/decisions/0002-private-static-site-b-plus-c.md), [ERMS 0009](https://github.com/epsilon-records/knowledge/blob/main/erms/decisions/0009-ui-direction-b-plus-c.md)): dark ground, one lime accent, a Swiss-grid structure, IBM Plex Sans + Mono, thin rules and square corners. The tokens at the top of `public/styles.css` are the same ones the ERMS UI uses, so the front doors share one language.

## Deploy

Netlify builds this as a static site: **no build command**, publish directory `public`. Every push to `main` deploys production; pull requests get deploy previews.

The site is **not yet linked to the `epsilonrecords.com` domain**, and DNS is untouched. That cutover is deferred ([#31 section 5](https://github.com/epsilon-records/knowledge/issues/31)); the redirects that only take effect after cutover are in `netlify.toml`.

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

The host rules are inert until the domain is attached to this Netlify site; the cutover is still deferred.

**Placeholders:** content not yet migrated is marked with `data-placeholder` and shown in a dashed amber box, never as real copy. `node scripts/check.mjs` prints a warning for each page that still has one. Don't invent copy to fill them; take it from the old site.

**Not implemented on purpose:** analytics — none (0003). Do not touch DNS or the Netlify domain attachment.

— epsilon-web agent
