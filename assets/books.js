(() => {
  "use strict";

  const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "1";
  if (isEmbedded) document.body.classList.add("books-embedded");

  const state = {
    allBooks: [],
    filteredBooks: [],
    currentPage: 1,
    booksPerPage: 12,
    selectedBook: null,
    loading: false,
    currentFacultyId: null,
    pendingRequestBookIds: new Set(),
    issuedBookIds: new Set()
  };

  const elements = {
    booksGrid: document.getElementById("booksGrid"),
    loadingState: document.getElementById("loadingState"),
    emptyState: document.getElementById("emptyState"),
    pagination: document.getElementById("pagination"),

    booksCount: document.getElementById("booksCount"),
    matchingCount: document.getElementById("matchingCount"),

    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    categoryFilter: document.getElementById("categoryFilter"),
    availabilityFilter: document.getElementById("availabilityFilter"),
    sortSelect: document.getElementById("sortSelect"),
    clearFilters: document.getElementById("clearFilters"),

    requestModal: document.getElementById("requestModal"),
    closeModal: document.getElementById("closeModal"),
    cancelRequest: document.getElementById("cancelRequest"),
    sendRequest: document.getElementById("sendRequest"),

    requestTitle: document.getElementById("requestTitle"),
    requestBookName: document.getElementById("requestBookName"),
    requestMessage: document.getElementById("requestMessage"),
    requestError: document.getElementById("requestError")
  };

  const sb =
    window.matlibSupabase ||
    (window.matlib && window.matlib.sb);

  if (!sb) {
    showError(
      "Supabase is not connected. Check config.js and script order."
    );
    return;
  }

  function showError(message) {
    elements.loadingState.classList.add("hidden");
    elements.emptyState.classList.remove("hidden");

    elements.emptyState.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h3>Unable to load books</h3>
      <p>${escapeHtml(message)}</p>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function isAvailable(book) {
    return Number(book.availability) === 1;
  }

  function getStatus(book) {
    return isAvailable(book) ? "Available" : "Issued";
  }

  function getStatusClass(book) {
    return isAvailable(book) ? "available" : "issued";
  }

  function getAuthor(book) {
    return book.author_name || "Unknown Author";
  }

  function getBookName(book) {
    return book.book_name || "Untitled Book";
  }

function createBookCard(book, index) {
  const availability = Number(book.availability);
  const isAvailable = availability === 1;

  const bookName = escapeHtml(book.book_name || "Untitled Book");
  const authorName = escapeHtml(book.author_name || "Unknown Author");
  const accessNo = escapeHtml(book.access_no || "—");
  const cupboardNo = escapeHtml(book.cupboard_no || "—");

  const statusText = isAvailable ? "Available" : "Issued";

  return `
    <article class="book-card ${isAvailable ? "book-available" : "book-issued"}">

      <div class="book-card-top">
        <span class="book-number">#${index}</span>

        <span class="book-status ${isAvailable ? "status-available" : "status-issued"}">
          ${statusText}
        </span>
      </div>

      <div class="book-cover-3d">
        <div class="book-cover-spine"></div>

        <div class="book-cover-front">
          <div class="book-cover-brand">MATLIB</div>

          <h2 class="book-cover-title">
            ${bookName}
          </h2>

          <p class="book-cover-author">
            ${authorName}
          </p>

          <div class="book-cover-line"></div>

          <span class="book-cover-label">
            LIBRARY COLLECTION
          </span>
        </div>

        <div class="book-cover-pages"></div>
      </div>

      <div class="book-info">
        <h3 class="book-title">${bookName}</h3>

        <p class="book-author">
          By ${authorName}
        </p>

        <div class="book-details">
          <div class="detail-row">
            <span>Access No</span>
            <strong>${accessNo}</strong>
          </div>

          <div class="detail-row">
            <span>Cupboard</span>
            <strong>${cupboardNo}</strong>
          </div>
        </div>

        ${(() => {
          const id = String(book.id);
          const issuedToMe = state.issuedBookIds.has(id);
          const alreadyRequested = state.pendingRequestBookIds.has(id);

          if (issuedToMe) {
            return `<button class="request-book-btn request-disabled" type="button" disabled aria-disabled="true" title="This book is already issued to you"><span>📕</span> Issued</button>`;
          }

          if (!isAvailable) {
            return `<button class="request-book-btn request-disabled" type="button" disabled aria-disabled="true" title="This book is currently issued"><span>📕</span> Issued</button>`;
          }

          if (alreadyRequested) {
            return `<button class="request-book-btn request-disabled" type="button" disabled aria-disabled="true" title="You already requested this book"><span>📩</span> Requested</button>`;
          }

          return `<button class="request-book-btn" type="button" data-book-id="${book.id}" data-book-name="${bookName}"><span>📩</span> Request Book</button>`;
        })()}
      </div>
    </article>
  `;
}

  async function loadFacultyBookStates() {
    state.pendingRequestBookIds = new Set();
    state.issuedBookIds = new Set();

    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user?.id) return;

    state.currentFacultyId = user.id;

    const [requestResult, borrowResult] = await Promise.all([
      sb.from("book_requests")
        .select("book_id,status")
        .eq("faculty_id", user.id)
        .eq("status", "pending"),
      sb.from("borrow_records")
        .select("book_id,status,returned_at")
        .eq("faculty_id", user.id)
        .eq("status", "Issued")
        .is("returned_at", null)
    ]);

    if (requestResult.error) throw requestResult.error;
    if (borrowResult.error) throw borrowResult.error;

    (requestResult.data || []).forEach(row => state.pendingRequestBookIds.add(String(row.book_id)));
    (borrowResult.data || []).forEach(row => state.issuedBookIds.add(String(row.book_id)));
  }


  async function loadCategories() {
    if (!elements.categoryFilter) return;

    const { data, error } = await sb
      .from("categories")
      .select("id,name")
      .order("id", { ascending: true });

    if (error) {
      console.warn("MatLib: Category load failed:", error.message);
      return;
    }

    const options = (data || []).map(row => {
      const name = row.name || row.category_name || row.category || `Category ${row.id}`;
      return `<option value="${escapeHtml(row.id)}">${escapeHtml(name)}</option>`;
    }).join("");

    elements.categoryFilter.innerHTML = `<option value="all">All Categories</option>${options}`;
  }


  async function loadBooks() {
    state.loading = true;

    elements.loadingState.classList.remove("hidden");
    elements.emptyState.classList.add("hidden");
    elements.booksGrid.innerHTML = "";
    elements.pagination.innerHTML = "";

    try {
      const allBooks = [];
      const batchSize = 1000;

      let from = 0;

      while (true) {
        const to = from + batchSize - 1;

        const { data, error } = await sb
          .from("books")
          .select(`
            id,
            book_name,
            author_name,
            cupboard_no,
            status,
            created_at,
            updated_at,
            category_id,
            access_no,
            availability
          `)
          .order("id", {
            ascending: true
          })
          .range(from, to);

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          break;
        }

        allBooks.push(...data);

        if (data.length < batchSize) {
          break;
        }

        from += batchSize;
      }

      state.allBooks = allBooks;
      state.currentPage = 1;

      await loadFacultyBookStates();

      elements.booksCount.textContent =
        `${allBooks.length.toLocaleString()} books`;

      applyFilters();

    } catch (error) {
      console.error("MatLib: Failed to load books:", error);

      showError(
        error.message || "Could not load books from Supabase."
      );
    } finally {
      state.loading = false;
      elements.loadingState.classList.add("hidden");
    }
  }

  function applyFilters() {
    const searchValue = normalizeText(
      elements.searchInput.value
    );

    const categoryValue =
      elements.categoryFilter?.value || "all";

    const availabilityValue =
      elements.availabilityFilter.value;

    const sortValue =
      elements.sortSelect.value;

    state.filteredBooks = state.allBooks.filter((book) => {
      const searchableText = [
        book.book_name,
        book.author_name,
        book.access_no,
        book.cupboard_no
      ]
        .map(normalizeText)
        .join(" ");

      const matchesSearch =
        !searchValue ||
        searchableText.includes(searchValue);

      const matchesCategory =
        categoryValue === "all" ||
        String(book.category_id ?? "") === String(categoryValue);

      const matchesAvailability =
        availabilityValue === "all" ||
        (availabilityValue === "available" &&
          isAvailable(book)) ||
        (availabilityValue === "issued" &&
          !isAvailable(book));

      return matchesSearch && matchesCategory && matchesAvailability;
    });

    sortBooks(sortValue);

    state.currentPage = 1;

    renderBooks();
    renderPagination();
  }

  function sortBooks(sortValue) {
    state.filteredBooks.sort((a, b) => {
      if (sortValue === "name-asc") {
        return getBookName(a).localeCompare(
          getBookName(b)
        );
      }

      if (sortValue === "name-desc") {
        return getBookName(b).localeCompare(
          getBookName(a)
        );
      }

      if (sortValue === "author-asc") {
        return getAuthor(a).localeCompare(
          getAuthor(b)
        );
      }

      if (sortValue === "id-desc") {
        return Number(b.id) - Number(a.id);
      }

      return Number(a.id) - Number(b.id);
    });
  }

  function renderBooks() {
    const total = state.filteredBooks.length;

    elements.matchingCount.textContent =
      `${total.toLocaleString()} matching books`;

    if (total === 0) {
      elements.booksGrid.innerHTML = "";
      elements.emptyState.classList.remove("hidden");
      return;
    }

    elements.emptyState.classList.add("hidden");

    const start =
      (state.currentPage - 1) * state.booksPerPage;

    const end =
      start + state.booksPerPage;

    const pageBooks =
      state.filteredBooks.slice(start, end);

    elements.booksGrid.innerHTML =
      pageBooks
        .map((book, index) => {
          const displayNumber =
            start + index + 1;

          return createBookCard(
            book,
            displayNumber
          );
        })
        .join("");
  }

  function renderPagination() {
    const totalPages = Math.ceil(
      state.filteredBooks.length /
      state.booksPerPage
    );

    elements.pagination.innerHTML = "";

    if (totalPages <= 1) {
      return;
    }

    const fragment = document.createDocumentFragment();

    function addPageButton(
      label,
      page,
      disabled = false,
      active = false
    ) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "page-button";

      if (active) {
        button.classList.add("active");
      }

      button.textContent = label;
      button.disabled = disabled;

      button.addEventListener("click", () => {
        state.currentPage = page;
        renderBooks();
        renderPagination();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });

      fragment.appendChild(button);
    }

    addPageButton(
      "«",
      1,
      state.currentPage === 1
    );

    addPageButton(
      "‹",
      Math.max(1, state.currentPage - 1),
      state.currentPage === 1
    );

    const pages = getVisiblePages(
      state.currentPage,
      totalPages
    );

    pages.forEach((page) => {
      if (page === "...") {
        const span = document.createElement("span");
        span.className = "page-button";
        span.textContent = "...";
        span.style.cursor = "default";
        span.style.border = "0";
        span.style.background = "transparent";
        fragment.appendChild(span);
      } else {
        addPageButton(
          String(page),
          page,
          false,
          page === state.currentPage
        );
      }
    });

    addPageButton(
      "›",
      Math.min(totalPages, state.currentPage + 1),
      state.currentPage === totalPages
    );

    addPageButton(
      "»",
      totalPages,
      state.currentPage === totalPages
    );

    elements.pagination.appendChild(fragment);
  }

  function getVisiblePages(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    if (currentPage <= 4) {
      return [
        1,
        2,
        3,
        4,
        5,
        "...",
        totalPages
      ];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages
    ];
  }

  function openRequestModal(bookId) {
    const book = state.allBooks.find(
      (item) => String(item.id) === String(bookId)
    );

    if (!book) {
      return;
    }

    if (!isAvailable(book)) {
      return;
    }

    state.selectedBook = book;

    const bookName = getBookName(book);

    elements.requestTitle.textContent =
      "Request Book";

    elements.requestBookName.textContent =
      bookName;

    if (elements.requestMessage) {
      elements.requestMessage.value =
        `I would like to request the book "${bookName}".`;
    }

    elements.requestError.textContent = "";
    elements.requestError.classList.add("hidden");

    elements.requestModal.classList.remove("hidden");
    elements.requestModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";
  }

  function closeRequestModal() {
    state.selectedBook = null;

    elements.requestModal.classList.add("hidden");
    elements.requestModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow = "";
  }

async function sendBookRequest() {
  if (!state.selectedBook) return;

  const book = state.selectedBook;

  if (!isAvailable(book)) return;

  elements.sendRequest.disabled = true;
  elements.sendRequest.textContent = "Sending...";
  elements.requestError.classList.add("hidden");

  try {
    const { data: userData, error: userError } = await sb.auth.getUser();

    if (userError) throw userError;
    if (!userData?.user?.id) {
      throw new Error("Your login session has expired. Please log in again.");
    }

    const { data: existingRequests, error: existingError } = await sb
      .from("book_requests")
      .select("id,status")
      .eq("book_id", book.id)
      .eq("faculty_id", userData.user.id)
      .eq("status", "pending")
      .limit(1);

    if (existingError) throw existingError;

    if (existingRequests?.length) {
      throw new Error("You already have a pending request for this book.");
    }

    // Create the request directly in the current `book_requests` table.
    // This avoids the legacy request_book RPC, which may still reference
    // the removed `books.available_copies` column.
    const { error: insertError } = await sb
      .from("book_requests")
      .insert({
        book_id: Number(book.id),
        faculty_id: userData.user.id,
        status: "pending",
        requested_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    state.pendingRequestBookIds.add(String(book.id));
    closeRequestModal();
    renderBooks();

  } catch (error) {
    console.error("MatLib: Request failed:", error);
    showRequestError(error.message || "Could not send the request.");
  } finally {
    elements.sendRequest.disabled = false;
    elements.sendRequest.textContent = "📩 Send Request";
  }
}

  function showRequestError(message) {
    elements.requestError.textContent = message;
    elements.requestError.classList.remove("hidden");
  }

  /* Search and filters */

  elements.searchInput.addEventListener(
    "input",
    applyFilters
  );

  elements.clearSearch.addEventListener(
    "click",
    () => {
      elements.searchInput.value = "";
      applyFilters();
      elements.searchInput.focus();
    }
  );

  elements.categoryFilter?.addEventListener(
    "change",
    applyFilters
  );

  elements.availabilityFilter.addEventListener(
    "change",
    applyFilters
  );

  elements.sortSelect.addEventListener(
    "change",
    applyFilters
  );

  elements.clearFilters.addEventListener(
    "click",
    () => {
      elements.searchInput.value = "";
      if (elements.categoryFilter) elements.categoryFilter.value = "all";
      elements.availabilityFilter.value = "all";
      elements.sortSelect.value = "id-asc";

      applyFilters();
    }
  );

/* Request buttons */

elements.booksGrid.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-book-id]"
      );

    if (!button) {
      return;
    }

    // IMPORTANT:
    // The book card uses data-book-id
    const bookId =
      button.getAttribute(
        "data-book-id"
      );

    if (!bookId) {
      return;
    }

    openRequestModal(bookId);
  }
);
  elements.closeModal.addEventListener(
    "click",
    closeRequestModal
  );

  elements.cancelRequest.addEventListener(
    "click",
    closeRequestModal
  );

  elements.sendRequest.addEventListener(
    "click",
    sendBookRequest
  );

  elements.requestModal.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        elements.requestModal
      ) {
        closeRequestModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !elements.requestModal.classList.contains(
          "hidden"
        )
      ) {
        closeRequestModal();
      }
    }
  );

  /* Start */

  Promise.all([loadCategories(), loadBooks()]);

})();