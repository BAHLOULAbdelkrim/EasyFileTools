console.log("[REPLACE COLORS ENGINE] loaded");

(() => {
    "use strict";

    const OPERATION = "replace-colors";
    const MAX_PROCESS_PIXELS = 30_000_000;
    const state = { running: false, paused: false, cancelled: false, currentIndex: -1, resumeResolver: null };
    let worker = null;
    let requestId = 0;
    const pending = new Map();

    function tools() { return window.EasyFileRasterTools; }
    function emit(name, detail = {}) {
        document.dispatchEvent(new CustomEvent(name, { detail: { ...detail, operation: OPERATION } }));
    }

    function getWorker() {
        if (worker) return worker;
        worker = new Worker(`/js/image/replace-colors/replace-colors-worker.js?v=${Date.now()}`);
        worker.addEventListener("message", event => {
            const msg = event.data || {};
            const request = pending.get(msg.id);
            if (msg.type === "progress") {
                if (request) request.onProgress?.(Number(msg.progress) || 0);
                return;
            }
            if (!request) return;
            if (msg.type === "result") {
                pending.delete(msg.id);
                request.resolve(msg);
            } else if (msg.type === "error") {
                pending.delete(msg.id);
                request.reject(new Error(msg.message || "Color replacement worker failed."));
            }
        });
        worker.addEventListener("error", error => {
            const err = new Error(error?.message || "Color replacement worker failed.");
            pending.forEach(request => request.reject(err));
            pending.clear();
            worker?.terminate();
            worker = null;
        });
        return worker;
    }

    function terminateWorker(reason = "REPLACE_COLORS_CANCELLED") {
        if (worker) worker.terminate();
        worker = null;
        const error = new Error(reason);
        pending.forEach(request => request.reject(error));
        pending.clear();
    }


    function fileKey(file) {
        return window.EasyFileUIControls?.fileKey?.(file) || [
            file?.name || "",
            Number(file?.size) || 0,
            Number(file?.lastModified) || 0,
            file?.type || ""
        ].join("::");
    }

    function resolveFileSettings(settings, file, index) {
        if (settings?.configurationMode === "per-file") {
            const key = fileKey(file);
            const match = Array.isArray(settings.perFileSettings)
                ? settings.perFileSettings.find(item => item?.key === key || item?.index === index)
                : null;
            return match?.settings || settings.defaultSettings || {};
        }
        if (settings?.configurationMode === "all") return settings.defaultSettings || {};
        return settings || {};
    }
    async function checkpoint() {
        if (state.cancelled) throw new Error("REPLACE_COLORS_CANCELLED");
        if (state.paused) await new Promise(resolve => { state.resumeResolver = resolve; });
        if (state.cancelled) throw new Error("REPLACE_COLORS_CANCELLED");
    }

    function processBuffer(width, height, data, rules, onProgress) {
        const id = ++requestId;
        const buffer = data.buffer;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject, onProgress });
            getWorker().postMessage({ type: "process", id, width, height, buffer, rules }, [buffer]);
        });
    }

    async function processOne(file, settings, index) {
        const raster = tools();
        emit("easyfiletools:image-transform-file-progress", { index, percentage: 5 });
        await checkpoint();

        const decoded = await raster.decodeImage(file);
        let canvas = null;
        try {
            raster.assertSafeCanvas(decoded.width, decoded.height);
            if (decoded.width * decoded.height > MAX_PROCESS_PIXELS) {
                throw new Error(`This image is too large for safe pixel replacement in the browser (${decoded.width} × ${decoded.height}).`);
            }

            canvas = document.createElement("canvas");
            canvas.width = decoded.width;
            canvas.height = decoded.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Canvas 2D is unavailable.");
            context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
            emit("easyfiletools:image-transform-file-progress", { index, percentage: 18 });
            await checkpoint();

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const processed = await processBuffer(
                canvas.width,
                canvas.height,
                imageData.data,
                settings.rules,
                progress => emit("easyfiletools:image-transform-file-progress", {
                    index,
                    percentage: 18 + Math.round(progress * 0.62)
                })
            );
            await checkpoint();

            const outputPixels = new Uint8ClampedArray(processed.buffer);
            context.putImageData(new ImageData(outputPixels, canvas.width, canvas.height), 0, 0);
            emit("easyfiletools:image-transform-file-progress", { index, percentage: 84 });

            if (settings.outputFormat === "jpg" && settings.rules.some(rule => rule.action === "transparent")) {
                throw new Error("JPG cannot preserve transparency. Choose PNG or WebP.");
            }

            if (settings.outputFormat === "jpg") {
                const flattened = document.createElement("canvas");
                flattened.width = canvas.width;
                flattened.height = canvas.height;
                const flatContext = flattened.getContext("2d");
                if (!flatContext) throw new Error("Canvas 2D is unavailable.");
                flatContext.fillStyle = "#ffffff";
                flatContext.fillRect(0, 0, flattened.width, flattened.height);
                flatContext.drawImage(canvas, 0, 0);
                raster.releaseCanvas(canvas);
                canvas = flattened;
            }

            const blob = await raster.encodeCanvas(canvas, settings.outputFormat, settings.quality);
            emit("easyfiletools:image-transform-file-progress", { index, percentage: 100 });
            return {
                blob,
                outputUrl: URL.createObjectURL(blob),
                outputName: `${raster.baseName(file.name)}-colors.${settings.outputFormat}`,
                outputFormat: settings.outputFormat,
                outputSize: blob.size,
                width: canvas.width,
                height: canvas.height
            };
        } finally {
            raster.releaseCanvas(canvas);
            decoded.close?.();
        }
    }

    async function processFiles(items, settings) {
        if (state.running) return;
        const files = items.map(tools().extractFile).filter(Boolean);
        if (!files.length) return;

        state.running = true;
        state.paused = false;
        state.cancelled = false;
        state.currentIndex = -1;
        emit("easyfiletools:image-transform-started", { total: files.length });

        let operationError = null;
        let failedCount = 0;
        let firstError = null;

        try {
            for (let index = 0; index < files.length; index++) {
                state.currentIndex = index;
                await checkpoint();
                try {
                    const fileSettings = resolveFileSettings(settings, files[index], index);
                    const result = await processOne(files[index], fileSettings, index);
                    emit("easyfiletools:image-transform-file-complete", { index, file: files[index], result });
                } catch (error) {
                    if (error?.message === "REPLACE_COLORS_CANCELLED") throw error;
                    failedCount += 1;
                    firstError ||= error;
                    emit("easyfiletools:image-transform-file-error", { index, file: files[index], error });
                }
            }
            if (failedCount) {
                operationError = new Error(`${failedCount} of ${files.length} image${files.length === 1 ? "" : "s"} failed.${firstError?.message ? ` First error: ${firstError.message}` : ""}`);
            }
        } catch (error) {
            if (error?.message !== "REPLACE_COLORS_CANCELLED") operationError = error;
        } finally {
            const cancelled = state.cancelled;
            state.running = false;
            state.paused = false;
            state.currentIndex = -1;
            state.resumeResolver = null;
            emit("easyfiletools:image-transform-ended", { cancelled, error: operationError });
        }
    }

    function pause() {
        if (!state.running || state.paused) return;
        state.paused = true;
        worker?.postMessage({ type: "pause" });
        emit("easyfiletools:image-transform-paused");
    }
    function resume() {
        if (!state.running || !state.paused) return;
        state.paused = false;
        worker?.postMessage({ type: "resume" });
        const resolver = state.resumeResolver;
        state.resumeResolver = null;
        resolver?.();
        emit("easyfiletools:image-transform-resumed");
    }
    function cancel() {
        if (!state.running) return;
        state.cancelled = true;
        state.paused = false;
        worker?.postMessage({ type: "cancel" });
        const resolver = state.resumeResolver;
        state.resumeResolver = null;
        resolver?.();
        setTimeout(() => {
            if (state.cancelled && pending.size) terminateWorker();
        }, 80);
    }

    window.ReplaceColorsEngine = Object.freeze({ processFiles, pause, resume, cancel, getState: () => ({ ...state }) });
})();
