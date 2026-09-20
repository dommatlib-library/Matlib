/* ============================================================
   MATLIB
   FACULTY DASHBOARD
============================================================ */

(() => {

    "use strict";


    /* ========================================================
       SUPABASE
    ======================================================== */

    const sb =
        window.matlibSupabase;


    if (!sb) {

        console.error(
            "MatLib: Supabase client not found."
        );

        return;

    }


    /* ========================================================
       STATE
    ======================================================== */

    const state = {

        profile: null,

        borrowedBooks: [],

        bookRequests: [],

        returnRequests: [],


        /* Drive */

        driveRoots: [],

        driveFolders: [],

        driveFiles: [],

        selectedRootId: null,

        currentFolderId: null,

        documentSearch: "",

        documentType: "all",

        documentSort: "name-asc",

        documentView: "list",

        selectedUploadFile: null,

        driveLoading: false

    };


    /* ========================================================
       HELPERS
    ======================================================== */

    const $ =
        id =>
            document.getElementById(id);


    function escapeHTML(value) {

        return String(
            value ?? ""
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

    }


    function setText(
        id,
        value
    ) {

        const element =
            $(id);

        if (element) {

            element.textContent =
                value;

        }

    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    }


    function formatDateTime(
        value
    ) {

        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    function formatBytes(
        bytes
    ) {

        const value =
            Number(
                bytes || 0
            );

        if (!value) {
            return "—";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        let size =
            value;

        let index =
            0;

        while (
            size >= 1024 &&
            index <
                units.length - 1
        ) {

            size /=
                1024;

            index++;

        }

        return `${size.toFixed(
            index === 0
                ? 0
                : 1
        )} ${units[index]}`;

    }


    function showToast(
        message,
        type = "success"
    ) {

        const toast =
            $("facultyToast");

        if (!toast) {
            return;
        }

        const icon =
            toast.querySelector(
                ".faculty-toast-icon"
            );

        const text =
            toast.querySelector(
                ".faculty-toast-text"
            );

        if (text) {

            text.textContent =
                message;

        }

        if (icon) {

            icon.textContent =
                type === "error"
                    ? "!"
                    : type === "info"
                        ? "i"
                        : "✓";

        }

        toast.classList.add(
            "show"
        );

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                3200
            );

    }


/* ========================================================
   SESSION MANAGEMENT
======================================================== */

let sessionCheckTimer = null;
let isLoggingOut = false;

async function getSession() {
    const {
        data,
        error
    } = await sb.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;
}

function redirectToFacultyLogin(message = "") {
    if (message) {
        sessionStorage.setItem(
            "facultyAuthMessage",
            message
        );
    }

    window.location.replace("faculty.html");
}

async function validateFacultySession() {
    try {
        const session = await getSession();

        if (!session) {
            redirectToFacultyLogin(
                "Your session has expired. Please login again."
            );

            return false;
        }

        const expiresAt =
            Number(session.expires_at || 0);

        if (
            expiresAt &&
            expiresAt <= Math.floor(Date.now() / 1000)
        ) {
            await logout(
                "Your session has expired. Please login again."
            );

            return false;
        }

        return true;

    } catch (error) {
        console.error(
            "Session validation error:",
            error
        );

        redirectToFacultyLogin(
            "Unable to verify your session. Please login again."
        );

        return false;
    }
}

function startSessionManagement() {
    stopSessionManagement();

    sessionCheckTimer = setInterval(
        async () => {
            await validateFacultySession();
        },
        60 * 1000
    );
}

function stopSessionManagement() {
    if (sessionCheckTimer) {
        clearInterval(sessionCheckTimer);
        sessionCheckTimer = null;
    }
}

    /* ========================================================
       FACULTY PROFILE
    ======================================================== */

    async function loadFacultyProfile() {

        const session =
            await getSession();

        if (!session) {

            window.location.href =
                "faculty.html";

            return null;

        }


        const {
            data: profile,
            error
        } =
            await sb
                .from(
                    "faculty_profiles"
                )
                .select(
                    `
                    id,
                    name,
                    faculty_id,
                    designation,
                    phone,
                    email,
                    approval_status,
                    is_active
                    `
                )
                .eq(
                    "id",
                    session.user.id
                )
                .maybeSingle();


        if (error) {
            throw error;
        }


        if (!profile) {

            await sb.auth.signOut();

            window.location.href =
                "faculty.html";

            return null;

        }


        if (
            profile.approval_status !==
                "approved" ||
            profile.is_active !==
                true
        ) {

            await sb.auth.signOut();

            alert(
                "Your faculty account is not active."
            );

            window.location.href =
                "faculty.html";

            return null;

        }


        state.profile =
    profile;

updateFacultyUI();

startSessionManagement();

return profile;

    }


    function updateFacultyUI() {

        const profile =
            state.profile;

        if (!profile) {
            return;
        }


        setText(
            "facultyHeaderName",
            profile.name
        );


        setText(
            "facultyHeaderId",
            profile.faculty_id
        );


        setText(
            "facultyGreetingName",
            profile.name
        );


        const avatar =
            $("facultyAvatar");

        if (avatar) {

            avatar.textContent =
                String(
                    profile.name ||
                    "F"
                )
                .trim()
                .charAt(0)
                .toUpperCase();

        }

    }


    /* ========================================================
       NAVIGATION
    ======================================================== */

    function showSection(
        sectionId
    ) {

        document
            .querySelectorAll(
                ".faculty-section"
            )
            .forEach(
                section => {

                    section.classList.remove(
                        "active"
                    );

                }
            );


        const target =
            $(sectionId);

        if (!target) {

            console.warn(
                "Section not found:",
                sectionId
            );

            return;

        }


        target.classList.add(
            "active"
        );


        document
            .querySelectorAll(
                ".faculty-nav-item"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.section ===
                            sectionId
                    );

                }
            );


        const titles = {

            dashboardSection:
                "Faculty Dashboard",

            borrowPanel:
                "My Books",

            requestPanel:
                "Book Requests",

            returnPanel:
                "Return Requests",

            historyPanel:
                "Book History",

            rejectionPanel:
                "Rejected Requests",

            documentsSection:
                "Documents",

            catalogueSection:
                "Library Catalogue"

        };


        setText(
            "pageTitle",
            titles[sectionId] ||
                "Faculty Dashboard"
        );


        if (
            sectionId ===
            "borrowPanel"
        ) {

            loadFacultyBorrowed();

        }


        if (
            sectionId ===
            "requestPanel"
        ) {

            loadFacultyRequests();

        }


        if (
            sectionId ===
            "returnPanel"
        ) {

            loadFacultyReturns();

        }

        if (
            sectionId ===
            "historyPanel"
        ) {

            loadFacultyHistory();

        }

        if (
            sectionId ===
            "rejectionPanel"
        ) {

            loadFacultyRejections();

        }


        if (
            sectionId ===
            "documentsSection"
        ) {

            loadDriveDocuments();

        }


        /*
         * Close mobile sidebar.
         */

        $("facultySidebar")
            ?.classList.remove(
                "mobile-open"
            );


        window.scrollTo(
            {
                top: 0,
                behavior: "smooth"
            }
        );

    }


    window.showSection =
        showSection;


    /* ========================================================
       DASHBOARD STATS
    ======================================================== */

    async function loadDashboardStats() {

        if (!state.profile) {
            return;
        }


        try {

            const [
                borrowedResult,
                requestResult
            ] =
                await Promise.all([

                    sb
                        .from(
                            "borrow_records"
                        )
                        .select(
                            `
                            id,
                            due_date,
                            returned_at,
                            status
                            `
                        )
                        .eq(
                            "faculty_id",
                            state.profile.id
                        ),

                    sb
                        .from(
                            "book_requests"
                        )
                        .select(
                            "id,status"
                        )
                        .eq(
                            "faculty_id",
                            state.profile.id
                        )

                ]);


            if (
                borrowedResult.error
            ) {
                throw borrowedResult.error;
            }


            if (
                requestResult.error
            ) {
                throw requestResult.error;
            }


            const borrowed =
                borrowedResult.data ||
                [];


            const requests =
                requestResult.data ||
                [];


            const activeBooks =
                borrowed.filter(
                    row =>
                        !row.returned_at
                );


            const overdue =
                activeBooks.filter(
                    row =>
                        row.due_date &&
                        new Date(
                            row.due_date
                        ) <
                            new Date()
                );


            const pending =
                requests.filter(
                    row =>
                        String(
                            row.status
                        ).toLowerCase() ===
                        "pending"
                );


            setText(
                "facultyBorrowed",
                activeBooks.length
            );


            setText(
                "facultyRequests",
                requests.length
            );


            setText(
                "facultyPending",
                pending.length
            );


            setText(
                "facultyOverdue",
                overdue.length
            );


            setText(
                "sidebarRequestBadge",
                pending.length
            );

        } catch (error) {

            console.error(
                "Stats error:",
                error
            );

        }

    }


    /* ========================================================
       BORROWED BOOKS
    ======================================================== */

    async function loadFacultyBorrowed() {

        if (!state.profile) {
            return;
        }


        const tbody =
            $("facultyBorrowedBody");


        if (!tbody) {
            return;
        }


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-loading"
                >
                    Loading borrowed books...
                </td>
            </tr>
        `;


        try {

            const {
                data,
                error
            } =
                await sb
                    .from(
                        "borrow_records"
                    )
                    .select(
                        `
                        id,
                        book_id,
                        issued_at,
                        due_date,
                        returned_at,
                        status,
                        books (
                            id,
                            book_name,
                            author_name,
                            access_no,
                            cupboard_no
                        )
                        `
                    )
                    .eq(
                        "faculty_id",
                        state.profile.id
                    )
                    .order(
                        "issued_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {
                throw error;
            }


            state.borrowedBooks =
                data || [];


            const active =
                state.borrowedBooks.filter(
                    row =>
                        !row.returned_at
                );


            if (!active.length) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="8"
                            class="empty-table"
                        >
                            No books are currently borrowed.
                        </td>
                    </tr>
                `;

                return;

            }


            tbody.innerHTML =
                active.map(
                    row => {

                        const book =
                            Array.isArray(
                                row.books
                            )
                                ? row.books[0]
                                : row.books;


                        const overdue =
                            row.due_date &&
                            new Date(
                                row.due_date
                            ) <
                                new Date();


                        return `

                            <tr>

                                <td>

                                    <strong>
                                        ${escapeHTML(
                                            book?.book_name ||
                                            "Unknown Book"
                                        )}
                                    </strong>

                                    <small>
                                        Access No:
                                        ${escapeHTML(
                                            book?.access_no ||
                                            "-"
                                        )}
                                    </small>

                                </td>


                                <td>
                                    ${escapeHTML(
                                        book?.author_name ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHTML(
                                        book?.access_no ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHTML(
                                        book?.cupboard_no ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${formatDate(
                                        row.issued_at
                                    )}
                                </td>


                                <td class="${
                                    overdue
                                        ? "overdue"
                                        : ""
                                }">

                                    ${formatDate(
                                        row.due_date
                                    )}

                                </td>


                                <td>

                                    <span
                                        class="status-pill ${
                                            overdue
                                                ? "danger"
                                                : "success"
                                        }"
                                    >

                                        ${
                                            overdue
                                                ? "Overdue"
                                                : "Issued"
                                        }

                                    </span>

                                </td>


                                <td>

                                    <button
                                        type="button"
                                        class="faculty-table-btn"
                                        data-request-return="${
                                            row.id
                                        }"
                                    >
                                        ↩ Return
                                    </button>

                                </td>

                            </tr>

                        `;

                    }
                ).join("");

        } catch (error) {

            console.error(
                "Borrowed books error:",
                error
            );


            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="empty-table"
                    >
                        Unable to load borrowed books.
                    </td>
                </tr>
            `;

        }

    }


    /* ========================================================
       BOOK REQUESTS
    ======================================================== */

    async function loadFacultyRequests() {

        if (!state.profile) {
            return;
        }


        const tbody =
            $("facultyRequestsBody");


        if (!tbody) {
            return;
        }


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-loading"
                >
                    Loading requests...
                </td>
            </tr>
        `;


        try {

            const {
                data,
                error
            } =
                await sb
                    .from(
                        "book_requests"
                    )
                    .select(
                        `
                        id,
                        book_id,
                        faculty_id,
                        status,
                        requested_at,
                        processed_at,
                        due_date,
                        rejection_reason,
                        books (
                            id,
                            book_name,
                            author_name,
                            access_no
                        )
                        `
                    )
                    .eq(
                        "faculty_id",
                        state.profile.id
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .order(
                        "requested_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {
                throw error;
            }


            state.bookRequests =
                data || [];


            if (
                !state.bookRequests.length
            ) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="7"
                            class="empty-table"
                        >
                            No book requests found.
                        </td>
                    </tr>
                `;

                return;

            }


            tbody.innerHTML =
                state.bookRequests
                    .map(
                        request => {

                            const book =
                                Array.isArray(
                                    request.books
                                )
                                    ? request.books[0]
                                    : request.books;


                            const status =
                                String(
                                    request.status ||
                                    ""
                                ).toLowerCase();


                            return `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeHTML(
                                                book?.book_name ||
                                                "Unknown Book"
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHTML(
                                                book?.author_name ||
                                                "-"
                                            )}
                                        </small>

                                    </td>


                                    <td>
                                        ${escapeHTML(
                                            book?.access_no ||
                                            "-"
                                        )}
                                    </td>


                                    <td>
                                        ${formatDateTime(
                                            request.requested_at
                                        )}
                                    </td>


                                    <td>

                                        <span
                                            class="status-pill status-${status}"
                                        >
                                            ${escapeHTML(
                                                request.status ||
                                                "-"
                                            )}
                                        </span>

                                    </td>


                                    <td>
                                        ${
                                            request.due_date
                                                ? formatDate(
                                                    request.due_date
                                                )
                                                : "-"
                                        }
                                    </td>


                                    <td>
                                        ${
                                            request.rejection_reason
                                                ? escapeHTML(
                                                    request.rejection_reason
                                                )
                                                : "-"
                                        }
                                    </td>


                                    <td>

                                        ${
                                            status ===
                                            "pending"
                                                ? `
                                                    <button
                                                        type="button"
                                                        class="faculty-table-btn danger-btn"
                                                        data-cancel-request="${
                                                            request.id
                                                        }"
                                                    >
                                                        Cancel
                                                    </button>
                                                `
                                                : "-"
                                        }

                                    </td>

                                </tr>

                            `;

                        }
                    )
                    .join("");

        } catch (error) {

            console.error(
                "Request loading error:",
                error
            );


            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty-table"
                    >
                        Unable to load requests.
                    </td>
                </tr>
            `;

        }

    }


    /* ========================================================
       CANCEL REQUEST
    ======================================================== */

    async function cancelBookRequest(
        requestId
    ) {

        if (!requestId) {
            return;
        }


        if (
            !confirm(
                "Cancel this book request?"
            )
        ) {
            return;
        }


        try {

            const {
                error
            } =
                await sb.rpc(
                    "cancel_book_request",
                    {
                        p_request_id:
                            Number(
                                requestId
                            )
                    }
                );


            if (error) {
                throw error;
            }


            showToast(
                "Book request cancelled."
            );


            await Promise.all([
                loadFacultyRequests(),
                loadDashboardStats()
            ]);

        } catch (error) {

            console.error(
                error
            );


            showToast(
                error.message ||
                "Unable to cancel request.",
                "error"
            );

        }

    }


    /* ========================================================
       RETURN REQUESTS
    ======================================================== */

    async function loadFacultyReturns() {

        if (!state.profile) {
            return;
        }


        const tbody =
            $("facultyReturnBody");


        if (!tbody) {
            return;
        }


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="table-loading"
                >
                    Loading return requests...
                </td>
            </tr>
        `;


        try {

            const {
                data,
                error
            } =
                await sb
                    .from(
                        "return_requests"
                    )
                    .select(
                        `
                        id,
                        borrow_id,
                        faculty_id,
                        status,
                        requested_at,
                        rejection_reason,
                        borrow_records (
                            id,
                            issued_at,
                            due_date,
                            books (
                                id,
                                book_name,
                                author_name,
                                access_no
                            )
                        )
                        `
                    )
                    .eq(
                        "faculty_id",
                        state.profile.id
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .order(
                        "requested_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {
                throw error;
            }


            state.returnRequests =
                data || [];


            if (
                !state.returnRequests.length
            ) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="5"
                            class="empty-table"
                        >
                            No return requests found.
                        </td>
                    </tr>
                `;

                return;

            }


            tbody.innerHTML =
                state.returnRequests
                    .map(
                        request => {

                            const borrow =
                                Array.isArray(
                                    request.borrow_records
                                )
                                    ? request.borrow_records[0]
                                    : request.borrow_records;


                            const book =
                                Array.isArray(
                                    borrow?.books
                                )
                                    ? borrow.books[0]
                                    : borrow?.books;


                            const status =
                                String(
                                    request.status ||
                                    ""
                                ).toLowerCase();


                            return `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeHTML(
                                                book?.book_name ||
                                                "Unknown Book"
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHTML(
                                                book?.author_name ||
                                                "-"
                                            )}
                                        </small>

                                    </td>


                                    <td>
                                        ${escapeHTML(
                                            book?.access_no ||
                                            "-"
                                        )}
                                    </td>


                                    <td>
                                        ${formatDateTime(
                                            request.requested_at
                                        )}
                                    </td>


                                    <td>

                                        <span
                                            class="status-pill status-${status}"
                                        >
                                            ${escapeHTML(
                                                request.status ||
                                                "-"
                                            )}
                                        </span>

                                    </td>


                                    <td>

                                        ${
                                            request.rejection_reason
                                                ? escapeHTML(
                                                    request.rejection_reason
                                                )
                                                : "-"
                                        }

                                    </td>

                                </tr>

                            `;

                        }
                    )
                    .join("");

        } catch (error) {

            console.error(
                "Return request error:",
                error
            );


            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        class="empty-table"
                    >
                        Unable to load return requests.
                    </td>
                </tr>
            `;

        }

    }



    /* ========================================================
       BOOK HISTORY
       Successful completed borrow/return records only.
    ======================================================== */

    async function loadFacultyHistory() {

        const tbody = $("facultyHistoryBody");

        if (!tbody || !state.profile) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="table-loading">
                    Loading history...
                </td>
            </tr>
        `;

        try {
            const { data, error } = await sb
                .from("borrow_records")
                .select(`
                    id,
                    issued_at,
                    due_date,
                    returned_at,
                    status,
                    books (
                        id,
                        book_name,
                        author_name,
                        access_no,
                        cupboard_no
                    )
                `)
                .eq("faculty_id", state.profile.id)
                .not("returned_at", "is", null)
                .order("returned_at", { ascending: false });

            if (error) throw error;

            const rows = data || [];

            if (!rows.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-table">
                            No completed book history yet.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = rows.map(row => {
                const book = Array.isArray(row.books)
                    ? row.books[0]
                    : row.books;

                return `
                    <tr>
                        <td>
                            <strong>${escapeHTML(book?.book_name || "Unknown Book")}</strong>
                            <small>${escapeHTML(book?.author_name || "-")}</small>
                        </td>
                        <td>${escapeHTML(book?.access_no || "-")}</td>
                        <td>${escapeHTML(book?.cupboard_no || "-")}</td>
                        <td>${formatDate(row.issued_at)}</td>
                        <td>${formatDate(row.due_date)}</td>
                        <td>${formatDate(row.returned_at)}</td>
                        <td>
                            <span class="status-pill success">Returned</span>
                        </td>
                    </tr>
                `;
            }).join("");

        } catch (error) {
            console.error("History error:", error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table">
                        Unable to load book history.
                    </td>
                </tr>
            `;
        }
    }


    /* ========================================================
       REJECTED REQUEST HISTORY
       Includes rejected book requests and rejected return requests.
    ======================================================== */

    async function loadFacultyRejections() {

        const tbody = $("facultyRejectionBody");

        if (!tbody || !state.profile) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">
                    Loading rejected requests...
                </td>
            </tr>
        `;

        try {
            const [bookResult, returnResult] = await Promise.all([
                sb
                    .from("book_requests")
                    .select(`
                        id,
                        requested_at,
                        rejection_reason,
                        status,
                        books (
                            id,
                            book_name,
                            author_name,
                            access_no
                        )
                    `)
                    .eq("faculty_id", state.profile.id)
                    .eq("status", "rejected")
                    .order("requested_at", { ascending: false }),

                sb
                    .from("return_requests")
                    .select(`
                        id,
                        requested_at,
                        rejection_reason,
                        status,
                        borrow_records (
                            id,
                            books (
                                id,
                                book_name,
                                author_name,
                                access_no
                            )
                        )
                    `)
                    .eq("faculty_id", state.profile.id)
                    .eq("status", "rejected")
                    .order("requested_at", { ascending: false })
            ]);

            if (bookResult.error) throw bookResult.error;
            if (returnResult.error) throw returnResult.error;

            const bookRows = (bookResult.data || []).map(row => ({
                type: "Book Request",
                date: row.requested_at,
                reason: row.rejection_reason,
                book: Array.isArray(row.books) ? row.books[0] : row.books
            }));

            const returnRows = (returnResult.data || []).map(row => {
                const borrow = Array.isArray(row.borrow_records)
                    ? row.borrow_records[0]
                    : row.borrow_records;

                return {
                    type: "Return Request",
                    date: row.requested_at,
                    reason: row.rejection_reason,
                    book: Array.isArray(borrow?.books)
                        ? borrow.books[0]
                        : borrow?.books
                };
            });

            const rows = [...bookRows, ...returnRows]
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (!rows.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-table">
                            No rejected requests.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = rows.map(row => `
                <tr>
                    <td>
                        <span class="status-pill rejected-type">
                            ${escapeHTML(row.type)}
                        </span>
                    </td>
                    <td>
                        <strong>${escapeHTML(row.book?.book_name || "Unknown Book")}</strong>
                        <small>${escapeHTML(row.book?.author_name || "-")}</small>
                    </td>
                    <td>${escapeHTML(row.book?.access_no || "-")}</td>
                    <td>${formatDateTime(row.date)}</td>
                    <td>
                        <span class="status-pill danger">Rejected</span>
                    </td>
                    <td>${escapeHTML(row.reason || "No reason provided")}</td>
                </tr>
            `).join("");

        } catch (error) {
            console.error("Rejection history error:", error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table">
                        Unable to load rejected requests.
                    </td>
                </tr>
            `;
        }
    }


    /* ========================================================
       REQUEST RETURN
    ======================================================== */

    async function requestBookReturn(
        borrowId
    ) {

        if (!borrowId) {
            return;
        }


        if (
            !confirm(
                "Send this book for return approval?"
            )
        ) {
            return;
        }


        try {

            const {
                error
            } =
                await sb.rpc(
                    "request_book_return",
                    {
                        p_borrow_id:
                            Number(
                                borrowId
                            )
                    }
                );


            if (error) {
                throw error;
            }


            showToast(
                "Return request sent to Admin."
            );


            await Promise.all([
                loadFacultyBorrowed(),
                loadFacultyReturns(),
                loadDashboardStats()
            ]);


        } catch (error) {

            console.error(
                error
            );


            showToast(
                error.message ||
                "Unable to request return.",
                "error"
            );

        }

    }


    /* ========================================================
       REQUEST BOOK
    ======================================================== */

    async function requestBook(
        bookId
    ) {

        if (!bookId) {
            return;
        }


        try {

            const {
                error
            } =
                await sb.rpc(
                    "request_book",
                    {
                        p_book_id:
                            Number(
                                bookId
                            )
                    }
                );


            if (error) {
                throw error;
            }


            showToast(
                "Book request submitted."
            );


            await Promise.all([
                loadFacultyRequests(),
                loadDashboardStats()
            ]);

        } catch (error) {

            console.error(
                error
            );


            showToast(
                error.message ||
                "Unable to request book.",
                "error"
            );

        }

    }


    window.requestBook =
        requestBook;


    /* ========================================================
       DRIVE REQUEST
    ======================================================== */

    async function driveRequest(
        action,
        payload = {},
        file = null
    ) {

        const session =
            await getSession();


        if (!session) {

            throw new Error(
                "Your login session expired. Please login again."
            );

        }


        const form =
            new FormData();


        form.append(
            "action",
            action
        );


        Object.entries(
            payload
        ).forEach(
            ([key, value]) => {

                if (
                    value !== undefined &&
                    value !== null
                ) {

                    form.append(
                        key,
                        String(value)
                    );

                }

            }
        );


        if (file) {

            form.append(
                "file",
                file
            );

        }


        const response =
            await fetch(
                `${window.MATLIB_SUPABASE_URL}/functions/v1/drive-manager`,
                {
                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${session.access_token}`,

                        "apikey":
                            window.MATLIB_SUPABASE_ANON_KEY

                    },

                    body:
                        form
                }
            );


        const result =
            await response
                .json()
                .catch(
                    () => ({
                        success:
                            false,

                        error:
                            "Invalid Drive server response."
                    })
                );


        if (
            !response.ok ||
            result.success ===
                false
        ) {

            throw new Error(
                result.error ||
                "Google Drive request failed."
            );

        }


        return result;

    }


    /* ========================================================
       DRIVE LOAD
    ======================================================== */

    async function loadDriveDocuments() {

        if (
            state.driveLoading
        ) {
            return;
        }


        state.driveLoading =
            true;


        setText(
            "documentsDriveStatusText",
            "Loading..."
        );


        try {

            const result =
                await driveRequest(
                    "list"
                );


            state.driveRoots =
                Array.isArray(
                    result.roots
                )
                    ? result.roots
                    : [];


            state.driveFolders =
                Array.isArray(
                    result.folders
                )
                    ? result.folders
                    : [];


            state.driveFiles =
                Array.isArray(
                    result.files
                )
                    ? result.files
                    : [];


            if (
                state.selectedRootId &&
                !state.driveRoots.some(
                    root =>
                        Number(
                            root.id
                        ) ===
                        Number(
                            state.selectedRootId
                        )
                )
            ) {

                state.selectedRootId =
                    null;

                state.currentFolderId =
                    null;

            }


            setText(
                "documentsDriveStatusText",
                "Connected"
            );


            renderDriveRoots();

            renderDriveBreadcrumb();

            renderDriveWorkspace();


        } catch (error) {

            console.error(
                "Drive error:",
                error
            );


            setText(
                "documentsDriveStatusText",
                "Connection problem"
            );


            showToast(
                error.message ||
                "Unable to connect to Google Drive.",
                "error"
            );


        } finally {

            state.driveLoading =
                false;

        }

    }


    /* ========================================================
       DRIVE ROOTS
    ======================================================== */

    function renderDriveRoots() {

        const container =
            $("documentRootList");


        if (!container) {
            return;
        }


        if (
            !state.driveRoots.length
        ) {

            container.innerHTML = `
                <div class="root-empty">
                    No root folders available.
                </div>
            `;

            return;

        }


        container.innerHTML =
            state.driveRoots
                .map(
                    root => {

                        const selected =
                            Number(
                                root.id
                            ) ===
                            Number(
                                state.selectedRootId
                            );


                        const folderCount =
                            state.driveFolders
                                .filter(
                                    folder =>
                                        Number(
                                            folder.root_folder_id
                                        ) ===
                                        Number(
                                            root.id
                                        )
                                )
                                .length;


                        const fileCount =
                            state.driveFiles
                                .filter(
                                    file =>
                                        Number(
                                            file.root_folder_id
                                        ) ===
                                        Number(
                                            root.id
                                        )
                                )
                                .length;


                        return `

                            <button
                                type="button"
                                class="root-folder-chip ${
                                    selected
                                        ? "selected"
                                        : ""
                                }"
                                data-drive-root="${
                                    root.id
                                }"
                            >

                                <span class="folder-icon">
                                    📁
                                </span>

                                <span>

                                    <strong>
                                        ${escapeHTML(
                                            root.name
                                        )}
                                    </strong>

                                    <small>
                                        ${folderCount}
                                        folders ·
                                        ${fileCount}
                                        files
                                    </small>

                                </span>

                            </button>

                        `;

                    }
                )
                .join("");

    }


    function selectDriveRoot(
        rootId
    ) {

        state.selectedRootId =
            Number(
                rootId
            );

        state.currentFolderId =
            null;


        renderDriveRoots();

        renderDriveBreadcrumb();

        renderDriveWorkspace();

    }


    function getCurrentRoot() {

        return state.driveRoots.find(
            root =>
                Number(
                    root.id
                ) ===
                Number(
                    state.selectedRootId
                )
        ) || null;

    }


    function getCurrentFolder() {

        if (
            !state.currentFolderId
        ) {
            return null;
        }


        return state.driveFolders.find(
            folder =>
                Number(
                    folder.id
                ) ===
                Number(
                    state.currentFolderId
                )
        ) || null;

    }


    /* ========================================================
       DRIVE FOLDERS
    ======================================================== */

    function getChildFolders() {

        const root =
            getCurrentRoot();


        if (!root) {
            return [];
        }


        if (
            state.currentFolderId
        ) {

            const current =
                getCurrentFolder();


            if (!current) {
                return [];
            }


            return state.driveFolders.filter(
                folder =>
                    Number(
                        folder.root_folder_id
                    ) ===
                    Number(
                        root.id
                    ) &&
                    folder.parent_drive_folder_id ===
                    current.drive_folder_id
            );

        }


        return state.driveFolders.filter(
            folder =>
                Number(
                    folder.root_folder_id
                ) ===
                Number(
                    root.id
                ) &&
                folder.parent_drive_folder_id ===
                root.drive_folder_id
        );

    }


    function openDriveFolder(
        folderId
    ) {

        state.currentFolderId =
            Number(
                folderId
            );


        renderDriveBreadcrumb();

        renderDriveWorkspace();

    }


    /* ========================================================
       DRIVE FILES
    ======================================================== */

    function getCurrentFiles() {

        const root =
            getCurrentRoot();


        if (!root) {
            return [];
        }


        let files =
            state.driveFiles.filter(
                file =>
                    Number(
                        file.root_folder_id
                    ) ===
                    Number(
                        root.id
                    )
            );


        if (
            state.currentFolderId
        ) {

            const folder =
                getCurrentFolder();


            if (!folder) {
                return [];
            }


            files =
                files.filter(
                    file =>
                        file.folder_drive_id ===
                        folder.drive_folder_id
                );

        } else {

            files =
                files.filter(
                    file =>
                        file.folder_drive_id ===
                        root.drive_folder_id
                );

        }


        return files;

    }


    function getFileExtension(
        name
    ) {

        const parts =
            String(
                name || ""
            )
            .toLowerCase()
            .split(".");


        return parts.length > 1
            ? parts.pop()
            : "";

    }


    function getFileType(
        file
    ) {

        const mime =
            String(
                file?.mime_type ||
                ""
            ).toLowerCase();


        const ext =
            getFileExtension(
                file?.name
            );


        if (
            mime.includes("pdf") ||
            ext === "pdf"
        ) {
            return "pdf";
        }


        if (
            mime.includes("word") ||
            [
                "doc",
                "docx"
            ].includes(ext)
        ) {
            return "word";
        }


        if (
            mime.includes("sheet") ||
            mime.includes("excel") ||
            [
                "xls",
                "xlsx",
                "csv"
            ].includes(ext)
        ) {
            return "excel";
        }


        if (
            mime.includes("presentation") ||
            mime.includes("powerpoint") ||
            [
                "ppt",
                "pptx"
            ].includes(ext)
        ) {
            return "powerpoint";
        }


        if (
            mime.startsWith(
                "image/"
            ) ||
            [
                "jpg",
                "jpeg",
                "png",
                "gif",
                "webp",
                "svg"
            ].includes(ext)
        ) {
            return "image";
        }


        return "other";

    }


    function getFileIcon(
        file
    ) {

        const type =
            getFileType(
                file
            );


        const icons = {

            pdf: "📕",

            word: "📘",

            excel: "📗",

            powerpoint: "📙",

            image: "🖼",

            other: "📄"

        };


        return icons[type] ||
            "📄";

    }


    /* ========================================================
       FILTER + SORT
    ======================================================== */

    function getFilteredDriveFiles() {

        let files =
            getCurrentFiles();


        const search =
            state.documentSearch
                .trim()
                .toLowerCase();


        if (search) {

            files =
                files.filter(
                    file =>
                        String(
                            file.name ||
                            ""
                        )
                        .toLowerCase()
                        .includes(
                            search
                        )
                );

        }


        if (
            state.documentType !==
            "all"
        ) {

            files =
                files.filter(
                    file =>
                        getFileType(
                            file
                        ) ===
                        state.documentType
                );

        }


        files.sort(
            (a, b) => {

                switch (
                    state.documentSort
                ) {

                    case "name-desc":

                        return String(
                            b.name || ""
                        ).localeCompare(
                            String(
                                a.name || ""
                            )
                        );


                    case "date-desc":

                        return new Date(
                            b.created_at
                        ) -
                        new Date(
                            a.created_at
                        );


                    case "date-asc":

                        return new Date(
                            a.created_at
                        ) -
                        new Date(
                            b.created_at
                        );


                    case "size-desc":

                        return Number(
                            b.file_size ||
                            0
                        ) -
                        Number(
                            a.file_size ||
                            0
                        );


                    case "size-asc":

                        return Number(
                            a.file_size ||
                            0
                        ) -
                        Number(
                            b.file_size ||
                            0
                        );


                    default:

                        return String(
                            a.name || ""
                        ).localeCompare(
                            String(
                                b.name || ""
                            )
                        );

                }

            }
        );


        return files;

    }


    /* ========================================================
       DRIVE WORKSPACE
    ======================================================== */

    function renderDriveWorkspace() {

        const workspace =
            $("documentWorkspace");


        const empty =
            $("documentEmptyState");


        const count =
            $("documentItemCount");


        if (!workspace) {
            return;
        }


        if (
            !state.selectedRootId
        ) {

            workspace.innerHTML = "";


            if (empty) {

                empty.classList.remove(
                    "hidden"
                );

                const title =
                    empty.querySelector(
                        "h3"
                    );

                const text =
                    empty.querySelector(
                        "p"
                    );


                if (title) {

                    title.textContent =
                        "Select a library folder";

                }


                if (text) {

                    text.textContent =
                        "Choose a root folder above to browse documents.";

                }

            }


            setText(
                "documentItemCount",
                "Select a folder"
            );


            return;

        }


        const folders =
            getChildFolders();


        const files =
            getFilteredDriveFiles();


        const total =
            folders.length +
            files.length;


        if (count) {

            count.textContent =
                `${total} ${
                    total === 1
                        ? "item"
                        : "items"
                }`;

        }


        if (
            total === 0
        ) {

            workspace.innerHTML = "";


            if (empty) {

                empty.classList.remove(
                    "hidden"
                );


                const title =
                    empty.querySelector(
                        "h3"
                    );


                const text =
                    empty.querySelector(
                        "p"
                    );


                if (
                    state.documentSearch ||
                    state.documentType !==
                        "all"
                ) {

                    if (title) {

                        title.textContent =
                            "No matching documents";

                    }


                    if (text) {

                        text.textContent =
                            "Try changing your search or file filter.";

                    }

                } else {

                    if (title) {

                        title.textContent =
                            "This folder is empty";

                    }


                    if (text) {

                        text.textContent =
                            "Upload a document or create a new folder.";

                    }

                }

            }


            return;

        }


        if (empty) {

            empty.classList.add(
                "hidden"
            );

        }


        if (
            state.documentView ===
            "grid"
        ) {

            renderDriveGrid(
                workspace,
                folders,
                files
            );

        } else {

            renderDriveList(
                workspace,
                folders,
                files
            );

        }

    }


    /* ========================================================
       LIST VIEW
    ======================================================== */

    function renderDriveList(
        workspace,
        folders,
        files
    ) {

        workspace.innerHTML = `

            <div class="document-list-head">

                <span>Name</span>

                <span>Type</span>

                <span>Size</span>

                <span>Modified</span>

                <span>Action</span>

            </div>


            ${
                folders.map(
                    folder => `

                        <div class="document-row">

                            <div
                                class="document-name"
                                data-open-folder="${
                                    folder.id
                                }"
                                style="cursor:pointer"
                            >

                                <div class="document-file-icon">
                                    📁
                                </div>

                                <div class="document-name-text">

                                    <strong>
                                        ${escapeHTML(
                                            folder.name
                                        )}
                                    </strong>

                                    <span>
                                        Folder
                                    </span>

                                </div>

                            </div>


                            <div class="document-cell">
                                Folder
                            </div>


                            <div class="document-cell">
                                —
                            </div>


                            <div class="document-cell">
                                ${formatDate(
                                    folder.created_at
                                )}
                            </div>


                            <div class="document-row-actions">

                                <button
                                    class="document-small-btn"
                                    data-open-folder="${
                                        folder.id
                                    }"
                                >
                                    →
                                </button>

                            </div>

                        </div>

                    `
                ).join("")
            }


            ${
                files.map(
                    file => `

                        <div class="document-row">

                            <div class="document-name">

                                <div
                                    class="document-file-icon"
                                    data-open-file="${
                                        file.id
                                    }"
                                >
                                    ${getFileIcon(
                                        file
                                    )}
                                </div>


                                <div
                                    class="document-name-text"
                                    data-open-file="${
                                        file.id
                                    }"
                                >

                                    <strong
                                        title="${escapeHTML(
                                            file.name
                                        )}"
                                    >
                                        ${escapeHTML(
                                            file.name
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHTML(
                                            file.mime_type ||
                                            getFileType(
                                                file
                                            )
                                        )}
                                    </span>

                                </div>

                            </div>


                            <div class="document-cell">

                                ${getFileType(
                                    file
                                ).toUpperCase()}

                            </div>


                            <div class="document-cell">

                                ${formatBytes(
                                    file.file_size
                                )}

                            </div>


                            <div class="document-cell">

                                ${formatDate(
                                    file.created_at
                                )}

                            </div>


                            <div class="document-row-actions">

                                <button
                                    class="document-small-btn"
                                    data-open-file="${
                                        file.id
                                    }"
                                    title="Open"
                                >
                                    ↗
                                </button>


                                <button
                                    class="document-small-btn delete"
                                    data-delete-file="${
                                        file.id
                                    }"
                                    title="Delete"
                                >
                                    ×
                                </button>

                            </div>

                        </div>

                    `
                ).join("")
            }

        `;

    }


    /* ========================================================
       GRID VIEW
    ======================================================== */

    function renderDriveGrid(
        workspace,
        folders,
        files
    ) {

        workspace.innerHTML = `

            <div class="document-grid">

                ${
                    folders.map(
                        folder => `

                            <div
                                class="folder-card"
                                data-open-folder="${
                                    folder.id
                                }"
                            >

                                <div class="folder-card-icon">
                                    📁
                                </div>

                                <strong>
                                    ${escapeHTML(
                                        folder.name
                                    )}
                                </strong>

                                <small>
                                    ${formatDate(
                                        folder.created_at
                                    )}
                                </small>

                            </div>

                        `
                    ).join("")
                }


                ${
                    files.map(
                        file => `

                            <div
                                class="document-card"
                            >

                                <div class="card-actions">

                                    <button
                                        class="document-small-btn"
                                        data-open-file="${
                                            file.id
                                        }"
                                    >
                                        ↗
                                    </button>

                                    <button
                                        class="document-small-btn delete"
                                        data-delete-file="${
                                            file.id
                                        }"
                                    >
                                        ×
                                    </button>

                                </div>


                                <div
                                    class="card-file-icon"
                                    data-open-file="${
                                        file.id
                                    }"
                                >
                                    ${getFileIcon(
                                        file
                                    )}
                                </div>


                                <h3
                                    data-open-file="${
                                        file.id
                                    }"
                                    title="${escapeHTML(
                                        file.name
                                    )}"
                                >
                                    ${escapeHTML(
                                        file.name
                                    )}
                                </h3>


                                <div class="document-card-info">

                                    <span>
                                        ${getFileType(
                                            file
                                        ).toUpperCase()}
                                    </span>

                                    <span>
                                        ${formatBytes(
                                            file.file_size
                                        )}
                                    </span>

                                </div>

                            </div>

                        `
                    ).join("")
                }

            </div>

        `;

    }


    /* ========================================================
       BREADCRUMB
    ======================================================== */

    function renderDriveBreadcrumb() {

        const container =
            $("documentBreadcrumb");


        if (!container) {
            return;
        }


        if (
            !state.selectedRootId
        ) {

            container.innerHTML = `

                <button
                    type="button"
                    class="breadcrumb-item active"
                    data-breadcrumb-home
                >
                    ☁ Documents
                </button>

            `;

            return;

        }


        const root =
            getCurrentRoot();


        if (!root) {
            return;
        }


        let html = `

            <button
                type="button"
                class="breadcrumb-item"
                data-breadcrumb-home
            >
                ☁ Documents
            </button>

            <span class="breadcrumb-separator">
                /
            </span>

            <button
                type="button"
                class="breadcrumb-item ${
                    state.currentFolderId
                        ? ""
                        : "active"
                }"
                data-breadcrumb-root
            >
                📁 ${escapeHTML(
                    root.name
                )}
            </button>

        `;


        if (
            state.currentFolderId
        ) {

            const chain =
                getFolderChain(
                    state.currentFolderId
                );


            chain.forEach(
                (
                    folder,
                    index
                ) => {

                    html += `

                        <span class="breadcrumb-separator">
                            /
                        </span>

                        <button
                            type="button"
                            class="breadcrumb-item ${
                                index ===
                                chain.length - 1
                                    ? "active"
                                    : ""
                            }"
                            data-breadcrumb-folder="${
                                folder.id
                            }"
                        >
                            ${escapeHTML(
                                folder.name
                            )}
                        </button>

                    `;

                }
            );

        }


        container.innerHTML =
            html;

    }


    function getFolderChain(
        folderId
    ) {

        const chain = [];

        let folder =
            state.driveFolders.find(
                item =>
                    Number(
                        item.id
                    ) ===
                    Number(
                        folderId
                    )
            );


        while (folder) {

            chain.unshift(
                folder
            );


            const parent =
                state.driveFolders.find(
                    item =>
                        Number(
                            item.root_folder_id
                        ) ===
                        Number(
                            state.selectedRootId
                        ) &&
                        item.drive_folder_id ===
                            folder.parent_drive_folder_id
                );


            folder =
                parent ||
                null;

        }


        return chain;

    }


    /* ========================================================
       OPEN FILE
    ======================================================== */

    function openDriveFile(
        fileId
    ) {

        const file =
            state.driveFiles.find(
                item =>
                    Number(
                        item.id
                    ) ===
                    Number(
                        fileId
                    )
            );


        if (!file) {
            return;
        }


        const url =
            file.drive_url ||
            `https://drive.google.com/file/d/${file.drive_file_id}/view`;


        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );

    }


    /* ========================================================
       DELETE FILE
    ======================================================== */

    async function deleteDriveFile(
        fileId
    ) {

        const file =
            state.driveFiles.find(
                item =>
                    Number(
                        item.id
                    ) ===
                    Number(
                        fileId
                    )
            );


        if (!file) {
            return;
        }


        if (
            !confirm(
                `Delete "${file.name}"?\n\nThis will remove the document from Google Drive.`
            )
        ) {
            return;
        }


        try {

            showToast(
                "Deleting document...",
                "info"
            );


            await driveRequest(
                "delete_file",
                {
                    file_id:
                        file.id
                }
            );


            state.driveFiles =
                state.driveFiles.filter(
                    item =>
                        Number(
                            item.id
                        ) !==
                        Number(
                            file.id
                        )
                );


            renderDriveRoots();

            renderDriveWorkspace();


            showToast(
                "Document deleted."
            );


        } catch (error) {

            console.error(
                error
            );


            showToast(
                error.message ||
                "Unable to delete document.",
                "error"
            );

        }

    }


    /* ========================================================
       NEW FOLDER
    ======================================================== */

    function openNewFolderModal() {

        if (
            !state.selectedRootId
        ) {

            showToast(
                "Select a root folder first.",
                "info"
            );

            return;

        }


        $("newFolderName").value =
            "";


        $("newFolderMessage").textContent =
            "";


        $("newFolderModal")
            .classList.remove(
                "hidden"
            );


        setTimeout(
            () =>
                $("newFolderName")
                    ?.focus(),
            100
        );

    }


    function closeNewFolderModal() {

        $("newFolderModal")
            ?.classList.add(
                "hidden"
            );

    }


    async function createDriveFolder() {

        const input =
            $("newFolderName");


        const button =
            $("confirmNewFolder");


        const message =
            $("newFolderMessage");


        const name =
            input?.value.trim();


        if (!name) {

            message.textContent =
                "Enter a folder name.";

            return;

        }


        button.disabled =
            true;


        try {

            const result =
                await driveRequest(
                    "create_folder",
                    {

                        root_id:
                            state.selectedRootId,

                        parent_folder_id:
                            state.currentFolderId ||
                            "",

                        name

                    }
                );


            if (
                result.folder
            ) {

                state.driveFolders.push(
                    result.folder
                );

            }


            closeNewFolderModal();


            renderDriveRoots();

            renderDriveWorkspace();


            showToast(
                "Folder created successfully."
            );


        } catch (error) {

            console.error(
                error
            );


            message.textContent =
                error.message ||
                "Unable to create folder.";


        } finally {

            button.disabled =
                false;

        }

    }


    /* ========================================================
       UPLOAD MODAL
    ======================================================== */

    function openUploadModal() {

        if (
            !state.selectedRootId
        ) {

            showToast(
                "Select a root folder first.",
                "info"
            );

            return;

        }


        const root =
            getCurrentRoot();


        const folder =
            getCurrentFolder();


        setText(
            "uploadTargetName",
            folder?.name ||
            root?.name ||
            "Documents"
        );


        clearSelectedUploadFile();


        $("documentUploadPanel")
            .classList.remove(
                "hidden"
            );

    }


    function closeUploadModal() {

        $("documentUploadPanel")
            ?.classList.add(
                "hidden"
            );


        clearSelectedUploadFile();

    }


    function clearSelectedUploadFile() {

        state.selectedUploadFile =
            null;


        const info =
            $("selectedFileInfo");


        const button =
            $("confirmDocumentUpload");


        const progress =
            $("uploadProgress");


        const bar =
            $("uploadProgressBar");


        const text =
            $("uploadProgressText");


        info?.classList.add(
            "hidden"
        );


        if (info) {
            info.innerHTML =
                "";
        }


        if (button) {
            button.disabled =
                true;
        }


        progress?.classList.add(
            "hidden"
        );


        if (bar) {
            bar.style.width =
                "0%";
        }


        if (text) {
            text.textContent =
                "0%";
        }

    }


    function selectUploadFile(
        file
    ) {

        if (!file) {
            return;
        }


        if (
            file.size >
            25 *
            1024 *
            1024
        ) {

            showToast(
                "Maximum file size is 25 MB.",
                "error"
            );

            return;

        }


        state.selectedUploadFile =
            file;


        const info =
            $("selectedFileInfo");


        const button =
            $("confirmDocumentUpload");


        info.classList.remove(
            "hidden"
        );


        info.innerHTML = `

            <span class="selected-file-icon">
                ${getFileIcon({
                    name:
                        file.name,

                    mime_type:
                        file.type
                })}
            </span>

            <div>

                <strong>
                    ${escapeHTML(
                        file.name
                    )}
                </strong>

                <span>
                    ${formatBytes(
                        file.size
                    )}
                </span>

            </div>

        `;


        button.disabled =
            false;

    }


    /* ========================================================
       UPLOAD
    ======================================================== */

    async function uploadDocumentFile() {

        const file =
            state.selectedUploadFile;


        if (!file) {
            return;
        }


        const button =
            $("confirmDocumentUpload");


        const progress =
            $("uploadProgress");


        const bar =
            $("uploadProgressBar");


        const text =
            $("uploadProgressText");


        button.disabled =
            true;


        progress.classList.remove(
            "hidden"
        );


        try {

            bar.style.width =
                "20%";

            text.textContent =
                "20%";


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        150
                    )
            );


            bar.style.width =
                "40%";

            text.textContent =
                "40%";


            const result =
                await driveRequest(
                    "upload_file",
                    {

                        root_id:
                            state.selectedRootId,

                        folder_id:
                            state.currentFolderId ||
                            ""

                    },
                    file
                );


            bar.style.width =
                "85%";

            text.textContent =
                "85%";


            if (
                result.file
            ) {

                state.driveFiles.unshift(
                    result.file
                );

            }


            bar.style.width =
                "100%";

            text.textContent =
                "100%";


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        350
                    )
            );


            closeUploadModal();


            renderDriveRoots();

            renderDriveWorkspace();


            showToast(
                "Document uploaded successfully."
            );


        } catch (error) {

            console.error(
                error
            );


            button.disabled =
                false;


            showToast(
                error.message ||
                "Upload failed.",
                "error"
            );

        }

    }


    /* ========================================================
       DOCUMENT SEARCH
    ======================================================== */

    function initDocumentControls() {

        const search =
            $("documentSearch");


        const clear =
            $("clearDocumentSearch");


        search?.addEventListener(
            "input",
            () => {

                state.documentSearch =
                    search.value;


                if (clear) {

                    clear.style.display =
                        search.value
                            ? "block"
                            : "none";

                }


                renderDriveWorkspace();

            }
        );


        clear?.addEventListener(
            "click",
            () => {

                search.value =
                    "";

                state.documentSearch =
                    "";


                clear.style.display =
                    "none";


                renderDriveWorkspace();


                search.focus();

            }
        );


        $("documentTypeFilter")
            ?.addEventListener(
                "change",
                event => {

                    state.documentType =
                        event.target.value;

                    renderDriveWorkspace();

                }
            );


        $("documentSort")
            ?.addEventListener(
                "change",
                event => {

                    state.documentSort =
                        event.target.value;

                    renderDriveWorkspace();

                }
            );


        $("documentsListViewBtn")
            ?.addEventListener(
                "click",
                () => {

                    state.documentView =
                        "list";


                    $("documentsListViewBtn")
                        .classList.add(
                            "active"
                        );


                    $("documentsGridViewBtn")
                        .classList.remove(
                            "active"
                        );


                    renderDriveWorkspace();

                }
            );


        $("documentsGridViewBtn")
            ?.addEventListener(
                "click",
                () => {

                    state.documentView =
                        "grid";


                    $("documentsGridViewBtn")
                        .classList.add(
                            "active"
                        );


                    $("documentsListViewBtn")
                        .classList.remove(
                            "active"
                        );


                    renderDriveWorkspace();

                }
            );

    }


    /* ========================================================
       DOCUMENT FILE INPUT
    ======================================================== */

    function initFileUpload() {

        const input =
            $("documentModalFile");


        const zone =
            $("documentDropZone");


        input?.addEventListener(
            "change",
            () => {

                const file =
                    input.files?.[0];


                if (file) {

                    selectUploadFile(
                        file
                    );

                }

            }
        );


        zone?.addEventListener(
            "dragover",
            event => {

                event.preventDefault();

                zone.classList.add(
                    "dragging"
                );

            }
        );


        zone?.addEventListener(
            "dragleave",
            () => {

                zone.classList.remove(
                    "dragging"
                );

            }
        );


        zone?.addEventListener(
            "drop",
            event => {

                event.preventDefault();


                zone.classList.remove(
                    "dragging"
                );


                const file =
                    event.dataTransfer
                        ?.files?.[0];


                if (file) {

                    selectUploadFile(
                        file
                    );

                }

            }
        );

    }


    /* ========================================================
       EVENTS
    ======================================================== */

    function initEvents() {


        /* SIDEBAR */

        document
            .querySelectorAll(
                ".faculty-nav-item"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            showSection(
                                button.dataset.section
                            );

                        }
                    );

                }
            );


        /* QUICK ACTIONS */

        document
            .querySelectorAll(
                "[data-section-action]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            showSection(
                                button.dataset.sectionAction
                            );

                        }
                    );

                }
            );


        /* MOBILE MENU */

        $("mobileMenuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("facultySidebar")
                        ?.classList.toggle(
                            "mobile-open"
                        );

                }
            );


        /* LOGOUT */
        $("facultyLogoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        /* REFRESH */

        $("refreshBorrowedBtn")
            ?.addEventListener(
                "click",
                loadFacultyBorrowed
            );


        $("refreshRequestsBtn")
            ?.addEventListener(
                "click",
                loadFacultyRequests
            );


        $("refreshReturnsBtn")
            ?.addEventListener(
                "click",
                loadFacultyReturns
            );

        $("refreshHistoryBtn")
            ?.addEventListener(
                "click",
                loadFacultyHistory
            );

        $("refreshRejectionsBtn")
            ?.addEventListener(
                "click",
                loadFacultyRejections
            );


        /* RETURN / CANCEL */

        document.addEventListener(
            "click",
            event => {


                const returnButton =
                    event.target.closest(
                        "[data-request-return]"
                    );


                if (
                    returnButton
                ) {

                    requestBookReturn(
                        returnButton.dataset
                            .requestReturn
                    );

                    return;

                }


                const cancelButton =
                    event.target.closest(
                        "[data-cancel-request]"
                    );


                if (
                    cancelButton
                ) {

                    cancelBookRequest(
                        cancelButton.dataset
                            .cancelRequest
                    );

                    return;

                }


                const rootButton =
                    event.target.closest(
                        "[data-drive-root]"
                    );


                if (
                    rootButton
                ) {

                    selectDriveRoot(
                        rootButton.dataset
                            .driveRoot
                    );

                    return;

                }


                const folderButton =
                    event.target.closest(
                        "[data-open-folder]"
                    );


                if (
                    folderButton
                ) {

                    openDriveFolder(
                        folderButton.dataset
                            .openFolder
                    );

                    return;

                }


                const fileButton =
                    event.target.closest(
                        "[data-open-file]"
                    );


                if (
                    fileButton
                ) {

                    openDriveFile(
                        fileButton.dataset
                            .openFile
                    );

                    return;

                }


                const deleteButton =
                    event.target.closest(
                        "[data-delete-file]"
                    );


                if (
                    deleteButton
                ) {

                    deleteDriveFile(
                        deleteButton.dataset
                            .deleteFile
                    );

                    return;

                }


                const homeButton =
                    event.target.closest(
                        "[data-breadcrumb-home]"
                    );


                if (
                    homeButton
                ) {

                    state.selectedRootId =
                        null;

                    state.currentFolderId =
                        null;

                    renderDriveRoots();

                    renderDriveBreadcrumb();

                    renderDriveWorkspace();

                    return;

                }


                const rootBreadcrumb =
                    event.target.closest(
                        "[data-breadcrumb-root]"
                    );


                if (
                    rootBreadcrumb
                ) {

                    state.currentFolderId =
                        null;

                    renderDriveBreadcrumb();

                    renderDriveWorkspace();

                    return;

                }


                const folderBreadcrumb =
                    event.target.closest(
                        "[data-breadcrumb-folder]"
                    );


                if (
                    folderBreadcrumb
                ) {

                    openDriveFolder(
                        folderBreadcrumb.dataset
                            .breadcrumbFolder
                    );

                }

            }
        );


        /* DOCUMENTS */

        $("documentsRefreshBtn")
            ?.addEventListener(
                "click",
                loadDriveDocuments
            );


        $("newDocumentFolderBtn")
            ?.addEventListener(
                "click",
                openNewFolderModal
            );


        $("confirmNewFolder")
            ?.addEventListener(
                "click",
                createDriveFolder
            );


        $("uploadDocumentBtn")
            ?.addEventListener(
                "click",
                openUploadModal
            );


        $("emptyUploadBtn")
            ?.addEventListener(
                "click",
                openUploadModal
            );


        $("confirmDocumentUpload")
            ?.addEventListener(
                "click",
                uploadDocumentFile
            );


        /* MODAL CLOSE */

        document
            .querySelectorAll(
                "[data-close-folder-modal]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        closeNewFolderModal
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-close-document-modal]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        closeUploadModal
                    );

                }
            );


        /* ESCAPE */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                closeNewFolderModal();

                closeUploadModal();

            }
        );

    }

/* ========================================================
   FACULTY LOGOUT
======================================================== */

let isFacultyLoggingOut = false;

async function logout(event) {

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (isFacultyLoggingOut) {
        return;
    }

    isFacultyLoggingOut = true;

    const logoutButton =
        document.getElementById(
            "facultyLogoutBtn"
        );

    if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.innerHTML = `
            <span aria-hidden="true">⏳</span>
            <span>Logging out...</span>
        `;
    }

    try {

        /*
         * Stop any dashboard session activity.
         * This is safe even if the timer does not exist.
         */

        if (
            typeof sessionCheckTimer !==
            "undefined" &&
            sessionCheckTimer
        ) {
            clearInterval(
                sessionCheckTimer
            );
        }

        /*
         * Clear faculty-only browser data.
         */

        sessionStorage.removeItem(
            "matlib_faculty_name"
        );

        sessionStorage.removeItem(
            "matlib_faculty_id"
        );

        sessionStorage.removeItem(
            "matlib_faculty_designation"
        );

        /*
         * Sign out from Supabase.
         */

        const {
            error
        } = await sb.auth.signOut();

        if (error) {
            console.error(
                "Supabase logout error:",
                error
            );
        }

    } catch (error) {

        console.error(
            "Faculty logout error:",
            error
        );

    } finally {

        /*
         * replace() prevents the user from returning
         * to the dashboard using browser history.
         */

        window.location.replace(
            "faculty.html"
        );

    }

}

window.logout = logout;


    /* ========================================================
       INITIALIZATION
    ======================================================== */

    async function initialize() {

        try {

            const profile =
                await loadFacultyProfile();


            if (!profile) {
                return;
            }


            initEvents();

            initDocumentControls();

            initFileUpload();


            await Promise.all([

                loadDashboardStats(),

                loadFacultyBorrowed(),

                loadFacultyRequests(),

                loadFacultyReturns(),

                loadDriveDocuments()

            ]);


            showSection(
                "dashboardSection"
            );


            console.log(
                "MatLib Faculty Dashboard loaded."
            );


        } catch (error) {

            console.error(
                "Faculty dashboard error:",
                error
            );


            showToast(
                error.message ||
                "Unable to load Faculty Dashboard.",
                "error"
            );

        }

    }


/* ========================================================
   AUTH LISTENER
======================================================== */

sb.auth.onAuthStateChange(
    async (
        event,
        session
    ) => {
        console.log(
            "Faculty auth event:",
            event
        );

        if (event === "SIGNED_OUT") {
            stopSessionManagement();

            if (
                !window.location.pathname
                    .toLowerCase()
                    .endsWith("faculty.html")
            ) {
                redirectToFacultyLogin(
                    "You have been logged out."
                );
            }

            return;
        }

        if (
            event === "TOKEN_EXPIRED" ||
            event === "USER_DELETED"
        ) {
            await logout(
                "Your session has expired. Please login again."
            );

            return;
        }

        if (
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED"
        ) {
            if (!session) {
                await logout(
                    "Your session is no longer valid."
                );
            }
        }
    }
);


    /* ========================================================
       START
    ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();

    }

})();