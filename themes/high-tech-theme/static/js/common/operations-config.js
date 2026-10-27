console.log("operations-config.js loaded");

/* =========================================
   OPÉRATIONS DISPONIBLES PAR CATÉGORIE
========================================= */

const FILE_OPERATIONS = {

    Audio: [

        {
            id: "convert-audio",
            category: "Audio",
            name: "Convert Audio",
            icon: "repeat-2",
            description: "Convert audio files between popular formats.",
            extensions: "category",
            url: "/audio/convert-audio/",
            minFiles: 1
        },

/*        {
            id: "speech-to-text",
            category: "Audio",
            name: "Speech → Text",
            icon: "mic",
            description: "Convert spoken audio into editable text.",
            extensions: "category",
            url: "/audio/speech-to-text/",
            minFiles: 1
        },    */

        {
            id: "auto-split",
            category: "Audio",
            name: "Auto Split",
            icon: "square-split-horizontal",
            description: "Automatically split audio at silent sections.",
            extensions: "category",
            url: "/audio/auto-split/",
            minFiles: 1,
            resultMode: "multi-output",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "cut-audio",
            category: "Audio",
            name: "Cut Audio",
            icon: "scissors",
            description: "Cut or remove precise sections from audio files.",
            extensions: "category",
            url: "/audio/cut-audio/",
            minFiles: 1
        },

        {
            id: "merge-audio",
            category: "Audio",
            name: "Merge Audio",
            icon: "merge",
            description: "Cut, join and rearrange audio segments.",
            extensions: "category",
            url: "/audio/merge-audio/",
            minFiles: 2,
            resultMode: "batch" 
        },

/*        {
            id: "normalize-volume",
            category: "Audio",
            name: "Normalize Volume",
            icon: "volume-2",
            description: "Balance audio volume for a more consistent listening level.",
            extensions: "category",
            url: "/audio/normalize-volume/",
            minFiles: 1
        },

        {
            id: "compress-audio",
            category: "Audio",
            name: "Compress Audio",
            icon: "archive",
            description: "Reduce audio file size while preserving sound quality.",
            extensions: "category",
            url: "/audio/compress-audio/",
            minFiles: 1
        },

        {
            id: "change-bitrate",
            category: "Audio",
            name: "Change Bitrate",
            icon: "gauge",
            description: "Change the bitrate of audio files.",
            extensions: "category",
            url: "/audio/change-bitrate/",
            minFiles: 1
        },

        {
            id: "change-sample-rate",
            category: "Audio",
            name: "Change Sample Rate",
            icon: "waves",
            description: "Change the audio sample rate to suit different uses.",
            extensions: "category",
            url: "/audio/change-sample-rate/",
            minFiles: 1
        },

        {
            id: "edit-metadata",
            category: "Audio",
            name: "Edit Metadata",
            icon: "tags",
            description: "View and edit audio metadata such as title, artist and album.",
            extensions: "category",
            url: "/audio/edit-metadata/",
            minFiles: 1
        },

        {
            id: "rename-files",
            category: "Audio",
            name: "Rename Files",
            icon: "file-pen",
            description: "Rename multiple audio files quickly and consistently.",
            extensions: "category",
            url: "/audio/rename-files/",
            minFiles: 1,
            resultMode: "multi-output",
            supportsCancel: true,
            supportsPause: true
        }    */

    ],

    Image: [

        {
            id: "convert-image",
            category: "Image",
            name: "Convert Image",
            icon: "repeat-2",
            description:
                "Convert images between popular formats.",
            extensions: "category",
            url: "/images/convert-image/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "compress-image",
            category: "Image",
            name: "Compress Image",
            icon: "minimize-2",
            description:
                "Reduce image file size while preserving visual quality.",
            extensions: "category",
            url: "/images/compress-image/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "image-to-pdf",
            category: "Image",
            name: "Image to PDF",
            icon: "file-text",
            description:
                "Convert one or more images into a PDF document.",
            extensions: "category",
            url: "/images/image-to-pdf/",
            minFiles: 1,
            resultMode: "batch",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "image-to-gif",
            category: "Image",
            name: "Image → GIF",
            icon: "images",
            description:
                "Create an animated GIF from multiple images.",
            extensions: "category",
            url: "/images/image-to-gif/",
            minFiles: 2
        },

        {
            id: "image-to-video",
            category: "Image",
            name: "Image → Video",
            icon: "video",
            description:
                "Create a video from a sequence of images.",
            extensions: "category",
            url: "/images/image-to-video/",
            minFiles: 1
        },

        {
            id: "remove-background",
            category: "Image",
            name: "Remove Background",
            icon: "eraser",
            description:
                "Remove or replace image backgrounds using AI.",
            extensions: "category",
            url: "/images/remove-background/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "replace-colors",
            category: "Image",
            name: "Replace Colors",
            icon: "repeat-2",
            description:
                "Replace or remove selected colors with an interactive preview.",
            extensions: "category",
            url: "/images/replace-colors/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "resize-crop-image",
            category: "Image",
            name: "Resize / Crop Image",
            icon: "crop",
            description:
                "Resize or crop images to custom dimensions.",
            extensions: "category",
            url: "/images/resize-crop-image/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "rotate-flip-image",
            category: "Image",
            name: "Rotate / Flip Image",
            icon: "refresh-cw",
            description:
                "Rotate, flip or mirror images without uploading them.",
            extensions: "category",
            url: "/images/rotate-flip-image/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "enhance-image",
            category: "Image",
            name: "Enhance Image",
            icon: "image",
            description:
                "Improve image appearance and visual quality.",
            extensions: "category",
            url: "/images/enhance-image/",
            minFiles: 1
        },

        {
            id: "apply-filters",
            category: "Image",
            name: "Apply Filters",
            icon: "settings-2",
            description:
                "Apply visual filters and image adjustments.",
            extensions: "category",
            url: "/images/apply-filters/",
            minFiles: 1
        },

        {
            id: "black-and-white",
            category: "Image",
            name: "Black & White",
            icon: "square",
            description:
                "Convert images to black and white or grayscale.",
            extensions: "category",
            url: "/images/black-and-white/",
            minFiles: 1
        },

        {
            id: "edit-image",
            category: "Image",
            name: "Edit Image",
            icon: "pen-tool",
            description:
                "Edit images with common image adjustments and tools.",
            extensions: "category",
            url: "/images/edit-image/",
            minFiles: 1
        },

        {
            id: "extract-text-ocr",
            category: "Image",
            name: "Extract Text (OCR)",
            icon: "file-text",
            description:
                "Extract readable text from images using OCR.",
            extensions: "category",
            url: "/images/extract-text-ocr/",
            minFiles: 1
        }

    ],

    Video: [

        {
            id: "convert-video",
            category: "Video",
            name: "Convert Video",
            icon: "repeat-2",
            description:
                "Convert videos between popular formats.",
            extensions: "category",
            url: "/video/convert-video/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "compress-video",
            category: "Video",
            name: "Compress Video",
            icon: "minimize-2",
            description:
                "Reduce video file size while preserving quality.",
            extensions: "category",
            url: "/video/compress-video/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "video-to-audio",
            category: "Video",
            name: "Video to Audio",
            icon: "music",
            description:
                "Extract audio tracks from video files.",
            extensions: "category",
            url: "/video/video-to-audio/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "trim-video",
            category: "Video",
            name: "Trim Video",
            icon: "scissors",
            description:
                "Trim a video by selecting precise start and end times.",
            extensions: "category",
            url: "/video/trim-video/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        }

    ],

    Document: [

        {
            id: "merge-pdf",
            category: "Document",
            name: "Merge PDF",
            icon: "files",
            description:
                "Combine multiple PDF files into one.",
            extensions: "pdf",
            url: "/documents/merge-pdf/",
            minFiles: 2,
            resultMode: "batch",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "split-pdf",
            category: "Document",
            name: "Split PDF",
            icon: "square-split-horizontal",
            description:
                "Split a PDF or extract selected pages.",
            extensions: "pdf",
            url: "/documents/split-pdf/",
            minFiles: 1,
            resultMode: "multi-output",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "compress-pdf",
            category: "Document",
            name: "Compress PDF",
            icon: "minimize-2",
            description:
                "Reduce PDF file size.",
            extensions: "pdf",
            url: "/documents/compress-pdf/",
            minFiles: 1,
            resultMode: "per-file",
            supportsCancel: true,
            supportsPause: true
        },

        {
            id: "pdf-to-image",
            category: "Document",
            name: "PDF to Image",
            icon: "images",
            description:
                "Convert PDF pages into images.",
            extensions: "pdf",
            url: "/documents/pdf-to-image/",
            minFiles: 1,
            resultMode: "multi-output",
            supportsCancel: true,
            supportsPause: true
        }

    ],

};


/* =========================================
   RÉCUPÉRER LES OPÉRATIONS COMPATIBLES
========================================= */

function getCompatibleOperations(
    category,
    fileCount,
    selected = []
) {

    const operations =
        FILE_OPERATIONS[category] || [];

    return operations.filter(
        operation => {

            const minFiles =
                operation.minFiles || 1;

            if (!window.EasyFilePolicy?.supported.has(operation.id) || fileCount < minFiles) return false;
            const profile = window.EasyFilePolicy.resolve({ operation: operation.id });
            if (!profile || fileCount > profile.maxFiles) return false;
            const files = selected.map(item => item?.file || item);
            return files.every(file => profile.extensions.includes(String(file.name || "").toLowerCase().split(".").pop()) && file.size <= profile.maxFileMB * window.EasyFilePolicy.MB)
                && files.reduce((sum, file) => sum + file.size, 0) <= profile.maxTotalMB * window.EasyFilePolicy.MB;

        }
    );
}


/* =========================================
   GENERIC OPERATION CONFIG
========================================= */

const OPERATION_RESULT_MODES =
    Object.freeze({

        PER_FILE:
            "per-file",

        BATCH:
            "batch",

        MULTI_OUTPUT:
            "multi-output"

    });


const OPERATION_RUNTIME_DEFAULTS =
    Object.freeze({

        supportsCancel:
            false,

        supportsPause:
            false,

        resultMode:
            OPERATION_RESULT_MODES.PER_FILE,

        reuseCompletedResult:
            true

    });


function findOperationDefinition(
    operationId
) {

    if (!operationId) {
        return null;
    }


    for (
        const operations
        of Object.values(
            FILE_OPERATIONS
        )
    ) {

        const operation =
            operations.find(
                item =>
                    item.id ===
                    operationId
            );


        if (operation) {

            return operation;
        }
    }


    return null;
}


function getOperationRuntimeConfig(
    operationId
) {

    const definition =
        findOperationDefinition(
            operationId
        );


    if (!definition) {
        return null;
    }


    return {

        ...OPERATION_RUNTIME_DEFAULTS,

        ...definition

    };
}


/* =========================================
   PUBLIC API
========================================= */

window.EasyFileOperationConfig =
    Object.freeze({

        RESULT_MODES:
            OPERATION_RESULT_MODES,

        DEFAULTS:
            OPERATION_RUNTIME_DEFAULTS,

        get:
            getOperationRuntimeConfig,

        getRaw:
            findOperationDefinition

    });


console.log(
    "[OPERATION CONFIG] Generic configuration API ready"
);