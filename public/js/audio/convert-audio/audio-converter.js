console.log(
    "[AUDIO CONVERTER] audio-converter.js loaded"
);

let audioConversionRunning = false;

let audioConversionCancelled = false;

let audioCurrentFileIndex = -1;

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

    const specialFormats = {

        opus: [
            "-i",
            inputName,
            "-c:a",
            "libopus",
            "-ar",
            "24000",
            outputName
        ],

        m4b: [
            "-i",
            inputName,
            "-c:a",
            "aac",
            "-f",
            "mp4",
            "-movflags",
            "+faststart",
            outputName
        ],

        wv: [
            "-i",
            inputName,
            "-c:a",
            "wavpack",
            "-f",
            "wv",
            outputName
        ],

        tta: [
            "-i",
            inputName,
            "-c:a",
            "tta",
            "-f",
            "tta",
            outputName
        ],

        voc: [
            "-i",
            inputName,
            "-c:a",
            "pcm_s16le",
            "-f",
            "voc",
            outputName
        ],

        ra: [
            "-i",
            inputName,
            "-c:a",
            "ac3",
            "-f",
            "rm",
            outputName
        ],

        rm: [
            "-i",
            inputName,
            "-c:a",
            "ac3",
            "-f",
            "rm",
            outputName
        ],

        snd: [
            "-i",
            inputName,
            "-f",
            "au",
            outputName
        ]

    };

    if (
        specialFormats[format]
    ) {

        return specialFormats[format];

    }

    return [
        "-i",
        inputName,
        outputName
    ];
}

/* =========================
   WAIT FOR RESUME
========================= */

function waitForAudioResume() {

    if (!audioConversionPaused) {
        return Promise.resolve();
    }

    return new Promise(
        (resolve) => {

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
    (event) => {

        const category =
            event.detail?.category || "";

        if (
            category.toLowerCase() !==
            "audio"
        ) {
            return;
        }

        if (!audioConversionRunning) {
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

        if (audioResumeResolver) {

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
    (event) => {

        const category =
            event.detail?.category || "";

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
        FFmpeg est interrompu uniquement
        s'il est réellement en train
        d'exécuter la conversion.
        */

        if (audioFFmpegExecuting) {

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
    (event) => {

        const category =
            event.detail?.category || "";

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

        if (audioResumeResolver) {

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
    async (event) => {

        if (audioConversionRunning) {

            console.warn(
                "[AUDIO CONVERTER] Conversion already running"
            );

            return;
        }

        const detail =
            event.detail || {};

        const category =
            detail.category || "";

        const files =
            detail.files || [];

        const format =
            detail.format || null;


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

                format:
                    format
            }
        );


        /* =========================
           FFMPEG
        ========================= */
        
        audioConversionRunning = true;

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
                        category: "Audio"
                    }
                }
            )
        );

        try {

            let ffmpeg =
                await getFFmpeg();

            if (audioConversionCancelled) {

                resetFFmpeg();

                throw new Error(
                    "AUDIO_CONVERSION_CANCELLED"
                );
            }

            /* =========================
            RESET BEFORE OPUS
            ========================= */

            if (format === "opus") {

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

                if (audioConversionCancelled) {

                    throw new Error(
                        "AUDIO_CONVERSION_CANCELLED"
                    );
                }

                audioCurrentFileIndex =
                    index;

                    if (audioConversionPaused) {

                        await waitForAudioResume();

                        if (audioConversionCancelled) {

                            throw new Error(
                                "AUDIO_CONVERSION_CANCELLED"
                            );
                        }
                    }

                const fileData =
                    files[index];

                const inputFile =
                    fileData?.file;

                if (!inputFile) {

                    console.warn(
                        "[AUDIO CONVERTER] Invalid file skipped:",
                        index
                    );

                    continue;
                }


                /* =========================
                SKIP ALREADY CONVERTED FILE
                ========================= */

                if (
                    fileData.convertedUrl &&
                    fileData.convertedFormat === format
                ) {

                    console.log(
                        `[AUDIO CONVERTER] File ${index + 1}/${files.length} already converted to ${format.toUpperCase()} — skipped:`,
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
                            inputName.lastIndexOf(".")
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
                                index: index,
                                percentage: 0
                            }
                        }
                    )
                );

                /* =========================
                WRITE INPUT
                ========================= */

                const inputData =
                    new Uint8Array(
                        await inputFile.arrayBuffer()
                    );

                await ffmpeg.writeFile(
                    inputName,
                    inputData
                );

                /* =========================
                CONVERT
                ========================= */

                const ffmpegArgs =
                    getAudioConversionArgs(
                        format,
                        inputName,
                        outputName
                    );


                /* =========================
                REAL FFMPEG PROGRESS
                ========================= */

                const progressHandler =
                    ({ progress }) => {

                        const percentage =
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    progress * 100
                                )
                            );

                        document.dispatchEvent(
                            new CustomEvent(
                                "easyfiletools:file-conversion-progress",
                                {
                                    detail: {
                                        index:
                                            index,

                                        percentage:
                                            percentage
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

                try {

                    audioFFmpegExecuting =
                        true;

                    await ffmpeg.exec(
                        ffmpegArgs
                    );

                }
                catch (error) {

                    if (audioConversionCancelled) {

                        throw new Error(
                            "AUDIO_CONVERSION_CANCELLED"
                        );
                    }

                    if (audioConversionPaused) {

                        console.log(
                            "[AUDIO CONVERTER] Current file interrupted for pause:",
                            inputName
                        );

                        fileWasPaused =
                            true;
                    }
                    else {

                        throw error;
                    }

                }
                finally {

                    audioFFmpegExecuting =
                        false;

                    ffmpeg.off(
                        "progress",
                        progressHandler
                    );
                }                

                /* =========================
                PAUSE — WAIT AND RESTART FILE
                ========================= */

                if (fileWasPaused) {

                    await waitForAudioResume();

                    if (audioConversionCancelled) {

                        throw new Error(
                            "AUDIO_CONVERSION_CANCELLED"
                        );
                    }

                    /*
                    FFmpeg a été terminé pendant Pause.
                    On crée donc une nouvelle instance.
                    */

                    ffmpeg =
                        await getFFmpeg();

                    /*
                    Le fichier interrompu doit repartir
                    depuis 0 %.
                    */

                    document.dispatchEvent(
                        new CustomEvent(
                            "easyfiletools:file-conversion-progress",
                            {
                                detail: {
                                    index:
                                        index,

                                    percentage:
                                        0
                                }
                            }
                        )
                    );

                    /*
                    index-- compense le index++ automatique
                    du for : le même fichier sera donc
                    retraité.
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


                console.log(
                    "[AUDIO CONVERTER] Conversion completed:",
                    outputName,
                    outputData.length,
                    "bytes"
                );


                /* =========================
                CREATE DOWNLOAD
                ========================= */

                const outputBlob =
                    new Blob(
                        [outputData.buffer],
                        {
                            type:
                                `audio/${format}`
                        }
                    );

                const outputUrl =
                    URL.createObjectURL(
                        outputBlob
                    );

                /* =========================
                STORE CONVERSION RESULT
                ========================= */

                fileData.convertedUrl =
                    outputUrl;

                fileData.convertedName =
                    outputName;

                fileData.convertedFormat =
                    format;

                fileData.convertedBlob =
                    outputBlob;

                /* =========================
                SEND CONVERTED FILE
                ========================= */

                document.dispatchEvent(
                    new CustomEvent(
                        "easyfiletools:file-converted",
                        {
                            detail: {

                                index:
                                    index,

                                fileData:
                                    fileData,

                                sourceFile:
                                    inputFile,

                                sourceName:
                                    inputName,

                                outputName:
                                    outputName,

                                outputFormat:
                                    format,

                                blob:
                                    outputBlob,

                                url:
                                    outputUrl,

                                size:
                                    outputBlob.size
                            }
                        }
                    )
                );

                /* =========================
                CLEAN FFMPEG MEMORY
                ========================= */

                await ffmpeg.deleteFile(
                    inputName
                );

                await ffmpeg.deleteFile(
                    outputName
                );

                /* =========================
                RESET FFMPEG FOR OPUS
                ========================= */

                if (
                    format === "opus" &&
                    index < files.length - 1
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

        catch (error) {

            if (audioConversionCancelled) {

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