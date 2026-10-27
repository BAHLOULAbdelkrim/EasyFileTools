console.log("[IMAGE TO PDF OPERATION] generic BATCH adapter loaded");

(() => {
    "use strict";
    const zone = document.getElementById("operation-zone");
    if (!zone || zone.dataset.operation !== "image-to-pdf") return;
    const controller = window.EasyFileOperationController;
    if (!controller) return;
    controller.initialize?.();

    const state = { files: [], settings: null, lastEnd: null };
    const chooseLabel = document.getElementById("chooseFormatLabel");
    const resultDownloadBtn = document.getElementById("imageToPdfResultDownload");

    function updateReady() {
        chooseLabel?.classList.toggle("active", state.files.length > 0);
        controller.setReady(state.files.length > 0 && Boolean(state.settings));
    }

    async function syncFiles() {
        const data = typeof loadSelectedFiles === "function" ? await loadSelectedFiles() : null;
        state.files = data?.category === "Image" && Array.isArray(data.files) ? data.files : [];
        updateReady();
    }

    function publishBatchSettings(valid, settings) {
        state.settings = valid ? settings : null;
        window.EasyFileOperationLifecycle?.settingsChanged?.({
            operation: "image-to-pdf",
            scope: "batch",
            inputs: state.files,
            settings: valid ? settings : { invalid: true }
        });
        updateReady();
    }

    function downloadBatchResult() {
        const result = window.EasyFileOperationLifecycle?.getBatchResult?.();
        if (!result?.outputUrl) return;
        const link = document.createElement("a");
        link.href = result.outputUrl;
        link.download = result.outputName || "images.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.EasyFileOperationLifecycle?.markBatchResultDownloaded?.();
    }

    resultDownloadBtn?.addEventListener("click", downloadBatchResult);

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "image-to-pdf") return;
        state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
        if (state.settings) publishBatchSettings(true, state.settings);
        else updateReady();
    });

    document.addEventListener("easyfiletools:image-pdf-settings-changed", event => {
        publishBatchSettings(event.detail?.valid === true, event.detail?.settings || null);
    });

    document.addEventListener("easyfiletools:image-pdf-file-progress", event => {
        const d = event.detail || {};
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-progress", {
            detail: { index: d.index, percentage: d.percentage, operation: "image-to-pdf", category: "Image" }
        }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-progress", {
            detail: { index: d.index, percentage: d.percentage, progressLabel: "Adding to PDF", operation: "image-to-pdf" }
        }));
    });

    document.addEventListener("easyfiletools:image-pdf-source-complete", event => {
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-completed", {
            detail: { index: event.detail?.index, completedLabel: "Added to PDF", operation: "image-to-pdf" }
        }));
    });

    document.addEventListener("easyfiletools:image-pdf-complete", event => {
        const engineResult = event.detail?.result;
        if (!engineResult?.blob) return;
        const result = {
            outputUrl: URL.createObjectURL(engineResult.blob),
            outputBlob: engineResult.blob,
            outputName: engineResult.outputName || "images.pdf",
            outputSize: engineResult.outputSize || engineResult.blob.size,
            outputFormat: "pdf",
            completedLabel: `PDF • ${engineResult.pageCount || state.files.length} pages`
        };
        window.EasyFileOperationLifecycle?.completeBatchResult?.(result);
        window.ImageToPdfUI?.showResult?.({ ...engineResult, ...result });
    });

    document.addEventListener("easyfiletools:image-pdf-ended", event => { state.lastEnd = event.detail || {}; });

    controller.registerAdapter({
        async run() {
            state.settings = window.ImageToPdfUI?.getSettings?.() || state.settings;
            if (!state.settings || state.files.length === 0) return;
            window.EasyFileOperationLifecycle?.clearBatchResult?.();
            window.ImageToPdfUI?.clearResult?.();
            state.lastEnd = null;

            document.dispatchEvent(new CustomEvent("easyfiletools:operation-started", {
                detail: { category: "Image", operation: "image-to-pdf" }
            }));

            try {
                await window.ImageToPdfEngine?.createPdf?.(state.files, state.settings);
                if (state.lastEnd?.error) throw state.lastEnd.error;
            }
            finally {
                document.dispatchEvent(new CustomEvent("easyfiletools:operation-ended", {
                    detail: {
                        category: "Image",
                        operation: "image-to-pdf",
                        cancelled: state.lastEnd?.cancelled === true,
                        error: Boolean(state.lastEnd?.error),
                        singleOutput: true
                    }
                }));
            }
        },
        async pause() { window.ImageToPdfEngine?.pause?.(); },
        async resume() { window.ImageToPdfEngine?.resume?.(); },
        async cancel() { window.ImageToPdfEngine?.cancel?.(); }
    });

    document.addEventListener("easyfiletools:operation-results-discarded", () => {
        window.ImageToPdfUI?.clearResult?.();
        updateReady();
    });

    document.addEventListener("easyfiletools:files-cleared", () => {
        state.files = [];
        state.settings = null;
        window.EasyFileOperationLifecycle?.clearBatchResult?.();
        window.ImageToPdfUI?.clearResult?.();
        updateReady();
    });

    state.settings = window.ImageToPdfUI?.getSettings?.() || null;
    syncFiles();
})();
