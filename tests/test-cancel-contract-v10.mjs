import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const src=(p)=>readFileSync(resolve(root,p),'utf8');
const controller=src('themes/high-tech-theme/static/js/common/operation/operation-controller.js');
const compressor=src('themes/high-tech-theme/static/js/video/compress-video/video-compressor.js');
const loader=src('themes/high-tech-theme/static/js/audio/convert-audio/ffmpeg-loader.js');
const zone=src('themes/high-tech-theme/static/js/common/operation-zone.js');
const files=src('themes/high-tech-theme/static/js/common/file-list.js');
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
function controllerHarness(){
 const events=[],hooks={},button=()=>({disabled:false,classList:{toggle(){}},addEventListener(){},innerHTML:''});
 const elements={'operation-zone':{dataset:{operation:'compress-video'}},convertBtn:button(),cancelOperationBtn:button(),pauseOperationBtn:button()};
 const progress={percentage:61,reset(){this.percentage=0;}};
 const document={getElementById:id=>elements[id]||null,addEventListener:(name,fn)=>{(hooks[name]??=[]).push(fn);},dispatchEvent:e=>{events.push(e);for(const fn of hooks[e.type]||[])fn(e);}};
 const window={EasyFileOperationConfig:{get:()=>({})},EasyFileOperationProgress:progress};
 const ctx={window,document,console:{log(){},warn(){},error(){}},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},setTimeout};
 vm.runInNewContext(controller,ctx);
 for(const fn of hooks.DOMContentLoaded||[])fn();
 return{api:window.EasyFileOperationController,events,progress,elements};
}
test('Generic Pause -> Cancel immediately resets percent and cannot resurrect paused after async pause',async()=>{
 const h=controllerHarness(),gate=pending(),runGate=pending();let cancels=0;
 h.api.registerAdapter({run:()=>runGate.promise,pause:()=>gate.promise,resume:()=>{},cancel:async()=>{cancels++;runGate.resolve();}});
 h.api.setReady(true);
 const run=h.api.run();
 assert.equal(h.api.getState().status,'running');
 const pause=h.api.pause();
 assert.equal(h.api.getState().status,'paused','Pause must reserve state synchronously');
 h.progress.percentage=83;
 const cancel=h.api.cancel();
 assert.equal(h.progress.percentage,0,'percentage must reset before async cancel resolves');
 assert.equal(h.api.getState().status,'cancelling');
 assert.equal(h.events.some(e=>e.type==='easyfiletools:operation-cancel-requested'),true);
 await cancel;
 assert.equal(h.api.getState().status,'cancelled');
 gate.resolve();
 assert.equal(await pause,false);
 assert.equal(h.api.getState().status,'cancelled');
 assert.equal(cancels,1);
 assert.equal(await run,false);
 assert.equal(h.progress.percentage,0);
});
test('Generic controller does not allow a second Run while a cancelled worker is still pending',async()=>{
 const h=controllerHarness(),gate=pending();let starts=0;
 h.api.registerAdapter({run:()=>{starts++;return gate.promise;},cancel:async()=>{}});
 h.api.setReady(true);
 const first=h.api.run();
 await h.api.cancel();
 assert.equal(h.api.getState().status,'cancelled');
 assert.equal(h.elements.convertBtn.disabled,true);
 assert.equal(h.elements.cancelOperationBtn.disabled,false,'Cancel should remain retryable until the worker settles');
 assert.equal(await h.api.cancel(),true);
 assert.equal(await h.api.run(),false);
 assert.equal(starts,1);
 gate.resolve();await first;
 assert.equal(h.elements.convertBtn.disabled,false);
 assert.equal(h.elements.cancelOperationBtn.disabled,true);
});
function compressorHarness(){
 const events=[],current=pending(),pauseGate=pending(),cancelCalls=[];
 class InputFile{constructor(){this.name='example.mp4';this.size=500;}async arrayBuffer(){return new ArrayBuffer(10);}}
 const browser={convertFile:()=>current.promise,cancel:async()=>{cancelCalls.push(true);current.reject(Object.assign(new Error('interrupted'),{name:'ConversionCanceledError'}));await pauseGate.promise;}};
 const ctx={window:{EasyFileWebCodecs:browser},console:{log(){},warn(){},error(){},info(){}},File:InputFile,
  Blob,Uint8Array,setTimeout,URL:{createObjectURL:()=>'blob:ok'},getFFmpeg:async()=>{throw new Error('FFmpeg fallback should never start on user cancel');},
  resetFFmpeg:()=>{},document:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(name,{detail}={}){this.name=name;this.detail=detail;}}};
 vm.runInNewContext(compressor,ctx);
 return{engine:ctx.window.VideoCompressor,browser,events,current,pauseGate,cancelCalls,InputFile};
}
test('Compress WebM: Pause -> Cancel interrupts worker; no result, no post-cancel progress',async()=>{
 const h=compressorHarness();
 const work=h.engine.compressFiles([new h.InputFile()],{preset:'balanced',container:'webm',keepSmaller:false});
 await flush();
 const pause=h.engine.pause();
 await flush();
 const cancel=h.engine.cancel();
 h.pauseGate.resolve();
 await Promise.all([pause,cancel,work]);
 assert.equal(h.events.some(e=>e.name==='easyfiletools:video-compress-complete'),false);
 assert.equal(h.events.findLast(e=>e.name==='easyfiletools:video-compression-ended')?.detail.cancelled,true);
 assert.equal(h.cancelCalls.length,2);
});
test('Common progress UI gates callbacks from a cancelled job and resets per-file bars',()=>{
 assert.match(zone,/easyfiletools:operation-cancel-requested/);
 assert.match(zone,/ignoreCancelledProgress = true/);
 assert.match(zone,/if \(ignoreCancelledProgress\) return;/);
 assert.match(files,/easyfiletools:operation-cancel-requested/);
 assert.match(files,/easyFileIgnoreCancelledFileProgress = true/);
});
test('Lazy FFmpeg loading cannot resurrect a worker cancelled during initialization',async()=>{
 const gate=pending(),instances=[];
 class FFmpeg{constructor(){instances.push(this);this.terminated=false;}on(){}async load(){await gate.promise;}terminate(){this.terminated=true;}}
 const ctx={FFmpegWASM:{FFmpeg},console:{log(){},error(){}},Promise,Error};
 vm.runInNewContext(loader,ctx);
 const loading=vm.runInNewContext('getFFmpeg()',ctx);
 vm.runInNewContext('resetFFmpeg()',ctx);
 gate.resolve();
 await assert.rejects(loading,/interrupted/);
 assert.equal(instances[0].terminated,true);
 const fresh=await vm.runInNewContext('getFFmpeg()',ctx);
 assert.equal(fresh.terminated,false);
 assert.equal(instances.length,2);
});
