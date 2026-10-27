console.log(
    "[VIDEO AUDIO EXTRACTOR] video-audio-extractor.js loaded"
);


(() => {

    "use strict";


    const state = {

        running: false,
        paused: false,
        cancelled: false,
        currentIndex: -1

    };


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


    function mime(format) {

        return {

            mp3: "audio/mpeg",
            wav: "audio/wav",
            flac: "audio/flac",
            aac: "audio/aac",
            m4a: "audio/mp4",
            ogg: "audio/ogg",
            opus: "audio/ogg"

        }[format] ||
            "application/octet-stream";

    }


    function sharedAudioProfile(
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
                "Shared audio encoding profiles are unavailable."
            );
        }

        const profile =
            profiles.getProfile(
                format
            );

        if (!profile) {
            throw new Error(
                `Unsupported audio output format: ${format || "unknown"}.`
            );
        }

        return profile;
    }


    function replaceBitrateArgs(
        codecArgs,
        bitrate,
        format
    ) {

        if (
            ["wav", "flac"].includes(format)
        ) {
            return [...codecArgs];
        }

        const result = [];

        for (
            let index = 0;
            index < codecArgs.length;
            index++
        ) {

            const token = codecArgs[index];

            if (
                token === "-b:a" ||
                token === "-q:a"
            ) {
                index += 1;
                continue;
            }

            result.push(token);
        }

        result.push(
            "-b:a",
            String(bitrate || "192k")
        );

        return result;
    }


    function buildTranscodeArgs(
        settings,
        inputName,
        outputName
    ) {

        const format =
            String(settings?.format || "")
                .trim()
                .toLowerCase();

        const profile =
            sharedAudioProfile(
                format
            );

        const codecArgs =
            replaceBitrateArgs(
                profile.codecArgs,
                settings?.bitrate,
                format
            );

        const args = [
            "-y",
            "-i", inputName,
            "-map", "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            ...codecArgs
        ];

        if (
            format !== "opus" &&
            settings.sampleRate !== "original"
        ) {
            args.push(
                "-ar",
                String(settings.sampleRate)
            );
        }

        if (
            settings.channels !== "original"
        ) {
            args.push(
                "-ac",
                String(settings.channels)
            );
        }

        args.push(
            ...profile.muxerArgs,
            outputName
        );

        return args;
    }


    function canStreamCopy(
        probe,
        settings
    ) {

        if (
            !probe ||
            settings.sampleRate !== "original" ||
            settings.channels !== "original"
        ) {
            return false;
        }

        const sourceCodec =
            String(
                probe.codecName ||
                probe.codec_name ||
                ""
            ).toLowerCase();

        const target =
            String(settings.format || "")
                .toLowerCase();

        const compatible = {
            mp3: ["mp3"],
            flac: ["flac"],
            aac: ["aac"],
            m4a: ["aac"],
            ogg: ["vorbis"],
            opus: ["opus"]
        };

        return Boolean(
            compatible[target]?.includes(
                sourceCodec
            )
        );
    }


    function buildCopyArgs(
        settings,
        inputName,
        outputName
    ) {

        const profile =
            sharedAudioProfile(
                settings.format
            );

        return [
            "-y",
            "-i", inputName,
            "-map", "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-c:a", "copy",
            ...profile.muxerArgs,
            outputName
        ];
    }


    function isNoAudioTrackError(error) {

        const message =
            String(error?.message || "")
                .toLowerCase();

        return (
            message.includes("no audio stream was found") ||
            message.includes("stream map '0:a:0' matches no streams") ||
            message.includes('stream map "0:a:0" matches no streams') ||
            message.includes("output file does not contain any stream") ||
            message.includes("does not contain any stream")
        );
    }


    function noAudioTrackError(file, cause = null) {

        const error =
            new Error(
                `No audio track found in ${file?.name || "this video"}.`
            );

        error.name =
            "NoAudioTrackError";

        error.code =
            "NO_AUDIO_TRACK";

        error.cause =
            cause || null;

        return error;
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


    async function extractOne(
        file,
        index,
        settings
    ) {

        // Compatible audio streams can be remuxed without downloading or
        // starting the heavy FFmpeg.wasm core. No resampling or re-encoding.
        if (window.EasyFileVideoFastPaths?.extractAudio) {
            try {
                const blob = await window.EasyFileVideoFastPaths.extractAudio(
                    file, settings,
                    percentage => emit('easyfiletools:video-audio-progress', {
                        index, percentage
                    })
                );
                if (blob) {
                    if (state.cancelled || state.paused) {
                        const error = new Error('VIDEO_AUDIO_INTERRUPTED');
                        error.name = 'ConversionCanceledError';
                        throw error;
                    }
                    console.info('[VIDEO AUDIO EXTRACTOR] Direct browser stream copy',
                        {format: settings.format, index});
                    return {
                        blob, outputUrl: URL.createObjectURL(blob),
                        outputName: `${base(file.name)}.${settings.format}`,
                        outputFormat: settings.format, outputSize: blob.size
                    };
                }
            } catch (error) {
                if (state.cancelled || state.paused || error?.name === 'ConversionCanceledError')
                    throw error;
                if (error?.name === 'FFprobeNoAudioStreamError')
                    throw noAudioTrackError(file, error);
                console.warn('[VIDEO AUDIO EXTRACTOR] Browser remux unavailable; using FFmpeg.', error);
            }
        }

        const ffmpeg =
            await getFFmpeg();


        const inputName =
            `video_audio_${index}.${ext(file.name)}`;


        const outputNameFs =
            `video_audio_${index}.${settings.format}`;


        await writeFile(
            inputName,
            new Uint8Array(
                await file.arrayBuffer()
            )
        );


        const progressHandler =
            ({ progress }) => {

                emit(
                    "easyfiletools:video-audio-progress",
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

            let probe = null;

            if (
                typeof probeAudioFile ===
                    "function"
            ) {

                try {

                    probe =
                        await probeAudioFile(
                            ffmpeg,
                            inputName,
                            "Video audio inspection"
                        );

                }
                catch (probeError) {

                    /*
                     * A positive "no audio stream" result is not a technical
                     * failure and should not trigger a second FFmpeg attempt.
                     * Treat it as a per-file non-applicable input immediately.
                     * Other probe failures remain non-blocking: in those cases
                     * FFmpeg itself gets a chance to transcode the file.
                     */
                    if (
                        probeError?.name ===
                            "FFprobeNoAudioStreamError"
                    ) {
                        throw noAudioTrackError(
                            file,
                            probeError
                        );
                    }

                    console.debug(
                        `[VIDEO AUDIO EXTRACTOR] Audio inspection unavailable for ${file.name}; using normal FFmpeg transcoding.`,
                        probeError
                    );

                    probe = null;

                }

            }


            const fastCopy =
                canStreamCopy(
                    probe,
                    settings
                );


            const args =
                fastCopy
                    ? buildCopyArgs(
                        settings,
                        inputName,
                        outputNameFs
                    )
                    : buildTranscodeArgs(
                        settings,
                        inputName,
                        outputNameFs
                    );


            console.debug(
                "[VIDEO AUDIO EXTRACTOR]",
                fastCopy
                    ? "Using lossless stream copy."
                    : "Using audio transcode.",
                {
                    sourceCodec:
                        probe?.codecName ||
                        probe?.codec_name ||
                        "unknown",
                    format:
                        settings.format,
                    command:
                        args
                }
            );


            try {

                await exec(
                    args
                );

            }
            catch (executionError) {

                if (
                    isNoAudioTrackError(
                        executionError
                    )
                ) {

                    throw noAudioTrackError(
                        file,
                        executionError
                    );

                }

                throw executionError;

            }


            const output =
                await readFile(
                    outputNameFs
                );


            const blob =
                new Blob(
                    [output],
                    {
                        type:
                            mime(
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
                        base(
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


    async function extractFiles(
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
        state.paused = false;
        state.cancelled = false;


        emit(
            "easyfiletools:video-audio-started"
        );


        let error =
            null;

        let successCount =
            0;

        let noAudioCount =
            0;


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
                            "VIDEO_AUDIO_CANCELLED"
                        );

                    }


                    while (
                        state.paused
                    ) {

                        await new Promise(
                            resolve =>
                                setTimeout(
                                    resolve,
                                    100
                                )
                        );

                    }


                    try {

                        const result =
                            await extractOne(
                                files[index],
                                index,
                                settings
                            );


                        emit(
                            "easyfiletools:video-audio-complete",
                            {
                                index,

                                result
                            }
                        );

                        successCount += 1;

                        done = true;

                    }
                    catch (caught) {

                        if (
                            state.paused
                        ) {

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
                                "VIDEO_AUDIO_CANCELLED"
                            );

                        }


                        if (
                            caught?.code ===
                                "NO_AUDIO_TRACK" ||
                            caught?.name ===
                                "NoAudioTrackError" ||
                            isNoAudioTrackError(
                                caught
                            )
                        ) {

                            const localError =
                                caught?.code === "NO_AUDIO_TRACK"
                                    ? caught
                                    : noAudioTrackError(
                                        files[index],
                                        caught
                                    );

                            noAudioCount += 1;

                            emit(
                                "easyfiletools:video-audio-file-error",
                                {
                                    index,
                                    file:
                                        files[index],
                                    error:
                                        localError,
                                    code:
                                        "NO_AUDIO_TRACK"
                                }
                            );

                            console.info(
                                "[VIDEO AUDIO EXTRACTOR]",
                                localError.message
                            );

                            done = true;
                            continue;

                        }


                        throw caught;

                    }

                }

            }

            if (
                successCount === 0 &&
                noAudioCount > 0 &&
                !state.cancelled
            ) {

                throw new Error(
                    noAudioCount === 1
                        ? "The selected video does not contain an audio track."
                        : "None of the selected videos contains an audio track."
                );

            }

        }
        catch (caught) {

            if (
                caught.message !==
                "VIDEO_AUDIO_CANCELLED"
            ) {

                error = caught;


                console.error(
                    "[VIDEO AUDIO EXTRACTOR]",
                    caught
                );

            }

        }
        finally {

            const cancelled =
                state.cancelled;


            state.running = false;
            state.paused = false;

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
                "easyfiletools:video-audio-ended",
                {
                    cancelled,
                    error
                }
            );

        }

    }


    async function pause() {

        state.paused = true;


        try { await window.EasyFileVideoFastPaths?.cancel?.(); }
        catch (_) {}

        try {
            await resetFFmpeg();
        }
        catch (_) {}


        emit(
            "easyfiletools:video-audio-paused"
        );

    }


    function resume() {

        state.paused = false;


        emit(
            "easyfiletools:video-audio-resumed"
        );

    }


    async function cancel() {

        state.cancelled = true;
        state.paused = false;


        try { await window.EasyFileVideoFastPaths?.cancel?.(); }
        catch (_) {}

        try {
            await resetFFmpeg();
        }
        catch (_) {}

    }


    window.VideoAudioExtractor = {

        extractFiles,

        pause,

        resume,

        cancel

    };

})();