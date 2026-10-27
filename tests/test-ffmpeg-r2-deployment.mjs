import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=p=>readFileSync(join(root,p),'utf8');
const loader=load('themes/high-tech-theme/static/js/audio/convert-audio/ffmpeg-loader.js');
async function invoke(meta){
 const opts=[];
 class FFmpeg {on(){}async load(x){opts.push(x)}terminate(){}}
 const c={console:{log(){},error(){}},document:{querySelector(){return meta?{content:meta}:null}},FFmpegWASM:{FFmpeg}};
 vm.createContext(c);vm.runInContext(loader,c);
 await vm.runInContext('getFFmpeg()',c);
 return opts[0];
}
test('When R2 configured, FFmpeg loader uses external WASM while core JS stays local',async()=>{
 const cfg=await invoke('https://assets.example.com/engines/ffmpeg/core.wasm');
 assert.equal(cfg.wasmURL,'https://assets.example.com/engines/ffmpeg/core.wasm');
 assert.equal(cfg.coreURL,'/js/audio/convert-audio/lib/ffmpeg-core.js');
});
test('In local development, old WASM path is retained when no Hugo R2 meta is set',async()=>{
 const cfg=await invoke(null);
 assert.equal(cfg.wasmURL,'/js/audio/convert-audio/lib/ffmpeg-core.wasm');
});
test('Non-HTTPS configured R2 URL rejected',async()=>{
 await assert.rejects(invoke('http://example.com/a.wasm'),/HTTPS is required/);
});
test('Hugo head declares the public R2 asset from site params without inline JS',()=>{
 assert.match(load('layouts/partials/head.html'),/easyfile-ffmpeg-wasm-url/);
 assert.match(load('config.toml'),/ffmpegWasmURL\s*=\s*""/);
});
test('Cloudflare-clean source does not embed FFmpeg WASM or backup JS',()=>{
 assert.equal(existsSync(join(root,'themes/high-tech-theme/static/js/audio/convert-audio/lib/ffmpeg-core.wasm')),false);
 assert.match(load('.gitignore'),/ffmpeg-core\.wasm/);
});
