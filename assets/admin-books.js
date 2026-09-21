/* ============================================================
   MATLIB
   ADMIN BOOK MANAGEMENT
   ------------------------------------------------------------
   Admin-only book catalogue

   FEATURES
   ------------------------------------------------------------
   ✓ Loads all books
   ✓ Shows full accession/access number
   ✓ Shows category
   ✓ Shows cupboard
   ✓ Shows availability
   ✓ Shows faculty currently holding unavailable book
   ✓ Shows faculty ID
   ✓ Shows issue date
   ✓ Shows due date
   ✓ Search
   ✓ Category filter
   ✓ Availability filter
   ✓ View issue details
   ✓ Return directly by accession number
   ✓ Edit / Delete compatibility with existing admin app
   ✓ Does NOT modify DB when loading
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
            "MatLib Admin Books: Supabase client not found."
        );

        return;

    }


    /* ========================================================
       STATE
    ======================================================== */

    const state = {

        books: [],

        categories: [],

        borrowRecords: [],

        facultyProfiles: [],

        filteredBooks: [],

        selectedBook: null,

        loading: false

    };


    /* ========================================================
       DOM HELPER
    ======================================================== */

    function $(id) {

        return document.getElementById(id);

    }


    /* ========================================================
       HTML ESCAPE
    ======================================================== */

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


    /* ========================================================
       DATE FORMAT
    ======================================================== */

    function formatDate(
        value
    ) {

        if (!value) {

            return "—";

        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                value
            );

        }


        return date.toLocaleDateString(
            "en-IN",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric"
            }
        );

    }


    /* ========================================================
       DATE + TIME
    ======================================================== */

    function formatDateTime(
        value
    ) {

        if (!value) {

            return "—";

        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                value
            );

        }


        return date.toLocaleString(
            "en-IN",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

    }


    /* ========================================================
       BOOK NAME
    ======================================================== */

    function getBookName(
        book
    ) {

        return (
            book.book_name ||
            book.book_title ||
            book.title ||
            book.name ||
            "Untitled Book"
        );

    }


    /* ========================================================
       AUTHOR
    ======================================================== */

    function getAuthor(
        book
    ) {

        return (
            book.author_name ||
            book.author ||
            "Unknown Author"
        );

    }


    /* ========================================================
       ACCESSION NUMBER
       
       Supports:
       accession_no
       access_no
       accession
       accession_number
    ======================================================== */

    function getAccessNo(
        book
    ) {

        const value =
            book.accession_no ??
            book.access_no ??
            book.accession ??
            book.accession_number ??
            "";


        return (
            String(
                value
            ).trim() ||
            "—"
        );

    }


    /* ========================================================
       CUPBOARD
    ======================================================== */

    function getCupboard(
        book
    ) {

        return (
            book.cupboard_no ??
            book.cupboard ??
            book.cupboard_number ??
            "—"
        );

    }


    /* ========================================================
       CATEGORY ID
    ======================================================== */

    function getCategoryId(
        book
    ) {

        return (
            book.category_id ??
            book.categoryId ??
            null
        );

    }


    /* ========================================================
       CATEGORY NAME
    ======================================================== */

    function getCategoryName(
        book
    ) {

        const categoryId =
            getCategoryId(
                book
            );


        const category =
            state.categories.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        categoryId
                    )
            );


        if (category) {

            return (
                category.name ||
                category.category_name ||
                category.category ||
                "Uncategorized"
            );

        }


        return (
            book.category_name ||
            book.category ||
            "Uncategorized"
        );

    }


    /* ========================================================
       AVAILABILITY
    ======================================================== */

    function isAvailable(
        book
    ) {

        /*
         * New inventory system.
         */

        if (
            book.available_copies !==
                null &&
            book.available_copies !==
                undefined &&
            book.available_copies !==
                ""
        ) {

            const count =
                Number(
                    book.available_copies
                );


            if (
                Number.isFinite(
                    count
                )
            ) {

                return (
                    count > 0
                );

            }

        }


        /*
         * Old availability field.
         */

        if (
            book.availability !==
                null &&
            book.availability !==
                undefined
        ) {

            const value =
                String(
                    book.availability
                )
                .trim()
                .toLowerCase();


            if (
                value ===
                    "1" ||
                value ===
                    "true" ||
                value ===
                    "yes" ||
                value ===
                    "available"
            ) {

                return true;

            }


            if (
                value ===
                    "0" ||
                value ===
                    "false" ||
                value ===
                    "no" ||
                value ===
                    "unavailable"
            ) {

                return false;

            }

        }


        /*
         * Status.
         */

        const status =
            String(
                book.status ||
                ""
            )
            .trim()
            .toLowerCase();


        if (
            status ===
                "available" ||
            status ===
                "active"
        ) {

            return true;

        }


        if (
            status ===
                "issued" ||
            status ===
                "lost" ||
            status ===
                "damaged" ||
            status ===
                "inactive" ||
            status ===
                "unavailable"
        ) {

            return false;

        }


        /*
         * If no information exists,
         * default to available.
         */

        return true;

    }


    /* ========================================================
       FIND BORROW RECORDS FOR BOOK
    ======================================================== */

    function getActiveBorrowRecords(
        bookId
    ) {

        return state.borrowRecords.filter(
            record => {

                /*
                 * Match book ID.
                 */

                const sameBook =
                    String(
                        record.book_id
                    ) ===
                    String(
                        bookId
                    );


                if (!sameBook) {

                    return false;

                }


                /*
                 * Returned records are ignored.
                 */

                if (
                    record.returned_at
                ) {

                    return false;

                }


                const status =
                    String(
                        record.status ||
                        ""
                    )
                    .trim()
                    .toLowerCase();


                if (
                    status ===
                        "returned"
                ) {

                    return false;

                }


                if (
                    status ===
                        "cancelled"
                ) {

                    return false;

                }


                return true;

            }
        );

    }


    /* ========================================================
       FIND FACULTY
    ======================================================== */

    function getFacultyForBorrow(
        record
    ) {

        if (
            !record
        ) {

            return null;

        }


        const faculty =
            state.facultyProfiles.find(
                profile =>
                    String(
                        profile.id
                    ) ===
                    String(
                        record.faculty_id
                    )
            );


        return faculty ||
            null;

    }


    /* ========================================================
       LOAD BOOKS
    ======================================================== */

    async function fetchBooks() {

        const PAGE_SIZE = 1000;
        let from = 0;
        const all = [];

        while (true) {
            const { data, error } = await sb
                .from("books")
                .select("id,book_name,author_name,category,cupboard_no,status,created_at,updated_at,category_id,access_no,availability")
                .order("id", { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (error) throw error;
            if (!data || !data.length) break;
            all.push(...data);
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }

        state.books = all.filter(book => String(book.status || '').toLowerCase() !== 'inactive');
        state.books.sort((a,b) => String(a.book_name||'').localeCompare(String(b.book_name||'')));
    }


    /* ========================================================
       LOAD CATEGORIES
    ======================================================== */

    async function fetchCategories() {

        const {
            data,
            error
        } =
            await sb
                .from(
                    "categories"
                )
                .select(
                    "*"
                )
                .order(
                    "id",
                    {
                        ascending:
                            true
                    }
                );


        if (error) {

            console.warn(
                "Category load error:",
                error
            );

            state.categories =
                [];

            return;

        }


        state.categories =
            Array.isArray(
                data
            )
                ? data
                : [];

    }


    /* ========================================================
       LOAD BORROW RECORDS
       
       Admin RLS already allows reading
       borrow_records.
    ======================================================== */

    async function fetchBorrowRecords() {

        const {
            data,
            error
        } =
            await sb
                .from(
                    "borrow_records"
                )
                .select(
                    "*"
                );


        if (error) {

            console.warn(
                "Borrow records load error:",
                error
            );

            state.borrowRecords =
                [];

            return;

        }


        state.borrowRecords =
            Array.isArray(
                data
            )
                ? data
                : [];

    }


    /* ========================================================
       LOAD FACULTY
    ======================================================== */

    async function fetchFacultyProfiles() {

        const {
            data,
            error
        } =
            await sb
                .from(
                    "faculty_profiles"
                )
                .select(
                    "*"
                );


        if (error) {

            console.warn(
                "Faculty profiles load error:",
                error
            );

            state.facultyProfiles =
                [];

            return;

        }


        state.facultyProfiles =
            Array.isArray(
                data
            )
                ? data
                : [];

    }


    /* ========================================================
       FILL CATEGORY FILTER
    ======================================================== */

    function fillCategoryFilter() {

        const select =
            $("bookCategoryFilter");


        if (!select) {

            return;

        }


        const current =
            select.value;


        select.innerHTML = `

            <option value="">
                All Categories
            </option>

            ${
                state.categories
                    .map(
                        category => {

                            const id =
                                category.id;

                            const name =
                                category.name ||
                                category.category_name ||
                                category.category ||
                                `Category ${id}`;


                            return `

                                <option
                                    value="${escapeHtml(
                                        id
                                    )}"
                                >
                                    ${escapeHtml(
                                        name
                                    )}
                                </option>

                            `;

                        }
                    )
                    .join("")
            }

        `;


        if (current) {

            select.value =
                current;

        }

    }


    /* ========================================================
       UPDATE TABLE HEADER
    ======================================================== */

    function updateBooksTableHeader() {

        const body =
            $("booksBody");


        if (!body) {

            return;

        }


        const table =
            body.closest(
                "table"
            );


        if (!table) {

            return;

        }


        const header =
            table.querySelector(
                "thead tr"
            );


        if (!header) {

            return;

        }


        header.innerHTML = `

            <th>
                #
            </th>

            <th>
                Book
            </th>

            <th>
                Author
            </th>

            <th>
                Access No.
            </th>

            <th>
                Category
            </th>

            <th>
                Cupboard
            </th>

            <th>
                Status
            </th>

            <th>
                Issued To
            </th>

            <th>
                Action
            </th>

        `;

    }


    /* ========================================================
       FILTER BOOKS
    ======================================================== */

    function getFilteredBooks() {

        const search =
            (
                $("bookSearch")
                    ?.value ||
                ""
            )
            .trim()
            .toLowerCase();


        const category =
            $("bookCategoryFilter")
                ?.value ||
            "";


        const availability =
            $("bookAvailabilityFilter")
                ?.value ||
            "";


        return state.books.filter(
            book => {

                /*
                 * SEARCH
                 */

                if (search) {

                    const text =
                        [

                            getBookName(
                                book
                            ),

                            getAuthor(
                                book
                            ),

                            getAccessNo(
                                book
                            ),

                            getCupboard(
                                book
                            ),

                            getCategoryName(
                                book
                            ),

                            book.s_no

                        ]
                        .join(" ")
                        .toLowerCase();


                    if (
                        !text.includes(
                            search
                        )
                    ) {

                        return false;

                    }

                }


                /*
                 * CATEGORY
                 */

                if (
                    category &&
                    String(
                        getCategoryId(
                            book
                        )
                    ) !==
                    String(
                        category
                    )
                ) {

                    return false;

                }


                /*
                 * AVAILABILITY
                 */

                const available =
                    isAvailable(
                        book
                    );


                if (
                    availability ===
                        "available"
                ) {

                    if (
                        !available
                    ) {

                        return false;

                    }

                }


                if (
                    availability ===
                        "issued"
                ) {

                    if (
                        available
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );

    }


    /* ========================================================
       LOAD BOOKS
       
       IMPORTANT:
       This is the function your existing
       admin dashboard already calls.
    ======================================================== */

    async function loadBooks() {

        const body =
            $("booksBody");


        if (!body) {

            console.warn(
                "MatLib Admin Books: #booksBody not found."
            );

            return;

        }


        /*
         * Show loading.
         */

        body.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    style="
                        text-align:center;
                        padding:40px;
                    "
                >

                    Loading books...

                </td>

            </tr>

        `;


        state.loading =
            true;


        try {

            /*
             * Load everything.
             */

            await Promise.all([

                fetchBooks(),

                fetchCategories(),

                fetchBorrowRecords(),

                fetchFacultyProfiles()

            ]);


            /*
             * Update header.
             */

            updateBooksTableHeader();


            /*
             * Category dropdown.
             */

            fillCategoryFilter();


            /*
             * Filter.
             */

            state.filteredBooks =
                getFilteredBooks();


            /*
             * Render.
             */

            renderBooksTable();


        } catch (error) {

            console.error(
                "ADMIN BOOKS ERROR:",
                error
            );


            body.innerHTML = `

                <tr>

                    <td
                        colspan="9"
                        style="
                            text-align:center;
                            padding:40px;
                        "
                    >

                        <strong>
                            Unable to load books
                        </strong>

                        <br>

                        <small>
                            ${escapeHtml(
                                error.message ||
                                "Database error."
                            )}
                        </small>

                    </td>

                </tr>

            `;

        } finally {

            state.loading =
                false;

        }

    }


    /* ========================================================
       RENDER BOOK TABLE
    ======================================================== */

    function renderBooksTable() {

        const body =
            $("booksBody");


        if (!body) {

            return;

        }


        if (
            !state.filteredBooks.length
        ) {

            body.innerHTML = `

                <tr>

                    <td
                        colspan="9"
                        style="
                            text-align:center;
                            padding:45px;
                        "
                    >

                        No books found.

                    </td>

                </tr>

            `;

            return;

        }


        body.innerHTML =
            state.filteredBooks
                .map(
                    (
                        book,
                        index
                    ) => {

                        const available =
                            isAvailable(
                                book
                            );


                        const borrowRecords =
                            getActiveBorrowRecords(
                                book.id
                            );


                        const primaryBorrow =
                            borrowRecords[0] ||
                            null;


                        const faculty =
                            getFacultyForBorrow(
                                primaryBorrow
                            );


                        return createBookRow(
                            book,
                            index + 1,
                            available,
                            primaryBorrow,
                            faculty,
                            borrowRecords.length
                        );

                    }
                )
                .join("");

    }


    /* ========================================================
       CREATE BOOK ROW
    ======================================================== */

    function createBookRow(
        book,
        serial,
        available,
        borrowRecord,
        faculty,
        borrowCount
    ) {

        const bookName =
            getBookName(
                book
            );


        const author =
            getAuthor(
                book
            );


        const accessNo =
            getAccessNo(
                book
            );


        const category =
            getCategoryName(
                book
            );


        const cupboard =
            getCupboard(
                book
            );


        /*
         * Status.
         */

        const statusHTML =
            available

                ? `

                    <span
                        class="availability-badge available"
                    >
                        AVAILABLE
                    </span>

                  `

                : `

                    <span
                        class="availability-badge unavailable"
                    >
                        NOT AVAILABLE
                    </span>

                  `;


        /*
         * Issued To.
         */

        let issuedHTML = "";


        if (
            !available &&
            faculty
        ) {

            const facultyName =
                faculty.name ||
                "Unknown Faculty";


            const facultyId =
                faculty.faculty_id ||
                "—";


            issuedHTML = `

                <div
                    class="issued-faculty"
                    title="Currently issued faculty"
                >

                    <strong>
                        ${escapeHtml(
                            facultyName
                        )}
                    </strong>

                    <span>
                        ID:
                        ${escapeHtml(
                            facultyId
                        )}
                    </span>

                </div>

            `;

        } else if (
            !available &&
            borrowRecord
        ) {

            /*
             * If faculty profile couldn't
             * be loaded, still show faculty_id.
             */

            issuedHTML = `

                <div
                    class="issued-faculty"
                >

                    <strong>
                        Faculty
                    </strong>

                    <span>
                        ID:
                        ${escapeHtml(
                            borrowRecord.faculty_id ||
                            "—"
                        )}
                    </span>

                </div>

            `;

        } else if (
            !available
        ) {

            issuedHTML = `

                <span
                    class="issued-unknown"
                >
                    Issued
                </span>

            `;

        } else {

            issuedHTML = `

                <span
                    class="not-issued"
                >
                    —
                </span>

            `;

        }


        /*
         * Issue count.
         */

        if (
            borrowCount > 1
        ) {

            issuedHTML += `

                <button
                    type="button"
                    class="view-issue-btn"
                    data-view-issue="${
                        escapeHtml(
                            book.id
                        )
                    }"
                >
                    View ${borrowCount} issues
                </button>

            `;

        } else if (
            borrowRecord
        ) {

            issuedHTML += `

                <button
                    type="button"
                    class="view-issue-btn"
                    data-view-issue="${
                        escapeHtml(
                            book.id
                        )
                    }"
                >
                    View Issue
                </button>

            `;

        }


        /*
         * Actions.
         */

        const editButton = `

            <button
                type="button"
                class="btn btn-light"
                data-edit-book="${
                    escapeHtml(
                        book.id
                    )
                }"
            >
                Edit
            </button>

        `;


        const deleteButton = `

            <button
                type="button"
                class="btn btn-red"
                data-delete-book="${
                    escapeHtml(
                        book.id
                    )
                }"
            >
                Delete
            </button>

        `;


        let returnButton = "";


        if (
            !available &&
            accessNo !== "—"
        ) {

            returnButton = `

                <button
                    type="button"
                    class="btn btn-gold"
                    data-return-book="${
                        escapeHtml(
                            book.id
                        )
                    }"
                >
                    Return
                </button>

            `;

        }


        return `

            <tr
                class="admin-book-row"
                data-book-row="${
                    escapeHtml(
                        book.id
                    )
                }"
            >


                <!-- SERIAL -->

                <td>

                    <span
                        class="admin-book-number"
                    >
                        ${serial}
                    </span>

                </td>


                <!-- BOOK -->

                <td>

                    <div
                        class="admin-book-name"
                    >

                        <strong>
                            ${escapeHtml(
                                bookName
                            )}
                        </strong>

                    </div>

                </td>


                <!-- AUTHOR -->

                <td>

                    ${escapeHtml(
                        author
                    )}

                </td>


                <!-- ACCESS NO -->

                <td>

                    <span
                        class="admin-access-no"
                        title="${escapeHtml(
                            accessNo
                        )}"
                    >
                        ${escapeHtml(
                            accessNo
                        )}
                    </span>

                </td>


                <!-- CATEGORY -->

                <td>

                    <span
                        class="admin-category"
                    >
                        ${escapeHtml(
                            category
                        )}
                    </span>

                </td>


                <!-- CUPBOARD -->

                <td>

                    ${escapeHtml(
                        cupboard
                    )}

                </td>


                <!-- STATUS -->

                <td>

                    ${statusHTML}

                </td>


                <!-- ISSUED TO -->

                <td>

                    ${issuedHTML}

                </td>


                <!-- ACTION -->

                <td>

                    <div
                        class="admin-book-actions"
                    >

                        ${editButton}

                        ${returnButton}

                        ${deleteButton}

                    </div>

                </td>


            </tr>

        `;

    }


    /* ========================================================
       VIEW ISSUE DETAILS
    ======================================================== */

    function openIssueDetails(
        bookId
    ) {

        const book =
            state.books.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        bookId
                    )
            );


        if (!book) {

            return;

        }


        const records =
            getActiveBorrowRecords(
                book.id
            );


        if (
            !records.length
        ) {

            showAdminMessage(
                "No active issue record found.",
                "info"
            );

            return;

        }


        const rows =
            records
                .map(
                    record => {

                        const faculty =
                            getFacultyForBorrow(
                                record
                            );


                        const facultyName =
                            faculty?.name ||
                            record.student_name ||
                            "Faculty";


                        const facultyId =
                            faculty?.faculty_id ||
                            record.faculty_id ||
                            "—";


                        const dueDate =
                            record.due_date;


                        const issuedDate =
                            record.issued_at;


                        const overdue =
                            isOverdue(
                                record
                            );


                        return `

                            <div
                                class="
                                    issue-detail-card
                                    ${
                                        overdue
                                            ? "issue-overdue"
                                            : ""
                                    }
                                "
                            >

                                <div
                                    class="
                                        issue-detail-header
                                    "
                                >

                                    <div>

                                        <strong>
                                            ${escapeHtml(
                                                facultyName
                                            )}
                                        </strong>

                                        <span>
                                            Faculty ID:
                                            ${escapeHtml(
                                                facultyId
                                            )}
                                        </span>

                                    </div>


                                    <span
                                        class="
                                            issue-status
                                            ${
                                                overdue
                                                    ? "overdue"
                                                    : "issued"
                                            }
                                        "
                                    >
                                        ${
                                            overdue
                                                ? "OVERDUE"
                                                : "ISSUED"
                                        }
                                    </span>

                                </div>


                                <div
                                    class="
                                        issue-detail-grid
                                    "
                                >

                                    <div>

                                        <small>
                                            ISSUED
                                        </small>

                                        <strong>
                                            ${formatDateTime(
                                                issuedDate
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <small>
                                            DUE DATE
                                        </small>

                                        <strong>
                                            ${formatDate(
                                                dueDate
                                            )}
                                        </strong>

                                    </div>


                                </div>


                                ${
                                    record.notes
                                        ? `

                                            <p
                                                class="
                                                    issue-notes
                                                "
                                            >
                                                ${escapeHtml(
                                                    record.notes
                                                )}
                                            </p>

                                          `
                                        : ""
                                }


                                <button
                                    type="button"
                                    class="
                                        issue-return-btn
                                    "
                                    data-modal-return="${
                                        escapeHtml(
                                            book.id
                                        )
                                    }"
                                >
                                    Return Book
                                </button>

                            </div>

                        `;

                    }
                )
                .join("");


        showIssueModal(
            book,
            rows
        );

    }


    /* ========================================================
       CHECK OVERDUE
    ======================================================== */

    function isOverdue(
        record
    ) {

        if (
            !record ||
            !record.due_date
        ) {

            return false;

        }


        if (
            record.returned_at
        ) {

            return false;

        }


        const due =
            new Date(
                record.due_date
            );


        if (
            Number.isNaN(
                due.getTime()
            )
        ) {

            return false;

        }


        return (
            due.getTime() <
            Date.now()
        );

    }


    /* ========================================================
       ISSUE MODAL
    ======================================================== */

    function showIssueModal(
        book,
        content
    ) {

        closeExistingModal();


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "adminIssueDetailsModal";


        modal.className =
            "admin-book-modal";


        modal.innerHTML = `

            <div
                class="admin-book-modal-box"
            >

                <button
                    type="button"
                    class="admin-modal-close"
                    data-close-admin-modal
                >
                    ×
                </button>


                <div
                    class="admin-modal-icon"
                >
                    📚
                </div>


                <span
                    class="admin-modal-eyebrow"
                >
                    CURRENT ISSUE
                </span>


                <h2>
                    ${escapeHtml(
                        getBookName(
                            book
                        )
                    )}
                </h2>


                <div
                    class="admin-modal-access"
                >
                    Access No:
                    <strong>
                        ${escapeHtml(
                            getAccessNo(
                                book
                            )
                        )}
                    </strong>
                </div>


                <div
                    class="issue-details-list"
                >
                    ${content}
                </div>


            </div>

        `;


        document.body.appendChild(
            modal
        );


        requestAnimationFrame(
            () => {

                modal.classList.add(
                    "show"
                );

            }
        );


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeExistingModal();

                }


                if (
                    event.target.closest(
                        "[data-close-admin-modal]"
                    )
                ) {

                    closeExistingModal();

                }


                const returnButton =
                    event.target.closest(
                        "[data-modal-return]"
                    );


                if (
                    returnButton
                ) {

                    closeExistingModal();


                    const bookId =
                        returnButton.dataset
                            .modalReturn;


                    openReturnConfirmation(
                        bookId
                    );

                }

            }
        );

    }


    /* ========================================================
       CLOSE MODAL
    ======================================================== */

    function closeExistingModal() {

        const modal =
            $("adminIssueDetailsModal");


        if (modal) {

            modal.remove();

        }


        const returnModal =
            $("adminReturnModal");


        if (returnModal) {

            returnModal.remove();

        }

    }


    /* ========================================================
       RETURN CONFIRMATION
    ======================================================== */

    function openReturnConfirmation(
        bookId
    ) {

        const book =
            state.books.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        bookId
                    )
            );


        if (!book) {

            return;

        }


        closeExistingModal();


        const accessNo =
            getAccessNo(
                book
            );


        if (
            accessNo ===
            "—"
        ) {

            showAdminMessage(
                "This book does not have an accession number.",
                "error"
            );

            return;

        }


        const records =
            getActiveBorrowRecords(
                book.id
            );


        const record =
            records[0] ||
            null;


        const faculty =
            getFacultyForBorrow(
                record
            );


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "adminReturnModal";


        modal.className =
            "admin-book-modal";


        modal.innerHTML = `

            <div
                class="admin-book-modal-box"
            >

                <button
                    type="button"
                    class="admin-modal-close"
                    data-close-return
                >
                    ×
                </button>


                <div
                    class="admin-modal-icon return-icon"
                >
                    ↩
                </div>


                <span
                    class="admin-modal-eyebrow"
                >
                    RETURN BOOK
                </span>


                <h2>
                    Return this book?
                </h2>


                <div
                    class="return-book-summary"
                >

                    <strong>
                        ${escapeHtml(
                            getBookName(
                                book
                            )
                        )}
                    </strong>


                    <span>
                        Access No:
                        ${escapeHtml(
                            accessNo
                        )}
                    </span>


                    ${
                        faculty
                            ? `

                                <span>
                                    Issued to:
                                    ${escapeHtml(
                                        faculty.name ||
                                        "Faculty"
                                    )}
                                    (
                                    ${escapeHtml(
                                        faculty.faculty_id ||
                                        "—"
                                    )}
                                    )
                                </span>

                              `
                            : ""
                    }

                </div>


                <p
                    class="return-warning"
                >
                    This will mark the book as returned
                    and make it available again.
                </p>


                <div
                    class="return-modal-actions"
                >

                    <button
                        type="button"
                        class="return-cancel-btn"
                        data-close-return
                    >
                        Cancel
                    </button>


                    <button
                        type="button"
                        class="return-confirm-btn"
                        data-confirm-return="${
                            escapeHtml(
                                book.id
                            )
                        }"
                    >
                        Confirm Return
                    </button>

                </div>


            </div>

        `;


        document.body.appendChild(
            modal
        );


        requestAnimationFrame(
            () => {

                modal.classList.add(
                    "show"
                );

            }
        );


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeExistingModal();

                    return;

                }


                if (
                    event.target.closest(
                        "[data-close-return]"
                    )
                ) {

                    closeExistingModal();

                    return;

                }


                const confirm =
                    event.target.closest(
                        "[data-confirm-return]"
                    );


                if (
                    confirm
                ) {

                    confirmAdminReturn(
                        confirm.dataset
                            .confirmReturn,
                        confirm
                    );

                }

            }
        );

    }


    /* ========================================================
       ADMIN RETURN
       
       Uses existing RPC:
       admin_return_book(text)
    ======================================================== */

    async function confirmAdminReturn(
        bookId,
        button
    ) {

        const book =
            state.books.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        bookId
                    )
            );


        if (!book) {

            return;

        }


        const accessNo =
            getAccessNo(
                book
            );


        if (
            accessNo ===
            "—"
        ) {

            showAdminMessage(
                "Accession number is missing.",
                "error"
            );

            return;

        }


        button.disabled =
            true;


        button.textContent =
            "Returning...";


        try {

            const {
                error
            } =
                await sb.rpc(
                    "admin_return_book",
                    {
                        p_accession_no:
                            accessNo
                    }
                );


            if (error) {

                throw error;

            }


            closeExistingModal();


            showAdminMessage(
                "Book returned successfully.",
                "success"
            );


            /*
             * Reload fresh DB data.
             */

            await loadBooks();


        } catch (error) {

            console.error(
                "ADMIN RETURN ERROR:",
                error
            );


            button.disabled =
                false;


            button.textContent =
                "Confirm Return";


            showAdminMessage(
                error.message ||
                "Unable to return book.",
                "error"
            );

        }

    }


    /* ========================================================
       MESSAGE
    ======================================================== */

    function showAdminMessage(
        message,
        type = "success"
    ) {

        /*
         * Use existing toast if page has one.
         */

        const existingToast =
            $("adminToast");


        if (
            existingToast
        ) {

            existingToast.textContent =
                message;

            existingToast.classList.add(
                "show"
            );


            setTimeout(
                () => {

                    existingToast.classList.remove(
                        "show"
                    );

                },
                3000
            );


            return;

        }


        /*
         * Fallback.
         */

        let toast =
            $("adminBooksToast");


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );


            toast.id =
                "adminBooksToast";


            toast.className =
                "admin-books-toast";


            document.body.appendChild(
                toast
            );

        }


        toast.textContent =
            message;


        toast.className =
            `admin-books-toast show ${type}`;


        clearTimeout(
            showAdminMessage.timer
        );


        showAdminMessage.timer =
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
       EDIT BOOK
       
       Calls existing openBookModal()
       from admin app.
    ======================================================== */

    function editBook(
        bookId
    ) {

        const book =
            state.books.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        bookId
                    )
            );


        if (!book) {

            return;

        }


        if (
            typeof window.openBookModal ===
            "function"
        ) {

            window.openBookModal(
                book
            );

            return;

        }


        showAdminMessage(
            "Book edit function is not loaded.",
            "error"
        );

    }


    /* ========================================================
       DELETE BOOK
       
       Calls existing admin delete
       function if available.
    ======================================================== */

    async function deleteBookAdmin(
        bookId
    ) {

        const book =
            state.books.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        bookId
                    )
            );


        if (!book) {

            return;

        }


        if (
            typeof window.deleteBook ===
            "function"
        ) {

            window.deleteBook(
                Number(
                    book.id
                )
            );

            return;

        }


        /*
         * Fallback direct RPC.
         */

        const confirmed =
            window.confirm(
                `Delete "${getBookName(
                    book
                )}"?`
            );


        if (!confirmed) {

            return;

        }


        try {

            const {
                error
            } =
                await sb.rpc(
                    "admin_delete_book",
                    {
                        p_book_id:
                            Number(
                                book.id
                            )
                    }
                );


            if (error) {

                throw error;

            }


            showAdminMessage(
                "Book deleted successfully.",
                "success"
            );


            await loadBooks();


        } catch (error) {

            console.error(
                "DELETE BOOK ERROR:",
                error
            );


            showAdminMessage(
                error.message ||
                "Unable to delete book.",
                "error"
            );

        }

    }


    /* ========================================================
       EVENTS
    ======================================================== */

    function setupEvents() {


        $("exportBooksPdf")?.addEventListener("click", () => {
            const table = $("booksBody")?.closest("table");
            if (!table) return;
            const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
            if (!win) { showAdminMessage("Allow pop-ups to export PDF.", "error"); return; }
            const style = `<style>body{font-family:Arial,sans-serif;margin:20px;color:#302820}h1{font-size:22px}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:9px}th,td{border:1px solid #d8c8b1;padding:6px;vertical-align:top;word-break:break-word;white-space:normal}th{background:#633717;color:#fff}@page{size:A4 landscape;margin:10mm}</style>`;
            win.document.write(`<!doctype html><html><head><title>MatLib Book Catalogue</title>${style}</head><body><h1>MatLib Book Catalogue</h1>${table.outerHTML}</body></html>`);
            win.document.close(); win.focus(); setTimeout(() => win.print(), 250);
        });


        /*
         * Search.
         */

        $("bookSearch")
            ?.addEventListener(
                "input",
                () => {

                    state.filteredBooks =
                        getFilteredBooks();

                    renderBooksTable();

                }
            );


        /*
         * Category.
         */

        $("bookCategoryFilter")
            ?.addEventListener(
                "change",
                () => {

                    state.filteredBooks =
                        getFilteredBooks();

                    renderBooksTable();

                }
            );


        /*
         * Availability.
         */

        $("bookAvailabilityFilter")
            ?.addEventListener(
                "change",
                () => {

                    state.filteredBooks =
                        getFilteredBooks();

                    renderBooksTable();

                }
            );


        /*
         * Books table event delegation.
         */

        const body =
            $("booksBody");


        if (body) {

            body.addEventListener(
                "click",
                event => {

                    /*
                     * VIEW ISSUE
                     */

                    const viewIssue =
                        event.target.closest(
                            "[data-view-issue]"
                        );


                    if (
                        viewIssue
                    ) {

                        openIssueDetails(
                            viewIssue.dataset
                                .viewIssue
                        );

                        return;

                    }


                    /*
                     * EDIT
                     */

                    const edit =
                        event.target.closest(
                            "[data-edit-book]"
                        );


                    if (
                        edit
                    ) {

                        editBook(
                            edit.dataset
                                .editBook
                        );

                        return;

                    }


                    /*
                     * DELETE
                     */

                    const remove =
                        event.target.closest(
                            "[data-delete-book]"
                        );


                    if (
                        remove
                    ) {

                        deleteBookAdmin(
                            remove.dataset
                                .deleteBook
                        );

                        return;

                    }


                    /*
                     * RETURN
                     */

                    const returnButton =
                        event.target.closest(
                            "[data-return-book]"
                        );


                    if (
                        returnButton
                    ) {

                        openReturnConfirmation(
                            returnButton.dataset
                                .returnBook
                        );

                        return;

                    }

                }
            );

        }


        /*
         * ESC.
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeExistingModal();

                }

            }
        );

    }


    /* ========================================================
       GLOBAL FUNCTION
       
       Existing admin dashboard uses:
       
       showSection('booksPanel')
       ↓
       loadBooks()
    ======================================================== */

    window.loadBooks =
        loadBooks;


    window.loadAdminBooks =
        loadBooks;


    window.adminViewBookIssue =
        openIssueDetails;


    window.adminReturnBookFromCatalogue =
        openReturnConfirmation;


    /* ========================================================
       START
    ======================================================== */

    function start() {

        setupEvents();

        /*
         * Do NOT automatically load here if
         * the panel may not exist yet.
         *
         * If #booksBody exists, load once.
         */

        if (
            $("booksBody")
        ) {

            loadBooks();

        }

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();

    }


})();