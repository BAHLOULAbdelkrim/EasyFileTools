console.log("[RESIZE/CROP IMAGE UI] loaded");

(() => {
    "use strict";

    const root = document.getElementById("resizeCropImageSettings");
    if (!root) return;

    const supportedInputs = new Set(["jpg", "jpeg", "png", "webp", "avif", "bmp"]);
    const lossyFormats = new Set(["jpg", "jpeg", "webp", "avif"]);

    const state = {
        files: [],
        configurationMode: "all",
        selectedIndex: 0,
        mode: "resize",
        cropRatio: "1:1",
        outputFormat: "same",
        quality: 0.92,
        globalConfig: null,
        perFileConfigs: new Map(),
        encoderSupport: new Map([["bmp", true]])
    };

    const el = {
        scopeButtons: [...root.querySelectorAll("[data-resize-config-scope]")],
        configFileRow: document.getElementById("resizeCropConfigFileRow"),
        configFile: document.getElementById("resizeCropConfigFile"),
        mode: [...root.querySelectorAll("[data-resize-crop-mode]")],
        resizeControls: document.getElementById("resizeImageControls"),
        cropControls: document.getElementById("cropImageControls"),
        width: document.getElementById("resizeImageWidth"),
        height: document.getElementById("resizeImageHeight"),
        keepAspect: document.getElementById("resizeImageKeepAspect"),
        preventUpscale: document.getElementById("resizeImagePreventUpscale"),
        ratios: [...root.querySelectorAll("[data-crop-ratio]")],
        anchor: document.getElementById("cropImageAnchor"),
        cropPreviewArea: document.getElementById("cropPreviewArea"),
        cropPreviewCaption: document.getElementById("cropPreviewCaption"),
        output: document.getElementById("resizeCropOutputFormat"),
        quality: document.getElementById("resizeCropQuality"),
        qualityValue: document.getElementById("resizeCropQualityValue"),
        validation: document.getElementById("resizeCropValidation")
    };

    const fileOf = item => item instanceof File ? item : item?.file || null;
    const extOf = file => window.EasyFileRasterTools?.normalizeExtension?.(file?.name || "") || "";
    const fileKey = file => window.EasyFileUIControls?.fileKey?.(file) || [file?.name || "", file?.size || 0, file?.lastModified || 0, file?.type || ""].join("::");
    const clone = value => JSON.parse(JSON.stringify(value));

    function readControls() {
        return {
            mode: state.mode,
            width: Number(el.width.value) || 0,
            height: Number(el.height.value) || 0,
            keepAspect: el.keepAspect.checked,
            preventUpscale: el.preventUpscale.checked,
            cropRatio: state.cropRatio,
            cropAnchor: el.anchor.value,
            outputFormat: state.outputFormat,
            quality: state.quality
        };
    }

    function applyConfig(config) {
        if (!config) return;
        state.mode = config.mode || "resize";
        state.cropRatio = config.cropRatio || "1:1";
        state.outputFormat = config.outputFormat || "same";
        state.quality = Number.isFinite(Number(config.quality)) ? Number(config.quality) : 0.92;
        el.width.value = Number(config.width) > 0 ? String(config.width) : "";
        el.height.value = Number(config.height) > 0 ? String(config.height) : "";
        el.keepAspect.checked = config.keepAspect !== false;
        el.preventUpscale.checked = config.preventUpscale !== false;
        el.anchor.value = config.cropAnchor || "center";
        el.output.value = state.outputFormat;
        el.quality.value = String(Math.round(state.quality * 100));
    }

    function currentFile() {
        return state.files[state.selectedIndex] || null;
    }

    function currentKey() {
        return fileKey(fileOf(currentFile()));
    }

    function ensureGlobalConfig() {
        if (!state.globalConfig) state.globalConfig = clone(readControls());
    }

    function ensurePerFileConfigs() {
        ensureGlobalConfig();
        for (const item of state.files) {
            const file = fileOf(item);
            if (!file) continue;
            const key = fileKey(file);
            if (!state.perFileConfigs.has(key)) {
                state.perFileConfigs.set(key, clone(state.globalConfig));
            }
        }
    }

    function saveActiveConfig() {
        const config = clone(readControls());
        if (state.configurationMode === "per-file") {
            const key = currentKey();
            if (key) state.perFileConfigs.set(key, config);
        } else {
            state.globalConfig = config;
        }
    }

    function activeConfig() {
        if (state.configurationMode === "per-file") {
            ensurePerFileConfigs();
            return clone(state.perFileConfigs.get(currentKey()) || state.globalConfig || readControls());
        }
        ensureGlobalConfig();
        return clone(state.globalConfig);
    }

    function settingsPayload() {
        saveActiveConfig();
        ensureGlobalConfig();
        if (state.configurationMode === "per-file") {
            ensurePerFileConfigs();
            return {
                configurationMode: "per-file",
                defaultSettings: clone(state.globalConfig),
                perFileSettings: state.files.map((item, index) => {
                    const file = fileOf(item);
                    const key = fileKey(file);
                    return { index, key, settings: clone(state.perFileConfigs.get(key) || state.globalConfig) };
                })
            };
        }
        return {
            configurationMode: "all",
            defaultSettings: clone(state.globalConfig),
            perFileSettings: []
        };
    }

    function configForFile(file, index) {
        if (state.configurationMode !== "per-file") return state.globalConfig || readControls();
        ensurePerFileConfigs();
        const key = fileKey(file);
        return state.perFileConfigs.get(key) || state.globalConfig || readControls();
    }

    function qualityApplies() {
        const config = readControls();
        if (config.outputFormat !== "same") return lossyFormats.has(config.outputFormat);
        if (state.configurationMode === "per-file") {
            const file = fileOf(currentFile());
            return Boolean(file && lossyFormats.has(extOf(file)));
        }
        return state.files.map(fileOf).filter(Boolean).some(file => lossyFormats.has(extOf(file)));
    }

    function validateConfig(config, files) {
        if (config.mode === "resize") {
            if (config.keepAspect && config.width <= 0 && config.height <= 0) return "Enter a target width or height.";
            if (!config.keepAspect && (config.width <= 0 || config.height <= 0)) return "Enter both width and height when aspect ratio is unlocked.";
        }
        if (config.outputFormat === "same") {
            const unsupported = files.some(file => state.encoderSupport.get(extOf(file)) === false);
            if (unsupported) return "This browser cannot encode one of the source formats. Choose JPG, PNG or WebP output instead.";
        } else if (state.encoderSupport.get(config.outputFormat) === false) {
            return `${config.outputFormat.toUpperCase()} encoding is not supported by this browser.`;
        }
        return null;
    }

    function validate() {
        const files = state.files.map(fileOf).filter(Boolean);
        if (!files.length) return { valid: false, message: "Load one or more raster images." };
        const unsupported = files.filter(file => !supportedInputs.has((file.name.split(".").pop() || "").toLowerCase()));
        if (unsupported.length) return { valid: false, message: "Resize / Crop currently supports JPG, PNG, WebP, AVIF and BMP raster images." };

        saveActiveConfig();
        ensureGlobalConfig();

        if (state.configurationMode === "per-file") {
            ensurePerFileConfigs();
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                const config = configForFile(file, index);
                const error = validateConfig(config, [file]);
                if (error) return { valid: false, message: `${file.name}: ${error}` };
            }
            return { valid: true, message: `Ready to process ${files.length} ${files.length === 1 ? "image" : "images"} with custom configuration.` };
        }

        const error = validateConfig(state.globalConfig, files);
        if (error) return { valid: false, message: error };
        return {
            valid: true,
            message: `Ready to ${state.globalConfig.mode === "resize" ? "resize" : "crop"} ${files.length} ${files.length === 1 ? "image" : "images"}.`
        };
    }

    function ratioValue() {
        const [w, h] = state.cropRatio.split(":").map(Number);
        return w > 0 && h > 0 ? w / h : 1;
    }

    function updateCropPreview() {
        if (!el.cropPreviewArea) return;
        const ratio = ratioValue();
        const maxW = 72;
        const maxH = 74;
        let width;
        let height;
        if (ratio >= maxW / maxH) {
            width = maxW;
            height = width / ratio;
        } else {
            height = maxH;
            width = height * ratio;
        }
        const anchor = el.anchor.value;
        let left = (100 - width) / 2;
        let top = (100 - height) / 2;
        if (anchor.includes("left") || anchor === "left") left = 5;
        if (anchor.includes("right") || anchor === "right") left = 95 - width;
        if (anchor.includes("top") || anchor === "top") top = 5;
        if (anchor.includes("bottom") || anchor === "bottom") top = 95 - height;
        el.cropPreviewArea.style.width = `${width}%`;
        el.cropPreviewArea.style.height = `${height}%`;
        el.cropPreviewArea.style.left = `${left}%`;
        el.cropPreviewArea.style.top = `${top}%`;
        el.cropPreviewArea.querySelector("span").textContent = state.cropRatio;
        if (el.cropPreviewCaption) {
            const label = anchor.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
            el.cropPreviewCaption.textContent = `${state.cropRatio} • ${label}`;
        }
    }

    function populateConfigFiles() {
        if (!el.configFile) return;
        el.configFile.innerHTML = "";
        state.files.forEach((item, index) => {
            const file = fileOf(item);
            if (!file) return;
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = file.name;
            el.configFile.appendChild(option);
        });
        if (!state.files.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Load an image first";
            el.configFile.appendChild(option);
        }
        state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, Math.max(0, state.files.length - 1)));
        el.configFile.value = state.files.length ? String(state.selectedIndex) : "";
        el.configFile.disabled = !state.files.length;
    }

    function render() {
        el.scopeButtons.forEach(button => button.classList.toggle("active", button.dataset.resizeConfigScope === state.configurationMode));
        el.configFileRow?.classList.toggle("hidden", state.configurationMode !== "per-file");
        el.resizeControls.classList.toggle("hidden", state.mode !== "resize");
        el.cropControls.classList.toggle("hidden", state.mode !== "crop");
        el.mode.forEach(btn => btn.classList.toggle("active", btn.dataset.resizeCropMode === state.mode));
        el.ratios.forEach(btn => btn.classList.toggle("active", btn.dataset.cropRatio === state.cropRatio));
        el.qualityValue.textContent = `${Math.round(state.quality * 100)}%`;
        const qualityEnabled = qualityApplies();
        el.quality.disabled = !qualityEnabled;
        el.quality.closest(".image-transform-range-row")?.classList.toggle("eft-setting-disabled", !qualityEnabled);
        window.EasyFileUIControls?.refreshRange?.(el.quality);
        updateCropPreview();
        const v = validate();
        el.validation.textContent = v.message;
        el.validation.classList.toggle("valid", v.valid);
        el.validation.classList.toggle("error", !v.valid && state.files.length > 0);
    }

    function dispatch() {
        const v = validate();
        document.dispatchEvent(new CustomEvent("easyfiletools:resize-crop-settings-changed", {
            detail: { valid: v.valid, settings: v.valid ? settingsPayload() : null }
        }));
    }

    function changed() {
        saveActiveConfig();
        render();
        dispatch();
    }

    function switchScope(mode) {
        if (mode === state.configurationMode) return;
        saveActiveConfig();
        if (mode === "per-file") {
            ensurePerFileConfigs();
            state.configurationMode = "per-file";
            populateConfigFiles();
            applyConfig(activeConfig());
        } else {
            state.configurationMode = "all";
            ensureGlobalConfig();
            applyConfig(state.globalConfig);
        }
        render();
        dispatch();
    }

    el.scopeButtons.forEach(button => button.addEventListener("click", () => switchScope(button.dataset.resizeConfigScope)));
    el.configFile?.addEventListener("change", () => {
        saveActiveConfig();
        state.selectedIndex = Number(el.configFile.value) || 0;
        applyConfig(activeConfig());
        render();
        dispatch();
    });
    el.mode.forEach(btn => btn.addEventListener("click", () => { state.mode = btn.dataset.resizeCropMode; changed(); }));
    el.ratios.forEach(btn => btn.addEventListener("click", () => { state.cropRatio = btn.dataset.cropRatio; changed(); }));
    [el.width, el.height].forEach(input => input.addEventListener("input", changed));
    [el.keepAspect, el.preventUpscale].forEach(input => input.addEventListener("change", changed));
    el.anchor.addEventListener("change", changed);
    el.output.addEventListener("change", () => { state.outputFormat = el.output.value; changed(); });
    el.quality.addEventListener("input", () => { state.quality = Number(el.quality.value) / 100; changed(); });

    function updateFiles(items) {
        saveActiveConfig();
        state.files = Array.isArray(items) ? items : [];
        ensurePerFileConfigs();
        populateConfigFiles();
        if (state.configurationMode === "per-file" && state.files.length) applyConfig(activeConfig());
        render();
        dispatch();
    }

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "resize-crop-image") return;
        Object.assign(state, { configurationMode: "all", selectedIndex: 0,
            mode: "resize", cropRatio: "1:1", outputFormat: "same",
            quality: 0.92, globalConfig: null });
        state.perFileConfigs.clear();
    });

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "resize-crop-image") return;
        updateFiles(event.detail.files || []);
    });
    document.addEventListener("easyfiletools:files-cleared", () => updateFiles([]));

    async function initSupport() {
        for (const format of ["jpg", "png", "webp", "avif"]) {
            state.encoderSupport.set(format, await window.EasyFileRasterTools.canEncode(format));
        }
        render();
        dispatch();
    }

    state.globalConfig = clone(readControls());
    window.ResizeCropImageUI = {
        getSettings: () => validate().valid ? settingsPayload() : null,
        isValid: () => validate().valid
    };
    populateConfigFiles();
    render();
    initSupport();
})();
