/* =========================================================
   MATLIB ADMIN LOGIN
   assets/admin.js

   Independent administrator authentication.

   Features:
   - 6 digit CAPTCHA
   - Supabase authentication
   - Admin profile verification
   - Password visibility
   - Loading state
   - Error handling
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       SUPABASE
    ===================================================== */

    const sb =
        window.matlibSupabase;


    if (!sb) {

        console.error(
            "MatLib: Supabase is not configured."
        );

        return;

    }


    /* =====================================================
       DOM
    ===================================================== */

    const form =
        document.getElementById(
            "adminLoginForm"
        );


    const emailInput =
        document.getElementById(
            "adminEmail"
        );


    const passwordInput =
        document.getElementById(
            "adminPassword"
        );


    const captchaInput =
        document.getElementById(
            "adminCaptcha"
        );


    const captchaText =
        document.getElementById(
            "captchaText"
        );


    const refreshCaptchaButton =
        document.getElementById(
            "refreshCaptcha"
        );


    const togglePasswordButton =
        document.getElementById(
            "togglePassword"
        );


    const messageBox =
        document.getElementById(
            "adminMessage"
        );


    const loginButton =
        document.getElementById(
            "adminLoginButton"
        );


    const loginButtonText =
        document.getElementById(
            "loginButtonText"
        );


    const loginSpinner =
        document.getElementById(
            "loginSpinner"
        );


    const loginCard =
        document.querySelector(
            ".login-card"
        );


    /* =====================================================
       CAPTCHA
    ===================================================== */

    let currentCaptcha = "";


    function generateCaptcha() {

        /*
         * Generate EXACTLY 6 digits.
         */

        let value = "";

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            value +=
                Math.floor(
                    Math.random() * 10
                );

        }


        currentCaptcha =
            value;


        if (captchaText) {

            captchaText.textContent =
                currentCaptcha;

        }


        if (captchaInput) {

            captchaInput.value = "";

        }


        console.log(
            "MatLib CAPTCHA:",
            currentCaptcha
        );

    }


    /* =====================================================
       CAPTCHA REFRESH
    ===================================================== */

    if (refreshCaptchaButton) {

        refreshCaptchaButton.addEventListener(
            "click",
            () => {

                generateCaptcha();

                captchaInput?.focus();

            }
        );

    }


    /* =====================================================
       CAPTCHA INPUT
    ===================================================== */

    if (captchaInput) {

        captchaInput.addEventListener(
            "input",
            () => {

                /*
                 * Allow digits only.
                 */

                captchaInput.value =
                    captchaInput.value
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(
                            0,
                            6
                        );

            }
        );

    }


    /* =====================================================
       PASSWORD TOGGLE
    ===================================================== */

    if (togglePasswordButton) {

        togglePasswordButton.addEventListener(
            "click",
            () => {

                const isPassword =
                    passwordInput.type ===
                    "password";


                passwordInput.type =
                    isPassword
                        ? "text"
                        : "password";


                togglePasswordButton.textContent =
                    isPassword
                        ? "🙈"
                        : "👁";


                togglePasswordButton.setAttribute(
                    "aria-label",
                    isPassword
                        ? "Hide password"
                        : "Show password"
                );

            }
        );

    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function showMessage(
        message,
        type = "error"
    ) {

        if (!messageBox) {
            return;
        }


        messageBox.textContent =
            message;


        messageBox.className =
            `message show ${type}`;


        if (
            type === "error" &&
            loginCard
        ) {

            loginCard.classList.remove(
                "shake"
            );


            /*
             * Force browser to restart animation.
             */

            void loginCard.offsetWidth;


            loginCard.classList.add(
                "shake"
            );

        }

    }


    function clearMessage() {

        if (!messageBox) {
            return;
        }


        messageBox.textContent =
            "";


        messageBox.className =
            "message";

    }


    /* =====================================================
       LOADING
    ===================================================== */

    function setLoading(
        loading
    ) {

        if (!loginButton) {
            return;
        }


        loginButton.disabled =
            loading;


        if (loginButtonText) {

            loginButtonText.textContent =
                loading
                    ? "Authenticating..."
                    : "Login as Administrator";

        }


        if (loginSpinner) {

            loginSpinner.classList.toggle(
                "hidden",
                !loading
            );

        }

    }


    /* =====================================================
       CHECK ADMIN PROFILE
    ===================================================== */

    async function verifyAdminProfile(
        userId
    ) {

        const {
            data,
            error
        } = await sb
            .from("admin_profiles")
            .select(
                "id,name,email,role,is_active"
            )
            .eq(
                "id",
                userId
            )
            .maybeSingle();


        if (error) {

            console.error(
                "MatLib admin profile error:",
                error
            );

            throw new Error(
                "Unable to verify administrator profile."
            );

        }


        if (!data) {

            throw new Error(
                "This account is not registered as a MatLib administrator."
            );

        }


        if (
            data.is_active !== true
        ) {

            throw new Error(
                "This administrator account is inactive."
            );

        }


        if (
            String(data.role || "")
                .toLowerCase() !==
            "admin"
        ) {

            throw new Error(
                "This account does not have administrator access."
            );

        }


        return data;

    }


    /* =====================================================
       LOGIN
    ===================================================== */

    async function loginAdmin() {

        clearMessage();


        const email =
            emailInput.value.trim();


        const password =
            passwordInput.value;


        const enteredCaptcha =
            captchaInput.value.trim();


        /* -----------------------------
           BASIC VALIDATION
        ----------------------------- */

        if (!email) {

            showMessage(
                "Please enter the administrator email."
            );

            emailInput.focus();

            return;

        }


        if (!password) {

            showMessage(
                "Please enter your password."
            );

            passwordInput.focus();

            return;

        }


        if (
            enteredCaptcha.length !== 6
        ) {

            showMessage(
                "CAPTCHA must contain exactly 6 digits."
            );

            captchaInput.focus();

            return;

        }


        if (
            enteredCaptcha !==
            currentCaptcha
        ) {

            showMessage(
                "Incorrect CAPTCHA. Please enter all 6 digits."
            );

            generateCaptcha();

            captchaInput.focus();

            return;

        }


        /* -----------------------------
           LOADING
        ----------------------------- */

        setLoading(true);


        try {

            /*
             * Supabase login.
             */

            const {
                data,
                error
            } = await sb.auth.signInWithPassword({

                email:
                    email,

                password:
                    password

            });


            if (error) {

                console.error(
                    "MatLib admin login:",
                    error
                );

                throw new Error(
                    getAuthErrorMessage(
                        error
                    )
                );

            }


            if (
                !data ||
                !data.user
            ) {

                throw new Error(
                    "Login failed. No user session was created."
                );

            }


            /* -----------------------------
               VERIFY ADMIN
            ----------------------------- */

            const admin =
                await verifyAdminProfile(
                    data.user.id
                );


            console.log(
                "MatLib: Administrator verified.",
                admin
            );


            showMessage(
                "Login successful. Opening administrator dashboard...",
                "success"
            );


            /*
             * Small delay so the success message
             * is visible before redirect.
             */

            setTimeout(
                () => {

                    window.location.href =
                        "admin-dashboard.html";

                },
                500
            );

        } catch (error) {

            console.error(
                "MatLib administrator login error:",
                error
            );


            /*
             * If authentication succeeded but
             * profile verification failed, sign out.
             */

            try {

                await sb.auth.signOut();

            } catch (
                signOutError
            ) {

                console.error(
                    signOutError
                );

            }


            showMessage(
                error.message ||
                "Unable to login as administrator."
            );


            generateCaptcha();


        } finally {

            setLoading(false);

        }

    }


    /* =====================================================
       AUTH ERROR MESSAGES
    ===================================================== */

    function getAuthErrorMessage(
        error
    ) {

        const message =
            String(
                error?.message ||
                ""
            ).toLowerCase();


        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return (
                "Incorrect administrator email or password."
            );

        }


        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return (
                "Administrator email has not been confirmed."
            );

        }


        if (
            message.includes(
                "too many requests"
            )
        ) {

            return (
                "Too many login attempts. Please wait and try again."
            );

        }


        if (
            message.includes(
                "network"
            )
        ) {

            return (
                "Network error. Please check your internet connection."
            );

        }


        return (
            error?.message ||
            "Unable to authenticate administrator."
        );

    }


    /* =====================================================
       FORM SUBMIT
    ===================================================== */

    if (form) {

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await loginAdmin();

            }
        );

    }


    /* =====================================================
       ENTER KEY CAPTCHA
    ===================================================== */

    if (captchaInput) {

        captchaInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    form?.requestSubmit();

                }

            }
        );

    }


    /* =====================================================
       INITIAL CAPTCHA
    ===================================================== */

    generateCaptcha();


    /* =====================================================
       CHECK EXISTING SESSION
    ===================================================== */

    async function checkExistingSession() {

        try {

            const {
                data
            } = await sb.auth.getSession();


            const session =
                data?.session;


            if (
                !session?.user
            ) {
                return;
            }


            /*
             * Do not automatically redirect merely because
             * a session exists unless it is actually an admin.
             */

            const {
                data: profile
            } = await sb
                .from("admin_profiles")
                .select(
                    "id,is_active,role"
                )
                .eq(
                    "id",
                    session.user.id
                )
                .maybeSingle();


            if (
                profile &&
                profile.is_active === true &&
                String(profile.role || "")
                    .toLowerCase() ===
                "admin"
            ) {

                console.log(
                    "MatLib: Existing administrator session found."
                );

            }

        } catch (error) {

            console.warn(
                "MatLib session check:",
                error
            );

        }

    }


    checkExistingSession();


})();