/* ============================================================
   MATLIB FACULTY PORTAL
   Login + Registration
   Separate page JavaScript
============================================================ */

(() => {

    "use strict";


    /* ========================================================
       SUPABASE
    ========================================================= */

    const sb = window.matlibSupabase;


    if (!sb) {

        console.error(
            "MatLib: Supabase is not configured."
        );

        return;

    }


    /* ========================================================
       HELPERS
    ======================================================== */

    const $ = (id) =>
        document.getElementById(id);


    function showMessage(
        elementId,
        message,
        type = "error"
    ) {

        const element =
            $(elementId);

        if (!element) return;

        element.textContent =
            message || "";

        element.className =
            `form-message ${type}`;

    }


    function setLoading(
        button,
        loading
    ) {

        if (!button) return;

        button.disabled =
            loading;

        button.classList.toggle(
            "loading",
            loading
        );

    }


    function shake(element) {

        if (!element) return;

        element.classList.remove(
            "shake"
        );

        void element.offsetWidth;

        element.classList.add(
            "shake"
        );

    }


    function cleanFacultyId(value) {

        return String(value || "")
            .trim()
            .toUpperCase();

    }


    function cleanEmail(value) {

        return String(value || "")
            .trim()
            .toLowerCase();

    }


    /* ========================================================
       TABS
    ======================================================== */

    function initTabs() {

        const tabs =
            document.querySelectorAll(
                ".tab"
            );


        const indicator =
            $("tabIndicator");


        tabs.forEach(tab => {

            tab.addEventListener(
                "click",
                () => {

                    const target =
                        tab.dataset.tab;


                    if (!target) return;


                    tabs.forEach(item => {

                        item.classList.toggle(
                            "active",
                            item === tab
                        );

                    });


                    document
                        .querySelectorAll(
                            ".auth-panel"
                        )
                        .forEach(panel => {

                            panel.classList.toggle(
                                "active",
                                panel.dataset.panel === target
                            );

                        });


                    if (
                        target === "register"
                    ) {

                        indicator?.classList.add(
                            "register"
                        );

                    } else {

                        indicator?.classList.remove(
                            "register"
                        );

                    }


                    clearMessages();

                }
            );

        });

    }


    function clearMessages() {

        showMessage(
            "facultyLoginMessage",
            "",
            ""
        );

        showMessage(
            "facultyRegisterMessage",
            "",
            ""
        );

    }


    /* ========================================================
       PASSWORD VISIBILITY
    ======================================================== */

    function initPasswordToggles() {

        document
            .querySelectorAll(
                ".password-toggle"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            $(button.dataset.target);

                        if (!target) return;


                        const showing =
                            target.type ===
                            "text";


                        target.type =
                            showing
                                ? "password"
                                : "text";


                        button.textContent =
                            showing
                                ? "Show"
                                : "Hide";


                        button.setAttribute(
                            "aria-label",
                            showing
                                ? "Show password"
                                : "Hide password"
                        );

                    }
                );

            });

    }


    /* ========================================================
       PASSWORD STRENGTH
    ======================================================== */

    function initPasswordStrength() {

        const password =
            $("facultyPassword");

        const wrapper =
            document.querySelector(
                ".password-strength"
            );

        const text =
            $("passwordStrengthText");


        if (
            !password ||
            !wrapper ||
            !text
        ) {
            return;
        }


        password.addEventListener(
            "input",
            () => {

                const value =
                    password.value;


                wrapper.className =
                    "password-strength";


                if (!value) {

                    text.textContent =
                        "Use at least 8 characters";

                    return;
                }


                let score = 0;


                if (
                    value.length >= 8
                ) {
                    score++;
                }


                if (
                    /[A-Z]/.test(value)
                ) {
                    score++;
                }


                if (
                    /[0-9]/.test(value)
                ) {
                    score++;
                }


                if (
                    /[^A-Za-z0-9]/.test(value)
                ) {
                    score++;
                }


                if (score === 1) {

                    wrapper.classList.add(
                        "weak"
                    );

                    text.textContent =
                        "Weak password";

                } else if (score === 2) {

                    wrapper.classList.add(
                        "medium"
                    );

                    text.textContent =
                        "Fair password";

                } else if (score === 3) {

                    wrapper.classList.add(
                        "good"
                    );

                    text.textContent =
                        "Good password";

                } else {

                    wrapper.classList.add(
                        "strong"
                    );

                    text.textContent =
                        "Strong password";

                }

            }
        );

    }


    /* ========================================================
       LOGIN
    ======================================================== */

    function initLogin() {

        const form =
            $("facultyLoginForm");


        if (!form) return;


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const button =
                    $("facultyLoginButton");


                const facultyId =
                    cleanFacultyId(
                        $("facultyLoginId")?.value
                    );


                const password =
                    $("facultyLoginPassword")
                        ?.value || "";


                showMessage(
                    "facultyLoginMessage",
                    "",
                    ""
                );


                if (
                    !facultyId ||
                    !password
                ) {

                    showMessage(
                        "facultyLoginMessage",
                        "Enter your Faculty ID and password.",
                        "error"
                    );

                    shake(form);

                    return;
                }


                setLoading(
                    button,
                    true
                );


                try {

                    showMessage(
                        "facultyLoginMessage",
                        "Checking faculty account...",
                        "info"
                    );


                    /* =========================================
                       STEP 1
                       Find email from Faculty ID
                    ========================================== */

                    const {
                        data: email,
                        error: lookupError
                    } = await sb.rpc(
                        "get_faculty_login_email",
                        {
                            p_faculty_id:
                                facultyId
                        }
                    );


                    if (
                        lookupError
                    ) {

                        console.error(
                            "Faculty ID lookup error:",
                            lookupError
                        );

                        throw new Error(
                            "Unable to verify Faculty ID."
                        );

                    }


                    if (!email) {

                        throw new Error(
                            "Faculty ID is not approved yet or does not exist."
                        );

                    }


                    /* =========================================
                       STEP 2
                       Supabase login
                    ========================================== */

                    const {
                        data,
                        error: loginError
                    } = await sb.auth.signInWithPassword({

                        email:
                            cleanEmail(email),

                        password

                    });


                    if (
                        loginError
                    ) {

                        console.error(
                            "Faculty login error:",
                            loginError
                        );

                        throw new Error(
                            getLoginErrorMessage(
                                loginError
                            )
                        );

                    }


                    if (
                        !data?.user
                    ) {

                        throw new Error(
                            "Unable to create login session."
                        );

                    }


                    /* =========================================
                       STEP 3
                       Verify profile
                    ========================================== */

                    const {
                        data: profile,
                        error: profileError
                    } = await sb
                        .from("faculty_profiles")
                        .select(`
                            id,
                            name,
                            faculty_id,
                            designation,
                            phone,
                            email,
                            approval_status,
                            is_active
                        `)
                        .eq(
                            "id",
                            data.user.id
                        )
                        .maybeSingle();


                    if (
                        profileError
                    ) {

                        console.error(
                            "Faculty profile error:",
                            profileError
                        );

                        await sb.auth.signOut();

                        throw new Error(
                            "Unable to verify your faculty profile."
                        );

                    }


                    if (
                        !profile
                    ) {

                        await sb.auth.signOut();

                        throw new Error(
                            "Faculty profile not found."
                        );

                    }


                    /* =========================================
                       STEP 4
                       Approval check
                    ========================================== */

                    if (
                        profile.approval_status !==
                        "approved"
                    ) {

                        await sb.auth.signOut();

                        throw new Error(
                            "Your faculty account is still pending administrator approval."
                        );

                    }


                    if (
                        profile.is_active !== true
                    ) {

                        await sb.auth.signOut();

                        throw new Error(
                            "Your faculty account is currently inactive."
                        );

                    }


                    /* =========================================
                       SAVE FACULTY INFO
                    ========================================== */

                    sessionStorage.setItem(
                        "matlib_faculty_name",
                        profile.name || ""
                    );


                    sessionStorage.setItem(
                        "matlib_faculty_id",
                        profile.faculty_id || ""
                    );


                    sessionStorage.setItem(
                        "matlib_faculty_designation",
                        profile.designation || ""
                    );


                    /* =========================================
                       SUCCESS
                    ========================================== */

                    showMessage(
                        "facultyLoginMessage",
                        "Login successful. Opening Faculty Dashboard...",
                        "success"
                    );


                    await sleep(500);


                    window.location.href =
                        "faculty-dashboard.html";

                } catch (error) {

                    console.error(
                        error
                    );


                    showMessage(
                        "facultyLoginMessage",
                        error.message ||
                        "Login failed. Please try again.",
                        "error"
                    );


                    shake(form);

                } finally {

                    setLoading(
                        button,
                        false
                    );

                }

            }
        );

    }


    function getLoginErrorMessage(
        error
    ) {

        const message =
            String(
                error?.message || ""
            ).toLowerCase();


        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return (
                "Incorrect password or Faculty ID."
            );

        }


        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return (
                "Your email address has not been confirmed yet."
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


        return (
            error?.message ||
            "Login failed."
        );

    }


    /* ========================================================
       REGISTRATION
    ======================================================== */

    function initRegistration() {

        const form =
            $("facultyRegisterForm");


        if (!form) return;


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const button =
                    $("facultyRegisterButton");


                const name =
                    $("facultyName")
                        ?.value
                        .trim();


                const facultyId =
                    cleanFacultyId(
                        $("facultyId")?.value
                    );


                const designation =
                    $("facultyDesignation")
                        ?.value;


                const phone =
                    $("facultyPhone")
                        ?.value
                        .trim();


                const email =
                    cleanEmail(
                        $("facultyEmail")?.value
                    );


                const password =
                    $("facultyPassword")
                        ?.value || "";


                const confirmPassword =
                    $("facultyConfirmPassword")
                        ?.value || "";


                showMessage(
                    "facultyRegisterMessage",
                    "",
                    ""
                );


                /* =========================================
                   VALIDATION
                ========================================== */

                if (
                    !name ||
                    !facultyId ||
                    !designation ||
                    !email ||
                    !password ||
                    !confirmPassword
                ) {

                    showMessage(
                        "facultyRegisterMessage",
                        "Please fill all required fields.",
                        "error"
                    );

                    shake(form);

                    return;
                }


                if (
                    name.length < 2
                ) {

                    showMessage(
                        "facultyRegisterMessage",
                        "Please enter a valid full name.",
                        "error"
                    );

                    shake(form);

                    return;
                }


                if (
                    password.length < 8
                ) {

                    showMessage(
                        "facultyRegisterMessage",
                        "Password must contain at least 8 characters.",
                        "error"
                    );

                    shake(form);

                    return;
                }


                if (
                    password !==
                    confirmPassword
                ) {

                    showMessage(
                        "facultyRegisterMessage",
                        "Passwords do not match.",
                        "error"
                    );

                    shake(
                        $("facultyConfirmPassword")
                    );

                    return;
                }


                if (
                    !isValidEmail(email)
                ) {

                    showMessage(
                        "facultyRegisterMessage",
                        "Please enter a valid email address.",
                        "error"
                    );

                    shake(
                        $("facultyEmail")
                    );

                    return;
                }


                setLoading(
                    button,
                    true
                );


                try {

                    showMessage(
                        "facultyRegisterMessage",
                        "Submitting registration...",
                        "info"
                    );


                    /* =========================================
                       SUPABASE SIGN UP
                    ========================================== */

                    const {
                        data,
                        error
                    } = await sb.auth.signUp({

                        email,

                        password,

                        options: {

                            data: {

                                role:
                                    "faculty",

                                name,

                                faculty_id:
                                    facultyId,

                                designation,

                                phone

                            }

                        }

                    });


                    if (
                        error
                    ) {

                        console.error(
                            "Faculty registration error:",
                            error
                        );

                        throw new Error(
                            getRegistrationErrorMessage(
                                error
                            )
                        );

                    }


                    if (
                        !data?.user
                    ) {

                        throw new Error(
                            "Registration failed. Please try again."
                        );

                    }


                    /* =========================================
                       IF SUPABASE AUTO-LOGGED USER
                    ========================================== */

                    if (
                        data.session
                    ) {

                        await sb.auth.signOut();

                    }


                    /* =========================================
                       SUCCESS
                    ========================================== */

                    form.reset();


                    const strength =
                        document.querySelector(
                            ".password-strength"
                        );


                    if (strength) {

                        strength.className =
                            "password-strength";

                    }


                    const strengthText =
                        $("passwordStrengthText");


                    if (strengthText) {

                        strengthText.textContent =
                            "Use at least 8 characters";

                    }


                    showMessage(
                        "facultyRegisterMessage",
                        "Registration submitted successfully. Your account is now PENDING ADMIN APPROVAL.",
                        "success"
                    );


                    /* =========================================
                       Automatically move to LOGIN
                       after a short delay
                    ========================================== */

                    setTimeout(
                        () => {

                            document
                                .querySelector(
                                    '.tab[data-tab="login"]'
                                )
                                ?.click();

                        },
                        2500
                    );

                } catch (error) {

                    console.error(
                        error
                    );


                    showMessage(
                        "facultyRegisterMessage",
                        error.message ||
                        "Registration failed.",
                        "error"
                    );


                    shake(form);

                } finally {

                    setLoading(
                        button,
                        false
                    );

                }

            }
        );

    }


    function getRegistrationErrorMessage(
        error
    ) {

        const message =
            String(
                error?.message || ""
            ).toLowerCase();


        if (
            message.includes(
                "user already registered"
            )
        ) {

            return (
                "This email address is already registered."
            );

        }


        if (
            message.includes(
                "password"
            ) &&
            message.includes(
                "characters"
            )
        ) {

            return (
                "Password must contain at least 8 characters."
            );

        }


        if (
            message.includes(
                "rate limit"
            )
        ) {

            return (
                "Too many registration attempts. Please try again later."
            );

        }


        return (
            error?.message ||
            "Unable to submit registration."
        );

    }


    /* ========================================================
       EMAIL VALIDATION
    ======================================================== */

    function isValidEmail(
        email
    ) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);

    }


    /* ========================================================
       AUTO CAPITALIZE FACULTY ID
    ======================================================== */

    function initFacultyIdFormatting() {

        const fields = [

            $("facultyLoginId"),

            $("facultyId")

        ];


        fields.forEach(field => {

            if (!field) return;


            field.addEventListener(
                "input",
                () => {

                    const start =
                        field.selectionStart;


                    const value =
                        field.value;


                    field.value =
                        value.toUpperCase();


                    try {

                        field.setSelectionRange(
                            start,
                            start
                        );

                    } catch (_) {}

                }
            );

        });

    }


    /* ========================================================
       ENTER KEY / FORM UX
    ======================================================== */

    function initInputUX() {

        document
            .querySelectorAll(
                ".input-wrap input, .input-wrap select"
            )
            .forEach(input => {

                input.addEventListener(
                    "focus",
                    () => {

                        input
                            .closest(".input-wrap")
                            ?.classList.add(
                                "focused"
                            );

                    }
                );


                input.addEventListener(
                    "blur",
                    () => {

                        input
                            .closest(".input-wrap")
                            ?.classList.remove(
                                "focused"
                            );

                    }
                );

            });

    }


    /* ========================================================
       CHECK EXISTING SESSION
    ======================================================== */

    async function checkExistingSession() {

        try {

            const {
                data
            } = await sb.auth.getSession();


            const session =
                data?.session;


            if (!session?.user) {
                return;
            }


            const {
                data: profile
            } = await sb
                .from("faculty_profiles")
                .select(`
                    id,
                    name,
                    faculty_id,
                    designation,
                    approval_status,
                    is_active
                `)
                .eq(
                    "id",
                    session.user.id
                )
                .maybeSingle();


            if (
                profile &&
                profile.approval_status ===
                    "approved" &&
                profile.is_active === true
            ) {

                window.location.href =
                    "faculty-dashboard.html";

            }

        } catch (error) {

            console.warn(
                "Existing session check skipped:",
                error
            );

        }

    }


    /* ========================================================
       UTILITY
    ======================================================== */

    function sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    async function init() {

        initTabs();

        initPasswordToggles();

        initPasswordStrength();

        initLogin();

        initRegistration();

        initFacultyIdFormatting();

        initInputUX();

        await checkExistingSession();


        console.log(
            "MatLib Faculty Portal loaded successfully."
        );

    }


    init();

})();