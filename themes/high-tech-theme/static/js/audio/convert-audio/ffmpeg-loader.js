console.log(
    "[FFMPEG LOADER] ffmpeg-loader.js loaded"
);

let ffmpegInstance = null;
let ffmpegLoadingPromise = null;
let ffmpegGeneration = 0;


/* =========================
   GET FFMPEG INSTANCE
========================= */

async function getFFmpeg() {

    if (ffmpegInstance) {
        return ffmpegInstance;
    }

    if (ffmpegLoadingPromise) {
        return ffmpegLoadingPromise;
    }

    const generation = ffmpegGeneration;
    ffmpegLoadingPromise =
        (async () => {

            console.log(
                "[FFMPEG LOADER] Loading FFmpeg..."
            );

            if (
                typeof FFmpegWASM === "undefined" ||
                typeof FFmpegWASM.FFmpeg !== "function"
            ) {

                throw new Error(
                    "FFmpeg library is not available."
                );
            }

            const ffmpeg =
                new FFmpegWASM.FFmpeg();

            ffmpeg.on(
                "log",
                ({ message }) => {

                    console.log(
                        "[FFMPEG]",
                        message
                    );
                }
            );

            const baseURL =
                "/js/audio/convert-audio/lib";

            // R2 URL is injected by Hugo as a public meta value (HUGO_PARAMS_FFMPEGWASMURL).
            // When developing with the original local WASM, the former path still works.
            // Cloudflare builds are checked separately to forbid a missing R2 URL.
            const remoteWasmURL = (typeof document !== "undefined" ? document : null)?.querySelector(
                'meta[name="easyfile-ffmpeg-wasm-url"]'
            )?.content?.trim();

            if (remoteWasmURL && !/^https:\/\/[^\s]+$/.test(remoteWasmURL)) {
                throw new Error('Invalid FFmpeg R2 URL: HTTPS is required.');
            }

            const wasmURL = remoteWasmURL || `${baseURL}/ffmpeg-core.wasm`;
            await ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL
            });

            if (generation !== ffmpegGeneration) {
                ffmpeg.terminate();
                const error = new Error('FFmpeg loading interrupted.');
                error.name = 'ConversionCanceledError';
                throw error;
            }
            ffmpegInstance = ffmpeg;

            console.log(
                "[FFMPEG LOADER] FFmpeg loaded successfully"
            );

            return ffmpegInstance;
        })();

    const loading = ffmpegLoadingPromise;
    try {
        return await loading;
    }
    catch (error) {
        if (ffmpegLoadingPromise === loading) {
            ffmpegLoadingPromise = null;
        }

        console.error(
            "[FFMPEG LOADER] Loading failed:",
            error
        );

        throw error;
    }
}


/* =========================
   GENERIC FFMPEG FILESYSTEM HELPERS

   The Video engines use these small wrappers so they can share the same
   lazy-loaded FFmpeg instance as Audio without each engine duplicating
   loader/instance plumbing.
========================= */

async function writeFile(path, data) {
    const ffmpeg = await getFFmpeg();
    return ffmpeg.writeFile(path, data);
}

async function readFile(path, encoding) {
    const ffmpeg = await getFFmpeg();
    return ffmpeg.readFile(path, encoding);
}

async function deleteFile(path) {
    const ffmpeg = await getFFmpeg();
    return ffmpeg.deleteFile(path);
}

async function exec(args) {
    const ffmpeg = await getFFmpeg();
    return execFFmpegOrThrow(ffmpeg, args, "FFmpeg video operation");
}


/* =========================
   ROBUST FFMPEG EXECUTION
========================= */

async function execFFmpegOrThrow(
    ffmpeg,
    args,
    label = "FFmpeg command"
) {

    if (
        !ffmpeg ||
        typeof ffmpeg.exec !==
            "function"
    ) {

        throw new Error(
            `${label} cannot start because the FFmpeg instance is not available.`
        );

    }


    if (
        !Array.isArray(args) ||
        args.length === 0
    ) {

        throw new Error(
            `${label} cannot start because the FFmpeg arguments are invalid.`
        );

    }


    const command =
        args.map(value => String(value));

    const recentLogs = [];

    const logHandler =
        ({ message }) => {

            const line =
                String(message || "").trim();

            if (!line) {
                return;
            }

            recentLogs.push(line);

            if (recentLogs.length > 80) {
                recentLogs.shift();
            }

        };


    ffmpeg.on?.(
        "log",
        logHandler
    );


    console.debug(
        `[FFMPEG LOADER] ${label}:`,
        command.join(" ")
    );


    let exitCode;


    try {

        exitCode =
            await ffmpeg.exec(
                command
            );

    }
    catch (executionError) {

        const message =
            String(
                executionError?.message ||
                executionError ||
                ""
            );

        const isWasmRuntimeCrash =
            executionError instanceof WebAssembly.RuntimeError ||
            /memory access out of bounds|unreachable|wasm/i.test(
                message
            );

        if (isWasmRuntimeCrash) {

            const error =
                new Error(
                    `${label} crashed inside the WebAssembly runtime. ` +
                    `The FFmpeg instance was reset so the next operation can start cleanly.`
                );

            error.name =
                "FFmpegWasmRuntimeError";

            error.command =
                command;

            error.ffmpegLogs =
                recentLogs;

            error.cause =
                executionError;

            console.error(
                `[FFMPEG LOADER] ${label} WASM runtime crash`,
                {
                    command,
                    logs: recentLogs,
                    cause: executionError
                }
            );

            try {
                resetFFmpeg();
            }
            catch (_) {}

            throw error;
        }

        throw executionError;

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
        typeof exitCode !==
            "number" ||
        !Number.isFinite(
            exitCode
        )
    ) {

        const error =
            new Error(
                `${label} failed because FFmpeg returned an invalid exit code.`
            );


        error.name =
            "FFmpegExecutionError";

        error.exitCode =
            exitCode;

        error.command =
            command;

        error.ffmpegLogs =
            recentLogs;

        throw error;

    }


    if (
        exitCode !== 0
    ) {

        const usefulTail =
            recentLogs
                .slice(-3)
                .join(" | ");

        const error =
            new Error(
                usefulTail
                    ? `${label} failed with FFmpeg exit code ${exitCode}. ${usefulTail}`
                    : `${label} failed with FFmpeg exit code ${exitCode}.`
            );


        error.name =
            "FFmpegExecutionError";

        error.exitCode =
            exitCode;

        error.command =
            command;

        error.ffmpegLogs =
            recentLogs;

        console.error(
            `[FFMPEG LOADER] ${label} failed`,
            {
                exitCode,
                command,
                logs: recentLogs
            }
        );

        /* The underlying WASM process may have aborted without throwing.
           Do not leave a poisoned worker alive for the next operation. */
        if (/out of memory|cannot enlarge memory|memory access out of bounds|aborted\(|abort\(|unreachable|failed to inject frame/i.test(recentLogs.join(" | "))) {
            error.name = "FFmpegWasmRuntimeError";
            resetFFmpeg();
        }

        throw error;

    }


    return exitCode;
}


/* =========================
   AUDIO FILE PROBE
========================= */

let ffprobeOutputCounter = 0;


function createFFprobeOutputPath() {

    ffprobeOutputCounter +=
        1;


    return (
        `easyfile_ffprobe_${Date.now()}_` +
        `${ffprobeOutputCounter}.json`
    );
}


async function probeAudioFile(
    ffmpeg,
    inputPath,
    label = "Audio inspection"
) {

    if (
        typeof inputPath !==
            "string" ||
        inputPath.trim() === ""
    ) {

        throw new Error(
            `${label} cannot start because the input path is invalid.`
        );

    }


    if (
        !ffmpeg ||
        typeof ffmpeg.ffprobe !==
            "function" ||
        typeof ffmpeg.readFile !==
            "function"
    ) {

        throw new Error(
            `${label} cannot start because FFprobe is not available.`
        );

    }


    const outputPath =
        createFFprobeOutputPath();

    let exitCode = null;
    let executionError = null;


    try {

        /*
         * ffmpeg.wasm currently has a known FFprobe quirk where
         * ffmpeg.ffprobe() may return -1 even though FFprobe actually
         * completed and produced valid output.  Therefore the JSON
         * output itself is the source of truth here; the exit code is
         * retained only to improve diagnostics when no usable output
         * can be read.
         */
        try {

            exitCode =
                await ffmpeg.ffprobe(
                    [
                        "-v",
                        "error",
                        "-select_streams",
                        "a:0",
                        "-show_entries",
                        "stream=index,codec_type,codec_name,codec_long_name,profile,codec_tag_string,sample_fmt,sample_rate,channels,channel_layout,bits_per_sample,time_base,start_time,duration,bit_rate,extradata_size,extradata_hash:format=format_name,format_long_name,start_time,duration,size,bit_rate",
                        "-show_data_hash",
                        "md5",
                        "-of",
                        "json",
                        inputPath,
                        "-o",
                        outputPath
                    ]
                );

        }
        catch (error) {

            executionError =
                error;

        }


        let rawOutput = "";
        let readError = null;


        try {

            const output =
                await ffmpeg.readFile(
                    outputPath,
                    "utf8"
                );


            rawOutput =
                typeof output ===
                    "string"
                    ? output.trim()
                    : "";

        }
        catch (error) {

            readError =
                error;

        }


        if (
            rawOutput === ""
        ) {

            if (
                executionError
            ) {

                throw executionError;

            }


            const error =
                new Error(
                    Number.isFinite(exitCode)
                        ? `${label} failed with FFprobe exit code ${exitCode} and produced no usable JSON output.`
                        : `${label} failed because FFprobe produced no usable JSON output.`
                );


            error.name =
                "FFprobeExecutionError";

            error.exitCode =
                exitCode;

            error.cause =
                readError;

            throw error;

        }


        let probeData;


        try {

            probeData =
                JSON.parse(
                    rawOutput
                );

        }
        catch (parseError) {

            const error =
                new Error(
                    `${label} failed because FFprobe returned invalid JSON.`
                );


            error.name =
                "FFprobeParseError";

            error.exitCode =
                exitCode;

            error.cause =
                parseError;

            error.rawOutput =
                rawOutput;

            throw error;

        }


        const stream =
            Array.isArray(
                probeData.streams
            )
                ? probeData.streams[0] || null
                : null;

        const format =
            probeData.format &&
            typeof probeData.format ===
                "object"
                ? probeData.format
                : {};


        if (
            !stream
        ) {

            const error =
                new Error(
                    `${label} failed because no audio stream was found.`
                );


            error.name =
                "FFprobeNoAudioStreamError";

            error.exitCode =
                exitCode;

            throw error;

        }


        if (
            exitCode !== 0 &&
            Number.isFinite(exitCode)
        ) {

            console.debug(
                `[FFMPEG LOADER] ${label}: FFprobe returned ${exitCode}, but valid probe data was produced; accepting the probe result.`
            );

        }


        const toFiniteNumber =
            value => {

                if (
                    value === undefined ||
                    value === null ||
                    value === "" ||
                    value === "N/A"
                ) {

                    return null;

                }


                const number =
                    Number(value);

                return Number.isFinite(
                    number
                )
                    ? number
                    : null;
            };


        const formatNames =
            typeof format.format_name ===
                "string"
                ? format.format_name
                    .split(",")
                    .map(
                        value =>
                            value.trim()
                    )
                    .filter(Boolean)
                : [];


        return {
            codecName:
                stream.codec_name ||
                null,

            codecLongName:
                stream.codec_long_name ||
                null,

            codecProfile:
                stream.profile ||
                null,

            codecTag:
                stream.codec_tag_string ||
                null,

            sampleFormat:
                stream.sample_fmt ||
                null,

            sampleRate:
                toFiniteNumber(
                    stream.sample_rate
                ),

            channels:
                toFiniteNumber(
                    stream.channels
                ),

            channelLayout:
                stream.channel_layout ||
                null,

            bitsPerSample:
                toFiniteNumber(
                    stream.bits_per_sample
                ),

            timeBase:
                stream.time_base ||
                null,

            streamStartTime:
                toFiniteNumber(
                    stream.start_time
                ),

            streamDuration:
                toFiniteNumber(
                    stream.duration
                ),

            streamBitRate:
                toFiniteNumber(
                    stream.bit_rate
                ),

            extradataSize:
                toFiniteNumber(
                    stream.extradata_size
                ),

            extradataHash:
                stream.extradata_hash ||
                null,

            formatNames,

            formatName:
                formatNames[0] ||
                null,

            formatLongName:
                format.format_long_name ||
                null,

            formatStartTime:
                toFiniteNumber(
                    format.start_time
                ),

            duration:
                toFiniteNumber(
                    format.duration
                ) ??
                toFiniteNumber(
                    stream.duration
                ),

            bitRate:
                toFiniteNumber(
                    format.bit_rate
                ) ??
                toFiniteNumber(
                    stream.bit_rate
                ),

            size:
                toFiniteNumber(
                    format.size
                ),

            raw:
                probeData
        };

    }
    finally {

        if (
            typeof ffmpeg?.deleteFile ===
                "function"
        ) {

            try {

                await ffmpeg.deleteFile(
                    outputPath
                );

            }
            catch {

                // The output file may not exist if FFprobe failed early.

            }

        }

    }
}


/* =========================
   MEMORY-EFFICIENT INPUT FILES
========================= */

let ffmpegInputMountCounter = 0;


function createFFmpegInputMountPoint(
    label = "input"
) {

    ffmpegInputMountCounter +=
        1;


    const safeLabel =
        String(label)
            .toLowerCase()
            .replace(
                /[^a-z0-9_-]+/g,
                "_"
            )
            .replace(
                /^_+|_+$/g,
                ""
            ) ||
        "input";


    return (
        `/easyfile_${safeLabel}_` +
        `${Date.now()}_` +
        `${ffmpegInputMountCounter}`
    );
}


function normalizeFFmpegInputName(
    name,
    index
) {

    const normalized =
        String(
            name ||
            `input_${index}`
        )
            .replace(
                /[\\/\0]/g,
                "_"
            )
            .trim();


    return normalized ||
        `input_${index}`;
}


async function prepareFFmpegInputFiles(
    ffmpeg,
    entries,
    options = {}
) {

    if (
        !ffmpeg ||
        !Array.isArray(entries) ||
        entries.length === 0
    ) {

        throw new Error(
            "FFmpeg input preparation received invalid arguments."
        );

    }


    const label =
        options.label ||
        "FFmpeg input";


    const normalizedEntries =
        entries.map(
            (entry, index) => {

                const file =
                    entry?.file;


                if (
                    !(file instanceof Blob)
                ) {

                    throw new Error(
                        `${label} #${index + 1} is not a valid File or Blob.`
                    );

                }


                return {
                    file,

                    name:
                        normalizeFFmpegInputName(
                            entry?.name,
                            index
                        )
                };
            }
        );


    const requestedMountPoint =
        typeof options.mountPoint ===
            "string" &&
        options.mountPoint.trim() !==
            ""
            ? options.mountPoint
            : null;


    const mountPoint =
        requestedMountPoint ||
        createFFmpegInputMountPoint(
            options.mountLabel ||
            "inputs"
        );


    const canUseWorkerFS =
        typeof ffmpeg.createDir ===
            "function" &&
        typeof ffmpeg.mount ===
            "function" &&
        typeof ffmpeg.unmount ===
            "function" &&
        typeof ffmpeg.deleteDir ===
            "function";


    if (
        canUseWorkerFS
    ) {

        let directoryCreated =
            false;


        try {

            await ffmpeg.createDir(
                mountPoint
            );


            directoryCreated =
                true;


            const workerFSType =
                (
                    typeof FFmpegWASM !==
                        "undefined" &&
                    FFmpegWASM.FFFSType?.WORKERFS
                ) ||
                "WORKERFS";


            const mounted =
                await ffmpeg.mount(
                    workerFSType,
                    {
                        blobs:
                            normalizedEntries.map(
                                entry => ({
                                    name:
                                        entry.name,

                                    data:
                                        entry.file
                                })
                            )
                    },
                    mountPoint
                );


            if (
                mounted !== true
            ) {

                throw new Error(
                    "WORKERFS is not available in the loaded FFmpeg core."
                );

            }


            console.log(
                `[FFMPEG LOADER] ${label}: using WORKERFS for ${normalizedEntries.length} input file(s).`
            );


            return {
                ffmpeg,

                mode:
                    "workerfs",

                mountPoint,

                paths:
                    normalizedEntries.map(
                        entry =>
                            `${mountPoint}/${entry.name}`
                    ),

                names:
                    normalizedEntries.map(
                        entry =>
                            entry.name
                    )
            };

        }
        catch (workerFSError) {

            console.warn(
                `[FFMPEG LOADER] ${label}: WORKERFS unavailable, falling back to MEMFS.`,
                workerFSError
            );


            if (
                directoryCreated
            ) {

                try {
                    await ffmpeg.unmount(
                        mountPoint
                    );
                }
                catch (_) {}


                try {
                    await ffmpeg.deleteDir(
                        mountPoint
                    );
                }
                catch (_) {}

            }

        }

    }


    const paths =
        [];


    let fallbackDirectoryCreated =
        false;


    try {

        if (
            typeof ffmpeg.createDir ===
                "function"
        ) {

            await ffmpeg.createDir(
                mountPoint
            );


            fallbackDirectoryCreated =
                true;

        }


        for (
            let index = 0;
            index < normalizedEntries.length;
            index++
        ) {

            const entry =
                normalizedEntries[index];


            const data =
                new Uint8Array(
                    await entry.file
                        .arrayBuffer()
                );


            const path =
                fallbackDirectoryCreated
                    ? `${mountPoint}/${entry.name}`
                    : entry.name;


            await ffmpeg.writeFile(
                path,
                data
            );


            paths.push(
                path
            );

        }


        console.log(
            `[FFMPEG LOADER] ${label}: using MEMFS fallback for ${normalizedEntries.length} input file(s).`
        );


        return {
            ffmpeg,

            mode:
                "memfs",

            mountPoint:
                fallbackDirectoryCreated
                    ? mountPoint
                    : null,

            paths,

            names:
                normalizedEntries.map(
                    entry =>
                        entry.name
                )
        };

    }
    catch (fallbackError) {

        for (
            const path of paths
        ) {

            try {
                await ffmpeg.deleteFile(
                    path
                );
            }
            catch (_) {}

        }


        if (
            fallbackDirectoryCreated &&
            typeof ffmpeg.deleteDir ===
                "function"
        ) {

            try {
                await ffmpeg.deleteDir(
                    mountPoint
                );
            }
            catch (_) {}

        }


        throw fallbackError;

    }
}


async function releaseFFmpegInputFiles(
    handle
) {

    if (
        !handle ||
        !handle.ffmpeg
    ) {
        return;
    }


    const ffmpeg =
        handle.ffmpeg;


    if (
        handle.mode ===
            "workerfs"
    ) {

        try {
            await ffmpeg.unmount(
                handle.mountPoint
            );
        }
        catch (_) {}


        try {
            await ffmpeg.deleteDir(
                handle.mountPoint
            );
        }
        catch (_) {}


        return;

    }


    if (
        handle.mode ===
            "memfs"
    ) {

        for (
            const path of
                handle.paths || []
        ) {

            try {
                await ffmpeg.deleteFile(
                    path
                );
            }
            catch (_) {}

        }


        if (
            handle.mountPoint &&
            typeof ffmpeg.deleteDir ===
                "function"
        ) {

            try {
                await ffmpeg.deleteDir(
                    handle.mountPoint
                );
            }
            catch (_) {}

        }

    }
}


/* =========================
   RESET FFMPEG
========================= */

function resetFFmpeg() {
    // Invalidate in-flight loads, too: a cancelled worker must not reappear
    // after a Pause/Cancel while ffmpeg-core.wasm is still initializing.
    ++ffmpegGeneration;
    if (ffmpegInstance) {

        try {
            ffmpegInstance.terminate();
        }
        catch (_) {
            // A crashed WASM worker may already be gone.
        }

    }

    ffmpegInstance =
        null;

    ffmpegLoadingPromise =
        null;

    console.log(
        "[FFMPEG LOADER] FFmpeg reset"
    );
}