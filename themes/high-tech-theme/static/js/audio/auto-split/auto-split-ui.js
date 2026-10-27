console.log(
    "[AUTO SPLIT UI] auto-split-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "autoSplitSettings"
        );


    if (!root) {
        return;
    }


    const threshold =
        document.getElementById(
            "autoSplitThreshold"
        );

    const thresholdValue =
        document.getElementById(
            "autoSplitThresholdValue"
        );

    const minSilence =
        document.getElementById(
            "autoSplitMinSilence"
        );

    const minSegment =
        document.getElementById(
            "autoSplitMinSegment"
        );

    const outputFormat =
        document.getElementById(
            "autoSplitOutputFormat"
        );

    const validation =
        document.getElementById(
            "autoSplitValidation"
        );


    const state = {

        files: []

    };

    /* =========================================
    THRESHOLD SLIDER PROGRESS
    ========================================= */

    function updateThresholdProgress() {

        const min =
            Number(
                threshold.min
            );

        const max =
            Number(
                threshold.max
            );

        const value =
            Number(
                threshold.value
            );


        if (
            !Number.isFinite(min) ||
            !Number.isFinite(max) ||
            !Number.isFinite(value) ||
            max === min
        ) {

            return;

        }


        /*
        * Visual direction is reversed:
        *
        * -20 dB  -> 0%
        * -60 dB  -> 100%
        */

        const progress =
            Math.max(
                0,
                Math.min(
                    100,

                    (
                        (max - value) /
                        (max - min)
                    ) *
                    100
                )
            );


        threshold.style.setProperty(
            "--threshold-progress",
            `${progress}%`
        );

    }    

    /* =========================================
       SETTINGS
    ========================================= */

    function getSettings() {

        if (
            state.files.length === 0
        ) {

            return null;
        }


        const silence =
            Number(
                minSilence.value
            );


        const segment =
            Number(
                minSegment.value
            );


        if (
            !Number.isFinite(
                silence
            ) ||
            silence < 0.2 ||
            silence > 5
        ) {

            return null;
        }


        if (
            !Number.isFinite(
                segment
            ) ||
            segment < 1 ||
            segment > 60
        ) {

            return null;
        }


        return {

            thresholdDb:
                Number(
                    threshold.value
                ),

            minSilence:
                silence,

            minSegment:
                segment,

            outputFormat:
                outputFormat.value

        };

    }


    /* =========================================
       VALIDATION
    ========================================= */

    function renderValidation() {

        thresholdValue.textContent =
            `${threshold.value} dB`;


        const settings =
            getSettings();


        if (
            state.files.length === 0
        ) {

            validation.textContent =
                "Load one or more audio files.";


            validation.classList.remove(
                "valid"
            );


            return;

        }


        if (!settings) {

            validation.textContent =
                "Check the split settings.";


            validation.classList.remove(
                "valid"
            );


            return;

        }


        validation.textContent =
            `Ready to analyse ${
                state.files.length
            } ${
                state.files.length === 1
                    ? "audio file"
                    : "audio files"
            }.`;


        validation.classList.add(
            "valid"
        );

    }


    /* =========================================
       SETTINGS EVENT
    ========================================= */

    function dispatchSettings() {

        const settings =
            getSettings();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:auto-split-settings-changed",
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

        updateThresholdProgress();

        renderValidation();

        dispatchSettings();

    }


    [
        threshold,
        minSilence,
        minSegment,
        outputFormat
    ].forEach(
        element => {

            element.addEventListener(
                element.type ===
                    "range"
                    ? "input"
                    : "change",
                changed
            );

        }
    );


    /* =========================================
       FILES
    ========================================= */

    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                    "auto-split"
            ) {

                return;

            }


            state.files =
                Array.isArray(
                    event.detail.files
                )
                    ? event.detail.files
                    : [];


            changed();

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


        changed();

    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.AutoSplitUI = {

        getSettings,

        isValid() {

            return Boolean(
                getSettings()
            );

        }

    };


    /* =========================================
       CLEAR
    ========================================= */

    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.files =
                [];


            changed();

        }

    );


    /* =========================================
       INITIALIZATION
    ========================================= */

    updateThresholdProgress();

    renderValidation();

    syncFiles();

})();