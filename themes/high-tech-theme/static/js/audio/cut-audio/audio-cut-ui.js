console.log("audio-cut-ui.js loaded");


/* =========================================================
   CUT AUDIO UI
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const MIN_SELECTION_DURATION =
        0.05;

    const HANDLE_KEYBOARD_STEP =
        0.1;

    const HANDLE_KEYBOARD_STEP_LARGE =
        1;

    const WAVEFORM_PEAK_COUNT =
        4096;

    const LARGE_WAVEFORM_FILE_BYTES =
        50 * 1024 * 1024;

    const LARGE_WAVEFORM_DURATION_SECONDS =
        30 * 60;

    /* Manual preview is allowed only for files that can be decoded safely. */
    const MANUAL_WAVEFORM_MAX_BYTES = 75 * 1024 * 1024;
    const MANUAL_WAVEFORM_MAX_SECONDS = 45 * 60;


    /* =====================================================
       DOM
    ===================================================== */

    const root =
        document.getElementById(
            "cutAudioEditor"
        );

    if (!root) {
        return;
    }


    const elements = {

        fileSelect:
            document.getElementById(
                "cutAudioFileSelect"
            ),

        configuredCounter:
            document.getElementById(
                "cutAudioConfiguredCounter"
            ),

        playPauseBtn:
            document.getElementById(
                "cutAudioPlayPauseBtn"
            ),

        playSelectionBtn:
            document.getElementById(
                "cutAudioPlaySelectionBtn"
            ),

        stopBtn:
            document.getElementById(
                "cutAudioStopBtn"
            ),

        currentTime:
            document.getElementById(
                "cutAudioCurrentTime"
            ),

        totalTime:
            document.getElementById(
                "cutAudioTotalTime"
            ),

        waveformStage:
            document.getElementById(
                "cutAudioWaveformStage"
            ),

        waveformCanvas:
            document.getElementById(
                "cutAudioWaveformCanvas"
            ),

        waveformMessage:
            document.getElementById(
                "cutAudioWaveformMessage"
            ),

        skipWaveformToggle:
            document.getElementById(
                "cutAudioSkipWaveform"
            ),

        selection:
            document.getElementById(
                "cutAudioSelection"
            ),

        startHandle:
            document.getElementById(
                "cutAudioStartHandle"
            ),

        endHandle:
            document.getElementById(
                "cutAudioEndHandle"
            ),

        playhead:
            document.getElementById(
                "cutAudioPlayhead"
            ),

        startInput:
            document.getElementById(
                "cutAudioStartInput"
            ),

        endInput:
            document.getElementById(
                "cutAudioEndInput"
            ),

        selectedDuration:
            document.getElementById(
                "cutAudioSelectedDuration"
            ),

        outputDuration:
            document.getElementById(
                "cutAudioOutputDuration"
            ),

        modeButtons:
            Array.from(
                document.querySelectorAll(
                    "[data-cut-mode]"
                )
            ),

        modeHelp:
            document.getElementById(
                "cutAudioModeHelp"
            ),

        fadeInEnabled:
            document.getElementById(
                "cutAudioFadeInEnabled"
            ),

        fadeInDuration:
            document.getElementById(
                "cutAudioFadeInDuration"
            ),

        fadeOutEnabled:
            document.getElementById(
                "cutAudioFadeOutEnabled"
            ),

        fadeOutDuration:
            document.getElementById(
                "cutAudioFadeOutDuration"
            ),

        outputFormat:
            document.getElementById(
                "cutAudioOutputFormat"
            ),

        validation:
            document.getElementById(
                "cutAudioValidation"
            )

    };


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        records: [],

        activeKey: null,

        settingsByKey:
            new Map(),

        audio:
            new Audio(),

        audioUrl:
            null,

        waveformPeaks:
            null,

        waveformMode:
            "waveform",

        operationLocked:
            false,

        waveformCache:
            new Map(),

        waveformBusyKeys:
            new Set(),

        waveformGenerationQueue:
            Promise.resolve(),

        waveformElapsedTimer:
            null,

        waveformElapsedStart:
            0,

        audioContext:
            null,

        duration:
            0,

        dragging:
            null,

        suppressStageClick:
            false,

        playbackMode:
            null,

        loadSerial:
            0

    };


    state.audio.preload =
        "metadata";


    /* =====================================================
       FILE HELPERS
    ===================================================== */

    function extractFile(
        entry
    ) {

        if (!entry) {
            return null;
        }

        if (
            typeof File !==
                "undefined" &&
            entry instanceof File
        ) {
            return entry;
        }

        return (
            entry.file ||
            entry.originalFile ||
            entry.sourceFile ||
            entry.inputFile ||
            null
        );

    }


    function createFileKey(
        file
    ) {

        return [
            file.name,
            file.size,
            file.lastModified || 0
        ].join("::");

    }


    function getRecordByKey(
        key
    ) {

        return state.records.find(
            record =>
                record.key === key
        ) || null;

    }


    function getActiveRecord() {

        if (!state.activeKey) {
            return null;
        }

        return getRecordByKey(
            state.activeKey
        );

    }


    /* =====================================================
       TIME
    ===================================================== */

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


    function formatTime(
        seconds
    ) {

        if (
            !Number.isFinite(seconds) ||
            seconds < 0
        ) {
            seconds = 0;
        }

        let totalMilliseconds =
            Math.round(
                seconds * 1000
            );

        const hours =
            Math.floor(
                totalMilliseconds /
                3600000
            );

        totalMilliseconds -=
            hours * 3600000;

        const minutes =
            Math.floor(
                totalMilliseconds /
                60000
            );

        totalMilliseconds -=
            minutes * 60000;

        const secs =
            Math.floor(
                totalMilliseconds /
                1000
            );

        const milliseconds =
            totalMilliseconds -
            secs * 1000;

        return (
            String(hours)
                .padStart(2, "0") +
            ":" +
            String(minutes)
                .padStart(2, "0") +
            ":" +
            String(secs)
                .padStart(2, "0") +
            "." +
            String(milliseconds)
                .padStart(3, "0")
        );

    }


    function parseTime(
        value
    ) {

        if (
            typeof value !==
            "string"
        ) {
            return null;
        }

        const trimmed =
            value.trim();

        if (!trimmed) {
            return null;
        }

        const parts =
            trimmed.split(":");

        if (
            parts.length < 1 ||
            parts.length > 3
        ) {
            return null;
        }


        let hours = 0;
        let minutes = 0;
        let seconds = 0;


        if (
            parts.length === 3
        ) {

            hours =
                Number(parts[0]);

            minutes =
                Number(parts[1]);

            seconds =
                Number(parts[2]);

        } else if (
            parts.length === 2
        ) {

            minutes =
                Number(parts[0]);

            seconds =
                Number(parts[1]);

        } else {

            seconds =
                Number(parts[0]);

        }


        if (
            !Number.isFinite(hours) ||
            !Number.isFinite(minutes) ||
            !Number.isFinite(seconds)
        ) {
            return null;
        }


        if (
            hours < 0 ||
            minutes < 0 ||
            seconds < 0
        ) {
            return null;
        }


        return (
            hours * 3600 +
            minutes * 60 +
            seconds
        );

    }


    /* =====================================================
       DEFAULT SETTINGS
    ===================================================== */

    function createDefaultSettings(
        duration
    ) {

        return {

            start:
                0,

            end:
                duration,

            duration,

            mode:
                "keep",

            fadeInEnabled:
                false,

            fadeInDuration:
                1,

            fadeOutEnabled:
                false,

            fadeOutDuration:
                1,

            outputFormat:
                "same",

            configured:
                false

        };

    }


    function ensureSettings(
        record,
        duration
    ) {

        let settings =
            state.settingsByKey.get(
                record.key
            );


        if (!settings) {

            settings =
                createDefaultSettings(
                    duration
                );

            state.settingsByKey.set(
                record.key,
                settings
            );

            return settings;
        }


        settings.duration =
            duration;


        settings.start =
            clamp(
                settings.start,
                0,
                duration
            );


        if (
            !Number.isFinite(
                settings.end
            ) ||
            settings.end <= 0
        ) {

            settings.end =
                duration;

        }


        settings.end =
            clamp(
                settings.end,
                0,
                duration
            );


        if (
            settings.end <=
            settings.start
        ) {

            settings.end =
                Math.min(
                    duration,
                    settings.start +
                    MIN_SELECTION_DURATION
                );

        }


        return settings;

    }


    function getActiveSettings() {

        if (!state.activeKey) {
            return null;
        }

        return (
            state.settingsByKey.get(
                state.activeKey
            ) ||
            null
        );

    }


    /* =====================================================
       OUTPUT DURATION
    ===================================================== */

    function getSelectionDuration(
        settings
    ) {

        if (!settings) {
            return 0;
        }

        return Math.max(
            0,
            settings.end -
            settings.start
        );

    }


    function getOutputDuration(
        settings
    ) {

        if (!settings) {
            return 0;
        }


        const selected =
            getSelectionDuration(
                settings
            );


        if (
            settings.mode ===
            "remove"
        ) {

            return Math.max(
                0,
                settings.duration -
                selected
            );

        }


        return selected;

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateSettings(
        settings
    ) {

        if (!settings) {

            return {
                valid: false,
                message:
                    "Choose an audio file."
            };

        }


        if (
            !Number.isFinite(
                settings.duration
            ) ||
            settings.duration <= 0
        ) {

            return {
                valid: false,
                message:
                    "Audio duration is not available."
            };

        }


        if (
            settings.start < 0 ||
            settings.end >
                settings.duration
        ) {

            return {
                valid: false,
                message:
                    "Start and End must remain inside the audio duration."
            };

        }


        const selectedDuration =
            getSelectionDuration(
                settings
            );


        if (
            selectedDuration <
            MIN_SELECTION_DURATION
        ) {

            return {
                valid: false,
                message:
                    "The selected section is too short."
            };

        }


        const tolerance =
            0.005;


        if (
            settings.mode === "keep" &&
            settings.start <= tolerance &&
            settings.end >=
                settings.duration -
                tolerance
        ) {

            return {
                valid: false,
                message:
                    "Move Start or End to choose the section you want to keep."
            };

        }


        if (
            settings.mode ===
                "remove" &&
            selectedDuration >=
                settings.duration -
                tolerance
        ) {

            return {
                valid: false,
                message:
                    "You cannot remove the entire audio file."
            };

        }


        const outputDuration =
            getOutputDuration(
                settings
            );


        if (
            outputDuration <
            MIN_SELECTION_DURATION
        ) {

            return {
                valid: false,
                message:
                    "The resulting audio would be too short."
            };

        }


        if (
            settings.fadeInEnabled &&
            settings.fadeInDuration >
                outputDuration
        ) {

            return {
                valid: false,
                message:
                    "Fade in cannot be longer than the output audio."
            };

        }


        if (
            settings.fadeOutEnabled &&
            settings.fadeOutDuration >
                outputDuration
        ) {

            return {
                valid: false,
                message:
                    "Fade out cannot be longer than the output audio."
            };

        }


        return {
            valid: true,
            message:
                "Ready to cut."
        };

    }


    function updateConfiguredStatus(
        settings
    ) {

        if (!settings) {
            return;
        }


        const validation =
            validateSettings(
                settings
            );


        settings.configured =
            validation.valid;

    }


    /* =====================================================
       UI ENABLE / DISABLE
    ===================================================== */

    function setControlsEnabled(
        enabled
    ) {

        elements.playPauseBtn.disabled =
            !enabled;

        elements.playSelectionBtn.disabled =
            !enabled;

        elements.stopBtn.disabled =
            !enabled;

        elements.startHandle.disabled =
            !enabled;

        elements.endHandle.disabled =
            !enabled;

        elements.startInput.disabled =
            !enabled;

        elements.endInput.disabled =
            !enabled;

        elements.outputFormat.disabled =
            !enabled;

        elements.fadeInEnabled.disabled =
            !enabled;

        elements.fadeOutEnabled.disabled =
            !enabled;


        elements.modeButtons.forEach(
            button => {

                button.disabled =
                    !enabled;

            }
        );


        updateFadeInputState();

    }

    function setOperationLocked(
        locked
    ) {

        state.operationLocked =
            locked;


        /*
        * File selection and Waveform/Timeline
        * switch are not managed by
        * setControlsEnabled(), so lock them here.
        */
        elements.fileSelect.disabled =
            locked;

        elements.skipWaveformToggle.disabled =
            locked;


        if (
            locked
        ) {

            /*
            * Prevent playback or editor changes
            * while FFmpeg is processing Cut.
            */
            stopPlayback();

            setControlsEnabled(
                false
            );

            return;
        }


        /*
        * Operation finished/cancelled:
        * restore editor controls only if
        * an active audio file is available.
        */
        const canEdit =
            Boolean(
                getActiveRecord()
            ) &&
            state.duration > 0;


        setControlsEnabled(
            canEdit
        );

    }

    function updateFadeInputState() {

        if (
            state.operationLocked
        ) {

            elements.fadeInDuration.disabled =
                true;

            elements.fadeOutDuration.disabled =
                true;

            return;
        }


        const enabled =
            Boolean(
                getActiveSettings()
            );


        elements.fadeInDuration.disabled =
            !enabled ||
            !elements
                .fadeInEnabled
                .checked;


        elements.fadeOutDuration.disabled =
            !enabled ||
            !elements
                .fadeOutEnabled
                .checked;

    }


    /* =====================================================
       LUCIDE
    ===================================================== */

    function refreshIcons() {

        if (
            typeof createLocalIcons ===
            "function"
        ) {

            createLocalIcons(
                root
            );

            return;
        }


        if (
            window.lucide &&
            typeof window.lucide
                .createIcons ===
                "function"
        ) {

            window.lucide
                .createIcons();

        }

    }


    /* =====================================================
       PLAYER BUTTON
    ===================================================== */

    function renderPlayerButtons() {

        const hasAudio =
            Boolean(
                state.audio.src
            ) &&
            state.duration > 0;


        const isPlaying =
            !state.audio.paused;


        const normalMode =
            state.playbackMode ===
            "normal";


        const selectionMode =
            state.playbackMode ===
            "selection";


        /* =========================
        NORMAL PLAYBACK
        ========================= */

        elements.playPauseBtn.disabled =
            !hasAudio ||
            selectionMode;


        if (
            normalMode &&
            isPlaying
        ) {

            elements.playPauseBtn
                .innerHTML = `
                    <i data-lucide="pause"></i>
                    <span>Pause</span>
                `;

        }
        else {

            elements.playPauseBtn
                .innerHTML = `
                    <i data-lucide="play"></i>
                    <span>Play</span>
                `;

        }


        /* =========================
        SELECTION PLAYBACK
        ========================= */

        elements.playSelectionBtn.disabled =
            !hasAudio ||
            normalMode;


        if (
            selectionMode &&
            isPlaying
        ) {

            elements.playSelectionBtn
                .innerHTML = `
                    <i data-lucide="circle-pause"></i>
                    <span>Pause Selection</span>
                `;

        }
        else {

            elements.playSelectionBtn
                .innerHTML = `
                    <i data-lucide="circle-play"></i>
                    <span>Play Selection</span>
                `;

        }


        refreshIcons();
    }


    /* =====================================================
       FILE LIST
    ===================================================== */

    async function readStoredFiles() {

        if (
            typeof loadSelectedFiles !==
            "function"
        ) {

            console.warn(
                "[CUT UI] loadSelectedFiles() unavailable"
            );

            return [];
        }


        try {

            const result =
                await loadSelectedFiles();


            console.log(
                "[CUT UI] Storage data:",
                result
            );


            /*
            * Current EasyFileTools format:
            *
            * {
            *     files: [...],
            *     category: "Audio"
            * }
            */

            if (
                result &&
                Array.isArray(
                    result.files
                )
            ) {

                console.log(
                    "[CUT UI] Stored files:",
                    result.files.length
                );

                return result.files;
            }


            /*
            * Compatibility fallback.
            */

            if (
                Array.isArray(
                    result
                )
            ) {

                return result;
            }


            return [];

        }
        catch (error) {

            console.error(
                "[CUT UI] Unable to load files:",
                error
            );

            return [];
        }
    }


    async function refreshFiles() {

        const previousKey =
            state.activeKey;


        const entries =
            await readStoredFiles();


        const records = [];


        entries.forEach(
            entry => {

                const file =
                    extractFile(entry);

                if (!file) {
                    return;
                }


                records.push({

                    key:
                        createFileKey(file),

                    file,

                    entry

                });

            }
        );


        state.records =
            records;


        renderFileSelect();


        if (
            records.length === 0
        ) {

            state.activeKey =
                null;

            resetEditor();

            updateConfiguredCounter();

            return;

        }


        const previousStillExists =
            records.some(
                record =>
                    record.key ===
                    previousKey
            );


        state.activeKey =
            previousStillExists
                ? previousKey
                : records[0].key;


        elements.fileSelect.value =
            state.activeKey;


        await loadActiveFile();

        updateConfiguredCounter();

    }


    function renderFileSelect() {

        elements.fileSelect
            .innerHTML = "";


        if (
            state.records.length === 0
        ) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                "";

            option.textContent =
                "No audio file loaded";

            elements.fileSelect
                .appendChild(
                    option
                );

            elements.fileSelect.disabled =
                true;

            return;

        }


        state.records.forEach(
            record => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    record.key;

                option.textContent =
                    record.file.name;

                elements.fileSelect
                    .appendChild(
                        option
                    );

            }
        );


        elements.fileSelect.disabled =
            false;

    }


    /* =====================================================
       CONFIGURED COUNTER
    ===================================================== */

    function updateConfiguredCounter() {

        const total =
            state.records.length;


        let configured =
            0;


        state.records.forEach(
            record => {

                const settings =
                    state.settingsByKey.get(
                        record.key
                    );

                if (
                    settings &&
                    validateSettings(
                        settings
                    ).valid
                ) {
                    configured++;
                }

            }
        );


        elements.configuredCounter
            .textContent =
                `${configured} / ${total} files configured`;

    }


    /* =====================================================
       AUDIO CONTEXT
    ===================================================== */

    function getAudioContext() {

        if (
            state.audioContext
        ) {
            return state.audioContext;
        }


        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContextClass) {
            return null;
        }


        state.audioContext =
            new AudioContextClass();


        return state.audioContext;

    }


    /* =====================================================
       METADATA
    ===================================================== */

    function waitForMetadata(
        audio
    ) {

        return new Promise(
            (resolve, reject) => {

                const onLoaded = () => {

                    cleanup();

                    resolve(
                        audio.duration
                    );

                };


                const onError = () => {

                    cleanup();

                    reject(
                        new Error(
                            "Audio metadata unavailable."
                        )
                    );

                };


                const cleanup = () => {

                    audio.removeEventListener(
                        "loadedmetadata",
                        onLoaded
                    );

                    audio.removeEventListener(
                        "error",
                        onError
                    );

                };


                audio.addEventListener(
                    "loadedmetadata",
                    onLoaded,
                    {
                        once: true
                    }
                );


                audio.addEventListener(
                    "error",
                    onError,
                    {
                        once: true
                    }
                );

            }
        );

    }


    /* =====================================================
       LOAD ACTIVE FILE
    ===================================================== */

    async function loadActiveFile() {

        const serial =
            ++state.loadSerial;


        const record =
            getActiveRecord();


        if (!record) {

            resetEditor();

            return;
        }


        stopPlayback();


        state.waveformPeaks =
            null;


        if (
            state.audioUrl
        ) {

            URL.revokeObjectURL(
                state.audioUrl
            );


            state.audioUrl =
                null;
        }


        state.audioUrl =
            URL.createObjectURL(
                record.file
            );


        state.audio.src =
            state.audioUrl;


        elements.waveformMessage
            .textContent =
                "Loading audio metadata...";


        setControlsEnabled(
            false
        );


        /*
        * =====================================================
        * 1. METADATA FIRST
        * =====================================================
        */

        let metadataDuration =
            0;


        try {

            metadataDuration =
                await waitForMetadata(
                    state.audio
                );

        }
        catch (error) {

            console.warn(
                "[CUT UI] HTML audio metadata failed:",
                error
            );
        }


        if (
            serial !==
            state.loadSerial
        ) {

            return;
        }


        /*
        * =====================================================
        * 2. CACHE
        * =====================================================
        */

        const cachedWaveform =
            state.waveformCache.get(
                record.key
            ) || null;


        if (
            cachedWaveform?.peaks
        ) {

            state.waveformPeaks =
                cachedWaveform.peaks;
        }


        const cachedDuration =
            Number(
                cachedWaveform
                    ?.duration
            );


        state.duration =
            (
                Number.isFinite(
                    cachedDuration
                ) &&
                cachedDuration > 0
            )
                ? cachedDuration
                : (
                    Number.isFinite(
                        metadataDuration
                    )
                        ? metadataDuration
                        : 0
                );


        /*
        * =====================================================
        * 3. EDITOR BECOMES AVAILABLE NOW
        * =====================================================
        */

        if (
            state.duration <= 0
        ) {

            elements.waveformMessage
                .textContent =
                    "Preview is not available for this audio format.";


            drawEmptyWaveform();


            setControlsEnabled(
                false
            );


            return;
        }


        ensureSettings(
            record,
            state.duration
        );

        if (!state.waveformPeaks) {
            state.waveformMode = shouldUseLightweightWaveform(record.file, state.duration)
                ? "timeline" : "waveform";
            renderWaveformDisplayMode();
        }

        elements.totalTime
            .textContent =
                formatTime(
                    state.duration
                );


        /*
        * IMPORTANT:
        *
        * Start / End / player / handles become
        * usable BEFORE waveform generation.
        */

        setControlsEnabled(
            true
        );


        /*
        * Cached waveform:
        * instant display.
        */

        if (
            state.waveformPeaks
        ) {

            drawWaveform();


            elements.waveformMessage
                .textContent =
                    "Drag the handles to choose the audio section.";


            renderSettings();

            return;
        }


        /*
        * =====================================================
        * 4. NO CACHE
        *
        * Editor is already usable.
        * Waveform now runs in background.
        * =====================================================
        */

        drawEmptyWaveform();

        if (state.waveformMode === "timeline") {
            elements.waveformMessage.textContent =
                "Large file: timeline ready. Uncheck Skip waveform to request a preview (if supported).";
            renderSettings();
            return;
        }

        elements.waveformMessage.textContent = "Generating waveform... 0 s";

        /*
        * Mark this file busy BEFORE renderSettings()
        * so Cut stays disabled while the shared
        * FFmpeg preview may be running.
        */

        queueWaveformGeneration(
            record,
            metadataDuration,
            serial
        );


        renderSettings();

    }

    /* =====================================================
       RESET
    ===================================================== */

    function resetEditor() {

        stopPlayback();


        state.duration =
            0;

        state.waveformPeaks =
            null;


        elements.totalTime
            .textContent =
                "00:00:00.000";

        elements.currentTime
            .textContent =
                "00:00:00.000";

        elements.startInput.value =
            "00:00:00.000";

        elements.endInput.value =
            "00:00:00.000";

        elements.selectedDuration
            .textContent =
                "00:00:00.000";

        elements.outputDuration
            .textContent =
                "00:00:00.000";


        elements.selection.style.left =
            "0%";

        elements.selection.style.width =
            "0%";

        elements.playhead.style.left =
            "0%";


        elements.waveformMessage
            .textContent =
                "Load an audio file to display its waveform.";


        elements.validation
            .className =
                "cut-audio-validation";

        elements.validation
            .textContent =
                "Choose an audio file and select the section to cut.";


        drawEmptyWaveform();

        setControlsEnabled(
            false
        );

    }


    /* =====================================================
       WAVEFORM
    ===================================================== */

    async function cancelBackgroundWaveform() {

        stopWaveformElapsedTimer();


        const busyKeys =
            Array.from(
                state.waveformBusyKeys
            );


        /* Browser waveform decoding is not interruptible; later completions
         * are ignored when timeline mode is active. No FFmpeg reset needed. */


        /*
        * The waveform is no longer blocking
        * the Cut operation.
        */
        state.waveformBusyKeys
            .clear();


        /*
        * Tell the generic operation controller
        * to re-evaluate readiness immediately.
        */
        busyKeys.forEach(
            key => {

                const record =
                    state.records.find(
                        item =>
                            item.key ===
                            key
                    );


                if (record) {

                    notifyWaveformStateChanged(
                        record
                    );

                }

            }
        );


        updateConfiguredCounter();

    }

    function renderWaveformDisplayMode() {

        const timelineMode =
            state.waveformMode ===
            "timeline";


        elements.waveformStage
            .classList.toggle(
                "is-timeline-mode",
                timelineMode
            );


        elements.skipWaveformToggle
            .checked =
                timelineMode;


        if (
            timelineMode
        ) {

            drawEmptyWaveform();

        }
        else if (
            state.waveformPeaks
        ) {

            drawWaveform();

        }
        else {

            drawEmptyWaveform();

        }


        renderSelection();

    }

    function resizeCanvas() {

        const canvas =
            elements.waveformCanvas;


        const rect =
            elements.waveformStage
                .getBoundingClientRect();


        const dpr =
            window.devicePixelRatio ||
            1;


        canvas.width =
            Math.max(
                1,
                Math.round(
                    rect.width *
                    dpr
                )
            );


        canvas.height =
            Math.max(
                1,
                Math.round(
                    rect.height *
                    dpr
                )
            );


        const context =
            canvas.getContext(
                "2d"
            );


        context.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        return {
            context,
            width:
                rect.width,
            height:
                rect.height
        };

    }


    function drawEmptyWaveform() {

        const {
            context,
            width,
            height
        } =
            resizeCanvas();


        context.clearRect(
            0,
            0,
            width,
            height
        );


        context.beginPath();

        context.moveTo(
            0,
            height / 2
        );

        context.lineTo(
            width,
            height / 2
        );

        context.strokeStyle =
            "#d1d5db";

        context.lineWidth =
            1;

        context.stroke();

    }

    function createWaveformPeaks(
        buffer
    ) {

        if (
            !buffer ||
            buffer.numberOfChannels <= 0
        ) {

            return null;
        }


        const channel =
            buffer.getChannelData(
                0
            );


        if (
            !channel ||
            channel.length === 0
        ) {

            return null;
        }


        const peakCount =
            Math.min(
                WAVEFORM_PEAK_COUNT,
                channel.length
            );


        const peaks =
            new Float32Array(
                peakCount
            );


        for (
            let peakIndex = 0;
            peakIndex < peakCount;
            peakIndex++
        ) {

            const start =
                Math.floor(
                    peakIndex *
                    channel.length /
                    peakCount
                );


            const end =
                Math.max(
                    start + 1,

                    Math.floor(
                        (
                            peakIndex + 1
                        ) *
                        channel.length /
                        peakCount
                    )
                );


            /*
            * We do not need to inspect every
            * PCM sample to draw a visual preview.
            */

            const sampleStep =
                Math.max(
                    1,
                    Math.floor(
                        (
                            end -
                            start
                        ) /
                        64
                    )
                );


            let peak =
                0;


            for (
                let i = start;
                i < end;
                i += sampleStep
            ) {

                const value =
                    Math.abs(
                        channel[i]
                    );


                if (
                    value > peak
                ) {

                    peak =
                        value;
                }

            }


            peaks[peakIndex] =
                peak;

        }


        return peaks;
    }    

    function shouldUseLightweightWaveform(
        file,
        duration
    ) {

        const fileIsLarge =
            Number(
                file?.size
            ) >=
            LARGE_WAVEFORM_FILE_BYTES;


        const audioIsLong =
            Number.isFinite(
                duration
            ) &&
            duration >=
                LARGE_WAVEFORM_DURATION_SECONDS;


        return (
            fileIsLarge ||
            audioIsLong
        );
    }


    function notifyWaveformStateChanged(
        record
    ) {

        const settings =
            state.settingsByKey.get(
                record.key
            );


        if (!settings) {
            return;
        }


        window.dispatchEvent(
            new CustomEvent(
                "easyfiletools:cut-settings-changed",
                {
                    detail: {

                        key:
                            record.key,

                        file:
                            record.file,

                        settings:
                            {
                                ...settings
                            }

                    }
                }
            )
        );
    }

    function startWaveformElapsedTimer() {

        if (
            state.waveformElapsedTimer
        ) {
            clearInterval(
                state.waveformElapsedTimer
            );
        }


        state.waveformElapsedStart =
            performance.now();


        state.waveformElapsedTimer =
            setInterval(
                () => {

                    if (
                        state.waveformMode !==
                            "waveform"
                    ) {
                        return;
                    }


                    const seconds =
                        Math.floor(
                            (
                                performance.now() -
                                state.waveformElapsedStart
                            ) /
                            1000
                        );


                    elements.waveformMessage
                        .textContent =
                            `Generating waveform... ${seconds} s`;

                },
                1000
            );

    }

    function stopWaveformElapsedTimer() {

        if (
            state.waveformElapsedTimer
        ) {

            clearInterval(
                state.waveformElapsedTimer
            );


            state.waveformElapsedTimer =
                null;

        }

    }

    function queueWaveformGeneration(
        record,
        metadataDuration,
        serial
    ) {

        if (
            state.waveformMode ===
            "timeline"
        ) {
            return;
        }

        /*
        * Already generating this file:
        * do not create another job.
        */

        if (
            state.waveformBusyKeys.has(
                record.key
            )
        ) {

            return;
        }


        state.waveformBusyKeys.add(
            record.key
        );


        /* The waveform is optional and never locks the Cut operation. */
        notifyWaveformStateChanged(
            record
        );

        updateConfiguredCounter();


        /* Serialize browser-only waveform jobs to limit memory pressure. */

        state.waveformGenerationQueue =
            state.waveformGenerationQueue
                .catch(
                    () => {}
                )
                .then(
                    async () => {

                        if (
                            state.waveformMode ===
                            "timeline"
                        ) {
                            return null;
                        }                        

                        /*
                        * Another load may already have
                        * completed this waveform.
                        */

                        const existing =
                            state.waveformCache.get(
                                record.key
                            );


                        if (
                            existing?.peaks
                        ) {

                            return existing;
                        }


                        startWaveformElapsedTimer();


                        let peaks =
                            null;

                        let duration =
                            metadataDuration;


                        /* Web Audio only: a waveform preview must never initialize FFmpeg. */
                        if (record.file.size > MANUAL_WAVEFORM_MAX_BYTES ||
                            (Number.isFinite(duration) && duration > MANUAL_WAVEFORM_MAX_SECONDS)) {
                            throw new Error("Waveform is disabled for this large recording.");
                        }

                        {
                            const context =
                                getAudioContext();


                            if (!context) {

                                throw new Error(
                                    "Web Audio is unavailable."
                                );
                            }


                            const arrayBuffer =
                                await record.file
                                    .arrayBuffer();


                            let decodedBuffer =
                                await context
                                    .decodeAudioData(
                                        arrayBuffer
                                    );


                            if (
                                Number.isFinite(
                                    decodedBuffer.duration
                                ) &&
                                decodedBuffer.duration >
                                    0
                            ) {

                                duration =
                                    decodedBuffer.duration;
                            }


                            peaks =
                                createWaveformPeaks(
                                    decodedBuffer
                                );


                            /*
                            * Release the PCM buffer as
                            * soon as peaks exist.
                            */

                            decodedBuffer =
                                null;

                        }


                        if (
                            !peaks ||
                            peaks.length === 0
                        ) {

                            throw new Error(
                                "Unable to generate waveform peaks."
                            );
                        }


                        const result = {

                            peaks,

                            duration

                        };


                        state.waveformCache.set(
                            record.key,
                            result
                        );


                        return result;

                    }
                )
                .then(
                    result => {

                        if (!result || state.waveformMode === "timeline") {
                            return;
                        }


                        /*
                        * Update the visual editor only
                        * if this file is still active.
                        */

                        if (
                            state.activeKey ===
                            record.key
                        ) {

                            state.waveformPeaks =
                                result.peaks;


                            if (
                                Number.isFinite(
                                    result.duration
                                ) &&
                                result.duration > 0
                            ) {

                                state.duration =
                                    result.duration;


                                ensureSettings(
                                    record,
                                    state.duration
                                );


                                elements.totalTime
                                    .textContent =
                                        formatTime(
                                            state.duration
                                        );
                            }


                            drawWaveform();


                            elements.waveformMessage
                                .textContent =
                                    "Drag the handles to choose the audio section.";


                            renderSettings();
                        }

                    }
                )
                .catch(
                    error => {

                        /*
                        * Switching to timeline mode makes any optional waveform obsolete.
                        */
                        if (
                            state.waveformMode ===
                                "timeline" ||
                            String(
                                error?.message || ""
                            ).includes(
                                "Waveform preview cancelled"
                            )
                        ) {

                            console.log(
                                "[CUT UI] Background waveform cancelled by user."
                            );

                            return;

                        }


                        /*
                        * Genuine waveform error.
                        */
                        console.warn(
                            "[CUT UI] Background waveform failed:",
                            error
                        );


                        if (
                            state.activeKey ===
                            record.key
                        ) {

                            drawEmptyWaveform();


                            elements.waveformMessage
                                .textContent =
                                    "Waveform preview is unavailable, but time controls can still be used.";

                        }

                    }
                )
                .finally(
                    () => {

                        stopWaveformElapsedTimer();


                        state.waveformBusyKeys.delete(
                            record.key
                        );


                        /*
                        * Recalculate Cut readiness now
                        * that FFmpeg preview work is over.
                        */

                        notifyWaveformStateChanged(
                            record
                        );


                        updateConfiguredCounter();

                    }
                );
    }

    function drawWaveform() {

        const peaks =
            state.waveformPeaks;


        if (
            !peaks ||
            peaks.length === 0
        ) {

            drawEmptyWaveform();

            return;
        }


        const {
            context,
            width,
            height
        } =
            resizeCanvas();


        context.clearRect(
            0,
            0,
            width,
            height
        );


        const pixelWidth =
            Math.max(
                1,
                Math.floor(
                    width
                )
            );


        /*
        * =====================================================
        * VERTICAL NORMALIZATION
        *
        * Use the 98th percentile instead of
        * the absolute maximum.
        * =====================================================
        */

        const sortedPeaks =
            Array.from(
                peaks
            )
                .filter(
                    value =>
                        Number.isFinite(
                            value
                        ) &&
                        value >= 0
                )
                .sort(
                    (a, b) =>
                        a - b
                );


        const normalizationIndex =
            Math.min(
                sortedPeaks.length - 1,

                Math.floor(
                    sortedPeaks.length *
                    0.98
                )
            );


        const normalizationPeak =
            Math.max(
                0.0001,

                sortedPeaks[
                    normalizationIndex
                ] || 1
            );


        /*
        * =====================================================
        * BUILD ONE DISPLAY VALUE PER CANVAS PIXEL
        *
        * Mix:
        * - maximum peak = preserve transients
        * - RMS = preserve general shape
        * =====================================================
        */

        const displayPeaks =
            new Float32Array(
                pixelWidth
            );


        for (
            let x = 0;
            x < pixelWidth;
            x++
        ) {

            const peakStart =
                Math.floor(
                    x *
                    peaks.length /
                    pixelWidth
                );


            const peakEnd =
                Math.max(
                    peakStart + 1,

                    Math.floor(
                        (
                            x + 1
                        ) *
                        peaks.length /
                        pixelWidth
                    )
                );


            let maxPeak =
                0;

            let sumSquares =
                0;

            let count =
                0;


            for (
                let i = peakStart;
                i < peakEnd &&
                i < peaks.length;
                i++
            ) {

                const value =
                    Math.max(
                        0,
                        peaks[i]
                    );


                if (
                    value >
                    maxPeak
                ) {

                    maxPeak =
                        value;
                }


                sumSquares +=
                    value *
                    value;

                count++;

            }


            const rms =
                count > 0
                    ? Math.sqrt(
                        sumSquares /
                        count
                    )
                    : 0;


            /*
            * Keep transient detail while
            * avoiding a very spiky waveform.
            */

            const combinedPeak =
                maxPeak * 0.8 +
                rms * 0.2;


            displayPeaks[x] =
                Math.min(
                    1,
                    combinedPeak /
                    normalizationPeak
                );

        }


        /*
        * =====================================================
        * VERY LIGHT HORIZONTAL SMOOTHING
        *
        * Only one pixel around each point.
        * This removes jagged "comb" artefacts
        * without destroying audio detail.
        * =====================================================
        */

        const smoothedPeaks =
            new Float32Array(
                pixelWidth
            );


        for (
            let x = 0;
            x < pixelWidth;
            x++
        ) {

            const previous =
                displayPeaks[
                    Math.max(
                        0,
                        x - 1
                    )
                ];


            const current =
                displayPeaks[x];


            const next =
                displayPeaks[
                    Math.min(
                        pixelWidth - 1,
                        x + 1
                    )
                ];


            smoothedPeaks[x] =
                previous * 0.2 +
                current * 0.6 +
                next * 0.2;

        }


        /*
        * =====================================================
        * COLOR
        * =====================================================
        */

        const computed =
            getComputedStyle(
                root
            );


        const waveformColor =
            computed
                .getPropertyValue(
                    "--violet"
                )
                .trim() ||
            "#6b21a8";


        context.fillStyle =
            waveformColor;


        const center =
            height / 2;


        /*
        * 47 % above +
        * 47 % below =
        * 94 % maximum visual height.
        */

        const amplitude =
            height * 0.47;


        /*
        * =====================================================
        * DRAW CONTINUOUS ENVELOPE
        * =====================================================
        */

        context.beginPath();


        /*
        * Upper edge.
        */

        context.moveTo(
            0,
            center -
            smoothedPeaks[0] *
            amplitude
        );


        for (
            let x = 1;
            x < pixelWidth;
            x++
        ) {

            context.lineTo(
                x,
                center -
                smoothedPeaks[x] *
                amplitude
            );

        }


        /*
        * Lower edge, backwards.
        */

        for (
            let x =
                pixelWidth - 1;
            x >= 0;
            x--
        ) {

            context.lineTo(
                x,
                center +
                smoothedPeaks[x] *
                amplitude
            );

        }


        context.closePath();

        context.fill();
    }

    /* =====================================================
       SELECTION RENDERING
    ===================================================== */

    function renderSelection() {

        const settings =
            getActiveSettings();


        if (
            !settings ||
            settings.duration <= 0
        ) {

            elements.selection
                .style.left =
                    "0%";

            elements.selection
                .style.width =
                    "0%";

            return;

        }


        const startPercent =
            (
                settings.start /
                settings.duration
            ) * 100;


        const endPercent =
            (
                settings.end /
                settings.duration
            ) * 100;


        elements.selection
            .style.left =
                `${startPercent}%`;


        elements.selection
            .style.width =
                `${
                    Math.max(
                        0,
                        endPercent -
                        startPercent
                    )
                }%`;

    }


    /* =====================================================
       SETTINGS RENDERING
    ===================================================== */

    function renderSettings() {

        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        elements.startInput.value =
            formatTime(
                settings.start
            );


        elements.endInput.value =
            formatTime(
                settings.end
            );


        elements.selectedDuration
            .textContent =
                formatTime(
                    getSelectionDuration(
                        settings
                    )
                );


        elements.outputDuration
            .textContent =
                formatTime(
                    getOutputDuration(
                        settings
                    )
                );


        elements.modeButtons
            .forEach(
                button => {

                    const active =
                        button.dataset
                            .cutMode ===
                        settings.mode;


                    button.classList
                        .toggle(
                            "active",
                            active
                        );


                    button.setAttribute(
                        "aria-pressed",
                        active
                            ? "true"
                            : "false"
                    );

                }
            );


        elements.modeHelp
            .textContent =
                settings.mode ===
                "remove"
                    ? "Remove the selected section and join the remaining audio."
                    : "Keep only the selected section.";


        elements.fadeInEnabled
            .checked =
                settings.fadeInEnabled;


        elements.fadeInDuration
            .value =
                settings.fadeInDuration;


        elements.fadeOutEnabled
            .checked =
                settings.fadeOutEnabled;


        elements.fadeOutDuration
            .value =
                settings.fadeOutDuration;


        elements.outputFormat
            .value =
                settings.outputFormat;


        updateFadeInputState();

        renderSelection();

        updateValidation();

        updateConfiguredCounter();

        dispatchSettingsChanged();

    }


    /* =====================================================
       VALIDATION UI
    ===================================================== */

    function updateValidation() {

        const settings =
            getActiveSettings();


        const validation =
            validateSettings(
                settings
            );


        elements.validation
            .className =
                "cut-audio-validation " +
                (
                    validation.valid
                        ? "valid"
                        : "invalid"
                );


        elements.validation
            .textContent =
                validation.message;


        updateConfiguredStatus(
            settings
        );

    }


    /* =====================================================
       SETTINGS EVENT
    ===================================================== */

    function dispatchSettingsChanged() {

        const record =
            getActiveRecord();


        const settings =
            getActiveSettings();


        if (
            !record ||
            !settings
        ) {
            return;
        }


        window.dispatchEvent(
            new CustomEvent(
                "easyfiletools:cut-settings-changed",
                {
                    detail: {
                        key:
                            record.key,
                        file:
                            record.file,
                        settings:
                            {
                                ...settings
                            }
                    }
                }
            )
        );

    }


    /* =====================================================
       TIME INPUT COMMIT
    ===================================================== */

    function commitStartInput() {

        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        const parsed =
            parseTime(
                elements
                    .startInput
                    .value
            );


        if (
            parsed === null
        ) {

            elements.startInput.value =
                formatTime(
                    settings.start
                );

            return;
        }


        settings.start =
            clamp(
                parsed,
                0,
                Math.max(
                    0,
                    settings.end -
                    MIN_SELECTION_DURATION
                )
            );


        renderSettings();

    }


    function commitEndInput() {

        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        const parsed =
            parseTime(
                elements
                    .endInput
                    .value
            );


        if (
            parsed === null
        ) {

            elements.endInput.value =
                formatTime(
                    settings.end
                );

            return;
        }


        settings.end =
            clamp(
                parsed,
                Math.min(
                    settings.duration,
                    settings.start +
                    MIN_SELECTION_DURATION
                ),
                settings.duration
            );


        renderSettings();

    }


    /* =====================================================
       HANDLE DRAGGING
    ===================================================== */

    function timeFromPointer(
        clientX
    ) {

        const rect =
            elements.waveformStage
                .getBoundingClientRect();


        if (
            rect.width <= 0 ||
            state.duration <= 0
        ) {
            return 0;
        }


        const relativeX =
            clamp(
                clientX -
                rect.left,
                0,
                rect.width
            );


        return (
            relativeX /
            rect.width
        ) *
        state.duration;

    }


    function beginHandleDrag(
        type,
        event
    ) {

        if (
            event.button !==
            undefined &&
            event.button !== 0
        ) {
            return;
        }


        event.preventDefault();

        event.stopPropagation();


        state.dragging =
            type;


        state.suppressStageClick =
            true;


        window.addEventListener(
            "pointermove",
            handlePointerMove
        );


        window.addEventListener(
            "pointerup",
            endHandleDrag,
            {
                once: true
            }
        );

    }


    function handlePointerMove(
        event
    ) {

        if (!state.dragging) {
            return;
        }


        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        const time =
            timeFromPointer(
                event.clientX
            );


        if (
            state.dragging ===
            "start"
        ) {

            settings.start =
                clamp(
                    time,
                    0,
                    settings.end -
                    MIN_SELECTION_DURATION
                );

        } else {

            settings.end =
                clamp(
                    time,
                    settings.start +
                    MIN_SELECTION_DURATION,
                    settings.duration
                );

        }


        renderSettings();

    }


    function endHandleDrag() {

        state.dragging =
            null;


        window.removeEventListener(
            "pointermove",
            handlePointerMove
        );


        setTimeout(
            () => {

                state.suppressStageClick =
                    false;

            },
            0
        );

    }


    /* =====================================================
       HANDLE KEYBOARD
    ===================================================== */

    function handleKeyboardMove(
        type,
        event
    ) {

        if (
            event.key !==
                "ArrowLeft" &&
            event.key !==
                "ArrowRight"
        ) {
            return;
        }


        event.preventDefault();


        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        const step =
            event.shiftKey
                ? HANDLE_KEYBOARD_STEP_LARGE
                : HANDLE_KEYBOARD_STEP;


        const direction =
            event.key ===
            "ArrowRight"
                ? 1
                : -1;


        if (
            type ===
            "start"
        ) {

            settings.start =
                clamp(
                    settings.start +
                    direction *
                    step,
                    0,
                    settings.end -
                    MIN_SELECTION_DURATION
                );

        } else {

            settings.end =
                clamp(
                    settings.end +
                    direction *
                    step,
                    settings.start +
                    MIN_SELECTION_DURATION,
                    settings.duration
                );

        }


        renderSettings();

    }


    /* =====================================================
       PLAYER
    ===================================================== */

    function updatePlayhead() {

        const duration =
            state.duration;


        const current =
            Number.isFinite(
                state.audio.currentTime
            )
                ? state.audio.currentTime
                : 0;


        elements.currentTime
            .textContent =
                formatTime(
                    current
                );


        const percent =
            duration > 0
                ? (
                    current /
                    duration
                ) * 100
                : 0;


        elements.playhead
            .style.left =
                `${
                    clamp(
                        percent,
                        0,
                        100
                    )
                }%`;

    }


    async function playPause() {

        if (
            !state.audio.src
        ) {
            return;
        }


        /*
        * Another playback mode
        * is already selected.
        */

        if (
            state.playbackMode &&
            state.playbackMode !==
                "normal"
        ) {
            return;
        }


        if (
            state.playbackMode ===
            null
        ) {

            state.playbackMode =
                "normal";
        }


        if (
            state.audio.paused
        ) {

            if (
                state.audio.currentTime >=
                state.duration
            ) {

                state.audio.currentTime =
                    0;
            }


            try {

                await state.audio.play();

            }
            catch (error) {

                console.error(
                    "[CUT UI] Playback failed:",
                    error
                );
            }

        }
        else {

            state.audio.pause();
        }


        renderPlayerButtons();
    }


    async function playSelection() {

        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        /*
        * Normal playback currently owns
        * the player.
        */

        if (
            state.playbackMode &&
            state.playbackMode !==
                "selection"
        ) {
            return;
        }


        /*
        * First selection playback.
        */

        if (
            state.playbackMode ===
            null
        ) {

            state.playbackMode =
                "selection";


            state.audio.currentTime =
                settings.start;
        }


        /*
        * Resume selection.
        */

        if (
            state.audio.paused
        ) {

            if (
                state.audio.currentTime <
                    settings.start ||
                state.audio.currentTime >=
                    settings.end
            ) {

                state.audio.currentTime =
                    settings.start;
            }


            try {

                await state.audio.play();

            }
            catch (error) {

                console.error(
                    "[CUT UI] Selection playback failed:",
                    error
                );
            }

        }

        /*
        * Pause selection.
        */

        else {

            state.audio.pause();
        }


        renderPlayerButtons();
    }


    function stopPlayback() {

        state.playbackMode =
            null;


        state.audio.pause();


        try {

            state.audio.currentTime =
                0;

        }
        catch (_) {
            // Ignore
        }


        renderPlayerButtons();

        updatePlayhead();
    }


    /* =====================================================
       WAVEFORM SEEK
    ===================================================== */

    function seekFromWaveform(
        event
    ) {

        if (
            state.suppressStageClick ||
            state.duration <= 0
        ) {
            return;
        }


        const time =
            timeFromPointer(
                event.clientX
            );


        try {

            state.audio.currentTime =
                time;

        } catch (_) {
            // Ignore
        }


        updatePlayhead();

    }


    /* =====================================================
       MODES
    ===================================================== */

    function setMode(
        mode
    ) {

        const settings =
            getActiveSettings();


        if (!settings) {
            return;
        }


        if (
            mode !== "keep" &&
            mode !== "remove"
        ) {
            return;
        }


        settings.mode =
            mode;


        renderSettings();

    }


    /* =====================================================
       FADE
    ===================================================== */

    function readFadeDuration(
        element,
        fallback
    ) {

        const value =
            Number(
                element.value
            );


        if (
            !Number.isFinite(value)
        ) {
            return fallback;
        }


        return clamp(
            value,
            0.1,
            10
        );

    }


    /* =====================================================
       BATCH DATA
    ===================================================== */

    function getBatchItems() {

        const items =
            [];


        state.records.forEach(
            record => {

                const settings =
                    state.settingsByKey.get(
                        record.key
                    );


                if (!settings) {
                    return;
                }


                const validation =
                    validateSettings(
                        settings
                    );


                if (
                    !validation.valid
                ) {
                    return;
                }


                items.push({

                    key:
                        record.key,

                    file:
                        record.file,

                    entry:
                        record.entry,

                    settings:
                        {
                            ...settings
                        }

                });

            }
        );


        return items;

    }


    function getAllRecords() {

        return state.records.map(
            record => ({
                ...record
            })
        );

    }


    function getSettingsForKey(
        key
    ) {

        const settings =
            state.settingsByKey.get(
                key
            );


        return settings
            ? {
                ...settings
            }
            : null;

    }


    /* =====================================================
       EVENTS
    ===================================================== */

    elements.fileSelect
        .addEventListener(
            "change",
            async () => {

                state.activeKey =
                    elements
                        .fileSelect
                        .value ||
                    null;


                await loadActiveFile();

            }
        );


    elements.startInput
        .addEventListener(
            "change",
            commitStartInput
        );


    elements.endInput
        .addEventListener(
            "change",
            commitEndInput
        );


    elements.startInput
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    commitStartInput();

                    elements.startInput
                        .blur();

                }

            }
        );


    elements.endInput
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    commitEndInput();

                    elements.endInput
                        .blur();

                }

            }
        );


    elements.startHandle
        .addEventListener(
            "pointerdown",
            event =>
                beginHandleDrag(
                    "start",
                    event
                )
        );


    elements.endHandle
        .addEventListener(
            "pointerdown",
            event =>
                beginHandleDrag(
                    "end",
                    event
                )
        );


    elements.startHandle
        .addEventListener(
            "keydown",
            event =>
                handleKeyboardMove(
                    "start",
                    event
                )
        );


    elements.endHandle
        .addEventListener(
            "keydown",
            event =>
                handleKeyboardMove(
                    "end",
                    event
                )
        );


    elements.waveformStage
        .addEventListener(
            "click",
            seekFromWaveform
        );


    elements.playPauseBtn
        .addEventListener(
            "click",
            playPause
        );


    elements.playSelectionBtn
        .addEventListener(
            "click",
            playSelection
        );


    elements.stopBtn
        .addEventListener(
            "click",
            stopPlayback
        );


    elements.modeButtons
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setMode(
                            button.dataset
                                .cutMode
                        );

                    }
                );

            }
        );


    elements.fadeInEnabled
        .addEventListener(
            "change",
            () => {

                const settings =
                    getActiveSettings();


                if (!settings) {
                    return;
                }


                settings.fadeInEnabled =
                    elements
                        .fadeInEnabled
                        .checked;


                renderSettings();

            }
        );


    elements.fadeOutEnabled
        .addEventListener(
            "change",
            () => {

                const settings =
                    getActiveSettings();


                if (!settings) {
                    return;
                }


                settings.fadeOutEnabled =
                    elements
                        .fadeOutEnabled
                        .checked;


                renderSettings();

            }
        );


    elements.fadeInDuration
        .addEventListener(
            "change",
            () => {

                const settings =
                    getActiveSettings();


                if (!settings) {
                    return;
                }


                settings.fadeInDuration =
                    readFadeDuration(
                        elements
                            .fadeInDuration,
                        settings.fadeInDuration
                    );


                renderSettings();

            }
        );


    elements.fadeOutDuration
        .addEventListener(
            "change",
            () => {

                const settings =
                    getActiveSettings();


                if (!settings) {
                    return;
                }


                settings.fadeOutDuration =
                    readFadeDuration(
                        elements
                            .fadeOutDuration,
                        settings.fadeOutDuration
                    );


                renderSettings();

            }
        );


    elements.outputFormat
        .addEventListener(
            "change",
            () => {

                const settings =
                    getActiveSettings();


                if (!settings) {
                    return;
                }


                settings.outputFormat =
                    elements
                        .outputFormat
                        .value;


                renderSettings();

            }
        );

    elements.skipWaveformToggle
        .addEventListener(
            "change",
            async () => {

                const timelineMode =
                    elements
                        .skipWaveformToggle
                        .checked;


                state.waveformMode =
                    timelineMode
                        ? "timeline"
                        : "waveform";


                renderWaveformDisplayMode();


                /*
                * =============================================
                * FAST TIMELINE
                * =============================================
                */
                if (
                    timelineMode
                ) {

                    elements.waveformMessage
                        .textContent =
                            "Fast timeline enabled. Waveform generation skipped.";


                    await cancelBackgroundWaveform();


                    return;

                }


                /*
                * =============================================
                * RETURN TO WAVEFORM
                * =============================================
                */

                const record =
                    getActiveRecord();


                if (
                    !record ||
                    state.duration <= 0
                ) {
                    return;
                }


                const cached =
                    state.waveformCache.get(
                        record.key
                    );


                if (
                    cached?.peaks
                ) {

                    state.waveformPeaks =
                        cached.peaks;


                    drawWaveform();

                    renderSelection();


                    elements.waveformMessage
                        .textContent =
                            "Drag the handles to choose the audio section.";


                    return;

                }


                if (record.file.size > MANUAL_WAVEFORM_MAX_BYTES ||
                    state.duration > MANUAL_WAVEFORM_MAX_SECONDS) {
                    state.waveformMode = "timeline";
                    renderWaveformDisplayMode();
                    elements.waveformMessage.textContent =
                        "Waveform preview is unavailable for this large file. Use the timeline and precise time inputs.";
                    return;
                }

                elements.waveformMessage.textContent = "Generating waveform... 0 s";

                queueWaveformGeneration(
                    record,
                    state.duration,
                    state.loadSerial
                );

            }
        );   

    document.addEventListener(
        "easyfiletools:operation-state-changed",
        event => {

            const detail =
                event.detail || {};


            if (
                detail.operationId !==
                "cut-audio"
            ) {
                return;
            }


            const locked =
                detail.status ===
                    "running" ||
                detail.status ===
                    "paused" ||
                detail.status ===
                    "cancelling";


            setOperationLocked(
                locked
            );

        }
    );

    state.audio
        .addEventListener(
            "timeupdate",
            () => {

                const settings =
                    getActiveSettings();


                if (
                    state.playbackMode ===
                        "selection" &&
                    settings &&
                    state.audio.currentTime >=
                        settings.end
                ) {

                    state.audio.pause();

                    state.audio.currentTime =
                        settings.end;

                    state.playbackMode =
                        null;

                    renderPlayerButtons();
                }


                updatePlayhead();

            }
        );


    state.audio
        .addEventListener(
            "play",
            renderPlayerButtons
        );


    state.audio
        .addEventListener(
            "pause",
            renderPlayerButtons
        );


    state.audio
        .addEventListener(
            "ended",
            () => {

                state.playbackMode =
                    null;

                renderPlayerButtons();

                updatePlayhead();

            }
        );


    document.addEventListener(
        "easyfiletools:storage-updated",
        async () => {

            console.log(
                "[CUT UI] Storage updated"
            );

            await refreshFiles();
        }
    );


    document.addEventListener(
        "easyfiletools:files-selected",
        async () => {

            console.log(
                "[CUT UI] Files selected"
            );

            await refreshFiles();
        }
    );


    document.addEventListener(
        "easyfiletools:files-cleared",
        () => {

            state.records =
                [];

            state.activeKey =
                null;

            state.settingsByKey.clear();

            state.waveformCache.clear();

            state.waveformBusyKeys.clear();

            state.waveformPeaks =
                null;

            renderFileSelect();

            resetEditor();

            updateConfiguredCounter();

            console.log(
                "[CUT UI] Files cleared"
            );
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (
                state.waveformPeaks
            ) {

                drawWaveform();

            } else {

                drawEmptyWaveform();

            }


            renderSelection();

        }
    );


    /* =====================================================
       OPTIONAL RESIZE OBSERVER
    ===================================================== */

    if (
        "ResizeObserver" in
        window
    ) {

        const resizeObserver =
            new ResizeObserver(
                () => {

                    if (
                        state.waveformPeaks
                    ) {

                        drawWaveform();

                    } else {

                        drawEmptyWaveform();

                    }


                    renderSelection();

                }
            );


        resizeObserver.observe(
            elements.waveformStage
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.CutAudioUI = {

        refreshFiles,

        getBatchItems,

        getAllRecords,

        getSettingsForKey,

        validateSettings,

        formatTime,

        parseTime,

        getSelectionDuration,

        getOutputDuration

    };


    /* =====================================================
       INIT
    ===================================================== */

    drawEmptyWaveform();

    refreshIcons();

    refreshFiles();

})();