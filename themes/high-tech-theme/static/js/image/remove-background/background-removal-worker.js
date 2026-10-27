/*
 * EasyFile Tools — Remove Background AI Worker
 * General-purpose local background removal powered by IS-Net.
 *
 * Important implementation detail:
 * Ko033/isnet-general-use-onnx declares model_type "custom". Transformers.js
 * 4.2 therefore cannot instantiate it through pipeline("image-segmentation").
 * The ONNX graph itself has a simple documented I/O contract, so this worker
 * runs it directly with ONNX Runtime Web instead of asking Transformers.js to
 * resolve a model architecture.
 */

const ORT_VERSION = "1.30.0";
const ORT_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.all.min.mjs`;
const ORT_WASM_PATH =
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_URL =
    "https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/main/onnx/model_quantized.onnx?download=true";
const MODEL_CACHE = "easyfiletools-ai-models-v2";
const MODEL_SIZE = 1024;

let ortModule = null;
let session = null;
let sessionPromise = null;
let activeDevice = null;

function status(value, label) {
    self.postMessage({ type: "status", status: value, label });
}

function modelProgress(progress, label, loaded = 0, total = 0) {
    self.postMessage({
        type: "model-progress",
        progress: Math.max(0, Math.min(100, Number(progress) || 0)),
        loaded,
        total,
        label
    });
}

async function loadOrt() {
    if (ortModule) return ortModule;

    status("loading", "Loading AI runtime…");
    ortModule = await import(ORT_MODULE_URL);

    // Keep inference predictable in a dedicated worker and avoid nested worker
    // / cross-origin-isolation requirements. SIMD remains available.
    ortModule.env.wasm.numThreads = 1;
    ortModule.env.wasm.proxy = false;
    ortModule.env.wasm.wasmPaths = ORT_WASM_PATH;
    ortModule.env.logLevel = "fatal";


    return ortModule;
}

async function getCachedResponse(request) {
    if (!("caches" in self)) return null;

    try {
        const cache = await caches.open(MODEL_CACHE);
        return await cache.match(request);
    } catch (error) {
        console.warn("[BACKGROUND WORKER] Model cache lookup failed:", error);
        return null;
    }
}

async function storeResponse(request, response) {
    if (!("caches" in self)) return;

    try {
        const cache = await caches.open(MODEL_CACHE);
        await cache.put(request, response);
    } catch (error) {
        // Cache failure must never prevent the operation from working.
        console.warn("[BACKGROUND WORKER] Model cache write failed:", error);
    }
}

async function responseToArrayBufferWithProgress(response, fromCache = false) {
    const total = Number(response.headers.get("content-length")) || 0;

    if (!response.body) {
        const buffer = await response.arrayBuffer();
        modelProgress(
            100,
            fromCache ? "General AI model loaded from cache" : "General AI model downloaded",
            buffer.byteLength,
            total || buffer.byteLength
        );
        return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        loaded += value.byteLength;

        if (total > 0) {
            const percentage = (loaded / total) * 100;
            modelProgress(
                percentage,
                fromCache
                    ? `Loading cached general AI model • ${Math.round(percentage)}%`
                    : `Downloading general AI model • ${Math.round(percentage)}%`,
                loaded,
                total
            );
        }
    }

    const combined = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }

    modelProgress(
        100,
        fromCache ? "General AI model loaded from cache" : "General AI model downloaded",
        loaded,
        total || loaded
    );

    return combined.buffer;
}

async function loadModelBuffer() {
    const request = new Request(MODEL_URL, {
        mode: "cors",
        credentials: "omit",
        cache: "default"
    });

    const cached = await getCachedResponse(request);
    if (cached) {
        modelProgress(0, "Loading cached general AI model…");
        return responseToArrayBufferWithProgress(cached, true);
    }

    modelProgress(0, "Downloading general AI model…");
    const response = await fetch(request);

    if (!response.ok) {
        throw new Error(
            `Unable to download the AI model (HTTP ${response.status}).`
        );
    }

    // Cache a cloned response while the primary stream feeds the current run.
    // Do not await first: both streams can progress concurrently.
    const cachePromise = storeResponse(request, response.clone());
    const buffer = await responseToArrayBufferWithProgress(response, false);
    await cachePromise;
    return buffer;
}


async function hasUsableWebGpu() {
    if (
        typeof navigator === "undefined" ||
        !navigator.gpu ||
        typeof navigator.gpu.requestAdapter !== "function"
    ) {
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        return Boolean(adapter);
    } catch (_) {
        return false;
    }
}

async function createSession() {
    if (session) return session;
    if (sessionPromise) return sessionPromise;

    sessionPromise = (async () => {
        const ort = await loadOrt();
        status("loading", "Preparing general background model…");
        const modelBuffer = await loadModelBuffer();

        status("loading", "Initializing AI model…");

        let created = null;
        let usedWebGpu = false;

        if (await hasUsableWebGpu()) {
            try {
                status("loading", "Initializing IS-Net • WebGPU…");
                created = await ort.InferenceSession.create(modelBuffer, {
                    executionProviders: ["webgpu", "wasm"],
                    graphOptimizationLevel: "all",
                    logSeverityLevel: 4
                });
                usedWebGpu = true;
            } catch (_) {
                // Silent fallback: unsupported/blocked WebGPU is an expected
                // environment condition, not an operation error.
                created = null;
            }
        }

        if (!created) {
            status("loading", "Initializing IS-Net • WASM…");
            created = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ["wasm"],
                graphOptimizationLevel: "all",
                executionMode: "sequential",
                logSeverityLevel: 4
            });
        }

        session = created;
        activeDevice = usedWebGpu
            ? "IS-Net • WebGPU • q8"
            : "IS-Net • WASM • q8";
        status("ready", "AI ready");
        return created;
    })();

    try {
        return await sessionPromise;
    } catch (error) {
        sessionPromise = null;
        session = null;
        throw error;
    }
}

async function decodeAndPreprocess(buffer, mime) {
    const blob = new Blob([buffer], { type: mime || "image/png" });
    const bitmap = await createImageBitmap(blob);

    try {
        const originalWidth = bitmap.width;
        const originalHeight = bitmap.height;

        if (!originalWidth || !originalHeight) {
            throw new Error("Unable to decode the source image.");
        }

        const canvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
        const context = canvas.getContext("2d", {
            alpha: false,
            willReadFrequently: true
        });

        if (!context) {
            throw new Error("Offscreen Canvas 2D is unavailable in the AI worker.");
        }

        // IS-Net's published preprocessing resizes to 1024 × 1024, then uses
        // x / 255 - 0.5 normalization. Stretching here matches that contract;
        // the mask is mapped back to the source aspect ratio by the compositor.
        context.fillStyle = "#000000";
        context.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
        context.drawImage(bitmap, 0, 0, MODEL_SIZE, MODEL_SIZE);

        const rgba = context.getImageData(
            0,
            0,
            MODEL_SIZE,
            MODEL_SIZE
        ).data;

        const planeSize = MODEL_SIZE * MODEL_SIZE;
        const input = new Float32Array(planeSize * 3);

        for (let i = 0; i < planeSize; i++) {
            const offset = i * 4;
            input[i] = rgba[offset] / 255 - 0.5;
            input[planeSize + i] = rgba[offset + 1] / 255 - 0.5;
            input[planeSize * 2 + i] = rgba[offset + 2] / 255 - 0.5;
        }

        return {
            input,
            originalWidth,
            originalHeight
        };
    } finally {
        bitmap.close?.();
    }
}

function normalizeMask(outputTensor) {
    const values = outputTensor?.data;
    const dims = outputTensor?.dims;

    if (!values || !dims || dims.length < 2) {
        throw new Error("AI model returned an invalid output tensor.");
    }

    const height = Number(dims[dims.length - 2]);
    const width = Number(dims[dims.length - 1]);

    if (!width || !height || values.length < width * height) {
        throw new Error("AI model returned invalid mask dimensions.");
    }

    let min = Infinity;
    let max = -Infinity;
    const count = width * height;

    for (let i = 0; i < count; i++) {
        const value = Number(values[i]);
        if (!Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error("AI Model returned a non-finite foreground mask.");
    }

    // rembg/IS-Net convention: min-max normalize each prediction before it
    // becomes the alpha matte. This also makes quantized output robust to a
    // slightly narrower numeric range.
    const range = max - min;
    const mask = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
        let value = Number(values[i]);
        if (!Number.isFinite(value)) value = min;

        const normalized = range > 1e-7
            ? (value - min) / range
            : Math.max(0, Math.min(1, value));

        mask[i] = Math.max(
            0,
            Math.min(255, Math.round(normalized * 255))
        );
    }

    return { mask, width, height };
}

async function processImage(message) {
    const { id, buffer, mime } = message;

    try {
        const ort = await loadOrt();
        const currentSession = await createSession();
        status("ready", "Removing background…");

        const prepared = await decodeAndPreprocess(buffer, mime);
        const inputName = currentSession.inputNames?.[0] || "input_image";
        const outputName = currentSession.outputNames?.[0] || "output_image";

        const tensor = new ort.Tensor(
            "float32",
            prepared.input,
            [1, 3, MODEL_SIZE, MODEL_SIZE]
        );

        const outputs = await currentSession.run({
            [inputName]: tensor
        });

        const outputTensor = outputs[outputName] || outputs.output_image;
        if (!outputTensor) {
            throw new Error("AI Model returned no foreground tensor.");
        }

        const normalized = normalizeMask(outputTensor);

        self.postMessage({
            type: "result",
            id,
            width: normalized.width,
            height: normalized.height,
            sourceWidth: prepared.originalWidth,
            sourceHeight: prepared.originalHeight,
            maskBuffer: normalized.mask.buffer,
            device: activeDevice
        }, [normalized.mask.buffer]);

        status("ready", "AI ready");
    } catch (error) {
        console.error("[BACKGROUND WORKER]", error);
        self.postMessage({
            type: "error",
            id,
            message: error?.message || String(error)
        });
        status(
            "error",
            `AI processing failed • ${error?.message || "Unknown error"}`
        );
    }
}

self.addEventListener("message", event => {
    const message = event.data;
    if (message?.type === "process") {
        processImage(message);
    }
});
