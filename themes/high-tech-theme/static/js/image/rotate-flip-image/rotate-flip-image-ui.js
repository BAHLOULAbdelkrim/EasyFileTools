console.log("[ROTATE/FLIP IMAGE UI] loaded");

(() => {
    "use strict";

    const root = document.getElementById("rotateFlipImageSettings");
    if (!root) return;

    const supportedInputs = new Set(["jpg", "jpeg", "png", "webp", "avif", "bmp"]);
    const lossyFormats = new Set(["jpg", "jpeg", "webp", "avif"]);
    const opaqueFormats = new Set(["jpg", "jpeg", "bmp"]);

    const state = {
        files: [],
        configurationMode: "all",
        selectedIndex: 0,
        rotationMode: "preset",
        rotation: 90,
        customAngleDeg: 15,
        flipHorizontal: false,
        flipVertical: false,
        outputFormat: "same",
        quality: 0.94,
        backgroundColor: "#ffffff",
        globalConfig: null,
        perFileConfigs: new Map(),
        encoderSupport: new Map([["bmp", true]])
    };

    const el = {
        scopeButtons: [...root.querySelectorAll("[data-rotate-config-scope]")],
        configFileRow: document.getElementById("rotateFlipConfigFileRow"),
        configFile: document.getElementById("rotateFlipConfigFile"),
        rotations: [...root.querySelectorAll("[data-rotation]")],
        customControls: document.getElementById("rotateCustomAngleControls"),
        angleUnit: document.getElementById("rotateAngleUnit"),
        angleInput: document.getElementById("rotateCustomAngleInput"),
        angleRange: document.getElementById("rotateCustomAngleRange"),
        angleEquivalent: document.getElementById("rotateAngleEquivalent"),
        flipH: document.getElementById("flipImageHorizontal"),
        flipV: document.getElementById("flipImageVertical"),
        cornerSection: document.getElementById("rotateCornerBackgroundSection"),
        cornerBackground: document.getElementById("rotateCornerBackground"),
        output: document.getElementById("rotateFlipOutputFormat"),
        quality: document.getElementById("rotateFlipQuality"),
        qualityValue: document.getElementById("rotateFlipQualityValue"),
        validation: document.getElementById("rotateFlipValidation")
    };

    const fileOf = item => item instanceof File ? item : item?.file || null;
    const extOf = file => window.EasyFileRasterTools?.normalizeExtension?.(file?.name || "") || "";
    const fileKey = file => window.EasyFileUIControls?.fileKey?.(file) || [file?.name || "", file?.size || 0, file?.lastModified || 0, file?.type || ""].join("::");
    const clone = value => JSON.parse(JSON.stringify(value));
    const degToRad = deg => deg * Math.PI / 180;
    const radToDeg = rad => rad * 180 / Math.PI;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function effectiveAngle() {
        return state.rotationMode === "custom" ? state.customAngleDeg : state.rotation;
    }

    function readControls() {
        return {
            rotationMode: state.rotationMode,
            rotation: effectiveAngle(),
            presetRotation: state.rotation,
            customAngleDeg: state.customAngleDeg,
            flipHorizontal: state.flipHorizontal,
            flipVertical: state.flipVertical,
            outputFormat: state.outputFormat,
            quality: state.quality,
            backgroundColor: state.backgroundColor
        };
    }

    function applyConfig(config) {
        if (!config) return;
        state.rotationMode = config.rotationMode || "preset";
        state.rotation = Number.isFinite(Number(config.presetRotation))
            ? Number(config.presetRotation)
            : (state.rotationMode === "preset" && Number.isFinite(Number(config.rotation)) ? Number(config.rotation) : 90);
        state.customAngleDeg = Number.isFinite(Number(config.customAngleDeg)) ? Number(config.customAngleDeg) : 15;
        state.flipHorizontal = Boolean(config.flipHorizontal);
        state.flipVertical = Boolean(config.flipVertical);
        state.outputFormat = config.outputFormat || "same";
        state.quality = Number.isFinite(Number(config.quality)) ? Number(config.quality) : 0.94;
        state.backgroundColor = config.backgroundColor || "#ffffff";
        el.output.value = state.outputFormat;
        el.quality.value = String(Math.round(state.quality * 100));
        el.cornerBackground.value = state.backgroundColor;
        setCustomFromDegrees(state.customAngleDeg);
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
            if (!state.perFileConfigs.has(key)) state.perFileConfigs.set(key, clone(state.globalConfig));
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

    function configForFile(file) {
        if (state.configurationMode !== "per-file") return state.globalConfig || readControls();
        ensurePerFileConfigs();
        return state.perFileConfigs.get(fileKey(file)) || state.globalConfig || readControls();
    }

    function angleFromConfig(config) {
        return Number(config.rotation) || 0;
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

    function needsCornerBackground() {
        const config = readControls();
        const angle = ((angleFromConfig(config) % 360) + 360) % 360;
        if (Math.abs(angle % 90) < 0.0001) return false;
        if (config.outputFormat !== "same") return opaqueFormats.has(config.outputFormat);
        if (state.configurationMode === "per-file") {
            const file = fileOf(currentFile());
            return Boolean(file && opaqueFormats.has(extOf(file)));
        }
        return state.files.map(fileOf).filter(Boolean).some(file => opaqueFormats.has(extOf(file)));
    }

    function validateConfig(config, files) {
        const angle = angleFromConfig(config);
        if (Math.abs(angle) < 0.000001 && !config.flipHorizontal && !config.flipVertical) {
            return "Choose a rotation or a flip operation.";
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
        if (files.some(file => !supportedInputs.has((file.name.split(".").pop() || "").toLowerCase()))) {
            return { valid: false, message: "Rotate / Flip currently supports JPG, PNG, WebP, AVIF and BMP raster images." };
        }
        saveActiveConfig();
        ensureGlobalConfig();
        if (state.configurationMode === "per-file") {
            ensurePerFileConfigs();
            for (const file of files) {
                const error = validateConfig(configForFile(file), [file]);
                if (error) return { valid: false, message: `${file.name}: ${error}` };
            }
            return { valid: true, message: `Ready to transform ${files.length} ${files.length === 1 ? "image" : "images"} with custom configuration.` };
        }
        const error = validateConfig(state.globalConfig, files);
        if (error) return { valid: false, message: error };
        return { valid: true, message: `Ready to transform ${files.length} ${files.length === 1 ? "image" : "images"}.` };
    }

    function setCustomFromDegrees(degrees, source = "range") {
        state.customAngleDeg = clamp(Number(degrees) || 0, -180, 180);
        const radians = degToRad(state.customAngleDeg);
        el.angleRange.value = String(state.customAngleDeg);
        if (el.angleUnit.value === "rad") {
            el.angleInput.min = (-Math.PI).toFixed(4);
            el.angleInput.max = Math.PI.toFixed(4);
            el.angleInput.step = "0.01";
            if (source !== "input") el.angleInput.value = radians.toFixed(4);
        } else {
            el.angleInput.min = "-180";
            el.angleInput.max = "180";
            el.angleInput.step = "1";
            if (source !== "input") el.angleInput.value = String(Math.round(state.customAngleDeg * 100) / 100);
        }
        el.angleEquivalent.textContent = `${state.customAngleDeg.toFixed(Math.abs(state.customAngleDeg % 1) > 0.001 ? 2 : 0)}° ≈ ${radians.toFixed(4)} rad`;
        window.EasyFileUIControls?.refreshRange?.(el.angleRange);
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
        el.scopeButtons.forEach(button => button.classList.toggle("active", button.dataset.rotateConfigScope === state.configurationMode));
        el.configFileRow?.classList.toggle("hidden", state.configurationMode !== "per-file");
        el.rotations.forEach(btn => {
            const key = btn.dataset.rotation;
            const active = key === "custom"
                ? state.rotationMode === "custom"
                : state.rotationMode === "preset" && Number(key) === state.rotation;
            btn.classList.toggle("active", active);
        });
        el.customControls.classList.toggle("hidden", state.rotationMode !== "custom");
        el.flipH.classList.toggle("active", state.flipHorizontal);
        el.flipV.classList.toggle("active", state.flipVertical);
        el.qualityValue.textContent = `${Math.round(state.quality * 100)}%`;

        const qualityEnabled = qualityApplies();
        el.quality.disabled = !qualityEnabled;
        el.quality.closest(".image-transform-range-row")?.classList.toggle("eft-setting-disabled", !qualityEnabled);
        window.EasyFileUIControls?.refreshRange?.(el.quality);

        const cornerNeeded = needsCornerBackground();
        el.cornerSection.classList.toggle("hidden", !cornerNeeded);
        window.EasyFileUIControls?.refreshColorPicker?.(el.cornerBackground.closest("[data-eft-color-picker]"));
        if (state.rotationMode === "custom") setCustomFromDegrees(state.customAngleDeg);

        const v = validate();
        el.validation.textContent = v.message;
        el.validation.classList.toggle("valid", v.valid);
        el.validation.classList.toggle("error", !v.valid && state.files.length > 0);
    }

    function dispatch() {
        const v = validate();
        document.dispatchEvent(new CustomEvent("easyfiletools:rotate-flip-settings-changed", {
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

    el.scopeButtons.forEach(button => button.addEventListener("click", () => switchScope(button.dataset.rotateConfigScope)));
    el.configFile?.addEventListener("change", () => {
        saveActiveConfig();
        state.selectedIndex = Number(el.configFile.value) || 0;
        applyConfig(activeConfig());
        render();
        dispatch();
    });
    el.rotations.forEach(btn => btn.addEventListener("click", () => {
        if (btn.dataset.rotation === "custom") state.rotationMode = "custom";
        else { state.rotationMode = "preset"; state.rotation = Number(btn.dataset.rotation); }
        changed();
    }));
    el.angleRange.addEventListener("input", () => {
        state.rotationMode = "custom";
        setCustomFromDegrees(Number(el.angleRange.value), "range");
        changed();
    });
    el.angleInput.addEventListener("input", () => {
        state.rotationMode = "custom";
        const raw = Number(el.angleInput.value) || 0;
        setCustomFromDegrees(el.angleUnit.value === "rad" ? radToDeg(raw) : raw, "input");
        changed();
    });
    el.angleUnit.addEventListener("change", () => { setCustomFromDegrees(state.customAngleDeg); changed(); });
    el.flipH.addEventListener("click", () => { state.flipHorizontal = !state.flipHorizontal; changed(); });
    el.flipV.addEventListener("click", () => { state.flipVertical = !state.flipVertical; changed(); });
    el.output.addEventListener("change", () => { state.outputFormat = el.output.value; changed(); });
    el.quality.addEventListener("input", () => { state.quality = Number(el.quality.value) / 100; changed(); });
    el.cornerBackground.addEventListener("input", () => { state.backgroundColor = el.cornerBackground.value; changed(); });

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
        if (event.detail?.operation !== "rotate-flip-image") return;
        Object.assign(state, { configurationMode: "all", selectedIndex: 0,
            rotationMode: "preset", rotation: 90, customAngleDeg: 15,
            flipHorizontal: false, flipVertical: false, outputFormat: "same",
            quality: 0.94, backgroundColor: "#ffffff", globalConfig: null });
        state.perFileConfigs.clear();
    });

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "rotate-flip-image") return;
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
    window.RotateFlipImageUI = {
        getSettings: () => validate().valid ? settingsPayload() : null,
        isValid: () => validate().valid
    };
    setCustomFromDegrees(state.customAngleDeg);
    populateConfigFiles();
    render();
    initSupport();
})();
