console.log("[SPLIT PDF UI] split-pdf-ui.js loaded");

(() => {
    "use strict";

    const root = document.getElementById("splitPdfSettings");
    if (!root) return;

    const el = {
        scopeButtons: Array.from(root.querySelectorAll("[data-split-config-scope]")),
        configFileRow: document.getElementById("splitPdfConfigFileRow"),
        configFile: document.getElementById("splitPdfConfigFile"),
        modeButtons: Array.from(root.querySelectorAll("[data-split-mode]")),
        pageCount: document.getElementById("splitPdfPageCount"),
        extractSettings: document.getElementById("splitPdfExtractSettings"),
        chunkSettings: document.getElementById("splitPdfChunkSettings"),
        pages: document.getElementById("splitPdfPages"),
        chunk: document.getElementById("splitPdfChunkSize"),
        validation: document.getElementById("splitPdfValidation")
    };

    const state = {
        files: [],
        pageCounts: [],
        inspecting: false,
        inspectionId: 0,
        inspectedSignature: "",
        configurationMode: "all",
        selectedIndex: 0,
        globalConfig: { mode: "extract", pagesText: "", chunkSize: 5 },
        perFileConfigs: new Map()
    };

    const fileOf = item => item?.file || item;
    const fileKey = file => file ? `${file.name}::${file.size}::${file.lastModified || 0}` : "";
    const clone = value => JSON.parse(JSON.stringify(value));

    function activeFile() {
        return fileOf(state.files[state.selectedIndex]);
    }

    function readControls() {
        const activeMode = el.modeButtons.find(button => button.classList.contains("active"))?.dataset.splitMode || "extract";
        return {
            mode: activeMode,
            pagesText: el.pages.value.trim(),
            chunkSize: Number(el.chunk.value)
        };
    }

    function applyConfig(config) {
        if (!config) return;
        el.modeButtons.forEach(button => button.classList.toggle("active", button.dataset.splitMode === config.mode));
        el.pages.value = config.pagesText ?? "";
        el.chunk.value = Number.isFinite(Number(config.chunkSize)) ? String(config.chunkSize) : "5";
    }

    function ensurePerFileConfigs() {
        const activeKeys = new Set();
        state.files.forEach((item, index) => {
            const file = fileOf(item);
            if (!file) return;
            const key = fileKey(file);
            activeKeys.add(key);
            if (!state.perFileConfigs.has(key)) {
                const count = state.pageCounts[index] || 0;
                const base = clone(state.globalConfig);
                if (base.mode === "extract" && !base.pagesText && count > 0) base.pagesText = `1-${count}`;
                state.perFileConfigs.set(key, base);
            }
        });
        for (const key of state.perFileConfigs.keys()) {
            if (!activeKeys.has(key)) state.perFileConfigs.delete(key);
        }
    }

    function saveActiveConfig() {
        const config = readControls();
        if (state.configurationMode === "per-file") {
            const file = activeFile();
            if (file) state.perFileConfigs.set(fileKey(file), clone(config));
        } else {
            state.globalConfig = clone(config);
        }
    }

    function configForIndex(index) {
        if (state.configurationMode !== "per-file") return clone(state.globalConfig);
        const file = fileOf(state.files[index]);
        return clone(state.perFileConfigs.get(fileKey(file)) || state.globalConfig);
    }

    function parsePages(text, maxPage) {
        if (!Number.isInteger(maxPage) || maxPage < 1) return null;
        const result = [];
        const seen = new Set();
        const tokens = String(text || "").split(",").map(token => token.trim()).filter(Boolean);
        if (!tokens.length) return null;

        for (const token of tokens) {
            if (token.includes("-")) {
                const parts = token.split("-").map(value => Number(value.trim()));
                if (parts.length !== 2 || !parts.every(Number.isInteger) || parts[0] < 1 || parts[0] > parts[1] || parts[1] > maxPage) return null;
                for (let page = parts[0]; page <= parts[1]; page++) {
                    if (!seen.has(page)) {
                        seen.add(page);
                        result.push(page - 1);
                    }
                }
            } else {
                const page = Number(token);
                if (!Number.isInteger(page) || page < 1 || page > maxPage) return null;
                if (!seen.has(page)) {
                    seen.add(page);
                    result.push(page - 1);
                }
            }
        }
        return result;
    }

    function normalizeConfig(config, maxPage) {
        if (!config) return null;
        if (config.mode === "extract") {
            const indexes = parsePages(config.pagesText, maxPage);
            return indexes?.length ? { mode: "extract", indexes } : null;
        }
        if (config.mode === "chunks") {
            const chunkSize = Number(config.chunkSize);
            return Number.isInteger(chunkSize) && chunkSize >= 1 && chunkSize <= 100
                ? { mode: "chunks", chunkSize }
                : null;
        }
        return config.mode === "pages" ? { mode: "pages" } : null;
    }

    function validationState() {
        if (!state.files.length) return { valid: false, message: "Load one or more PDF files.", settings: null };
        if (state.inspecting) return { valid: false, message: "Reading PDF page counts…", settings: null };
        if (state.pageCounts.length !== state.files.length || state.pageCounts.some(count => !Number.isInteger(count) || count < 1)) {
            return { valid: false, message: "Unable to read one or more PDFs.", settings: null };
        }

        saveActiveConfig();
        ensurePerFileConfigs();

        if (state.configurationMode === "per-file") {
            const perFileSettings = [];
            for (let index = 0; index < state.files.length; index++) {
                const config = configForIndex(index);
                const normalized = normalizeConfig(config, state.pageCounts[index]);
                if (!normalized) {
                    const file = fileOf(state.files[index]);
                    return {
                        valid: false,
                        message: `${file?.name || `PDF ${index + 1}`}: check the split settings. Pages must be between 1 and ${state.pageCounts[index]}.`,
                        settings: null
                    };
                }
                perFileSettings.push({ index, fileKey: fileKey(fileOf(state.files[index])), settings: normalized });
            }
            return {
                valid: true,
                message: `Ready to split ${state.files.length} ${state.files.length === 1 ? "PDF" : "PDFs"} with custom configuration.`,
                settings: { configurationMode: "per-file", perFileSettings }
            };
        }

        const minPageCount = Math.min(...state.pageCounts);
        const normalized = normalizeConfig(state.globalConfig, minPageCount);
        if (!normalized) {
            return {
                valid: false,
                message: state.globalConfig.mode === "extract"
                    ? `Check the page selection. With the same configuration, selected pages must exist in every PDF (maximum common page: ${minPageCount}).`
                    : "Check the split settings.",
                settings: null
            };
        }

        let message = `Ready to split ${state.files.length} ${state.files.length === 1 ? "PDF" : "PDFs"}.`;
        if (normalized.mode === "chunks" && state.pageCounts.some(count => normalized.chunkSize > count)) {
            message += ` A PDF shorter than ${normalized.chunkSize} pages will produce one output containing all its pages.`;
        }
        return {
            valid: true,
            message,
            settings: { configurationMode: "all", defaultSettings: normalized }
        };
    }

    function populateConfigFiles() {
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
            option.textContent = "Load a PDF first";
            el.configFile.appendChild(option);
        }
        state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, Math.max(0, state.files.length - 1)));
        el.configFile.value = state.files.length ? String(state.selectedIndex) : "";
        el.configFile.disabled = !state.files.length;
    }

    function renderDocumentInfo() {
        if (!state.files.length) {
            el.pageCount.textContent = "No PDF loaded";
            return;
        }
        if (state.inspecting) {
            el.pageCount.textContent = "Reading PDF page counts…";
            return;
        }
        if (state.configurationMode === "per-file") {
            const file = activeFile();
            const count = state.pageCounts[state.selectedIndex];
            el.pageCount.textContent = file && count ? `${file.name} • ${count} ${count === 1 ? "page" : "pages"}` : "Unable to read PDF";
            return;
        }
        const min = Math.min(...state.pageCounts);
        const max = Math.max(...state.pageCounts);
        el.pageCount.textContent = state.files.length === 1
            ? `${fileOf(state.files[0]).name} • ${state.pageCounts[0]} ${state.pageCounts[0] === 1 ? "page" : "pages"}`
            : `${state.files.length} PDFs • ${min === max ? `${min} pages each` : `${min}–${max} pages`}`;
    }

    function isLifecycleOwned() {
        const status = window.EasyFileOperationController?.getState?.().status;
        return status && !["idle", "ready"].includes(status);
    }

    function render() {
        el.scopeButtons.forEach(button => button.classList.toggle("active", button.dataset.splitConfigScope === state.configurationMode));
        el.configFileRow.classList.toggle("hidden", state.configurationMode !== "per-file");

        const mode = readControls().mode;
        el.extractSettings.style.display = mode === "extract" ? "" : "none";
        el.chunkSettings.style.display = mode === "chunks" ? "" : "none";
        renderDocumentInfo();

        if (isLifecycleOwned()) {
            window.EasyFileUIControls?.applyReadinessState?.(window.EasyFileOperationController?.getState?.() || {});
            return;
        }

        const validation = validationState();
        el.validation.textContent = validation.message;
        el.validation.classList.toggle("valid", validation.valid);
        el.validation.classList.toggle("error", !validation.valid && state.files.length > 0 && !state.inspecting);
    }

    function dispatch() {
        const validation = validationState();
        document.dispatchEvent(new CustomEvent("easyfiletools:split-pdf-settings-changed", {
            detail: { valid: validation.valid, settings: validation.settings }
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
            state.configurationMode = "per-file";
            ensurePerFileConfigs();
            populateConfigFiles();
            applyConfig(configForIndex(state.selectedIndex));
        } else {
            state.configurationMode = "all";
            applyConfig(state.globalConfig);
        }
        render();
        dispatch();
    }

    async function inspect() {
        const inspectionId = ++state.inspectionId;
        const filesSnapshot = state.files.slice();
        const signature = filesSnapshot
            .map(item => fileKey(fileOf(item)))
            .join("||");

        if (!filesSnapshot.length) {
            state.pageCounts = [];
            state.inspectedSignature = "";
            state.inspecting = false;
            render();
            dispatch();
            return;
        }

        /*
         * Split can receive the same file selection from several startup
         * paths (initialSync + operation-files-updated + storage refresh).
         * Never let concurrent PDF inspections append into the same shared
         * pageCounts array. Each run owns a local result and only the newest
         * still-relevant run may publish it.
         */
        state.inspecting = true;
        render();
        dispatch();

        const counts = [];
        let failed = false;

        try {
            for (const item of filesSnapshot) {
                const file = fileOf(item);
                if (!(file instanceof Blob)) throw new Error("Invalid PDF file object");
                const buffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(buffer, { updateMetadata: false });
                counts.push(pdf.getPageCount());
            }
        } catch (error) {
            failed = true;
            console.error("[SPLIT PDF UI] Unable to inspect PDF selection:", error);
        }

        /* A newer inspection started while this one was awaiting I/O. */
        if (inspectionId !== state.inspectionId) return;

        const currentSignature = state.files
            .map(item => fileKey(fileOf(item)))
            .join("||");

        /* The selection itself changed while this inspection was running. */
        if (currentSignature !== signature) return;

        state.inspecting = false;
        state.pageCounts = failed ? [] : counts;
        state.inspectedSignature = failed ? "" : signature;

        if (state.files.length && state.pageCounts.length === state.files.length) {
            const min = Math.min(...state.pageCounts);
            if (!state.globalConfig.pagesText) state.globalConfig.pagesText = `1-${min}`;
            ensurePerFileConfigs();
            if (state.configurationMode === "per-file") applyConfig(configForIndex(state.selectedIndex));
            else applyConfig(state.globalConfig);
        }
        render();
        dispatch();
    }

    el.scopeButtons.forEach(button => button.addEventListener("click", () => switchScope(button.dataset.splitConfigScope)));
    el.configFile.addEventListener("change", () => {
        saveActiveConfig();
        state.selectedIndex = Number(el.configFile.value) || 0;
        applyConfig(configForIndex(state.selectedIndex));
        render();
        dispatch();
    });
    el.modeButtons.forEach(button => button.addEventListener("click", () => {
        el.modeButtons.forEach(candidate => candidate.classList.toggle("active", candidate === button));
        changed();
    }));
    el.pages.addEventListener("input", changed);
    el.chunk.addEventListener("input", changed);

    function updateFiles(files) {
        saveActiveConfig();
        const nextFiles = Array.isArray(files) ? files : [];
        const nextSignature = nextFiles.map(item => fileKey(fileOf(item))).join("||");
        const currentSignature = state.files.map(item => fileKey(fileOf(item))).join("||");

        state.files = nextFiles;
        state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, Math.max(0, state.files.length - 1)));
        populateConfigFiles();

        /*
         * If another startup path announces the exact same selection after
         * it has already been successfully inspected, just re-render.
         */
        if (nextSignature && nextSignature === currentSignature && nextSignature === state.inspectedSignature && !state.inspecting) {
            render();
            dispatch();
            return;
        }

        void inspect();
    }

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "split-pdf") return;
        state.configurationMode = "all";
        state.selectedIndex = 0;
        state.globalConfig = {mode:"extract", pagesText:"", chunkSize:5};
        state.perFileConfigs.clear();
    });

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "split-pdf") return;
        updateFiles(event.detail.files || []);
    });
    document.addEventListener("easyfiletools:files-cleared", () => updateFiles([]));
    document.addEventListener("easyfiletools:operation-state-changed", event => {
        if (event.detail?.operationId !== "split-pdf") return;
        render();
    });

    window.SplitPdfUI = {
        getSettings() {
            const validation = validationState();
            return validation.valid ? validation.settings : null;
        },
        isValid() {
            return validationState().valid;
        },
        clearResults() {},
        showResults() {}
    };

    async function initialSync() {
        const data = typeof loadSelectedFiles === "function" ? await loadSelectedFiles() : null;
        state.files = Array.isArray(data?.files) ? data.files : [];
        populateConfigFiles();
        await inspect();
    }

    populateConfigFiles();
    render();
    dispatch();
    initialSync();
})();
