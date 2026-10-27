import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const mediaSrc = read('themes/high-tech-theme/static/js/video/video-fast-paths.js');
const compressSrc = read('themes/high-tech-theme/static/js/video/compress-video/video-compressor.js');
const trimSrc = read('themes/high-tech-theme/static/js/video/trim-video/video-trimmer.js');
const audioSrc = read('themes/high-tech-theme/static/js/video/video-to-audio/video-audio-extractor.js');
const head = read('layouts/partials/head.html');

function mockBrowser({codec='aac', audio=true, video=true, copySupported=true}={}) {
  const ebml = Uint8Array.from([0x1a,0x45,0xdf,0xa3,0x42,0x86,0x81,0x01]).buffer;
  const mp4 = Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109]).buffer;
  const ogg = Uint8Array.from([79,103,103,83,0,2,0,0]).buffer;
  const callLog=[];
  let cancelCount=0;
  class Source {constructor(file){this.file=file;}}
  class Input {
    constructor({source}){this.source=source;}
    async getPrimaryVideoTrack(){return video ? {canDecode:async()=>true,getDisplayWidth:async()=>400,
      getDisplayHeight:async()=>246} : null;}
    async getPrimaryAudioTrack(){return audio ? {getCodec:async()=>codec}:null;}
    dispose(){}
  }
  class BufferTarget {constructor(){this.buffer=null;}}
  class Output {constructor({format,target}){this.format=format;this.target=target;}}
  class Quality {constructor(value){this.value=value;}}
  const Conversion = {async init(options){
    callLog.push(options);
    const types=[];
    if(video && !options.video?.discard && copySupported)types.push({type:'video'});
    if(audio && !options.audio?.discard && copySupported)types.push({type:'audio'});
    return {input:options.input,utilizedTracks:types,isValid:copySupported,
      async execute(){
        this.onProgress?.(0.67);
        options.output.target.buffer =
          options.output.format instanceof WebMOutputFormat ? ebml :
          options.output.format instanceof Mp4OutputFormat ? mp4 : ogg;
      },
      async cancel(){cancelCount++;}
    };
  }};
  class WebMOutputFormat {}
  class Mp4OutputFormat {}
  class OggOutputFormat {}
  class AdtsOutputFormat {}
  class Mp3OutputFormat {}
  class FlacOutputFormat {}
  const mb={Input,Output,Conversion,ALL_FORMATS:{},BlobSource:Source,BufferTarget,
    Quality,WebMOutputFormat,Mp4OutputFormat,OggOutputFormat,AdtsOutputFormat,
    Mp3OutputFormat,FlacOutputFormat};
  const ctx={window:{}, __testMediabunny:mb,isSecureContext:true,
    VideoDecoder:class{},VideoEncoder:{async isConfigSupported(){return {supported:true};}},
    Blob,ArrayBuffer,Uint8Array,DataView,console,Error};
  const injected = mediaSrc.replace('import(CDN)','Promise.resolve(globalThis.__testMediabunny)');
  assert.notEqual(injected,mediaSrc);
  vm.runInNewContext(injected,ctx);
  return {engine:ctx.window.EasyFileVideoFastPaths,callLog,
    get cancelCount(){return cancelCount;}};
}
function mockFile(name='in.mp4') {return {name,size:100000,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}

test('Audio AAC in MP4 -> M4A uses direct remux without decoding or video track',async()=>{
  const h=mockBrowser();
  const progress=[];
  const blob=await h.engine.extractAudio(mockFile(),
    {format:'m4a',sampleRate:'original',channels:'original',bitrate:'192k'},x=>progress.push(x));
  assert.equal(blob.type,'audio/mp4');
  assert.equal(h.callLog[0].video.discard,true);
  assert.equal(h.callLog[0].copy.mode,'forced');
  assert.ok(progress.includes(100));
});
test('Audio Opus -> OGG Opus stream copy when original settings retained',async()=>{
  const h=mockBrowser({codec:'opus'});
  const blob=await h.engine.extractAudio(mockFile('in.webm'),
    {format:'opus',sampleRate:'original',channels:'original'});
  assert.equal(blob.type,'audio/ogg');
});
test('Audio mismatched codec or resampling never attempts a fake stream copy',async()=>{
  const h=mockBrowser({codec:'aac'});
  assert.equal(await h.engine.extractAudio(mockFile(),
    {format:'mp3',sampleRate:'original',channels:'original'}),null);
  assert.equal(h.callLog.length,0);
  assert.equal(await h.engine.extractAudio(mockFile(),
    {format:'m4a',sampleRate:'44100',channels:'original'}),null);
  assert.equal(h.callLog.length,0);
});
test('Missing audio track yields explicit no-audio error instead of a silent empty file',async()=>{
  const h=mockBrowser({audio:false});
  await assert.rejects(h.engine.extractAudio(mockFile(),
    {format:'m4a',sampleRate:'original',channels:'original'}),
    {name:'FFprobeNoAudioStreamError'});
});
test('Trim Fast from 0 to 10s on MP4 copies tracks without encoding',async()=>{
  const h=mockBrowser();
  const blob=await h.engine.trim(mockFile(),
    {precision:'fast',start:0,end:10,keepAudio:true},'mp4');
  assert.equal(blob.type,'video/mp4');
  assert.equal(h.callLog[0].copy.mode,'forced');
  assert.equal(h.callLog[0].trim.end,10);
  assert.equal(h.callLog[0].video.codec,undefined);
});
test('Trim Fast at a non-zero start stays on existing FFmpeg path',async()=>{
  const h=mockBrowser();
  const result=await h.engine.trim(mockFile(),
    {precision:'fast',start:3,end:12,keepAudio:true},'mp4');
  assert.equal(result,null);
  assert.equal(h.callLog.length,0);
});
test('Trim Accurate to WebM explicitly encodes VP9 and never VP8',async()=>{
  const h=mockBrowser();
  const blob=await h.engine.trim(mockFile(),
    {precision:'accurate',start:2.5,end:12,keepAudio:true,quality:'balanced'},'webm');
  assert.equal(blob.type,'video/webm');
  assert.equal(h.callLog[0].video.codec,'vp9');
  assert.equal(h.callLog[0].video.quality.value,'medium');
  assert.equal(h.callLog[0].copy,false);
  assert.equal(h.callLog[0].audio.codec,'opus');
});
test('Trim Accurate MP4 stays on existing FFmpeg; no unsupported AVC acceleration',async()=>{
  const h=mockBrowser();
  assert.equal(await h.engine.trim(mockFile(),
    {precision:'accurate',start:3,end:12,keepAudio:true},'mp4'),null);
  assert.equal(h.callLog.length,0);
});
test('Failed remux validity returns error so callers can fall back to FFmpeg',async()=>{
  const h=mockBrowser({copySupported:false});
  await assert.rejects(h.engine.extractAudio(mockFile(),
    {format:'m4a',sampleRate:'original',channels:'original'}),/Requested tracks/);
});
test('Large files reject optional BufferTarget paths instead of allocating huge RAM',async()=>{
  const h=mockBrowser();
  const f={...mockFile(),size:193*1024*1024};
  assert.equal(await h.engine.trim(f,{precision:'accurate',start:0,end:10},'webm'),null);
  assert.equal(await h.engine.extractAudio(f,
    {format:'m4a',sampleRate:'original',channels:'original'}),null);
});

test('All three operation scripts call browser acceleration before loading FFmpeg',()=>{
  for (const [name,src,needle] of [
    ['compress',compressSrc,'EasyFileWebCodecs.convertFile'],
    ['trim',trimSrc,'EasyFileVideoFastPaths.trim'],
    ['audio',audioSrc,'EasyFileVideoFastPaths.extractAudio']
  ]) {
    assert.ok(src.indexOf(needle)>=0, name);
    assert.ok(src.indexOf(needle)<src.indexOf('await getFFmpeg()'),name);
    assert.match(src,/if \(state\.cancelled \|\| state\.paused/);
    assert.match(src,/resetFFmpeg\(\)/);
  }
});
test('Hugo loads only the tiny controller on relevant pages',()=>{
  const compress=head.split('{{ if eq .Params.operation "compress-video" }}')[1].split('{{ end }}')[0];
  const trim=head.split('{{ if eq .Params.operation "trim-video" }}')[1].split('{{ end }}')[0];
  const audio=head.split('{{ if eq .Params.operation "video-to-audio" }}')[1].split('{{ end }}')[0];
  assert.match(compress,/video-webcodecs\.js/);
  assert.match(trim,/video-fast-paths\.js/);
  assert.match(audio,/video-fast-paths\.js/);
  assert.match(mediaSrc,/import\(CDN\)/);
});

function operationHarness(script, apiName, browserName, method, {webBlob=true, rejectWeb=false}={}) {
  const events=[],loads=[],commands=[],cancelCalls=[];
  class TestFile {constructor(name='clip.mp4') {this.name=name;this.size=110;} async arrayBuffer(){return new Uint8Array([0,1,2]).buffer;}}
  const target = new Blob([Uint8Array.from([0x1a,0x45,0xdf,0xa3,0,0,0,0])],{type:'video/webm'});
  const browser = {
    async [method](...args){
      if (rejectWeb)throw new Error('forced browser failure');
      const progress=args.at(-1);progress(55);
      return webBlob ? (method === 'convertFile' ? {blob:target,codec:'vp9'} : target) : null;
    },
    async cancel(){cancelCalls.push(true);}
  };
  const ffmpeg={on(){},off(){},async deleteFile(){}};
  const ctx={
    window:{[browserName]:browser},
    console:{log(){},info(){},error(){},warn(){},debug(){}},
    document:{dispatchEvent:e=>events.push(e)},
    CustomEvent:class {constructor(name,{detail}){this.name=name;this.detail=detail;}},
    File:TestFile,Blob,URL:{createObjectURL:()=> 'blob:test'},Uint8Array,
    setTimeout,
    EasyFileAudioEncodingProfiles:{getProfile:()=>({codecArgs:['-c:a','aac','-b:a','192k'],muxerArgs:[]})},
    getFFmpeg:async()=>{loads.push(true);return ffmpeg;},
    writeFile:async()=>{},readFile:async()=>new Uint8Array([1,2,3]),
    exec:async args=>{commands.push(args);},resetFFmpeg:async()=>{}
  };
  vm.runInNewContext(script,ctx);
  return {api:ctx.window[apiName],events,loads,commands,browser,cancelCalls,File:TestFile};
}

test('Compress WebM finishes with VP9 path, updates progress, skips FFmpeg',async()=>{
  const h=operationHarness(compressSrc,'VideoCompressor','EasyFileWebCodecs','convertFile');
  await h.api.compressFiles([new h.File()], {preset:'balanced',container:'webm',keepSmaller:false});
  assert.equal(h.loads.length,0);
  assert.ok(h.events.some(e=>e.name==='easyfiletools:video-compress-progress'&&e.detail.percentage===55));
  assert.ok(h.events.some(e=>e.name==='easyfiletools:video-compress-complete'));
  assert.equal(h.events.findLast(e=>e.name==='easyfiletools:video-compression-ended').detail.error,null);
});
test('Compress WebM browser error uses FFmpeg fallback without returning wrong container',async()=>{
  const h=operationHarness(compressSrc,'VideoCompressor','EasyFileWebCodecs','convertFile',{rejectWeb:true});
  await h.api.compressFiles([new h.File()], {preset:'balanced',container:'webm',keepSmaller:false});
  assert.equal(h.loads.length,1);
  assert.ok(h.commands[0].includes('libvpx'));
});
test('Trim Fast browser optimization reports correct output without FFmpeg',async()=>{
  const h=operationHarness(trimSrc,'VideoTrimmer','EasyFileVideoFastPaths','trim');
  await h.api.trimFiles([{file:new h.File(),index:0,start:0,end:10,duration:10,
    precision:'fast',outputFormat:'webm',quality:'high',keepAudio:true}]);
  assert.equal(h.loads.length,0);
  assert.ok(h.events.some(e=>e.name==='easyfiletools:trim-video-complete'));
});
test('Trim rejected browser path falls back to original FFmpeg fast copy',async()=>{
  const h=operationHarness(trimSrc,'VideoTrimmer','EasyFileVideoFastPaths','trim',{webBlob:false});
  await h.api.trimFiles([{file:new h.File(),index:0,start:1,end:10,duration:9,
    precision:'fast',outputFormat:'mp4',quality:'high',keepAudio:true}]);
  assert.equal(h.loads.length,1);
  assert.ok(h.commands[0].includes('copy'));
});
test('Video to Audio compatible stream copy avoids FFmpeg loader',async()=>{
  const h=operationHarness(audioSrc,'VideoAudioExtractor','EasyFileVideoFastPaths','extractAudio');
  await h.api.extractFiles([new h.File()], {format:'m4a',bitrate:'192k',sampleRate:'original',channels:'original'});
  assert.equal(h.loads.length,0);
  assert.ok(h.events.some(e=>e.name==='easyfiletools:video-audio-complete'));
});
test('Video to Audio rejected browser path falls back to FFmpeg transcoding',async()=>{
  const h=operationHarness(audioSrc,'VideoAudioExtractor','EasyFileVideoFastPaths','extractAudio',{webBlob:false});
  await h.api.extractFiles([new h.File()], {format:'mp3',bitrate:'192k',sampleRate:'original',channels:'original'});
  assert.equal(h.loads.length,1);
  assert.ok(h.commands[0].includes('-vn'));
});

test('Compress WebM Cancel aborts browser processing without starting FFmpeg',async()=>{
  const h=operationHarness(compressSrc,'VideoCompressor','EasyFileWebCodecs','convertFile');
  let rejectCurrent;
  h.browser.convertFile=()=>new Promise((resolve,reject)=>{rejectCurrent=reject;});
  h.browser.cancel=async()=>{
    const e=new Error('user cancelled');e.name='ConversionCanceledError';rejectCurrent?.(e);
  };
  const running=h.api.compressFiles([new h.File()],{preset:'balanced',container:'webm',keepSmaller:false});
  await Promise.resolve();
  await h.api.cancel();
  await running;
  assert.equal(h.loads.length,0);
  assert.equal(h.events.findLast(e=>e.name==='easyfiletools:video-compression-ended')?.detail.cancelled,true);
  assert.equal(h.events.filter(e=>e.name==='easyfiletools:video-compress-complete').length,0);
});

test('Audio direct-copy Pause / immediate Resume retries the same file',async()=>{
  const h=operationHarness(audioSrc,'VideoAudioExtractor','EasyFileVideoFastPaths','extractAudio');
  let rejectCurrent,calls=0;
  h.browser.extractAudio=()=>{
    if (++calls===1)return new Promise((_resolve,reject)=>{rejectCurrent=reject;});
    return new Blob([Uint8Array.from([79,103,103,83,0,2,0,0])],{type:'audio/ogg'});
  };
  h.browser.cancel=async()=>{
    const e=new Error('pause');e.name='ConversionCanceledError';rejectCurrent?.(e);
  };
  const running=h.api.extractFiles([new h.File()],{
    format:'opus',bitrate:'192k',sampleRate:'original',channels:'original'
  });
  await Promise.resolve();
  await h.api.pause();
  h.api.resume();
  await running;
  assert.equal(calls,2);
  assert.equal(h.loads.length,0);
  assert.ok(h.events.some(e=>e.name==='easyfiletools:video-audio-complete'));
});

test('Compress Strong preserves the prior FFmpeg profile until VP9 Low quality is validated',async()=>{
  const h=operationHarness(compressSrc,'VideoCompressor','EasyFileWebCodecs','convertFile');
  let calls=0;
  h.browser.convertFile=async()=>{calls++;return null;};
  await h.api.compressFiles([new h.File()], {preset:'strong',container:'webm',keepSmaller:false});
  assert.equal(calls,0);
  assert.equal(h.loads.length,1);
  assert.ok(h.commands[0].includes('libvpx'));
});
