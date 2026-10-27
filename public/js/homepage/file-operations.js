
/* =========================================
   Afficher les opérations compatibles
========================================= */

function renderCompatibleOperations() {

    const operationsList = document.getElementById("operations-list");

    if (!operationsList) return;

    operationsList.innerHTML = "";

    const operations = getCompatibleOperations(
        currentCategory,
        selectedFiles.length,
        selectedFiles
    );



/*
    operations.forEach(operation => {

        const button = document.createElement("a");

        button.className = "operation-btn";
        button.href = operation.url;

        button.innerHTML = `
            <i data-lucide="${operation.icon}"></i>
            <span>${operation.name}</span>
        `;

        operationsList.appendChild(button);
    });
*/

    operations.forEach(operation => {

        const button = document.createElement("a");

        button.className = "operation-btn";

        button.href = operation.url;

        button.innerHTML = `
            <i data-lucide="${operation.icon}"></i>
            <span>${operation.name}</span>
        `;

        /* =====================================================
        SAUVEGARDER LES FICHIERS AVANT DE NAVIGUER
        ===================================================== */

        button.addEventListener("click", (e) => {

            e.preventDefault();

            console.log(
                "[FILE STORAGE] Navigation to:",
                operation.url
            );

            window.location.href =
                operation.url;

        });

        operationsList.appendChild(button);
    });

    createLocalIcons(operationsList);
}


