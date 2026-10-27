console.log(
    "[AUDIO MERGER] audio-merger.js loaded"
);


/* =========================================================
   AUDIO MERGER ENGINE
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let currentFFmpeg =
        null;

    let currentProgressHandler =
        null;


    /* =====================================================
       HELPERS
    ===================================================== */

    function getFileExtension(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        if (
            dot === -1 ||
            dot ===
                filename.length - 1
        ) {

            return "";
        }


        return filename
            .slice(dot + 1)
            .toLowerCase();

    }


    function sanitizeFilename(
        value
    ) {

        return String(value)
            .replace(
                /[^a-zA-Z0-9._-]+/g,
                "_"
            )
            .replace(
                /_+/g,
                "_"
            );

    }


    function createUniqueId() {

        return (
            Date.now()
                .toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );

    }


    function ffmpegNumber(
        value
    ) {

        return Number(
            value
        )
            .toFixed(6)
            .replace(
                /0+$/,
                ""
            )
            .replace(
                /\.$/,
                ""
            );

    }


    /* =====================================================
       MIME TYPES
    ===================================================== */

    function getMimeType(
        extension
    ) {

        const map = {

            mp3:
                "audio/mpeg",

            wav:
                "audio/wav",

            flac:
                "audio/flac",

            aac:
                "audio/aac",

            m4a:
                "audio/mp4",

            ogg:
                "audio/ogg",

            opus:
                "audio/ogg",

            aiff:
                "audio/aiff",

            aif:
                "audio/aiff",

            wma:
                "audio/x-ms-wma",

            webm:
                "audio/webm"

        };


        return (
            map[extension] ||
            "application/octet-stream"
        );

    }


    /* =====================================================
       SHARED ENCODING PROFILES
    ===================================================== */

    const MERGE_SUPPORTED_OUTPUT_FORMATS =
        [
            "mp3",
            "wav",
            "flac",
            "aac",
            "m4a",
            "ogg",
            "opus",
            "aiff",
            "aif",
            "wma",
            "webm"
        ];


    function getMergeEncodingProfile(
        extension
    ) {

        const normalizedExtension =
            String(
                extension || ""
            )
                .trim()
                .toLowerCase();


        if (
            !MERGE_SUPPORTED_OUTPUT_FORMATS.includes(
                normalizedExtension
            )
        ) {

            throw new Error(
                `Output format .${normalizedExtension || "unknown"} is not supported by Merge Audio yet.`
            );

        }


        const profiles =
            globalThis
                .EasyFileAudioEncodingProfiles;


        if (
            !profiles ||
            typeof profiles.getProfile !==
                "function"
        ) {

            throw new Error(
                "Shared audio encoding profiles are not available."
            );

        }


        const profile =
            profiles.getProfile(
                normalizedExtension
            );


        if (!profile) {

            throw new Error(
                `No shared audio encoding profile is defined for .${normalizedExtension}.`
            );

        }


        return profile;

    }


    function getProfileForcedSampleRate(
        extension
    ) {

        const profile =
            getMergeEncodingProfile(
                extension
            );


        const index =
            profile.codecArgs
                .lastIndexOf(
                    "-ar"
                );


        if (
            index === -1 ||
            index + 1 >=
                profile.codecArgs.length
        ) {

            return null;

        }


        const value =
            Number(
                profile.codecArgs[
                    index + 1
                ]
            );


        return (
            Number.isFinite(value) &&
            value > 0
        )
            ? value
            : null;

    }


    /* =====================================================
       OUTPUT EXTENSION
    ===================================================== */

    function resolveOutputExtension(
        files,
        settings
    ) {

        if (
            settings.outputFormat !==
            "same"
        ) {

            return settings
                .outputFormat
                .toLowerCase();

        }


        const extensions =
            files.map(
                file =>
                    getFileExtension(
                        file.name
                    )
            );


        const first =
            extensions[0];


        if (
            !first ||
            !extensions.every(
                extension =>
                    extension === first
            )
        ) {

            throw new Error(
                "Same as source requires all files to use the same format."
            );

        }


        return first;

    }


    /* =====================================================
       FAST COPY
    ===================================================== */

    function canTryFastCopy(
        files,
        settings
    ) {

        if (
            settings.transition !==
                "none" ||
            settings.fadeInEnabled ||
            settings.fadeOutEnabled ||
            settings.outputFormat !==
                "same"
        ) {

            return false;
        }


        const extensions =
            files.map(
                file =>
                    getFileExtension(
                        file.name
                    )
            );


        if (
            extensions.length === 0 ||
            !extensions[0]
        ) {

            return false;
        }


        return extensions.every(
            extension =>
                extension ===
                extensions[0]
        );

    }


    function normalizeProbeString(
        value
    ) {

        if (
            value === undefined ||
            value === null
        ) {

            return null;
        }


        const normalized =
            String(value)
                .trim()
                .toLowerCase();


        return normalized || null;

    }


    function buildFastCopySignature(
        probe
    ) {

        return {

            formatName:
                normalizeProbeString(
                    probe?.formatName
                ),

            codecName:
                normalizeProbeString(
                    probe?.codecName
                ),

            codecProfile:
                normalizeProbeString(
                    probe?.codecProfile
                ),

            codecTag:
                normalizeProbeString(
                    probe?.codecTag
                ),

            sampleFormat:
                normalizeProbeString(
                    probe?.sampleFormat
                ),

            sampleRate:
                Number.isFinite(
                    probe?.sampleRate
                )
                    ? probe.sampleRate
                    : null,

            channels:
                Number.isFinite(
                    probe?.channels
                )
                    ? probe.channels
                    : null,

            channelLayout:
                normalizeProbeString(
                    probe?.channelLayout
                ),

            bitsPerSample:
                Number.isFinite(
                    probe?.bitsPerSample
                )
                    ? probe.bitsPerSample
                    : null,

            timeBase:
                normalizeProbeString(
                    probe?.timeBase
                ),

            extradataSize:
                Number.isFinite(
                    probe?.extradataSize
                )
                    ? probe.extradataSize
                    : null,

            extradataHash:
                normalizeProbeString(
                    probe?.extradataHash
                )

        };

    }


    const FAST_COPY_SIGNATURE_FIELDS = [

        "formatName",
        "codecName",
        "codecProfile",
        "codecTag",
        "sampleFormat",
        "sampleRate",
        "channels",
        "channelLayout",
        "bitsPerSample",
        "timeBase",
        "extradataSize",
        "extradataHash"

    ];


    function compareFastCopySignatures(
        reference,
        candidate
    ) {

        for (
            const field of
                FAST_COPY_SIGNATURE_FIELDS
        ) {

            if (
                reference[field] !==
                    candidate[field]
            ) {

                return {
                    compatible:
                        false,

                    field,

                    expected:
                        reference[field],

                    actual:
                        candidate[field]
                };

            }

        }


        return {
            compatible:
                true
        };

    }


    async function inspectFastCopyCompatibility(
        ffmpeg,
        inputNames,
        files,
        probeCollector = null
    ) {

        if (
            typeof probeAudioFile !==
                "function"
        ) {

            console.warn(
                "[AUDIO MERGER] Fast Merge disabled because FFprobe inspection is unavailable."
            );

            return false;
        }


        const signatures =
            [];


        for (
            let index = 0;
            index < inputNames.length;
            index++
        ) {

            try {

                const probe =
                    await probeAudioFile(
                        ffmpeg,
                        inputNames[index],
                        `Merge Audio Fast Merge inspection (${files[index]?.name || `file ${index + 1}`})`
                    );


                if (
                    Array.isArray(
                        probeCollector
                    )
                ) {

                    probeCollector.push(
                        probe
                    );

                }


                signatures.push(
                    buildFastCopySignature(
                        probe
                    )
                );

            }
            catch (error) {

                /*
                 * Do not reinterpret a user-triggered worker reset/cancel
                 * as a harmless compatibility miss.
                 */
                if (
                    currentFFmpeg !==
                        ffmpeg
                ) {

                    throw error;
                }


                console.warn(
                    "[AUDIO MERGER] Fast Merge disabled because one input could not be inspected reliably:",
                    files[index]?.name ||
                        inputNames[index],
                    error
                );


                return false;

            }

        }


        const reference =
            signatures[0];


        if (!reference) {

            return false;
        }


        for (
            let index = 1;
            index < signatures.length;
            index++
        ) {

            const comparison =
                compareFastCopySignatures(
                    reference,
                    signatures[index]
                );


            if (
                !comparison.compatible
            ) {

                console.info(
                    "[AUDIO MERGER] Fast Merge skipped: incompatible audio stream parameters.",
                    {
                        file:
                            files[index]?.name ||
                            inputNames[index],

                        field:
                            comparison.field,

                        referenceValue:
                            comparison.expected,

                        fileValue:
                            comparison.actual
                    }
                );


                return false;

            }

        }


        console.log(
            "[AUDIO MERGER] Fast Merge compatibility confirmed by FFprobe:",
            reference
        );


        return true;

    }


    /* =====================================================
       RE-ENCODE NORMALIZATION
    ===================================================== */

    const MP3_SAMPLE_RATES = [
        8000,
        11025,
        12000,
        16000,
        22050,
        24000,
        32000,
        44100,
        48000
    ];


    const AAC_SAMPLE_RATES = [
        7350,
        8000,
        11025,
        12000,
        16000,
        22050,
        24000,
        32000,
        44100,
        48000,
        64000,
        88200,
        96000
    ];


    const WMA_SAMPLE_RATES = [
        8000,
        11025,
        12000,
        16000,
        22050,
        24000,
        32000,
        44100,
        48000
    ];


    function nearestSupportedSampleRate(
        value,
        supportedRates
    ) {

        if (
            !Number.isFinite(value) ||
            !Array.isArray(supportedRates) ||
            supportedRates.length === 0
        ) {

            return null;
        }


        return supportedRates
            .slice()
            .sort(
                (left, right) => {

                    const leftDistance =
                        Math.abs(
                            left - value
                        );

                    const rightDistance =
                        Math.abs(
                            right - value
                        );


                    if (
                        leftDistance !==
                        rightDistance
                    ) {

                        return (
                            leftDistance -
                            rightDistance
                        );
                    }


                    /*
                     * When two rates are equally close, prefer the
                     * higher one so we do not throw away bandwidth
                     * unnecessarily.
                     */
                    return right - left;

                }
            )[0];

    }


    function mostCommonSampleRate(
        sampleRates
    ) {

        const counts =
            new Map();


        sampleRates.forEach(
            value => {

                counts.set(
                    value,
                    (
                        counts.get(value) ||
                        0
                    ) + 1
                );

            }
        );


        return Array.from(
            counts.entries()
        )
            .sort(
                (left, right) => {

                    if (
                        left[1] !==
                        right[1]
                    ) {

                        return (
                            right[1] -
                            left[1]
                        );
                    }


                    /*
                     * Equal occurrence count: prefer the higher rate.
                     */
                    return right[0] - left[0];

                }
            )[0]?.[0] ||
            null;

    }


    function chooseTargetSampleRate(
        probes,
        extension
    ) {

        /*
         * Respect any sample rate explicitly required by the shared
         * encoding profile. This currently carries the validated
         * ffmpeg.wasm/libopus 24 kHz compatibility rule, and keeps
         * Merge automatically aligned with future profile changes.
         */
        const forcedSampleRate =
            getProfileForcedSampleRate(
                extension
            );


        if (forcedSampleRate) {

            return forcedSampleRate;
        }


        const sampleRates =
            probes
                .map(
                    probe =>
                        Number(
                            probe?.sampleRate
                        )
                )
                .filter(
                    value =>
                        Number.isFinite(value) &&
                        value > 0
                );


        if (
            sampleRates.length === 0
        ) {

            return 44100;
        }


        /*
         * Use the most common source rate. This minimizes the number
         * of tracks that need resampling. If frequencies are tied,
         * prefer the higher one.
         */
        const preferredRate =
            mostCommonSampleRate(
                sampleRates
            ) ||
            44100;


        if (
            extension === "mp3"
        ) {

            return (
                nearestSupportedSampleRate(
                    preferredRate,
                    MP3_SAMPLE_RATES
                ) ||
                44100
            );
        }


        if (
            extension === "aac" ||
            extension === "m4a"
        ) {

            return (
                nearestSupportedSampleRate(
                    preferredRate,
                    AAC_SAMPLE_RATES
                ) ||
                44100
            );
        }


        if (
            extension === "wma"
        ) {

            return (
                nearestSupportedSampleRate(
                    preferredRate,
                    WMA_SAMPLE_RATES
                ) ||
                44100
            );
        }


        /*
         * WAV / FLAC / AIFF / Vorbis are allowed to preserve the
         * selected source rate directly. Reject absurd probe values
         * and fall back conservatively.
         */
        if (
            preferredRate >= 1000 &&
            preferredRate <= 384000
        ) {

            return preferredRate;
        }


        return 44100;

    }


    function normalizeChannelLayoutName(
        value
    ) {

        if (
            value === undefined ||
            value === null
        ) {

            return null;
        }


        const normalized =
            String(value)
                .trim()
                .toLowerCase();


        /*
         * Keep only FFmpeg channel-layout syntax characters that are
         * safe inside our filter graph.
         */
        if (
            !normalized ||
            !/^[a-z0-9.+_()\-]+$/.test(
                normalized
            )
        ) {

            return null;
        }


        return normalized;

    }


    function chooseTargetChannelLayout(
        probes,
        extension
    ) {

        const channels =
            probes
                .map(
                    probe =>
                        Number(
                            probe?.channels
                        )
                )
                .filter(
                    value =>
                        Number.isInteger(value) &&
                        value > 0
                );


        if (
            channels.length === 0
        ) {

            return "stereo";
        }


        const uniqueChannels =
            new Set(
                channels
            );


        /*
         * Mono/stereo-only encoders: never ask the encoder for an
         * unsupported multichannel layout.
         */
        const stereoLimited =
            extension === "mp3" ||
            extension === "wma" ||
            extension === "opus" ||
            extension === "webm";


        if (
            uniqueChannels.size === 1
        ) {

            const channelCount =
                channels[0];


            if (
                channelCount === 1
            ) {

                return "mono";
            }


            if (
                channelCount === 2
            ) {

                return "stereo";
            }


            if (
                !stereoLimited
            ) {

                const layouts =
                    probes
                        .map(
                            probe =>
                                normalizeChannelLayoutName(
                                    probe?.channelLayout
                                )
                        );


                if (
                    layouts.length > 0 &&
                    layouts[0] &&
                    layouts.every(
                        layout =>
                            layout ===
                            layouts[0]
                    )
                ) {

                    return layouts[0];
                }

            }

        }


        /*
         * Mixed channel counts/layouts: stereo preserves stereo
         * information while mono tracks can be safely upmixed.
         */
        return (
            channels.some(
                value =>
                    value > 1
            )
                ? "stereo"
                : "mono"
        );

    }


    function buildFallbackNormalization(
        extension
    ) {

        return {
            sampleRate:
                getProfileForcedSampleRate(
                    extension
                ) ||
                44100,

            channelLayout:
                "stereo",

            source:
                "fallback"
        };

    }


    function chooseReencodeNormalization(
        probes,
        extension
    ) {

        return {
            sampleRate:
                chooseTargetSampleRate(
                    probes,
                    extension
                ),

            channelLayout:
                chooseTargetChannelLayout(
                    probes,
                    extension
                ),

            source:
                "ffprobe"
        };

    }


    async function resolveReencodeNormalization(
        ffmpeg,
        inputNames,
        files,
        extension,
        cachedProbes = null
    ) {

        let probes =
            (
                Array.isArray(cachedProbes) &&
                cachedProbes.length ===
                    inputNames.length
            )
                ? cachedProbes
                : null;


        if (
            !probes
        ) {

            if (
                typeof probeAudioFile !==
                    "function"
            ) {

                console.warn(
                    "[AUDIO MERGER] FFprobe unavailable for re-encode normalization; using safe fallback target."
                );


                return buildFallbackNormalization(
                    extension
                );
            }


            probes = [];


            for (
                let index = 0;
                index < inputNames.length;
                index++
            ) {

                try {

                    probes.push(
                        await probeAudioFile(
                            ffmpeg,
                            inputNames[index],
                            `Merge Audio normalization (${files[index]?.name || `file ${index + 1}`})`
                        )
                    );

                }
                catch (error) {

                    if (
                        currentFFmpeg !==
                            ffmpeg
                    ) {

                        throw error;
                    }


                    console.warn(
                        "[AUDIO MERGER] Could not inspect every input for adaptive normalization; using safe fallback target.",
                        files[index]?.name ||
                            inputNames[index],
                        error
                    );


                    return buildFallbackNormalization(
                        extension
                    );

                }

            }

        }


        const normalization =
            chooseReencodeNormalization(
                probes,
                extension
            );


        console.log(
            "[AUDIO MERGER] Re-encode normalization selected:",
            {
                sampleRate:
                    normalization.sampleRate,

                channelLayout:
                    normalization.channelLayout,

                sourceSampleRates:
                    probes.map(
                        probe =>
                            probe?.sampleRate ??
                            null
                    ),

                sourceChannels:
                    probes.map(
                        probe =>
                            probe?.channels ??
                            null
                    )
            }
        );


        return normalization;

    }


    /* =====================================================
       FILTER GRAPH
    ===================================================== */

    function buildFilterGraph(
        fileCount,
        settings,
        normalization
    ) {

        const parts =
            [];


        const labels =
            [];


        const sampleRate =
            Number(
                normalization?.sampleRate
            );


        const channelLayout =
            normalizeChannelLayoutName(
                normalization?.channelLayout
            );


        if (
            !Number.isFinite(sampleRate) ||
            sampleRate <= 0 ||
            !channelLayout
        ) {

            throw new Error(
                "Invalid Merge Audio normalization target."
            );
        }


        /*
         * Normalize all sources to one common target required by
         * concat/acrossfade. The target itself is selected from the
         * real source streams instead of being hard-coded.
         */

        for (
            let index = 0;
            index < fileCount;
            index++
        ) {

            const label =
                `a${index}`;


            parts.push(
                `[${index}:a]` +
                    `aresample=${sampleRate},` +
                    `aformat=channel_layouts=${channelLayout},` +
                    `asetpts=N/SR/TB` +
                    `[${label}]`
            );


            labels.push(
                label
            );

        }


        let baseLabel =
            "";


        /* =========================
           NO TRANSITION
        ========================= */

        if (
            settings.transition ===
            "none"
        ) {

            const inputs =
                labels
                    .map(
                        label =>
                            `[${label}]`
                    )
                    .join("");


            parts.push(
                `${inputs}` +
                `concat=n=${fileCount}:v=0:a=1` +
                `[merged]`
            );


            baseLabel =
                "merged";

        }


        /* =========================
           SILENCE
        ========================= */

        else if (
            settings.transition ===
            "silence"
        ) {

            const sequence =
                [];


            labels.forEach(
                (
                    label,
                    index
                ) => {

                    sequence.push(
                        `[${label}]`
                    );


                    if (
                        index <
                        labels.length - 1
                    ) {

                        const silenceLabel =
                            `silence${index}`;


                        parts.push(
                            `anullsrc=` +
                            `r=${sampleRate}:` +
                            `cl=${channelLayout}:` +
                            `d=${ffmpegNumber(settings.silenceDuration)}` +
                            `[${silenceLabel}]`
                        );


                        sequence.push(
                            `[${silenceLabel}]`
                        );

                    }

                }
            );


            parts.push(
                `${sequence.join("")}` +
                `concat=n=${sequence.length}:v=0:a=1` +
                `[merged]`
            );


            baseLabel =
                "merged";

        }


        /* =========================
           CROSSFADE
        ========================= */

        else if (
            settings.transition ===
            "crossfade"
        ) {

            let previous =
                labels[0];


            for (
                let index = 1;
                index < labels.length;
                index++
            ) {

                const outputLabel =
                    index ===
                        labels.length - 1
                        ? "merged"
                        : `cross${index}`;


                parts.push(
                    `[${previous}]` +
                    `[${labels[index]}]` +
                    `acrossfade=` +
                    `d=${ffmpegNumber(settings.crossfadeDuration)}:` +
                    `c1=tri:c2=tri` +
                    `[${outputLabel}]`
                );


                previous =
                    outputLabel;

            }


            baseLabel =
                "merged";

        }


        else {

            throw new Error(
                "Unknown merge transition."
            );

        }


        /* =========================
           FINAL FADES
        ========================= */

        const finalFilters =
            [];


        if (
            settings.fadeInEnabled
        ) {

            finalFilters.push(
                `afade=` +
                `t=in:` +
                `st=0:` +
                `d=${ffmpegNumber(settings.fadeInDuration)}`
            );

        }


        if (
            settings.fadeOutEnabled
        ) {

            const outputDuration =
                Number(
                    settings
                        .estimatedOutputDuration
                );


            if (
                !Number.isFinite(
                    outputDuration
                ) ||
                outputDuration <= 0
            ) {

                throw new Error(
                    "Output duration is required for Fade Out."
                );

            }


            const fadeStart =
                Math.max(
                    0,
                    outputDuration -
                    settings
                        .fadeOutDuration
                );


            finalFilters.push(
                `afade=` +
                `t=out:` +
                `st=${ffmpegNumber(fadeStart)}:` +
                `d=${ffmpegNumber(settings.fadeOutDuration)}`
            );

        }


        let outputLabel =
            baseLabel;


        if (
            finalFilters.length > 0
        ) {

            parts.push(
                `[${baseLabel}]` +
                `${finalFilters.join(",")}` +
                `[outa]`
            );


            outputLabel =
                "outa";

        }


        return {

            graph:
                parts.join(";"),

            outputLabel

        };

    }


    /* =====================================================
       RE-ENCODE ARGS
    ===================================================== */

    function buildReencodeArgs(
        inputNames,
        outputName,
        extension,
        settings,
        normalization
    ) {

        const encodingProfile =
            getMergeEncodingProfile(
                extension
            );


        const args =
            [];


        inputNames.forEach(
            inputName => {

                args.push(
                    "-i",
                    inputName
                );

            }
        );


        const filter =
            buildFilterGraph(
                inputNames.length,
                settings,
                normalization
            );


        args.push(
            "-filter_complex",
            filter.graph,

            "-map",
            `[${filter.outputLabel}]`,

            "-vn",

            ...encodingProfile.codecArgs,

            ...encodingProfile.muxerArgs,

            outputName
        );


        return args;

    }


    /* =====================================================
       TEMP FILES
    ===================================================== */

    async function deleteTempFile(
        ffmpeg,
        filename
    ) {

        if (
            !ffmpeg ||
            !filename
        ) {
            return;
        }


        try {

            if (
                typeof ffmpeg.deleteFile ===
                "function"
            ) {

                await ffmpeg.deleteFile(
                    filename
                );

            }

        }
        catch (_) {

            // Cleanup must never break merge.

        }

    }


    async function prepareMergeInputs(
        ffmpeg,
        files,
        uniqueId
    ) {

        if (
            typeof prepareFFmpegInputFiles !==
                "function"
        ) {

            throw new Error(
                "Memory-efficient FFmpeg input preparation is not available."
            );

        }


        const entries =
            files.map(
                (file, index) => {

                    const extension =
                        getFileExtension(
                            file.name
                        ) ||
                        "bin";


                    return {
                        file,

                        name:
                            sanitizeFilename(
                                `merge_input_${index}_${uniqueId}.${extension}`
                            )
                    };
                }
            );


        return await prepareFFmpegInputFiles(
            ffmpeg,
            entries,
            {
                label:
                    "Merge Audio inputs",

                mountLabel:
                    `merge_${uniqueId}`
            }
        );

    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function attachProgress(
        ffmpeg,
        callback
    ) {

        if (
            !callback ||
            typeof ffmpeg.on !==
                "function"
        ) {

            return null;
        }


        const handler =
            event => {

                const progress =
                    Number.isFinite(
                        event.progress
                    )
                        ? event.progress
                        : 0;


                callback(
                    Math.max(
                        0,
                        Math.min(
                            1,
                            progress
                        )
                    )
                );

            };


        ffmpeg.on(
            "progress",
            handler
        );


        currentProgressHandler =
            handler;


        return handler;

    }


    function detachProgress(
        ffmpeg,
        handler
    ) {

        if (
            !ffmpeg ||
            !handler
        ) {
            return;
        }


        try {

            if (
                typeof ffmpeg.off ===
                "function"
            ) {

                ffmpeg.off(
                    "progress",
                    handler
                );

            }

        }
        catch (_) {
            // Ignore
        }


        if (
            currentProgressHandler ===
            handler
        ) {

            currentProgressHandler =
                null;

        }

    }


    /* =====================================================
       FAST CONCAT
    ===================================================== */

    async function runFastConcat(
        ffmpeg,
        inputNames,
        outputName,
        listName
    ) {

        const listContent =
            inputNames
                .map(
                    name =>
                        `file '${name}'`
                )
                .join("\n");


        await ffmpeg.writeFile(
            listName,
            new TextEncoder()
                .encode(
                    listContent
                )
        );


        const args = [

            "-f",
            "concat",

            "-safe",
            "0",

            "-i",
            listName,

            "-vn",

            "-c:a",
            "copy",

            "-avoid_negative_ts",
            "make_zero",

            outputName

        ];


        console.log(
            "[AUDIO MERGER] Fast FFmpeg:",
            args.join(" ")
        );


        await execFFmpegOrThrow(
            ffmpeg,
            args,
            "Fast audio merge"
        );

    }


    /* =====================================================
       OUTPUT VALIDATION
    ===================================================== */

    async function readMergeOutputOrThrow(
        ffmpeg,
        outputName,
        label = "Audio merge output"
    ) {

        const outputData =
            await ffmpeg.readFile(
                outputName
            );


        const bytes =
            outputData instanceof Uint8Array
                ? outputData
                : new Uint8Array(
                    outputData
                );


        if (
            bytes.byteLength === 0
        ) {

            throw new Error(
                `${label} is empty.`
            );

        }


        return bytes;

    }


    function wasMergeInterrupted(
        ffmpeg
    ) {

        return (
            currentFFmpeg !==
                ffmpeg
        );

    }


    /* =====================================================
       MAIN MERGE
    ===================================================== */

    async function mergeFiles(
        files,
        settings,
        options = {}
    ) {

        if (
            !Array.isArray(files) ||
            files.length < 2
        ) {

            throw new Error(
                "Merge Audio requires at least two files."
            );

        }


        if (
            typeof getFFmpeg !==
            "function"
        ) {

            throw new Error(
                "FFmpeg loader is not available."
            );

        }


        const extension =
            resolveOutputExtension(
                files,
                settings
            );


        const uniqueId =
            createUniqueId();


        const outputName =
            sanitizeFilename(
                `merged_audio_${uniqueId}.${extension}`
            );


        const finalDownloadName =
            sanitizeFilename(
                `merged_audio.${extension}`
            );


        const listName =
            sanitizeFilename(
                `merge_list_${uniqueId}.txt`
            );


        let ffmpeg =
            await getFFmpeg();


        currentFFmpeg =
            ffmpeg;


        let inputNames =
            [];


        let inputHandle =
            null;


        let progressHandler =
            null;


        let usedFastCopy =
            false;


        let outputData =
            null;


        const fastCopyProbes =
            [];


        let reencodeNormalization =
            null;


        try {

            inputHandle =
                await prepareMergeInputs(
                    ffmpeg,
                    files,
                    uniqueId
                );


            inputNames =
                inputHandle.paths;


            let fastCopyCompatible =
                false;


            if (
                canTryFastCopy(
                    files,
                    settings
                )
            ) {

                fastCopyCompatible =
                    await inspectFastCopyCompatibility(
                        ffmpeg,
                        inputNames,
                        files,
                        fastCopyProbes
                    );

            }


            if (
                !fastCopyCompatible
            ) {

                reencodeNormalization =
                    await resolveReencodeNormalization(
                        ffmpeg,
                        inputNames,
                        files,
                        extension,
                        fastCopyProbes
                    );

            }


            progressHandler =
                attachProgress(
                    ffmpeg,
                    options.onProgress
                );


            /* =========================
               FAST COPY ATTEMPT
            ========================= */

            if (
                fastCopyCompatible
            ) {

                try {

                    options.onProgress?.(
                        0
                    );


                    await runFastConcat(
                        ffmpeg,
                        inputNames,
                        outputName,
                        listName
                    );


                    /*
                     * A zero FFmpeg exit code is necessary but not enough:
                     * verify that the fast path actually produced a readable,
                     * non-empty file before declaring success.
                     */
                    outputData =
                        await readMergeOutputOrThrow(
                            ffmpeg,
                            outputName,
                            "Fast Merge output"
                        );


                    usedFastCopy =
                        true;

                }
                catch (fastError) {

                    /*
                     * Pause/Cancel replaces or terminates the current worker.
                     * That is an intentional interruption, not a failed
                     * Fast Merge and must never trigger a re-encode fallback.
                     */
                    if (
                        wasMergeInterrupted(
                            ffmpeg
                        )
                    ) {

                        throw fastError;

                    }


                    console.warn(
                        "[AUDIO MERGER] Fast Merge failed. Starting clean re-encode fallback:",
                        fastError
                    );


                    detachProgress(
                        ffmpeg,
                        progressHandler
                    );


                    progressHandler =
                        null;


                    /*
                     * Release the browser-file mount before replacing
                     * the worker. The release helper is cleanup-safe.
                     */
                    if (
                        typeof releaseFFmpegInputFiles ===
                            "function"
                    ) {

                        await releaseFFmpegInputFiles(
                            inputHandle
                        );

                    }


                    inputHandle =
                        null;


                    /*
                     * Always restart from a clean FFmpeg filesystem after
                     * a failed Fast Merge. This removes any partial concat
                     * list/output and avoids carrying decoder/muxer state
                     * into the fallback attempt.
                     */
                    if (
                        typeof resetFFmpeg ===
                        "function"
                    ) {

                        await resetFFmpeg();

                    }


                    ffmpeg =
                        await getFFmpeg();


                    currentFFmpeg =
                        ffmpeg;


                    inputHandle =
                        await prepareMergeInputs(
                            ffmpeg,
                            files,
                            uniqueId
                        );


                    inputNames =
                        inputHandle.paths;


                    reencodeNormalization =
                        await resolveReencodeNormalization(
                            ffmpeg,
                            inputNames,
                            files,
                            extension,
                            fastCopyProbes
                        );


                    progressHandler =
                        attachProgress(
                            ffmpeg,
                            options.onProgress
                        );


                    const args =
                        buildReencodeArgs(
                            inputNames,
                            outputName,
                            extension,
                            settings,
                            reencodeNormalization
                        );


                    console.log(
                        "[AUDIO MERGER] Fallback FFmpeg:",
                        args.join(" ")
                    );


                    options.onProgress?.(
                        0
                    );


                    await execFFmpegOrThrow(
                        ffmpeg,
                        args,
                        "Audio merge fallback re-encode"
                    );


                    outputData =
                        await readMergeOutputOrThrow(
                            ffmpeg,
                            outputName,
                            "Fallback re-encode output"
                        );

                }

            }


            /* =========================
               NORMAL RE-ENCODE
            ========================= */

            else {

                const args =
                    buildReencodeArgs(
                        inputNames,
                        outputName,
                        extension,
                        settings,
                        reencodeNormalization
                    );


                console.log(
                    "[AUDIO MERGER] FFmpeg:",
                    args.join(" ")
                );


                options.onProgress?.(
                    0
                );


                await execFFmpegOrThrow(
                    ffmpeg,
                    args,
                    "Audio merge re-encode"
                );


                outputData =
                    await readMergeOutputOrThrow(
                        ffmpeg,
                        outputName,
                        "Audio merge output"
                    );

            }


            options.onProgress?.(
                1
            );


            const blob =
                new Blob(
                    [
                        outputData
                    ],
                    {
                        type:
                            getMimeType(
                                extension
                            )
                    }
                );


            return {

                blob,

                outputName:
                    finalDownloadName,

                outputFormat:
                    extension,

                outputSize:
                    blob.size,

                fastCopy:
                    usedFastCopy

            };

        }
        finally {

            detachProgress(
                ffmpeg,
                progressHandler
            );


            if (
                typeof releaseFFmpegInputFiles ===
                    "function"
            ) {

                await releaseFFmpegInputFiles(
                    inputHandle
                );

            }


            await deleteTempFile(
                ffmpeg,
                listName
            );


            await deleteTempFile(
                ffmpeg,
                outputName
            );


            currentFFmpeg =
                null;

        }

    }


    /* =====================================================
       CANCEL CURRENT MERGE
    ===================================================== */

    async function cancelCurrent() {

        const ffmpeg =
            currentFFmpeg;


        if (!ffmpeg) {
            return;
        }


        if (
            typeof resetFFmpeg ===
            "function"
        ) {

            await resetFFmpeg();


            currentFFmpeg =
                null;


            return;
        }


        if (
            typeof ffmpeg.terminate ===
            "function"
        ) {

            ffmpeg.terminate();


            currentFFmpeg =
                null;

        }

    }


    /* =====================================================
       PUBLIC
    ===================================================== */

    window.AudioMerger = {

        mergeFiles,

        cancelCurrent,

        canTryFastCopy,

        getFileExtension,

        getMimeType

    };

})();