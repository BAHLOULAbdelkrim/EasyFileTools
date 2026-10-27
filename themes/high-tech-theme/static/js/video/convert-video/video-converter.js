console.log(
    "[VIDEO CONVERTER] video-converter.js loaded"
);


(() => {

    "use strict";


    const state = {

        running: false,

        paused: false,

        cancelled: false,

        currentIndex: -1,
        webCodecsUnavailable: false,
        pauseRestartPending: false

    };


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


    function mimeFor(format) {

        const map = {

            mp4: "video/mp4",
            webm: "video/webm",
            mkv: "video/x-matroska",
            mov: "video/quicktime",
            avi: "video/x-msvideo"

        };


        return map[format] ||
            "application/octet-stream";

    }


    function qualityValue(
        quality
    ) {

        return {

            high: 20,
            medium: 24,
            balanced: 24,
            low: 28,
            small: 28

        }[quality] || 24;

    }


    function scaleArgs(
        resolution
    ) {

        if (
            resolution ===
            "original"
        ) {

            return [];

        }


        return [

            "-vf",

            `scale=-2:min(${resolution}\\,ih)`

        ];

    }


    function encodingArgs(
        settings
    ) {

        const crf =
            qualityValue(
                settings.quality
            );


        const audio =
            settings.keepAudio;


        switch (
            settings.format
        ) {

            case "webm":

                /*
                 * Stability profile for the current ffmpeg.wasm core:
                 * libvpx-vp9 is known to trigger WASM "memory access out
                 * of bounds" crashes during MP4 -> WebM transcoding.
                 * VP8 remains a valid WebM video codec and is substantially
                 * more reliable with this single-thread browser core.
                 */
                return [

                    "-c:v",
                    "libvpx",

                    "-deadline",
                    settings.quality === "fast" ? "realtime" : "good",

                    "-cpu-used",
                    settings.quality === "fast" ? "8" : "4",

                    "-threads",
                    "1",

                    "-crf",
                    String(settings.quality === "fast" ? 36 : crf + 6),

                    "-b:v",
                    "0",

                    ...(audio
                        ? [
                            "-c:a",
                            "libopus",
                            "-b:a",
                            "128k",
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
                    settings.quality === "high"
                        ? "3"
                        : ["balanced", "medium"].includes(settings.quality)
                            ? "5"
                            : "7",

                    ...(audio
                        ? [
                            "-c:a",
                            "libmp3lame",
                            "-b:a",
                            "160k"
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
                    settings.quality === "fast" ? "ultrafast" : "veryfast",

                    "-crf",
                    String(settings.quality === "fast" ? 27 : crf),

                    "-pix_fmt",
                    "yuv420p",

                    ...(audio
                        ? [
                            "-c:a",
                            "aac",
                            "-b:a",
                            "160k"
                        ]
                        : [
                            "-an"
                        ])

                ];

        }

    }


    /* Fast stream copy is valid only for codecs supported by the destination.
       Extensions alone do not reveal video/audio codecs; probe the real file. */
    async function probeStreams(ffmpeg, inputName) {
        if (typeof ffmpeg.ffprobe !== "function") return null;
        const output = `eft_video_probe_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
        try {
            // Some ffmpeg.wasm builds return -1 on ffprobe success; read actual JSON.
            try {
                await ffmpeg.ffprobe([
                    "-v", "error", "-show_entries", "stream=codec_type,codec_name",
                    "-of", "json", inputName, "-o", output
                ]);
            } catch (_) { /* A JSON result may still have been written. */ }
            const data = await ffmpeg.readFile(output, "utf8");
            const result = JSON.parse(typeof data === "string" ? data : "");
            return Array.isArray(result.streams) ? result.streams : null;
        } catch (_) {
            return null;
        } finally {
            try { await ffmpeg.deleteFile(output); } catch (_) {}
        }
    }

    function getFastCopyProfile(streams, settings) {
        if (!streams || settings.fastCopy === false ||
            settings.resolution !== "original") return null;
        const video = streams.find(s => s.codec_type === "video");
        const audio = streams.find(s => s.codec_type === "audio");
        if (!video) return null;
        const videoCodec = String(video.codec_name || "").toLowerCase();
        const audioCodec = String(audio?.codec_name || "").toLowerCase();
        const videoAllowed = {
            mp4: ["h264", "hevc", "av1", "mpeg4"],
            mov: ["h264", "hevc", "mpeg4", "prores", "mjpeg"],
            webm: ["vp8", "vp9", "av1"],
            avi: ["mpeg4", "mjpeg", "h264"],
            mkv: null // Matroska supports virtually all FFmpeg codecs.
        };
        if (!(settings.format in videoAllowed)) return null;
        const allowed = videoAllowed[settings.format];
        if (allowed && !allowed.includes(videoCodec)) return null;
        const audioAllowed = {
            mp4: ["aac", "mp3", "alac"],
            mov: ["aac", "mp3", "alac", "pcm_s16le"],
            webm: ["opus", "vorbis"],
            avi: ["mp3", "pcm_s16le", "mp2"],
            mkv: null
        };
        const validAudio = !audio || !settings.keepAudio ||
            !audioAllowed[settings.format] ||
            audioAllowed[settings.format].includes(audioCodec);
        return { copyAudio: validAudio, videoCodec, audioCodec };
    }

    function fastCopyArgs(inputName, settings, profile) {
        const args = [
            "-i", inputName,
            "-map", "0:v:0",
            ...(settings.keepAudio ? ["-map", "0:a:0?"] : []),
            "-sn", "-dn", "-c:v", "copy"
        ];
        if (!settings.keepAudio) args.push("-an");
        else if (profile.copyAudio) args.push("-c:a", "copy");
        else {
            const codec = settings.format === "webm" ? "libopus" :
                settings.format === "avi" ? "libmp3lame" : "aac";
            args.push("-c:a", codec, "-b:a", "128k");
        }
        return args;
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


    // WebM uses WebCodecs first. No FFmpeg worker is loaded on a successful
    // WebCodecs path; other containers continue using the existing FFmpeg engine.
    async function convertOne(file, index, settings) {
        if (settings.format === "webm" && !state.webCodecsUnavailable &&
            window.EasyFileWebCodecs?.convertFile) {
            try {
                const webResult = await window.EasyFileWebCodecs.convertFile(
                    file,
                    settings,
                    percentage => emit("easyfiletools:video-convert-progress", {
                        index,
                        percentage
                    })
                );
                if (state.cancelled || state.paused) {
                    throw new Error("VIDEO_CONVERSION_INTERRUPTED");
                }
                if (!webResult?.blob || !webResult.blob.size) {
                    throw new Error("Empty WebCodecs output");
                }
                console.info("[VIDEO] WebCodecs completed", {
                    codec: webResult.codec,
                    mode: webResult.mode,
                    quality: settings.quality
                });
                return {
                    blob: webResult.blob,
                    outputUrl: URL.createObjectURL(webResult.blob),
                    outputName: `${baseName(file.name)}.webm`,
                    outputFormat: "webm",
                    outputSize: webResult.blob.size
                };
            } catch (webError) {
                // Pause/Cancel aborts MUST NOT silently start FFmpeg.
                if (state.paused || state.cancelled ||
                    webError?.name === "ConversionCanceledError" ||
                    webError?.message === "VIDEO_CONVERSION_INTERRUPTED") {
                    throw webError;
                }
                // A codec, decoder, library loading or muxing failure is recoverable:
                // try the established FFmpeg route, once, for this input.
                console.warn("[VIDEO] WebCodecs unavailable; FFmpeg fallback:", webError);
                if (webError?.code === "WEB_CODECS_LIBRARY_UNAVAILABLE" ||
                    webError?.code === "WEB_CODECS_ENV_UNAVAILABLE") {
                    state.webCodecsUnavailable = true;
                }
            }
        }
        return convertOneFFmpeg(file, index, settings);
    }

    async function convertOneFFmpeg(
        file,
        index,
        settings
    ) {

        const ffmpeg =
            await getFFmpeg();


        const inputExt =
            extensionOf(
                file.name
            ) || "video";


        const inputName =
            `video_convert_${index}_input.${inputExt}`;


        const outputNameFs =
            `video_convert_${index}.${settings.format}`;


        await writeFile(
            inputName,
            new Uint8Array(
                await file.arrayBuffer()
            )
        );


        const handler =
            ({ progress }) => {

                emit(
                    "easyfiletools:video-convert-progress",
                    {
                        index,

                        percentage:
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    Math.round(
                                        progress *
                                        100
                                    )
                                )
                            )
                    }
                );

            };


        ffmpeg.on(
            "progress",
            handler
        );


        try {
            const streams = settings.fastCopy !== false
                ? await probeStreams(ffmpeg, inputName)
                : null;
            const copyProfile = getFastCopyProfile(streams, settings);
            const args = copyProfile
                ? fastCopyArgs(inputName, settings, copyProfile)
                : [
                    "-i", inputName,
                    "-map", "0:v:0",
                    ...(settings.keepAudio ? ["-map", "0:a:0?"] : []),
                    "-sn", "-dn",
                    ...scaleArgs(settings.resolution),
                    ...encodingArgs(settings)
                ];
            console.info("[VIDEO] Processing mode:",
                copyProfile ? "compatible stream copy" : "re-encode", {
                    format: settings.format,
                    quality: settings.quality,
                    sourceVideo: copyProfile?.videoCodec || "not copied"
                });

            if (
                settings.format === "mp4" ||
                settings.format === "mov"
            ) {

                args.push(
                    "-movflags",
                    "+faststart"
                );

            }


            args.push(
                outputNameFs
            );


            try {
                await exec(args);
            }
            catch (copyError) {
                // A codec can probe as nominally compatible while a muxer
                // rejects this particular bitstream. Recover once by encoding.
                // Fatal WASM/OOM errors must never be silently retried.
                if (!copyProfile || copyError?.name === "FFmpegWasmRuntimeError") {
                    throw copyError;
                }
                console.warn("[VIDEO] Stream copy failed; retrying with encoder:", copyError);
                try { await ffmpeg.deleteFile(outputNameFs); } catch (_) {}
                const transcodeArgs = [
                    "-i", inputName,
                    "-map", "0:v:0",
                    ...(settings.keepAudio ? ["-map", "0:a:0?"] : []),
                    "-sn", "-dn",
                    ...scaleArgs(settings.resolution),
                    ...encodingArgs(settings)
                ];
                if (settings.format === "mp4" || settings.format === "mov") {
                    transcodeArgs.push("-movflags", "+faststart");
                }
                transcodeArgs.push(outputNameFs);
                await exec(transcodeArgs);
            }


            const data =
                await readFile(
                    outputNameFs
                );


            const blob =
                new Blob(
                    [data],
                    {
                        type:
                            mimeFor(
                                settings.format
                            )
                    }
                );


            return {

                blob,

                outputUrl:
                    URL.createObjectURL(
                        blob
                    ),

                outputName:
                    `${
                        baseName(
                            file.name
                        )
                    }.${settings.format}`,

                outputFormat:
                    settings.format,

                outputSize:
                    blob.size

            };

        }
        finally {

            try {

                ffmpeg.off?.(
                    "progress",
                    handler
                );

            }
            catch (_) {}


            try {

                await ffmpeg.deleteFile(inputName);
                await ffmpeg.deleteFile(outputNameFs);

            }
            catch (_) {}

        }

    }


    async function convertFiles(
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


        state.running = true;
        state.paused = false;
        state.cancelled = false;
        state.webCodecsUnavailable = false;
        state.pauseRestartPending = false;


        emit(
            "easyfiletools:video-conversion-started"
        );


        let error =
            null;


        try {

            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                state.currentIndex =
                    index;


                let completed =
                    false;


                while (
                    !completed
                ) {

                    if (
                        state.cancelled
                    ) {

                        throw new Error(
                            "VIDEO_CONVERSION_CANCELLED"
                        );

                    }


                    if (
                        state.paused
                    ) {

                        await new Promise(
                            resolve => {

                                const wait =
                                    setInterval(
                                        () => {

                                            if (
                                                !state.paused ||
                                                state.cancelled
                                            ) {

                                                clearInterval(
                                                    wait
                                                );


                                                resolve();

                                            }

                                        },
                                        100
                                    );

                            }
                        );


                        continue;

                    }


                    try {

                        const result =
                            await convertOne(
                                files[index],
                                index,
                                settings
                            );


                        emit(
                            "easyfiletools:video-convert-complete",
                            {
                                index,

                                file:
                                    files[index],

                                result
                            }
                        );


                        completed =
                            true;

                    }
                    catch (conversionError) {

                        if (state.paused || state.pauseRestartPending) {
                            // A quick Pause → Resume can finish cancelling
                            // after Resume has already cleared state.paused.
                            // Restart this file rather than reporting failure.
                            state.pauseRestartPending = false;
                            continue;
                        }

                        if (
                            state.cancelled
                        ) {

                            throw new Error(
                                "VIDEO_CONVERSION_CANCELLED"
                            );

                        }


                        throw conversionError;

                    }

                }

            }

        }
        catch (caught) {

            if (
                caught.message !==
                "VIDEO_CONVERSION_CANCELLED"
            ) {

                error =
                    caught;


                console.error(
                    "[VIDEO CONVERTER]",
                    caught
                );

            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running = false;
            state.paused = false;
            state.pauseRestartPending = false;
            state.currentIndex = -1;

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
                "easyfiletools:video-conversion-ended",
                {
                    cancelled,

                    error
                }
            );

        }

    }


    async function pause() {

        if (
            !state.running ||
            state.paused
        ) {

            return;
        }


        state.paused = true;
        state.pauseRestartPending = true;

        try { await window.EasyFileWebCodecs?.cancel?.(); } catch (_) {}

        try {

            await resetFFmpeg();

        }
        catch (_) {}


        emit(
            "easyfiletools:video-conversion-paused"
        );

    }


    function resume() {

        if (
            state.running &&
            state.paused
        ) {

            state.paused = false;


            emit(
                "easyfiletools:video-conversion-resumed"
            );

        }

    }


    async function cancel() {

        state.cancelled = true;
        state.paused = false;

        try { await window.EasyFileWebCodecs?.cancel?.(); } catch (_) {}

        try {

            await resetFFmpeg();

        }
        catch (_) {}

    }


    window.VideoConverter = {

        convertFiles,

        pause,

        resume,

        cancel

    };

})();