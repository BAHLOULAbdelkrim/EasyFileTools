console.log(
    "[AUDIO PROFILES] audio-encoding-profiles.js loaded"
);


(function () {

    "use strict";


    /* =====================================================
       AUDIO ENCODING PROFILES

       These defaults are intentionally conservative:
       - preserve source sample rate/channels unless a codec
         currently requires an explicit rule;
       - use quality-oriented VBR where it is well supported;
       - keep lossless formats lossless;
       - make codec/container choices explicit instead of
         relying on FFmpeg extension-based defaults.
    ===================================================== */

    const PROFILES = {

        mp3: {
            codecArgs: [
                "-c:a", "libmp3lame",
                "-q:a", "2"
            ],
            muxerArgs: [
                "-f", "mp3"
            ]
        },

        wav: {
            codecArgs: [
                "-c:a", "pcm_s16le"
            ],
            muxerArgs: [
                "-f", "wav"
            ]
        },

        flac: {
            codecArgs: [
                "-c:a", "flac",
                "-compression_level", "5"
            ],
            muxerArgs: [
                "-f", "flac"
            ]
        },

        aac: {
            codecArgs: [
                "-c:a", "aac",
                "-profile:a", "aac_low",
                "-b:a", "192k"
            ],
            muxerArgs: [
                "-f", "adts"
            ]
        },

        ogg: {
            codecArgs: [
                "-c:a", "libvorbis",
                "-q:a", "5"
            ],
            muxerArgs: [
                "-f", "ogg"
            ]
        },

        oga: {
            codecArgs: [
                "-c:a", "libvorbis",
                "-q:a", "5"
            ],
            muxerArgs: [
                "-f", "ogg"
            ]
        },

        opus: {
            /*
             * IMPORTANT — ffmpeg.wasm / libopus compatibility:
             *
             * With the current @ffmpeg/core 0.12.9 build, encoding
             * libopus at 48 kHz can crash the WASM runtime with
             * "memory access out of bounds". 24 kHz is kept
             * intentionally until the core is upgraded/rebuilt and
             * 48 kHz is proven stable in-browser.
             */
            codecArgs: [
                "-c:a", "libopus",
                "-b:a", "128k",
                "-vbr", "on",
                "-application", "audio",
                "-ar", "24000"
            ],
            muxerArgs: [
                "-f", "ogg"
            ]
        },

        wma: {
            codecArgs: [
                "-c:a", "wmav2",
                "-b:a", "192k"
            ],
            muxerArgs: [
                "-f", "asf"
            ]
        },

        m4a: {
            codecArgs: [
                "-c:a", "aac",
                "-profile:a", "aac_low",
                "-b:a", "192k"
            ],
            muxerArgs: [
                "-f", "mp4",
                "-movflags", "+faststart"
            ]
        },

        m4b: {
            codecArgs: [
                "-c:a", "aac",
                "-profile:a", "aac_low",
                "-b:a", "192k"
            ],
            muxerArgs: [
                "-f", "mp4",
                "-movflags", "+faststart"
            ]
        },

        aiff: {
            codecArgs: [
                "-c:a", "pcm_s16be"
            ],
            muxerArgs: [
                "-f", "aiff"
            ]
        },

        aif: {
            codecArgs: [
                "-c:a", "pcm_s16be"
            ],
            muxerArgs: [
                "-f", "aiff"
            ]
        },

        aifc: {
            codecArgs: [
                "-c:a", "pcm_s16be"
            ],
            muxerArgs: [
                "-f", "aiff"
            ]
        },

        au: {
            codecArgs: [
                "-c:a", "pcm_s16be"
            ],
            muxerArgs: [
                "-f", "au"
            ]
        },

        snd: {
            codecArgs: [
                "-c:a", "pcm_s16be"
            ],
            muxerArgs: [
                "-f", "au"
            ]
        },

        ac3: {
            codecArgs: [
                "-c:a", "ac3",
                "-b:a", "384k"
            ],
            muxerArgs: [
                "-f", "ac3"
            ]
        },

        dts: {
            codecArgs: [
                "-c:a", "dca",
                "-strict", "-2",
                "-b:a", "768k"
            ],
            muxerArgs: [
                "-f", "dts"
            ]
        },

        wv: {
            codecArgs: [
                "-c:a", "wavpack",
                "-compression_level", "4"
            ],
            muxerArgs: [
                "-f", "wv"
            ]
        },

        tta: {
            codecArgs: [
                "-c:a", "tta"
            ],
            muxerArgs: [
                "-f", "tta"
            ]
        },

        voc: {
            codecArgs: [
                "-c:a", "pcm_s16le"
            ],
            muxerArgs: [
                "-f", "voc"
            ]
        },

        ra: {
            codecArgs: [
                "-c:a", "ac3",
                "-b:a", "384k"
            ],
            muxerArgs: [
                "-f", "rm"
            ]
        },

        rm: {
            codecArgs: [
                "-c:a", "ac3",
                "-b:a", "384k"
            ],
            muxerArgs: [
                "-f", "rm"
            ]
        },

        /* Used by Cut/Merge even though Convert does not expose it. */
        webm: {
            /* Same ffmpeg.wasm/libopus 48 kHz limitation as .opus. */
            codecArgs: [
                "-c:a", "libopus",
                "-b:a", "128k",
                "-vbr", "on",
                "-application", "audio",
                "-ar", "24000"
            ],
            muxerArgs: [
                "-f", "webm"
            ]
        }
    };


    function normalizeFormat(
        format
    ) {

        return String(
            format || ""
        )
            .trim()
            .toLowerCase();
    }


    function getProfile(
        format
    ) {

        const normalizedFormat =
            normalizeFormat(
                format
            );


        const profile =
            PROFILES[
                normalizedFormat
            ];


        if (!profile) {

            return null;
        }


        return {
            format:
                normalizedFormat,

            codecArgs: [
                ...profile.codecArgs
            ],

            muxerArgs: [
                ...profile.muxerArgs
            ]
        };
    }


    function getCodecArgs(
        format
    ) {

        const profile =
            getProfile(
                format
            );


        if (!profile) {

            throw new Error(
                `No audio encoding profile is defined for .${normalizeFormat(format) || "unknown"}.`
            );
        }


        return profile.codecArgs;
    }


    function getMuxerArgs(
        format
    ) {

        const profile =
            getProfile(
                format
            );


        if (!profile) {

            throw new Error(
                `No audio muxer profile is defined for .${normalizeFormat(format) || "unknown"}.`
            );
        }


        return profile.muxerArgs;
    }


    function buildConversionArgs(
        format,
        inputName,
        outputName
    ) {

        const profile =
            getProfile(
                format
            );


        if (!profile) {

            throw new Error(
                `Output format .${normalizeFormat(format) || "unknown"} is not supported by the shared audio encoding profiles.`
            );
        }


        return [
            "-i",
            inputName,
            "-map",
            "0:a:0",
            "-vn",
            ...profile.codecArgs,
            ...profile.muxerArgs,
            outputName
        ];
    }


    globalThis.EasyFileAudioEncodingProfiles =
        Object.freeze({
            getProfile,
            getCodecArgs,
            getMuxerArgs,
            buildConversionArgs
        });


    console.log(
        "[AUDIO PROFILES] Shared audio encoding profiles ready"
    );

})();
