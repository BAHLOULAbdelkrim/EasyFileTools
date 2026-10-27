console.log(
    "[AUDIO CONVERTER] audio-converter.js loaded"
);

let audioConversionRunning =
    false;

let audioConversionCancelled =
    false;

let audioCurrentFileIndex =
    -1;

let audioConversionPaused =
    false;

let audioResumeResolver =
    null;

let audioFFmpegExecuting =
    false;


/* =========================
   CONVERSION ARGUMENTS
========================= */

function getAudioConversionArgs(
    format,
    inputName,
    outputName
) {

    const profiles =
        globalThis
            .EasyFileAudioEncodingProfiles;


    if (
        !profiles ||
        typeof profiles.buildConversionArgs !==
            "function"
    ) {

        throw new Error(
            "Shared audio encoding profiles are unavailable."
        );
    }


    return profiles
        .buildConversionArgs(
            format,
            inputName,
            outputName
        );
}


/* =========================
   SAME-FORMAT PASSTHROUGH
========================= */

function getAudioFileExtension(
    file
) {

    const fileName =
        String(
            file?.name ||
            ""
        ).trim();


    const lastDotIndex =
        fileName.lastIndexOf(
            "."
        );


    if (
        lastDotIndex <= 0 ||
        lastDotIndex ===
            fileName.length - 1
    ) {

        return "";
    }


    return fileName
        .slice(
            lastDotIndex + 1
        )
        .toLowerCase();
}


function canPassthroughAudioConversion(
    file,
    format
) {

    const sourceFormat =
        getAudioFileExtension(
            file
        );


    const requestedFormat =
        String(
            format ||
            ""
        )
            .trim()
            .toLowerCase();


    return Boolean(
        sourceFormat &&
        requestedFormat &&
        sourceFormat ===
            requestedFormat
    );
}


/* =========================
   STREAM COPY / REMUX
========================= */

const AUDIO_STREAM_COPY_TARGETS = {

    mp3: {
        codecs: [
            "mp3"
        ],
        muxer: "mp3"
    },

    wav: {
        codecs: [
            "pcm_s16le"
        ],
        muxer: "wav"
    },

    flac: {
        codecs: [
            "flac"
        ],
        muxer: "flac"
    },

    aac: {
        codecs: [
            "aac"
        ],
        muxer: "adts"
    },

    ogg: {
        codecs: [
            "vorbis"
        ],
        muxer: "ogg"
    },

    oga: {
        codecs: [
            "vorbis"
        ],
        muxer: "ogg"
    },

    opus: {
        codecs: [
            "opus"
        ],
        muxer: "ogg"
    },

    wma: {
        codecs: [
            "wmav2"
        ],
        muxer: "asf"
    },

    m4a: {
        codecs: [
            "aac"
        ],
        muxer: "mp4",
        faststart: true
    },

    m4b: {
        codecs: [
            "aac"
        ],
        muxer: "mp4",
        faststart: true
    },

    aiff: {
        codecs: [
            "pcm_s16be"
        ],
        muxer: "aiff"
    },

    aif: {
        codecs: [
            "pcm_s16be"
        ],
        muxer: "aiff"
    },

    aifc: {
        codecs: [
            "pcm_s16be"
        ],
        muxer: "aiff"
    },

    au: {
        codecs: [
            "pcm_s16be"
        ],
        muxer: "au"
    },

    snd: {
        codecs: [
            "pcm_s16be"
        ],
        muxer: "au"
    },

    ac3: {
        codecs: [
            "ac3"
        ],
        muxer: "ac3"
    },

    dts: {
        codecs: [
            "dts"
        ],
        muxer: "dts"
    },

    wv: {
        codecs: [
            "wavpack"
        ],
        muxer: "wv"
    },

    tta: {
        codecs: [
            "tta"
        ],
        muxer: "tta"
    },

    voc: {
        codecs: [
            "pcm_s16le"
        ],
        muxer: "voc"
    },

    ra: {
        codecs: [
            "ac3"
        ],
        muxer: "rm"
    },

    rm: {
        codecs: [
            "ac3"
        ],
        muxer: "rm"
    }
};


function getAudioStreamCopyPlan(
    probeInfo,
    format
) {

    const requestedFormat =
        String(
            format ||
            ""
        )
            .trim()
            .toLowerCase();


    const codecName =
        String(
            probeInfo?.codecName ||
            ""
        )
            .trim()
            .toLowerCase();


    const target =
        AUDIO_STREAM_COPY_TARGETS[
            requestedFormat
        ];


    if (
        !target ||
        !codecName ||
        !target.codecs.includes(
            codecName
        )
    ) {

        return null;
    }


    return {
        codecName,
        muxer:
            target.muxer,
        faststart:
            target.faststart ===
            true
    };
}


function getAudioStreamCopyArgs(
    inputName,
    outputName,
    plan
) {

    const args = [
        "-i",
        inputName,
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "copy"
    ];


    if (
        plan?.muxer
    ) {

        args.push(
            "-f",
            plan.muxer
        );
    }


    if (
        plan?.faststart ===
            true
    ) {

        args.push(
            "-movflags",
            "+faststart"
        );
    }


    args.push(
        outputName
    );


    return args;
}


/* =========================
   CURRENT RESULT
========================= */

function hasCurrentAudioResult(
    index,
    format
) {

    const resultItem =
        window
            .EasyFileOperationResults
            ?.getItem?.(
                index
            );


    if (
        !resultItem ||
        !resultItem.result ||
        resultItem.stale === true
    ) {

        return false;
    }


    const result =
        resultItem.result;


    const resultFormat =
        String(
            result.outputFormat ||
            ""
        ).toLowerCase();


    const requestedFormat =
        String(
            format ||
            ""
        ).toLowerCase();


    if (
        resultFormat !==
        requestedFormat
    ) {

        return false;
    }


    return Boolean(
        result.outputUrl ||
        result.outputBlob
    );
}


/* =========================
   WAIT FOR RESUME
========================= */

function waitForAudioResume() {

    if (
        !audioConversionPaused
    ) {

        return Promise.resolve();
    }


    return new Promise(
        resolve => {

            audioResumeResolver =
                resolve;
        }
    );
}


/* =========================
   CANCEL CONVERSION
========================= */

document.addEventListener(
    "easyfiletools:conversion-cancel-requested",
    event => {

        const category =
            event.detail?.category ||
            "";


        if (
            category.toLowerCase() !==
            "audio"
        ) {

            return;
        }


        if (
            !audioConversionRunning
        ) {

            return;
        }


        console.log(
            "[AUDIO CONVERTER] Cancelling conversion..."
        );


        audioConversionCancelled =
            true;

        audioConversionPaused =
            false;


        resetFFmpeg();


        if (
            audioResumeResolver
        ) {

            audioResumeResolver();

            audioResumeResolver =
                null;
        }
    }
);


/* =========================
   PAUSE CONVERSION
========================= */

document.addEventListener(
    "easyfiletools:conversion-pause-requested",
    event => {

        const category =
            event.detail?.category ||
            "";


        if (
            category.toLowerCase() !==
            "audio"
        ) {

            return;
        }


        if (
            !audioConversionRunning ||
            audioConversionPaused ||
            audioConversionCancelled
        ) {

            return;
        }


        console.log(
            "[AUDIO CONVERTER] Pausing conversion..."
        );


        audioConversionPaused =
            true;


        /*
         * FFmpeg is interrupted only
         * while it is actually executing.
         */

        if (
            audioFFmpegExecuting
        ) {

            resetFFmpeg();
        }


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:conversion-paused",
                {
                    detail: {

                        category:
                            "Audio",

                        index:
                            audioCurrentFileIndex
                    }
                }
            )
        );
    }
);


/* =========================
   RESUME CONVERSION
========================= */

document.addEventListener(
    "easyfiletools:conversion-resume-requested",
    event => {

        const category =
            event.detail?.category ||
            "";


        if (
            category.toLowerCase() !==
            "audio"
        ) {

            return;
        }


        if (
            !audioConversionRunning ||
            !audioConversionPaused ||
            audioConversionCancelled
        ) {

            return;
        }


        console.log(
            "[AUDIO CONVERTER] Resuming conversion..."
        );


        audioConversionPaused =
            false;


        if (
            audioResumeResolver
        ) {

            audioResumeResolver();

            audioResumeResolver =
                null;
        }


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:conversion-resumed",
                {
                    detail: {

                        category:
                            "Audio",

                        index:
                            audioCurrentFileIndex
                    }
                }
            )
        );
    }
);


/* =========================
   AUDIO CONVERTER
========================= */

document.addEventListener(
    "easyfiletools:conversion-requested",
    async event => {

        if (
            audioConversionRunning
        ) {

            console.warn(
                "[AUDIO CONVERTER] Conversion already running"
            );

            return;
        }


        const detail =
            event.detail ||
            {};


        const category =
            detail.category ||
            "";


        const files =
            Array.isArray(
                detail.files
            )
                ? detail.files
                : [];


        const format =
            detail.format ||
            null;


        /* =========================
           AUDIO ONLY
        ========================= */

        if (
            category.toLowerCase() !==
            "audio"
        ) {

            return;
        }


        /* =========================
           VALIDATION
        ========================= */

        if (
            files.length === 0 ||
            !format
        ) {

            console.warn(
                "[AUDIO CONVERTER] Missing files or output format"
            );

            return;
        }


        console.log(
            "[AUDIO CONVERTER] Conversion requested:",
            {
                files:
                    files.length,

                format
            }
        );


        /* =========================
           INITIAL STATE
        ========================= */

        audioConversionRunning =
            true;

        audioConversionCancelled =
            false;

        audioCurrentFileIndex =
            -1;

        audioConversionPaused =
            false;

        audioResumeResolver =
            null;

        audioFFmpegExecuting =
            false;


        document.dispatchEvent(
            new CustomEvent(
                "easyfiletools:conversion-started",
                {
                    detail: {
                        category:
                            "Audio"
                    }
                }
            )
        );


        try {

            let ffmpeg =
                await getFFmpeg();


            if (
                audioConversionCancelled
            ) {

                resetFFmpeg();

                throw new Error(
                    "AUDIO_CONVERSION_CANCELLED"
                );
            }


            /* =========================
               RESET BEFORE OPUS
            ========================= */

            if (
                format ===
                "opus"
            ) {

                console.log(
                    "[AUDIO CONVERTER] Resetting FFmpeg before OPUS conversion"
                );


                resetFFmpeg();


                ffmpeg =
                    await getFFmpeg();
            }


            console.log(
                "[AUDIO CONVERTER] FFmpeg ready:",
                ffmpeg
            );


            /* =========================
               CONVERT ALL FILES
            ========================= */

            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                if (
                    audioConversionCancelled
                ) {

                    throw new Error(
                        "AUDIO_CONVERSION_CANCELLED"
                    );
                }


                audioCurrentFileIndex =
                    index;


                if (
                    audioConversionPaused
                ) {

                    await waitForAudioResume();


                    if (
                        audioConversionCancelled
                    ) {

                        throw new Error(
                            "AUDIO_CONVERSION_CANCELLED"
                        );
                    }
                }


                const fileData =
                    files[index];


                const inputFile =
                    fileData?.file;


                if (
                    !inputFile
                ) {

                    console.warn(
                        "[AUDIO CONVERTER] Invalid file skipped:",
                        index
                    );

                    continue;
                }


                /* =========================
                   SKIP CURRENT RESULT
                ========================= */

                if (
                    hasCurrentAudioResult(
                        index,
                        format
                    )
                ) {

                    console.log(
                        `[AUDIO CONVERTER] File ${index + 1}/${files.length} already has a current ${format.toUpperCase()} result — skipped:`,
                        inputFile.name
                    );

                    continue;
                }


                /* =========================
                   FILE NAMES
                ========================= */

                const inputName =
                    inputFile.name;


                const baseName =
                    inputName.includes(".")
                        ? inputName.substring(
                            0,
                            inputName.lastIndexOf(
                                "."
                            )
                        )
                        : inputName;


                const outputName =
                    `${baseName}.${format}`;


                console.log(
                    `[AUDIO CONVERTER] File ${index + 1}/${files.length}:`,
                    inputName,
                    "→",
                    outputName
                );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:file-conversion-progress",
                        {
                            detail: {

                                index,

                                percentage:
                                    0,

                                progressLabel:
                                    "Converting"
                            }
                        }
                    )
                );


                /* =========================
                   SAME FORMAT — PASSTHROUGH
                ========================= */

                if (
                    canPassthroughAudioConversion(
                        inputFile,
                        format
                    )
                ) {

                    console.log(
                        `[AUDIO CONVERTER] File ${index + 1}/${files.length} already matches ${format.toUpperCase()} — passthrough without re-encoding:`,
                        inputName
                    );


                    const outputBlob =
                        inputFile;


                    const outputUrl =
                        URL.createObjectURL(
                            outputBlob
                        );


                    document.dispatchEvent(
                        new CustomEvent(
                            "easyfiletools:file-conversion-progress",
                            {
                                detail: {

                                    index,

                                    percentage:
                                        100,

                                    progressLabel:
                                        "Converting"
                                }
                            }
                        )
                    );


                    document.dispatchEvent(
                        new CustomEvent(
                            "easyfiletools:file-converted",
                            {
                                detail: {

                                    index,

                                    fileData,

                                    sourceFile:
                                        inputFile,

                                    sourceName:
                                        inputName,

                                    outputName,

                                    outputFormat:
                                        format,

                                    blob:
                                        outputBlob,

                                    url:
                                        outputUrl,

                                    size:
                                        outputBlob.size,

                                    passthrough:
                                        true
                                }
                            }
                        )
                    );


                    continue;
                }


                /* =========================
                   PREPARE INPUT
                ========================= */

                if (
                    typeof prepareFFmpegInputFiles !==
                        "function"
                ) {

                    throw new Error(
                        "Memory-efficient FFmpeg input preparation is not available."
                    );

                }


                let inputHandle =
                    await prepareFFmpegInputFiles(
                        ffmpeg,
                        [
                            {
                                file:
                                    inputFile,

                                name:
                                    inputName
                            }
                        ],
                        {
                            label:
                                "Convert Audio input",

                            mountLabel:
                                `convert_${index}`
                        }
                    );


                const inputPath =
                    inputHandle.paths[0];


                /* =========================
                   FFPROBE / STREAM COPY DECISION
                ========================= */

                let streamCopyPlan =
                    null;


                if (
                    typeof probeAudioFile ===
                        "function"
                ) {

                    try {

                        const probeInfo =
                            await probeAudioFile(
                                ffmpeg,
                                inputPath,
                                `Convert Audio inspection (${inputName})`
                            );


                        streamCopyPlan =
                            getAudioStreamCopyPlan(
                                probeInfo,
                                format
                            );


                        if (
                            streamCopyPlan
                        ) {

                            console.log(
                                `[AUDIO CONVERTER] File ${index + 1}/${files.length}: stream copy is compatible (${streamCopyPlan.codecName} → ${format.toUpperCase()}).`
                            );

                        }

                    }
                    catch (
                        probeError
                    ) {

                        if (
                            audioConversionCancelled
                        ) {

                            throw new Error(
                                "AUDIO_CONVERSION_CANCELLED"
                            );
                        }


                        console.warn(
                            "[AUDIO CONVERTER] FFprobe inspection failed; using normal re-encode instead:",
                            inputName,
                            probeError
                        );
                    }
                }


                if (
                    audioConversionPaused
                ) {

                    await waitForAudioResume();


                    if (
                        audioConversionCancelled
                    ) {

                        throw new Error(
                            "AUDIO_CONVERSION_CANCELLED"
                        );
                    }
                }


                /* =========================
                   CONVERSION ARGUMENTS
                ========================= */

                const reencodeArgs =
                    getAudioConversionArgs(
                        format,
                        inputPath,
                        outputName
                    );


                const executionAttempts =
                    streamCopyPlan
                        ? [
                            {
                                mode:
                                    "stream-copy",

                                label:
                                    "Audio stream copy",

                                args:
                                    getAudioStreamCopyArgs(
                                        inputPath,
                                        outputName,
                                        streamCopyPlan
                                    )
                            },
                            {
                                mode:
                                    "reencode",

                                label:
                                    "Audio conversion",

                                args:
                                    reencodeArgs
                            }
                        ]
                        : [
                            {
                                mode:
                                    "reencode",

                                label:
                                    "Audio conversion",

                                args:
                                    reencodeArgs
                            }
                        ];


                /* =========================
                   REAL FFMPEG PROGRESS
                ========================= */

                const progressHandler =
                    (
                        {
                            progress
                        }
                    ) => {

                        const percentage =
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    progress *
                                    100
                                )
                            );


                        document.dispatchEvent(
                            new CustomEvent(
                                "easyfiletools:file-conversion-progress",
                                {
                                    detail: {

                                        index,

                                        percentage,

                                        progressLabel:
                                            "Converting"
                                    }
                                }
                            )
                        );
                    };


                ffmpeg.on(
                    "progress",
                    progressHandler
                );


                let fileWasPaused =
                    false;


                let usedStreamCopy =
                    false;


                let conversionSucceeded =
                    false;


                try {

                    for (
                        const attempt of
                            executionAttempts
                    ) {

                        try {

                            audioFFmpegExecuting =
                                true;


                            await execFFmpegOrThrow(
                                ffmpeg,
                                attempt.args,
                                attempt.label
                            );


                            usedStreamCopy =
                                attempt.mode ===
                                "stream-copy";


                            conversionSucceeded =
                                true;


                            break;

                        }
                        catch (
                            error
                        ) {

                            if (
                                audioConversionCancelled
                            ) {

                                throw new Error(
                                    "AUDIO_CONVERSION_CANCELLED"
                                );
                            }


                            if (
                                audioConversionPaused
                            ) {

                                console.log(
                                    "[AUDIO CONVERTER] Current file interrupted for pause:",
                                    inputName
                                );


                                fileWasPaused =
                                    true;


                                break;
                            }


                            if (
                                attempt.mode ===
                                    "stream-copy"
                            ) {

                                console.warn(
                                    "[AUDIO CONVERTER] Stream copy failed; falling back to normal re-encode:",
                                    inputName,
                                    error
                                );


                                try {
                                    await ffmpeg.deleteFile(
                                        outputName
                                    );
                                }
                                catch (_) {}


                                document.dispatchEvent(
                                    new CustomEvent(
                                        "easyfiletools:file-conversion-progress",
                                        {
                                            detail: {

                                                index,

                                                percentage:
                                                    0,

                                                progressLabel:
                                                    "Converting"
                                            }
                                        }
                                    )
                                );


                                continue;
                            }


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


                            throw error;
                        }
                        finally {

                            audioFFmpegExecuting =
                                false;
                        }
                    }
                }
                finally {

                    ffmpeg.off(
                        "progress",
                        progressHandler
                    );
                }


                if (
                    !fileWasPaused &&
                    !conversionSucceeded
                ) {

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


                    throw new Error(
                        "Audio conversion ended without producing a result."
                    );
                }


                /* =========================
                   PAUSE — WAIT AND RESTART FILE
                ========================= */

                if (
                    fileWasPaused
                ) {

                    await waitForAudioResume();


                    if (
                        audioConversionCancelled
                    ) {

                        throw new Error(
                            "AUDIO_CONVERSION_CANCELLED"
                        );
                    }


                    /*
                     * FFmpeg was terminated
                     * during Pause, so its mounted
                     * browser File disappeared with it.
                     */

                    inputHandle =
                        null;


                    ffmpeg =
                        await getFFmpeg();


                    document.dispatchEvent(
                        new CustomEvent(
                            "easyfiletools:file-conversion-progress",
                            {
                                detail: {

                                    index,

                                    percentage:
                                        0,

                                    progressLabel:
                                        "Converting"
                                }
                            }
                        )
                    );


                    /*
                     * Retry the same file.
                     */

                    index--;


                    continue;
                }


                /* =========================
                   READ OUTPUT
                ========================= */

                const outputData =
                    await ffmpeg.readFile(
                        outputName
                    );

                // FFmpeg's successful exit alone is not an output file.
                if (!outputData || !Number.isInteger(outputData.length) || outputData.length === 0) {
                    throw new Error("Audio conversion produced an empty or unreadable output.");
                }

                console.log(
                    "[AUDIO CONVERTER] Conversion completed:",
                    outputName,
                    outputData.length,
                    "bytes",
                    usedStreamCopy
                        ? "(stream copy, no re-encode)"
                        : "(re-encoded)"
                );


                /* =========================
                   CREATE RESULT
                ========================= */

                const outputBlob =
                    new Blob(
                        [
                            outputData.buffer
                        ],
                        {
                            type:
                                `audio/${format}`
                        }
                    );


                const outputUrl =
                    URL.createObjectURL(
                        outputBlob
                    );


                /*
                 * IMPORTANT:
                 *
                 * The engine does NOT store
                 * the result in fileData.
                 *
                 * EasyFileOperationResults
                 * is now the canonical result
                 * store.
                 */


                /* =========================
                   SEND CONVERTED FILE
                ========================= */

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:file-converted",
                        {
                            detail: {

                                index,

                                fileData,

                                sourceFile:
                                    inputFile,

                                sourceName:
                                    inputName,

                                outputName,

                                outputFormat:
                                    format,

                                blob:
                                    outputBlob,

                                url:
                                    outputUrl,

                                size:
                                    outputBlob.size,

                                streamCopy:
                                    usedStreamCopy
                            }
                        }
                    )
                );


                /* =========================
                   CLEAN FFMPEG MEMORY
                ========================= */

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


                await ffmpeg.deleteFile(
                    outputName
                );


                /* =========================
                   RESET FFMPEG FOR OPUS
                ========================= */

                if (
                    format ===
                        "opus" &&
                    index <
                        files.length -
                        1
                ) {

                    console.log(
                        "[AUDIO CONVERTER] Reloading FFmpeg before next OPUS file"
                    );


                    resetFFmpeg();


                    ffmpeg =
                        await getFFmpeg();
                }
            }


            console.log(
                "[AUDIO CONVERTER] All conversions completed:",
                files.length,
                "file(s)"
            );
        }
        catch (
            error
        ) {

            if (
                audioConversionCancelled
            ) {

                console.log(
                    "[AUDIO CONVERTER] Conversion cancelled by user"
                );


                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:conversion-cancelled",
                        {
                            detail: {

                                category:
                                    "Audio",

                                index:
                                    audioCurrentFileIndex
                            }
                        }
                    )
                );
            }
            else {

                console.error(
                    "[AUDIO CONVERTER] Conversion failed:",
                    error
                );
            }
        }
        finally {

            audioConversionRunning =
                false;


            document.dispatchEvent(
                new CustomEvent(
                    "easyfiletools:conversion-ended",
                    {
                        detail: {

                            category:
                                "Audio",

                            cancelled:
                                audioConversionCancelled
                        }
                    }
                )
            );


            audioCurrentFileIndex =
                -1;

            audioConversionCancelled =
                false;

            audioConversionPaused =
                false;

            audioResumeResolver =
                null;

            audioFFmpegExecuting =
                false;


            console.log(
                "[AUDIO CONVERTER] Conversion process released"
            );
        }
    }
);