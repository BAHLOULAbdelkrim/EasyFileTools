console.log(
    "[IMAGE TO PDF UI] image-to-pdf-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "imageToPdfSettings"
        );


    if (!root) {
        return;
    }


    const elements = {

        count:
            document.getElementById(
                "imageToPdfCount"
            ),

        pageSize:
            document.getElementById(
                "imageToPdfPageSize"
            ),

        orientation:
            document.getElementById(
                "imageToPdfOrientation"
            ),

        fitButtons:
            Array.from(
                root.querySelectorAll(
                    "[data-pdf-fit]"
                )
            ),

        marginPreset:
            document.getElementById(
                "imageToPdfMarginPreset"
            ),

        customMarginRow:
            document.getElementById(
                "imageToPdfCustomMarginRow"
            ),

        customMargin:
            document.getElementById(
                "imageToPdfCustomMargin"
            ),

        quality:
            document.getElementById(
                "imageToPdfQuality"
            ),

        qualityValue:
            document.getElementById(
                "imageToPdfQualityValue"
            ),

        lossless:
            document.getElementById(
                "imageToPdfLossless"
            ),

        maxResolution:
            document.getElementById(
                "imageToPdfMaxResolution"
            ),

        background:
            document.getElementById(
                "imageToPdfBackground"
            ),

        filename:
            document.getElementById(
                "imageToPdfFilename"
            ),

        validation:
            document.getElementById(
                "imageToPdfValidation"
            ),

        result:
            document.getElementById(
                "imageToPdfResult"
            ),

        resultName:
            document.getElementById(
                "imageToPdfResultName"
            ),

        resultMeta:
            document.getElementById(
                "imageToPdfResultMeta"
            )

    };


    const state = {

        files:
            [],

        pageSize:
            "a4",

        orientation:
            "auto",

        fit:
            "fit",

        margin:
            10,

        quality:
            0.90,

        lossless:
            false,

        maxResolution:
            2400,

        background:
            "#ffffff",

        filename:
            "images.pdf",

        currentResult:
            null

    };


    function normalizeFilename(
        value
    ) {

        let name =
            String(
                value || ""
            )
                .trim()
                .replace(
                    /[\\/:*?"<>|]+/g,
                    "_"
                );


        if (!name) {

            name =
                "images.pdf";

        }


        if (
            !name
                .toLowerCase()
                .endsWith(
                    ".pdf"
                )
        ) {

            name +=
                ".pdf";

        }


        return name;

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


        return `${
            (
                bytes /
                1024 /
                1024
            ).toFixed(2)
        } MB`;

    }


    function getMargin() {

        if (
            elements.marginPreset.value ===
            "custom"
        ) {

            return Math.max(
                0,
                Math.min(
                    50,
                    Number(
                        elements.customMargin
                            .value
                    ) || 0
                )
            );

        }


        return Number(
            elements.marginPreset.value
        );

    }


    function validate() {

        if (
            state.files.length ===
            0
        ) {

            return {

                valid:
                    false,

                message:
                    "Load one or more images."

            };

        }


        if (
            state.margin < 0 ||
            state.margin > 50
        ) {

            return {

                valid:
                    false,

                message:
                    "Margins must be between 0 and 50 mm."

            };

        }


        return {

            valid:
                true,

            message:
                `Ready to create a ${
                    state.files.length
                }-page PDF.`

        };

    }


    function getSettings() {

        const validation =
            validate();


        if (
            !validation.valid
        ) {

            return null;
        }


        return {

            pageSize:
                state.pageSize,

            orientation:
                state.orientation,

            fit:
                state.fit,

            margin:
                state.margin,

            quality:
                state.quality,

            lossless:
                state.lossless,

            maxResolution:
                state.maxResolution,

            background:
                state.background,

            filename:
                normalizeFilename(
                    state.filename
                )

        };

    }


    function dispatchSettings() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:image-pdf-settings-changed",
                {
                    detail: {

                        valid:
                            Boolean(
                                settings
                            ),

                        settings

                    }
                }
            )
        );

    }


    function updateUI() {

        state.pageSize =
            elements.pageSize.value;


        state.orientation =
            elements.orientation.value;


        state.margin =
            getMargin();


        state.quality =
            Number(
                elements.quality.value
            ) /
            100;


        state.lossless =
            Boolean(
                elements.lossless?.checked
            );


        state.maxResolution =
            Number(
                elements.maxResolution.value
            );


        state.background =
            elements.background.value;


        state.filename =
            elements.filename.value;


        elements.count.textContent =
            `${
                state.files.length
            } ${
                state.files.length === 1
                    ? "image"
                    : "images"
            }`;


        elements.qualityValue.textContent =
            state.lossless
                ? "Lossless"
                : `${
                    Math.round(
                        state.quality *
                        100
                    )
                }%`;


        elements.quality.disabled =
            state.lossless;
        window.EasyFileUIControls?.refreshRange?.(elements.quality);
        window.EasyFileUIControls?.refreshColorPicker?.(
            elements.background.closest("[data-eft-color-picker]")
        );


        const autoPage =
            state.pageSize ===
            "auto";


        elements.orientation.disabled =
            autoPage;


        elements.customMarginRow
            .classList.toggle(
                "hidden",
                elements.marginPreset
                    .value !==
                    "custom"
            );


        const validation =
            validate();


        elements.validation.textContent =
            validation.message;


        elements.validation.classList.toggle(
            "valid",
            validation.valid
        );


        elements.validation.classList.toggle(
            "error",
            !validation.valid &&
            state.files.length > 0
        );

    }


    function settingsChanged() {

        updateUI();

        dispatchSettings();

    }


    elements.fitButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.fit =
                        button.dataset
                            .pdfFit;


                    elements.fitButtons
                        .forEach(
                            other => {

                                other.classList.toggle(
                                    "active",
                                    other ===
                                    button
                                );

                            }
                        );


                    dispatchSettings();

                }
            );

        }
    );


    [
        elements.pageSize,
        elements.orientation,
        elements.marginPreset,
        elements.customMargin,
        elements.quality,
        elements.lossless,
        elements.maxResolution,
        elements.background,
        elements.filename
    ].forEach(
        element => {

            element.addEventListener(
                element.type ===
                    "range" ||
                element.type ===
                    "text" ||
                element.type ===
                    "color"
                    ? "input"
                    : "change",
                settingsChanged
            );

        }
    );


    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "image-to-pdf") return;
        Object.assign(state, {
            pageSize: "a4", orientation: "auto", fit: "fit", margin: 10,
            quality: 0.90, lossless: false, maxResolution: 2400,
            background: "#ffffff", filename: "images.pdf", currentResult: null
        });
    });

    document.addEventListener(
        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "image-to-pdf"
            ) {

                return;
            }


            state.files =
                event.detail.files || [];


            updateUI();

            dispatchSettings();

        }

    );


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            updateUI();

            dispatchSettings();

            window.ImageToPdfUI
                ?.clearResult?.();

        }

    );


    async function syncFiles() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            return;
        }


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


    window.ImageToPdfUI = {

        getSettings,

        isValid() {

            return validate().valid;

        },


        showResult(
            result
        ) {

            state.currentResult =
                result || null;


            elements.resultName.textContent =
                result.outputName;


            elements.resultMeta.textContent =
                `${
                    result.pageCount
                } ${
                    result.pageCount === 1
                        ? "page"
                        : "pages"
                } • ${
                    formatSize(
                        result.outputSize
                    )
                }`;


            elements.result.classList.remove(
                "hidden",
                "stale"
            );

        },


        setResultStale(
            stale
        ) {

            const result =
                state.currentResult;


            if (
                !result ||
                elements.result.classList.contains(
                    "hidden"
                )
            ) {

                return;
            }


            elements.result.classList.toggle(
                "stale",
                Boolean(stale)
            );


            const baseMeta =
                `${
                    result.pageCount
                } ${
                    result.pageCount === 1
                        ? "page"
                        : "pages"
                } • ${
                    formatSize(
                        result.outputSize
                    )
                }`;


            elements.resultMeta.textContent =
                stale
                    ? `Previous result • settings changed • ${baseMeta}`
                    : baseMeta;

        },


        clearResult() {

            state.currentResult =
                null;


            elements.result.classList.remove(
                "stale"
            );


            elements.result.classList.add(
                "hidden"
            );

        }

    };


    document.addEventListener(
        "easyfiletools:batch-result-stale-changed",
        event => {

            const detail =
                event.detail || {};


            if (
                detail.operation !==
                "image-to-pdf"
            ) {

                return;
            }


            window.ImageToPdfUI
                ?.setResultStale?.(
                    detail.stale === true
                );

        }
    );


    updateUI();

    syncFiles();

})();