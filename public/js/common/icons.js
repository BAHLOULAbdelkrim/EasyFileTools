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

async function loadLocalIcon(iconName) {

    try {

        const response =
            await fetch(
                `${LOCAL_ICONS_PATH}${iconName}.svg`
            );

        if (!response.ok) {

            console.warn(
                `[ICONS] Icon not found: ${iconName}`
            );

            return null;
        }

        const svgText =
            await response.text();

        const parser =
            new DOMParser();

        const doc =
            parser.parseFromString(
                svgText,
                "image/svg+xml"
            );

        const svg =
            doc.querySelector("svg");

        if (!svg) {

            console.warn(
                `[ICONS] Invalid SVG: ${iconName}`
            );

            return null;
        }

        /*
        ---------------------------------------------------------
        Nettoyage / normalisation du SVG
        ---------------------------------------------------------
        */

        svg.removeAttribute("xmlns:xlink");

        svg.setAttribute(
            "aria-hidden",
            "true"
        );

        /*
        IMPORTANT :
        l'icône hérite de la couleur de son parent
        */

        svg.setAttribute(
            "stroke",
            "currentColor"
        );

        return svg;

    }
    catch (error) {

        console.error(
            `[ICONS] Failed to load icon: ${iconName}`,
            error
        );

        return null;
    }
}

/*
=========================================================
   REMPLACER LES <i data-lucide="...">
=========================================================
*/

async function createLocalIcons(root = document) {

    const elements =
        root.querySelectorAll(
            "i[data-lucide]"
        );

    for (const element of elements) {

        const iconName =
            element.getAttribute(
                "data-lucide"
            );

        if (!iconName) {
            continue;
        }

        const svg =
            await loadLocalIcon(iconName);

        if (!svg) {
            continue;
        }

        /*
        ---------------------------------------------------------
        Copier les classes CSS de l'ancien <i>
        ---------------------------------------------------------
        */

        if (element.className) {

            svg.setAttribute(
                "class",
                element.className
            );

        }

        /*
        ---------------------------------------------------------
        Copier les attributs utiles
        ---------------------------------------------------------
        */

        for (const attribute of element.attributes) {

            const name =
                attribute.name;

            if (
                name === "data-lucide" ||
                name === "class"
            ) {
                continue;
            }

            svg.setAttribute(
                name,
                attribute.value
            );

        }

        /*
        ---------------------------------------------------------
        Remplacer l'ancien élément
        ---------------------------------------------------------
        */

        element.replaceWith(svg);
    }
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