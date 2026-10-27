console.log(
    "[IMAGE COMPRESSION UI] image-compression-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "compressImageSettings"
        );


    if (!root) {
        return;
    }


    const elements = {

        presets:
            Array.from(
                root.querySelectorAll(
                    "[data-compression-quality]"
                )
            ),

        quality:
            document.getElementById(
                "compressImageQuality"
            ),

        qualitySection:
            document.getElementById("compressImageQualitySection"),

        qualityValue:
            document.getElementById(
                "compressImageQualityValue"
            ),

        keepSmaller:
            document.getElementById(
                "compressImageKeepSmaller"
            ),

        validation:
            document.getElementById(
                "compressImageValidation"
            ),

        summary:
            document.getElementById(
                "compressImageSummary"
            ),

        originalTotal:
            document.getElementById(
                "compressOriginalTotal"
            ),

        outputTotal:
            document.getElementById(
                "compressOutputTotal"
            ),

        savedTotal:
            document.getElementById(
                "compressSavedTotal"
            ),

        summaryToggle:
            document.getElementById("compressSummaryToggle"),

        summaryDetails:
            document.getElementById("compressSummaryDetails")

    };


    const state = {

        files:
            [],

        quality:
            0.78,

        keepSmaller:
            true,

        results:
            new Map(),

        detailsOpen:
            false,

        encoderSupport:
            new Map()

    };


    const SUPPORTED_FORMATS =
        new Set([
            "jpg",
            "jpeg",
            "png",
            "webp",
            "avif",
            "svg"
        ]);


    /* =========================================
       HELPERS
    ========================================= */

    function extractFile(
        item
    ) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function getExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        if (
            dot < 0 ||
            dot === filename.length - 1
        ) {

            return "";
        }


        return filename
            .slice(dot + 1)
            .toLowerCase();

    }


    function formatSize(
        bytes
    ) {

        if (
            typeof formatFileSize ===
            "function"
        ) {

            return formatFileSize(
                bytes
            );

        }


        if (bytes < 1024) {
            return `${bytes} B`;
        }


        if (bytes < 1024 * 1024) {

            return `${
                (
                    bytes /
                    1024
                ).toFixed(1)
            } KB`;

        }


        return `${
            (
                bytes /
                (
                    1024 *
                    1024
                )
            ).toFixed(2)
        } MB`;

    }


    /* =========================================
       ENCODER SUPPORT
    ========================================= */

    function testCanvasEncoder(
        mime
    ) {

        return new Promise(
            resolve => {

                const canvas =
                    document.createElement(
                        "canvas"
                    );


                canvas.width =
                    2;

                canvas.height =
                    2;


                const context =
                    canvas.getContext(
                        "2d"
                    );


                context.fillStyle =
                    "#ffffff";


                context.fillRect(
                    0,
                    0,
                    2,
                    2
                );


                canvas.toBlob(
                    blob => {

                        resolve(
                            Boolean(
                                blob &&
                                blob.type === mime
                            )
                        );

                    },

                    mime,

                    0.8
                );

            }
        );

    }


    async function detectSupport() {

        state.encoderSupport.set(
            "jpg",
            await testCanvasEncoder(
                "image/jpeg"
            )
        );


        state.encoderSupport.set(
            "jpeg",
            state.encoderSupport.get(
                "jpg"
            )
        );


        state.encoderSupport.set(
            "png",
            await testCanvasEncoder(
                "image/png"
            )
        );


        state.encoderSupport.set(
            "webp",
            await testCanvasEncoder(
                "image/webp"
            )
        );


        state.encoderSupport.set(
            "avif",
            await testCanvasEncoder(
                "image/avif"
            )
        );


        state.encoderSupport.set(
            "svg",
            true
        );


        updateUI();

        dispatchSettings();

    }


    /* =========================================
       VALIDATION
    ========================================= */

    function validate() {

        if (
            state.files.length === 0
        ) {

            return {

                valid:
                    false,

                message:
                    "Load one or more images."

            };

        }


        const unsupported =
            state.files
                .map(
                    extractFile
                )
                .filter(
                    Boolean
                )
                .filter(
                    file => {

                        const extension =
                            getExtension(
                                file.name
                            );


                        if (
                            !SUPPORTED_FORMATS.has(
                                extension
                            )
                        ) {

                            return true;
                        }


                        return (
                            state.encoderSupport.get(
                                extension
                            ) === false
                        );

                    }
                );


        if (
            unsupported.length > 0
        ) {

            return {

                valid:
                    false,

                message:
                    `Compression is not available for ${
                        unsupported
                            .map(
                                file =>
                                    file.name
                            )
                            .join(", ")
                    }.`

            };

        }


        return {

            valid:
                true,

            message:
                `Ready to compress ${
                    state.files.length
                } ${
                    state.files.length === 1
                        ? "image"
                        : "images"
                }.`

        };

    }


    /* =========================================
       SUMMARY
    ========================================= */

    function resetSummary() {

        state.results.clear();


        elements.summary?.classList.add("hidden");
        state.detailsOpen = false;
        elements.summaryDetails?.classList.add("hidden");
        elements.summaryToggle?.setAttribute("aria-expanded", "false");

    }


    function renderSummary() {

        if (
            state.results.size === 0
        ) {

            elements.summary
                ?.classList
                .add(
                    "hidden"
                );


            return;
        }


        const original = Array.from(state.results.values())
            .reduce((total, item) => total + Number((item.result || item).originalSize || 0), 0);

        const output = Array.from(state.results.values())
            .reduce((total, item) => total + Number((item.result || item).outputSize || 0), 0);


        const saved =
            Math.max(
                0,
                original - output
            );


        const percent =
            original > 0
                ? (
                    saved /
                    original
                ) *
                100
                : 0;


        elements.originalTotal.textContent =
            formatSize(
                original
            );


        elements.outputTotal.textContent =
            formatSize(
                output
            );


        elements.savedTotal.textContent =
            `${formatSize(saved)} (${percent.toFixed(1)}%)`;

        if (elements.summaryDetails) {
            elements.summaryDetails.innerHTML = Array.from(state.results.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([index, item]) => {
                    const result = item.result || item;
                    const name = item.fileName || `Image ${index + 1}`;
                    const originalSize = Number(result.originalSize || 0);
                    const outputSize = Number(result.outputSize || 0);
                    const savedBytes = Math.max(0, originalSize - outputSize);
                    const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;
                    const escapedName = String(name)
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;");
                    return `
                        <div class="compress-summary-detail-row">
                            <strong title="${escapedName}">${escapedName}</strong>
                            <span>Original <b>${formatSize(originalSize)}</b></span>
                            <span>Compressed <b>${formatSize(outputSize)}</b></span>
                            <span>Saved <b>${formatSize(savedBytes)} · ${savedPercent.toFixed(1)}%</b></span>
                        </div>`;
                })
                .join("");
        }

        elements.summary?.classList.remove("hidden");

    }


    /* =========================================
       RENDER
    ========================================= */

    function qualityApplies() {

        return state.files
            .map(extractFile)
            .filter(Boolean)
            .some(file => {
                const extension = getExtension(file.name);
                return extension === "jpg" || extension === "jpeg" || extension === "webp" || extension === "avif";
            });

    }


    function updatePresetButtons() {

        elements.presets.forEach(
            button => {

                const value =
                    Number(
                        button.dataset
                            .compressionQuality
                    );


                const enabled = qualityApplies();
                button.disabled = !enabled;
                button.classList.toggle(
                    "active",
                    enabled && Math.abs(
                        value -
                        state.quality
                    ) <
                    0.001
                );

            }
        );

    }


    function updateValidation() {

        const result =
            validate();


        elements.validation.textContent =
            result.message;


        elements.validation.classList.toggle(
            "valid",
            result.valid
        );


        elements.validation.classList.toggle(
            "error",
            !result.valid &&
            state.files.length > 0
        );

    }


    function updateUI() {

        elements.qualityValue.textContent =
            `${
                Math.round(
                    state.quality *
                    100
                )
            }%`;


        const qualityEnabled = qualityApplies();
        elements.quality.disabled = !qualityEnabled;
        elements.qualitySection?.classList.toggle("eft-setting-disabled", !qualityEnabled);
        updatePresetButtons();
        window.EasyFileUIControls?.refreshRange?.(elements.quality);

        updateValidation();

    }


    /* =========================================
       EVENTS
    ========================================= */

    function dispatchSettings() {

        const validation =
            validate();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:image-compression-settings-changed",
                {
                    detail: {

                        valid:
                            validation.valid,

                        settings:
                            validation.valid
                                ? {
                                    quality:
                                        state.quality,

                                    keepSmaller:
                                        state.keepSmaller
                                }
                                : null

                    }
                }
            )
        );

    }


    elements.presets.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.quality =
                        Number(
                            button.dataset
                                .compressionQuality
                        );


                    elements.quality.value =
                        Math.round(
                            state.quality *
                            100
                        );


                    resetSummary();

                    updateUI();

                    dispatchSettings();

                }
            );

        }
    );


    elements.quality.addEventListener(
        "input",
        () => {

            state.quality =
                Number(
                    elements.quality.value
                ) /
                100;


            resetSummary();

            updateUI();

            dispatchSettings();

        }
    );


    elements.keepSmaller.addEventListener(
        "change",
        () => {

            state.keepSmaller =
                elements.keepSmaller.checked;


            resetSummary();

            dispatchSettings();

        }
    );



    elements.summaryToggle?.addEventListener("click", () => {
        state.detailsOpen = !state.detailsOpen;
        elements.summaryDetails?.classList.toggle("hidden", !state.detailsOpen);
        elements.summaryToggle.setAttribute("aria-expanded", String(state.detailsOpen));
        elements.summaryToggle.classList.toggle("expanded", state.detailsOpen);
        const label = elements.summaryToggle.querySelector("span");
        if (label) label.textContent = state.detailsOpen ? "Hide details" : "Details";
    });

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "compress-image") return;
        state.quality = 0.78;
        state.keepSmaller = true;
        state.detailsOpen = false;
        state.results.clear();
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "compress-image"
            ) {

                return;
            }


            state.files =
                Array.isArray(
                    event.detail.files
                )
                    ? event.detail.files
                    : [];


            resetSummary();

            updateUI();

            dispatchSettings();

        }

    );


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            resetSummary();

            updateUI();

            dispatchSettings();

        }

    );


    /* =========================================
       STORAGE FALLBACK
    ========================================= */

    async function syncFilesFromStorage() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            return;
        }


        try {

            const data =
                await loadSelectedFiles();


            state.files =
                data &&
                Array.isArray(
                    data.files
                )
                    ? data.files
                    : [];


            updateUI();

            dispatchSettings();

        }
        catch (error) {

            console.error(
                "[IMAGE COMPRESSION UI] Storage sync failed:",
                error
            );

        }

    }


    /* =========================================
       PUBLIC
    ========================================= */

    window.ImageCompressionUI = {

        getSettings() {

            return validate().valid
                ? {
                    quality:
                        state.quality,

                    keepSmaller:
                        state.keepSmaller
                }
                : null;

        },


        isValid() {

            return validate().valid;

        },


        registerResult(
            index,
            result,
            file = null
        ) {

            state.results.set(
                index,
                {
                    result,
                    fileName: file?.name || null
                }
            );


            renderSummary();

        },


        resetSummary,

        refresh:
            updateUI

    };


    /* =========================================
       INIT
    ========================================= */

    updateUI();

    detectSupport();

    syncFilesFromStorage();

})();