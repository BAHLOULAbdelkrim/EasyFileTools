console.log("[REMOVE BACKGROUND OPERATION] generic PER_FILE adapter loaded");

(() => {
    "use strict";
    const zone = document.getElementById("operation-zone");
    if (!zone || zone.dataset.operation !== "remove-background") return;
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
        if (event.detail?.operation !== "remove-background") return;
        state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
        updateReady();
    });

    document.addEventListener("easyfiletools:background-settings-changed", event => {
        const valid = event.detail?.valid === true;
        state.settings = valid ? event.detail?.settings || null : null;
        window.EasyFileOperationLifecycle?.settingsChanged?.({
            operation: "remove-background",
            scope: "all",
            settings: valid ? state.settings : { invalid: true }
        });
        updateReady();
    });

    document.addEventListener("easyfiletools:background-file-progress", event => {
        const d = event.detail || {};
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-progress", {
            detail: { index: d.index, percentage: d.percentage, operation: "remove-background", category: "Image" }
        }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-progress", {
            detail: { index: d.index, percentage: d.percentage, progressLabel: d.label || "Removing background", operation: "remove-background" }
        }));
    });

    document.addEventListener("easyfiletools:background-file-complete", event => {
        const { index, file, result = {} } = event.detail || {};
        window.BackgroundRemovalUI?.showPreview?.(file, result.outputUrl, index);
        const generic = {
            index,
            outputUrl: result.outputUrl || null,
            outputBlob: result.blob || null,
            outputName: result.outputName || null,
            outputSize: result.outputSize || 0,
            outputFormat: result.outputFormat || null,
            completedLabel: "Background removed",
            operation: "remove-background",
            category: "Image"
        };
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-completed", { detail: generic }));
        document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-completed", { detail: generic }));
    });

    document.addEventListener("easyfiletools:background-file-error", event => {
        const d = event.detail || {};
        console.error("[REMOVE BACKGROUND]", d.error);
        document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-error", {
            detail: {
                index: d.index,
                operation: "remove-background",
                category: "Image",
                message: d.error?.message || "Background removal failed"
            }
        }));
    });
    document.addEventListener("easyfiletools:background-removal-ended", event => { state.lastEnd = event.detail || {}; });

    controller.registerAdapter({
        async run() {
            state.settings = window.BackgroundRemovalUI?.getSettings?.() || state.settings;
            if (!state.settings || state.files.length === 0) return;

            // Synchronize the generic result signature immediately before the
            // run so Download All can reliably recognize the generated outputs
            // as current even after long AI initialization/inference.
            window.EasyFileOperationLifecycle?.settingsChanged?.({
                operation: "remove-background",
                scope: "all",
                settings: state.settings
            });
            state.lastEnd = null;
            window.BackgroundRemovalUI?.clearPreview?.();
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-started", { detail: { category: "Image", operation: "remove-background" } }));
            try {
                await window.BackgroundRemovalEngine?.processFiles?.(state.files, state.settings);
                if (state.lastEnd?.error) throw state.lastEnd.error;
            }
            finally {
                document.dispatchEvent(new CustomEvent("easyfiletools:operation-ended", {
                    detail: { category: "Image", operation: "remove-background", cancelled: state.lastEnd?.cancelled === true, error: Boolean(state.lastEnd?.error) }
                }));
            }
        },
        async pause() { window.BackgroundRemovalEngine?.pause?.(); },
        async resume() { window.BackgroundRemovalEngine?.resume?.(); },
        async cancel() { window.BackgroundRemovalEngine?.cancel?.(); }
    });

    document.addEventListener("easyfiletools:files-cleared", () => {
        state.files = [];
        state.settings = null;
        window.BackgroundRemovalUI?.clearPreview?.();
        updateReady();
    });

    state.settings = window.BackgroundRemovalUI?.getSettings?.() || null;
    syncFiles();
})();
