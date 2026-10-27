#!/usr/bin/env node
// Check V4 and later production builds. Accept HTML output minified by Hugo,
// where attribute quotes may be removed and HTML attributes may be reordered.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const base = resolve(process.argv[2] || 'public');
const routes = ['/', '/audio/convert-audio/', '/images/convert-image/', '/documents/split-pdf/', '/audio/cut-audio/', '/video/convert-video/', '/documents/pdf-to-image/'];
const importantJS = [
  'js/common/navigation-guard', 'js/common/operations-config',
  'js/common/more-operations', 'js/common/category-operations',
  'js/common/file-categories', 'js/common/file-utils',
  'js/common/file-storage', 'js/common/icons',
  'js/common/file-policy', 'js/common/keyboard-navigation',
  'js/homepage/homepage-storage', 'js/homepage/liste-files'
];
let failures = 0;
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures++; };
const getAttr = (tag, attr) => {
  const match = tag.match(new RegExp(`(?:\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
};
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map(m => m[0]);
const pathFromURL = (url) => {
  try {
    const u = new URL(url, 'http://localhost/');
    if (u.hostname !== 'localhost') return null;
    return u.pathname;
  } catch { return null; }
};
const onDisk = (url) => {
  const path = pathFromURL(url);
  return !!path && existsSync(join(base, path.replace(/^\//, '')));
};
const readRoute = route => {
  const file = join(base, route.slice(1), 'index.html');
  if (!existsSync(file)) { check(false, `${route}: missing index.html`); return null; }
  return readFileSync(file, 'utf8');
};
let cssURL = '';
for (const route of routes) {
  const html = readRoute(route);
  if (!html) continue;
  const links = tags(html, 'link');
  const stylesheets = links.filter(t => getAttr(t, 'rel').toLowerCase().split(/\s+/).includes('stylesheet'));
  const hrefs = stylesheets.map(t => getAttr(t, 'href')).filter(Boolean);
  const bundled = hrefs.filter(h => /\/optimized\/css\/easyfile-common\.min\.[a-f0-9]+\.css(?:[?#]|$)/i.test(h));
  check(bundled.length === 1, `${route}: one fingerprinted common CSS link`);
  if (bundled[0]) {
    check(onDisk(bundled[0]), `${route}: common CSS file exists`);
    if (!cssURL) cssURL = bundled[0];
  }
  const original = hrefs.filter(h => /\/(?:css\/main\.css|css\/homepage\/main\.css|css\/common\/liste-files\.css)(?:[?#]|$)/i.test(h));
  check(original.length === 0, `${route}: no duplicate original common CSS links`);
  const candidates = [
    ...links.map(t => getAttr(t, 'href')),
    ...tags(html, 'script').map(t => getAttr(t, 'src'))
  ].filter(Boolean);
  const missing = candidates.filter(h => /\.(?:css|js)(?:[?#]|$)/i.test(h) && pathFromURL(h)).filter(h => !onDisk(h));
  check(missing.length === 0, `${route}: all locally referenced JS/CSS assets exist`);
  if (missing.length) console.log('  Missing:', missing.join(', '));
}
if (cssURL && onDisk(cssURL)) {
  const css = readFileSync(join(base, pathFromURL(cssURL).replace(/^\//, '')), 'utf8');
  check(!/@import\b/i.test(css), 'bundle: no CSS @import waterfall');
  for (const selector of ['.category-intro', '#drop-zone', '.confirmation-modal', '.eft-range'])
    check(css.includes(selector), `bundle includes ${selector}`);
  console.log(`Bundled common stylesheet: ${(Buffer.byteLength(css)/1024).toFixed(1)} KiB uncompressed`);
}
const home = readRoute('/');
if (home) {
  for (const name of importantJS) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(new RegExp(`/optimized/${escaped}\\.min\\.[a-f0-9]+\\.js`, 'i').test(home), `minified ${name}`);
  }
  check(!/src=["']?[^\s>]*chrome-extension:/i.test(home), 'no injected browser extensions in build');
}
if (failures) { console.error(`V4 validation failed: ${failures} check(s)`); process.exitCode = 1; }
else console.log('V4 production build validated. Browser functional tests remain necessary.');
