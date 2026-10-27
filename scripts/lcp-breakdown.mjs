#!/usr/bin/env node
/* Read Lighthouse report JSON locally and print the available LCP phases.
   No third-party package, no network connection, no files uploaded. */
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.argv[2]||'reports/lighthouse');
if(!fs.existsSync(dir)){console.error('Dossier introuvable :',dir);process.exit(1);}
const names=fs.readdirSync(dir).filter(n=>n.endsWith('.report.json')).sort();
if(!names.length){console.error('Pas de rapports *.report.json.');process.exit(1);}
const ms=n=>Number.isFinite(n)?`${Math.round(n)} ms`:'non disponible';
function walk(o, fn, depth=0){
  if(!o||typeof o!=='object'||depth>8) return;
  fn(o);
  if(Array.isArray(o))o.slice(0,15).forEach(v=>walk(v,fn,depth+1));
  else Object.entries(o).slice(0,40).forEach(([k,v])=>walk(v,fn,depth+1));
}
for(const name of names){
 const report=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const a=report.audits||{};
 const lcp=a['largest-contentful-paint']?.numericValue;
 const fcp=a['first-contentful-paint']?.numericValue;
 const ttfb=a['server-response-time']?.numericValue;
 console.log(`\n=== ${name} ===`);
 console.log('URL:',report.finalDisplayedUrl||report.finalUrl);
 console.log(`TTFB Lighthouse (approx.): ${ms(ttfb)} | FCP: ${ms(fcp)} | LCP: ${ms(lcp)}`);
 console.log(`Intervalle FCP → LCP : ${ms((Number.isFinite(lcp)&&Number.isFinite(fcp))?lcp-fcp:NaN)} (ceci N’EST PAS la phase « render delay »)`);
 for(const key of ['lcp-breakdown-insight','lcp-discovery-insight','largest-contentful-paint-element','render-blocking-insight','font-display-insight']){
   const audit=a[key]; if(!audit)continue;
   console.log('\n'+key+': '+(audit.title||''));
   if(audit.displayValue)console.log('Résumé:',audit.displayValue);
   const found=[];
   walk(audit.details, v=>{
     if(v&&('label'in v||'phase'in v||'selector'in v||'snippet'in v)){
       const label=String(v.label||v.phase||v.selector||v.snippet).replace(/\s+/g,' ').slice(0,130);
       const value=typeof v.value==='number'?ms(v.value):typeof v.duration==='number'?ms(v.duration):'';
       const id=label+' '+value;if(!found.includes(id))found.push(id);
     }
   });
   for(const line of found.slice(0,20))console.log(' -',line);
 }
}
