/* EasyFile Tools — opt-in browser fast paths for Trim Video and Video to Audio.
 * Mediabunny 1.61.6 is imported only after the user begins an eligible job.
 * When a path cannot guarantee the requested output, the calling operation
 * falls back to its unchanged FFmpeg.wasm path.
 * The validated Convert Video VP9 engine is intentionally not modified.
 */
(() => {
  'use strict';

  const CDN = 'https://esm.sh/mediabunny@1.61.6?bundle&target=es2022';
  const MAX_INPUT_BYTES = 192 * 1024 * 1024; // BufferTarget holds output in RAM.
  let libraryPromise = null;
  let active = null;
  let epoch = 0;

  function unsupported(message) {
    const error = new Error(message);
    error.code = 'EFT_FAST_PATH_UNSUPPORTED';
    return error;
  }
  function check(token) {
    if (token !== epoch) {
      const error = new Error('Media operation interrupted by the user.');
      error.name = 'ConversionCanceledError';
      throw error;
    }
  }
  async function library() {
    if (!libraryPromise) {
      libraryPromise = import(CDN).catch(error => {
        libraryPromise = null;
        throw unsupported('Browser media library unavailable: ' + (error?.message || error));
      });
    }
    return libraryPromise;
  }
  function eligible(file) {
    return file && file.size > 0 && file.size <= MAX_INPUT_BYTES;
  }
  function report(callback, progress) {
    if (typeof callback === 'function') {
      callback(Math.round(100 * Math.max(0, Math.min(1, progress))));
    }
  }
  function validSignature(buffer, kind) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 8) return false;
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12));
    const ascii = (start, count) => String.fromCharCode(...bytes.slice(start, start + count));
    if (kind === 'webm') return new DataView(buffer).getUint32(0, false) === 0x1a45dfa3;
    if (kind === 'mp4' || kind === 'm4a') return ascii(4, 4) === 'ftyp';
    if (kind === 'ogg' || kind === 'opus') return ascii(0, 4) === 'OggS';
    if (kind === 'flac') return ascii(0, 4) === 'fLaC';
    if (kind === 'mp3') return ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    if (kind === 'aac') return bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0;
    return false;
  }
  async function run(file, format, options, required, onProgress, token, mb) {
    const { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget } = mb;
    const input = new Input({formats: ALL_FORMATS, source: new BlobSource(file)});
    const output = new Output({format, target: new BufferTarget()});
    try {
      check(token);
      const conversion = await Conversion.init({
        input, output, tracks: 'primary', tags: {}, showWarnings: false, ...Object.fromEntries(Object.entries(options).filter(([key]) => !key.startsWith('_')))
      });
      check(token);
      if (!conversion.isValid || required.some(type =>
        !conversion.utilizedTracks.some(track => track.type === type)
      )) throw unsupported('Requested tracks are not available in the browser path.');
      active = conversion;
      conversion.onProgress = value => report(onProgress, value);
      await conversion.execute();
      check(token);
      if (!validSignature(output.target.buffer, options._expectedFormat)) {
        throw unsupported('The browser fast path did not produce a valid media container.');
      }
      report(onProgress, 1);
      return new Blob([output.target.buffer], {type: options._mime});
    } finally {
      if (active?.input === input) active = null;
      input.dispose?.();
    }
  }

  async function trim(file, request, outputFormat, onProgress) {
    if (!eligible(file) || !['mp4', 'webm'].includes(outputFormat)) return null;
    const start = Number(request?.start);
    const end = Number(request?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
    const fast = request.precision === 'fast';
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    // Mediabunny 1.61.6 cannot packet-copy a trim with a non-zero start;
    // keep the existing FFmpeg fast (-c copy) path for that common use case.
    if (fast && (start !== 0 || (outputFormat === 'mp4' && !['mp4', 'm4v'].includes(extension)) ||
      (outputFormat === 'webm' && extension !== 'webm'))) return null;
    if (!fast && outputFormat !== 'webm') return null; // VP9 only: validated against flickering.
    if (!fast && (!globalThis.isSecureContext || !globalThis.VideoEncoder || !globalThis.VideoDecoder)) return null;
    const token = epoch;
    const mb = await library();
    check(token);
    const outFormat = outputFormat === 'mp4' ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat();
    if (!fast) {
      // Limit to actual supported VP9 configurations, without VP8 fallback.
      const input = new mb.Input({formats: mb.ALL_FORMATS, source: new mb.BlobSource(file)});
      try {
        const video = await input.getPrimaryVideoTrack();
        if (!video || !await video.canDecode()) return null;
        const width = await video.getDisplayWidth();
        const height = await video.getDisplayHeight();
        const config = {codec: 'vp09.00.10.08', width, height, framerate: 30,
          bitrate: Math.max(215000, Math.round(width * height * 30 * 0.075))};
        if (!(await VideoEncoder.isConfigSupported(config))?.supported) return null;
      } finally {input.dispose?.();}
    }
    check(token);
    const quality = {high: 'high', balanced: 'medium', small: 'low'}[request.quality] || 'high';
    const audio = request.keepAudio ? (fast ? {} : {codec: 'opus'}) : {discard: true};
    const opts = {
      trim: {start, end}, video: fast ? {} : {codec: 'vp9', quality: new mb.Quality(quality),
        forceTranscode: true}, audio, copy: fast ? {mode: 'forced'} : false,
      _expectedFormat: outputFormat, _mime: outputFormat === 'mp4' ? 'video/mp4' : 'video/webm'
    };
    // Require the audio track only if the source actually contains it.
    if (request.keepAudio) {
      const probe = new mb.Input({formats: mb.ALL_FORMATS, source: new mb.BlobSource(file)});
      try {if (await probe.getPrimaryAudioTrack()) opts._audioRequired = true;}
      finally {probe.dispose?.();}
    }
    return run(file, outFormat, opts, opts._audioRequired ? ['video', 'audio'] : ['video'], onProgress, token, mb);
  }

  async function extractAudio(file, settings, onProgress) {
    if (!eligible(file) || settings?.sampleRate !== 'original' || settings?.channels !== 'original') return null;
    const format = String(settings?.format || '').toLowerCase();
    const expected = {mp3: 'mp3', aac: 'aac', m4a: 'aac', flac: 'flac',
      ogg: 'vorbis', opus: 'opus'}[format];
    if (!expected) return null; // WAV or resampling/rechanneling uses existing FFmpeg.
    const token = epoch;
    const mb = await library();
    check(token);
    const input = new mb.Input({formats: mb.ALL_FORMATS, source: new mb.BlobSource(file)});
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) {
        const error = new Error('This file has no audio track.');
        error.name = 'FFprobeNoAudioStreamError';
        throw error;
      }
      const sourceCodec = String(await track.getCodec()).toLowerCase();
      if (sourceCodec !== expected) return null;
    } finally {input.dispose?.();}
    check(token);
    const formats = {mp3: 'Mp3OutputFormat', aac: 'AdtsOutputFormat',
      m4a: 'Mp4OutputFormat', flac: 'FlacOutputFormat',
      ogg: 'OggOutputFormat', opus: 'OggOutputFormat'};
    const Constructor = mb[formats[format]];
    if (typeof Constructor !== 'function') return null;
    // No re-encoding: identical audio data; bitrate selector only matters when
    // transcoding, just as in the existing FFmpeg stream-copy branch.
    return run(file, new Constructor(), {
      video: {discard: true}, audio: {}, copy: {mode: 'forced'},
      _expectedFormat: format,
      _mime: {mp3: 'audio/mpeg', aac: 'audio/aac', m4a: 'audio/mp4',
        flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg'}[format]
    }, ['audio'], onProgress, token, mb);
  }

  async function cancel() {
    ++epoch;
    if (active) await active.cancel();
  }
  window.EasyFileVideoFastPaths = Object.freeze({trim, extractAudio, cancel});
})();
