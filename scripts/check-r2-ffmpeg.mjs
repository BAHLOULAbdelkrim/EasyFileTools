#!/usr/bin/env node
// Tests R2 public asset reachability and browser CORS; never downloads the 30 MiB object.
// Usage: node scripts/check-r2-ffmpeg.mjs --url=https://assets.example.com/...wasm --origin=https://example.pages.dev
const url = process.argv.find(x=>x.startsWith('--url='))?.slice(6);
const origin = process.argv.find(x=>x.startsWith('--origin='))?.slice(9);
if(!url || !origin || !url.startsWith('https://') || !/^https?:\/\/[^/]+$/.test(origin)){
 console.error('Usage: node scripts/check-r2-ffmpeg.mjs --url=https://...wasm --origin=https://example.pages.dev');
 process.exit(2);
}
try{
 const r=await fetch(url,{method:'GET',headers:{Origin:origin,Range:'bytes=0-7'},signal:AbortSignal.timeout(15000)});
 const aco=r.headers.get('access-control-allow-origin');
 const ct=r.headers.get('content-type');
 const reader=r.body?.getReader();
 const chunk=reader ? await reader.read() : {value:new Uint8Array()};
 const bytes=new Uint8Array(chunk.value||[]);
 await reader?.cancel(); // do not download whole WASM if Range was ignored.
 const signature=bytes.slice(0,4);
 const isWasm=signature.length===4&&signature[0]===0&&signature[1]===97&&signature[2]===115&&signature[3]===109;
 console.log(JSON.stringify({status:r.status,type:ct,cors:aco,received:bytes.length,signature:isWasm?'\0asm':'unexpected'},null,2));
 if(!r.ok||!(aco==='*'||aco===origin)||!isWasm) process.exitCode=1;
}catch(e){ console.error('R2 test failed:',e.message);process.exitCode=1; }
