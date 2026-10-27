console.log(
    "[VIDEO TO AUDIO UI] video-to-audio-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "videoToAudioSettings"
        );


    if (!root) {
        return;
    }


    const buttons =
        Array.from(
            root.querySelectorAll(
                "[data-audio-format]"
            )
        );


    const bitrate =
        document.getElementById(
            "videoAudioBitrate"
        );

    const sampleRate =
        document.getElementById(
            "videoAudioSampleRate"
        );

    const channels =
        document.getElementById(
            "videoAudioChannels"
        );

    const validation =
        document.getElementById(
            "videoToAudioValidation"
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

            bitrate:
                bitrate.value,

            sampleRate:
                sampleRate.value,

            channels:
                channels.value

        };

    }


    function render() {

        buttons.forEach(
            button => {

                button.disabled =
                    state.files.length ===
                    0;


                button.classList.toggle(
                    "active",
                    button.dataset
                        .audioFormat ===
                        state.format
                );

            }
        );


        const lossless =
            [
                "wav",
                "flac"
            ].includes(
                state.format
            );


        bitrate.disabled =
            lossless;


        /*
         * The current ffmpeg.wasm/libopus build used by EasyFile is
         * intentionally stabilized at 24 kHz (same rule as Audio).
         * Reflect that in the UI instead of showing a selectable value
         * that the engine would have to override silently.
         */
        if (state.format === "opus") {
            sampleRate.value = "24000";
            sampleRate.disabled = true;
        } else {
            sampleRate.disabled = false;
        }


        const settings =
            getSettings();


        validation.textContent =
            settings
                ? `Ready to extract audio as ${
                    state.format
                        .toUpperCase()
                }.`
                : state.files.length
                    ? "Choose an audio format."
                    : "Load one or more videos and choose an audio format.";


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
                "easyfiletools:video-audio-settings-changed",
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
                            .audioFormat;


                    render();

                    dispatch();

                }
            );

        }
    );


    [
        bitrate,
        sampleRate,
        channels
    ].forEach(
        control => {

            control.addEventListener(
                "change",
                dispatch
            );

        }
    );


    document.addEventListener("easyfiletools:operation-settings-reset", event => {
        if (event.detail?.operation !== "video-to-audio") return;
        state.format = null;
    });

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "video-to-audio"
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
            data?.files || [];


        render();

        dispatch();

    }


    window.VideoToAudioUI = {

        getSettings

    };


    render();

    sync();

})();