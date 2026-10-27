console.log(
    "[VIDEO TRIMMER] video-trimmer.js loaded"
);


(() => {

    "use strict";


    const state = {

        running:
            false,

        paused:
            false,

        cancelled:
            false,

        currentIndex:
            -1

    };


    /* =========================================
       HELPERS
    ========================================= */

    function extensionOf(
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


    function baseName(
        filename
    ) {

        const dot =
            filename.lastIndexOf(".");


        return dot > 0
            ? filename.slice(
                0,
                dot
            )
            : filename;

    }


    function mimeFor(
        format
    ) {

        const map = {

            mp4:
                "video/mp4",

            webm:
                "video/webm",

            mkv:
                "video/x-matroska",

            mov:
                "video/quicktime",

            avi:
                "video/x-msvideo"

        };


        return (
            map[format] ||
            "application/octet-stream"
        );

    }


    function normalizeSourceFormat(
        extension
    ) {

        if (
            extension ===
            "m4v"
        ) {

            return "mp4";
        }


        return extension;

    }


    function resolveOutputFormat(
        request
    ) {

        const source =
            normalizeSourceFormat(
                extensionOf(
                    request.file.name
                )
            );


        if (
            request.outputFormat !==
            "same"
        ) {

            return request.outputFormat;

        }


        /*
         * Formats supported reliably
         * by our V1 encoders.
         */

        if (
            [
                "mp4",
                "webm",
                "mkv",
                "mov",
                "avi"
            ].includes(
                source
            )
        ) {

            return source;

        }


        /*
         * Accurate trim fallback
         * for uncommon source containers.
         */

        if (
            request.precision ===
            "accurate"
        ) {

            return "mp4";

        }


        /*
         * Fast mode keeps original
         * extension/container.
         */

        return source;

    }


    function qualityCrf(
        quality
    ) {

        return {

            high:
                18,

            balanced:
                22,

            small:
                27

        }[quality] || 18;

    }


    function accurateEncodingArgs(
        format,
        request
    ) {

        const crf =
            qualityCrf(
                request.quality
            );


        const audio =
            request.keepAudio;


        switch (format) {

            case "webm":

                return [

                    "-c:v",
                    "libvpx",

                    "-deadline",
                    "good",

                    "-cpu-used",
                    "4",

                    "-threads",
                    "1",

                    "-crf",
                    String(
                        crf + 10
                    ),

                    "-b:v",
                    "0",

                    "-pix_fmt",
                    "yuv420p",

                    ...(audio
                        ? [
                            "-c:a",
                            "libopus",
                            "-b:a",
                            "160k",
                            "-ar",
                            "24000"
                        ]
                        : [
                            "-an"
                        ])

                ];


            case "avi":

                return [

                    "-c:v",
                    "mpeg4",

                    "-q:v",
                    request.quality ===
                        "high"
                        ? "2"
                        : request.quality ===
                            "balanced"
                            ? "4"
                            : "6",

                    ...(audio
                        ? [
                            "-c:a",
                            "libmp3lame",
                            "-b:a",
                            "192k"
                        ]
                        : [
                            "-an"
                        ])

                ];


            case "mov":
            case "mkv":
            case "mp4":
            default:

                return [

                    "-c:v",
                    "libx264",

                    "-preset",
                    "veryfast",

                    "-crf",
                    String(crf),

                    "-pix_fmt",
                    "yuv420p",

                    ...(audio
                        ? [
                            "-c:a",
                            "aac",
                            "-b:a",
                            "192k"
                        ]
                        : [
                            "-an"
                        ])

                ];

        }

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


    /* =========================================
       FAST TRIM
    ========================================= */

    async function fastTrim(
        inputName,
        outputName,
        request
    ) {

        const args = [

            "-ss",
            String(
                request.start
            ),

            "-i",
            inputName,

            "-t",
            String(
                request.duration
            ),

            "-map",
            "0:v:0?"

        ];


        if (
            request.keepAudio
        ) {

            args.push(
                "-map",
                "0:a:0?"
            );

        }
        else {

            args.push(
                "-an"
            );

        }


        args.push(

            "-c",
            "copy",

            "-avoid_negative_ts",
            "make_zero",

            outputName

        );


        await exec(
            args
        );

    }


    /* =========================================
       ACCURATE TRIM
    ========================================= */

    async function accurateTrim(
        inputName,
        outputName,
        format,
        request
    ) {

        const args = [

            /*
             * Input seeking.
             *
             * FFmpeg accurate seek is enabled
             * by default when transcoding.
             */

            "-ss",
            String(
                request.start
            ),

            "-i",
            inputName,

            "-t",
            String(
                request.duration
            ),

            "-map",
            "0:v:0?",

            ...(
                request.keepAudio
                    ? [
                        "-map",
                        "0:a:0?"
                    ]
                    : []
            ),

            "-sn",
            "-dn",

            ...accurateEncodingArgs(
                format,
                request
            )

        ];


        if (
            format === "mp4" ||
            format === "mov"
        ) {

            args.push(

                "-movflags",
                "+faststart"

            );

        }


        args.push(
            outputName
        );


        await exec(
            args
        );

    }


    /* =========================================
       ONE FILE
    ========================================= */

    async function trimOne(
        request
    ) {

        const outputFormat = resolveOutputFormat(request);
        // Browser-first when safe: start-at-zero packet copy for MP4/WebM Fast,
        // VP9 for frame-accurate WebM. Arbitrary Fast cut points stay on FFmpeg.
        if (window.EasyFileVideoFastPaths?.trim) {
            try {
                const blob = await window.EasyFileVideoFastPaths.trim(
                    request.file, request, outputFormat,
                    percentage => emit('easyfiletools:trim-video-progress', {
                        index: request.index, percentage
                    })
                );
                if (blob) {
                    if (state.cancelled || state.paused) {
                        const error = new Error('TRIM_VIDEO_INTERRUPTED');
                        error.name = 'ConversionCanceledError';
                        throw error;
                    }
                    console.info('[VIDEO TRIMMER] Browser fast path completed',
                        {precision: request.precision, format: outputFormat});
                    return {
                        blob, outputUrl: URL.createObjectURL(blob),
                        outputName: `${baseName(request.file.name)}-trimmed.${outputFormat}`,
                        outputFormat, outputSize: blob.size,
                        start: request.start, end: request.end,
                        duration: request.duration, precision: request.precision
                    };
                }
            } catch (error) {
                if (state.paused || state.cancelled || error?.name === 'ConversionCanceledError')
                    throw error;
                console.warn('[VIDEO TRIMMER] Browser path unavailable; using FFmpeg.', error);
            }
        }

        const ffmpeg =
            await getFFmpeg();


        const sourceExt =
            extensionOf(
                request.file.name
            ) || "video";





        const inputName =
            `trim_video_${request.index}_input.${sourceExt}`;


        const outputNameFs =
            `trim_video_${request.index}.${outputFormat}`;


        await writeFile(

            inputName,

            new Uint8Array(
                await request.file
                    .arrayBuffer()
            )

        );


        const progressHandler =
            ({ progress }) => {

                emit(
                    "easyfiletools:trim-video-progress",
                    {

                        index:
                            request.index,

                        percentage:
                            Math.round(
                                Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        progress
                                    )
                                ) *
                                100
                            )

                    }
                );

            };


        ffmpeg.on(
            "progress",
            progressHandler
        );


        try {

            if (
                request.precision ===
                "fast"
            ) {

                await fastTrim(

                    inputName,

                    outputNameFs,

                    request

                );

            }
            else {

                await accurateTrim(

                    inputName,

                    outputNameFs,

                    outputFormat,

                    request

                );

            }


            const data =
                await readFile(
                    outputNameFs
                );


            const blob =
                new Blob(
                    [
                        data
                    ],
                    {
                        type:
                            mimeFor(
                                outputFormat
                            )
                    }
                );


            const outputName =
                `${
                    baseName(
                        request.file.name
                    )
                }-trimmed.${outputFormat}`;


            return {

                blob,

                outputUrl:
                    URL.createObjectURL(
                        blob
                    ),

                outputName,

                outputFormat,

                outputSize:
                    blob.size,

                start:
                    request.start,

                end:
                    request.end,

                duration:
                    request.duration,

                precision:
                    request.precision

            };

        }
        finally {

            try {

                ffmpeg.off?.(
                    "progress",
                    progressHandler
                );

            }
            catch (_) {}


            try {

                await ffmpeg.deleteFile(
                    inputName
                );

            }
            catch (_) {}


            try {

                await ffmpeg.deleteFile(
                    outputNameFs
                );

            }
            catch (_) {}

        }

    }


    /* =========================================
       BATCH
    ========================================= */

    async function trimFiles(
        requests
    ) {

        if (
            state.running ||
            !Array.isArray(
                requests
            ) ||
            requests.length ===
                0
        ) {

            return;
        }


        state.running =
            true;

        state.paused =
            false;

        state.cancelled =
            false;


        emit(
            "easyfiletools:trim-video-started",
            {
                total:
                    requests.length
            }
        );


        let operationError =
            null;


        try {

            for (
                let i = 0;
                i < requests.length;
                i++
            ) {

                const request =
                    requests[i];


                state.currentIndex =
                    request.index;


                let completed =
                    false;


                while (
                    !completed
                ) {

                    if (
                        state.cancelled
                    ) {

                        throw new Error(
                            "TRIM_VIDEO_CANCELLED"
                        );

                    }


                    while (
                        state.paused &&
                        !state.cancelled
                    ) {

                        await new Promise(
                            resolve =>
                                setTimeout(
                                    resolve,
                                    100
                                )
                        );

                    }


                    if (
                        state.cancelled
                    ) {

                        throw new Error(
                            "TRIM_VIDEO_CANCELLED"
                        );

                    }


                    try {

                        const result =
                            await trimOne(
                                request
                            );


                        emit(
                            "easyfiletools:trim-video-complete",
                            {

                                index:
                                    request.index,

                                file:
                                    request.file,

                                result

                            }
                        );


                        completed =
                            true;

                    }
                    catch (error) {

                        /*
                         * Pause terminates the active
                         * FFmpeg instance.
                         *
                         * Resume restarts only this file.
                         */

                        if (
                            state.paused
                        ) {

                            continue;

                        }


                        if (
                            state.cancelled
                        ) {

                            throw new Error(
                                "TRIM_VIDEO_CANCELLED"
                            );

                        }


                        // Pause and immediate Resume can race with browser
                        // encoder cancellation; restart this file if not cancelled.
                        if (error?.name === 'ConversionCanceledError' && !state.cancelled) {
                            continue;
                        }

                        throw error;

                    }

                }

            }

        }
        catch (error) {

            if (
                error.message !==
                "TRIM_VIDEO_CANCELLED"
            ) {

                operationError =
                    error;


                console.error(
                    "[VIDEO TRIMMER]",
                    error
                );

            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running =
                false;

            state.paused =
                false;

            state.currentIndex =
                -1;

            // Release the FFmpeg WebAssembly worker after each batch.
            // Deleting MEMFS files alone does not necessarily release its
            // expanded WASM heap. The next batch will lazy-load a fresh
            // worker (the core download remains browser-cacheable).
            // Do this only when the batch has ended, never between files.
            try {
                if (typeof resetFFmpeg === "function") {
                    resetFFmpeg();
                }
            }
            catch (releaseError) {
                console.warn("[VIDEO] Could not release FFmpeg after batch", releaseError);
            }



            emit(
                "easyfiletools:trim-video-ended",
                {

                    cancelled,

                    error:
                        operationError

                }
            );

        }

    }


    /* =========================================
       PAUSE / RESUME / CANCEL
    ========================================= */

    async function pause() {

        if (
            !state.running ||
            state.paused
        ) {

            return;
        }


        state.paused =
            true;


        try { await window.EasyFileVideoFastPaths?.cancel?.(); }
        catch (_) {}

        try {

            await resetFFmpeg();

        }
        catch (_) {}


        emit(
            "easyfiletools:trim-video-paused"
        );

    }


    function resume() {

        if (
            !state.running ||
            !state.paused
        ) {

            return;
        }


        state.paused =
            false;


        emit(
            "easyfiletools:trim-video-resumed"
        );

    }


    async function cancel() {

        if (
            !state.running
        ) {

            return;
        }


        state.cancelled =
            true;

        state.paused =
            false;


        try { await window.EasyFileVideoFastPaths?.cancel?.(); }
        catch (_) {}

        try {

            await resetFFmpeg();

        }
        catch (_) {}

    }


    /* =========================================
       PUBLIC
    ========================================= */

    window.VideoTrimmer = {

        trimFiles,

        pause,

        resume,

        cancel,

        getState() {

            return {
                ...state
            };

        }

    };

})();