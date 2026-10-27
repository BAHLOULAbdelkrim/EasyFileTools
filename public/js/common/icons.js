console.log("icons.js loaded");

/* =========================================================
   LOCAL ICON SYSTEM
   ========================================================= */

const LOCAL_ICONS_PATH = "/icons/";

/*
=========================================================
   CHARGER UNE ICÔNE SVG LOCALE
=========================================================
*/

const cachedIconRequests = new Map();

async function loadLocalIcon(iconName) {
    if (!/^[a-z0-9-]+$/.test(iconName)) return null;

    if (!cachedIconRequests.has(iconName)) {
        cachedIconRequests.set(iconName, (async () => {
            try {
                const response = await fetch(`${LOCAL_ICONS_PATH}${iconName}.svg`);
                if (!response.ok) return null;
                const svgText = await response.text();
                const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
                const svg = doc.querySelector("svg");
                if (!svg || doc.querySelector("parsererror")) return null;
                // The icons are trusted same-origin files; remove any unexpected
                // active content in case a future asset is unintentionally edited.
                svg.querySelectorAll("script,foreignObject").forEach(el => el.remove());
                svg.removeAttribute("xmlns:xlink");
                svg.setAttribute("aria-hidden", "true");
                svg.setAttribute("stroke", "currentColor");
                return svg;
            } catch (error) {
                console.warn(`[ICONS] Icon unavailable: ${iconName}`, error);
                return null;
            }
        })());
    }
    const template = await cachedIconRequests.get(iconName);
    return template ? template.cloneNode(true) : null;
}

/*
=========================================================
   REMPLACER LES <i data-lucide="...">
=========================================================
*/

async function createLocalIcons(root = document) {
    const elements = Array.from(root.querySelectorAll("i[data-lucide]"));
    // Parallel fetches remove a potentially long sequential icon-request chain.
    await Promise.all(elements.map(async element => {
        const iconName = element.getAttribute("data-lucide");
        if (!iconName) return;
        const svg = await loadLocalIcon(iconName);
        if (!svg || !element.isConnected) return;
        if (element.className) svg.setAttribute("class", element.className);
        for (const attribute of element.attributes) {
            const name = attribute.name;
            if (name === "data-lucide" || name === "class") continue;
            svg.setAttribute(name, attribute.value);
        }
        element.replaceWith(svg);
    }));
}

/*
=========================================================
   INITIALISATION
=========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createLocalIcons();

    }
);