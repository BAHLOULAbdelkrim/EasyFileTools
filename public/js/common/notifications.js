console.log("common/notifications.js loaded");


/* =========================
   GENERIC NOTIFICATIONS
========================= */

function showNotification(
    message,
    type = "error",
    duration = 2000
) {

    let container =
        document.getElementById(
            "notification-container"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "notification-container";

        document.body.appendChild(
            container
        );
    }


    const notification =
        document.createElement("div");

    notification.className =
        `notification notification-${type}`;


    const notificationData = {

        error: {
            title: "Error",
            icon: "circle-x"
        },

        warning: {
            title: "Warning",
            icon: "triangle-alert"
        },

        info: {
            title: "Information",
            icon: "info"
        },

        success: {
            title: "Success",
            icon: "circle-check"
        }

    };


    const data =
        notificationData[type] ||
        notificationData.error;


    notification.innerHTML = `

        <div class="notification-header">

            <i
                data-lucide="${data.icon}"
                class="notification-icon"
            ></i>

            <span>
                ${data.title}
            </span>

        </div>


        <div class="notification-body"></div>

    `;
    notification.querySelector(".notification-body").textContent = String(message ?? "");

    container.appendChild(
        notification
    );


    /* Création des icônes Lucide */

    if (typeof createLocalIcons === "function") {

        createLocalIcons(notification);

    }
    else if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }


    /* =========================
    APPEAR
    ========================= */

    requestAnimationFrame(
        () => {

            notification.classList.add(
                "visible"
            );
        }
    );


    /* =========================
    DISAPPEAR
    ========================= */

    setTimeout(
        () => {

            /*
            * Removing "visible" triggers
            * the CSS fade-out transition.
            */

            notification.classList.remove(
                "visible"
            );


            /*
            * Remove the element only AFTER
            * the 0.35 s CSS transition.
            */

            setTimeout(
                () => {

                    notification.remove();

                },
                350
            );

        },
        duration
    );

}
// IndexedDB quota, permissions and transaction failures must never be silent.
document.addEventListener("easyfiletools:storage-error", () => {
    showNotification("Local file storage failed (browser quota or private mode). Try fewer files, free storage, or reload. Your selection may not survive navigation.", "error", 8000);
});
