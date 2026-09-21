// ============================================================
// MATLIB STUDENT PORTAL
// Functionality preserved
// ============================================================

"use strict";


console.log(
    "MatLib Student Portal loaded."
);


const SESSION_KEY =
    "matlib_student";


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Student page ready."
        );


        initializeStudentPortal();


        const loginForm =
            document.getElementById(
                "studentLoginForm"
            );


        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                handleStudentLogin
            );

        }

    }
);


// ============================================================
// INITIALIZE STUDENT PORTAL
// ============================================================

function initializeStudentPortal() {

    const savedStudent =
        getStudentSession();


    if (savedStudent) {

        console.log(
            "EXISTING STUDENT:",
            savedStudent
        );


        showStudentDashboard(
            savedStudent
        );

    } else {

        showStudentLogin();

    }

}


// ============================================================
// STUDENT LOGIN
// ============================================================

async function handleStudentLogin(
    event
) {

    event.preventDefault();


    const nameInput =
        document.getElementById(
            "studentName"
        );


    const rollInput =
        document.getElementById(
            "studentRollNo"
        );


    const emailInput =
        document.getElementById(
            "studentEmail"
        );


    const message =
        document.getElementById(
            "loginMessage"
        );


    if (
        !nameInput ||
        !rollInput ||
        !emailInput
    ) {

        console.error(
            "Student login inputs are missing."
        );

        return;

    }


    const name =
        nameInput.value.trim();


    const rollNo =
        rollInput.value.trim();


    const email =
        emailInput.value
            .trim()
            .toLowerCase();


    if (message) {

        message.textContent =
            "";

        message.className =
            "login-message";

    }


    // --------------------------------------------------------
    // NAME VALIDATION
    // --------------------------------------------------------

    if (!name) {

        showLoginError(
            "Please enter your name."
        );


        nameInput.focus();


        return;

    }


    // --------------------------------------------------------
    // ROLL NUMBER VALIDATION
    // --------------------------------------------------------

    if (!rollNo) {

        showLoginError(
            "Please enter your roll number."
        );


        rollInput.focus();


        return;

    }


    // --------------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------------

    if (!email) {

        showLoginError(
            "Please enter your email ID."
        );


        emailInput.focus();


        return;

    }


    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
        !emailPattern.test(email)
    ) {

        showLoginError(
            "Please enter a valid email ID."
        );


        emailInput.focus();


        return;

    }


    // --------------------------------------------------------
    // CREATE STUDENT SESSION
    // --------------------------------------------------------

    const student = {

        name: name,

        roll_no: rollNo,

        email: email,

        logged_in_at:
            new Date().toISOString()

    };


    try {

        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(student)
        );


        console.log(
            "STUDENT LOGIN:",
            student
        );


        window.location.href = "student-dashboard.html";

    } catch (error) {

        console.error(
            "Student session error:",
            error
        );


        showLoginError(
            "Unable to start student session."
        );

    }

}


// ============================================================
// SHOW STUDENT DASHBOARD
// ============================================================

function showStudentDashboard(
    student
) {

    const loginPage =
        document.getElementById(
            "studentLoginPage"
        );


    const dashboard =
        document.getElementById(
            "studentDashboard"
        );


    if (loginPage) {

        loginPage.style.display =
            "none";

    }


    if (dashboard) {

        dashboard.style.display =
            "block";

    }


    // --------------------------------------------------------
    // HEADER USER DETAILS
    // --------------------------------------------------------

    const headerName =
        document.getElementById(
            "headerStudentName"
        );


    const headerEmail =
        document.getElementById(
            "headerStudentEmail"
        );


    if (headerName) {

        headerName.textContent =
            student.name ||
            "Student";

    }


    if (headerEmail) {

        headerEmail.textContent =
            student.email ||
            "";

    }


    // --------------------------------------------------------
    // DASHBOARD USER DETAILS
    // --------------------------------------------------------

    const dashboardName =
        document.getElementById(
            "dashboardStudentName"
        );


    const dashboardRoll =
        document.getElementById(
            "dashboardRollNo"
        );


    if (dashboardName) {

        dashboardName.textContent =
            student.name ||
            "Student";

    }


    if (dashboardRoll) {

        dashboardRoll.textContent =
            student.roll_no ||
            "-";

    }

}


// ============================================================
// SHOW LOGIN PAGE
// ============================================================

function showStudentLogin() {

    const loginPage =
        document.getElementById(
            "studentLoginPage"
        );


    const dashboard =
        document.getElementById(
            "studentDashboard"
        );


    if (loginPage) {

        loginPage.style.display =
            "flex";

    }


    if (dashboard) {

        dashboard.style.display =
            "none";

    }

}


// ============================================================
// GET STUDENT SESSION
// ============================================================

function getStudentSession() {

    try {

        const raw =
            sessionStorage.getItem(
                SESSION_KEY
            );


        if (!raw) {

            return null;

        }


        return JSON.parse(
            raw
        );

    } catch (error) {

        console.error(
            "Session read error:",
            error
        );


        sessionStorage.removeItem(
            SESSION_KEY
        );


        return null;

    }

}


// ============================================================
// LOGOUT
// ============================================================

function studentLogout() {

    sessionStorage.removeItem(
        SESSION_KEY
    );


    window.location.href =
        "student.html";

}


// ============================================================
// OPEN DOCUMENTS
// ============================================================

function openDocuments() {

    const student =
        getStudentSession();


    if (!student) {

        alert(
            "Student session expired. Please login again."
        );


        window.location.href =
            "student.html";


        return;

    }


    window.location.href =
        "student-documents.html";

}


// ============================================================
// SEND QUESTION PAPER
// ============================================================

function openSendQP() {

    const student =
        getStudentSession();


    if (!student) {

        alert(
            "Student session expired. Please login again."
        );


        window.location.href =
            "student.html";


        return;

    }


    alert(
        "Send QP feature will use your registered email: " +
        student.email
    );

}


// ============================================================
// LOGIN ERROR
// ============================================================

function showLoginError(
    message
) {

    const element =
        document.getElementById(
            "loginMessage"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.className =
        "login-message error";

}