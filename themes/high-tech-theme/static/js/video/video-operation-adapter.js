console.log('[VIDEO OPERATION ADAPTER] loaded');

(() => {
  'use strict';

  const DEFINITIONS = Object.freeze({
    'convert-video': {
      ui: () => window.VideoConversionUI,
      engine: () => window.VideoConverter,
      settingsEvent: 'easyfiletools:video-conversion-settings-changed',
      startEvent: 'easyfiletools:video-conversion-started',
      progressEvent: 'easyfiletools:video-convert-progress',
      completeEvent: 'easyfiletools:video-convert-complete',
      endEvent: 'easyfiletools:video-conversion-ended',
      run(engine, files, settings) { return engine.convertFiles(files, settings); },
      progressLabel: 'Converting', completedLabel: 'Converted'
    },
    'compress-video': {
      ui: () => window.VideoCompressionUI,
      engine: () => window.VideoCompressor,
      settingsEvent: 'easyfiletools:video-compression-settings-changed',
      startEvent: 'easyfiletools:video-compression-started',
      progressEvent: 'easyfiletools:video-compress-progress',
      completeEvent: 'easyfiletools:video-compress-complete',
      endEvent: 'easyfiletools:video-compression-ended',
      run(engine, files, settings) { return engine.compressFiles(files, settings); },
      progressLabel: 'Compressing', completedLabel: 'Compressed'
    },
    'video-to-audio': {
      ui: () => window.VideoToAudioUI,
      engine: () => window.VideoAudioExtractor,
      settingsEvent: 'easyfiletools:video-audio-settings-changed',
      startEvent: 'easyfiletools:video-audio-started',
      progressEvent: 'easyfiletools:video-audio-progress',
      completeEvent: 'easyfiletools:video-audio-complete',
      endEvent: 'easyfiletools:video-audio-ended',
      run(engine, files, settings) { return engine.extractFiles(files, settings); },
      progressLabel: 'Extracting audio', completedLabel: 'Audio extracted'
    },
    'trim-video': {
      ui: () => window.TrimVideoUI,
      engine: () => window.VideoTrimmer,
      settingsEvent: 'easyfiletools:trim-video-settings-changed',
      startEvent: 'easyfiletools:trim-video-started',
      progressEvent: 'easyfiletools:trim-video-progress',
      completeEvent: 'easyfiletools:trim-video-complete',
      endEvent: 'easyfiletools:trim-video-ended',
      getSettings(ui) { return ui?.getRequests?.() || null; },
      run(engine, _files, requests) { return engine.trimFiles(requests); },
      progressLabel: 'Trimming', completedLabel: 'Trimmed'
    }
  });

  function normalizeResult(result, fallbackLabel) {
    return {
      outputUrl: result?.outputUrl || result?.url || null,
      outputBlob: result?.outputBlob || result?.blob || null,
      outputName: result?.outputName || result?.name || null,
      outputSize: result?.outputSize || result?.blob?.size || 0,
      outputDuration: result?.outputDuration || result?.duration || 0,
      outputFormat: result?.outputFormat || null,
      completedLabel: result?.completedLabel || fallbackLabel
    };
  }

  function register(operationId) {
    const zone = document.getElementById('operation-zone');
    if (!zone || zone.dataset.operation !== operationId) return;
    const definition = DEFINITIONS[operationId];
    const controller = window.EasyFileOperationController;
    if (!definition || !controller) return;

    controller.initialize?.();
    const config = window.EasyFileOperationConfig?.get?.(operationId) || {};
    const minFiles = Math.max(1, Number(config.minFiles) || 1);
    const label = document.getElementById('chooseFormatLabel');
    const state = { files: [], settings: null, lastEnd: null };

    const getSettings = () => {
      const ui = definition.ui();
      return definition.getSettings ? definition.getSettings(ui) : ui?.getSettings?.() || null;
    };

    function publishSettings(valid, settings) {
      state.settings = valid ? settings : null;
      window.EasyFileOperationLifecycle?.settingsChanged?.({
        operation: operationId,
        scope: 'all',
        inputs: state.files,
        settings: valid ? settings : { invalid: true }
      });
      updateReady();
    }

    function updateReady() {
      const enoughFiles = state.files.length >= minFiles;
      label?.classList.toggle('active', enoughFiles);
      controller.setReady(enoughFiles && Boolean(state.settings));
    }

    async function syncFiles() {
      const data = typeof loadSelectedFiles === 'function' ? await loadSelectedFiles() : null;
      state.files = Array.isArray(data?.files) ? data.files : [];
      if (state.settings) publishSettings(true, state.settings);
      else updateReady();
    }

    document.addEventListener('easyfiletools:operation-files-updated', event => {
      if (event.detail?.operation !== operationId) return;
      state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
      const settings = getSettings() || state.settings;
      if (settings) publishSettings(true, settings);
      else updateReady();
    });

    document.addEventListener(definition.settingsEvent, event => {
      const settings = event.detail?.settings || event.detail?.requests || getSettings();
      publishSettings(event.detail?.valid === true, settings);
    });

    document.addEventListener(definition.progressEvent, event => {
      const d = event.detail || {};
      document.dispatchEvent(new CustomEvent('easyfiletools:operation-file-progress', {
        detail: { index: d.index, percentage: d.percentage, operation: operationId, category: 'Video' }
      }));
      document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-progress', {
        detail: { index: d.index, percentage: d.percentage, progressLabel: definition.progressLabel, operation: operationId }
      }));
    });

    document.addEventListener(definition.completeEvent, event => {
      const d = event.detail || {};
      const generic = { index: d.index, ...normalizeResult(d.result, definition.completedLabel), operation: operationId, category: 'Video' };
      document.dispatchEvent(new CustomEvent('easyfiletools:operation-file-completed', { detail: generic }));
      document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-completed', { detail: generic }));
    });

    if (operationId === 'video-to-audio') {
      document.addEventListener('easyfiletools:video-audio-file-error', event => {
        const d = event.detail || {};
        const eventName = d.code === 'NO_AUDIO_TRACK'
          ? 'easyfiletools:operation-file-skipped'
          : 'easyfiletools:operation-file-error';
        document.dispatchEvent(new CustomEvent(eventName, {
          detail: {
            index: d.index,
            message: d.error?.message || 'Audio extraction failed',
            code: d.code || null,
            operation: operationId,
            category: 'Video'
          }
        }));
      });
    }

    document.addEventListener(definition.endEvent, event => { state.lastEnd = event.detail || {}; });

    controller.registerAdapter({
      async run() {
        state.settings = getSettings() || state.settings;
        if (!state.settings || state.files.length < minFiles) return;
        state.lastEnd = null;
        document.dispatchEvent(new CustomEvent('easyfiletools:operation-started', { detail: { category: 'Video', operation: operationId } }));
        try {
          await definition.run(definition.engine(), state.files, state.settings);
          if (state.lastEnd?.error) throw state.lastEnd.error;
        } finally {
          document.dispatchEvent(new CustomEvent('easyfiletools:operation-ended', {
            detail: { category: 'Video', operation: operationId, cancelled: state.lastEnd?.cancelled === true, error: Boolean(state.lastEnd?.error) }
          }));
        }
      },
      async pause() { return definition.engine()?.pause?.(); },
      async resume() { return definition.engine()?.resume?.(); },
      async cancel() { return definition.engine()?.cancel?.(); }
    });

    document.addEventListener('easyfiletools:files-cleared', () => {
      state.files = [];
      state.settings = null;
      updateReady();
    });

    state.settings = getSettings();
    syncFiles();
  }

  window.EasyFileVideoOperationAdapter = Object.freeze({ register });
})();
