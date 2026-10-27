import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=(path)=>readFileSync(join(root,path),'utf8');
const head=read('layouts/partials/head.html');
const helper=read('layouts/partials/seo/common-css-v4.html');
const asset=read('layouts/partials/seo/asset-url.html');
const cssOrder=[
 'css/common/tailwind-compat.css',
 'css/seo.css',
 'css/main.css',
 'css/homepage/login-signup.css',
 'css/homepage/clear-all.css',
 'css/homepage/main.css',
 'css/common/zone-chargement.css',
 'css/common/liste-files.css',
 'css/common/operation-zone.css',
 'css/common/confirmation-modal.css',
 'css/common/notifications.css',
 'css/common/operation-ui-components.css'
];
const extraJS=[
 'js/common/navigation-guard.js','js/common/operations-config.js',
 'js/common/more-operations.js','js/common/category-operations.js',
 'js/common/file-categories.js','js/common/file-utils.js',
 'js/common/file-storage.js','js/common/icons.js',
 'js/common/file-policy.js','js/common/keyboard-navigation.js',
 'js/homepage/main.js','js/homepage/homepage-storage.js',
 'js/homepage/liste-files.js'
];

const cssFile=(path)=>{
 const project=join(root,'static',path);
 const theme=join(root,'themes/high-tech-theme/static',path);
 assert.ok(existsSync(project)||existsSync(theme),`CSS missing: ${path}`);
 return readFileSync(existsSync(project)?project:theme,'utf8');
};

test('production references a single common CSS stylesheet; development keeps originals',()=>{
 assert.match(head,/if hugo\.IsProduction[\s\S]*partial "seo\/common-css-v4\.html"/);
 assert.match(head,/else[\s\S]*"css\/homepage\/main\.css"/);
 assert.match(head,/partial "seo\/metadata\.html"/);
});

test('bundle has exactly 12 original stylesheets in historical cascade order',()=>{
 const paths=[...helper.matchAll(/^\s+"(css\/[^"]+\.css)"\s*$/gm)].map(x=>x[1]);
 assert.deepEqual(paths,cssOrder);
 cssOrder.forEach(cssFile);
});

test('flattening @imports preserves content and avoids extra CSS waterfall',()=>{
 const imported=cssFile('css/homepage/main.css');
 assert.match(imported,/@import url\("login-signup\.css"\);/);
 assert.match(imported,/@import url\("clear-all\.css"\);/);
 assert.match(helper,/replace \$content `@import url\("login-signup\.css"\);` ""/);
 assert.match(helper,/replace \$content `@import url\("clear-all\.css"\);` ""/);
 // No other URL references: concatenation cannot corrupt relative paths.
 for(const path of cssOrder){
  const c=cssFile(path).replace(/@import url\("(?:login-signup|clear-all)\.css"\);/g,'');
  assert.doesNotMatch(c,/(?:@import|url\()/,`Unexpected relative import/url in ${path}`);
 }
});

test('Hugo 0.158-compatible single return, fingerprint, and native minification',()=>{
 assert.match(helper,/resources\.FromString/);
 assert.match(helper,/resources\.Minify/);
 assert.match(helper,/resources\.Fingerprint "sha256"/);
 const returns=[...helper.matchAll(/\{\{-?\s*return\s+[^}]+\}\}/g)];
 assert.equal(returns.length,1);
 assert.match(helper.trimEnd(),/\{\{-?\s*return \$asset\.RelPermalink\s*-?\}\}$/);
});

test('V3 optimizations and file processing JS sequence are retained',()=>{
 for(const path of ['js/common/file-list.js','js/common/confirmation-modal.js','js/audio/cut-audio/audio-cut-ui.js', 'js/homepage/file-operations.js']) {
  assert.ok(head.includes(path),path);
 }
 const v3=['js/common/file-list.js','js/common/confirmation-modal.js','js/common/zone-chargement.js'];
 for(const path of v3) assert.ok(asset.includes('"'+path+'"'),path);
 assert.match(head,/<script defer src=/);
});

test('13 measured first-party JS scripts are whitelisted, vendor scripts are not',()=>{
 for(const path of extraJS){
  assert.ok(asset.includes('"'+path+'"'),path);
  assert.ok(head.includes('"'+path+'"'),path);
  assert.ok(existsSync(join(root,'themes/high-tech-theme/static',path)),path);
 }
 assert.doesNotMatch(asset,/^\s*"js\/vendor\//m);
});

test('font strategy and accessibility fallbacks remain unchanged',()=>{
 assert.match(head,/fonts\.googleapis\.com[^\n]*media="print" onload=/);
 assert.match(head,/<noscript><link[^\n]*fonts\.googleapis/);
 assert.match(head,/meta name="viewport"/);
});

// Match the intrinsic aspect ratio in static/images/logo.svg to reserve space before SVG decoding.
test('header reserves near-exact intrinsic logo aspect ratio to reduce CLS',()=>{
 const header=read('layouts/partials/header.html');
 assert.match(header,/width="493"\s+height="151"\s+class="logo"/);
 const svg=read('static/images/logo.svg');
 const width=Number(svg.match(/\bwidth="([0-9.]+)"/)?.[1]);
 const height=Number(svg.match(/\bheight="([0-9.]+)"/)?.[1]);
 assert.ok(width>0&&height>0);
 assert.ok(Math.abs(width/height-493/151)<0.01);
});
