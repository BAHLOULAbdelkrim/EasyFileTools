console.log("[COMPRESS IMAGE OPERATION] generic PER_FILE adapter loaded");

(() => {
    "use strict";
    const zone = document.getElementById("operation-zone");
    if (!zone || zone.dataset.operation !== "compress-image") return;
    const controller = window.EasyFileOperationController;
    if (!controller) return;
    controller.initialize?.();

    const state = { files: [], settings: null, lastEnd: null };
    const chooseLabel = document.getElementById("chooseFormatLabel");

    function updateReady() {
        chooseLabel?.classList.toggle("active", state.files.length > 0);
        controller.setReady(state.files.length > 0 && Boolean(state.settings));
    }

    async function syncFiles() {
        const data = typeof loadSelectedFiles === "function" ? await loadSelectedFiles() : null;
        state.files = data?.category === "Image" && Array.isArray(data.files) ? data.files : [];
        updateReady();
    }

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "compress-image") return;
        state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
        updateReady();
    });

    document.addEventListener("easyfiletools:image-compression-settings-changed", event => {
        const valid = event.detail?.valid === true;
        state.settings = valid ? event.detail?.settings || null : null;
        window.EasyFileOperationLifecycle?.settingsChanged?.({
            operation: "compress-image",
            scope: "all",
            settings: valid ? state.settings : { invalid: true }
        });
        updateReady();
    });

    document.addEventListener("easyfiletools:image-compress-progress", event => {
        const d = event.detail || {};
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-progress", {
            detail: { index: d.index, percentage: d.percentage, operation: "compress-image", category: "Image" }
        }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-progress", {
            detail: { index: d.index, percentage: d.percentage, progressLabel: "Compressing", operation: "compress-image" }
        }));
    });

    document.addEventListener("easyfiletools:image-compress-complete", event => {
        const { index, file, result = {} } = event.detail || {};
        window.ImageCompressionUI?.registerResult?.(index, result, file);
        const generic = {
            index,
            outputUrl: result.outputUrl || null,
            outputBlob: result.blob || null,
            outputName: result.outputName || null,
            outputSize: result.outputSize || 0,
            outputFormat: result.outputFormat || null,
            completedLabel: result.usedOriginal ? "Original was smaller" : "Compressed",
            operation: "compress-image",
            category: "Image"
        };
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-completed", { detail: generic }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-completed", { detail: generic }));
    });

    document.addEventListener("easyfiletools:image-compress-error", event => {
        console.error("[COMPRESS IMAGE]", event.detail?.error);
    });
    document.addEventListener("easyfiletools:image-compression-ended", event => { state.lastEnd = event.detail || {}; });

    controller.registerAdapter({
        async run() {
            state.settings = window.ImageCompressionUI?.getSettings?.() || state.settings;
            if (!state.settings || state.files.length === 0) return;
            state.lastEnd = null;
            window.ImageCompressionUI?.resetSummary?.();
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-started", { detail: { category: "Image", operation: "compress-image" } }));
            try {
                await window.ImageCompressor?.compressFiles?.(state.files, state.settings);
                if (state.lastEnd?.error) throw state.lastEnd.error;
            }
            finally {
                document.dispatchEvent(new CustomEvent("easyfiletools:operation-ended", {
                    detail: { category: "Image", operation: "compress-image", cancelled: state.lastEnd?.cancelled === true, error: Boolean(state.lastEnd?.error) }
                }));
            }
        },
        async pause() { window.ImageCompressor?.pause?.(); },
        async resume() { window.ImageCompressor?.resume?.(); },
        async cancel() { window.ImageCompressor?.cancel?.(); }
    });

    document.addEventListener("easyfiletools:files-cleared", () => {
        state.files = [];
        state.settings = null;
        window.ImageCompressionUI?.resetSummary?.();
        updateReady();
    });

    state.settings = window.ImageCompressionUI?.getSettings?.() || null;
    syncFiles();
})();
