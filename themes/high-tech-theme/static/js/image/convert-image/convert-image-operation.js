console.log("[CONVERT IMAGE OPERATION] generic PER_FILE adapter loaded");

(() => {
    "use strict";

    const zone = document.getElementById("operation-zone");
    if (!zone || zone.dataset.operation !== "convert-image") return;

    const controller = window.EasyFileOperationController;
    if (!controller) return;

    controller.initialize?.();

    const state = { files: [], settings: null, lastEnd: null };
    const chooseLabel = document.getElementById("chooseFormatLabel");

    function updateReady() {
        const ready = state.files.length > 0 && Boolean(state.settings);
        chooseLabel?.classList.toggle("active", state.files.length > 0);
        controller.setReady(ready);
    }

    async function syncFiles() {
        const data = typeof loadSelectedFiles === "function" ? await loadSelectedFiles() : null;
        state.files = data?.category === "Image" && Array.isArray(data.files) ? data.files : [];
        updateReady();
    }

    function publishSettings(valid, settings) {
        state.settings = valid ? settings : null;
        window.EasyFileOperationLifecycle?.settingsChanged?.({
            operation: "convert-image",
            scope: "all",
            settings: valid ? settings : { invalid: true }
        });
        updateReady();
    }

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "convert-image") return;
        state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
        updateReady();
    });

    document.addEventListener("easyfiletools:image-conversion-settings-selected", event => {
        publishSettings(event.detail?.valid === true, event.detail?.settings || null);
    });

    document.addEventListener("easyfiletools:image-file-progress", event => {
        const detail = event.detail || {};
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-progress", {
            detail: { index: detail.index, percentage: detail.percentage, operation: "convert-image", category: "Image" }
        }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-progress", {
            detail: { index: detail.index, percentage: detail.percentage, progressLabel: "Converting", operation: "convert-image" }
        }));
    });

    document.addEventListener("easyfiletools:image-file-complete", event => {
        const detail = event.detail || {};
        const result = detail.result || {};
        const generic = {
            index: detail.index,
            outputUrl: result.outputUrl || null,
            outputBlob: result.blob || null,
            outputName: result.outputName || null,
            outputSize: result.outputSize || 0,
            outputFormat: result.outputFormat || null,
            completedLabel: result.passthrough ? "Already compatible" : "Converted",
            operation: "convert-image",
            category: "Image"
        };
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-completed", { detail: generic }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-completed", { detail: generic }));
    });

    document.addEventListener("easyfiletools:image-file-error", event => {
        console.error("[CONVERT IMAGE]", event.detail?.error);
    });

    document.addEventListener("easyfiletools:image-conversion-ended", event => {
        state.lastEnd = event.detail || {};
    });

    controller.registerAdapter({
        async run() {
            state.settings = window.ImageConversionUI?.getSettings?.() || state.settings;
            if (!state.settings || state.files.length === 0) return;
            state.lastEnd = null;
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-started", {
                detail: { category: "Image", operation: "convert-image" }
            }));

            try {
                await window.ImageConverter?.convertFiles?.(state.files, state.settings);
                if (state.lastEnd?.error) throw state.lastEnd.error;
            }
            finally {
                document.dispatchEvent(new CustomEvent("easyfiletools:operation-ended", {
                    detail: {
                        category: "Image",
                        operation: "convert-image",
                        cancelled: state.lastEnd?.cancelled === true,
                        error: Boolean(state.lastEnd?.error)
                    }
                }));
            }
        },
        async pause() { window.ImageConverter?.pause?.(); },
        async resume() { window.ImageConverter?.resume?.(); },
        async cancel() { window.ImageConverter?.cancel?.(); }
    });

    document.addEventListener("easyfiletools:files-cleared", () => {
        state.files = [];
        state.settings = null;
        updateReady();
    });

    state.settings = window.ImageConversionUI?.getSettings?.() || null;
    syncFiles();
})();
