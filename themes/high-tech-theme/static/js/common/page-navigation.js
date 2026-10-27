console.log(
    "[PAGE NAVIGATION] page-navigation.js loaded"
);


/* =========================
   PAGE NAVIGATION
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* =========================
           ELEMENTS
        ========================= */

        const goBackBtn =
            document.getElementById(
                "goBackBtn"
            );


        const goToTopBtn =
            document.getElementById(
                "goToTopBtn"
            );


        /* =========================
           GO TO TOP
        ========================= */

        if (goToTopBtn) {

            goToTopBtn.addEventListener(
                "click",
                () => {

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                }
            );
        }


        /* =========================
           GO BACK STATE
        ========================= */

        if (goBackBtn) {

            let hasInternalPreviousPage =
                false;


            const referrer =
                document.referrer;


            if (referrer) {

                try {

                    const previousUrl =
                        new URL(
                            referrer
                        );


                    const currentUrl =
                        new URL(
                            window.location.href
                        );


                    /*
                     * Go Back becomes active only
                     * if the previous page belongs
                     * to Easy File Tools.
                     */

                    hasInternalPreviousPage =
                        previousUrl.origin ===
                            currentUrl.origin &&

                        previousUrl.href !==
                            currentUrl.href;


                } catch (error) {

                    console.warn(
                        "[PAGE NAVIGATION] Unable to read referrer:",
                        error
                    );

                }
            }


            /* =========================
               ENABLE / DISABLE
            ========================= */

            goBackBtn.disabled =
                !hasInternalPreviousPage;


            goBackBtn.setAttribute(
                "aria-disabled",
                hasInternalPreviousPage
                    ? "false"
                    : "true"
            );


            console.log(
                "[PAGE NAVIGATION] Go back enabled:",
                hasInternalPreviousPage,
                {
                    referrer:
                        referrer || "(none)"
                }
            );
        }

    }
);