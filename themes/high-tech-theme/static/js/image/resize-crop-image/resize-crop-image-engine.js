console.log("[RESIZE/CROP IMAGE ENGINE] loaded");

(() => {
    "use strict";
    const factory = window.EasyFileImageTransformEngine;
    if (!factory) return;

    function resolveOutputFormat(file, settings) {
        const source = window.EasyFileRasterTools.normalizeExtension(file.name);
        return settings.outputFormat === "same" ? source : settings.outputFormat;
    }

    function paintBackgroundIfNeeded(context, width, height, file, settings) {
        const format = resolveOutputFormat(file, settings);
        if (format === "jpg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
        }
    }

    function parseRatio(value) {
        const [a, b] = String(value || "1:1").split(":").map(Number);
        return a > 0 && b > 0 ? a / b : 1;
    }

    function cropRect(width, height, ratio, anchor) {
        const sourceRatio = width / height;
        let cropWidth = width;
        let cropHeight = height;
        if (sourceRatio > ratio) cropWidth = height * ratio;
        else if (sourceRatio < ratio) cropHeight = width / ratio;

        let x = (width - cropWidth) / 2;
        let y = (height - cropHeight) / 2;
        if (anchor.includes("left")) x = 0;
        if (anchor.includes("right")) x = width - cropWidth;
        if (anchor === "left" || anchor === "right") y = (height - cropHeight) / 2;
        if (anchor.includes("top")) y = 0;
        if (anchor.includes("bottom")) y = height - cropHeight;
        if (anchor === "top" || anchor === "bottom") x = (width - cropWidth) / 2;
        return { x, y, width: cropWidth, height: cropHeight };
    }

    const engine = factory.create("resize-crop-image", async ({ file, decoded, settings }) => {
        const sourceFormat = window.EasyFileRasterTools.normalizeExtension(file.name);
        const outputFormat = resolveOutputFormat(file, settings);

        if (settings.mode === "resize") {
            let targetWidth;
            let targetHeight;
            const requestedWidth = Number(settings.width) || 0;
            const requestedHeight = Number(settings.height) || 0;

            if (settings.keepAspect) {
                let scale;
                if (requestedWidth > 0 && requestedHeight > 0) {
                    scale = Math.min(requestedWidth / decoded.width, requestedHeight / decoded.height);
                }
                else if (requestedWidth > 0) scale = requestedWidth / decoded.width;
                else scale = requestedHeight / decoded.height;
                if (settings.preventUpscale) scale = Math.min(1, scale);
                targetWidth = Math.max(1, Math.round(decoded.width * scale));
                targetHeight = Math.max(1, Math.round(decoded.height * scale));
            }
            else {
                targetWidth = Math.max(1, Math.round(requestedWidth));
                targetHeight = Math.max(1, Math.round(requestedHeight));
                if (settings.preventUpscale) {
                    targetWidth = Math.min(targetWidth, decoded.width);
                    targetHeight = Math.min(targetHeight, decoded.height);
                }
            }

            if (
                targetWidth === decoded.width &&
                targetHeight === decoded.height &&
                outputFormat === sourceFormat
            ) {
                return { passthrough: true, suffix: "resized" };
            }

            window.EasyFileRasterTools.assertSafeCanvas(targetWidth, targetHeight);
            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas 2D is unavailable.");
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            paintBackgroundIfNeeded(context, targetWidth, targetHeight, file, settings);
            context.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);
            return { canvas, suffix: "resized" };
        }

        const ratio = parseRatio(settings.cropRatio);
        const rect = cropRect(decoded.width, decoded.height, ratio, settings.cropAnchor || "center");
        const targetWidth = Math.max(1, Math.round(rect.width));
        const targetHeight = Math.max(1, Math.round(rect.height));

        if (
            targetWidth === decoded.width &&
            targetHeight === decoded.height &&
            outputFormat === sourceFormat
        ) {
            return { passthrough: true, suffix: "cropped" };
        }

        window.EasyFileRasterTools.assertSafeCanvas(targetWidth, targetHeight);
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");
        paintBackgroundIfNeeded(context, targetWidth, targetHeight, file, settings);
        context.drawImage(
            decoded.source,
            rect.x, rect.y, rect.width, rect.height,
            0, 0, targetWidth, targetHeight
        );
        return { canvas, suffix: "cropped" };
    });

    window.ResizeCropImageEngine = engine;
})();
