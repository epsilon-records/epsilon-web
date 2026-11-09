// Dependency-free guard and published HTML checks; included by scripts/check.mjs.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
const pub = new URL('../public/', import.meta.url);
const source = await readFile(new URL('analytics.js', pub), 'utf8');
const slot = /const token = "([^"]*)";/;
const configured = source.match(slot)?.[1];
assert.ok(configured === '' || /^[a-f0-9]{32}$/i.test(configured ?? ''), 'central public ID slot');
const safe = 'https://epsilonrecords.com/';
function run({ current = safe, original = safe, referrer = '', id = configured, entries, duplicate = false, broken = false } = {}) {
  const scripts = [];
  const context = vm.createContext({ URL, location: { href: current }, window: {},
    performance: { getEntriesByType: () => { if (broken) throw Error('unavailable'); return entries ?? [{ name: original }]; } },
    document: { referrer, querySelector: () => duplicate,
      createElement: () => ({ setAttribute(k, v) { this[k] = v; } }), head: { append: s => scripts.push(s) } },
  });
  const code = source.replace(slot, `const token = ${JSON.stringify(id)};`);
  vm.runInContext(code, context);
  vm.runInContext(code, context);
  return scripts;
}
export async function checkAnalytics() {
  for (const id of ['', null, 'UNKNOWN', 'example']) assert.equal(run({ id }).length, 0, 'missing/invalid ID');
  // Test a valid identifier even when the central slot has intentionally been disabled.
  const id = 'a'.repeat(32);
  const [beacon] = run({ id });
  assert.equal(run({ id }).length, 1, 'duplicate prevention');
  assert.equal(beacon.src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(beacon.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(beacon['data-cf-beacon']), { token: id, spa: false });
  assert.equal(run({ id, duplicate: true }).length, 0);
  const unsafe = ['?token=FABRICATED_SECRET', '#FABRICATED_SECRET', '?', '#', 'auth/callback', 'login',
    'billing/', 'search/', 'catalog/FABRICATED_SECRET', '%61uth/', '404.html', 'privacy/', 'unknown/'].map(p => safe + p);
  unsafe.push('not a URL', 'http://epsilonrecords.com/', 'https://user:password@epsilonrecords.com/');
  for (const url of unsafe) for (const key of ['current', 'original', 'referrer']) {
    assert.equal(run({ id, [key]: url }).length, 0, `${key}: ${url}`);
  }
  for (const host of ['erms.epsilonrecords.com', 'auth.epsilonrecords.com', 'plugins.epsilonrecords.com',
    'www.epsilonrecords.com', 'epsilonrecords.nl', 'preview.netlify.app', 'localhost']) {
    for (const key of ['current', 'original']) assert.equal(run({ id, [key]: `https://${host}/` }).length, 0);
  }
  for (const entries of [[], [{ name: safe }, { name: safe }], [{}]]) assert.equal(run({ id, entries }).length, 0);
  assert.equal(run({ id, referrer: null }).length, 0);
  assert.equal(run({ id, broken: true }).length, 0);
  for (const path of ['/about/', '/contact/', '/erms/', '/audiokit/', '/epsilon-audio/',
    '/nieuwe-groove-collectief/', '/diverse-records/', '/collective/', '/partners/', '/anr-guide/']) {
    assert.equal(run({ id, current: safe.slice(0, -1) + path, original: safe.slice(0, -1) + path }).length, 1, path);
  }
  async function walk(dir) {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(file.name + (file.isDirectory() ? '/' : ''), dir);
      if (file.isDirectory()) { await walk(url); continue; }
      if (!file.name.endsWith('.html')) continue;
      const html = await readFile(url, 'utf8');
      const tags = html.match(/<script src="\/analytics.js" defer><\/script>/g) ?? [];
      // Privacy is independently owned by EPSILON-99 and deliberately untracked.
      assert.equal(tags.length, file.name === '404.html' || url.pathname.endsWith('/privacy/index.html') ? 0 : 1, url.pathname);
      assert.doesNotMatch(html, /data-cf-beacon|cloudflareinsights\.com|data-site-token/);
      // The static MPA has no URL-mutating scripts or GET forms; anchors/full navigations only.
      assert.doesNotMatch(html, /<form\b|\bonclick\s*=|javascript:|history\.(?:pushState|replaceState)/i);
    }
  }
  await walk(pub);
  console.log('analytics check ok: fail-closed URL guards, configuration, duplicates, static HTML coverage');
}
