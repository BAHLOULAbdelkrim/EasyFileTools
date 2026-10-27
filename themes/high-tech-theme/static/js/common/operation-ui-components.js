console.log("[OPERATION UI] generic operation UI components loaded");

(() => {
    "use strict";

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function refreshRange(range) {
        if (!range) return;
        const min = Number(range.min || 0);
        const max = Number(range.max || 100);
        const value = Number(range.value || min);
        const progress = max > min ? clamp(((value - min) / (max - min)) * 100, 0, 100) : 0;
        range.style.setProperty("--eft-range-progress", `${progress}%`);
    }

    function normalizeHex(value, fallback = "#ffffff") {
        const raw = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback.toUpperCase();
    }

    function refreshColorPicker(wrapper) {
        if (!wrapper) return;
        const input = wrapper.querySelector('input[type="color"]');
        const code = wrapper.querySelector(".eft-color-code");
        if (!input) return;
        const value = normalizeHex(input.value);
        wrapper.style.setProperty("--eft-color", value);
        if (code) code.textContent = value;
        wrapper.classList.toggle("disabled", input.disabled);
    }

    function initColorPicker(wrapper) {
        if (!wrapper || wrapper.dataset.eftColorReady === "1") return;
        wrapper.dataset.eftColorReady = "1";
        const input = wrapper.querySelector('input[type="color"]');
        const reset = wrapper.querySelector("[data-eft-color-reset]");
        if (!input) return;

        const refresh = () => refreshColorPicker(wrapper);
        input.addEventListener("input", refresh);
        input.addEventListener("change", refresh);

        reset?.addEventListener("click", () => {
            if (input.disabled) return;
            const fallback = wrapper.dataset.defaultColor || input.defaultValue || "#ffffff";
            input.value = normalizeHex(fallback);
            refresh();
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        refresh();
    }



    function fileKey(file) {
        if (!file) return "";
        return [
            file.name || "",
            Number(file.size) || 0,
            Number(file.lastModified) || 0,
            file.type || ""
        ].join("::");
    }

    function applyReadinessState(detail = {}) {
        const zone = document.getElementById("operation-zone");
        const element = document.querySelector("[data-eft-readiness-status]");
        if (!zone || !element) return;

        const operationId = zone.dataset.operation || "";
        if (detail.operationId && detail.operationId !== operationId) return;

        const status = detail.status || "idle";
        element.classList.remove(
            "eft-readiness-processing",
            "eft-readiness-paused",
            "eft-readiness-completed",
            "eft-readiness-cancelled"
        );

        /*
         * READY / IDLE are rendered by the operation-specific UI because
         * their text depends on current files and settings. We only own
         * lifecycle states here so the same semantics can be reused by
         * every operation family.
         */
        if (status === "ready" || status === "idle") return;

        if (status === "running" || status === "cancelling") {
            element.classList.remove("valid", "error");
            element.classList.add("eft-readiness-processing");
            element.textContent = status === "cancelling"
                ? "Cancelling operation…"
                : "Processing…";
            return;
        }

        if (status === "paused") {
            element.classList.remove("valid", "error");
            element.classList.add("eft-readiness-paused");
            element.textContent = "Operation paused. Resume or cancel to continue.";
            return;
        }

        if (status === "completed") {
            element.classList.remove("valid", "error");
            element.classList.add("eft-readiness-completed");
            element.textContent = "Completed. The current result is up to date.";
            return;
        }

        if (status === "cancelled") {
            element.classList.remove("valid", "error");
            element.classList.add("eft-readiness-cancelled");
            element.textContent = "Operation cancelled. You can run it again with the current files and settings.";
            return;
        }

        if (status === "error") {
            element.classList.remove("valid");
            element.classList.add("error");
            element.textContent = detail.error?.message
                ? `Operation failed: ${detail.error.message}`
                : "Operation failed. Review the error and try again.";
        }
    }

    function init(root = document) {
        root.querySelectorAll?.(".eft-range").forEach(range => {
            if (range.dataset.eftRangeReady !== "1") {
                range.dataset.eftRangeReady = "1";
                range.addEventListener("input", () => refreshRange(range));
                range.addEventListener("change", () => refreshRange(range));
            }
            refreshRange(range);
        });

        root.querySelectorAll?.("[data-eft-color-picker]").forEach(initColorPicker);
    }

    document.addEventListener("DOMContentLoaded", () => init(document));
    document.addEventListener("easyfiletools:operation-files-updated", () => init(document));
    document.addEventListener("easyfiletools:operation-state-changed", event => applyReadinessState(event.detail || {}));

    window.EasyFileUIControls = Object.freeze({
        init,
        refreshRange,
        refreshColorPicker,
        fileKey,
        applyReadinessState
    });
})();
