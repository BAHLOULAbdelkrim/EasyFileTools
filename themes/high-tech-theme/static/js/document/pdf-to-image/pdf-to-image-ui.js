console.log("[PDF TO IMAGE UI] pdf-to-image-ui.js loaded");

(() => {
    "use strict";

    const root = document.getElementById("pdfToImageSettings");
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll("[data-pdf-image-format]"));
    const scale = document.getElementById("pdfToImageScale");
    const quality = document.getElementById("pdfToImageQuality");
    const qualityValue = document.getElementById("pdfToImageQualityValue");
    const validation = document.getElementById("pdfToImageValidation");

    const state = { files: [], format: "png" };

    function getSettings() {
        if (state.files.length === 0 || !state.format) return null;
        return {
            format: state.format,
            scale: Number(scale.value),
            quality: Number(quality.value) / 100
        };
    }

    function isLifecycleOwned() {
        const status = window.EasyFileOperationController?.getState?.().status;
        return status && !["idle", "ready"].includes(status);
    }

    function render() {
        buttons.forEach(button => {
            button.classList.toggle("active", button.dataset.pdfImageFormat === state.format);
        });

        qualityValue.textContent = `${quality.value}%`;
        quality.disabled = !state.format || state.format === "png";
        window.EasyFileUIControls?.refreshRange?.(quality);

        if (isLifecycleOwned()) {
            window.EasyFileUIControls?.applyReadinessState?.(
                window.EasyFileOperationController?.getState?.() || {}
            );
            return;
        }

        validation.textContent = state.files.length && state.format
            ? `Ready to convert ${state.files.length} ${state.files.length === 1 ? "PDF" : "PDFs"}.`
            : "Load one or more PDF files.";
        validation.classList.toggle("valid", Boolean(getSettings()));
        validation.classList.remove("error");
    }

    function dispatch() {
        const settings = getSettings();
        document.dispatchEvent(new CustomEvent("easyfiletools:pdf-image-settings-changed", {
            detail: { valid: Boolean(settings), settings }
        }));
    }

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            state.format = button.dataset.pdfImageFormat;
            dispatch();
            render();
        });
    });

    [scale, quality].forEach(element => {
        element.addEventListener("input", () => {
            dispatch();
            render();
        });
    });

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "pdf-to-image") return;
        state.format = null;
    });

    document.addEventListener("easyfiletools:operation-files-updated", event => {
        if (event.detail?.operation !== "pdf-to-image") return;
        state.files = event.detail.files || [];
        dispatch();
        render();
    });

    document.addEventListener("easyfiletools:operation-state-changed", event => {
        if (event.detail?.operationId !== "pdf-to-image") return;
        if (["idle", "ready"].includes(event.detail?.status)) render();
    });

    async function sync() {
        const data = await loadSelectedFiles();
        state.files = data?.files || [];
        dispatch();
        render();
    }

    window.PdfToImageUI = {
        getSettings,
        // Results are rendered only by the generic MULTI_OUTPUT file-list UI.
        clearResults() {},
        showResults() {}
    };

    render();
    sync();
})();
