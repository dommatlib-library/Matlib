"use strict";

console.log("MatLib Student Portal loaded.");

const STUDENT_SESSION_KEY = "matlib_student";
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


let roots = [];
let folders = [];
let files = [];

let currentNode = {
    type: "root",
    id: null,
    name: "Question Papers"
};

let breadcrumbPath = [
    { type: "root", id: null, name: "Question Papers" }
];

document.addEventListener("DOMContentLoaded", initializeStudentPortal);

function initializeStudentPortal() {
    const student = getStudent();
    if (!student) {
        window.location.href = "student.html";
        return;
    }

    updateStudentUI(student);
    setupPortalNavigation();
    setupPortalActions();
    showStudentView("documents");
    loadQuestionPapers();
}

function getStudent() {
    try {
        const raw = sessionStorage.getItem(STUDENT_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        sessionStorage.removeItem(STUDENT_SESSION_KEY);
        return null;
    }
}

function updateStudentUI(student) {
    const name =
        student.name ||
        student.student_name ||
        student.full_name ||
        "Student";

    const email =
        student.email ||
        student.student_email ||
        "-";

    const roll =
        student.roll_no ||
        student.register_number ||
        student.reg_no ||
        student.student_roll_no ||
        "-";

    setText("headerStudentName", name);
    setText("headerStudentEmail", email);
    setText("introStudentName", name);
    setText("introStudentRoll", roll);
    setText("studentInitial", name.trim().charAt(0).toUpperCase() || "S");
}

function setupPortalNavigation() {
    document.querySelectorAll("[data-student-nav]").forEach((button) => {
        button.addEventListener("click", () => {
            showStudentView(button.dataset.studentNav);
        });
    });

    const menu = document.getElementById("studentMenuButton");
    const sidebar = document.getElementById("studentSidebar");
    if (menu && sidebar) {
        menu.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    setupSidebarCollapse();
}

function showStudentView(view) {
    const views = {
        documents: "documentsView",
        cgpa: "cgpaView"
    };

    // Only Documents and CGPA are actual application pages.
    Object.values(views).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("active");
    });

    const selectedView = views[view] ? view : "documents";
    const selected = document.getElementById(views[selectedView]);
    if (selected) selected.classList.add("active");

    document.querySelectorAll(".student-nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.studentNav === selectedView);
    });

    setText("studentPageName", selectedView === "cgpa" ? "CGPA Calculator" : "Documents");

    const sidebar = document.getElementById("studentSidebar");
    if (sidebar) sidebar.classList.remove("open");

    // Refresh documents only when the Documents page is selected.
    if (selectedView === "documents" && files.length === 0 && folders.length === 0 && roots.length === 0) {
        loadQuestionPapers();
    }
}

function setupSidebarCollapse() {
    const sidebar = document.getElementById("studentSidebar");
    const button = document.getElementById("sidebarCollapseButton");
    if (!sidebar || !button) return;

    const saved = localStorage.getItem("matlib_student_sidebar_collapsed");
    const collapsed = saved === "1";
    applySidebarCollapsed(collapsed);

    button.addEventListener("click", () => {
        const next = !sidebar.classList.contains("collapsed");
        applySidebarCollapsed(next);
        localStorage.setItem("matlib_student_sidebar_collapsed", next ? "1" : "0");
    });
}

function applySidebarCollapsed(collapsed) {
    const sidebar = document.getElementById("studentSidebar");
    const button = document.getElementById("sidebarCollapseButton");
    if (!sidebar || !button) return;

    sidebar.classList.toggle("collapsed", collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("title", collapsed ? "Expand menu" : "Collapse menu");
    button.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
    button.textContent = collapsed ? "›" : "‹";
}


function setupPortalActions() {
    ["studentSidebarLogout"].forEach((id) => {
        const button = document.getElementById(id);
        if (button) button.addEventListener("click", logoutStudent);
    });

    const refresh = document.getElementById("studentRefresh");
    if (refresh) refresh.addEventListener("click", loadQuestionPapers);

    const back = document.getElementById("breadcrumbBack");
    if (back) back.addEventListener("click", goBackFolder);
}

function logoutStudent() {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    window.location.href = "student.html";
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function getSupabaseConfig() {
    const client = window.matlibSupabase || window.matlib?.sb || null;
    return {
        url: window.MATLIB_SUPABASE_URL ||
             window.SUPABASE_URL ||
             window.supabaseUrl ||
             client?.supabaseUrl ||
             "",
        key: window.MATLIB_SUPABASE_ANON_KEY ||
             window.SUPABASE_ANON_KEY ||
             window.supabaseAnonKey ||
             client?.supabaseKey ||
             ""
    };
}

async function loadQuestionPapers() {
    showLoading(true);
    hideMessage();

    try {
        const { url, key } = getSupabaseConfig();

        if (!url || !key) {
            throw new Error("Supabase configuration is missing in config.js.");
        }

        const student = getStudent() || {};
        const functionUrl = `${url}/functions/v1/student-documents`;

        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": key,
                "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
                action: "list_question_papers",
                student_name: student.name || student.student_name || "",
                student_roll_no: student.roll_no || student.register_number || "",
                student_email: student.email || student.student_email || ""
            })
        });

        const raw = await response.text();
        let result;

        try {
            result = JSON.parse(raw);
        } catch {
            throw new Error("Backend returned invalid JSON.");
        }

        if (!response.ok || result.success === false) {
            throw new Error(result.error || result.message || `Request failed: ${response.status}`);
        }

        roots = normalizeArray(
            result.roots ||
            result.root_folders ||
            result.drive_root_folders ||
            result.rootFolders
        );

        folders = normalizeArray(
            result.folders ||
            result.drive_folders ||
            result.child_folders
        );

        files = normalizeArray(
            result.files ||
            result.drive_files ||
            result.documents
        );

        // Some Edge Function versions return top-level folders inside
        // drive_folders instead of a separate roots array.
        if (!roots.length && folders.length) {
            roots = folders.filter((folder) => !getParentDriveId(folder));
        }

        // Do not display root folders twice.
        if (roots.length && folders.length) {
            const rootIds = new Set(
                roots.map((folder) => String(getDriveFolderId(folder)))
            );
            folders = folders.filter(
                (folder) => !rootIds.has(String(getDriveFolderId(folder)))
            );
        }

        console.log("Student Drive hierarchy:", { roots, folders, files });

        goHome();
    } catch (error) {
        console.error("Loading documents failed:", error);
        showMessage(error.message || "Unable to load documents.");
    } finally {
        showLoading(false);
    }
}

/*
 * The hierarchy is built from the Drive IDs stored by the backend:
 *
 * Question Papers root
 *   ├── root folder
 *   │     ├── child folder
 *   │     │     └── files
 *   │     └── files
 *   └── root-level files
 *
 * A root folder uses drive_root_folders.drive_folder_id.
 * A child folder uses drive_folders.parent_drive_folder_id.
 * A file uses drive_files.folder_drive_id.
 */
function renderCurrentFolder() {
    const container = document.getElementById("documentsContainer");
    if (!container) return;

    const visibleFolders = getChildFolders(currentNode);
    const visibleFiles = getChildFiles(currentNode);

    updateCount(visibleFolders.length + visibleFiles.length);
    renderBreadcrumb();

    if (!visibleFolders.length && !visibleFiles.length) {
        container.innerHTML = `
            <div class="drive-empty">
                <div class="empty-drive-icon">📂</div>
                <h2>This folder is empty</h2>
                <p>No documents are available in this folder.</p>
                <button type="button" class="empty-refresh" onclick="loadQuestionPapers()">Refresh</button>
            </div>
        `;
        return;
    }

    let html = `
        <div class="drive-list">
            <div class="drive-list-header">
                <div>Name</div>
                <div>Type</div>
                <div>Date</div>
                <div></div>
            </div>
    `;

    visibleFolders
        .sort((a, b) => getFolderName(a).localeCompare(getFolderName(b)))
        .forEach((folder) => {
            html += createFolderRow(folder);
        });

    visibleFiles
        .sort((a, b) => getFileName(a).localeCompare(getFileName(b)))
        .forEach((file) => {
            html += createFileRow(file);
        });

    html += "</div>";
    container.innerHTML = html;

    container.querySelectorAll("[data-folder-id]").forEach((row) => {
        row.addEventListener("click", () => {
            openFolder(row.dataset.folderId, row.dataset.folderName);
        });
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFolder(row.dataset.folderId, row.dataset.folderName);
            }
        });
    });

    container.querySelectorAll("[data-share-url]").forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await shareDocument(
                button.dataset.shareUrl,
                button.dataset.shareName || "MatLib document"
            );
        });
    });
}

function getChildFolders(node) {
    if (node.type === "root") {
        return roots;
    }

    const parentDriveId = String(node.id || "");

    return folders.filter((folder) =>
        String(getParentDriveId(folder)) === parentDriveId
    );
}

function getChildFiles(node) {
    if (node.type === "root") {
        // Files whose Drive folder ID is empty/null really are root-level files.
        // Files belonging to a folder are shown only when that folder is opened.
        return files.filter((file) => !getFileFolderDriveId(file));
    }

    const folderDriveId = String(node.id || "");

    return files.filter((file) =>
        String(getFileFolderDriveId(file)) === folderDriveId
    );
}

function openFolder(folderId, folderName) {
    if (!folderId) return;

    breadcrumbPath.push({
        type: "folder",
        id: folderId,
        name: folderName
    });

    currentNode = {
        type: "folder",
        id: folderId,
        name: folderName
    };

    renderCurrentFolder();
}

function goHome() {
    currentNode = {
        type: "root",
        id: null,
        name: "Question Papers"
    };

    breadcrumbPath = [
        { type: "root", id: null, name: "Question Papers" }
    ];

    renderCurrentFolder();
}

function goBackFolder() {
    if (breadcrumbPath.length <= 1) return;
    breadcrumbPath.pop();
    const item = breadcrumbPath[breadcrumbPath.length - 1];
    currentNode = { type: item.type, id: item.id, name: item.name };
    renderCurrentFolder();
}

function goToBreadcrumb(index) {
    const item = breadcrumbPath[index];
    if (!item) return;

    breadcrumbPath = breadcrumbPath.slice(0, index + 1);
    currentNode = {
        type: item.type,
        id: item.id,
        name: item.name
    };

    renderCurrentFolder();
}

function renderBreadcrumb() {
    const breadcrumb = document.getElementById("driveBreadcrumb");
    if (!breadcrumb) return;

    breadcrumb.innerHTML = breadcrumbPath.map((item, index) => {
        const label = escapeHtml(item.name);

        if (index === breadcrumbPath.length - 1) {
            return `<span class="breadcrumb-current">${index === 0 ? "🏠" : label}</span>`;
        }

        return `
            <button type="button" class="breadcrumb-link" data-breadcrumb-index="${index}">
                ${index === 0 ? "🏠 Question Papers" : label}
            </button>
            <span class="breadcrumb-arrow">›</span>
        `;
    }).join("");

    breadcrumb.querySelectorAll("[data-breadcrumb-index]").forEach((button) => {
        button.addEventListener("click", () => {
            goToBreadcrumb(Number(button.dataset.breadcrumbIndex));
        });
    });

    const back = document.getElementById("breadcrumbBack");
    if (back) {
        back.disabled = breadcrumbPath.length <= 1;
        back.classList.toggle("disabled", breadcrumbPath.length <= 1);
    }
}

function createFolderRow(folder) {
    const name = getFolderName(folder);
    const driveId = getDriveFolderId(folder);

    return `
        <div class="drive-row folder-row"
             data-folder-id="${escapeHtml(driveId)}"
             data-folder-name="${escapeHtml(name)}"
             role="button"
             tabindex="0">
            <div class="drive-name-cell">
                <div class="drive-file-icon folder">📁</div>
                <div class="drive-file-name">${escapeHtml(name)}</div>
            </div>
            <div class="drive-type">Folder</div>
            <div class="drive-date">${formatDate(folder.created_at)}</div>
            <div class="drive-action"><span class="three-dot-btn">›</span></div>
        </div>
    `;
}

function createFileRow(file) {
    const name = getFileName(file);
    const fileId = file.drive_file_id || file.google_drive_file_id || file.file_id || "";
    const url = file.drive_url || file.file_url || file.public_url || file.url || createDriveFileUrl(fileId);
    const mime = String(file.mime_type || "").toLowerCase();
    const isPdf = name.toLowerCase().endsWith(".pdf") || mime.includes("pdf");

    return `
        <div class="drive-row file-row">
            <div class="drive-name-cell">
                <div class="drive-file-icon ${isPdf ? "pdf" : "file"}">${getFileIcon(file)}</div>
                <div class="drive-file-name">${escapeHtml(name)}</div>
            </div>
            <div class="drive-type">${escapeHtml(getReadableFileType(file.mime_type))}</div>
            <div class="drive-date">${formatDate(file.created_at)}</div>
            <div class="drive-action file-actions">
                ${url ? `
                    <a class="drive-open-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open</a>
                    <button type="button" class="drive-share-btn"
                        data-share-url="${escapeHtml(url)}"
                        data-share-name="${escapeHtml(name)}">Share</button>
                ` : `<span class="drive-date">No link</span>`}
            </div>
        </div>
    `;
}

function getFileIcon(file) {
    const mime = String(file?.mime_type || "").toLowerCase();
    const name = getFileName(file).toLowerCase();
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "📕";
    if (mime.includes("word") || /\.docx?$/.test(name)) return "📘";
    if (mime.includes("sheet") || mime.includes("excel") || /\.xlsx?$/.test(name)) return "📗";
    if (mime.includes("presentation") || mime.includes("powerpoint") || /\.pptx?$/.test(name)) return "📙";
    if (mime.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return "🖼️";
    return "📄";
}

function getDriveFolderId(folder) {
    return folder.drive_folder_id ||
        folder.folder_drive_id ||
        folder.google_drive_folder_id ||
        folder.drive_id ||
        "";
}

function getParentDriveId(folder) {
    return folder.parent_drive_folder_id ||
        folder.parent_drive_id ||
        folder.parent_folder_drive_id ||
        folder.parent_google_drive_id ||
        folder.parent_id ||
        "";
}

function getFileFolderDriveId(file) {
    return file.folder_drive_id ||
        file.parent_drive_id ||
        file.parent_folder_drive_id ||
        file.folder_google_drive_id ||
        "";
}

function getFolderName(folder) {
    return folder.name || folder.folder_name || folder.title || "Folder";
}

function getFileName(file) {
    return file.name || file.file_name || file.title || "Document";
}

function getReadableFileType(mime) {
    const value = String(mime || "").toLowerCase();
    if (value.includes("pdf")) return "PDF";
    if (value.includes("image")) return "Image";
    if (value.includes("word")) return "Word";
    if (value.includes("sheet") || value.includes("excel")) return "Spreadsheet";
    if (value.includes("presentation") || value.includes("powerpoint")) return "Presentation";
    return "Document";
}

function createDriveFileUrl(fileId) {
    return fileId
        ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`
        : "";
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function updateCount(count) {
    setText("documentCount", `${count} item${count === 1 ? "" : "s"}`);
}

function showLoading(show) {
    const loading = document.getElementById("documentsLoading");
    const container = document.getElementById("documentsContainer");
    if (loading) loading.style.display = show ? "flex" : "none";
    if (container) container.style.display = show ? "none" : "block";
}

function showMessage(message) {
    const element = document.getElementById("documentsMessage");
    if (!element) return;
    element.textContent = message;
    element.style.display = "block";
}

function hideMessage() {
    const element = document.getElementById("documentsMessage");
    if (element) element.style.display = "none";
}

function showTemporaryMessage(message) {
    const old = document.getElementById("temporaryShareMessage");
    if (old) old.remove();

    const el = document.createElement("div");
    el.id = "temporaryShareMessage";
    el.className = "temporary-share-message";
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 2200);
}

async function shareDocument(url, name) {
    if (!url) {
        showTemporaryMessage("No document link available");
        return;
    }

    try {
        if (navigator.share) {
            await navigator.share({
                title: name,
                text: `MatLib document: ${name}`,
                url
            });
            showTemporaryMessage("Share sheet opened");
            return;
        }

        await copyText(url);
        showTemporaryMessage("Document link copied");
    } catch (error) {
        if (error?.name === "AbortError") return;

        try {
            await copyText(url);
            showTemporaryMessage("Document link copied");
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    }
}

async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Copy failed");
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Backward-compatible global names in case other MatLib pages call them.
window.loadQuestionPapers = loadQuestionPapers;
window.goHome = goHome;
window.goBack = goHome;
window.studentLogout = logoutStudent;
window.studentLogoutFromDocuments = logoutStudent;
window.goBackToStudentDashboard = () => showStudentView("documents");
