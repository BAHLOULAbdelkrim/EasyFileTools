#!/usr/bin/env node
// Extract LCP candidates and slow requests from Lighthouse JSON files.
// Does not change the site. Works with both older LCP-element audits and new insights.
import fs from 'node:fs';
import path from 'node:path';
const folder = path.resolve(process.argv[2] || 'reports/lighthouse');
if (!fs.existsSync(folder)) { console.error('No Lighthouse reports in '+folder); process.exit(1); }
const files = fs.readdirSync(folder).filter(n=>n.endsWith('.json') && n.includes('.report.')).sort();
if (!files.length) { console.error('No *.report.json files in '+folder); process.exit(1); }
function fmt(v) { return typeof v === 'number' && Number.isFinite(v) ? Math.round(v)+' ms' : '?'; }
function collectNodes(value,out,depth=0){
  if (!value || typeof value !== 'object' || depth>8 || out.length>10) return;
  if (value.selector || value.snippet) {
    const s=[value.selector,value.snippet].filter(Boolean).join(' | ').replace(/\s+/g,' ').slice(0,240);
    if (s && !out.includes(s)) out.push(s);
  }
  if(Array.isArray(value)) value.slice(0,10).forEach(x=>collectNodes(x,out,depth+1));
  else Object.entries(value).filter(([k])=>!['items','node','lcpElement','url','source','subItems'].includes(k) || ['items','node','lcpElement','subItems'].includes(k)).slice(0,30).forEach(([,v])=>collectNodes(v,out,depth+1));
}
const lcpValues = new Map();
for(const filename of files){
  let report;
  try{report=JSON.parse(fs.readFileSync(path.join(folder,filename),'utf8'))} catch(e){console.error(filename+': '+e.message);continue;}
  const a=report.audits||{};
  const lcp=a['largest-contentful-paint']?.numericValue;
  const fcp=a['first-contentful-paint']?.numericValue;
  const tbt=a['total-blocking-time']?.numericValue;
  const url=report.finalDisplayedUrl || report.finalUrl || '';
  console.log(`\n${filename}: LCP ${fmt(lcp)} | FCP ${fmt(fcp)} | TBT ${fmt(tbt)} | ${url}`);
  const lcpAudits=Object.entries(a).filter(([key])=>key.includes('lcp') || key==='largest-contentful-paint-element');
  const nodes=[];
  for(const [key,audit] of lcpAudits){collectNodes(audit.details?.items || audit.details,nodes); if(audit.displayValue)console.log(`  ${key}: ${audit.displayValue}`);}
  if(nodes.length)console.log('  LCP/insight elements: '+nodes.slice(0,4).join(' ; '));
  else console.log('  LCP element unavailable in this JSON version; inspect report HTML/DevTools Performance.');
  const render=a['render-blocking-resources'];
  const blocking=render?.details?.items?.slice(0,4)||[];
  if(blocking.length)console.log('  Blocking: '+blocking.map(x=>`${x.url?.split('/').slice(-1)[0]||'?'} (+${fmt(x.wastedMs)})`).join('; '));
  const net=a['network-requests']?.details?.items||[];
  const top=net.filter(x=>x.resourceType==='Stylesheet' || x.resourceType==='Script' || x.resourceType==='Font')
    .sort((a,b)=>(b.endTime||0)-(a.endTime||0)).slice(0,5);
  if(top.length)console.log('  Late CSS/JS/fonts: '+top.map(x=>`${String(x.url||'').slice(-85)} (${fmt((x.endTime||0)-(x.startTime||0))})`).join('; '));
  if (typeof lcp==='number') {
    const page=filename.replace(/-mobile-\d+\.report\.json$/,'');
    if (!lcpValues.has(page)) lcpValues.set(page,[]);
    lcpValues.get(page).push(lcp);
  }
}
console.log('\nLCP medians:');
for(const [name,arr] of lcpValues){arr.sort((a,b)=>a-b);console.log(`  ${name}: ${fmt(arr[Math.floor(arr.length/2)])} (${arr.length} runs)`);}
