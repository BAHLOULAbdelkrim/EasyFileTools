/* EasyFile Tools — Replace Colors pixel worker */
let paused = false;
let cancelled = false;
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

function hexToRgb(hex) {
    const value = String(hex || "#000000").replace("#", "");
    return {
        r: parseInt(value.slice(0, 2), 16) || 0,
        g: parseInt(value.slice(2, 4), 16) || 0,
        b: parseInt(value.slice(4, 6), 16) || 0
    };
}

function prepareRules(rules) {
    return (Array.isArray(rules) ? rules : []).map(rule => {
        const source = hexToRgb(rule.sourceColor);
        const target = rule.action === "color" ? hexToRgb(rule.targetColor) : null;
        const tolerance = Math.max(0, Math.min(100, Number(rule.tolerance) || 0));
        const softness = Math.max(0, Math.min(100, Number(rule.softness) || 0));
        const inner = MAX_RGB_DISTANCE * tolerance / 100;
        const outer = MAX_RGB_DISTANCE * Math.min(100, tolerance + softness) / 100;
        return {
            ...rule,
            source,
            target,
            inner,
            outer,
            inner2: inner * inner,
            outer2: outer * outer
        };
    });
}

function strengthFor(r, g, b, rule) {
    const dr = r - rule.source.r;
    const dg = g - rule.source.g;
    const db = b - rule.source.b;
    const distance2 = dr * dr + dg * dg + db * db;
    if (distance2 > rule.outer2) return 0;
    if (distance2 <= rule.inner2 || rule.outer <= rule.inner) return 1;
    const distance = Math.sqrt(distance2);
    return Math.max(0, Math.min(1, 1 - (distance - rule.inner) / (rule.outer - rule.inner)));
}

async function checkpoint() {
    if (cancelled) throw new Error("REPLACE_COLORS_CANCELLED");
    while (paused && !cancelled) {
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    if (cancelled) throw new Error("REPLACE_COLORS_CANCELLED");
}

async function processPixels(message) {
    const { id, width, height, buffer, rules } = message;
    cancelled = false;
    paused = false;
    const prepared = prepareRules(rules);
    const pixels = new Uint8ClampedArray(buffer);
    const rowStride = width * 4;
    const chunkRows = Math.max(4, Math.min(28, Math.floor(800000 / Math.max(1, width))));

    try {
        for (let y = 0; y < height; y++) {
            const rowEnd = (y + 1) * rowStride;
            for (let offset = y * rowStride; offset < rowEnd; offset += 4) {
                const r = pixels[offset];
                const g = pixels[offset + 1];
                const b = pixels[offset + 2];
                const a = pixels[offset + 3];
                if (a === 0) continue;

                let bestRule = null;
                let bestStrength = 0;
                for (const rule of prepared) {
                    const strength = strengthFor(r, g, b, rule);
                    if (strength > bestStrength) {
                        bestStrength = strength;
                        bestRule = rule;
                    }
                }

                if (!bestRule || bestStrength <= 0) continue;

                if (bestRule.action === "transparent") {
                    pixels[offset + 3] = Math.round(a * (1 - bestStrength));
                } else if (bestRule.target) {
                    pixels[offset] = Math.round(r * (1 - bestStrength) + bestRule.target.r * bestStrength);
                    pixels[offset + 1] = Math.round(g * (1 - bestStrength) + bestRule.target.g * bestStrength);
                    pixels[offset + 2] = Math.round(b * (1 - bestStrength) + bestRule.target.b * bestStrength);
                }
            }

            if (y % chunkRows === 0 || y === height - 1) {
                self.postMessage({ type: "progress", id, progress: Math.round(((y + 1) / height) * 100) });
                await new Promise(resolve => setTimeout(resolve, 0));
                await checkpoint();
            }
        }

        self.postMessage({ type: "result", id, buffer: pixels.buffer }, [pixels.buffer]);
    } catch (error) {
        self.postMessage({ type: "error", id, message: error?.message || String(error) });
    }
}

self.addEventListener("message", event => {
    const message = event.data || {};
    if (message.type === "process") processPixels(message);
    if (message.type === "pause") paused = true;
    if (message.type === "resume") paused = false;
    if (message.type === "cancel") { cancelled = true; paused = false; }
});
