console.log("[IMAGE TRANSFORM OPERATION ADAPTER] loaded");

(() => {
    "use strict";

    function create({ operation, settingsEvent, getSettings, getEngine, progressLabel, completeLabel }) {
        const zone = document.getElementById("operation-zone");
        if (!zone || zone.dataset.operation !== operation) return null;
        const controller = window.EasyFileOperationController;
        if (!controller) return null;
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
            if (event.detail?.operation !== operation) return;
            state.files = Array.isArray(event.detail.files) ? event.detail.files : [];
            updateReady();
        });

        document.addEventListener(settingsEvent, event => {
            const valid = event.detail?.valid === true;
            state.settings = valid ? event.detail?.settings || null : null;
            window.EasyFileOperationLifecycle?.settingsChanged?.({
                operation,
                scope: "all",
                settings: valid ? state.settings : { invalid: true }
            });
            updateReady();
        });

        document.addEventListener("easyfiletools:image-transform-file-progress", event => {
            const d = event.detail || {};
            if (d.operation !== operation) return;
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-progress", {
                detail: { index: d.index, percentage: d.percentage, operation, category: "Image" }
            }));
            document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-progress", {
                detail: { index: d.index, percentage: d.percentage, progressLabel, operation }
            }));
        });

        document.addEventListener("easyfiletools:image-transform-file-complete", event => {
            const d = event.detail || {};
            if (d.operation !== operation) return;
            const result = d.result || {};
            const generic = {
                index: d.index,
                outputUrl: result.outputUrl || null,
                outputBlob: result.blob || null,
                outputName: result.outputName || null,
                outputSize: result.outputSize || 0,
                outputFormat: result.outputFormat || null,
                completedLabel: result.passthrough ? "No change needed" : completeLabel,
                operation,
                category: "Image"
            };
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-completed", { detail: generic }));
            document.dispatchEvent(new CustomEvent("easyfiletools:file-operation-completed", { detail: generic }));
        });

        document.addEventListener("easyfiletools:image-transform-file-error", event => {
            if (event.detail?.operation !== operation) return;
            const d = event.detail || {};
            console.error(`[${operation}]`, d.error);
            document.dispatchEvent(new CustomEvent("easyfiletools:operation-file-error", {
                detail: {
                    index: d.index,
                    message: d.error?.message || "Processing failed",
                    operation,
                    category: "Image"
                }
            }));
        });

        document.addEventListener("easyfiletools:image-transform-ended", event => {
            if (event.detail?.operation !== operation) return;
            state.lastEnd = event.detail || {};
        });

        controller.registerAdapter({
            async run() {
                state.settings = getSettings?.() || state.settings;
                if (!state.settings || state.files.length === 0) return;
            state.lastEnd = null;
                document.dispatchEvent(new CustomEvent("easyfiletools:operation-started", {
                    detail: { category: "Image", operation }
                }));
                try {
                    await getEngine()?.processFiles?.(state.files, state.settings);
                    if (state.lastEnd?.error) throw state.lastEnd.error;
                }
                finally {
                    document.dispatchEvent(new CustomEvent("easyfiletools:operation-ended", {
                        detail: {
                            category: "Image",
                            operation,
                            cancelled: state.lastEnd?.cancelled === true,
                            error: Boolean(state.lastEnd?.error)
                        }
                    }));
                }
            },
            async pause() { getEngine()?.pause?.(); },
            async resume() { getEngine()?.resume?.(); },
            async cancel() { getEngine()?.cancel?.(); }
        });

        document.addEventListener("easyfiletools:files-cleared", () => {
            state.files = [];
            state.settings = null;
            updateReady();
        });

        state.settings = getSettings?.() || null;
        syncFiles();
        return { state, updateReady };
    }

    window.EasyFileImageTransformOperation = Object.freeze({ create });
})();
