

/* ======================================
   EasyFile Tools
   File Categories & Extensions
====================================== */

const FILE_CATEGORIES = {

    Audio: [
        "mp3",
        "wav",
        "flac",
        "aac",
        "ogg",
        "oga",
        "opus",
        "wma",
        "m4a",
        "m4b",
       /* "m4p", */
        "aiff",
        "aif",
        "aifc",
        "amr",
        "au",
        "snd",
        "mid",
        "midi",
        "ac3",
        "dts",
        "ape",
        "wv",
        "tta",
        "voc",
        "ra",
        "rm",
        "spx"
    ],

    Video: [
        "mp4",
        "m4v",
        "mov",
        "avi",
        "mkv",
        "webm",
        "wmv",
        "asf",
        "flv",
        "f4v",
        "mpeg",
        "mpg",
        "mpe",
        "m2v",
        "m2ts",
        "mts",
        "ts",
        "vob",
        "ogv",
        "3gp",
        "3g2",
        "rm",
        "rmvb",
        "divx",
        "xvid"
    ],

    Image: [
        "jpg",
        "jpeg",
        "jpe",
        "png",
        "webp",
        "gif",
        "bmp",
        "tif",
        "tiff",
        "ico",
        "cur",
        "heic",
        "heif",
        "avif",
        "jxl",
        "jp2",
        "j2k",
        "jpf",
        "jpm",
        "mj2",
        "psd",
        "xcf",
        "raw",
        "dng",
        "cr2",
        "cr3",
        "nef",
        "nrw",
        "arw",
        "orf",
        "rw2",
        "raf",
        "pef",
        "srw",
        "3fr",
        "erf",
        "dcr",
        "kdc",
        "mef",
        "mos",
        "mrw",
        "rwl",
        "x3f",

        /* Scientific / medical */
        "dicom",
        "dcm",
        "nifti",
        "nii",
        "nii.gz",
        "hdr",
        "img",

        /* Scientific / microscopy */
        "fits",
        "fit",
        "fts"
    ],

    Document: [
        "pdf",
        "doc",
        "docx",
        "odt",
        "ott",
        "txt",
        "rtf",
        "tex",
        "latex",
        "md",
        "markdown",
        "rst",
        "djvu",
        "djv",
        "epub",
        "mobi",
        "azw",
        "azw3",
        "kf8",
        "fb2",
        "lit",
        "lrf",
        "pdb",
        "cbr",
        "cbz"
    ],

    Presentation: [
        "ppt",
        "pptx",
        "pps",
        "ppsx",
        "pot",
        "potx",
        "odp",
        "otp",
        "key"
    ],

    Spreadsheet: [
        "xls",
        "xlsx",
        "xlsm",
        "xlsb",
        "xlt",
        "xltx",
        "xltm",
        "ods",
        "ots",
        "csv",
        "tsv",
        "tab",
        "dif",
        "slk",
        "numbers"
    ],

    Archive: [
        "zip",
        "rar",
        "7z",
        "tar",
        "gz",
        "tgz",
        "bz",
        "bz2",
        "tbz",
        "tbz2",
        "xz",
        "txz",
        "z",
        "lz",
        "lz4",
        "lzma",
        "zst",
        "cab",
        "arj",
        "lzh",
        "lha",
        "ace",
        "sit",
        "sitx",
        "jar",
        "war",
        "ear",
        "apk",
        "ipa",
        "deb",
        "rpm",
        "iso",
        "img",
        "dmg"
    ],

    Vector: [
        "svg",
        "svgz",
        "eps",
        "epsf",
        "ai",
        "cdr",
        "wmf",
        "emf",

        /* Fonts */
        "ttf",
        "otf",
        "woff",
        "woff2"
    ],

    Code: [
        "html",
        "htm",
        "css",
        "scss",
        "sass",
        "less",
        "js",
        "jsx",
        "ts",
        "tsx",
        "mjs",
        "cjs",
        "json",
        "xml",
        "xhtml",
        "php",
        "py",
        "pyw",
        "java",
        "kt",
        "kts",
        "c",
        "h",
        "cpp",
        "cc",
        "cxx",
        "hpp",
        "cs",
        "go",
        "rs",
        "rb",
        "swift",
        "dart",
        "lua",
        "r",
        "m",
        "mm",
        "sh",
        "bash",
        "zsh",
        "fish",
        "ps1",
        "bat",
        "cmd",
        "pl",
        "pm",
        "sql",
        "graphql",
        "gql",
        "yaml",
        "yml",
        "toml",
        "ini",
        "conf",
        "env",
        "md",
        "markdown",
        "txt"
    ],

    "3D & CAD": [
        "stl",
        "obj",
        "fbx",
        "3ds",
        "dae",
        "gltf",
        "glb",
        "ply",
        "off",
        "3mf",
        "step",
        "stp",
        "iges",
        "igs",
        "brep",
        "sat",
        "x_t",
        "x_b",
        "dwg",
        "dxf",
        "skp",
        "blend",
        "max",
        "ma",
        "mb",
        "c4d",
        "lwo",
        "lws",
        "abc",
        "usd",
        "usda",
        "usdc",
        "usdz"
    ]
};

const AUDIO_CONVERSION_OUTPUT_FORMATS = [
    "mp3",
    "wav",
    "flac",
    "aac",
    "ogg",
    "oga",
    "opus",
    "wma",
    "m4a",
    "m4b",
    "aiff",
    "aif",
    "aifc",
    "au",
    "snd",
    "ac3",
    "dts",
    "wv",
    "tta",
    "voc",
    "ra",
    "rm"
];

/* =========================
   FILE CATEGORY HELPERS
========================= */

function getFileCategory(
    fileName
) {

    if (!fileName) {
        return "Unknown";
    }


    const normalizedName =
        String(fileName)
            .toLowerCase();


    for (
        const [
            category,
            extensions
        ]
        of Object.entries(
            FILE_CATEGORIES
        )
    ) {

        /*
         * Longest extensions first.
         *
         * Important for formats such as:
         * .nii.gz
         */

        const sortedExtensions =
            [...extensions]
                .sort(
                    (a, b) =>
                        b.length -
                        a.length
                );


        for (
            const extension
            of sortedExtensions
        ) {

            if (
                normalizedName.endsWith(
                    `.${extension.toLowerCase()}`
                )
            ) {

                return category;
            }
        }
    }


    return "Unknown";
}


/* =========================
   CATEGORY EXTENSIONS
========================= */

function getFileCategoryExtensions(
    category
) {

    if (
        !category ||
        !Array.isArray(
            FILE_CATEGORIES[
                category
            ]
        )
    ) {

        return [];
    }


    return [
        ...FILE_CATEGORIES[
            category
        ]
    ];
}


/* =========================
   ALL SUPPORTED EXTENSIONS
========================= */

function getAllSupportedFileExtensions() {

    return [
        ...new Set(
            Object
                .values(
                    FILE_CATEGORIES
                )
                .flat()
                .map(
                    extension =>
                        extension
                            .toLowerCase()
                )
        )
    ];
}


/* =========================
   BUILD INPUT ACCEPT
========================= */

function buildFileInputAccept(
    extensions
) {

    if (
        !Array.isArray(
            extensions
        )
    ) {

        return "";
    }


    return extensions
        .filter(Boolean)
        .map(
            extension => {

                const normalized =
                    String(
                        extension
                    )
                        .trim()
                        .toLowerCase()
                        .replace(
                            /^\./,
                            ""
                        );


                return normalized
                    ? `.${normalized}`
                    : null;
            }
        )
        .filter(Boolean)
        .join(",");
}


/* =========================
   CATEGORY ACCEPT
========================= */

function getFileCategoryAccept(
    category
) {

    return buildFileInputAccept(
        window.EasyFilePolicy?.extensions(category) || []
    );
}


/* =========================
   ALL FORMATS ACCEPT
========================= */

function getAllSupportedFileAccept() {

    return buildFileInputAccept(
        window.EasyFilePolicy?.allExtensions() || []
    );
}


console.log(
    "file-categories.js loaded",
    FILE_CATEGORIES
);


console.log("file-categories.js loaded", FILE_CATEGORIES);
