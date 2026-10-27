console.log("[IMAGE TRANSFORM ENGINE] loaded");

(() => {
    "use strict";

    const tools = () => window.EasyFileRasterTools;

    function create(operation, transform) {
        const state = {
            running: false,
            paused: false,
            cancelled: false,
            currentIndex: -1,
            resumeResolver: null
        };

        function emit(name, detail = {}) {
            document.dispatchEvent(new CustomEvent(name, {
                detail: { ...detail, operation }
            }));
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

            if (settings?.configurationMode === "all") {
                return settings.defaultSettings || {};
            }

            return settings || {};
        }
        async function checkpoint() {
            if (state.cancelled) throw new Error("IMAGE_TRANSFORM_CANCELLED");
            if (state.paused) {
                await new Promise(resolve => { state.resumeResolver = resolve; });
            }
            if (state.cancelled) throw new Error("IMAGE_TRANSFORM_CANCELLED");
        }

        async function processOne(file, settings, index) {
            const raster = tools();
            emit("easyfiletools:image-transform-file-progress", { index, percentage: 5 });
            await checkpoint();

            const decoded = await raster.decodeImage(file);
            let canvas = null;
            try {
                raster.assertSafeCanvas(decoded.width, decoded.height);
                emit("easyfiletools:image-transform-file-progress", { index, percentage: 25 });
                await checkpoint();

                const transformed = await transform({ file, decoded, settings, checkpoint });
                const sourceFormat = raster.normalizeExtension(file.name);
                const outputFormat = settings.outputFormat === "same"
                    ? sourceFormat
                    : settings.outputFormat;

                if (!["jpg", "png", "webp", "avif", "bmp"].includes(outputFormat)) {
                    throw new Error(`The ${outputFormat || sourceFormat || "source"} format cannot be encoded by this browser tool.`);
                }

                if (
                    transformed?.passthrough === true &&
                    outputFormat === sourceFormat
                ) {
                    emit("easyfiletools:image-transform-file-progress", { index, percentage: 100 });
                    return {
                        blob: file,
                        outputUrl: URL.createObjectURL(file),
                        outputName: file.name,
                        outputFormat: sourceFormat,
                        outputSize: file.size,
                        width: decoded.width,
                        height: decoded.height,
                        passthrough: true
                    };
                }

                canvas = transformed?.canvas;
                if (!canvas) throw new Error("Image transform produced no canvas.");
                raster.assertSafeCanvas(canvas.width, canvas.height);

                emit("easyfiletools:image-transform-file-progress", { index, percentage: 70 });
                await checkpoint();

                const blob = await raster.encodeCanvas(canvas, outputFormat, settings.quality ?? 0.92);
                emit("easyfiletools:image-transform-file-progress", { index, percentage: 95 });
                await checkpoint();

                const suffix = transformed.suffix || operation;
                const outputName = `${raster.baseName(file.name)}-${suffix}.${outputFormat}`;
                const result = {
                    blob,
                    outputUrl: URL.createObjectURL(blob),
                    outputName,
                    outputFormat,
                    outputSize: blob.size,
                    width: canvas.width,
                    height: canvas.height
                };

                emit("easyfiletools:image-transform-file-progress", { index, percentage: 100 });
                return result;
            }
            finally {
                if (canvas) tools().releaseCanvas(canvas);
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
            try {
                for (let index = 0; index < files.length; index++) {
                    state.currentIndex = index;
                    await checkpoint();
                    try {
                        const fileSettings = resolveFileSettings(settings, files[index], index);
                        const result = await processOne(files[index], fileSettings, index);
                        emit("easyfiletools:image-transform-file-complete", {
                            index,
                            file: files[index],
                            result
                        });
                    }
                    catch (error) {
                        if (error?.message === "IMAGE_TRANSFORM_CANCELLED") throw error;
                        operationError = error;
                        emit("easyfiletools:image-transform-file-error", { index, file: files[index], error });
                        throw error;
                    }
                }
            }
            catch (error) {
                if (error?.message !== "IMAGE_TRANSFORM_CANCELLED") {
                    operationError ||= error;
                    console.error(`[${operation.toUpperCase()}]`, error);
                }
            }
            finally {
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
            emit("easyfiletools:image-transform-paused");
        }

        function resume() {
            if (!state.running || !state.paused) return;
            state.paused = false;
            const resolver = state.resumeResolver;
            state.resumeResolver = null;
            resolver?.();
            emit("easyfiletools:image-transform-resumed");
        }

        function cancel() {
            if (!state.running) return;
            state.cancelled = true;
            state.paused = false;
            const resolver = state.resumeResolver;
            state.resumeResolver = null;
            resolver?.();
        }

        return Object.freeze({ processFiles, pause, resume, cancel, getState: () => ({ ...state }) });
    }

    window.EasyFileImageTransformEngine = Object.freeze({ create });
})();
