// ============================================================
// MatLib Student Documents
// ============================================================

console.log("MatLib Student Documents loaded.");

const STUDENT_SESSION_KEY = "matlib_student";

const DOCUMENT_FUNCTION_URL =
    `${window.MATLIB_SUPABASE_URL}/functions/v1/student-documents`;

let currentShareFile = null;


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeDocumentsPage
);


function initializeDocumentsPage() {

    const student =
        getStudent();


    if (!student) {

        redirectToLogin();

        return;
    }


    updateStudentUI(student);

    loadQuestionPapers();
}


// ============================================================
// GET STUDENT
// ============================================================

function getStudent() {

    try {

        const raw =
            sessionStorage.getItem(
                STUDENT_SESSION_KEY
            );


        if (!raw) {
            return null;
        }


        return JSON.parse(raw);

    } catch {

        return null;
    }
}


// ============================================================
// UPDATE STUDENT UI
// ============================================================

function updateStudentUI(student) {

    const name =
        student.name ||
        student.student_name ||
        "Student";


    const email =
        student.email ||
        student.student_email ||
        "";


    const roll =
        student.roll_no ||
        student.student_roll_no ||
        "";


    const headerName =
        document.getElementById(
            "headerStudentName"
        );


    const headerEmail =
        document.getElementById(
            "headerStudentEmail"
        );


    const introName =
        document.getElementById(
            "introStudentName"
        );


    const introRoll =
        document.getElementById(
            "introStudentRoll"
        );


    const initial =
        document.getElementById(
            "studentInitial"
        );


    if (headerName) {
        headerName.textContent = name;
    }


    if (headerEmail) {
        headerEmail.textContent = email;
    }


    if (introName) {
        introName.textContent = name;
    }


    if (introRoll) {
        introRoll.textContent = roll;
    }


    if (initial) {

        initial.textContent =
            name
                .charAt(0)
                .toUpperCase() || "S";
    }
}


// ============================================================
// LOAD QUESTION PAPERS
// ============================================================

async function loadQuestionPapers() {

    const student =
        getStudent();


    if (!student) {

        redirectToLogin();

        return;
    }


    showLoading(true);

    hideMessage();


    const name =
        student.name ||
        student.student_name ||
        "";


    const rollNo =
        student.roll_no ||
        student.student_roll_no ||
        "";


    const email =
        student.email ||
        student.student_email ||
        "";


    const requestBody = {

        action:
            "list_question_papers",

        student_name:
            name,

        student_roll_no:
            rollNo,

        student_email:
            email

    };


    console.log(
        "REQUEST BODY:",
        requestBody
    );


    try {

        const response =
            await fetch(
                DOCUMENT_FUNCTION_URL,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "apikey":
                            window.MATLIB_SUPABASE_ANON_KEY

                    },

                    body:
                        JSON.stringify(
                            requestBody
                        )

                }
            );


        const raw =
            await response.text();


        let result;


        try {

            result =
                JSON.parse(raw);

        } catch {

            throw new Error(
                "Invalid server response."
            );
        }


        console.log(
            "DOCUMENT RESPONSE:",
            result
        );


        if (!response.ok) {

            throw new Error(
                result.error ||
                `Request failed with status ${response.status}.`
            );
        }


        if (!result.success) {

            throw new Error(
                result.error ||
                "Unable to load documents."
            );
        }


        renderDocuments(result);


    } catch (error) {

        console.error(
            "Document error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to load documents.",
            "error"
        );

    } finally {

        showLoading(false);
    }
}


// ============================================================
// RENDER DOCUMENTS
// ============================================================

function renderDocuments(data) {

    const container =
        document.getElementById(
            "documentsContainer"
        );


    if (!container) {
        return;
    }


    const folders =
        Array.isArray(data.folders)
            ? data.folders
            : [];


    const files =
        Array.isArray(data.files)
            ? data.files
            : [];


    updateDocumentCount(
        files.length
    );


    if (
        folders.length === 0 &&
        files.length === 0
    ) {

        container.innerHTML = `

            <div class="drive-empty">

                <div class="empty-drive-icon">
                    📄
                </div>

                <h2>
                    No Question Papers
                </h2>

                <p>
                    Question Papers uploaded by
                    the administrator will appear here.
                </p>

                <button
                    onclick="loadQuestionPapers()"
                    class="empty-refresh"
                >
                    Refresh
                </button>

            </div>

        `;

        return;
    }


    let html = `

        <div class="drive-list">

            <div class="drive-list-header">

                <div>
                    Name
                </div>

                <div>
                    Type
                </div>

                <div>
                    Date
                </div>

                <div></div>

            </div>

    `;


    // --------------------------------------------------------
    // FOLDERS
    // --------------------------------------------------------

    folders.forEach(
        folder => {

            html += createFolderRow(
                folder
            );

        }
    );


    // --------------------------------------------------------
    // FILES
    // --------------------------------------------------------

    files.forEach(
        file => {

            html += createFileRow(
                file
            );

        }
    );


    html += `
        </div>
    `;


    container.innerHTML =
        html;
}


// ============================================================
// FOLDER ROW
// ============================================================

function createFolderRow(folder) {

    const name =
        escapeHtml(
            folder.name ||
            "Folder"
        );


    return `

        <div
            class="drive-row folder-row"
        >

            <div class="drive-name-cell">

                <div class="drive-file-icon folder">
                    📁
                </div>

                <div class="drive-name">
                    ${name}
                </div>

            </div>


            <div class="drive-type">
                Folder
            </div>


            <div class="drive-date">
                ${formatDate(folder.created_at)}
            </div>


            <div class="drive-menu-cell">

                <button
                    class="three-dot-btn"
                    onclick="showFolderMenu(event)"
                    title="More"
                >
                    ⋮
                </button>

            </div>

        </div>

    `;
}


// ============================================================
// FILE ROW
// ============================================================

function createFileRow(file) {

    const name =
        escapeHtml(
            file.name ||
            "Question Paper"
        );


    const type =
        getReadableFileType(
            file.mime_type
        );


    const url =
        file.drive_url ||
        (
            file.drive_file_id
                ? `https://drive.google.com/file/d/${encodeURIComponent(file.drive_file_id)}/view`
                : ""
        );


    const encodedUrl =
        encodeURIComponent(
            url
        );


    const encodedName =
        encodeURIComponent(
            file.name || "Question Paper"
        );


    return `

        <div
            class="drive-row file-row"
            onclick="openFileFromRow(event, '${encodedUrl}')"
        >

            <div class="drive-name-cell">

                <div
                    class="drive-file-icon ${getFileIconClass(file.mime_type)}"
                >
                    ${getFileIcon(file.mime_type)}
                </div>


                <div class="drive-name">
                    ${name}
                </div>

            </div>


            <div class="drive-type">
                ${type}
            </div>


            <div class="drive-date">
                ${formatDate(file.created_at)}
            </div>


            <div class="drive-menu-cell">

                <button
                    class="three-dot-btn"
                    onclick="openFileMenu(
                        event,
                        '${encodedUrl}',
                        '${encodedName}'
                    )"
                    title="More"
                >
                    ⋮
                </button>

            </div>

        </div>

    `;
}


// ============================================================
// FILE OPEN
// ============================================================

function openFileFromRow(
    event,
    encodedUrl
) {

    if (
        event.target.closest(
            ".drive-menu-cell"
        )
    ) {

        return;
    }


    const url =
        decodeURIComponent(
            encodedUrl
        );


    if (!url) {

        showMessage(
            "File link is unavailable.",
            "error"
        );

        return;
    }


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


// ============================================================
// THREE DOT FILE MENU
// ============================================================

function openFileMenu(
    event,
    encodedUrl,
    encodedName
) {

    event.stopPropagation();


    closeContextMenu();


    const url =
        decodeURIComponent(
            encodedUrl
        );


    const name =
        decodeURIComponent(
            encodedName
        );


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "context-menu";


    menu.innerHTML = `

        <button
            onclick="openContextFile('${escapeAttribute(url)}')"
        >
            <span>↗</span>
            Open
        </button>


        <button
            onclick="openShareFromMenu(
                '${escapeAttribute(url)}',
                '${escapeAttribute(name)}'
            )"
        >
            <span>✉</span>
            Share / Send
        </button>

    `;


    document.body.appendChild(
        menu
    );


    const rect =
        event.currentTarget.getBoundingClientRect();


    menu.style.top =
        `${rect.bottom + 5}px`;


    menu.style.left =
        `${Math.min(
            rect.left,
            window.innerWidth - 190
        )}px`;


    setTimeout(
        () => {

            document.addEventListener(
                "click",
                closeContextMenu,
                {
                    once: true
                }
            );

        },
        0
    );
}


// ============================================================
// CONTEXT MENU OPEN
// ============================================================

function openContextFile(url) {

    closeContextMenu();


    if (!url) {
        return;
    }


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


// ============================================================
// FOLDER MENU
// ============================================================

function showFolderMenu(event) {

    event.stopPropagation();

    closeContextMenu();


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "context-menu";


    menu.innerHTML = `

        <div class="menu-disabled">
            <span>📁</span>
            Question Paper Folder
        </div>

    `;


    document.body.appendChild(
        menu
    );


    const rect =
        event.currentTarget.getBoundingClientRect();


    menu.style.top =
        `${rect.bottom + 5}px`;


    menu.style.left =
        `${Math.min(
            rect.left,
            window.innerWidth - 210
        )}px`;


    setTimeout(
        () => {

            document.addEventListener(
                "click",
                closeContextMenu,
                {
                    once: true
                }
            );

        },
        0
    );
}


// ============================================================
// CLOSE MENU
// ============================================================

function closeContextMenu() {

    document
        .querySelectorAll(
            ".context-menu"
        )
        .forEach(
            menu => menu.remove()
        );
}


// ============================================================
// SHARE
// ============================================================

function openShareFromMenu(
    url,
    name
) {

    closeContextMenu();


    currentShareFile = {

        url: url,

        name:
            name ||
            "Question Paper"

    };


    document.getElementById(
        "shareFileName"
    ).textContent =
        currentShareFile.name;


    const recipientList =
        document.getElementById(
            "recipientList"
        );


    recipientList.innerHTML = "";


    const student =
        getStudent();


    const email =
        student?.email ||
        student?.student_email ||
        "";


    addRecipientInput(
        email
    );


    document.getElementById(
        "shareModal"
    ).style.display =
        "flex";


    setTimeout(
        () => {

            const input =
                recipientList.querySelector(
                    "input"
                );


            if (input) {
                input.focus();
            }

        },
        100
    );
}


// ============================================================
// ADD RECIPIENT
// ============================================================

function addRecipientInput(
    value = ""
) {

    const list =
        document.getElementById(
            "recipientList"
        );


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "recipient-row";


    row.innerHTML = `

        <input
            type="email"
            class="recipient-input"
            placeholder="Email address"
            value="${escapeAttribute(value)}"
        >


        <button
            type="button"
            class="remove-recipient"
            onclick="removeRecipient(this)"
            title="Remove"
        >
            ×
        </button>

    `;


    list.appendChild(
        row
    );
}


// ============================================================
// REMOVE RECIPIENT
// ============================================================

function removeRecipient(button) {

    const row =
        button.closest(
            ".recipient-row"
        );


    if (row) {
        row.remove();
    }


    const list =
        document.getElementById(
            "recipientList"
        );


    if (
        list &&
        list.children.length === 0
    ) {

        addRecipientInput();
    }
}


// ============================================================
// SEND HISTORY LOG
// ============================================================

async function logDocumentSendHistory(documentName, documentUrl, recipients) {
    try {
        const sb = window.matlibSupabase || window.matlib?.sb;
        if (!sb) return;
        const raw = sessionStorage.getItem("matlib_student");
        const student = raw ? JSON.parse(raw) : {};
        await sb.from("student_document_send_history").insert({
            student_name: student.name || student.student_name || "Student",
            roll_no: student.roll_no || student.student_roll_no || student.register_number || "",
            sender_email: student.email || student.student_email || "",
            document_name: documentName || "Question Paper",
            drive_url: documentUrl || null,
            recipients,
            status: "initiated"
        });
    } catch (error) {
        console.warn("MatLib: document send history could not be recorded.", error);
    }
}

// ============================================================
// SEND QUESTION PAPER
// ============================================================

async function sendQuestionPaper() {

    if (!currentShareFile) {
        return;
    }


    const inputs =
        document.querySelectorAll(
            ".recipient-input"
        );


    const emails = [];


    inputs.forEach(
        input => {

            const email =
                input.value
                    .trim()
                    .toLowerCase();


            if (email) {
                emails.push(email);
            }

        }
    );


    if (emails.length === 0) {

        alert(
            "Please enter at least one email address."
        );

        return;
    }


    const invalid =
        emails.find(
            email =>
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    email
                )
        );


    if (invalid) {

        alert(
            `Invalid email address: ${invalid}`
        );

        return;
    }


    const uniqueEmails =
        [
            ...new Set(emails)
        ];


    const subject =
        encodeURIComponent(
            `MatLib Question Paper - ${currentShareFile.name}`
        );


    const body =
        encodeURIComponent(
            `Hello,\n\nPlease find the Question Paper below:\n\n${currentShareFile.name}\n${currentShareFile.url}\n\nSent from MatLib Student Portal.`
        );


    const recipients =
        uniqueEmails.join(",");


    await logDocumentSendHistory(
        currentShareFile.name,
        currentShareFile.url,
        uniqueEmails
    );

    const mailto =
        `mailto:${recipients}?subject=${subject}&body=${body}`;


    window.location.href =
        mailto;


    closeShareModal();
}


// ============================================================
// CLOSE SHARE MODAL
// ============================================================

function closeShareModal() {

    const modal =
        document.getElementById(
            "shareModal"
        );


    if (modal) {

        modal.style.display =
            "none";
    }


    currentShareFile = null;
}


// ============================================================
// CLOSE MODAL WHEN OUTSIDE
// ============================================================

document.addEventListener(
    "click",
    event => {

        const modal =
            document.getElementById(
                "shareModal"
            );


        if (
            modal &&
            event.target === modal
        ) {

            closeShareModal();
        }

    }
);


// ============================================================
// FILE ICON
// ============================================================

function getFileIcon(
    mimeType
) {

    const mime =
        String(
            mimeType || ""
        ).toLowerCase();


    if (mime.includes("pdf")) {
        return "📕";
    }


    if (
        mime.includes("word") ||
        mime.includes("document")
    ) {

        return "📘";
    }


    if (
        mime.includes("image")
    ) {

        return "🖼️";
    }


    if (
        mime.includes("spreadsheet") ||
        mime.includes("excel")
    ) {

        return "📗";
    }


    return "📄";
}


function getFileIconClass(
    mimeType
) {

    const mime =
        String(
            mimeType || ""
        ).toLowerCase();


    if (mime.includes("pdf")) {
        return "pdf";
    }


    if (
        mime.includes("word") ||
        mime.includes("document")
    ) {

        return "document";
    }


    if (mime.includes("image")) {
        return "image";
    }


    return "generic";
}


// ============================================================
// FILE TYPE
// ============================================================

function getReadableFileType(
    mimeType
) {

    const mime =
        String(
            mimeType || ""
        ).toLowerCase();


    if (mime.includes("pdf")) {
        return "PDF";
    }


    if (
        mime.includes("word") ||
        mime.includes("document")
    ) {

        return "Document";
    }


    if (mime.includes("image")) {
        return "Image";
    }


    if (
        mime.includes("spreadsheet") ||
        mime.includes("excel")
    ) {

        return "Spreadsheet";
    }


    return "Document";
}


// ============================================================
// DATE
// ============================================================

function formatDate(
    value
) {

    if (!value) {
        return "-";
    }


    try {

        return new Intl.DateTimeFormat(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        ).format(
            new Date(value)
        );

    } catch {

        return "-";
    }
}


// ============================================================
// COUNT
// ============================================================

function updateDocumentCount(
    count
) {

    const element =
        document.getElementById(
            "documentCount"
        );


    if (!element) {
        return;
    }


    element.textContent =
        `${count} item${count === 1 ? "" : "s"}`;
}


// ============================================================
// LOADING
// ============================================================

function showLoading(
    show
) {

    const loading =
        document.getElementById(
            "documentsLoading"
        );


    const container =
        document.getElementById(
            "documentsContainer"
        );


    if (loading) {

        loading.style.display =
            show
                ? "flex"
                : "none";
    }


    if (container) {

        container.style.display =
            show
                ? "none"
                : "block";
    }
}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
    message,
    type = "info"
) {

    const element =
        document.getElementById(
            "documentsMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `documents-message ${type}`;


    element.style.display =
        "flex";
}


function hideMessage() {

    const element =
        document.getElementById(
            "documentsMessage"
        );


    if (element) {

        element.style.display =
            "none";
    }
}


// ============================================================
// BACK
// ============================================================

function goBackToStudentDashboard() {

    window.location.href =
        "student.html";
}


// ============================================================
// LOGOUT
// ============================================================

function studentLogoutFromDocuments() {

    sessionStorage.removeItem(
        STUDENT_SESSION_KEY
    );


    window.location.href =
        "student.html";
}


// ============================================================
// LOGIN REDIRECT
// ============================================================

function redirectToLogin() {

    sessionStorage.removeItem(
        STUDENT_SESSION_KEY
    );


    window.location.href =
        "student.html";
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

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


// ============================================================
// ESCAPE ATTRIBUTE
// ============================================================

function escapeAttribute(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}