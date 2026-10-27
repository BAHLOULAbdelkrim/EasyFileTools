import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
const base = resolve(import.meta.dirname, '..');
const source = p => readFileSync(join(base,p),'utf8');
const markup = source('themes/high-tech-theme/layouts/partials/common/liste-files.html');
const hintJS = markup.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
const fileStorage = source('themes/high-tech-theme/static/js/common/file-storage.js');
const fileList = source('themes/high-tech-theme/static/js/common/file-list.js');
const zoneCSS = source('themes/high-tech-theme/static/css/common/zone-chargement.css');
const listCSS = source('themes/high-tech-theme/static/css/common/liste-files.css');
const head = source('layouts/partials/head.html');

test('same-tab hint executes without Hugo variables or externally loaded JS', () => {
  assert.ok(hintJS);
  new vm.Script(hintJS);
  assert.match(hintJS,/document\.currentScript\.previousElementSibling/);
  assert.doesNotMatch(hintJS,/innerHTML|\.files|\.name\b/);
});

const setup = (hint, category='Image', tab='tab-id-00000001') => {
  const attrs = {};
  const busy = {};
  const list = {
    classList: {contains:c=>c==='file-list-container'},
    dataset:{category},
    style:{setProperty:(k,v)=>{attrs[k]=v}},
    querySelector:sel=>sel==='#file-list' ? {setAttribute:(k,v)=>busy[k]=v}:null
  };
  const sessionStorage = {
    getItem:key=>key==='easyfiletools:file-session-v2' ? tab :
      key==='easyfiletools:restore-hint-v42' ? JSON.stringify(hint) : null
  };
  vm.runInNewContext(hintJS, {document:{currentScript:{previousElementSibling:list}},sessionStorage});
  return {list, attrs,busy};
};

test('only the correct tab AND category reserves up to 3 rows',()=>{
  let o=setup({sessionId:'tab-id-00000001',count:10,category:'Image'});
  assert.equal(o.list.dataset.restorePending,'true');
  assert.equal(o.attrs['--easyfile-expected-rows'],'3');
  assert.equal(o.busy['aria-busy'],'true');
  o=setup({sessionId:'other',count:10,category:'Image'});
  assert.equal(o.list.dataset.restorePending,undefined);
  o=setup({sessionId:'tab-id-00000001',count:1,category:'Audio'});
  assert.equal(o.list.dataset.restorePending,undefined);
});

test('new/empty sessions have no reserved rows, invalid JSON is safe',()=>{
  for(const hint of [null,{sessionId:'tab-id-00000001',count:0,category:'Image'},
    {sessionId:'tab-id-00000001',count:-1,category:'Image'}]){
    const o=setup(hint); assert.equal(o.list.dataset.restorePending,undefined);
  }
  assert.match(hintJS,/catch \(_\)/);
});

test('sessionStorage holds count/category/tab only and clears after confirmed empty',()=>{
  assert.match(fileStorage,/count:\s*Math\.min\(count,\s*10\)/);
  assert.match(fileStorage,/sessionId:\s*fileStorageSessionId/);
  assert.match(fileStorage,/sessionStorage\.removeItem\(FILE_STORAGE_VISUAL_HINT\)/);
  assert.match(fileStorage,/fileStorageCache = normalizeSelection\(data\);\s*updateFileStorageVisualHint\(fileStorageCache\)/);
  assert.match(fileStorage,/fileStorageCache = normalizeSelection\(record\);\s*updateFileStorageVisualHint\(fileStorageCache\)/);
  assert.match(fileStorage,/fileStorageCache = null;\s*updateFileStorageVisualHint\(null\)/);
});

test('file list releases reserved rows AFTER rendering, never before empty restore',()=>{
  const section=fileList.slice(fileList.indexOf('function renderFileList('),fileList.indexOf('function updateFileListCounter('));
  assert.match(section,/files\.forEach\(/);
  assert.ok(section.lastIndexOf('removeAttribute("data-restore-pending")') > section.indexOf('files.forEach('));
  assert.match(section,/files\.length > 0/);
});

test('upload info and SVG icon placeholders reserve their geometry',()=>{
  assert.match(zoneCSS,/:where\(i\[data-lucide\]\)/);
  assert.match(zoneCSS,/width: 24px/);
  assert.match(zoneCSS,/height: 24px/);
  assert.match(zoneCSS,/#upload-zone-container \.upload-info[\s\S]*?min-height: 1\.5em/);
  assert.match(zoneCSS,/@media \(max-width: 700px\)[\s\S]*min-height: 3em/);
});

test('CSS only reserves file rows during a confirmed pending restore',()=>{
  assert.match(listCSS,/\.file-list-container\[data-restore-pending="true"\] #file-list/);
  assert.match(listCSS,/--easyfile-expected-rows/);
  assert.doesNotMatch(listCSS,/(?:^|\n)\s*\.file-list-container\s*\{\s*min-height/m);
});

test('optional Google webfonts reduce late swaps, noscript fallback remains',()=>{
  assert.match(head,/display=optional/g);
  assert.doesNotMatch(head,/display=swap/);
  assert.match(head,/<noscript><link/);
});
