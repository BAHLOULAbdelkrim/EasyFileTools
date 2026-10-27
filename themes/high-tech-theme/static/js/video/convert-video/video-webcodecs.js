/* EasyFile Tools — optional WebM engine (Mediabunny 1.61.6, MPL-2.0).
 * Lazily imported only when a WebM conversion starts; the selected file is
 * processed locally. The current CDN dependency requires a first-use network
 * request. FFmpeg.wasm remains the production fallback for unsupported cases.
 * See docs/WEBM_WEBCODECS_INTEGRATION_2026-10-21.md.
 */
(() => {
  'use strict';

  const CDN = 'https://esm.sh/mediabunny@1.61.6?bundle&target=es2022';
  const QUALITY = new Set(['low', 'medium', 'high']);
  const MAX_BUFFER_INPUT = 192 * 1024 * 1024;
  // WebM transcoding intentionally uses VP9 only. The previous VP8 browser
  // encoder produced a visibly degraded keyframe every 2 seconds on a real
  // 199-second, 30-fps sample in all three quality presets. Full-length VP9
  // comparisons (normal/medium and CQ32) did not reproduce that defect.
  // Do NOT add VP8 as an automatic WebCodecs encoding fallback: if VP9 is
  // unsupported or fails, the parent converter tries FFmpeg.wasm instead.
  // VP8 bitstream COPY remains allowed below: it does not re-encode frames.
  const ENC_CONFIGS = Object.freeze([
    ['vp9', 'no-preference'],
    ['vp9', 'prefer-software']
  ]);

  let libraryPromise = null;
  let activeConversion = null;
  let cancellationEpoch = 0;

  function checkNotCanceled(epoch) {
    if (epoch !== cancellationEpoch) {
      const error = new Error('WebCodecs conversion interrupted by the user.');
      error.name = 'ConversionCanceledError';
      throw error;
    }
  }

  function unusable(message, code = 'WEB_CODECS_UNSUPPORTED') {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  async function loadLibrary() {
    if (!libraryPromise) {
      // This explicit lazy import is intentionally NOT a script tag in <head>.
      libraryPromise = import(CDN).catch(error => {
        libraryPromise = null; // Allow retry after a temporary network failure.
        throw unusable(`Mediabunny could not load: ${error?.message || error}`,
          'WEB_CODECS_LIBRARY_UNAVAILABLE');
      });
    }
    return libraryPromise;
  }

  function unsupportedEncoder(error) {
    return /not supported|not available|unsupported|unable to encode|not implemented|no encodable|encoder configuration/i
      .test(String(error?.message || error));
  }

  function validateOutput(buffer) {
    return buffer instanceof ArrayBuffer && buffer.byteLength >= 4 &&
      new DataView(buffer).getUint32(0, false) === 0x1a45dfa3;
  }

  // Keep the requested maximum HEIGHT, never enlarge a smaller source.
  // Even dimensions work with more browser codecs.
  function targetSize(width, height, resolution) {
    const maxHeight = Number(resolution);
    if (!Number.isFinite(maxHeight) || maxHeight <= 0 || height <= maxHeight) return null;
    const finalHeight = Math.max(2, 2 * Math.floor(maxHeight / 2));
    const finalWidth = Math.max(2, 2 * Math.floor((width * finalHeight / height) / 2));
    return { width: finalWidth, height: finalHeight, fit: 'contain' };
  }

  function publish(progress, value) {
    if (typeof progress === 'function') {
      progress(Math.max(0, Math.min(100, Math.round(value * 100))));
    }
  }

  async function convertFile(file, settings, onProgress) {
    if (!file || settings?.format !== 'webm') {
      throw unusable('Only WebM output is handled by the WebCodecs module.');
    }
    if (!globalThis.isSecureContext || !globalThis.VideoEncoder || !globalThis.VideoDecoder) {
      throw unusable('WebCodecs is unavailable in this browser or non-secure context.',
        'WEB_CODECS_ENV_UNAVAILABLE');
    }
    // BufferTarget keeps the complete WebM in memory. For large inputs, let
    // FFmpeg's existing engine try; future releases should use StreamTarget.
    if (file.size > MAX_BUFFER_INPUT) {
      throw unusable('This file exceeds the memory-safe WebCodecs output threshold.');
    }
    if (activeConversion) {
      throw unusable('A browser video conversion is already running.');
    }
    const epoch = cancellationEpoch;
    const mb = await loadLibrary();
    checkNotCanceled(epoch);
    const { Input, Output, Conversion, ALL_FORMATS, BlobSource,
      BufferTarget, WebMOutputFormat, Quality } = mb;

    const probeInput = new Input({formats: ALL_FORMATS, source: new BlobSource(file)});
    let w, h, originalCodec, hasAudio;
    try {
      const track = await probeInput.getPrimaryVideoTrack();
      if (!track) throw unusable('No primary video stream is present.');
      w = await track.getDisplayWidth();
      h = await track.getDisplayHeight();
      originalCodec = await track.getCodec();
      if (!await track.canDecode()) {
        // Encoded packet copy may still work when decoding is unsupported.
        if (!(settings.fastCopy !== false && ['vp8', 'vp9', 'av1'].includes(originalCodec))) {
          throw unusable('The browser cannot decode the input video.');
        }
      }
      hasAudio = Boolean(await probeInput.getPrimaryAudioTrack());
    } finally {
      probeInput.dispose?.();
    }
    checkNotCanceled(epoch);

    const resized = targetSize(w, h, settings.resolution);
    const quality = QUALITY.has(settings.quality) ? settings.quality : 'medium';
    const canCopyVideo = settings.fastCopy !== false && !resized &&
      ['vp8', 'vp9', 'av1'].includes(originalCodec); // Copy is not VP8 encoding.
    const outputAudio = settings.keepAudio && hasAudio;

    // Attempt genuine bitstream copy first for already WebM-compatible tracks.
    // It is lossless even if a quality option is selected: quality only governs
    // ENCODING; a copy always preserves the source image quality.
    const attempts = [
      ...(canCopyVideo ? [{codec: 'copy', hardwareAcceleration: null}] : []),
      ...ENC_CONFIGS.map(([codec, hardwareAcceleration]) => ({codec, hardwareAcceleration}))
    ];
    let lastError = null;
    for (const attempt of attempts) {
      checkNotCanceled(epoch);
      if (attempt.codec !== 'copy') {
        const encoderWidth = resized?.width || w;
        const encoderHeight = resized?.height || h;
        const config = {
          codec: 'vp09.00.10.08',
          width: encoderWidth, height: encoderHeight,
          bitrate: Math.max(215000, Math.round(encoderWidth * encoderHeight * 30 * 0.075)),
          framerate: 30,
          hardwareAcceleration: attempt.hardwareAcceleration
        };
        let supported = false;
        try { supported = Boolean((await VideoEncoder.isConfigSupported(config))?.supported); }
        catch (_) { /* Unsupported preflight; try another configuration. */ }
        checkNotCanceled(epoch);
        if (!supported) continue;
      }
      const input = new Input({formats: ALL_FORMATS, source: new BlobSource(file)});
      const output = new Output({format: new WebMOutputFormat(), target: new BufferTarget()});
      try {
        const video = attempt.codec === 'copy'
          ? {}
          : {
              codec: attempt.codec,
              quality: new Quality(quality),
              hardwareAcceleration: attempt.hardwareAcceleration,
              forceTranscode: true,
              ...(resized || {})
            };
        const conversion = await Conversion.init({
          input, output, tracks: 'primary',
          video,
          audio: outputAudio ? (attempt.codec === 'copy' ? {} : {codec: 'opus'}) : {discard: true},
          tags: {}, showWarnings: false,
          copy: attempt.codec === 'copy' ? {mode: 'preferred'} : false
        });
        checkNotCanceled(epoch);
        if (!conversion.isValid ||
            !conversion.utilizedTracks.some(track => track.type === 'video') ||
            (outputAudio && !conversion.utilizedTracks.some(track => track.type === 'audio'))) {
          continue;
        }
        activeConversion = conversion;
        conversion.onProgress = value => publish(onProgress, value);
        await conversion.execute();
        checkNotCanceled(epoch);
        const buffer = output.target.buffer;
        if (!validateOutput(buffer)) throw unusable('The generated WebM is invalid.');
        const blob = new Blob([buffer], {type: 'video/webm'});
        publish(onProgress, 1);
        return {blob, codec: attempt.codec, mode: attempt.hardwareAcceleration || 'stream-copy'};
      } catch (error) {
        if (error?.name === 'ConversionCanceledError') throw error;
        lastError = error;
        if (!unsupportedEncoder(error) && error.code !== 'WEB_CODECS_UNSUPPORTED') {
          // Decoder, memory, corrupt-media and other errors should not be
          // retried with every browser encoder; FFmpeg will be the fallback.
          throw error;
        }
      } finally {
        activeConversion = null;
        input.dispose?.();
      }
    }
    throw unusable(lastError?.message || 'No supported WebM encoder configuration was found.');
  }

  async function cancel() {
    ++cancellationEpoch;
    if (activeConversion) {
      await activeConversion.cancel();
    }
  }

  window.EasyFileWebCodecs = Object.freeze({ convertFile, cancel });
})();
