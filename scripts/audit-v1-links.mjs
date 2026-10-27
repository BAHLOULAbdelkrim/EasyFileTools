#!/usr/bin/env node
// Source-level URL audit for EasyFile Tools V1 (not a replacement for an HTTP crawl).
// Run: node scripts/audit-v1-links.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const contentRoot = path.join(root, 'content');
const files = [];
function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) walk(full);
        else if (item.isFile()) files.push(full);
    }
}
walk(contentRoot);
const routes = new Map([['/', { file: 'content/_index.md', draft: false }]]);
function frontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match?.[1] ?? '';
}
function field(fm, name) {
    return fm.match(new RegExp(`^${name}:\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim() || '';
}
for (const absolute of files.filter(f => /\.md$/i.test(f))) {
    const rel = path.relative(contentRoot, absolute).replaceAll('\\', '/');
    const raw = fs.readFileSync(absolute, 'utf8');
    const fm = frontmatter(raw);
    let url = field(fm, 'url');
    if (!url) {
        url = '/' + rel.replace(/(?:\/)?(?:_index|index)\.md$/i,'').replace(/^\/+|\/+$/g,'') + '/';
    }
    url = url.replace(/\/+/g, '/');
    if (!url.endsWith('/')) url += '/';
    if (routes.has(url) && url !== '/') {
        console.error(`DUPLICATE route ${url}: ${routes.get(url).file} and ${rel}`);
        process.exitCode = 1;
    }
    routes.set(url, { file: rel, draft: field(fm,'draft') === 'true' });
}
const issues = [];
let checked = 0;
function check(href, from) {
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    const pathname = href.split(/[?#]/)[0].replace(/\/+/g,'/');
    if (!pathname) return;
    // This audit handles content routes, not static assets.
    if (/\.[a-z\d]{2,5}$/i.test(pathname)) return;
    const url = pathname.endsWith('/') ? pathname : `${pathname}/`;
    checked++;
    if (!routes.has(url)) issues.push(`${from}: missing page ${url}`);
    else if (routes.get(url).draft) issues.push(`${from}: unpublished draft target ${url}`);
}
for (const absolute of files.filter(f => /\.md$/i.test(f))) {
    const rel = path.relative(root,absolute).replaceAll('\\','/');
    const raw = fs.readFileSync(absolute,'utf8');
    if (field(frontmatter(raw),'draft') === 'true') continue;
    for (const match of raw.matchAll(/\]\((\/[^)\s]+)\)/g)) check(match[1],rel);
}
for (const name of ['audio','video','image','document']) {
    const file = path.join(root,'data','formats',`${name}.yaml`);
    const raw = fs.readFileSync(file,'utf8');
    for (const match of raw.matchAll(/^\s*action_url:\s*["']?(\/[^\s"']+)/gm)) check(match[1],`data/formats/${name}.yaml`);
}
// Operation links are generated from FILE_OPERATIONS and shown to users on the homepage.
const operationSource = fs.readFileSync(path.join(root,'themes/high-tech-theme/static/js/common/operations-config.js'),'utf8');
for (const match of operationSource.matchAll(/\burl:\s*[\"'](\/[^\"']+)[\"']/g)) {
    check(match[1], 'js/common/operations-config.js');
}
for (const file of ['layouts/404.html','layouts/_default/baseof.html','layouts/partials/footer.html','layouts/partials/header.html','themes/high-tech-theme/layouts/partials/common/login-signup.html']) {
    if (file.endsWith('/login-signup.html')) continue; // V1 inactive, per layouts/_default/baseof.html.
    const raw = fs.readFileSync(path.join(root,file),'utf8');
    for (const match of raw.matchAll(/\bhref=["'](\/[^"']+)["']/g)) check(match[1],file);
}
console.log(`Source link audit: ${routes.size} known routes; ${checked} local references; ${issues.length} broken/unpublished targets.`);
for (const issue of issues) console.error('ERROR',issue);
if (issues.length) process.exitCode=1;
console.log('Note: Dynamic Hugo/JS routes and remote HTTP status are not verified by this source-only audit.');
