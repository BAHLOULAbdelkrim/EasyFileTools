/* EasyFile Tools — source of truth for V1 input capabilities and resource limits.
 * Recognizing an extension is NOT the same as being able to process it.
 * Limits are conservative initial defaults and must be load-tested on devices.
 */
(() => {
    "use strict";
    const MB = 1024 * 1024;
    const profiles = Object.freeze({
        Image: Object.freeze({ maxFiles: 10, maxFileMB: 40, maxTotalMB: 150,
            extensions: ["jpg", "jpeg", "png", "webp", "avif", "bmp", "svg"] }),
        Audio: Object.freeze({ maxFiles: 10, maxFileMB: 100, maxTotalMB: 250,
            extensions: ["mp3", "wav", "flac", "aac", "ogg", "oga", "opus", "wma", "m4a", "m4b", "aiff", "aif", "aifc", "amr", "au", "snd", "ac3"] }),
        Video: Object.freeze({ maxFiles: 3, maxFileMB: 100, maxTotalMB: 200,
            extensions: ["mp4", "webm", "mkv", "mov", "avi", "m4v", "mpeg", "mpg", "ogv", "3gp", "3g2", "ts", "mts", "m2ts", "wmv", "flv"] }),
        Document: Object.freeze({ maxFiles: 10, maxFileMB: 60, maxTotalMB: 150,
            extensions: ["pdf"] })
    });
    const operationCategory = Object.freeze({
        "convert-audio":"Audio", "auto-split":"Audio", "cut-audio":"Audio", "merge-audio":"Audio",
        "convert-image":"Image", "compress-image":"Image", "image-to-pdf":"Image", "remove-background":"Image",
        "replace-colors":"Image", "resize-crop-image":"Image", "rotate-flip-image":"Image",
        "convert-video":"Video", "compress-video":"Video", "video-to-audio":"Video", "trim-video":"Video",
        "merge-pdf":"Document", "split-pdf":"Document", "compress-pdf":"Document", "pdf-to-image":"Document"
    });
    // Operation-level overrides can be added without changing the generic upload UI.
    const overrides = Object.freeze({
        "remove-background": { maxFileMB: 20, maxTotalMB: 60, maxFiles: 3 }
    });
    const supported = new Set(Object.keys(operationCategory));
    const ext = name => String(name || "").toLowerCase().split(".").pop();
    function resolve({ category, operation } = {}) {
        const cat = operationCategory[operation] || category || null;
        const base = profiles[cat];
        if (!base) return null;
        const override = overrides[operation] || {};
        const memory = typeof navigator === "object" ? Number(navigator.deviceMemory) : NaN;
        // Device memory is a coarse estimate (often unavailable, notably Safari).
        // Unknown devices use the already conservative base limits.
        const lowMemory = Number.isFinite(memory) && memory > 0 && memory <= 4;
        const veryLowMemory = Number.isFinite(memory) && memory > 0 && memory <= 2;
        const deviceMB = veryLowMemory ? { Image: 20, Audio: 40, Video: 40, Document: 30 }
            : lowMemory ? { Image: 30, Audio: 60, Video: 60, Document: 40 } : {};
        const fileMB = Math.min(override.maxFileMB ?? base.maxFileMB, deviceMB[cat] ?? Infinity);
        const totalMB = Math.min(override.maxTotalMB ?? base.maxTotalMB,
            (deviceMB[cat] ?? Infinity) * (cat === "Video" ? 2 : 3));
        return { category: cat, maxFiles: lowMemory && cat === "Video" ? 2 : (override.maxFiles ?? base.maxFiles),
            maxFileMB: fileMB, maxTotalMB: totalMB,
            extensions: override.extensions || base.extensions };
    }
    function validate(file, { category, operation, count = 0, totalBytes = 0 } = {}) {
        const profile = resolve({ category, operation });
        if (!profile) return { ok: false, reason: "No available operation supports this file category." };
        if (!(file instanceof Blob) || !file.name) return { ok: false, reason: "Invalid file." };
        const name = String(file.name);
        const extension = ext(name);
        if (!profile.extensions.includes(extension)) return { ok: false, reason: `.${extension || "?"} is recognized or unknown, but not supported by this tool.` };
        if (count >= profile.maxFiles) return { ok: false, reason: `Maximum ${profile.maxFiles} files.` };
        if (file.size <= 0) return { ok: false, reason: "Empty file." };
        if (file.size > profile.maxFileMB * MB) return { ok: false, reason: `Maximum ${profile.maxFileMB} MB per file.` };
        if (totalBytes + file.size > profile.maxTotalMB * MB) return { ok: false, reason: `Maximum ${profile.maxTotalMB} MB for the entire selection.` };
        return { ok: true, category: profile.category };
    }
    // Lightweight file-signature checks before resource-intensive preview/decoding.
    // These are safeguards, not proof that every media codec can be decoded.
    async function inspect(file) {
        const extension = ext(file.name);
        if (/^(text\/html|application\/(json|xhtml\+xml))$/i.test(file.type || ""))
            return { ok: false, reason: "The selected resource is a web page or API response." };
        const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
        const ascii = (start, end) => Array.from(bytes.slice(start, end), byte => String.fromCharCode(byte)).join("");
        const rejected = reason => ({ ok: false, reason });
        const memory = typeof navigator === "object" ? Number(navigator.deviceMemory) : NaN;
        const pixelLimit = memory > 0 && memory <= 2 ? 12_000_000 : 24_000_000;
        const dimensionsOkay = (width, height) =>
            width > 0 && height > 0 && width * height <= pixelLimit;
        if (extension === "pdf" && !ascii(0, 1024).includes("%PDF-"))
            return rejected("This file does not contain a valid PDF signature.");
        if (extension === "png") {
            if (ascii(1, 4) !== "PNG" || bytes[0] !== 0x89 || bytes[4] !== 13 || bytes[5] !== 10)
                return rejected("This file does not contain a PNG signature.");
            if (bytes.length >= 24) {
                const view = new DataView(bytes.buffer);
                if (!dimensionsOkay(view.getUint32(16), view.getUint32(20)))
                    return rejected("Image exceeds the pixel-count safety limit for this device.");
            }
        }
        if (["jpg", "jpeg"].includes(extension) && (bytes[0] !== 0xff || bytes[1] !== 0xd8))
            return rejected("This file does not contain a JPEG signature.");
        if (extension === "bmp") {
            if (ascii(0, 2) !== "BM") return rejected("This file does not contain a BMP signature.");
            if (bytes.length >= 26) {
                const view = new DataView(bytes.buffer);
                if (!dimensionsOkay(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true))))
                    return rejected("Image exceeds the pixel-count safety limit for this device.");
            }
        }
        if (extension === "webp" && (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP"))
            return rejected("This file does not contain a WebP signature.");
        if (extension === "avif" && (!ascii(4, 8).includes("ftyp") || !/(avif|avis)/.test(ascii(8, 32))))
            return rejected("This file does not contain an AVIF signature.");
        // Audio headers are checked regardless of the filename or MIME type.
        // A renamed PDF/MP4 is not an MP3, even when FFmpeg could demux it.
        // These lightweight checks do not prove that a full stream is decodable.
        const bytesStartWith = (...header) => header.every((byte, i) => bytes[i] === byte);
        const isMpegAudioFrame = offset =>
            bytes.length >= offset + 4 &&
            bytes[offset] === 0xff &&
            (bytes[offset + 1] & 0xe0) === 0xe0 &&
            (bytes[offset + 1] & 0x18) !== 0x08 && // reserved MPEG version
            (bytes[offset + 1] & 0x06) !== 0x00 && // reserved layer
            (bytes[offset + 2] & 0xf0) !== 0xf0 && // forbidden bitrate index
            (bytes[offset + 2] & 0x0c) !== 0x0c;  // reserved sample rate
        const hasId3Header = ascii(0, 3) === "ID3" && bytes.length >= 10 &&
            bytes[3] !== 0xff && bytes[4] !== 0xff &&
            bytes[6] < 128 && bytes[7] < 128 && bytes[8] < 128 && bytes[9] < 128;
        const isAdts = bytes.length >= 7 && bytes[0] === 0xff &&
            (bytes[1] & 0xf6) === 0xf0 && (bytes[2] & 0x3c) !== 0x3c;
        const isLoas = bytes.length >= 3 && bytes[0] === 0x56 &&
            (bytes[1] & 0xe0) === 0xe0;
        const isAsf = bytesStartWith(
            0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11,
            0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c
        );
        const audioSignatures = {
            mp3: hasId3Header || isMpegAudioFrame(0),
            aac: isAdts || isLoas,
            m4a: ascii(4, 8) === "ftyp",
            m4b: ascii(4, 8) === "ftyp",
            wma: isAsf,
            aiff: ascii(0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(8, 12)),
            aif: ascii(0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(8, 12)),
            aifc: ascii(0, 4) === "FORM" && ascii(8, 12) === "AIFC",
            amr: ascii(0, 6) === "#!AMR\n" || ascii(0, 9) === "#!AMR-WB\n",
            au: ascii(0, 4) === ".snd",
            snd: ascii(0, 4) === ".snd",
            ac3: bytesStartWith(0x0b, 0x77)
        };
        if (Object.prototype.hasOwnProperty.call(audioSignatures, extension) && !audioSignatures[extension])
            return rejected(`Invalid or mismatched .${extension} file: its content does not have the expected audio signature.`);
        // Audio/video containers with stable magic signatures. These checks
        // reject obvious corruption/mislabeling; codecs still need decoding.
        if (["wav", "ogg", "oga", "opus", "flac", "avi", "mp4", "m4v", "webm", "mkv"].includes(extension)) {
            const magic = {
                wav: (ascii(0, 4) === "RIFF" || ascii(0, 4) === "RF64") && ascii(8, 12) === "WAVE",
                ogg: ascii(0, 4) === "OggS",
                oga: ascii(0, 4) === "OggS",
                opus: ascii(0, 4) === "OggS",
                flac: ascii(0, 4) === "fLaC",
                avi: ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ",
                mp4: ascii(4, 8) === "ftyp",
                m4v: ascii(4, 8) === "ftyp",
                webm: bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
                mkv: bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
            };
            if (!magic[extension]) return rejected(`The file content does not match a valid .${extension} container signature.`);
        }
        if (extension === "svg") {
            const content = new TextDecoder().decode(bytes.slice(0, 10240));
            if (!/<svg(?:\s|>)/i.test(content) || /<(?:script|foreignObject)(?:\s|>)/i.test(content))
                return rejected("SVG is malformed or contains potentially unsafe executable content.");
        }
        return { ok: true };
    }
    const categories = Object.keys(profiles);
    const extensions = category => resolve({ category })?.extensions.slice() || [];
    const allExtensions = () => [...new Set(categories.flatMap(extensions))];
    window.EasyFilePolicy = Object.freeze({ MB, profiles, operationCategory, supported, resolve, validate, categories, extensions, allExtensions, inspect });
})();
