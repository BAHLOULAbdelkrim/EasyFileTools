console.log("audio-cutter.js loaded");


/* =========================================================
   AUDIO CUTTER ENGINE
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
       EXTENSION
    ===================================================== */

    function getFileExtension(
        filename
    ) {

        const lastDot =
            filename.lastIndexOf(".");


        if (
            lastDot === -1 ||
            lastDot ===
                filename.length - 1
        ) {
            return "";
        }


        return filename
            .slice(lastDot + 1)
            .toLowerCase();

    }


    function getBaseName(
        filename
    ) {

        const lastDot =
            filename.lastIndexOf(".");


        if (
            lastDot <= 0
        ) {
            return filename;
        }


        return filename.slice(
            0,
            lastDot
        );

    }


    /* =====================================================
       SAFE NAME
    ===================================================== */

    function sanitizeFilename(
        value
    ) {

        return value
            .replace(
                /[^a-zA-Z0-9._-]+/g,
                "_"
            )
            .replace(
                /_+/g,
                "_"
            );

    }


    /* =====================================================
       UNIQUE NAME
    ===================================================== */

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


    /* =====================================================
       OUTPUT EXTENSION
    ===================================================== */

    function resolveOutputExtension(
        file,
        settings
    ) {

        if (
            settings.outputFormat ===
            "same"
        ) {

            const sourceExtension =
                getFileExtension(
                    file.name
                );


            if (!sourceExtension) {

                throw new Error(
                    "The source file has no detectable extension."
                );

            }


            return sourceExtension;

        }


        return settings
            .outputFormat
            .toLowerCase();

    }


    /* =====================================================
       MIME TYPES
    ===================================================== */

    function getMimeType(
        extension
    ) {

        const normalizedExtension =
            (
                {
                    wave: "wav",
                    oga: "ogg",
                    m4b: "m4a",
                    mp4: "m4a",
                    aifc: "aiff"
                }[
                    String(
                        extension || ""
                    ).toLowerCase()
                ] ||
                String(
                    extension || ""
                ).toLowerCase()
            );


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
            map[
                normalizedExtension
            ] ||
            "application/octet-stream"
        );

    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function ffmpegNumber(
        value
    ) {

        return Number(value)
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
       SHARED ENCODING PROFILE
    ===================================================== */

    function normalizeEncodingProfileFormat(
        extension
    ) {

        const normalizedExtension =
            String(
                extension || ""
            )
                .trim()
                .toLowerCase();


        /*
        * Keep only container aliases here.
        * Codec/quality decisions belong exclusively
        * to audio-encoding-profiles.js.
        */
        return (
            {
                wave: "wav",
                mp4: "m4a"
            }[normalizedExtension] ||
            normalizedExtension
        );

    }


    function getEncodingProfile(
        extension
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
                "Shared audio encoding profiles are unavailable."
            );

        }


        const profileFormat =
            normalizeEncodingProfileFormat(
                extension
            );


        const profile =
            profiles.getProfile(
                profileFormat
            );


        if (!profile) {

            throw new Error(
                `Re-encoding to .${extension} is not supported yet.`
            );

        }


        return profile;

    }


    /* =====================================================
       FAST CUT ELIGIBILITY
    ===================================================== */

    function getFastCopyRange(
        settings
    ) {

        const tolerance =
            0.005;


        const start =
            Number(
                settings.start
            );


        const end =
            Number(
                settings.end
            );


        const duration =
            Number(
                settings.duration
            );


        /*
        * Fast copy requires:
        *
        * - same output format
        * - no fade
        * - valid selection
        */

        if (
            settings.outputFormat !==
                "same" ||

            settings.fadeInEnabled ||

            settings.fadeOutEnabled ||

            !Number.isFinite(start) ||

            !Number.isFinite(end) ||

            end <= start
        ) {

            return null;
        }


        /*
        * KEEP SELECTION
        *
        * Keep:
        * start → end
        */

        if (
            settings.mode ===
            "keep"
        ) {

            return {

                start,

                end

            };
        }


        /*
        * REMOVE requires the total
        * source duration.
        */

        if (
            settings.mode !==
                "remove" ||

            !Number.isFinite(
                duration
            ) ||

            duration <= 0
        ) {

            return null;
        }


        /*
        * REMOVE FROM BEGINNING
        *
        * Remove:
        * 0 → end
        *
        * Keep:
        * end → EOF
        */

        if (
            start <= tolerance &&

            end <
            duration - tolerance
        ) {

            return {

                start:
                    end,

                end:
                    null

            };
        }


        /*
        * REMOVE FROM END
        *
        * Remove:
        * start → duration
        *
        * Keep:
        * 0 → start
        */

        if (
            end >=
                duration -
                tolerance &&

            start >
                tolerance
        ) {

            return {

                start:
                    0,

                end:
                    start

            };
        }


        /*
        * REMOVE FROM MIDDLE
        *
        * Two pieces must be joined.
        * Keep the existing
        * re-encoding path.
        */

        return null;

    }


    function canUseFastCopy(
        settings
    ) {

        return (
            getFastCopyRange(
                settings
            ) !== null
        );

    }

    /* =====================================================
       FAST COPY ARGS
    ===================================================== */

    function buildFastCopyArgs(
        inputName,
        outputName,
        settings
    ) {

        const range =
            getFastCopyRange(
                settings
            );


        if (!range) {

            throw new Error(
                "Fast audio copy is not available for these settings."
            );
        }


        const args = [

            "-i",
            inputName

        ];


        /*
        * Start position.
        */

        if (
            range.start > 0
        ) {

            args.push(

                "-ss",

                ffmpegNumber(
                    range.start
                )

            );
        }


        /*
        * End position.
        *
        * null means:
        * continue until EOF.
        */

        if (
            Number.isFinite(
                range.end
            )
        ) {

            args.push(

                "-to",

                ffmpegNumber(
                    range.end
                )

            );
        }


        args.push(

            "-map",
            "0:a:0",

            "-vn",

            "-c:a",
            "copy",

            "-avoid_negative_ts",
            "make_zero",

            outputName

        );


        return args;

    }

    /* =====================================================
       FADE FILTER
    ===================================================== */

    function buildFadeFilters(
        settings,
        outputDuration
    ) {

        const filters =
            [];


        if (
            settings.fadeInEnabled
        ) {

            const duration =
                Math.min(
                    settings.fadeInDuration,
                    outputDuration
                );


            filters.push(
                `afade=t=in:st=0:d=${ffmpegNumber(duration)}`
            );

        }


        if (
            settings.fadeOutEnabled
        ) {

            const duration =
                Math.min(
                    settings.fadeOutDuration,
                    outputDuration
                );


            const start =
                Math.max(
                    0,
                    outputDuration -
                    duration
                );


            filters.push(
                `afade=t=out:st=${ffmpegNumber(start)}:d=${ffmpegNumber(duration)}`
            );

        }


        return filters;

    }


    /* =====================================================
       KEEP FILTER
    ===================================================== */

    function buildKeepArgs(
        inputName,
        outputName,
        extension,
        settings
    ) {

        const selectedDuration =
            settings.end -
            settings.start;


        const filters = [

            `atrim=start=${ffmpegNumber(settings.start)}:end=${ffmpegNumber(settings.end)}`,

            "asetpts=PTS-STARTPTS"

        ];


        filters.push(
            ...buildFadeFilters(
                settings,
                selectedDuration
            )
        );


        const profile =
            getEncodingProfile(
                extension
            );


        return [

            "-i",
            inputName,

            "-vn",

            "-af",
            filters.join(","),

            ...profile.codecArgs,

            ...profile.muxerArgs,

            outputName

        ];

    }


    /* =====================================================
       REMOVE FILTER
    ===================================================== */

    function buildRemoveArgs(
        inputName,
        outputName,
        extension,
        settings
    ) {

        const totalDuration =
            settings.duration;


        const start =
            settings.start;


        const end =
            settings.end;


        const outputDuration =
            Math.max(
                0,
                totalDuration -
                (
                    end -
                    start
                )
            );


        const tolerance =
            0.005;


        let filterGraph =
            "";

        let baseLabel =
            "";


        /*
         * Case 1:
         * Remove from the beginning.
         */

        if (
            start <= tolerance
        ) {

            filterGraph +=
                `[0:a]` +
                `atrim=start=${ffmpegNumber(end)},` +
                `asetpts=PTS-STARTPTS` +
                `[base]`;

            baseLabel =
                "base";

        }

        /*
         * Case 2:
         * Remove until the end.
         */

        else if (
            end >=
            totalDuration -
            tolerance
        ) {

            filterGraph +=
                `[0:a]` +
                `atrim=start=0:end=${ffmpegNumber(start)},` +
                `asetpts=PTS-STARTPTS` +
                `[base]`;

            baseLabel =
                "base";

        }

        /*
         * Case 3:
         * Remove a middle section.
         */

        else {

            filterGraph +=
                `[0:a]` +
                `atrim=start=0:end=${ffmpegNumber(start)},` +
                `asetpts=PTS-STARTPTS` +
                `[before];`;


            filterGraph +=
                `[0:a]` +
                `atrim=start=${ffmpegNumber(end)},` +
                `asetpts=PTS-STARTPTS` +
                `[after];`;


            filterGraph +=
                `[before][after]` +
                `concat=n=2:v=0:a=1` +
                `[base]`;


            baseLabel =
                "base";

        }


        const fadeFilters =
            buildFadeFilters(
                settings,
                outputDuration
            );


        let outputLabel =
            baseLabel;


        if (
            fadeFilters.length > 0
        ) {

            filterGraph +=
                `;[${baseLabel}]` +
                fadeFilters.join(",") +
                `[outa]`;

            outputLabel =
                "outa";

        }


        const profile =
            getEncodingProfile(
                extension
            );


        return [

            "-i",
            inputName,

            "-vn",

            "-filter_complex",
            filterGraph,

            "-map",
            `[${outputLabel}]`,

            ...profile.codecArgs,

            ...profile.muxerArgs,

            outputName

        ];

    }


    /* =====================================================
       BUILD ARGS
    ===================================================== */

    function buildReencodeArgs(
        inputName,
        outputName,
        extension,
        settings
    ) {

        if (
            settings.mode ===
            "remove"
        ) {

            return buildRemoveArgs(
                inputName,
                outputName,
                extension,
                settings
            );

        }


        return buildKeepArgs(
            inputName,
            outputName,
            extension,
            settings
        );

    }


    function buildFFmpegArgs(
        inputName,
        outputName,
        extension,
        settings
    ) {

        if (
            canUseFastCopy(
                settings
            )
        ) {

            return buildFastCopyArgs(
                inputName,
                outputName,
                settings
            );

        }


        return buildReencodeArgs(
            inputName,
            outputName,
            extension,
            settings
        );

    }

    /* =====================================================
       DELETE TEMP FILE
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

        } catch (_) {

            // Temporary file cleanup
            // should never break the operation.

        }

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
            !handler ||
            !ffmpeg
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

        } catch (_) {
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
       CUT ONE FILE
    ===================================================== */

    async function cutFile(
        file,
        settings,
        options = {}
    ) {

        if (!file) {

            throw new Error(
                "No input audio file."
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
                file,
                settings
            );


        const uniqueId =
            createUniqueId();


        const sourceExtension =
            getFileExtension(
                file.name
            ) || "bin";


        const inputName =
            sanitizeFilename(
                `input_${uniqueId}.${sourceExtension}`
            );


        const outputName =
            sanitizeFilename(
                `${getBaseName(file.name)}_cut_${uniqueId}.${extension}`
            );


        const finalDownloadName =
            sanitizeFilename(
                `${getBaseName(file.name)}_cut.${extension}`
            );


        const ffmpeg =
            await getFFmpeg();


        currentFFmpeg =
            ffmpeg;


        const progressHandler =
            attachProgress(
                ffmpeg,
                options.onProgress
            );


        let inputHandle =
            null;


        try {

            if (
                typeof prepareFFmpegInputFiles !==
                    "function"
            ) {

                throw new Error(
                    "Memory-efficient FFmpeg input preparation is not available."
                );

            }


            inputHandle =
                await prepareFFmpegInputFiles(
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
                            "Cut Audio input",

                        mountLabel:
                            `cut_${uniqueId}`
                    }
                );


            const inputPath =
                inputHandle.paths[0];


            let usedFastCopy =
                false;


            const fastCopyRequested =
                canUseFastCopy(
                    settings
                );


            if (
                fastCopyRequested
            ) {

                const fastArgs =
                    buildFastCopyArgs(
                        inputPath,
                        outputName,
                        settings
                    );


                console.log(
                    "[AUDIO CUTTER] Fast Copy:",
                    fastArgs.join(" ")
                );


                try {

                    await execFFmpegOrThrow(
                        ffmpeg,
                        fastArgs,
                        "Cut Audio Fast Copy"
                    );


                    usedFastCopy =
                        true;

                }
                catch (
                    fastError
                ) {

                    /*
                    * Cancellation is not a Fast Copy
                    * compatibility failure.
                    * Let the normal cancellation flow
                    * handle it.
                    */
                    if (
                        String(
                            fastError?.message || ""
                        ).includes(
                            "FFmpeg.terminate"
                        )
                    ) {

                        throw fastError;

                    }


                    console.warn(
                        "[AUDIO CUTTER] Fast Copy unavailable. Falling back to re-encode:",
                        fastError
                    );


                    /*
                    * Remove any partial output left
                    * by the failed Fast Copy attempt.
                    */
                    await deleteTempFile(
                        ffmpeg,
                        outputName
                    );


                    options.onProgress?.(
                        0
                    );


                    const fallbackArgs =
                        buildReencodeArgs(
                            inputPath,
                            outputName,
                            extension,
                            settings
                        );


                    console.log(
                        "[AUDIO CUTTER] Fallback re-encode:",
                        fallbackArgs.join(" ")
                    );


                    await execFFmpegOrThrow(
                        ffmpeg,
                        fallbackArgs,
                        "Cut Audio fallback re-encode"
                    );

                }

            }
            else {

                const args =
                    buildReencodeArgs(
                        inputPath,
                        outputName,
                        extension,
                        settings
                    );


                console.log(
                    "[AUDIO CUTTER] Re-encode:",
                    args.join(" ")
                );


                await execFFmpegOrThrow(
                    ffmpeg,
                    args,
                    "Cut Audio re-encode"
                );

            }


            const outputData =
                await ffmpeg.readFile(
                    outputName
                );


            const blob =
                new Blob(
                    [
                        outputData instanceof Uint8Array
                            ? outputData
                            : new Uint8Array(
                                outputData
                            )
                    ],
                    {
                        type:
                            getMimeType(
                                extension
                            )
                    }
                );

            const selectedDuration =
                Math.max(
                    0,
                    settings.end -
                    settings.start
                );


            const outputDuration =
                settings.mode === "remove"

                    ? Math.max(
                        0,
                        settings.duration -
                        selectedDuration
                    )

                    : selectedDuration;                

            return {

                blob,

                outputName:
                    finalDownloadName,

                outputFormat:
                    extension,

                outputSize:
                    blob.size,

                outputDuration,

                fastCopy:
                    usedFastCopy

            };

        } finally {

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
                outputName
            );


            currentFFmpeg =
                null;

        }

    }


    /* =====================================================
       CANCEL CURRENT PROCESS
    ===================================================== */

    async function cancelCurrent() {

        const ffmpeg =
            currentFFmpeg;


        if (!ffmpeg) {
            return;
        }


        /*
         * Prefer the shared loader reset function
         * if it exists.
         */

        if (
            typeof resetFFmpeg ===
            "function"
        ) {

            await resetFFmpeg();

            currentFFmpeg =
                null;

            return;

        }


        /*
         * Fallback.
         */

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
       PUBLIC API
    ===================================================== */

    window.AudioCutter = {

        cutFile,

        cancelCurrent,

        canUseFastCopy,

        getFileExtension,

        getMimeType

    };

})();