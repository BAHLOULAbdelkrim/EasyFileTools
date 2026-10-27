console.log(
    "[IMAGE CONVERSION UI] image-conversion-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "convertImageSettings"
        );


    if (
        !root
    ) {

        return;
    }


    const elements = {

        formats:
            Array.from(
                root.querySelectorAll(
                    "[data-image-format]"
                )
            ),

        qualitySection:
            document.getElementById(
                "imageQualitySection"
            ),

        qualitySlider:
            document.getElementById(
                "imageQualitySlider"
            ),

        qualityValue:
            document.getElementById(
                "imageQualityValue"
            ),

        backgroundSection:
            document.getElementById(
                "imageBackgroundSection"
            ),

        backgroundColor:
            document.getElementById(
                "imageBackgroundColor"
            ),

        backgroundValue:
            document.getElementById(
                "imageBackgroundValue"
            ),

        backgroundReset:
            root.querySelector("[data-eft-color-reset]"),

        validation:
            document.getElementById(
                "imageConversionValidation"
            )

    };


    const state = {

        files:
            [],

        selectedFormat:
            null,

        quality:
            0.90,

        backgroundColor:
            "#ffffff",

        encoderSupport:
            new Map()

    };


    /* =====================================================
       FORMAT HELPERS
    ===================================================== */

    function normalizeExtension(
        filename
    ) {

        const extension =
            filename
                .split(".")
                .pop()
                .toLowerCase();


        if (
            extension ===
            "jpeg"
        ) {

            return "jpg";
        }


        return extension;

    }


    function extractFile(
        item
    ) {

        if (
            item instanceof File
        ) {

            return item;
        }


        return (
            item?.file ||
            null
        );

    }


    function getUniformSourceFormat() {

        const formats =
            state.files
                .map(
                    extractFile
                )
                .filter(
                    Boolean
                )
                .map(
                    file =>
                        normalizeExtension(
                            file.name
                        )
                );


        if (
            formats.length === 0
        ) {

            return null;
        }


        const first =
            formats[0];


        return formats.every(
            format =>
                format === first
        )
            ? first
            : null;

    }


    /* =====================================================
       REAL ENCODER SUPPORT TEST
    ===================================================== */

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
                                blob.type ===
                                    mime
                            )
                        );

                    },
                    mime,
                    0.8
                );

            }
        );

    }


    async function detectEncoderSupport() {

        const tests = {

            png:
                "image/png",

            jpg:
                "image/jpeg",

            webp:
                "image/webp",

            avif:
                "image/avif"

        };


        for (
            const [
                format,
                mime
            ]
            of Object.entries(
                tests
            )
        ) {

            state.encoderSupport.set(
                format,
                await testCanvasEncoder(
                    mime
                )
            );

        }


        /*
         * BMP est encodé par EasyFile Tools,
         * indépendamment de canvas.toBlob().
         */

        state.encoderSupport.set(
            "bmp",
            true
        );


        refreshFormats();

    }


    /* =====================================================
       SELECTION
    ===================================================== */

    function selectFormat(
        format
    ) {

        const button =
            elements.formats.find(
                item =>
                    item.dataset
                        .imageFormat ===
                    format
            );


        if (
            !button ||
            button.disabled
        ) {

            return;
        }


        state.selectedFormat =
            format;


        updateUI();

        dispatchSettings();

    }


    /* =====================================================
       FORMAT BUTTONS
    ===================================================== */

    function refreshFormats() {

        const hasFiles =
            state.files.length > 0;


        const sourceFormat =
            getUniformSourceFormat();


        elements.formats
            .forEach(
                button => {

                    const format =
                        button.dataset
                            .imageFormat;


                    const supported =
                        state.encoderSupport
                            .get(
                                format
                            ) !== false;


                    const redundant =
                        sourceFormat &&
                        sourceFormat ===
                            format;


                    button.disabled =
                        !hasFiles ||
                        !supported ||
                        redundant;


                    button.classList.toggle(
                        "active",
                        state.selectedFormat ===
                            format &&
                        !button.disabled
                    );


                    if (
                        !supported
                    ) {

                        button.title =
                            `${format.toUpperCase()} encoding is not supported by this browser.`;

                    }
                    else if (
                        redundant
                    ) {

                        button.title =
                            "The loaded images are already in this format.";

                    }
                    else {

                        button.title =
                            "";

                    }

                }
            );


        const selectedButton =
            elements.formats.find(
                button =>
                    button.dataset
                        .imageFormat ===
                    state.selectedFormat
            );


        if (
            selectedButton?.disabled
        ) {

            state.selectedFormat =
                null;

        }

    }


    /* =====================================================
       QUALITY / BACKGROUND
    ===================================================== */

    function updateSettingsAvailability() {

        const lossy =
            [
                "jpg",
                "webp",
                "avif"
            ].includes(
                state.selectedFormat
            );


        elements.qualitySlider.disabled =
            !lossy;


        elements.qualitySection
            .classList.toggle(
                "disabled",
                !lossy
            );


        const needsBackground =
            [
                "jpg",
                "bmp"
            ].includes(
                state.selectedFormat
            );


        elements.backgroundColor.disabled =
            !needsBackground;

        if (elements.backgroundReset) {
            elements.backgroundReset.disabled = !needsBackground;
        }


        elements.backgroundSection
            .classList.toggle(
                "disabled",
                !needsBackground
            );

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

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
            !state.selectedFormat
        ) {

            return {

                valid:
                    false,

                message:
                    "Choose an output format."

            };

        }


        if (
            state.encoderSupport.get(
                state.selectedFormat
            ) === false
        ) {

            return {

                valid:
                    false,

                message:
                    "This output format is not supported by your browser."

            };

        }


        return {

            valid:
                true,

            message:
                `Ready to convert ${
                    state.files.length
                } ${
                    state.files.length ===
                    1
                        ? "image"
                        : "images"
                } to ${
                    state.selectedFormat
                        .toUpperCase()
                }.`

        };

    }


    /* =====================================================
       RENDER
    ===================================================== */

    function updateValidation() {

        const result =
            validate();


        elements.validation
            .textContent =
                result.message;


        elements.validation
            .classList.toggle(
                "valid",
                result.valid
            );


        elements.validation
            .classList.toggle(
                "error",
                !result.valid &&
                state.files.length > 0 &&
                state.selectedFormat !==
                    null
            );

    }


    function updateUI() {

        refreshFormats();

        updateSettingsAvailability();

        elements.qualityValue.textContent =
            `${Math.round(
                state.quality *
                100
            )}%`;


        elements.backgroundValue.textContent =
            state.backgroundColor
                .toUpperCase();

        window.EasyFileUIControls?.refreshRange?.(elements.qualitySlider);
        window.EasyFileUIControls?.refreshColorPicker?.(
            elements.backgroundColor.closest("[data-eft-color-picker]")
        );


        updateValidation();

    }


    /* =====================================================
       DISPATCH
    ===================================================== */

    function dispatchSettings() {

        const validation =
            validate();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:image-conversion-settings-selected",
                {
                    detail: {

                        valid:
                            validation.valid,

                        settings:
                            validation.valid
                                ? {
                                    format:
                                        state.selectedFormat,

                                    quality:
                                        state.quality,

                                    backgroundColor:
                                        state.backgroundColor
                                }
                                : null

                    }
                }
            )
        );

    }

    /* =========================================================
    SYNC FILES FROM STORAGE
    ========================================================= */

    async function syncFilesFromStorage() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            console.warn(
                "[IMAGE CONVERSION UI] loadSelectedFiles() unavailable"
            );

            return;
        }


        try {

            const data =
                await loadSelectedFiles();


            console.log(
                "[IMAGE CONVERSION UI] Storage data:",
                data
            );


            if (
                data &&
                Array.isArray(
                    data.files
                )
            ) {

                state.files =
                    data.files;

            }
            else if (
                Array.isArray(
                    data
                )
            ) {

                state.files =
                    data;

            }
            else {

                state.files =
                    [];

            }


            console.log(
                "[IMAGE CONVERSION UI] Files:",
                state.files.length
            );


            updateUI();

            dispatchSettings();

        }
        catch (error) {

            console.error(
                "[IMAGE CONVERSION UI] Storage sync failed:",
                error
            );

        }

    }    

    /* =====================================================
       EVENTS
    ===================================================== */

    elements.formats
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectFormat(
                            button.dataset
                                .imageFormat
                        );

                    }
                );

            }
        );


    elements.qualitySlider
        .addEventListener(
            "input",
            () => {

                state.quality =
                    Number(
                        elements
                            .qualitySlider
                            .value
                    ) /
                    100;


                updateUI();

                dispatchSettings();

            }
        );


    elements.backgroundColor
        .addEventListener(
            "input",
            () => {

                state.backgroundColor =
                    elements
                        .backgroundColor
                        .value;


                updateUI();

                dispatchSettings();

            }
        );


    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "convert-image") return;
        state.selectedFormat = null;
        state.quality = Number(elements.qualitySlider.defaultValue || 90) / 100;
        state.backgroundColor = elements.backgroundColor.defaultValue || "#ffffff";
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail
                    ?.operation !==
                "convert-image"
            ) {

                return;
            }


            state.files =
                Array.isArray(
                    event.detail.files
                )
                    ? event.detail.files
                    : [];


            updateUI();

            dispatchSettings();

        }

    );

    document.addEventListener(

        "easyfiletools:storage-updated",

        () => {

            syncFilesFromStorage();

        }

    );


    document.addEventListener(

        "easyfiletools:files-selected",

        () => {

            setTimeout(
                syncFilesFromStorage,
                0
            );

        }

    );

    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            state.selectedFormat =
                null;


            updateUI();

            dispatchSettings();

        }

    );


    /* =====================================================
       PUBLIC
    ===================================================== */

    window.ImageConversionUI = {

        getSettings() {

            return validate().valid
                ? {
                    format:
                        state.selectedFormat,

                    quality:
                        state.quality,

                    backgroundColor:
                        state.backgroundColor
                }
                : null;

        },


        isValid() {

            return validate().valid;

        },


        refresh:
            updateUI

    };


    /* =====================================================
       INIT
    ===================================================== */

    updateUI();

    detectEncoderSupport();

    syncFilesFromStorage();

})();