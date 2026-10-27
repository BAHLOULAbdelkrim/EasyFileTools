console.log(
    "[VIDEO COMPRESSOR] video-compressor.js loaded"
);


(() => {

    "use strict";


    const state = {

        running: false,
        paused: false,
        cancelled: false,
        currentIndex: -1

    };

    // Avoid polling during Pause: Resume and Cancel must wake the pending
    // batch immediately. This also prevents a cancelled paused batch from
    // accidentally starting another conversion on its next loop iteration.
    let wakePausedBatch = null;

    function releasePausedBatch() {
        const wake = wakePausedBatch;
        wakePausedBatch = null;
        wake?.();
    }

    async function waitUntilResumedOrCancelled() {
        while (state.paused && !state.cancelled) {
            await new Promise(resolve => {
                wakePausedBatch = resolve;
            });
        }
    }


    function fileOf(item) {

        return item instanceof File
            ? item
            : item?.file || null;

    }


    function ext(name) {

        const dot =
            name.lastIndexOf(".");


        return dot >= 0
            ? name
                .slice(dot + 1)
                .toLowerCase()
            : "";

    }


    function base(name) {

        const dot =
            name.lastIndexOf(".");


        return dot > 0
            ? name.slice(0, dot)
            : name;

    }


    function presetValues(
        preset
    ) {

        switch (preset) {

            case "speed":
                // CPU-first option: compression ratio may be worse.
                return {
                    crf: 28,
                    maxHeight: null,
                    audioBitrate: "128k"
                };

            case "light":
                return {
                    crf: 22,
                    maxHeight: null,
                    audioBitrate:
                        "160k"
                };


            case "strong":
                return {
                    crf: 30,
                    maxHeight: 720,
                    audioBitrate:
                        "96k"
                };


            case "balanced":
            default:
                return {
                    crf: 26,
                    maxHeight: 1080,
                    audioBitrate:
                        "128k"
                };

        }

    }


    function outputContainer(
        file,
        settings
    ) {

        if (
            settings.container !==
            "same"
        ) {

            return settings.container;

        }


        const source =
            ext(
                file.name
            );


        if (
            [
                "mp4",
                "mov",
                "mkv",
                "webm",
                "avi"
            ].includes(source)
        ) {

            return source;
        }


        return "mp4";

    }


    function mime(format) {

        return {

            mp4: "video/mp4",
            mov: "video/quicktime",
            mkv: "video/x-matroska",
            webm: "video/webm",
            avi: "video/x-msvideo"

        }[format] ||
            "application/octet-stream";

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


    function checkInterrupted() {
        if (state.cancelled || state.paused) {
            const error = new Error('VIDEO_COMPRESSION_INTERRUPTED');
            error.name = 'ConversionCanceledError';
            throw error;
        }
    }

    async function compressOne(
        file,
        index,
        settings
    ) {

        // The pause wait may have finished because of Cancel, not Resume.
        // Check before entering the WebCodecs path, not only FFmpeg.
        checkInterrupted();

        const values =
            presetValues(
                settings.preset
            );


        const format =
            outputContainer(
                file,
                settings
            );


        const inputExt =
            ext(file.name);


        const inputName =
            `compress_video_${index}.${inputExt}`;


        const outputNameFs =
            `compressed_video_${index}.${format}`;


        // VP9 WebCodecs: reuse the exact, flicker-tested Convert Video encoder.
        // Only WebM is handled here. Other containers and unsupported browsers
        // continue through the unchanged FFmpeg path below.
        if (format === 'webm' && settings.preset !== 'strong' && window.EasyFileWebCodecs?.convertFile) {
            try {
                const quality = {
                    speed: 'medium', light: 'high', balanced: 'medium'
                }[settings.preset] || 'medium';
                const resolution = values.maxHeight || 'original';
                const result = await window.EasyFileWebCodecs.convertFile(file, {
                    format: 'webm', quality, resolution, keepAudio: true,
                    fastCopy: false // Compression must not silently copy unchanged video.
                }, percentage => emit('easyfiletools:video-compress-progress', {
                    index, percentage
                }));
                if (state.cancelled || state.paused) {
                    const error = new Error('VIDEO_COMPRESSION_INTERRUPTED');
                    error.name = 'ConversionCanceledError';
                    throw error;
                }
                const usedOriginal = Boolean(settings.keepSmaller &&
                    settings.container === 'same' && result.blob.size >= file.size);
                const blob = usedOriginal ? file : result.blob;
                console.info('[VIDEO COMPRESSOR] WebCodecs VP9', {quality, index,
                    bytes: blob.size, usedOriginal});
                return {
                    blob, outputUrl: URL.createObjectURL(blob),
                    outputName: `${base(file.name)}-compressed.${format}`,
                    outputFormat: format, outputSize: blob.size,
                    originalSize: file.size, usedOriginal
                };
            } catch (error) {
                if (state.cancelled || state.paused || error?.name === 'ConversionCanceledError')
                    throw error;
                console.warn('[VIDEO COMPRESSOR] WebCodecs unavailable; using FFmpeg.', error);
            }
        }

        checkInterrupted();
        const ffmpeg = await getFFmpeg();
        checkInterrupted();

        await writeFile(
            inputName,
            new Uint8Array(
                await file.arrayBuffer()
            )
        );


        checkInterrupted();
        const progressHandler =
            ({ progress }) => {
                if (state.cancelled || state.paused) return;
                emit(
                    "easyfiletools:video-compress-progress",
                    {
                        index,

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

            const args = [

                "-i",
                inputName

            ];


            if (
                values.maxHeight
            ) {

                args.push(

                    "-vf",

                    `scale=-2:min(${values.maxHeight}\\,ih)`

                );

            }


            if (
                format === "webm"
            ) {

                args.push(

                    "-c:v",
                    "libvpx",

                    "-deadline",
                    settings.preset === "speed" ? "realtime" : "good",

                    "-cpu-used",
                    settings.preset === "speed" ? "8" : "4",

                    "-threads",
                    "1",

                    "-crf",
                    String(settings.preset === "speed" ? 36 : values.crf + 6),

                    "-b:v",
                    "0",

                    "-c:a",
                    "libopus",

                    "-b:a",
                    values.audioBitrate,

                    "-ar",
                    "24000"

                );

            }
            else if (
                format === "avi"
            ) {

                args.push(

                    "-c:v",
                    "mpeg4",

                    "-q:v",
                    settings.preset ===
                        "light"
                        ? "3"
                        : settings.preset ===
                            "strong"
                            ? "7"
                            : "5",

                    "-c:a",
                    "libmp3lame",

                    "-b:a",
                    values.audioBitrate

                );

            }
            else {

                args.push(

                    "-c:v",
                    "libx264",

                    "-preset",
                    settings.preset === "speed" ? "ultrafast" : "veryfast",

                    "-crf",
                    String(
                        values.crf
                    ),

                    "-pix_fmt",
                    "yuv420p",

                    "-c:a",
                    "aac",

                    "-b:a",
                    values.audioBitrate

                );

            }


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
                outputNameFs
            );


            checkInterrupted();
            await exec(args);
            checkInterrupted();
            const output = await readFile(outputNameFs);
            checkInterrupted();


            let blob =
                new Blob(
                    [output],
                    {
                        type:
                            mime(format)
                    }
                );


            let usedOriginal =
                false;


            if (
                settings.keepSmaller &&
                settings.container ===
                    "same" &&
                blob.size >=
                    file.size
            ) {

                blob =
                    file;

                usedOriginal =
                    true;

            }


            return {

                blob,

                outputUrl:
                    URL.createObjectURL(
                        blob
                    ),

                outputName:
                    `${
                        base(
                            file.name
                        )
                    }-compressed.${format}`,

                outputFormat:
                    format,

                outputSize:
                    blob.size,

                originalSize:
                    file.size,

                usedOriginal

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

                await ffmpeg.deleteFile(
                    outputNameFs
                );

            }
            catch (_) {}

        }

    }


    async function compressFiles(
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
                .map(fileOf)
                .filter(Boolean);


        state.running = true;
        state.cancelled = false;
        state.paused = false;


        emit(
            "easyfiletools:video-compression-started"
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


                let done =
                    false;


                while (!done) {

                    if (
                        state.cancelled
                    ) {

                        throw new Error(
                            "VIDEO_COMPRESSION_CANCELLED"
                        );

                    }


                    await waitUntilResumedOrCancelled();

                    // CRITICAL: Cancel makes paused=false. The old loop
                    // skipped its pause wait and started a NEW WebCodecs job
                    // without noticing cancelled=true; a second click on
                    // Cancel was then required to stop that new job.
                    if (state.cancelled) {
                        throw new Error('VIDEO_COMPRESSION_CANCELLED');
                    }

                    try {

                        const result =
                            await compressOne(
                                files[index],
                                index,
                                settings
                            );


                        checkInterrupted();
                        emit(
                            "easyfiletools:video-compress-complete",
                            {
                                index,

                                file:
                                    files[index],

                                result
                            }
                        );


                        done = true;

                    }
                    catch (caught) {

                        // Cancellation always wins over an earlier Pause.
                        if (state.cancelled) {
                            throw new Error('VIDEO_COMPRESSION_CANCELLED');
                        }
                        if (state.paused) {
                            continue;
                        }


                        // Pause may have been followed by Resume before the
                        // asynchronous WebCodecs cancellation settled.
                        if (caught?.name === 'ConversionCanceledError' && !state.cancelled) {
                            continue;
                        }

                        if (
                            state.cancelled
                        ) {

                            throw new Error(
                                "VIDEO_COMPRESSION_CANCELLED"
                            );

                        }


                        throw caught;

                    }

                }

            }

        }
        catch (caught) {

            if (
                caught.message !==
                "VIDEO_COMPRESSION_CANCELLED"
            ) {

                error = caught;


                console.error(
                    "[VIDEO COMPRESSOR]",
                    caught
                );

            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running = false;
            state.paused = false;
            state.currentIndex = -1;
            releasePausedBatch();

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
                "easyfiletools:video-compression-ended",
                {
                    cancelled,
                    error
                }
            );

        }

    }


    async function pause() {
        if (!state.running || state.cancelled || state.paused) return;
        state.paused = true;


        try { await window.EasyFileWebCodecs?.cancel?.(); }
        catch (_) {}

        try {
            await resetFFmpeg();
        }
        catch (_) {}


        if (!state.cancelled && state.paused) {
            emit("easyfiletools:video-compression-paused");
        }

    }


    function resume() {
        if (!state.running || state.cancelled || !state.paused) return;
        state.paused = false;
        releasePausedBatch();

        emit(
            "easyfiletools:video-compression-resumed"
        );

    }


    async function cancel() {
        if (!state.running) return;
        state.cancelled = true;
        state.paused = false;
        releasePausedBatch();

        try { await window.EasyFileWebCodecs?.cancel?.(); }
        catch (_) {}

        try {
            await resetFFmpeg();
        }
        catch (_) {}

    }


    window.VideoCompressor = {

        compressFiles,

        pause,

        resume,

        cancel

    };

})();