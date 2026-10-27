console.log("[RESIZE/CROP IMAGE OPERATION] loaded");
window.EasyFileImageTransformOperation?.create?.({
    operation: "resize-crop-image",
    settingsEvent: "easyfiletools:resize-crop-settings-changed",
    getSettings: () => window.ResizeCropImageUI?.getSettings?.(),
    getEngine: () => window.ResizeCropImageEngine,
    progressLabel: "Transforming",
    completeLabel: "Transformed"
});
