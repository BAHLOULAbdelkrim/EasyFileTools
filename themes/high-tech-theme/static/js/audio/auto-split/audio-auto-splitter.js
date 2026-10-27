console.log(
    "[AUTO SPLITTER] audio-auto-splitter.js loaded"
);


(() => {

    "use strict";


    const state = {

        running: false,

        paused: false,

        cancelled: false,

        currentIndex: -1,

        resumeResolver: null,

        ffmpegExecuting: false,

        ffmpegResetPromise: null

    };


    /*
     * Auto Split used to execute FFmpeg once per output segment.
     * We now group consecutive segments and let FFmpeg's segment
     * muxer create several outputs during one execution.
     *
     * The batch limits deliberately cap the number/duration of
     * outputs kept in MEMFS at once while still removing most of
     * the per-segment FFmpeg startup overhead.
     */
    const MAX_SEGMENTS_PER_BATCH =
        12;


    const MAX_BATCH_DURATION_SECONDS =
        20 * 60;


    /*
     * Keep the FFmpeg virtual filesystem bounded even when the
     * requested output is much larger than the source (WAV is the
     * classic example).  This is an estimate, not a hard file-size
     * limit: one individual segment is never split again just to fit
     * this budget.
     */
    const MAX_BATCH_ESTIMATED_OUTPUT_BYTES =
        96 * 1024 * 1024;


    function extractFile(item) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function extensionOf(name) {

        const dot =
            name.lastIndexOf(".");


        return dot >= 0
            ? name
                .slice(dot + 1)
                .toLowerCase()
            : "";

    }


    function baseName(name) {

        const dot =
            name.lastIndexOf(".");


        return dot > 0
            ? name.slice(0, dot)
            : name;

    }


    function mimeFor(ext) {

        const map = {

            mp3: "audio/mpeg",
            wav: "audio/wav",
            flac: "audio/flac",
            aac: "audio/aac",
            m4a: "audio/mp4",
            ogg: "audio/ogg",
            opus: "audio/ogg"

        };


        return map[ext] ||
            "application/octet-stream";

    }

    async function prepareSplitInput(
        ffmpeg,
        file,
        inputName,
        mountPoint
    ) {

        if (
            typeof prepareFFmpegInputFiles !==
                "function"
        ) {

            throw new Error(
                "Memory-efficient FFmpeg input preparation is not available."
            );

        }


        return await prepareFFmpegInputFiles(
            ffmpeg,
            [
                {
                    file,
                    name:
                        inputName
                }
            ],
            {
                label:
                    "Auto Split input",

                mountPoint
            }
        );

    }

    function getSharedEncodingProfile(
        format
    ) {

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
                format
            );


        if (!profile) {

            throw new Error(
                `No shared audio encoding profile is defined for .${String(format || "unknown").toLowerCase()}.`
            );

        }


        return profile;

    }


    function buildSegmentMuxerConfig(
        format
    ) {

        const profile =
            getSharedEncodingProfile(
                format
            );


        const muxerArgs =
            Array.isArray(
                profile.muxerArgs
            )
                ? profile.muxerArgs
                : [];


        let segmentFormat =
            null;


        const segmentOptions =
            [];


        for (
            let index = 0;
            index < muxerArgs.length;
            index += 1
        ) {

            const option =
                muxerArgs[index];


            const value =
                muxerArgs[index + 1];


            if (
                option === "-f" &&
                value !== undefined
            ) {

                segmentFormat =
                    String(
                        value
                    );

                index += 1;
                continue;

            }


            if (
                typeof option ===
                    "string" &&
                option.startsWith(
                    "-"
                ) &&
                value !== undefined
            ) {

                segmentOptions.push(
                    `${option.replace(/^-+/, "")}=${String(value)}`
                );

                index += 1;

            }

        }


        return {
            codecArgs: [
                ...profile.codecArgs
            ],

            segmentFormat,

            segmentFormatOptions:
                segmentOptions.length > 0
                    ? segmentOptions.join(
                        ":"
                    )
                    : null
        };

    }


    function sourceDurationFromSegments(
        segments
    ) {

        if (
            !Array.isArray(segments) ||
            segments.length === 0
        ) {

            return 0;

        }


        const first =
            Number(
                segments[0]?.start
            ) || 0;


        const last =
            Number(
                segments[
                    segments.length - 1
                ]?.end
            ) || 0;


        return Math.max(
            0,
            last - first
        );

    }


    function estimateOutputBytesPerSecond(
        file,
        segments,
        settings
    ) {

        const duration =
            sourceDurationFromSegments(
                segments
            );


        const sourceAverage =
            duration > 0 &&
            Number.isFinite(file?.size) &&
            file.size > 0
                ? file.size / duration
                : 0;


        if (
            settings.outputFormat ===
            "same"
        ) {

            /*
             * Stream copy keeps roughly the source byte rate.
             * Add headroom for local VBR peaks and container overhead.
             */
            return Math.max(
                32 * 1024,
                sourceAverage * 1.5
            );

        }


        const outputExt =
            String(
                settings.outputFormat ||
                ""
            ).toLowerCase();


        const conservativeRates = {

            mp3: 48 * 1024,
            aac: 40 * 1024,
            m4a: 40 * 1024,
            ogg: 48 * 1024,
            opus: 32 * 1024,

            /*
             * Lossless / PCM outputs can be much larger than a
             * compressed source.  These deliberately conservative
             * rates keep the batch FS footprint bounded without
             * requiring another probe pass.
             */
            flac: 512 * 1024,
            wav: 768 * 1024

        };


        return conservativeRates[
            outputExt
        ] || Math.max(
            128 * 1024,
            sourceAverage * 2
        );

    }


    function estimatedBatchOutputBytes(
        batch,
        bytesPerSecond
    ) {

        if (
            !Array.isArray(batch) ||
            batch.length === 0
        ) {

            return 0;

        }


        const duration =
            Math.max(
                0,
                Number(
                    batch[
                        batch.length - 1
                    ]?.end
                ) -
                Number(
                    batch[0]?.start
                )
            );


        return duration *
            bytesPerSecond;

    }


    function buildExportBatches(
        segments,
        estimatedBytesPerSecond
    ) {

        const batches = [];
        let current = [];


        const bytesPerSecond =
            Number.isFinite(
                estimatedBytesPerSecond
            ) &&
            estimatedBytesPerSecond > 0
                ? estimatedBytesPerSecond
                : 128 * 1024;


        for (
            const segment of segments
        ) {

            if (
                current.length === 0
            ) {

                current.push(
                    segment
                );

                continue;

            }


            const candidate = [
                ...current,
                segment
            ];


            const candidateDuration =
                segment.end -
                current[0].start;


            const candidateEstimatedBytes =
                estimatedBatchOutputBytes(
                    candidate,
                    bytesPerSecond
                );


            if (
                current.length >=
                    MAX_SEGMENTS_PER_BATCH ||
                candidateDuration >
                    MAX_BATCH_DURATION_SECONDS ||
                candidateEstimatedBytes >
                    MAX_BATCH_ESTIMATED_OUTPUT_BYTES
            ) {

                batches.push(
                    current
                );


                current = [
                    segment
                ];

            }
            else {

                current.push(
                    segment
                );

            }

        }


        if (
            current.length > 0
        ) {

            batches.push(
                current
            );

        }


        return batches;

    }


    function safeTimestamp(
        value
    ) {

        return Number(
            Number(
                value
            ).toFixed(
                6
            )
        );

    }


    function emit(
        name,
        detail = {}
    ) {

        document.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail
                }
            )
        );

    }


    async function checkpoint() {

        if (
            state.cancelled
        ) {

            throw new Error(
                "AUTO_SPLIT_CANCELLED"
            );

        }


        if (
            state.paused
        ) {

            await new Promise(
                resolve => {

                    state.resumeResolver =
                        resolve;

                }
            );

        }


        if (
            state.cancelled
        ) {

            throw new Error(
                "AUTO_SPLIT_CANCELLED"
            );

        }

    }

    async function runFFmpegExec(
        ffmpeg,
        args,
        options = {}
    ) {

        const onRetry =
            typeof options.onRetry ===
                "function"
                ? options.onRetry
                : null;


        while (true) {

            await checkpoint();


            try {

                state.ffmpegExecuting =
                    true;


                await execFFmpegOrThrow(
                    ffmpeg,
                    args,
                    options.label ||
                        "Auto Split processing"
                );


                state.ffmpegExecuting =
                    false;


                return ffmpeg;

            }
            catch (error) {

                state.ffmpegExecuting =
                    false;


                if (
                    state.cancelled
                ) {

                    throw new Error(
                        "AUTO_SPLIT_CANCELLED"
                    );

                }


                if (
                    state.paused
                ) {

                    await checkpoint();


                    if (
                        state.ffmpegResetPromise
                    ) {

                        try {

                            await state
                                .ffmpegResetPromise;

                        }
                        catch (_) {}


                        state.ffmpegResetPromise =
                            null;

                    }


                    ffmpeg =
                        await getFFmpeg();


                    if (
                        onRetry
                    ) {

                        await onRetry(
                            ffmpeg
                        );

                    }


                    continue;

                }


                throw error;

            }

        }

    }

    function parseDuration(
        message
    ) {

        const match =
            message.match(
                /Duration:\s*(\d+):(\d+):([\d.]+)/
            );


        if (!match) {
            return null;
        }


        return (
            Number(match[1]) * 3600 +
            Number(match[2]) * 60 +
            Number(match[3])
        );

    }


    async function detectSilences(
        inputName,
        restoreInput,
        settings
    ) {

        let ffmpeg =
            await getFFmpeg();


        const silences =
            [];


        let pendingStart =
            null;


        let duration =
            null;


        const logHandler =
            ({ message }) => {

                const parsedDuration =
                    parseDuration(
                        message
                    );


                if (
                    parsedDuration &&
                    !duration
                ) {

                    duration =
                        parsedDuration;

                }


                const start =
                    message.match(
                        /silence_start:\s*([\d.]+)/
                    );


                if (start) {

                    pendingStart =
                        Number(
                            start[1]
                        );

                }


                const end =
                    message.match(
                        /silence_end:\s*([\d.]+)/
                    );


                if (
                    end &&
                    pendingStart !== null
                ) {

                    silences.push({

                        start:
                            pendingStart,

                        end:
                            Number(
                                end[1]
                            )

                    });


                    pendingStart =
                        null;

                }

            };


        const attachLogHandler =
            targetFFmpeg => {

                targetFFmpeg.on(
                    "log",
                    logHandler
                );

            };


        attachLogHandler(
            ffmpeg
        );


        try {

            ffmpeg =
                await runFFmpegExec(
                    ffmpeg,
                    [

                        "-i",
                        inputName,

                        "-af",
                        `silencedetect=noise=${settings.thresholdDb}dB:d=${settings.minSilence}`,

                        "-f",
                        "null",

                        "-"

                    ],
                    {

                        label:
                            "Auto Split silence detection",

                        async onRetry(
                            retryFFmpeg
                        ) {

                            /*
                            * resetFFmpeg() creates a
                            * fresh virtual filesystem.
                            *
                            * Restore the source only
                            * when a retry is actually
                            * necessary.
                            */

                            await restoreInput(
                                retryFFmpeg
                            );


                            attachLogHandler(
                                retryFFmpeg
                            );

                        }

                    }
                );

        }
        finally {

            try {

                ffmpeg.off?.(
                    "log",
                    logHandler
                );

            }
            catch (_) {}

        }


        if (
            pendingStart !== null &&
            duration
        ) {

            silences.push({

                start:
                    pendingStart,

                end:
                    duration

            });

        }


        if (
            !duration ||
            !Number.isFinite(
                duration
            )
        ) {

            throw new Error(
                "Unable to determine audio duration."
            );

        }


        return {

            duration,

            silences

        };

    }


    function buildSegments(
        detection,
        minSegment
    ) {

        const {
            duration,
            silences
        } =
            detection;


        const segments =
            [];


        let currentStart =
            0;


        const epsilon =
            0.01;


        silences.forEach(
            silence => {

                const silenceStart =
                    Math.max(
                        0,
                        Number(
                            silence.start
                        ) || 0
                    );


                const silenceEnd =
                    Math.min(
                        duration,
                        Number(
                            silence.end
                        ) || 0
                    );


                if (
                    silenceEnd <=
                    silenceStart
                ) {

                    return;

                }


                /*
                * Do not split inside leading
                * silence.
                *
                * Auto Split must preserve the
                * complete source audio.
                */

                if (
                    silenceStart <=
                    currentStart +
                        epsilon
                ) {

                    return;

                }


                /*
                * Do not create a new segment
                * from trailing silence.
                */

                if (
                    silenceEnd >=
                    duration -
                        epsilon
                ) {

                    return;

                }


                /*
                * Split exactly in the middle
                * of the detected silence.
                *
                * No part of the source audio
                * is removed.
                */

                const cutPoint =
                    (
                        silenceStart +
                        silenceEnd
                    ) / 2;


                const segmentDuration =
                    cutPoint -
                    currentStart;


                const remainingDuration =
                    duration -
                    cutPoint;


                /*
                * Respect minimum segment
                * duration on both sides.
                */

                if (
                    segmentDuration <
                        minSegment ||
                    remainingDuration <
                        minSegment
                ) {

                    return;

                }


                segments.push(
                    {

                        start:
                            currentStart,

                        end:
                            cutPoint,

                        duration:
                            segmentDuration

                    }
                );


                currentStart =
                    cutPoint;

            }
        );


        /*
        * Final segment.
        */

        const remaining =
            duration -
            currentStart;


        if (
            remaining > 0
        ) {

            if (
                remaining >=
                    minSegment ||
                segments.length === 0
            ) {

                segments.push(
                    {

                        start:
                            currentStart,

                        end:
                            duration,

                        duration:
                            remaining

                    }
                );

            }
            else {

                /*
                * Safety:
                * attach a tiny final fragment
                * to the previous segment.
                */

                const previous =
                    segments[
                        segments.length - 1
                    ];


                previous.end =
                    duration;


                previous.duration =
                    previous.end -
                    previous.start;

            }

        }


        return segments;

    }


    async function readOutputBlobAndDelete(
        ffmpeg,
        outputNameFs,
        outputExt,
        label
    ) {

        let data = null;


        try {

            data =
                await ffmpeg.readFile(
                    outputNameFs
                );


            if (
                !data ||
                !data.byteLength
            ) {

                throw new Error(
                    `${label} is empty: ${outputNameFs}`
                );

            }


            return new Blob(
                [data],
                {
                    type:
                        mimeFor(
                            outputExt
                        )
                }
            );

        }
        finally {

            /*
             * The Uint8Array returned by readFile is only needed long
             * enough to construct the Blob.  Drop the JS reference and
             * remove the MEMFS file immediately so the next output does
             * not stack on top of it.
             */
            data = null;


            try {

                await ffmpeg.deleteFile(
                    outputNameFs
                );

            }
            catch (_) {}

        }

    }


    function disposeUncommittedResults(
        results
    ) {

        if (
            !Array.isArray(results)
        ) {

            return;

        }


        for (
            const result of results
        ) {

            const outputUrl =
                result?.outputUrl;


            if (
                typeof outputUrl ===
                    "string" &&
                outputUrl.startsWith(
                    "blob:"
                )
            ) {

                try {

                    URL.revokeObjectURL(
                        outputUrl
                    );

                }
                catch (_) {}

            }


            if (
                result &&
                typeof result ===
                    "object"
            ) {

                result.outputUrl =
                    null;

                result.blob =
                    null;

            }

        }

    }


    async function exportSegment(
        file,
        inputName,
        restoreInput,
        sourceIndex,
        segment,
        segmentIndex,
        settings
    ) {

        let ffmpeg =
            await getFFmpeg();


        const inputExt =
            extensionOf(
                file.name
            );


        const outputExt =
            settings.outputFormat ===
                "same"
                ? inputExt
                : settings.outputFormat;


        const outputNameFs =
            `split_${sourceIndex}_${segmentIndex}.${outputExt}`;


        const outputName =
            `${
                baseName(
                    file.name
                )
            }-part-${
                String(
                    segmentIndex + 1
                ).padStart(
                    2,
                    "0"
                )
            }.${outputExt}`;


        const args = [

            "-ss",
            String(
                segment.start
            ),

            "-i",
            inputName,

            "-t",
            String(
                segment.duration
            ),

            "-vn"

        ];


        if (
            settings.outputFormat ===
            "same"
        ) {

            args.push(
                "-c:a",
                "copy"
            );

        }
        else {

            const encodingProfile =
                getSharedEncodingProfile(
                    outputExt
                );


            args.push(
                ...encodingProfile.codecArgs,
                ...encodingProfile.muxerArgs
            );

        }


        args.push(
            outputNameFs
        );


        ffmpeg =
            await runFFmpegExec(
                ffmpeg,
                args,
                {

                    label:
                        "Auto Split segment export",

                    async onRetry(
                        retryFFmpeg
                    ) {

                        /*
                        * Only needed after
                        * resetFFmpeg().
                        */

                        await restoreInput(
                            retryFFmpeg
                        );

                    }

                }
            );


        const blob =
            await readOutputBlobAndDelete(
                ffmpeg,
                outputNameFs,
                outputExt,
                "Auto Split segment output"
            );


        return {

            blob,

            outputUrl:
                URL.createObjectURL(
                    blob
                ),

            outputName,

            outputFormat:
                outputExt,

            outputSize:
                blob.size,

            start:
                segment.start,

            end:
                segment.end,

            duration:
                segment.duration

        };

    }


    async function cleanupBatchOutputs(
        ffmpeg,
        prefix,
        outputExt,
        count
    ) {

        if (!ffmpeg) {
            return;
        }


        for (
            let index = 0;
            index < count;
            index++
        ) {

            const name =
                `${prefix}${
                    String(index)
                        .padStart(
                            3,
                            "0"
                        )
                }.${outputExt}`;


            try {

                await ffmpeg.deleteFile(
                    name
                );

            }
            catch (_) {}

        }

    }


    async function exportSegmentBatch(
        file,
        inputName,
        restoreInput,
        sourceIndex,
        batchSegments,
        firstSegmentIndex,
        batchIndex,
        settings,
        onProgress
    ) {

        let ffmpeg =
            await getFFmpeg();


        const inputExt =
            extensionOf(
                file.name
            );


        const outputExt =
            settings.outputFormat ===
                "same"
                ? inputExt
                : settings.outputFormat;


        const firstSegment =
            batchSegments[0];


        const lastSegment =
            batchSegments[
                batchSegments.length - 1
            ];


        const batchStart =
            safeTimestamp(
                firstSegment.start
            );


        const batchDuration =
            safeTimestamp(
                lastSegment.end -
                firstSegment.start
            );


        const relativeCuts =
            batchSegments
                .slice(
                    0,
                    -1
                )
                .map(
                    segment =>
                        safeTimestamp(
                            segment.end -
                            firstSegment.start
                        )
                );


        const outputPrefix =
            `split_${sourceIndex}_batch_${batchIndex}_`;


        const outputPattern =
            `${outputPrefix}%03d.${outputExt}`;


        const args = [

            "-ss",
            String(
                batchStart
            ),

            "-i",
            inputName,

            "-t",
            String(
                batchDuration
            ),

            "-map",
            "0:a:0",

            "-vn"

        ];


        let segmentMuxerConfig =
            null;


        if (
            settings.outputFormat ===
            "same"
        ) {

            args.push(
                "-c:a",
                "copy"
            );

        }
        else {

            segmentMuxerConfig =
                buildSegmentMuxerConfig(
                    outputExt
                );


            args.push(
                ...segmentMuxerConfig.codecArgs
            );

        }


        args.push(
            "-f",
            "segment"
        );


        if (
            segmentMuxerConfig
                ?.segmentFormat
        ) {

            args.push(
                "-segment_format",
                segmentMuxerConfig
                    .segmentFormat
            );

        }


        if (
            segmentMuxerConfig
                ?.segmentFormatOptions
        ) {

            args.push(
                "-segment_format_options",
                segmentMuxerConfig
                    .segmentFormatOptions
            );

        }


        args.push(
            "-segment_start_number",
            "0",

            "-segment_times",
            relativeCuts.join(
                ","
            ),

            "-reset_timestamps",
            "1",

            outputPattern
        );


        const progressBindings =
            [];


        const attachProgress =
            targetFFmpeg => {

                if (
                    typeof onProgress !==
                        "function" ||
                    typeof targetFFmpeg.on !==
                        "function"
                ) {

                    return;

                }


                const handler =
                    event => {

                        const progress =
                            Number.isFinite(
                                event?.progress
                            )
                                ? event.progress
                                : 0;


                        onProgress(
                            Math.max(
                                0,
                                Math.min(
                                    1,
                                    progress
                                )
                            )
                        );

                    };


                targetFFmpeg.on(
                    "progress",
                    handler
                );


                progressBindings.push({
                    ffmpeg:
                        targetFFmpeg,
                    handler
                });

            };


        attachProgress(
            ffmpeg
        );


        console.log(
            "[AUTO SPLITTER] Batch FFmpeg:",
            args.join(
                " "
            )
        );


        const createdUrls =
            [];


        try {

            ffmpeg =
                await runFFmpegExec(
                    ffmpeg,
                    args,
                    {

                        label:
                            `Auto Split batch export (${batchSegments.length} segments)`,

                        async onRetry(
                            retryFFmpeg
                        ) {

                            await restoreInput(
                                retryFFmpeg
                            );


                            attachProgress(
                                retryFFmpeg
                            );

                        }

                    }
                );


            const results = [];


            for (
                let localIndex = 0;
                localIndex <
                    batchSegments.length;
                localIndex++
            ) {

                await checkpoint();


                const outputNameFs =
                    `${outputPrefix}${
                        String(localIndex)
                            .padStart(
                                3,
                                "0"
                            )
                    }.${outputExt}`;


                const blob =
                    await readOutputBlobAndDelete(
                        ffmpeg,
                        outputNameFs,
                        outputExt,
                        "Auto Split batch output"
                    );


                const segment =
                    batchSegments[
                        localIndex
                    ];


                const globalIndex =
                    firstSegmentIndex +
                    localIndex;


                const outputName =
                    `${
                        baseName(
                            file.name
                        )
                    }-part-${
                        String(
                            globalIndex + 1
                        ).padStart(
                            2,
                            "0"
                        )
                    }.${outputExt}`;


                const outputUrl =
                    URL.createObjectURL(
                        blob
                    );


                createdUrls.push(
                    outputUrl
                );


                results.push({

                    blob,

                    outputUrl,

                    outputName,

                    outputFormat:
                        outputExt,

                    outputSize:
                        blob.size,

                    start:
                        segment.start,

                    end:
                        segment.end,

                    duration:
                        segment.duration

                });

            }


            return results;

        }
        catch (error) {

            for (
                const url of
                    createdUrls
            ) {

                try {
                    URL.revokeObjectURL(
                        url
                    );
                }
                catch (_) {}

            }


            throw error;

        }
        finally {

            for (
                const binding of
                    progressBindings
            ) {

                try {

                    binding.ffmpeg.off?.(
                        "progress",
                        binding.handler
                    );

                }
                catch (_) {}

            }


            await cleanupBatchOutputs(
                ffmpeg,
                outputPrefix,
                outputExt,
                batchSegments.length
            );

        }

    }


    async function exportSegmentsEfficiently(
        file,
        inputName,
        restoreInput,
        sourceIndex,
        segments,
        settings
    ) {

        const results = [];


        const estimatedBytesPerSecond =
            estimateOutputBytesPerSecond(
                file,
                segments,
                settings
            );


        const batches =
            buildExportBatches(
                segments,
                estimatedBytesPerSecond
            );


        let completedSegments =
            0;


        console.log(
            "[AUTO SPLITTER] Segment export plan:",
            {
                segmentCount:
                    segments.length,
                batchCount:
                    batches.length,
                maxSegmentsPerBatch:
                    MAX_SEGMENTS_PER_BATCH,
                maxBatchDurationSeconds:
                    MAX_BATCH_DURATION_SECONDS,
                maxEstimatedBatchOutputMiB:
                    Math.round(
                        MAX_BATCH_ESTIMATED_OUTPUT_BYTES /
                        (1024 * 1024)
                    ),
                estimatedOutputKiBPerSecond:
                    Math.round(
                        estimatedBytesPerSecond /
                        1024
                    ),
                estimatedBatchOutputMiB:
                    batches.map(
                        batch =>
                            Number(
                                (
                                    estimatedBatchOutputBytes(
                                        batch,
                                        estimatedBytesPerSecond
                                    ) /
                                    (1024 * 1024)
                                ).toFixed(1)
                            )
                    )
            }
        );


        try {

        for (
            let batchIndex = 0;
            batchIndex <
                batches.length;
            batchIndex++
        ) {

            await checkpoint();


            const batch =
                batches[
                    batchIndex
                ];


            const firstSegmentIndex =
                completedSegments;


            let batchResults;


            if (
                batch.length === 1
            ) {

                batchResults = [
                    await exportSegment(
                        file,
                        inputName,
                        restoreInput,
                        sourceIndex,
                        batch[0],
                        firstSegmentIndex,
                        settings
                    )
                ];

            }
            else {

                try {

                    batchResults =
                        await exportSegmentBatch(
                            file,
                            inputName,
                            restoreInput,
                            sourceIndex,
                            batch,
                            firstSegmentIndex,
                            batchIndex,
                            settings,
                            batchProgress => {

                                const overallDone =
                                    completedSegments +
                                    batchProgress *
                                        batch.length;


                                const percentage =
                                    20 +
                                    Math.round(
                                        (
                                            overallDone /
                                            segments.length
                                        ) *
                                        80
                                    );


                                emit(
                                    "easyfiletools:auto-split-file-progress",
                                    {
                                        index:
                                            sourceIndex,
                                        percentage
                                    }
                                );

                            }
                        );

                }
                catch (error) {

                    if (
                        state.cancelled ||
                        state.paused
                    ) {

                        throw error;

                    }


                    console.warn(
                        "[AUTO SPLITTER] Batch export failed; falling back to per-segment export for this batch.",
                        error
                    );


                    try {

                        await resetFFmpeg();

                    }
                    catch (_) {}


                    const retryFFmpeg =
                        await getFFmpeg();


                    await restoreInput(
                        retryFFmpeg
                    );


                    batchResults = [];


                    try {

                        for (
                            let localIndex = 0;
                            localIndex <
                                batch.length;
                            localIndex++
                        ) {

                            await checkpoint();


                            batchResults.push(
                                await exportSegment(
                                    file,
                                    inputName,
                                    restoreInput,
                                    sourceIndex,
                                    batch[
                                        localIndex
                                    ],
                                    firstSegmentIndex +
                                        localIndex,
                                    settings
                                )
                            );

                        }

                    }
                    catch (fallbackError) {

                        disposeUncommittedResults(
                            batchResults
                        );

                        throw fallbackError;

                    }

                }

            }


            results.push(
                ...batchResults
            );


            completedSegments +=
                batch.length;


            const percentage =
                20 +
                Math.round(
                    (
                        completedSegments /
                        segments.length
                    ) *
                    80
                );


            emit(
                "easyfiletools:auto-split-file-progress",
                {
                    index:
                        sourceIndex,
                    percentage
                }
            );

        }


        return results;

        }
        catch (error) {

            /*
             * Results from earlier batches have not yet been handed to
             * the UI.  If a later batch fails or the operation is
             * cancelled, revoke those Object URLs immediately instead
             * of leaving browser-managed Blob URLs alive.
             */
            disposeUncommittedResults(
                results
            );

            throw error;

        }

    }


    async function splitOne(
        file,
        sourceIndex,
        settings
    ) {

        emit(
            "easyfiletools:auto-split-file-progress",
            {

                index:
                    sourceIndex,

                percentage:
                    5

            }
        );


        const inputExt =
            extensionOf(
                file.name
            ) ||
            "audio";


        const inputName =
            `split_${sourceIndex}_input.${inputExt}`;


        const inputMountPoint =
            `/easyfile_split_${sourceIndex}_input`;


        let ffmpeg =
            await getFFmpeg();


        let inputHandle =
            await prepareSplitInput(
                ffmpeg,
                file,
                inputName,
                inputMountPoint
            );


        const inputPath =
            inputHandle.paths[0];


        const restoreInput =
            async retryFFmpeg => {

                inputHandle =
                    await prepareSplitInput(
                        retryFFmpeg,
                        file,
                        inputName,
                        inputMountPoint
                    );

            };


        try {

            const detection =
                await detectSilences(
                    inputPath,
                    restoreInput,
                    settings
                );


            await checkpoint();


            const segments =
                buildSegments(
                    detection,
                    settings.minSegment
                );


            emit(
                "easyfiletools:auto-split-detected",
                {

                    index:
                        sourceIndex,

                    segmentCount:
                        segments.length

                }
            );


            return await
                exportSegmentsEfficiently(
                    file,
                    inputPath,
                    restoreInput,
                    sourceIndex,
                    segments,
                    settings
                );

        }
        finally {

            /*
            * A cancellation already resets FFmpeg,
            * therefore there is nothing left to
            * delete in that case.
            */

            if (
                !state.cancelled
            ) {

                try {

                    if (
                        typeof releaseFFmpegInputFiles ===
                            "function"
                    ) {

                        await releaseFFmpegInputFiles(
                            inputHandle
                        );

                    }

                }
                catch (_) {}

            }

        }

    }


    async function splitFiles(
        items,
        settings
    ) {

        if (
            state.running
        ) {

            return;
        }


        const files =
            items
                .map(
                    extractFile
                )
                .filter(Boolean);


        if (
            files.length === 0
        ) {

            return;
        }


        state.running = true;
        state.paused = false;
        state.cancelled = false;
        state.ffmpegResetPromise = null;


        emit(
            "easyfiletools:auto-split-started",
            {
                total:
                    files.length
            }
        );


        let operationError =
            null;


        try {

            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                state.currentIndex =
                    index;


                await checkpoint();


                const segments =
                    await splitOne(
                        files[index],
                        index,
                        settings
                    );


                emit(
                    "easyfiletools:auto-split-file-complete",
                    {
                        index,

                        file:
                            files[index],

                        segments
                    }
                );

            }

        }
        catch (error) {

            if (
                error.message !==
                "AUTO_SPLIT_CANCELLED"
            ) {

                operationError =
                    error;


                console.error(
                    "[AUTO SPLITTER]",
                    error
                );

            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running = false;
            state.paused = false;
            state.currentIndex = -1;
            state.resumeResolver = null;
            state.ffmpegExecuting = false;
            state.ffmpegResetPromise = null;


            emit(
                "easyfiletools:auto-split-ended",
                {
                    cancelled,

                    error:
                        operationError
                }
            );

        }

    }


    function pause() {

        if (
            state.running &&
            !state.paused
        ) {

            state.paused = true;

            if (
                state.ffmpegExecuting
            ) {

                state.ffmpegResetPromise =
                    Promise
                        .resolve(
                            resetFFmpeg()
                        )
                        .catch(
                            () => {}
                        );

            }

            emit(
                "easyfiletools:auto-split-paused"
            );

        }

    }


    function resume() {

        if (
            !state.running ||
            !state.paused
        ) {

            return;
        }


        state.paused = false;


        const resolver =
            state.resumeResolver;


        state.resumeResolver =
            null;


        resolver?.();


        emit(
            "easyfiletools:auto-split-resumed"
        );

    }


    async function cancel() {

        if (
            !state.running
        ) {

            return;
        }


        state.cancelled = true;
        state.paused = false;


        state.resumeResolver?.();

        state.resumeResolver =
            null;


        try {

            await resetFFmpeg();

        }
        catch (_) {}

    }


    window.AudioAutoSplitter = {

        splitFiles,

        pause,

        resume,

        cancel

    };

})();