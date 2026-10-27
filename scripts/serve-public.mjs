#!/usr/bin/env node
// Preview a Hugo production build locally with no npm dependencies.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] || 'public');
const port = Number(process.argv[3] || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.mp4':'video/mp4','.mp3':'audio/mpeg'};
try { await fs.stat(path.join(root,'index.html')); } catch { console.error(`Build missing in ${root}. Run hugo --minify first.`); process.exit(1); }
if(!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Invalid port'); process.exit(1); }
http.createServer(async (req,res) => {
  if(!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname); }
  catch { res.writeHead(400);res.end();return; }
  if(pathname.includes('\0') || pathname.includes('\\')) { res.writeHead(400);res.end();return; }
  let location=path.resolve(root, `.${pathname}`);
  if(location!==root && !location.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  try {
    const info=await fs.stat(location);
    if(info.isDirectory()) location=path.join(location,'index.html');
    const buf=await fs.readFile(location);
    res.writeHead(200,{'Content-Type': mime[path.extname(location).toLowerCase()]||'application/octet-stream','Content-Length':buf.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD' ? undefined : buf);
  } catch { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Production preview: http://127.0.0.1:${port}/  (${root})\nStop with Ctrl+C`));
