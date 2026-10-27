/* Escape untrusted strings before inserting them in HTML template literals.
 * Prefer node.textContent where HTML markup is not required.
 */
function easyFileEscapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}
