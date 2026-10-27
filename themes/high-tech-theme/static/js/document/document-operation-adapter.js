console.log('[DOCUMENT OPERATION ADAPTER] loaded');

(() => {
  'use strict';

  const zone = document.getElementById('operation-zone');
  if (!zone || zone.dataset.category !== 'Document') return;

  const controller = window.EasyFileOperationController;
  if (!controller) return;
  controller.initialize?.();

  const operationId = zone.dataset.operation;
  const config = window.EasyFileOperationConfig?.get?.(operationId) || {};
  const minFiles = Math.max(1, Number(config.minFiles) || 1);
  const chooseLabel = document.getElementById('chooseFormatLabel');
  const state = { files: [], settings: null, cancelled: false, paused: false };

  const defs = {
    'merge-pdf': { ui: () => window.MergePdfUI, settingsEvent: 'easyfiletools:merge-pdf-settings-changed' },
    'split-pdf': { ui: () => window.SplitPdfUI, settingsEvent: 'easyfiletools:split-pdf-settings-changed' },
    'compress-pdf': { ui: () => window.CompressPdfUI, settingsEvent: 'easyfiletools:compress-pdf-settings-changed' },
    'pdf-to-image': { ui: () => window.PdfToImageUI, settingsEvent: 'easyfiletools:pdf-image-settings-changed' }
  };
  const def = defs[operationId];
  if (!def) return;

  // Normalize known PDF decoder errors without masking unrelated failures.
  function explainPdfError(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    if (/EncryptedPDFError|PasswordException/i.test(name) ||
        /(?:encrypted PDF|document.*encrypted|password (?:required|protected|incorrect)|no password given|incorrect password)/i.test(message)) {
      return new Error('This PDF is encrypted or password-protected. Please unlock it using your PDF application before trying again.');
    }
    if (/InvalidPDFException|MissingPDFException|PDFParsingError|MissingPDFHeaderError/i.test(name) ||
        /(?:invalid PDF structure|invalid pdf document|failed to parse PDF|missing pdf header|no pdf header found|corrupt.*pdf)/i.test(message)) {
      return new Error('This PDF appears to be damaged or invalid. Check that it opens correctly in a PDF reader before trying again.');
    }
    return error;
  }

  const getSettings = () => def.ui()?.getSettings?.() || null;
  const fileOf = item => item?.file || item;

  function updateReady() {
    const enoughFiles = state.files.length >= minFiles;
    chooseLabel?.classList.toggle('active', enoughFiles);
    controller.setReady(enoughFiles && Boolean(state.settings));
  }

  function publishSettings(valid, settings) {
    state.settings = valid ? settings : null;
    window.EasyFileOperationLifecycle?.settingsChanged?.({
      operation: operationId,
      scope: config.resultMode === 'batch' ? 'batch' : 'all',
      inputs: state.files,
      settings: valid ? settings : { invalid: true }
    });
    updateReady();
  }

  async function syncFiles() {
    const data = typeof loadSelectedFiles === 'function' ? await loadSelectedFiles() : null;
    state.files = Array.isArray(data?.files) ? data.files : [];
    if (state.settings) publishSettings(true, state.settings);
    else updateReady();
  }

  async function checkpoint() {
    while (state.paused && !state.cancelled) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    if (state.cancelled) throw new Error('DOCUMENT_OPERATION_CANCELLED');
  }

  function emitProgress(index, percentage, label) {
    document.dispatchEvent(new CustomEvent('easyfiletools:operation-file-progress', {
      detail: { index, percentage, operation: operationId, category: 'Document' }
    }));
    document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-progress', {
      detail: { index, percentage, progressLabel: label, operation: operationId, category: 'Document' }
    }));
  }

  function emitCompleted(index, result, label) {
    const detail = {
      index,
      outputUrl: result?.outputUrl || result?.url || null,
      outputBlob: result?.outputBlob || result?.blob || null,
      outputName: result?.outputName || result?.name || null,
      outputSize: result?.outputSize || result?.blob?.size || 0,
      outputFormat: result?.outputFormat || 'pdf',
      completedLabel: label,
      operation: operationId,
      category: 'Document'
    };
    document.dispatchEvent(new CustomEvent('easyfiletools:operation-file-completed', { detail }));
    document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-completed', { detail }));
  }

  function emitMultiOutputCompleted(index, outputs, label) {
    const detail = {
      index,
      outputs,
      completedLabel: label,
      outputCount: outputs.length,
      operation: operationId,
      category: 'Document'
    };
    document.dispatchEvent(new CustomEvent('easyfiletools:operation-file-completed', { detail }));
    document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-completed', { detail }));
  }

  async function runMerge() {
    const result = await window.PdfMerger.merge(state.files, state.settings, { checkpoint });
    await checkpoint();
    window.EasyFileOperationLifecycle?.completeBatchResult?.({
      ...result,
      outputBlob: result?.blob || null,
      completedLabel: `Merged • ${result?.pageCount || 0} pages`
    });
    def.ui()?.showResult?.(result);
    state.files.forEach((_, index) => document.dispatchEvent(new CustomEvent('easyfiletools:file-operation-completed', {
      detail: { index, completedLabel: 'Added to merged PDF', operation: operationId, category: 'Document' }
    })));
  }

  function settingsForFile(settings, index) {
    if (!settings || typeof settings !== 'object') return settings;
    if (settings.configurationMode === 'per-file') {
      const item = Array.isArray(settings.perFileSettings)
        ? settings.perFileSettings.find(entry => Number(entry?.index) === index)
        : null;
      return item?.settings || settings.defaultSettings || null;
    }
    return settings.defaultSettings || settings;
  }

  async function runSplit() {
    for (let index = 0; index < state.files.length; index++) {
      await checkpoint();
      const fileSettings = settingsForFile(state.settings, index);
      if (!fileSettings) throw new Error(`Missing Split PDF settings for file ${index + 1}`);
      const outputs = await window.PdfSplitter.split(
        fileOf(state.files[index]),
        fileSettings,
        percentage => emitProgress(index, percentage, 'Splitting'),
        { checkpoint }
      );
      await checkpoint();
      emitMultiOutputCompleted(
        index,
        outputs,
        `Split • ${outputs.length} ${outputs.length === 1 ? 'file' : 'files'}`
      );
    }
  }

  async function runCompress() {
    for (let index = 0; index < state.files.length; index++) {
      await checkpoint();
      const result = await window.PdfCompressor.compress(
        fileOf(state.files[index]),
        state.settings,
        percentage => emitProgress(index, percentage, 'Compressing'),
        { checkpoint }
      );
      await checkpoint();
      emitCompleted(index, result, result?.usedOriginal ? 'Already optimal' : 'Compressed');
    }
  }

  async function runPdfToImage() {
    for (let index = 0; index < state.files.length; index++) {
      await checkpoint();
      const outputs = await window.PdfImageConverter.convertPdf(
        fileOf(state.files[index]),
        state.settings,
        percentage => emitProgress(index, percentage, 'Rendering'),
        { checkpoint }
      );
      await checkpoint();
      emitMultiOutputCompleted(
        index,
        outputs,
        `Converted • ${outputs.length} ${outputs.length === 1 ? 'page' : 'pages'}`
      );
    }
  }

  document.addEventListener('easyfiletools:operation-files-updated', event => {
    if (event.detail?.operation !== operationId) return;
    state.files = Array.isArray(event.detail.files) ? event.detail.files : [];

    if (state.files.length === 0 && operationId === 'merge-pdf') {
      def.ui()?.clearResult?.();
    }

    const settings = getSettings() || state.settings;
    if (settings) publishSettings(true, settings);
    else updateReady();
  });

  document.addEventListener(def.settingsEvent, event => {
    publishSettings(event.detail?.valid === true, event.detail?.settings || getSettings());
  });

  controller.registerAdapter({
    async run() {
      state.settings = getSettings() || state.settings;
      if (!state.settings || state.files.length < minFiles) return;

      state.cancelled = false;
      state.paused = false;
      document.dispatchEvent(new CustomEvent('easyfiletools:operation-started', {
        detail: { category: 'Document', operation: operationId }
      }));

      let error = null;
      try {
        if (operationId === 'merge-pdf') await runMerge();
        else if (operationId === 'split-pdf') await runSplit();
        else if (operationId === 'compress-pdf') await runCompress();
        else if (operationId === 'pdf-to-image') await runPdfToImage();
      } catch (caught) {
        if (caught?.message !== 'DOCUMENT_OPERATION_CANCELLED') {
          error = explainPdfError(caught);
          if (error !== caught && typeof showNotification === 'function') {
            showNotification(error.message, 'error', 7000);
          }
          throw error;
        }
      } finally {
        document.dispatchEvent(new CustomEvent('easyfiletools:operation-ended', {
          detail: {
            category: 'Document',
            operation: operationId,
            cancelled: state.cancelled,
            error: Boolean(error),
            singleOutput: operationId === 'merge-pdf'
          }
        }));
      }
    },
    async pause() { state.paused = true; },
    async resume() { state.paused = false; },
    async cancel() { state.cancelled = true; state.paused = false; }
  });

  const batchDownload = document.getElementById('mergePdfResultDownload');
  batchDownload?.addEventListener('click', () => {
    const result = window.EasyFileOperationLifecycle?.getBatchResult?.();
    if (!result?.outputUrl) return;
    const a = document.createElement('a');
    a.href = result.outputUrl;
    a.download = result.outputName || 'merged.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.EasyFileOperationLifecycle?.markBatchResultDownloaded?.();
  });

  document.addEventListener('easyfiletools:batch-result-cleared', () => {
    if (operationId === 'merge-pdf') {
      def.ui()?.clearResult?.();
    }
  });

  document.addEventListener('easyfiletools:files-cleared', () => {
    state.files = [];
    state.settings = null;
    if (operationId === 'merge-pdf') {
      window.EasyFileOperationLifecycle?.clearBatchResult?.();
      def.ui()?.clearResult?.();
    }
    updateReady();
  });

  state.settings = getSettings();
  syncFiles();
})();
