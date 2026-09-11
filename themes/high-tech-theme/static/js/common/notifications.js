console.log("common/notifications.js loaded");


/* =========================
   GENERIC NOTIFICATIONS
========================= */

function showNotification(
    message,
    type = "error",
    duration = 4000
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
            title: "Erreur",
            icon: "circle-x"
        },

        warning: {
            title: "Avertissement",
            icon: "triangle-alert"
        },

        info: {
            title: "Information",
            icon: "info"
        },

        success: {
            title: "Succès",
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


        <div class="notification-body">

            ${message}

        </div>

    `;


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


    setTimeout(() => {

        notification.remove();

    }, duration);
}