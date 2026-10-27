console.log("[IMAGE RASTER UTILS] loaded");

(() => {
    "use strict";

    const MAX_CANVAS_PIXELS = 60_000_000;

    function extractFile(item) {
        return item instanceof File ? item : item?.file || null;
    }

    function normalizeExtension(filename = "") {
        const dot = filename.lastIndexOf(".");
        if (dot < 0) return "";
        const ext = filename.slice(dot + 1).toLowerCase();
        return ext === "jpeg" ? "jpg" : ext;
    }

    function baseName(filename = "image") {
        const dot = filename.lastIndexOf(".");
        return dot > 0 ? filename.slice(0, dot) : filename;
    }

    function mimeFor(format) {
        return {
            jpg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            avif: "image/avif",
            bmp: "image/bmp"
        }[format] || "";
    }

    async function decodeImage(file) {
        if (typeof createImageBitmap === "function") {
            try {
                let bitmap;
                try {
                    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
                }
                catch (_) {
                    bitmap = await createImageBitmap(file);
                }
                return {
                    source: bitmap,
                    width: bitmap.width,
                    height: bitmap.height,
                    close() { bitmap.close?.(); }
                };
            }
            catch (_) {
                // Image element fallback below.
            }
        }

        return await new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => resolve({
                source: image,
                width: image.naturalWidth,
                height: image.naturalHeight,
                close() { URL.revokeObjectURL(url); }
            });
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Unable to decode ${file.name}.`));
            };
            image.src = url;
        });
    }

    function assertSafeCanvas(width, height) {
        if (
            !Number.isFinite(width) || !Number.isFinite(height) ||
            width <= 0 || height <= 0 ||
            width * height > MAX_CANVAS_PIXELS
        ) {
            throw new Error(`Image dimensions are too large to process safely (${Math.round(width)} × ${Math.round(height)}).`);
        }
    }

    function encodeBmp(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");
        const rgba = context.getImageData(0, 0, width, height).data;
        const rowSize = Math.ceil((width * 3) / 4) * 4;
        const pixelBytes = rowSize * height;
        const buffer = new ArrayBuffer(54 + pixelBytes);
        const view = new DataView(buffer);
        let offset = 0;
        const u8 = v => { view.setUint8(offset, v); offset += 1; };
        const u16 = v => { view.setUint16(offset, v, true); offset += 2; };
        const u32 = v => { view.setUint32(offset, v, true); offset += 4; };
        u8(0x42); u8(0x4d); u32(54 + pixelBytes); u16(0); u16(0); u32(54);
        u32(40); u32(width); u32(height); u16(1); u16(24); u32(0); u32(pixelBytes);
        u32(2835); u32(2835); u32(0); u32(0);
        for (let y = height - 1; y >= 0; y--) {
            const rowStart = offset;
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                u8(rgba[i + 2]); u8(rgba[i + 1]); u8(rgba[i]);
            }
            while (offset - rowStart < rowSize) u8(0);
        }
        return new Blob([buffer], { type: "image/bmp" });
    }

    function canvasToBlobExact(canvas, mime, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error("The browser could not encode this image."));
                if (blob.type !== mime) return reject(new Error(`The browser returned ${blob.type || "an unknown format"} instead of ${mime}.`));
                resolve(blob);
            }, mime, quality);
        });
    }

    async function encodeCanvas(canvas, format, quality = 0.92) {
        if (format === "bmp") return encodeBmp(canvas);
        const mime = mimeFor(format);
        if (!mime) throw new Error(`Unsupported output format: ${format}.`);
        return await canvasToBlobExact(canvas, mime, ["jpg", "webp", "avif"].includes(format) ? quality : undefined);
    }

    function releaseCanvas(canvas) {
        if (!canvas) return;
        canvas.width = 1;
        canvas.height = 1;
    }

    async function canEncode(format) {
        if (format === "bmp") return true;
        const mime = mimeFor(format);
        if (!mime) return false;
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        const context = canvas.getContext("2d");
        context?.fillRect(0, 0, 2, 2);
        try {
            const blob = await canvasToBlobExact(canvas, mime, 0.8);
            return Boolean(blob);
        }
        catch (_) {
            return false;
        }
        finally {
            releaseCanvas(canvas);
        }
    }

    window.EasyFileRasterTools = Object.freeze({
        MAX_CANVAS_PIXELS,
        extractFile,
        normalizeExtension,
        baseName,
        mimeFor,
        decodeImage,
        assertSafeCanvas,
        encodeCanvas,
        releaseCanvas,
        canEncode
    });
})();
