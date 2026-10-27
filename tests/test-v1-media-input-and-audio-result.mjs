import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const common = 'themes/high-tech-theme/static/js/common/file-policy.js';
const audioAdapter = 'themes/high-tech-theme/static/js/audio/convert-audio/convert-audio-operation.js';

function policyInstance() {
  const context = vm.createContext({ window: {}, navigator: {}, File, Blob, TextDecoder, Uint8Array, DataView, console });
  vm.runInContext(fs.readFileSync(common, 'utf8'), context);
  return context.window.EasyFilePolicy;
}

const asFile = (buffer, name) => new File([buffer], name);

test('MP4, PDF and WAV falsely renamed as MP3 are rejected at upload inspection', async () => {
  const policy = policyInstance();
  const cases = [
    asFile(Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 0, 0]), 'renamed.mp3'),
    asFile(Buffer.from('%PDF-1.7\n'), 'renamed.mp3'),
    asFile(Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'binary'), 'renamed.mp3')
  ];
  for (const file of cases) {
    const result = await policy.inspect(file);
    assert.equal(result.ok, false, file.name);
    assert.match(result.reason, /\.mp3/);
  }
});

test('genuine MP3 signatures including ID3 tag and raw MPEG audio frame are allowed', async () => {
  const policy = policyInstance();
  const id3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
  const frame = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  assert.equal((await policy.inspect(asFile(id3, 'with-tags.mp3'))).ok, true);
  assert.equal((await policy.inspect(asFile(frame, 'raw-frame.mp3'))).ok, true);
});

test('supported audio extensions reject obvious mismatches', async () => {
  const policy = policyInstance();
  const wav = Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'binary');
  for (const ext of ['aac','m4a','m4b','wma','aiff','aif','aifc','amr','au','snd','ac3']) {
    const result = await policy.inspect(asFile(wav, `wrong.${ext}`));
    assert.equal(result.ok, false, ext);
  }
});

function setupAudioAdapter({ successfulFiles=0, cancelled=false } = {}) {
  const handlers = new Map();
  let adapter;
  const context = vm.createContext({
    console,
    window: {
      EasyFileOperationController: {
        registerAdapter(value) { adapter = value; },
        setReady() {},
        initialize() {}
      },
      EasyFileOperationConfig: { get() {return {};} },
      EasyFileOperationLifecycle: {settingsChanged(){}}
    },
    document: {
      getElementById(id) {
        if (id === 'operation-zone') return {dataset:{operation:'convert-audio',category:'Audio'}};
        if (id === 'chooseFormatLabel') return {classList:{add(){},remove(){}}};
        return null;
      },
      addEventListener(event, handler, options) {
        const list = handlers.get(event) || [];
        list.push({ handler, once: !!options?.once });
        handlers.set(event, list);
      },
      dispatchEvent(event) {
        const list = [...(handlers.get(event.type) || [])];
        for (const entry of list) {
          if (entry.once) handlers.set(event.type, (handlers.get(event.type)||[]).filter(item=>item!==entry));
          entry.handler(event);
        }
      }
    },
    CustomEvent: class { constructor(type,options={}) { this.type=type;this.detail=options.detail; } },
    showNotification() {}
  });
  vm.runInContext(fs.readFileSync(audioAdapter,'utf8'),context);
  const emit = (type,detail) => context.document.dispatchEvent(new context.CustomEvent(type,{detail}));
  emit('DOMContentLoaded');
  emit('easyfiletools:operation-files-updated',{operation:'convert-audio',files:[{file:asFile(Buffer.from('ID3\u0003\0\0\0\0\0\0'), 'a.mp3')} ]});
  emit('easyfiletools:conversion-format-selected',{format:'wav'});
  context.document.addEventListener('easyfiletools:conversion-requested', () => {
    for (let index=0; index<successfulFiles; index++) emit('easyfiletools:file-converted',{index, size:44, outputFormat:'wav'});
    emit('easyfiletools:conversion-ended',{category:'Audio',cancelled});
  });
  return adapter;
}

test('Convert Audio adapter rejects conversion end with no completed output', async () => {
  const adapter = setupAudioAdapter();
  assert.ok(adapter);
  await assert.rejects(adapter.run(),/no valid result was produced/);
});

test('Convert Audio adapter accepts a run with a completed output', async () => {
  const adapter = setupAudioAdapter({successfulFiles:1});
  await assert.doesNotReject(adapter.run());
});
