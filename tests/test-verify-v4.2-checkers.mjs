import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const scripts=join(here,'../scripts');
const pages=['/','/audio/convert-audio/','/images/convert-image/','/documents/split-pdf/','/audio/cut-audio/','/video/convert-video/','/documents/pdf-to-image/'];
const needed=[
'js/common/navigation-guard','js/common/operations-config','js/common/more-operations',
'js/common/category-operations','js/common/file-categories','js/common/file-utils',
'js/common/file-storage','js/common/icons','js/common/file-policy',
'js/common/keyboard-navigation','js/homepage/homepage-storage','js/homepage/liste-files',
'js/common/file-list','js/common/confirmation-modal'
];
function makeFixture(quoted=false) {
 const base=mkdtempSync(join(tmpdir(),'eft-v42-'));
 const hash='a'.repeat(64);
 const css=`/optimized/css/easyfile-common.min.${hash}.css`;
 const attrs=quoted ? `rel="stylesheet" href="${css}"` : `href=${css} rel=stylesheet`;
 const webfonts='<link href="https://fonts.googleapis.com/css2?family=Inter&amp;display=optional" rel=stylesheet media=print>';
 const placeholder='data-file-id="x"';
 const inline='<script>(()=>{const hint=JSON.parse(sessionStorage.getItem("easyfiletools:restore-hint-v42")||"null");list.dataset.restorePending="true";list.style.setProperty("--easyfile-expected-rows",1)})()</script>';
 for (const r of pages) {
   const extras=needed.map(name=>`<script defer src=/optimized/${name}.min.${hash}.js></script>`).join('');
   const page=`<!doctype html><html><head><link ${attrs}>${webfonts}${extras}</head><body>${inline}<div class="file-list-container">${placeholder}</div></body></html>`;
   const file=join(base,r.slice(1),'index.html');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,page);
 }
 const cssfile=join(base,css.slice(1));mkdirSync(dirname(cssfile),{recursive:true});
 writeFileSync(cssfile,':where(i[data-lucide]){}.category-intro{}#drop-zone{}.confirmation-modal{}.eft-range{}#file-list{}.file-list-container[data-restore-pending=true] #file-list{min-height:calc(var(--easyfile-expected-rows)*120px)}.upload-info{}');
 for(const name of needed){const file=join(base,`optimized/${name}.min.${hash}.js`);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,'void 0;');}
 return base;
}
for (const quoted of [false,true]){
 test(`three verifiers pass realistic ${quoted?'quoted':'Hugo-minified unquoted'} HTML`,()=>{
  const base=makeFixture(quoted);
  try {
   for(const name of ['verify-v3-build.mjs','verify-v4-build.mjs','verify-v4.2-build.mjs']){
    const out=spawnSync(process.execPath,[join(scripts,name),base],{encoding:'utf8'});
    assert.equal(out.status,0,`${name}: ${out.stdout}\n${out.stderr}`);
   }
  }finally{rmSync(base,{recursive:true,force:true});}
 });
}
test('V4 validator reports missing CSS rather than silently passing',()=>{
 const base=makeFixture();
 try{
  const file=join(base,'optimized/css/easyfile-common.min.'+'a'.repeat(64)+'.css');rmSync(file);
  const out=spawnSync(process.execPath,[join(scripts,'verify-v4-build.mjs'),base],{encoding:'utf8'});
  assert.notEqual(out.status,0);
  assert.match(out.stdout,/FAIL .*common CSS file exists/);
 }finally{rmSync(base,{recursive:true,force:true});}
});
