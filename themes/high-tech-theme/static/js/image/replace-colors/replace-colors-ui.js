console.log("[REPLACE COLORS UI] loaded");

(() => {
    "use strict";

    const zone = document.getElementById("operation-zone");
    if (!zone || zone.dataset.operation !== "replace-colors") return;

    const el = {
        scopeButtons: [...document.querySelectorAll("[data-replace-config-scope]")],
        scopeNote: document.getElementById("replaceColorsConfigScopeNote"),
        previewFile: document.getElementById("replaceColorsPreviewFile"),
        previewCanvas: document.getElementById("replaceColorsPreviewCanvas"),
        previewEmpty: document.getElementById("replaceColorsPreviewEmpty"),
        previewHint: document.getElementById("replaceColorsPreviewHint"),
        sourceColor: document.getElementById("replaceColorsSourceColor"),
        targetWrap: document.getElementById("replaceColorsTargetWrap"),
        targetColor: document.getElementById("replaceColorsTargetColor"),
        actionGroup: document.getElementById("replaceColorsActionGroup"),
        tolerance: document.getElementById("replaceColorsTolerance"),
        toleranceValue: document.getElementById("replaceColorsToleranceValue"),
        softness: document.getElementById("replaceColorsSoftness"),
        softnessValue: document.getElementById("replaceColorsSoftnessValue"),
        addRule: document.getElementById("replaceColorsAddRule"),
        rulesSection: document.getElementById("replaceColorsRulesSection"),
        rulesHelp: document.getElementById("replaceColorsRulesHelp"),
        rulesList: document.getElementById("replaceColorsRulesList"),
        clearRules: document.getElementById("replaceColorsClearRules"),
        formatGroup: document.getElementById("replaceColorsFormatGroup"),
        qualityWrap: document.getElementById("replaceColorsQualityWrap"),
        quality: document.getElementById("replaceColorsQuality"),
        qualityValue: document.getElementById("replaceColorsQualityValue"),
        validation: document.getElementById("replaceColorsValidation")
    };

    const state = {
        files: [],
        configurationMode: "all",
        globalRules: [],
        perFileRules: new Map(),
        action: "transparent",
        outputFormat: "png",
        quality: 0.92,
        hasSelection: false,
        previewIndex: 0,
        previewDecoded: null,
        previewBase: null,
        previewRenderToken: 0
    };

    const MAX_PREVIEW_WIDTH = 820;
    const MAX_PREVIEW_HEIGHT = 500;
    const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);
    const cloneRules = rules => (rules || []).map(rule => ({ ...rule }));
    const fileKey = file => window.EasyFileUIControls?.fileKey?.(file) || [file?.name || "", file?.size || 0, file?.lastModified || 0, file?.type || ""].join("::");

    function normalizeHex(value, fallback = "#000000") {
        const raw = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback.toUpperCase();
    }

    function hexToRgb(hex) {
        const value = normalizeHex(hex).slice(1);
        return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
    }

    function rgbToHex(r, g, b) {
        const h = value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
        return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
    }

    function activeFile() {
        return state.files[state.previewIndex] || null;
    }

    function activeKey() {
        return fileKey(activeFile());
    }

    function ensurePerFileRules() {
        for (const file of state.files) {
            const key = fileKey(file);
            if (!state.perFileRules.has(key)) state.perFileRules.set(key, cloneRules(state.globalRules));
        }
    }

    function currentRules() {
        if (state.configurationMode === "per-file") {
            ensurePerFileRules();
            const key = activeKey();
            if (!state.perFileRules.has(key)) state.perFileRules.set(key, cloneRules(state.globalRules));
            return state.perFileRules.get(key) || [];
        }
        return state.globalRules;
    }

    function candidateRule() {
        if (!state.hasSelection) return null;
        return {
            sourceColor: normalizeHex(el.sourceColor.value),
            action: state.action,
            targetColor: normalizeHex(el.targetColor.value, "#FFFFFF"),
            tolerance: Number(el.tolerance.value) || 0,
            softness: Number(el.softness.value) || 0
        };
    }

    function buildSettingsPayload() {
        ensurePerFileRules();
        const base = { rules: cloneRules(state.globalRules), outputFormat: state.outputFormat, quality: state.quality };
        return {
            configurationMode: state.configurationMode,
            defaultSettings: base,
            perFileSettings: state.configurationMode === "per-file"
                ? state.files.map((file, index) => ({
                    index,
                    key: fileKey(file),
                    settings: {
                        rules: cloneRules(state.perFileRules.get(fileKey(file)) || []),
                        outputFormat: state.outputFormat,
                        quality: state.quality
                    }
                }))
                : []
        };
    }

    function allRules() {
        if (state.configurationMode === "all") return state.globalRules;
        ensurePerFileRules();
        return state.files.flatMap(file => state.perFileRules.get(fileKey(file)) || []);
    }

    function hasTransparency() {
        return allRules().some(rule => rule.action === "transparent");
    }

    function isLifecycleOwned() {
        const status = window.EasyFileOperationController?.getState?.().status;
        return ["running", "paused", "cancelling", "completed", "cancelled", "error"].includes(status);
    }

    function validSettings() {
        if (!state.files.length) return false;
        if (state.outputFormat === "jpg" && hasTransparency()) return false;
        if (state.configurationMode === "all") return state.globalRules.length > 0;
        ensurePerFileRules();
        return state.files.every(file => (state.perFileRules.get(fileKey(file)) || []).length > 0);
    }

    function renderScope() {
        el.scopeButtons.forEach(button => button.classList.toggle("active", button.dataset.replaceConfigScope === state.configurationMode));
        if (el.scopeNote) {
            if (state.configurationMode === "all") {
                el.scopeNote.textContent = "The same color rules will be applied to every loaded image.";
            } else {
                const configured = state.files.filter(file => (state.perFileRules.get(fileKey(file)) || []).length > 0).length;
                el.scopeNote.textContent = `${configured}/${state.files.length} images currently have custom color rules. Use the Preview image selector to edit another image.`;
            }
        }
    }

    function renderValidation() {
        if (isLifecycleOwned()) return;
        const valid = validSettings();
        el.validation.classList.toggle("valid", valid);
        el.validation.classList.remove("error");
        if (!state.files.length) {
            el.validation.textContent = "Load one or more images and add at least one color rule.";
        } else if (state.configurationMode === "all" && !state.globalRules.length) {
            el.validation.textContent = "Pick a color in the preview and add at least one color rule.";
        } else if (state.configurationMode === "per-file" && !state.files.every(file => (state.perFileRules.get(fileKey(file)) || []).length > 0)) {
            const missing = state.files.find(file => !(state.perFileRules.get(fileKey(file)) || []).length);
            el.validation.textContent = `${missing?.name || "An image"}: add at least one color rule.`;
        } else if (state.outputFormat === "jpg" && hasTransparency()) {
            el.validation.classList.add("error");
            el.validation.textContent = "JPG cannot preserve transparent color rules. Choose PNG or WebP.";
        } else if (state.configurationMode === "per-file") {
            el.validation.textContent = `Ready to apply custom color rules to ${state.files.length} image${state.files.length === 1 ? "" : "s"}.`;
        } else {
            el.validation.textContent = `Ready to apply ${state.globalRules.length} color rule${state.globalRules.length === 1 ? "" : "s"} to ${state.files.length} image${state.files.length === 1 ? "" : "s"}.`;
        }
    }

    function dispatchSettingsChanged() {
        renderScope();
        renderValidation();
        document.dispatchEvent(new CustomEvent("easyfiletools:replace-colors-settings-changed", {
            detail: { valid: validSettings(), settings: buildSettingsPayload() }
        }));
    }

    function refreshQualityState() {
        const enabled = ["webp", "jpg"].includes(state.outputFormat);
        el.quality.disabled = !enabled;
        el.qualityWrap.classList.toggle("eft-setting-disabled", !enabled);
        window.EasyFileUIControls?.refreshRange?.(el.quality);
    }

    function refreshFormatButtons() {
        const transparency = hasTransparency();
        el.formatGroup.querySelectorAll("[data-replace-format]").forEach(button => {
            const format = button.dataset.replaceFormat;
            button.disabled = transparency && format === "jpg";
        });
        if (transparency && state.outputFormat === "jpg") state.outputFormat = "png";
        el.formatGroup.querySelectorAll("[data-replace-format]").forEach(button => {
            button.classList.toggle("active", button.dataset.replaceFormat === state.outputFormat);
        });
        refreshQualityState();
    }

    function renderRules() {
        const rules = currentRules();
        el.rulesSection.classList.toggle("hidden", rules.length === 0);
        if (el.rulesHelp) {
            el.rulesHelp.textContent = state.configurationMode === "per-file" && activeFile()
                ? `Rules for ${activeFile().name}. They are evaluated against the original pixels; the strongest matching rule wins.`
                : "Rules are evaluated against the original pixels; the strongest matching rule wins.";
        }
        el.rulesList.innerHTML = "";
        rules.forEach((rule, index) => {
            const item = document.createElement("div");
            item.className = "replace-rule-item";
            const target = rule.action === "transparent"
                ? '<span class="replace-rule-transparent" title="Transparent"></span><strong>Transparent</strong>'
                : `<span class="replace-rule-swatch" style="background:${rule.targetColor}"></span><strong>${rule.targetColor}</strong>`;
            item.innerHTML = `
                <div class="replace-rule-main">
                    <span class="replace-rule-swatch" style="background:${rule.sourceColor}"></span>
                    <strong>${rule.sourceColor}</strong>
                    <span class="replace-rule-arrow">→</span>
                    ${target}
                    <span class="replace-rule-meta">Tolerance ${rule.tolerance}% • Softness ${rule.softness}%</span>
                </div>
                <button type="button" class="replace-rule-remove" data-rule-index="${index}" aria-label="Remove color rule">Remove</button>
            `;
            el.rulesList.appendChild(item);
        });
        el.rulesList.querySelectorAll("[data-rule-index]").forEach(button => {
            button.addEventListener("click", () => {
                currentRules().splice(Number(button.dataset.ruleIndex), 1);
                refreshFormatButtons();
                renderRules();
                schedulePreview();
                dispatchSettingsChanged();
            });
        });
    }

    function strengthFor(r, g, b, rule) {
        const source = hexToRgb(rule.sourceColor);
        const dr = r - source.r;
        const dg = g - source.g;
        const db = b - source.b;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db) / MAX_RGB_DISTANCE * 100;
        const tolerance = Number(rule.tolerance) || 0;
        const softness = Number(rule.softness) || 0;
        if (distance <= tolerance) return 1;
        if (softness <= 0 || distance > tolerance + softness) return 0;
        return Math.max(0, Math.min(1, 1 - (distance - tolerance) / softness));
    }

    function renderPreviewNow() {
        if (!state.previewBase || !el.previewCanvas) return;
        const context = el.previewCanvas.getContext("2d");
        if (!context) return;
        const data = new Uint8ClampedArray(state.previewBase.data);
        const rules = cloneRules(currentRules());
        const candidate = candidateRule();
        if (candidate) rules.push(candidate);
        const prepared = rules.map(rule => ({ ...rule, target: rule.action === "color" ? hexToRgb(rule.targetColor) : null }));
        for (let offset = 0; offset < data.length; offset += 4) {
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const a = data[offset + 3];
            if (a === 0) continue;
            let best = null;
            let bestStrength = 0;
            for (const rule of prepared) {
                const strength = strengthFor(r, g, b, rule);
                if (strength > bestStrength) { bestStrength = strength; best = rule; }
            }
            if (!best || bestStrength <= 0) continue;
            if (best.action === "transparent") data[offset + 3] = Math.round(a * (1 - bestStrength));
            else if (best.target) {
                data[offset] = Math.round(r * (1 - bestStrength) + best.target.r * bestStrength);
                data[offset + 1] = Math.round(g * (1 - bestStrength) + best.target.g * bestStrength);
                data[offset + 2] = Math.round(b * (1 - bestStrength) + best.target.b * bestStrength);
            }
        }
        context.putImageData(new ImageData(data, state.previewBase.width, state.previewBase.height), 0, 0);
    }

    function schedulePreview() {
        const token = ++state.previewRenderToken;
        requestAnimationFrame(() => { if (token === state.previewRenderToken) renderPreviewNow(); });
    }

    async function loadPreview(index = 0) {
        state.previewIndex = Math.max(0, Math.min(state.files.length - 1, Number(index) || 0));
        state.previewDecoded?.close?.();
        state.previewDecoded = null;
        state.previewBase = null;
        state.hasSelection = false;
        el.addRule.disabled = true;
        if (!state.files.length) {
            el.previewEmpty.classList.remove("hidden");
            el.previewCanvas.width = 1;
            el.previewCanvas.height = 1;
            renderRules();
            dispatchSettingsChanged();
            return;
        }
        const file = state.files[state.previewIndex];
        try {
            const decoded = await window.EasyFileRasterTools.decodeImage(file);
            state.previewDecoded = decoded;
            const scale = Math.min(1, MAX_PREVIEW_WIDTH / decoded.width, MAX_PREVIEW_HEIGHT / decoded.height);
            const width = Math.max(1, Math.round(decoded.width * scale));
            const height = Math.max(1, Math.round(decoded.height * scale));
            el.previewCanvas.width = width;
            el.previewCanvas.height = height;
            const context = el.previewCanvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Canvas 2D is unavailable.");
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.clearRect(0, 0, width, height);
            context.drawImage(decoded.source, 0, 0, width, height);
            state.previewBase = context.getImageData(0, 0, width, height);
            el.previewEmpty.classList.add("hidden");
            el.previewHint.textContent = `Preview: ${file.name} • click a pixel to pick its original color.`;
            renderRules();
            refreshFormatButtons();
            renderScope();
            schedulePreview();
            dispatchSettingsChanged();
        } catch (error) {
            el.previewEmpty.classList.remove("hidden");
            el.previewEmpty.textContent = error?.message || "Unable to preview this image.";
        }
    }

    function populatePreviewFiles() {
        el.previewFile.innerHTML = "";
        state.files.forEach((file, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = file.name;
            el.previewFile.appendChild(option);
        });
        if (!state.files.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Load an image first";
            el.previewFile.appendChild(option);
        }
        el.previewFile.disabled = state.files.length === 0;
        if (state.previewIndex >= state.files.length) state.previewIndex = 0;
        el.previewFile.value = state.files.length ? String(state.previewIndex) : "";
    }

    async function setFiles(items) {
        state.files = (Array.isArray(items) ? items : []).map(window.EasyFileRasterTools.extractFile).filter(Boolean);
        ensurePerFileRules();
        populatePreviewFiles();
        await loadPreview(state.previewIndex);
        dispatchSettingsChanged();
    }

    async function syncFiles() {
        const data = typeof loadSelectedFiles === "function" ? await loadSelectedFiles() : null;
        await setFiles(data?.category === "Image" ? data.files : []);
    }

    function switchScope(mode) {
        if (mode === state.configurationMode) return;
        if (mode === "per-file") ensurePerFileRules();
        state.configurationMode = mode;
        state.hasSelection = false;
        el.addRule.disabled = true;
        renderScope();
        renderRules();
        refreshFormatButtons();
        schedulePreview();
        dispatchSettingsChanged();
    }

    el.scopeButtons.forEach(button => button.addEventListener("click", () => switchScope(button.dataset.replaceConfigScope)));

    el.previewCanvas.addEventListener("click", event => {
        if (!state.previewBase) return;
        const rect = el.previewCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(el.previewCanvas.width - 1, Math.floor((event.clientX - rect.left) * el.previewCanvas.width / rect.width)));
        const y = Math.max(0, Math.min(el.previewCanvas.height - 1, Math.floor((event.clientY - rect.top) * el.previewCanvas.height / rect.height)));
        const offset = (y * state.previewBase.width + x) * 4;
        const data = state.previewBase.data;
        el.sourceColor.value = rgbToHex(data[offset], data[offset + 1], data[offset + 2]);
        state.hasSelection = true;
        el.addRule.disabled = false;
        window.EasyFileUIControls?.refreshColorPicker?.(el.sourceColor.closest("[data-eft-color-picker]"));
        el.previewHint.textContent = `Selected ${el.sourceColor.value.toUpperCase()} • adjust the rule, then add it.`;
        schedulePreview();
    });

    el.previewFile.addEventListener("change", () => loadPreview(Number(el.previewFile.value) || 0));
    el.sourceColor.addEventListener("input", () => { state.hasSelection = true; el.addRule.disabled = false; schedulePreview(); });
    el.targetColor.addEventListener("input", schedulePreview);

    el.actionGroup.addEventListener("click", event => {
        const button = event.target.closest("[data-replace-action]");
        if (!button) return;
        state.action = button.dataset.replaceAction;
        el.actionGroup.querySelectorAll("[data-replace-action]").forEach(item => item.classList.toggle("active", item === button));
        el.targetWrap.classList.toggle("hidden", state.action !== "color");
        schedulePreview();
    });

    [el.tolerance, el.softness].forEach(input => input.addEventListener("input", () => {
        el.toleranceValue.textContent = `${el.tolerance.value}%`;
        el.softnessValue.textContent = `${el.softness.value}%`;
        schedulePreview();
    }));

    el.addRule.addEventListener("click", () => {
        const rule = candidateRule();
        if (!rule) return;
        const rules = currentRules();
        const existing = rules.findIndex(item => item.sourceColor === rule.sourceColor);
        if (existing >= 0) rules[existing] = rule;
        else rules.push(rule);
        state.hasSelection = false;
        el.addRule.disabled = true;
        el.previewHint.textContent = "Rule added. Click another color to create the next rule.";
        refreshFormatButtons();
        renderRules();
        schedulePreview();
        dispatchSettingsChanged();
    });

    el.clearRules.addEventListener("click", () => {
        const rules = currentRules();
        rules.splice(0, rules.length);
        state.hasSelection = false;
        el.addRule.disabled = true;
        refreshFormatButtons();
        renderRules();
        schedulePreview();
        dispatchSettingsChanged();
    });

    el.formatGroup.addEventListener("click", event => {
        const button = event.target.closest("[data-replace-format]");
        if (!button || button.disabled) return;
        state.outputFormat = button.dataset.replaceFormat;
        refreshFormatButtons();
        dispatchSettingsChanged();
    });

    el.quality.addEventListener("input", () => {
        state.quality = Number(el.quality.value) / 100;
        el.qualityValue.textContent = `${el.quality.value}%`;
        dispatchSettingsChanged();
    });

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "replace-colors") return;
        state.configurationMode = "all";
        state.globalRules = [];
        state.perFileRules.clear();
        Object.assign(state, {action:"transparent", outputFormat:"png", quality:0.92,
            hasSelection:false, previewIndex:0});
    });

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "replace-colors") return;
        setFiles(event.detail.files || []);
    });
    document.addEventListener("easyfiletools:files-cleared", () => setFiles([]));
    document.addEventListener("easyfiletools:operation-state-changed", event => {
        if (event.detail?.operationId && event.detail.operationId !== "replace-colors") return;
        if (["ready", "idle"].includes(event.detail?.status)) renderValidation();
    });

    renderScope();
    refreshFormatButtons();
    renderRules();
    window.EasyFileUIControls?.init?.(document);
    syncFiles();

    window.ReplaceColorsUI = Object.freeze({
        getSettings: () => validSettings() ? buildSettingsPayload() : null,
        getRules: () => cloneRules(currentRules())
    });
})();
