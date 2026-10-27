#!/usr/bin/env node
// Estimate the uncompressed size of CSS and JS referenced by generated HTML pages.
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(process.argv[2] || 'public');
const routes=['/','/images/convert-image/','/audio/cut-audio/','/video/convert-video/','/documents/pdf-to-image/'];
let failures=0;
for(const route of routes){
 const file=path.join(base,route.slice(1),'index.html');
 if(!fs.existsSync(file)){console.log(`${route}: MISSING build HTML`);failures++;continue;}
 const html=fs.readFileSync(file,'utf8');
 const unique=new Set();
 for(const match of html.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)){
   let url=match[1]||match[2]||match[3];
   if(!url.startsWith('/')||url.startsWith('//'))continue;
   url=url.split(/[?#]/)[0]; if(/\.(js|css)$/i.test(url))unique.add(url);
 }
 let js=0,css=0,missing=[];
 for(const url of unique){const f=path.join(base,url.slice(1));if(!fs.existsSync(f)){missing.push(url);continue;}
 const size=fs.statSync(f).size;if(url.endsWith('.js'))js+=size;else css+=size; }
 console.log(`${route.padEnd(30)} JS ${String((js/1024).toFixed(1)).padStart(7)} KiB | CSS ${String((css/1024).toFixed(1)).padStart(7)} KiB | ${unique.size} assets | missing ${missing.length}`);
 if(missing.length){console.log('  Missing:',missing.join(', '));failures++;}
}
console.log('These are uncompressed disk sizes, NOT network transfer bytes, Core Web Vitals, or runtime memory usage.');
if(failures)process.exitCode=1;
