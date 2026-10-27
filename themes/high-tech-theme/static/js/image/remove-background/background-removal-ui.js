console.log(
    "[BACKGROUND UI] background-removal-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "removeBackgroundSettings"
        );


    if (!root) {
        return;
    }


    const SUPPORTED_INPUTS =
        new Set([
            "jpg",
            "jpeg",
            "png",
            "webp",
            "avif"
        ]);


    const elements = {

        modelStatus:
            document.getElementById(
                "backgroundAiStatus"
            ),

        modeButtons:
            Array.from(
                root.querySelectorAll(
                    "[data-background-mode]"
                )
            ),

        colorSettings:
            document.getElementById(
                "backgroundColorSettings"
            ),

        color:
            document.getElementById(
                "backgroundReplacementColor"
            ),

        colorValue:
            document.getElementById(
                "backgroundReplacementColorValue"
            ),

        imageSettings:
            document.getElementById(
                "backgroundImageSettings"
            ),

        backgroundImage:
            document.getElementById(
                "backgroundReplacementImage"
            ),

        backgroundImageName:
            document.getElementById(
                "backgroundReplacementImageName"
            ),

        edge:
            document.getElementById(
                "backgroundEdgeSoftness"
            ),

        edgeValue:
            document.getElementById(
                "backgroundEdgeValue"
            ),

        formatButtons:
            Array.from(
                root.querySelectorAll(
                    "[data-background-format]"
                )
            ),

        qualitySection:
            document.getElementById(
                "backgroundQualitySection"
            ),

        quality:
            document.getElementById(
                "backgroundOutputQuality"
            ),

        qualityValue:
            document.getElementById(
                "backgroundQualityValue"
            ),

        validation:
            document.getElementById(
                "backgroundRemovalValidation"
            ),

        preview:
            document.getElementById(
                "backgroundPreview"
            ),

        previewFile:
            document.getElementById(
                "backgroundPreviewFile"
            ),

        previewHint:
            document.getElementById(
                "backgroundPreviewHint"
            ),

        previewOriginal:
            document.getElementById(
                "backgroundPreviewOriginal"
            ),

        previewResult:
            document.getElementById(
                "backgroundPreviewResult"
            )

    };


    const state = {

        files:
            [],

        backgroundMode:
            "transparent",

        backgroundColor:
            "#ffffff",

        backgroundFile:
            null,

        backgroundFileUrl:
            null,

        edgeSoftness:
            1,

        outputFormat:
            "webp",

        quality:
            0.92,

        previewEntries:
            [],

        activePreviewIndex:
            null

    };


    function getExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        return dot >= 0
            ? filename
                .slice(
                    dot + 1
                )
                .toLowerCase()
            : "";

    }


    function extractFile(
        item
    ) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function validate() {

        if (
            state.files.length === 0
        ) {

            return {
                valid: false,
                message:
                    "Load one or more images."
            };

        }


        const unsupported =
            state.files
                .map(
                    extractFile
                )
                .filter(Boolean)
                .filter(
                    file =>
                        !SUPPORTED_INPUTS.has(
                            getExtension(
                                file.name
                            )
                        )
                );


        if (
            unsupported.length > 0
        ) {

            return {
                valid: false,

                message:
                    "Remove Background currently supports JPG, PNG, WebP and AVIF images."
            };

        }


        if (
            state.backgroundMode ===
                "image" &&
            !state.backgroundFile
        ) {

            return {
                valid: false,

                message:
                    "Choose a replacement background image."
            };

        }


        return {
            valid: true,

            message:
                `Ready to process ${
                    state.files.length
                } ${
                    state.files.length === 1
                        ? "image"
                        : "images"
                }.`
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

            backgroundMode:
                state.backgroundMode,

            backgroundColor:
                state.backgroundColor,

            backgroundFile:
                state.backgroundFile,

            edgeSoftness:
                state.edgeSoftness,

            outputFormat:
                state.outputFormat,

            quality:
                state.quality

        };

    }


    function updateFormats() {

        const jpgButton =
            elements.formatButtons.find(
                button =>
                    button.dataset
                        .backgroundFormat ===
                    "jpg"
            );


        if (
            jpgButton
        ) {

            jpgButton.disabled =
                state.backgroundMode ===
                "transparent";


            if (
                jpgButton.disabled &&
                state.outputFormat ===
                    "jpg"
            ) {

                state.outputFormat =
                    "png";

            }

        }


        elements.formatButtons.forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .backgroundFormat ===
                        state.outputFormat
                );

            }
        );


        const qualityEnabled =
            state.outputFormat ===
                "jpg" ||
            state.outputFormat ===
                "webp";


        elements.quality.disabled =
            !qualityEnabled;


        elements.qualitySection
            .classList.toggle(
                "disabled",
                !qualityEnabled
            );

    }


    function updateUI() {

        elements.modeButtons.forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .backgroundMode ===
                        state.backgroundMode
                );

            }
        );


        elements.colorSettings
            .classList.toggle(
                "hidden",
                state.backgroundMode !==
                    "color"
            );


        elements.imageSettings
            .classList.toggle(
                "hidden",
                state.backgroundMode !==
                    "image"
            );


        elements.colorValue.textContent =
            state.backgroundColor
                .toUpperCase();


        elements.edgeValue.textContent =
            `${
                state.edgeSoftness
            } px`;


        elements.qualityValue.textContent =
            `${
                Math.round(
                    state.quality *
                    100
                )
            }%`;


        updateFormats();
        window.EasyFileUIControls?.refreshRange?.(elements.edge);
        window.EasyFileUIControls?.refreshRange?.(elements.quality);
        window.EasyFileUIControls?.refreshColorPicker?.(
            elements.color.closest("[data-eft-color-picker]")
        );


        const validation =
            validate();


        elements.validation.textContent =
            validation.message;


        elements.validation
            .classList.toggle(
                "valid",
                validation.valid
            );


        elements.validation
            .classList.toggle(
                "error",
                !validation.valid &&
                state.files.length > 0
            );

    }


    function dispatchSettings() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:background-settings-changed",
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


    function changed() {

        updateUI();

        dispatchSettings();

    }


    elements.modeButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.backgroundMode =
                        button.dataset
                            .backgroundMode;


                    changed();

                }
            );

        }
    );


    elements.formatButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    if (
                        button.disabled
                    ) {

                        return;
                    }


                    state.outputFormat =
                        button.dataset
                            .backgroundFormat;


                    changed();

                }
            );

        }
    );


    elements.color.addEventListener(
        "input",
        () => {

            state.backgroundColor =
                elements.color.value;


            changed();

        }
    );


    elements.edge.addEventListener(
        "input",
        () => {

            state.edgeSoftness =
                Number(
                    elements.edge.value
                );


            changed();

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


            changed();

        }
    );


    elements.backgroundImage
        .addEventListener(
            "change",
            () => {

                const file =
                    elements
                        .backgroundImage
                        .files?.[0] ||
                    null;


                if (
                    state.backgroundFileUrl
                ) {

                    URL.revokeObjectURL(
                        state.backgroundFileUrl
                    );

                }


                state.backgroundFile =
                    file;


                state.backgroundFileUrl =
                    file
                        ? URL.createObjectURL(
                            file
                        )
                        : null;


                elements.backgroundImageName
                    .textContent =
                        file
                            ? file.name
                            : "No background image selected";


                changed();

            }
        );


    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                    "remove-background"
            ) {

                return;
            }


            state.files =
                event.detail.files || [];


            changed();

        }

    );


    document.addEventListener(

        "easyfiletools:background-ai-status",

        event => {

            const {
                status,
                label
            } =
                event.detail;


            elements.modelStatus.className =
                `background-ai-status ${
                    status
                }`;


            elements.modelStatus.textContent =
                label;

        }

    );


    async function syncFiles() {

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


            changed();

        }
        catch (error) {

            console.error(
                "[BACKGROUND UI] Storage sync:",
                error
            );

        }

    }


    function renderPreviewEntry(index) {

        const entry =
            state.previewEntries.find(
                item => item.index === index
            );

        if (!entry) {
            return;
        }

        state.activePreviewIndex =
            entry.index;

        elements.previewOriginal.src =
            entry.originalUrl;

        elements.previewResult.src =
            entry.resultUrl;

        if (elements.previewFile) {
            elements.previewFile.value =
                String(entry.index);
        }

        if (elements.previewHint) {
            elements.previewHint.textContent =
                `Preview: ${entry.file.name}`;
        }

    }


    function refreshPreviewSelector() {

        if (!elements.previewFile) {
            return;
        }

        elements.previewFile.innerHTML =
            "";

        state.previewEntries
            .slice()
            .sort((a, b) => a.index - b.index)
            .forEach(entry => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    String(entry.index);

                option.textContent =
                    entry.file.name;

                elements.previewFile.appendChild(
                    option
                );

            });

        elements.previewFile.disabled =
            state.previewEntries.length === 0;

    }


    function clearPreview() {

        state.previewEntries.forEach(
            entry => {

                if (entry.originalUrl) {
                    URL.revokeObjectURL(
                        entry.originalUrl
                    );
                }

            }
        );

        state.previewEntries =
            [];

        state.activePreviewIndex =
            null;

        elements.preview
            .classList
            .add(
                "hidden"
            );

        elements.previewOriginal
            .removeAttribute(
                "src"
            );

        elements.previewResult
            .removeAttribute(
                "src"
            );

        refreshPreviewSelector();

        if (elements.previewHint) {
            elements.previewHint.textContent =
                "The preview appears after processing.";
        }

    }


    elements.previewFile?.addEventListener(
        "change",
        () => {

            renderPreviewEntry(
                Number(
                    elements.previewFile.value
                )
            );

        }
    );


    window.BackgroundRemovalUI = {

        getSettings,

        isValid() {

            return validate().valid;

        },


        showPreview(
            originalFile,
            resultUrl,
            index = null
        ) {

            const resolvedIndex =
                Number.isInteger(index)
                    ? index
                    : state.previewEntries.length;

            const existing =
                state.previewEntries.find(
                    entry => entry.index === resolvedIndex
                );

            if (existing?.originalUrl) {
                URL.revokeObjectURL(
                    existing.originalUrl
                );
            }

            const entry = {
                index: resolvedIndex,
                file: originalFile,
                originalUrl:
                    URL.createObjectURL(
                        originalFile
                    ),
                resultUrl
            };

            state.previewEntries =
                state.previewEntries
                    .filter(
                        item => item.index !== resolvedIndex
                    );

            state.previewEntries.push(
                entry
            );

            refreshPreviewSelector();
            renderPreviewEntry(
                resolvedIndex
            );

            elements.preview
                .classList
                .remove(
                    "hidden"
                );

            elements.preview.open =
                true;

        },


        clearPreview

    };


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            clearPreview();

            changed();

        }

    );


    updateUI();

    syncFiles();

})();