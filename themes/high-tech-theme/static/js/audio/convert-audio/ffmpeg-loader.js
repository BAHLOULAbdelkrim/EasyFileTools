console.log(
    "[FFMPEG LOADER] ffmpeg-loader.js loaded"
);

let ffmpegInstance = null;
let ffmpegLoadingPromise = null;


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

            await ffmpeg.load({
                coreURL:
                    `${baseURL}/ffmpeg-core.js`,

                wasmURL:
                    `${baseURL}/ffmpeg-core.wasm`
            });

            ffmpegInstance =
                ffmpeg;

            console.log(
                "[FFMPEG LOADER] FFmpeg loaded successfully"
            );

            return ffmpegInstance;
        })();

    try {

        return await ffmpegLoadingPromise;

    }
    catch (error) {

        ffmpegLoadingPromise =
            null;

        console.error(
            "[FFMPEG LOADER] Loading failed:",
            error
        );

        throw error;
    }
}


/* =========================
   RESET FFMPEG
========================= */

function resetFFmpeg() {

    if (ffmpegInstance) {

        ffmpegInstance.terminate();

    }

    ffmpegInstance =
        null;

    ffmpegLoadingPromise =
        null;

    console.log(
        "[FFMPEG LOADER] FFmpeg reset"
    );
}