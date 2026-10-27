import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const converter = read('themes/high-tech-theme/static/js/video/convert-video/video-converter.js');
const browserEngine = read('themes/high-tech-theme/static/js/video/convert-video/video-webcodecs.js');
const settingsHtml = read('themes/high-tech-theme/layouts/partials/video/convert-video-settings.html');
const head = read('layouts/partials/head.html');
const help = JSON.parse(read('data/seo/tools.json'))['convert-video'];

function createHarness({webResult, failWeb, codec='h264', audio='aac'} = {}) {
  const emitted = [], ffmpegArgs = [], loaded = [];
  let cancels = 0, webCalls = 0;
  class TestFile {
    constructor(name='input.mp4') {this.name=name;}
    async arrayBuffer() {return new Uint8Array([1,2,3]).buffer;}
  }
  const fakeFFmpeg = {
    on(){}, off(){},
    async ffprobe(){},
    async readFile(name) {
      if (name.startsWith('eft_video_probe_')) {
        return JSON.stringify({streams: [
          {codec_type:'video',codec_name:codec},
          ...(audio ? [{codec_type:'audio',codec_name:audio}] : [])
        ]});
      }
      return new Uint8Array([1,2,3]);
    },
    async deleteFile() {}
  };
  const sandbox = {
    console:{log(){},info(){},warn(){},error(){}},
    window:{
      EasyFileWebCodecs:{
        async convertFile(...args) {
          webCalls++;
          if (failWeb) throw new Error(failWeb);
          args[2](95);
          return webResult || {blob:new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3])],{type:'video/webm'}), codec:'vp8'};
        },
        async cancel() { cancels++; }
      }
    },
    document:{dispatchEvent:e=>emitted.push(e)},
    CustomEvent:class {constructor(name,{detail}){this.name=name;this.detail=detail;}},
    File:TestFile, Blob, Uint8Array, URL:{createObjectURL:()=> 'blob:result'},
    setInterval, clearInterval,
    getFFmpeg:async()=>{loaded.push(true);return fakeFFmpeg;},
    writeFile:async()=>{},readFile:async name=>fakeFFmpeg.readFile(name),
    exec:async args=>{ffmpegArgs.push(args)}, resetFFmpeg:async()=>{}
  };
  vm.runInNewContext(converter,sandbox);
  const run = async settings => {
    await sandbox.window.VideoConverter.convertFiles([new TestFile()],{
      format:'webm',quality:'medium',resolution:'original',keepAudio:true,fastCopy:true,...settings
    });
    return emitted.findLast(e=>e.name==='easyfiletools:video-conversion-ended')?.detail;
  };
  return {run,ffmpegArgs,loaded,emitted,sandbox,get webCalls(){return webCalls;},get cancels(){return cancels;}};
}

test('WebM uses WebCodecs first, without creating or loading FFmpeg.wasm', async()=>{
  const h=createHarness();
  assert.equal((await h.run()).error,null);
  assert.equal(h.webCalls,1);
  assert.equal(h.loaded.length,0);
  const complete=h.emitted.find(e=>e.name==='easyfiletools:video-convert-complete');
  assert.equal(complete.detail.result.outputFormat,'webm');
  assert.equal(complete.detail.result.outputSize,4);
  assert.ok(h.emitted.some(e=>e.name==='easyfiletools:video-convert-progress'&&e.detail.percentage===95));
});

test('WebCodecs rejection falls back to original FFmpeg WebM codec', async()=>{
  const h=createHarness({failWeb:'VP9 unsupported'});
  assert.equal((await h.run()).error,null);
  assert.equal(h.webCalls,1);
  assert.equal(h.loaded.length,1);
  assert.ok(h.ffmpegArgs[0].includes('libvpx'));
  assert.ok(!h.ffmpegArgs[0].includes('copy'));
});

test('FFmpeg stream copy is independent of quality selection', async()=>{
  const h=createHarness({codec:'h264'});
  assert.equal((await h.run({format:'mkv',quality:'high',fastCopy:true})).error,null);
  assert.equal(h.webCalls,0);
  assert.ok(h.ffmpegArgs[0].includes('copy'));
});

test('Unchecking stream copy forces encoding even for compatible MKV streams', async()=>{
  const h=createHarness({codec:'h264'});
  assert.equal((await h.run({format:'mkv',quality:'medium',fastCopy:false})).error,null);
  assert.ok(h.ffmpegArgs[0].includes('libx264'));
  assert.ok(!h.ffmpegArgs[0].includes('copy'));
});

test('Quality controls are exactly Low, Medium, High (medium initially), copying separately controlled',()=>{
  assert.deepEqual([...settingsHtml.matchAll(/<option\s+value="(low|medium|high)"/g)].map(m=>m[1]), ['medium','low','high']);
  assert.match(settingsHtml,/<option value="medium" selected>/);
  assert.match(settingsHtml,/id="convertVideoFastCopy"/);
  assert.doesNotMatch(settingsHtml,/value="fast"/);
  assert.match(head,/js\/video\/convert-video\/video-webcodecs\.js/);
  assert.match(help.faq.map(x=>x.question).join(' '),/quality/i);
  assert.match(help.faq.map(x=>x.answer).join(' '),/FFmpeg\.wasm/);
});

test('Production WebCodecs module gates unsupported environments before importing CDN',async()=>{
  const sandbox={window:{},globalThis:{isSecureContext:false,VideoEncoder:undefined,VideoDecoder:undefined}};
  vm.runInNewContext(browserEngine,sandbox);
  await assert.rejects(sandbox.window.EasyFileWebCodecs.convertFile({size:1},{format:'webm'}),/WebCodecs is unavailable/);
});

test('Production WebCodecs module lazily uses VP9 only for encoding; keeps copy and cancel',()=>{
  assert.match(browserEngine,/import\(CDN\)/);
  assert.match(browserEngine,/mediabunny@1\.61\.6/);
  assert.doesNotMatch(browserEngine,/\['vp8', 'no-preference'\]/);
  assert.doesNotMatch(browserEngine,/\['vp8', 'prefer-software'\]/);
  assert.match(browserEngine,/\['vp8', 'vp9', 'av1'\]\.includes\(originalCodec\)/);
  assert.match(browserEngine,/\['vp9', 'no-preference'\]/);
  assert.match(browserEngine,/async function cancel\(/);
  assert.match(browserEngine,/conversion\.execute\(\)/);
  assert.match(browserEngine,/conversion\.onProgress/);
  assert.match(browserEngine,/output\.target\.buffer/);
  assert.match(browserEngine,/targetSize\(w, h, settings\.resolution\)/);
});

test('Cancel during WebCodecs conversion does not trigger the FFmpeg fallback', async()=>{
  const h=createHarness();
  let rejectCurrent;
  h.sandbox.window.EasyFileWebCodecs.convertFile=async()=>
    new Promise((_resolve,reject)=>{rejectCurrent=reject;});
  h.sandbox.window.EasyFileWebCodecs.cancel=async()=>{
    const e=new Error('Browser conversion cancelled');e.name='ConversionCanceledError';
    rejectCurrent?.(e);
  };
  const running=h.run();
  await Promise.resolve();
  await h.sandbox.window.VideoConverter.cancel();
  const end=await running;
  assert.equal(end.cancelled,true);
  assert.equal(h.loaded.length,0);
  assert.ok(!h.emitted.some(e=>e.name==='easyfiletools:video-convert-complete'));
});

test('Pause → Resume restarts interrupted WebCodecs file instead of throwing', async()=>{
  const h=createHarness();
  let rejectCurrent, calls=0;
  const output = new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3])],{type:'video/webm'});
  h.sandbox.window.EasyFileWebCodecs.convertFile=async()=>{
    if (++calls===1) return new Promise((_resolve,reject)=>{rejectCurrent=reject;});
    return {blob:output,codec:'vp8'};
  };
  h.sandbox.window.EasyFileWebCodecs.cancel=async()=>{
    const e=new Error('Paused conversion');e.name='ConversionCanceledError';
    rejectCurrent?.(e);
  };
  const running=h.run();
  await Promise.resolve();
  await h.sandbox.window.VideoConverter.pause();
  h.sandbox.window.VideoConverter.resume();
  const end=await running;
  assert.equal(end.error,null);
  assert.equal(end.cancelled,false);
  assert.equal(calls,2);
  assert.equal(h.loaded.length,0);
});


// Exercise the actual production WebCodecs controller in a VM. Replace ONLY
// the network import with a locally supplied Mediabunny fake; do not bypass
// encoder selection, copy decisions, isConfigSupported or Conversion.init.
function makeProductionWebMEngine({sourceCodec='h264', supportVP9=true, firstAttemptFails=false}={}) {
  const probeConfigs=[];
  const attempts=[];
  let executionCount=0;
  const EBML = new Uint8Array([0x1a,0x45,0xdf,0xa3,0x42,0x86]).buffer;
  class BlobSource {constructor(file){this.file=file;}}
  class Input {
    constructor({source}) {this.source=source;}
    async getPrimaryVideoTrack(){return {
      getDisplayWidth: async()=>400, getDisplayHeight:async()=>246,
      getCodec:async()=>sourceCodec, canDecode:async()=>true
    };}
    async getPrimaryAudioTrack(){return null;}
    dispose(){}
  }
  class BufferTarget {constructor(){this.buffer=EBML;}}
  class Output {constructor({target}){this.target=target;}}
  class Quality {constructor(level){this.level=level;}}
  const Conversion = {
    async init(options){
      const v=options.video;
      attempts.push({codec:v.codec||'copy',quality:v.quality?.level,
        hardwareAcceleration:v.hardwareAcceleration,forceTranscode:v.forceTranscode,
        copy:options.copy});
      if(firstAttemptFails && v.hardwareAcceleration==='no-preference') {
        throw new Error('unsupported encoder configuration');
      }
      return {isValid:true,utilizedTracks:[{type:'video'}],onProgress:null,
        async execute(){executionCount++;this.onProgress?.(0.5);},cancel:async()=>{}};
    }
  };
  const mb={Input,Output,Conversion,ALL_FORMATS:{},BlobSource,BufferTarget,
    WebMOutputFormat:class {},Quality};
  const ctx={
    window:{}, isSecureContext:true, VideoDecoder:class{},
    VideoEncoder:{async isConfigSupported(config){
      probeConfigs.push({...config});
      return {supported: supportVP9 && config.codec.startsWith('vp09.')};
    }},
    __testMediabunny:mb, Blob, ArrayBuffer, Uint8Array,DataView,console
  };
  vm.runInNewContext(browserEngine.replace('import(CDN)', 'Promise.resolve(globalThis.__testMediabunny)'),ctx);
  return {engine:ctx.window.EasyFileWebCodecs,attempts,probeConfigs,
    get executionCount(){return executionCount;}};
}

test('A real WebM re-encode in production controller selects VP9 Medium, not VP8',async()=>{
  const h=makeProductionWebMEngine();
  const progress=[];
  const res=await h.engine.convertFile({size:1024,name:'source.mp4'},
    {format:'webm',quality:'medium',resolution:'original',fastCopy:true,keepAudio:false},
    percent=>progress.push(percent));
  assert.equal(res.codec,'vp9');
  assert.equal(h.attempts.length,1);
  assert.equal(h.attempts[0].quality,'medium');
  assert.equal(h.attempts[0].forceTranscode,true);
  assert.ok(h.probeConfigs.every(c=>c.codec.startsWith('vp09.')));
  assert.equal(h.executionCount,1);
  assert.ok(progress.includes(100));
});

test('If no-preference VP9 fails, prefer-software VP9 is tried (never VP8)',async()=>{
  const h=makeProductionWebMEngine({firstAttemptFails:true});
  const res=await h.engine.convertFile({size:1024,name:'source.mp4'},
    {format:'webm',quality:'high',resolution:'original',fastCopy:false,keepAudio:false});
  assert.equal(res.codec,'vp9');
  assert.deepEqual(h.attempts.map(a=>a.codec),['vp9','vp9']);
  assert.deepEqual(h.attempts.map(a=>a.hardwareAcceleration),['no-preference','prefer-software']);
  assert.ok(h.probeConfigs.every(c=>c.codec.startsWith('vp09.')));
});

test('No VP9 support prevents WebCodecs VP8 encode, enabling FFmpeg fallback',async()=>{
  const h=makeProductionWebMEngine({supportVP9:false});
  await assert.rejects(h.engine.convertFile({size:1024,name:'source.mp4'},
    {format:'webm',quality:'low',resolution:'original',fastCopy:false,keepAudio:false}),
    /No supported WebM encoder configuration/);
  assert.equal(h.executionCount,0);
  assert.deepEqual(h.attempts,[]);
  assert.ok(h.probeConfigs.every(c=>c.codec.startsWith('vp09.')));
});

test('Existing compatible VP8 track may still be stream-copied without encoding',async()=>{
  const h=makeProductionWebMEngine({sourceCodec:'vp8', supportVP9:false});
  const res=await h.engine.convertFile({size:1024,name:'source.webm'},
    {format:'webm',quality:'high',resolution:'original',fastCopy:true,keepAudio:false});
  assert.equal(res.codec,'copy');
  assert.equal(h.executionCount,1);
  assert.equal(h.attempts[0].codec,'copy');
  assert.equal(h.probeConfigs.length,0);
});

test('Disabling copy for VP8 input requires VP9 encoder (or FFmpeg)',async()=>{
  const h=makeProductionWebMEngine({sourceCodec:'vp8'});
  const res=await h.engine.convertFile({size:1024,name:'source.webm'},
    {format:'webm',quality:'low',resolution:'original',fastCopy:false,keepAudio:false});
  assert.equal(res.codec,'vp9');
  assert.deepEqual(h.attempts.map(a=>a.codec),['vp9']);
});
