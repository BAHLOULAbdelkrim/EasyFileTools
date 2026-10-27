console.log(
    "[VIDEO CONVERSION UI] video-conversion-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "convertVideoSettings"
        );


    if (!root) {
        return;
    }


    const buttons =
        Array.from(
            root.querySelectorAll(
                "[data-video-format]"
            )
        );


    const resolution =
        document.getElementById(
            "convertVideoResolution"
        );

    const quality =
        document.getElementById(
            "convertVideoQuality"
        );

    const keepAudio =
        document.getElementById(
            "convertVideoKeepAudio"
        );

    const fastCopy =
        document.getElementById("convertVideoFastCopy");

    const validation =
        document.getElementById(
            "convertVideoValidation"
        );


    const state = {

        files: [],

        format: null

    };


    function getSettings() {

        if (
            state.files.length === 0 ||
            !state.format
        ) {

            return null;
        }


        return {

            format:
                state.format,

            resolution:
                resolution.value,

            quality:
                quality.value,

            keepAudio:
                keepAudio.checked,

            fastCopy:
                fastCopy?.checked !== false

        };

    }


    function render() {

        // Copy is independent of output quality. If resizing is requested,
        // the engine automatically re-encodes (copy is not compatible).

        buttons.forEach(
            button => {

                button.disabled =
                    state.files.length ===
                    0;


                button.classList.toggle(
                    "active",
                    button.dataset
                        .videoFormat ===
                        state.format
                );

            }
        );


        const settings =
            getSettings();


        validation.textContent =
            settings
                ? `Ready to convert ${
                    state.files.length
                } ${
                    state.files.length === 1
                        ? "video"
                        : "videos"
                } to ${
                    state.format
                        .toUpperCase()
                }.`
                : state.files.length
                    ? "Choose an output format."
                    : "Load one or more videos and choose an output format.";


        if (settings && settings.format === "webm") {
            validation.textContent += " WebCodecs is preferred when supported; FFmpeg is the fallback.";
        }

        validation.classList.toggle(
            "valid",
            Boolean(settings)
        );

    }


    function dispatch() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:video-conversion-settings-changed",
                {
                    detail: {

                        valid:
                            Boolean(settings),

                        settings

                    }
                }
            )
        );

    }


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    if (
                        button.disabled
                    ) {

                        return;
                    }


                    state.format =
                        button.dataset
                            .videoFormat;


                    render();

                    dispatch();

                }
            );

        }
    );


    [
        resolution,
        quality,
        keepAudio,
        fastCopy
    ].filter(Boolean).forEach(
        control => {

            control.addEventListener(
                "change",
                () => {

                    render();

                    dispatch();

                }
            );

        }
    );


    function clearSelections() {
        state.format = null;
        resolution.value = "original";
        quality.value = "medium";
        keepAudio.checked = true;
        if (fastCopy) fastCopy.checked = true;
    }

    document.addEventListener("easyfiletools:files-cleared", () => {
        state.files = [];
        clearSelections();
        render();
        dispatch();
    });

    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "convert-video") return;
        clearSelections();
        render();
        dispatch();
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "convert-video"
            ) {

                return;
            }


            state.files =
                event.detail.files || [];

            // Clear All and deleting the very last file must behave identically.
            if (state.files.length === 0) clearSelections();

            render();

            dispatch();

        }

    );


    async function sync() {

        const data =
            await loadSelectedFiles();


        state.files =
            data &&
            Array.isArray(data.files)
                ? data.files
                : [];

        if (state.files.length === 0) clearSelections();

        render();

        dispatch();

    }


    window.VideoConversionUI = {

        getSettings,

        isValid() {
            return Boolean(
                getSettings()
            );
        }

    };


    render();

    sync();

})();