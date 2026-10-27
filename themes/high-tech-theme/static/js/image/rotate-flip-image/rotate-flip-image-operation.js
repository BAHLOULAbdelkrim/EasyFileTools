console.log("[ROTATE/FLIP IMAGE OPERATION] loaded");
window.EasyFileImageTransformOperation?.create?.({
    operation: "rotate-flip-image",
    settingsEvent: "easyfiletools:rotate-flip-settings-changed",
    getSettings: () => window.RotateFlipImageUI?.getSettings?.(),
    getEngine: () => window.RotateFlipImageEngine,
    progressLabel: "Transforming",
    completeLabel: "Transformed"
});
