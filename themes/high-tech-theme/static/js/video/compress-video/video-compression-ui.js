console.log(
    "[VIDEO COMPRESSION UI] video-compression-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "compressVideoSettings"
        );


    if (!root) {
        return;
    }


    const presets =
        Array.from(
            root.querySelectorAll(
                "[data-video-compression]"
            )
        );


    const container =
        document.getElementById(
            "compressVideoContainer"
        );


    const keepSmaller =
        document.getElementById(
            "compressVideoKeepSmaller"
        );


    const validation =
        document.getElementById(
            "compressVideoValidation"
        );


    const state = {

        files: [],

        preset:
            "balanced"

    };


    function getSettings() {

        if (
            state.files.length === 0 || !state.preset
        ) {

            return null;
        }


        return {

            preset:
                state.preset,

            container:
                container.value,

            keepSmaller:
                keepSmaller.checked

        };

    }


    function render() {

        presets.forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .videoCompression ===
                        state.preset
                );

            }
        );


        validation.textContent =
            state.files.length
                ? `Ready to compress ${
                    state.files.length
                } ${
                    state.files.length === 1
                        ? "video"
                        : "videos"
                }.`
                : "Load one or more videos.";


        if (state.files.length && state.preset === "speed") {
            validation.textContent += " Fast prioritizes processing speed, not the smallest output size.";
        }

        if (state.files.length && !state.preset) validation.textContent = "Choose a compression preset.";
        validation.classList.toggle(
            "valid",
            Boolean(getSettings())
        );

    }


    function dispatch() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:video-compression-settings-changed",
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


    presets.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.preset =
                        button.dataset
                            .videoCompression;


                    render();

                    dispatch();

                }
            );

        }
    );


    [
        container,
        keepSmaller
    ].forEach(
        element => {

            element.addEventListener(
                "change",
                dispatch
            );

        }
    );


    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "compress-video") return;
        state.preset = null;
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "compress-video"
            ) {

                return;
            }


            state.files =
                event.detail.files || [];


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


        render();

        dispatch();

    }


    window.VideoCompressionUI = {

        getSettings

    };


    render();

    sync();

})();