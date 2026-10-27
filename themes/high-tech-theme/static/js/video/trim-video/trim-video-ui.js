console.log(
    "[TRIM VIDEO UI] trim-video-ui.js loaded"
);


(() => {

    "use strict";


    const root =
        document.getElementById(
            "trimVideoSettings"
        );


    if (!root) {
        return;
    }


    const elements = {

        fileSelector:
            document.getElementById(
                "trimVideoFileSelector"
            ),

        video:
            document.getElementById(
                "trimVideoPreview"
            ),

        play:
            document.getElementById(
                "trimVideoPlayBtn"
            ),

        playSelection:
            document.getElementById(
                "trimVideoPlaySelectionBtn"
            ),

        stop:
            document.getElementById(
                "trimVideoStopBtn"
            ),

        currentTime:
            document.getElementById(
                "trimVideoCurrentTime"
            ),

        scrubber:
            document.getElementById(
                "trimVideoScrubber"
            ),

        start:
            document.getElementById(
                "trimVideoStart"
            ),

        end:
            document.getElementById(
                "trimVideoEnd"
            ),

        startRange:
            document.getElementById(
                "trimVideoStartRange"
            ),

        endRange:
            document.getElementById(
                "trimVideoEndRange"
            ),

        setStart:
            document.getElementById(
                "trimVideoSetStartBtn"
            ),

        setEnd:
            document.getElementById(
                "trimVideoSetEndBtn"
            ),

        selectedDuration:
            document.getElementById(
                "trimVideoSelectedDuration"
            ),

        precisionButtons:
            Array.from(
                root.querySelectorAll(
                    "[data-trim-precision]"
                )
            ),

        outputFormat:
            document.getElementById(
                "trimVideoOutputFormat"
            ),

        quality:
            document.getElementById(
                "trimVideoQuality"
            ),

        keepAudio:
            document.getElementById(
                "trimVideoKeepAudio"
            ),

        modeInfo:
            document.getElementById(
                "trimVideoModeInfo"
            ),

        validation:
            document.getElementById(
                "trimVideoValidation"
            )

    };


    const state = {

        records:
            [],

        activeIndex:
            0,

        previewUrl:
            null,

        selectionPlaying:
            false

    };


    /* =========================================
       HELPERS
    ========================================= */

    function extractFile(item) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function keyOf(file) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    function formatTime(seconds) {

        if (
            !Number.isFinite(seconds)
        ) {

            seconds = 0;
        }


        seconds =
            Math.max(
                0,
                seconds
            );


        const hours =
            Math.floor(
                seconds /
                3600
            );


        const minutes =
            Math.floor(
                (
                    seconds %
                    3600
                ) /
                60
            );


        const secs =
            seconds %
            60;


        return (
            String(hours)
                .padStart(
                    2,
                    "0"
                ) +
            ":" +
            String(minutes)
                .padStart(
                    2,
                    "0"
                ) +
            ":" +
            secs
                .toFixed(3)
                .padStart(
                    6,
                    "0"
                )
        );

    }


    function parseTime(value) {

        const text =
            String(
                value || ""
            ).trim();


        if (!text) {
            return NaN;
        }


        if (
            !text.includes(":")
        ) {

            return Number(
                text
            );

        }


        const parts =
            text
                .split(":")
                .map(Number);


        if (
            parts.some(
                part =>
                    !Number.isFinite(part)
            )
        ) {

            return NaN;
        }


        if (
            parts.length === 3
        ) {

            return (
                parts[0] *
                3600 +
                parts[1] *
                60 +
                parts[2]
            );

        }


        if (
            parts.length === 2
        ) {

            return (
                parts[0] *
                60 +
                parts[1]
            );

        }


        return NaN;

    }


    function getActive() {

        return (
            state.records[
                state.activeIndex
            ] ||
            null
        );

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            max,
            Math.max(
                min,
                value
            )
        );

    }


    function secondsFromRange(
        value,
        duration
    ) {

        if (
            !duration
        ) {

            return 0;
        }


        return (
            Number(value) /
            1000
        ) *
        duration;

    }


    function rangeFromSeconds(
        seconds,
        duration
    ) {

        if (
            !duration
        ) {

            return 0;
        }


        return Math.round(
            (
                seconds /
                duration
            ) *
            1000
        );

    }


    /* =========================================
       RECORDS
    ========================================= */

    function createRecord(file) {

        return {

            key:
                keyOf(file),

            file,

            duration:
                null,

            start:
                0,

            end:
                null,

            precision:
                "accurate",

            outputFormat:
                "same",

            quality:
                "high",

            keepAudio:
                true

        };

    }


    function preserveRecords(files) {

        const oldRecords =
            new Map(
                state.records.map(
                    record => [
                        record.key,
                        record
                    ]
                )
            );


        state.records =
            files
                .map(
                    extractFile
                )
                .filter(Boolean)
                .map(
                    file => {

                        const key =
                            keyOf(file);


                        return (
                            oldRecords.get(key) ||
                            createRecord(file)
                        );

                    }
                );


        if (
            state.activeIndex >=
            state.records.length
        ) {

            state.activeIndex =
                Math.max(
                    0,
                    state.records.length - 1
                );

        }

    }


    /* =========================================
       FILE SELECTOR
    ========================================= */

    function renderFileSelector() {

        elements.fileSelector
            .innerHTML =
                "";


        state.records.forEach(
            (
                record,
                index
            ) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(index);


                option.textContent =
                    record.file.name;


                elements.fileSelector
                    .appendChild(
                        option
                    );

            }
        );


        elements.fileSelector.value =
            String(
                state.activeIndex
            );


        elements.fileSelector.disabled =
            state.records.length ===
            0;

    }


    /* =========================================
       VIDEO PREVIEW
    ========================================= */

    function revokePreview() {

        if (
            state.previewUrl
        ) {

            URL.revokeObjectURL(
                state.previewUrl
            );


            state.previewUrl =
                null;

        }

    }


    function loadActivePreview() {

        state.selectionPlaying =
            false;


        elements.video.pause();


        elements.scrubber.value = "0";
        elements.currentTime.textContent = "00:00:00.000";
        window.EasyFileUIControls?.refreshRange?.(elements.scrubber);


        revokePreview();


        const record =
            getActive();


        if (!record) {

            elements.video
                .removeAttribute(
                    "src"
                );


            elements.video.load();

            renderActive();

            return;
        }


        state.previewUrl =
            URL.createObjectURL(
                record.file
            );


        elements.video.src =
            state.previewUrl;


        elements.video.load();


        elements.video.onloadedmetadata =
            () => {

                record.duration =
                    Number.isFinite(
                        elements.video.duration
                    )
                        ? elements.video.duration
                        : 0;


                if (
                    record.end ===
                    null ||
                    record.end >
                    record.duration
                ) {

                    record.end =
                        record.duration;

                }


                record.start =
                    clamp(
                        record.start,
                        0,
                        record.duration
                    );


                renderActive();

                dispatchSettings();

            };

    }


    /* =========================================
       VALIDATION
    ========================================= */

    function validateRecord(
        record
    ) {

        if (
            !record ||
            !Number.isFinite(
                record.duration
            ) ||
            record.duration <= 0
        ) {

            return false;
        }


        if (
            !Number.isFinite(
                record.start
            ) ||
            !Number.isFinite(
                record.end
            )
        ) {

            return false;
        }


        if (
            record.start < 0 ||
            record.end >
                record.duration
        ) {

            return false;
        }


        if (
            record.end -
                record.start <
                0.05
        ) {

            return false;
        }


        return true;

    }


    function allValid() {

        return (
            state.records.length > 0 &&
            state.records.every(
                validateRecord
            )
        );

    }


    /* =========================================
       RENDER ACTIVE
    ========================================= */

    function renderActive() {

        const record =
            getActive();


        const disabled =
            !record;


        [
            elements.start,
            elements.end,
            elements.startRange,
            elements.endRange,
            elements.setStart,
            elements.setEnd,
            elements.outputFormat,
            elements.quality,
            elements.keepAudio,
            elements.play,
            elements.playSelection,
            elements.stop,
            elements.scrubber
        ].forEach(
            element => {

                element.disabled =
                    disabled;

            }
        );


        if (!record) {

            elements.start.value =
                "00:00:00.000";


            elements.end.value =
                "00:00:00.000";


            elements.selectedDuration
                .textContent =
                    "0.000 s";


            elements.validation
                .textContent =
                    "Load one or more videos.";


            elements.validation
                .classList
                .remove(
                    "valid",
                    "error"
                );


            return;
        }


        const duration =
            record.duration || 0;


        const end =
            record.end ??
            duration;


        elements.start.value =
            formatTime(
                record.start
            );


        elements.end.value =
            formatTime(
                end
            );


        elements.startRange.value =
            String(
                duration > 0
                    ? rangeFromSeconds(
                        record.start,
                        duration
                    )
                    : 0
            );


        elements.endRange.value =
            String(
                duration > 0
                    ? rangeFromSeconds(
                        end,
                        duration
                    )
                    : 1000
            );


        /*
         * .eft-range updates its gradient on input/change events.
         * Switching videos changes the value programmatically, so refresh
         * the generic component explicitly or the previous file's visual
         * position remains painted on the track.
         */
        window.EasyFileUIControls?.refreshRange?.(
            elements.startRange
        );

        window.EasyFileUIControls?.refreshRange?.(
            elements.endRange
        );


        elements.outputFormat.value =
            record.outputFormat;


        elements.quality.value =
            record.quality;


        elements.keepAudio.checked =
            record.keepAudio;


        elements.precisionButtons
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset
                            .trimPrecision ===
                            record.precision
                    );

                }
            );


        /*
         * Fast mode only makes sense
         * with the source container.
         */

        if (
            record.precision ===
            "fast"
        ) {

            record.outputFormat =
                "same";


            elements.outputFormat.value =
                "same";


            elements.outputFormat.disabled =
                true;


            elements.quality.disabled =
                true;


            elements.modeInfo.textContent =
                "Fast mode uses stream copy. It is extremely fast and keeps the original quality, but the exact cut may depend on nearby keyframes.";

        }
        else {

            elements.outputFormat.disabled =
                false;


            elements.quality.disabled =
                false;


            elements.modeInfo.textContent =
                "Accurate mode re-encodes the selected interval for precise trimming.";

        }


        elements.selectedDuration
            .textContent =
                `${
                    Math.max(
                        0,
                        end -
                        record.start
                    ).toFixed(3)
                } s`;


        if (
            validateRecord(
                record
            )
        ) {

            elements.validation.textContent =
                `Ready • ${
                    formatTime(
                        record.start
                    )
                } → ${
                    formatTime(
                        end
                    )
                }`;


            elements.validation
                .classList
                .add(
                    "valid"
                );


            elements.validation
                .classList
                .remove(
                    "error"
                );

        }
        else {

            elements.validation.textContent =
                "Start must be before End and remain inside the video duration.";


            elements.validation
                .classList
                .remove(
                    "valid"
                );


            elements.validation
                .classList
                .add(
                    "error"
                );

        }

    }


    /* =========================================
       DISPATCH
    ========================================= */

    function getRequests() {

        if (
            !allValid()
        ) {

            return null;
        }


        return state.records.map(
            (
                record,
                index
            ) => ({

                index,

                file:
                    record.file,

                start:
                    record.start,

                end:
                    record.end,

                duration:
                    record.end -
                    record.start,

                precision:
                    record.precision,

                outputFormat:
                    record.outputFormat,

                quality:
                    record.quality,

                keepAudio:
                    record.keepAudio

            })
        );

    }


    function dispatchSettings() {

        const requests =
            getRequests();


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:trim-video-settings-changed",
                {
                    detail: {

                        valid:
                            Boolean(
                                requests
                            ),

                        requests

                    }
                }
            )
        );

    }


    /* =========================================
       START / END HELPERS
    ========================================= */

    function updateStart(
        seconds
    ) {

        const record =
            getActive();


        if (!record) {
            return;
        }


        const duration =
            record.duration ||
            0;


        const maxStart =
            Math.max(
                0,
                (
                    record.end ??
                    duration
                ) -
                0.05
            );


        record.start =
            clamp(
                seconds,
                0,
                maxStart
            );


        renderActive();

        dispatchSettings();

    }


    function updateEnd(
        seconds
    ) {

        const record =
            getActive();


        if (!record) {
            return;
        }


        const duration =
            record.duration ||
            0;


        record.end =
            clamp(
                seconds,
                record.start +
                    0.05,
                duration
            );


        renderActive();

        dispatchSettings();

    }


    /* =========================================
       PLAYER
    ========================================= */

    function refreshPlayerIcons() {

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                root
            );

        }

    }


    elements.play.addEventListener(
        "click",
        async () => {

            state.selectionPlaying =
                false;


            if (
                elements.video.paused
            ) {

                await elements.video
                    .play();


                elements.play.innerHTML = `
                    <i data-lucide="pause"></i>
                    Pause
                `;

            }
            else {

                elements.video.pause();


                elements.play.innerHTML = `
                    <i data-lucide="play"></i>
                    Play
                `;

            }


            refreshPlayerIcons();

        }
    );


    elements.playSelection.addEventListener(
        "click",
        async () => {

            const record =
                getActive();


            if (
                !record ||
                !validateRecord(
                    record
                )
            ) {

                return;
            }


            if (
                state.selectionPlaying &&
                !elements.video.paused
            ) {

                elements.video.pause();

                state.selectionPlaying =
                    false;


                elements.playSelection.innerHTML = `
                    <i data-lucide="circle-play"></i>
                    Play Selection
                `;


                refreshPlayerIcons();

                return;
            }


            elements.video.currentTime =
                record.start;


            state.selectionPlaying =
                true;


            await elements.video.play();


            elements.playSelection.innerHTML = `
                <i data-lucide="circle-pause"></i>
                Pause Selection
            `;


            refreshPlayerIcons();

        }
    );


    elements.stop.addEventListener(
        "click",
        () => {

            const record =
                getActive();


            elements.video.pause();


            state.selectionPlaying =
                false;


            elements.video.currentTime =
                record?.start ||
                0;


            elements.play.innerHTML = `
                <i data-lucide="play"></i>
                Play
            `;


            elements.playSelection.innerHTML = `
                <i data-lucide="circle-play"></i>
                Play Selection
            `;


            refreshPlayerIcons();

        }
    );


    elements.video.addEventListener(
        "timeupdate",
        () => {

            const record =
                getActive();


            const current =
                elements.video
                    .currentTime ||
                0;


            elements.currentTime
                .textContent =
                    formatTime(
                        current
                    );


            const duration =
                record?.duration ||
                elements.video.duration ||
                0;


            elements.scrubber.value =
                String(
                    rangeFromSeconds(
                        current,
                        duration
                    )
                );


            if (
                state.selectionPlaying &&
                record &&
                current >=
                    record.end -
                    0.015
            ) {

                elements.video.pause();


                elements.video.currentTime =
                    record.start;


                state.selectionPlaying =
                    false;


                elements.playSelection.innerHTML = `
                    <i data-lucide="circle-play"></i>
                    Play Selection
                `;


                refreshPlayerIcons();

            }

        }
    );


    elements.video.addEventListener(
        "ended",
        () => {

            state.selectionPlaying =
                false;


            elements.play.innerHTML = `
                <i data-lucide="play"></i>
                Play
            `;


            refreshPlayerIcons();

        }
    );


    elements.scrubber.addEventListener(
        "input",
        () => {

            const record =
                getActive();


            if (
                !record ||
                !record.duration
            ) {

                return;
            }


            elements.video.currentTime =
                secondsFromRange(
                    elements.scrubber
                        .value,
                    record.duration
                );

        }
    );


    /* =========================================
       TIME EVENTS
    ========================================= */

    elements.startRange.addEventListener(
        "input",
        () => {

            const record =
                getActive();


            if (!record) {
                return;
            }


            updateStart(
                secondsFromRange(
                    elements.startRange
                        .value,
                    record.duration
                )
            );

        }
    );


    elements.endRange.addEventListener(
        "input",
        () => {

            const record =
                getActive();


            if (!record) {
                return;
            }


            updateEnd(
                secondsFromRange(
                    elements.endRange
                        .value,
                    record.duration
                )
            );

        }
    );


    elements.start.addEventListener(
        "change",
        () => {

            const parsed =
                parseTime(
                    elements.start.value
                );


            if (
                Number.isFinite(
                    parsed
                )
            ) {

                updateStart(
                    parsed
                );

            }
            else {

                renderActive();

            }

        }
    );


    elements.end.addEventListener(
        "change",
        () => {

            const parsed =
                parseTime(
                    elements.end.value
                );


            if (
                Number.isFinite(
                    parsed
                )
            ) {

                updateEnd(
                    parsed
                );

            }
            else {

                renderActive();

            }

        }
    );


    elements.setStart.addEventListener(
        "click",
        () => {

            updateStart(
                elements.video
                    .currentTime ||
                0
            );

        }
    );


    elements.setEnd.addEventListener(
        "click",
        () => {

            updateEnd(
                elements.video
                    .currentTime ||
                0
            );

        }
    );


    /* =========================================
       SETTINGS
    ========================================= */

    elements.precisionButtons
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const record =
                            getActive();


                        if (!record) {
                            return;
                        }


                        record.precision =
                            button.dataset
                                .trimPrecision;


                        if (
                            record.precision ===
                            "fast"
                        ) {

                            record.outputFormat =
                                "same";

                        }


                        renderActive();

                        dispatchSettings();

                    }
                );

            }
        );


    elements.outputFormat
        .addEventListener(
            "change",
            () => {

                const record =
                    getActive();


                if (!record) {
                    return;
                }


                record.outputFormat =
                    elements.outputFormat
                        .value;


                renderActive();

                dispatchSettings();

            }
        );


    elements.quality.addEventListener(
        "change",
        () => {

            const record =
                getActive();


            if (!record) {
                return;
            }


            record.quality =
                elements.quality
                    .value;


            dispatchSettings();

        }
    );


    elements.keepAudio.addEventListener(
        "change",
        () => {

            const record =
                getActive();


            if (!record) {
                return;
            }


            record.keepAudio =
                elements.keepAudio
                    .checked;


            dispatchSettings();

        }
    );


    elements.fileSelector
        .addEventListener(
            "change",
            () => {

                state.activeIndex =
                    Number(
                        elements.fileSelector
                            .value
                    ) || 0;


                loadActivePreview();

            }
        );


    /* =========================================
       FILE SYNC
    ========================================= */

    function updateFiles(files) {

        preserveRecords(
            files || []
        );


        renderFileSelector();

        loadActivePreview();

        dispatchSettings();

    }


    document.addEventListener(

        "easyfiletools:operation-files-updated",

        event => {

            if (
                event.detail?.operation !==
                "trim-video"
            ) {

                return;
            }


            updateFiles(
                event.detail.files ||
                []
            );

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


            updateFiles(
                data &&
                Array.isArray(
                    data.files
                )
                    ? data.files
                    : []
            );

        }
        catch (error) {

            console.error(
                "[TRIM VIDEO UI] Storage sync:",
                error
            );

        }

    }


    document.addEventListener(

        "easyfiletools:files-cleared",

        () => {

            state.records =
                [];


            state.activeIndex =
                0;


            revokePreview();

            renderFileSelector();

            loadActivePreview();

            dispatchSettings();

        }

    );


    /* =========================================
       PUBLIC
    ========================================= */

    window.TrimVideoUI = {

        getRequests,

        isValid() {

            return allValid();

        },

        getRecords() {

            return state.records;

        }

    };


    refreshPlayerIcons();

    renderFileSelector();

    renderActive();

    syncFiles();

})();