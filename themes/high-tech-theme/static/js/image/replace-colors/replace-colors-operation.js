console.log("[REPLACE COLORS OPERATION] loaded");
window.EasyFileImageTransformOperation?.create?.({
    operation: "replace-colors",
    settingsEvent: "easyfiletools:replace-colors-settings-changed",
    getSettings: () => window.ReplaceColorsUI?.getSettings?.(),
    getEngine: () => window.ReplaceColorsEngine,
    progressLabel: "Replacing colors",
    completeLabel: "Colors replaced"
});
