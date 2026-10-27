console.log("[ROTATE/FLIP IMAGE ENGINE] loaded");

(() => {
    "use strict";
    const factory = window.EasyFileImageTransformEngine;
    if (!factory) return;

    function outputFormatFor(file, settings) {
        const source = window.EasyFileRasterTools.normalizeExtension(file.name);
        return settings.outputFormat === "same" ? source : settings.outputFormat;
    }

    const engine = factory.create("rotate-flip-image", async ({ file, decoded, settings }) => {
        const rawAngle = Number(settings.rotation) || 0;
        const normalizedAngle = ((rawAngle % 360) + 360) % 360;
        const sourceFormat = window.EasyFileRasterTools.normalizeExtension(file.name);
        const outputFormat = outputFormatFor(file, settings);

        if (
            Math.abs(normalizedAngle) < 0.000001 &&
            !settings.flipHorizontal &&
            !settings.flipVertical &&
            outputFormat === sourceFormat
        ) {
            return { passthrough: true, suffix: "rotated" };
        }

        const radians = normalizedAngle * Math.PI / 180;
        let cos = Math.abs(Math.cos(radians));
        let sin = Math.abs(Math.sin(radians));
        if (cos < 1e-10) cos = 0;
        if (sin < 1e-10) sin = 0;
        const width = Math.max(1, Math.ceil(decoded.width * cos + decoded.height * sin));
        const height = Math.max(1, Math.ceil(decoded.width * sin + decoded.height * cos));

        window.EasyFileRasterTools.assertSafeCanvas(width, height);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");

        if (outputFormat === "jpg" || outputFormat === "bmp") {
            context.fillStyle = settings.backgroundColor || "#ffffff";
            context.fillRect(0, 0, width, height);
        }

        context.save();
        context.translate(width / 2, height / 2);
        context.scale(settings.flipHorizontal ? -1 : 1, settings.flipVertical ? -1 : 1);
        context.rotate(radians);
        context.drawImage(decoded.source, -decoded.width / 2, -decoded.height / 2);
        context.restore();

        return { canvas, suffix: "rotated" };
    });

    window.RotateFlipImageEngine = engine;
})();
