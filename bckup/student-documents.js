"use strict";

console.log("MatLib Student Documents JS loaded");


/* ============================================================
   CONFIGURATION
============================================================ */

const SUPABASE_URL =
    window.MATLIB_SUPABASE_URL ||
    window.SUPABASE_URL ||
    window.supabaseUrl ||
    "";

const SUPABASE_ANON_KEY =
    window.MATLIB_SUPABASE_ANON_KEY ||
    window.SUPABASE_ANON_KEY ||
    window.supabaseAnonKey ||
    "";

const FUNCTION_URL =
    `${SUPABASE_URL}/functions/v1/student-documents`;


/* ============================================================
   STATE
============================================================ */

let roots = [];
let folders = [];
let files = [];

let currentDriveFolderId = null;
let currentFolderName = "Question Papers";

let folderHistory = [];

let breadcrumbPath = [
    {
        id: null,
        name: "Question Papers"
    }
];


/* ============================================================
   INITIALIZE
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        setupButtons();
        loadStudentDetails();
        loadQuestionPapers();
    }
);


/* ============================================================
   BUTTON SETUP
============================================================ */

function setupButtons() {
    const backButton =
        document.getElementById("backButton");

    const refreshButton =
        document.getElementById("refreshButton");

    const logoutButton =
        document.getElementById("logoutButton");

    if (backButton) {
        backButton.addEventListener(
            "click",
            goBack
        );
    }

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadQuestionPapers
        );
    }

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logoutStudent
        );
    }
}


/* ============================================================
   STUDENT DETAILS
============================================================ */

function loadStudentDetails() {
    const studentData =
        sessionStorage.getItem(
            "matlib_student"
        );

    if (!studentData) {
        console.warn(
            "Student session not found."
        );
        return;
    }

    let student;

    try {
        student =
            JSON.parse(studentData);
    } catch (error) {
        console.error(
            "Invalid student session:",
            error
        );
        return;
    }

    const name =
        student.name ||
        student.student_name ||
        student.full_name ||
        "Student";

    const email =
        student.email ||
        student.student_email ||
        "-";

    const rollNo =
        student.roll_no ||
        student.register_number ||
        student.reg_no ||
        student.student_roll_no ||
        "-";

    setText(
        "headerStudentName",
        name
    );

    setText(
        "headerStudentEmail",
        email
    );

    setText(
        "introStudentName",
        name
    );

    setText(
        "introStudentRoll",
        rollNo
    );

    setText(
        "studentInitial",
        name.trim().charAt(0).toUpperCase()
    );
}


/* ============================================================
   LOAD DATA
============================================================ */

async function loadQuestionPapers() {
    showLoading(true);
    hideMessage();

    try {
        if (!SUPABASE_URL) {
            throw new Error(
                "Supabase URL is missing in config.js."
            );
        }

        if (!SUPABASE_ANON_KEY) {
            throw new Error(
                "Supabase anon key is missing in config.js."
            );
        }

        const response =
            await fetch(
                FUNCTION_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "apikey":
                            SUPABASE_ANON_KEY,

                        "Authorization":
                            `Bearer ${SUPABASE_ANON_KEY}`
                    },

                    body: JSON.stringify({
                        action:
                            "list_question_papers"
                    })
                }
            );

        const responseText =
            await response.text();

        console.log(
            "Student documents response:",
            responseText
        );

        let result;

        try {
            result =
                JSON.parse(responseText);
        } catch (error) {
            throw new Error(
                "Backend returned invalid JSON."
            );
        }

        if (!response.ok) {
            throw new Error(
                result.error ||
                result.message ||
                `Request failed: ${response.status}`
            );
        }

        if (result.success === false) {
            throw new Error(
                result.error ||
                result.message ||
                "Unable to load documents."
            );
        }

        roots =
            Array.isArray(result.roots)
                ? result.roots
                : [];

        folders =
            Array.isArray(result.folders)
                ? result.folders
                : [];

        files =
            Array.isArray(result.files)
                ? result.files
                : [];

        console.log("Question paper roots:", roots);
        console.log("Question paper folders:", folders);
        console.log("Question paper files:", files);

        currentDriveFolderId = null;
        currentFolderName = "Question Papers";

        folderHistory = [];

        breadcrumbPath = [
            {
                id: null,
                name: "Question Papers"
            }
        ];

        renderCurrentFolder();

    } catch (error) {
        console.error(
            "Loading documents failed:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load documents."
        );

    } finally {
        showLoading(false);
    }
}


/* ============================================================
   RENDER CURRENT FOLDER
============================================================ */

function renderCurrentFolder() {
    const container =
        document.getElementById(
            "documentsContainer"
        );

    if (!container) {
        console.error(
            "HTML element #documentsContainer not found."
        );
        return;
    }

    let visibleFolders = [];
    let visibleFiles = [];

    /*
     * ROOT LEVEL
     *
     * Show only drive_root_folders.
     */
    if (currentDriveFolderId === null) {
        visibleFolders = roots;
        visibleFiles = [];
    }

    /*
     * INSIDE FOLDER
     *
     * Match Google Drive IDs.
     */
    else {
        visibleFolders =
            folders.filter(
                function (folder) {
                    const parentDriveId =
                        getParentDriveId(
                            folder
                        );

                    return (
                        String(parentDriveId) ===
                        String(currentDriveFolderId)
                    );
                }
            );

        visibleFiles =
            files.filter(
                function (file) {
                    const folderDriveId =
                        getFileFolderDriveId(
                            file
                        );

                    return (
                        String(folderDriveId) ===
                        String(currentDriveFolderId)
                    );
                }
            );
    }

    updateCount(
        visibleFolders.length +
        visibleFiles.length
    );

    updateBreadcrumb();

    if (
        visibleFolders.length === 0 &&
        visibleFiles.length === 0
    ) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="document-icon">
                    📂
                </div>

                <h2>This folder is empty</h2>

                <p>
                    No documents are available here.
                </p>
            </div>
        `;

        return;
    }

    let html = `
        <div class="drive-list-header">
            <div>Name</div>
            <div>Type</div>
            <div>Date</div>
            <div></div>
        </div>
    `;

    visibleFolders.forEach(
        function (folder) {
            html += createFolderRow(
                folder
            );
        }
    );

    visibleFiles.forEach(
        function (file) {
            html += createFileRow(
                file
            );
        }
    );

    container.innerHTML = html;

    attachFolderClickEvents();
    attachShareEvents();
}


/* ============================================================
   FOLDER ROW
============================================================ */

function createFolderRow(folder) {
    const folderName =
        getFolderName(folder);

    const driveFolderId =
        getDriveFolderId(folder);

    return `
        <div
            class="document-row folder-row"
            data-drive-folder-id="${escapeHtml(
                driveFolderId
            )}"
            data-folder-name="${escapeHtml(
                folderName
            )}"
            role="button"
            tabindex="0"
        >

            <div class="document-name-cell">
                <div class="document-icon">
                    📁
                </div>

                <div class="document-name">
                    ${escapeHtml(folderName)}
                </div>
            </div>

            <div class="document-type">
                Folder
            </div>

            <div class="document-date">
                ${formatDate(
                    folder.created_at ||
                    folder.updated_at
                )}
            </div>

            <div class="document-action">
                <span class="more-button">
                    ⋮
                </span>
            </div>

        </div>
    `;
}


/* ============================================================
   FILE ROW
============================================================ */

function createFileRow(file) {
    const fileName =
        file.name ||
        file.file_name ||
        file.title ||
        "Document";

    const driveFileId =
        file.drive_file_id ||
        file.google_drive_file_id ||
        file.file_id ||
        "";

    const fileUrl =
        file.drive_url ||
        file.file_url ||
        file.public_url ||
        file.url ||
        createDriveFileUrl(
            driveFileId
        );

    const isPdf =
        fileName
            .toLowerCase()
            .endsWith(".pdf") ||

        String(
            file.mime_type || ""
        )
            .toLowerCase()
            .includes("pdf");

    return `
        <div class="document-row">

            <div class="document-name-cell">
                <div class="document-icon ${
                    isPdf ? "pdf" : ""
                }">
                    ${isPdf ? "📕" : "📄"}
                </div>

                <div class="document-name">
                    ${escapeHtml(fileName)}
                </div>
            </div>

            <div class="document-type">
                ${isPdf ? "PDF" : "Document"}
            </div>

            <div class="document-date">
                ${formatDate(
                    file.created_at ||
                    file.updated_at
                )}
            </div>

            <div class="document-action file-actions">

                ${
                    fileUrl
                        ? `
                            <a
                                class="open-button"
                                href="${escapeHtml(
                                    fileUrl
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open
                            </a>

                            <button
                                type="button"
                                class="share-button"
                                data-share-url="${escapeHtml(
                                    fileUrl
                                )}"
                                data-share-name="${escapeHtml(
                                    fileName
                                )}"
                                data-share-mime="${
                                    isPdf
                                        ? "application/pdf"
                                        : "application/octet-stream"
                                }"
                            >
                                Share
                            </button>
                        `
                        : `
                            <span class="document-date">
                                No link
                            </span>
                        `
                }

            </div>

        </div>
    `;
}


/* ============================================================
   FOLDER CLICK
============================================================ */

function attachFolderClickEvents() {
    const folderRows =
        document.querySelectorAll(
            ".folder-row"
        );

    folderRows.forEach(
        function (row) {
            function openFolder() {
                const driveFolderId =
                    row.getAttribute(
                        "data-drive-folder-id"
                    );

                const folderName =
                    row.getAttribute(
                        "data-folder-name"
                    );

                if (!driveFolderId) {
                    console.error(
                        "Missing Drive folder ID:",
                        row
                    );
                    return;
                }

                folderHistory.push({
                    driveFolderId:
                        currentDriveFolderId,

                    folderName:
                        currentFolderName
                });

                breadcrumbPath.push({
                    id: driveFolderId,
                    name: folderName
                });

                currentDriveFolderId =
                    driveFolderId;

                currentFolderName =
                    folderName;

                renderCurrentFolder();
            }

            row.addEventListener(
                "click",
                openFolder
            );

            row.addEventListener(
                "keydown",
                function (event) {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        openFolder();
                    }
                }
            );
        }
    );
}


/* ============================================================
   SHARE EVENTS
============================================================ */

function attachShareEvents() {
    const shareButtons =
        document.querySelectorAll(
            ".share-button"
        );

    shareButtons.forEach(
        function (button) {
            button.addEventListener(
                "click",
                function (event) {
                    event.stopPropagation();

                    shareDocumentFile(
                        button
                    );
                }
            );
        }
    );
}


/* ============================================================
   SHARE PDF COPY
============================================================ */

async function shareDocumentFile(button) {
    const fileUrl =
        button.getAttribute("data-share-url");

    const fileName =
        button.getAttribute("data-share-name") ||
        "Document.pdf";

    const mimeType =
        button.getAttribute("data-share-mime") ||
        "application/pdf";

    if (!fileUrl) {
        return;
    }

    const originalText =
        button.textContent;

    button.disabled = true;
    button.textContent = "Sharing...";

    try {
        /*
         * Try to download the actual file.
         */
        const response =
            await fetch(fileUrl, {
                method: "GET",
                mode: "cors"
            });

        if (
            response.ok &&
            navigator.share &&
            navigator.canShare
        ) {
            const blob =
                await response.blob();

            const file =
                new File(
                    [blob],
                    fileName,
                    {
                        type:
                            blob.type ||
                            mimeType
                    }
                );

            if (
                navigator.canShare({
                    files: [file]
                })
            ) {
                await navigator.share({
                    title: fileName,
                    files: [file]
                });

                return;
            }
        }

        /*
         * If actual file sharing is unavailable,
         * copy only the link without showing an error.
         */
        await copyText(fileUrl);

        showTemporaryMessage(
            "Share link copied"
        );

    } catch (error) {
        /*
         * Silent fallback.
         * No "share failed" message.
         */
        try {
            await copyText(fileUrl);

            showTemporaryMessage(
                "Share link copied"
            );

        } catch (copyError) {
            console.log(
                "Unable to copy share link:",
                copyError
            );
        }

    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


/* ============================================================
   COPY TEXT
============================================================ */

async function copyText(text) {
    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {
        await navigator.clipboard.writeText(
            text
        );

        return;
    }

    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(
        textarea
    );

    textarea.focus();
    textarea.select();

    const copied =
        document.execCommand(
            "copy"
        );

    textarea.remove();

    if (!copied) {
        throw new Error(
            "Copy operation failed."
        );
    }
}


/* ============================================================
   BREADCRUMB
============================================================ */

function updateBreadcrumb() {
    const breadcrumb =
        document.querySelector(
            ".breadcrumb"
        );

    if (!breadcrumb) {
        return;
    }

    let html = `
        <button
            type="button"
            class="breadcrumb-button"
            data-breadcrumb-index="0"
            title="Question Papers"
        >
            🏠
        </button>
    `;

    breadcrumbPath.forEach(
        function (item, index) {
            html += `
                <span class="breadcrumb-separator">
                    ›
                </span>
            `;

            if (
                index ===
                breadcrumbPath.length - 1
            ) {
                html += `
                    <span class="breadcrumb-current">
                        ${escapeHtml(
                            item.name
                        )}
                    </span>
                `;
            } else {
                html += `
                    <button
                        type="button"
                        class="breadcrumb-link"
                        data-breadcrumb-index="${index}"
                    >
                        ${escapeHtml(
                            item.name
                        )}
                    </button>
                `;
            }
        }
    );

    breadcrumb.innerHTML = html;

    const breadcrumbButtons =
        breadcrumb.querySelectorAll(
            "[data-breadcrumb-index]"
        );

    breadcrumbButtons.forEach(
        function (button) {
            button.addEventListener(
                "click",
                function () {
                    const index =
                        Number(
                            button.getAttribute(
                                "data-breadcrumb-index"
                            )
                        );

                    goToBreadcrumb(
                        index
                    );
                }
            );
        }
    );
}


/* ============================================================
   BREADCRUMB NAVIGATION
============================================================ */

function goToBreadcrumb(index) {
    if (index === 0) {
        goHome();
        return;
    }

    const selected =
        breadcrumbPath[index];

    if (!selected) {
        return;
    }

    breadcrumbPath =
        breadcrumbPath.slice(
            0,
            index + 1
        );

    folderHistory =
        folderHistory.slice(
            0,
            index
        );

    currentDriveFolderId =
        selected.id;

    currentFolderName =
        selected.name;

    renderCurrentFolder();
}


/* ============================================================
   BACK / HOME
============================================================ */

function goBack() {
    if (
        folderHistory.length === 0
    ) {
        goHome();
        return;
    }

    const previous =
        folderHistory.pop();

    breadcrumbPath.pop();

    currentDriveFolderId =
        previous.driveFolderId;

    currentFolderName =
        previous.folderName;

    renderCurrentFolder();
}

function goHome() {
    currentDriveFolderId = null;
    currentFolderName = "Question Papers";

    folderHistory = [];

    breadcrumbPath = [
        {
            id: null,
            name: "Question Papers"
        }
    ];

    renderCurrentFolder();
}


/* ============================================================
   DRIVE ID HELPERS
============================================================ */

function getDriveFolderId(folder) {
    return (
        folder.drive_folder_id ||
        folder.folder_drive_id ||
        folder.google_drive_folder_id ||
        folder.drive_id ||
        ""
    );
}

function getParentDriveId(folder) {
    return (
        folder.parent_drive_id ||
        folder.parent_folder_drive_id ||
        folder.parent_drive_folder_id ||
        folder.parent_google_drive_id ||
        folder.parent_id ||
        ""
    );
}

function getFileFolderDriveId(file) {
    return (
        file.folder_drive_id ||
        file.parent_drive_id ||
        file.parent_folder_drive_id ||
        file.folder_google_drive_id ||
        ""
    );
}

function getFolderName(folder) {
    return (
        folder.name ||
        folder.folder_name ||
        folder.title ||
        "Folder"
    );
}

function createDriveFileUrl(fileId) {
    if (!fileId) {
        return "";
    }

    return (
        "https://drive.google.com/file/d/" +
        encodeURIComponent(fileId) +
        "/view"
    );
}


/* ============================================================
   UI HELPERS
============================================================ */

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function updateCount(count) {
    setText(
        "documentCount",
        `${count} item${count === 1 ? "" : "s"}`
    );
}

function showLoading(show) {
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
            show ? "flex" : "none";
    }

    if (container) {
        container.style.display =
            show ? "none" : "block";
    }
}

function showMessage(message) {
    const element =
        document.getElementById(
            "documentsMessage"
        );

    if (!element) {
        alert(message);
        return;
    }

    element.textContent = message;
    element.style.display = "block";
}

function hideMessage() {
    const element =
        document.getElementById(
            "documentsMessage"
        );

    if (element) {
        element.style.display = "none";
    }
}

function showTemporaryMessage(message) {
    const oldMessage =
        document.getElementById(
            "temporaryShareMessage"
        );

    if (oldMessage) {
        oldMessage.remove();
    }

    const messageElement =
        document.createElement(
            "div"
        );

    messageElement.id =
        "temporaryShareMessage";

    messageElement.className =
        "temporary-share-message";

    messageElement.textContent =
        message;

    document.body.appendChild(
        messageElement
    );

    setTimeout(
        function () {
            messageElement.remove();
        },
        2500
    );
}

function formatDate(value) {
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

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(date);
}

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

function logoutStudent() {
    sessionStorage.removeItem(
        "matlib_student"
    );

    window.location.href =
        "student.html";
}