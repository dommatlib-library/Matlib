/* =========================================================
   MATLIB - MAIN APPLICATION JAVASCRIPT
   Plain JavaScript + Supabase
   ========================================================= */

(() => {
  "use strict";

  const sb = window.matlibSupabase;

  if (!sb) {
    console.error("MatLib: Supabase client is unavailable.");
    return;
  }

  /* =======================================================
     GLOBAL HELPERS
     ======================================================= */

  window.matlibApp = {
    sb
  };

  function $(id) {
    return document.getElementById(id);
  }

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showMessage(id, message, type = "info") {
    const el = $(id);

    if (!el) return;

    el.textContent = message;
    el.className = `message ${type}`;

    if (!message) {
      el.className = "message";
    }
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function todayISO() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getUserAgent() {
    return navigator.userAgent || "Unknown";
  }

  function setLoading(id, text = "Loading...") {
    const el = $(id);

    if (!el) return;

    el.innerHTML = `
      <div class="loading">
        <span class="spinner"></span>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }

  function setEmpty(id, message = "No records found.") {
    const el = $(id);

    if (!el) return;

    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No records</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function setTableEmpty(id, colspan, message = "No records found.") {
    const el = $(id);

    if (!el) return;

    el.innerHTML = `
      <tr>
        <td colspan="${colspan}">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>${escapeHtml(message)}</p>
          </div>
        </td>
      </tr>
    `;
  }

  function statusBadge(status) {
    const value = String(status || "").toLowerCase();

    let cls = "badge-gray";

    if (
      value === "approved" ||
      value === "available" ||
      value === "returned" ||
      value === "active"
    ) {
      cls = "badge-success";
    } else if (
      value === "rejected" ||
      value === "inactive" ||
      value === "cancelled"
    ) {
      cls = "badge-danger";
    } else if (
      value === "pending" ||
      value === "overdue"
    ) {
      cls = "badge-warning";
    } else if (
      value === "issued" ||
      value === "borrowed"
    ) {
      cls = "badge-info";
    }

    return `
      <span class="badge ${cls}">
        ${escapeHtml(status || "-")}
      </span>
    `;
  }

  async function getSession() {
    const {
      data,
      error
    } = await sb.auth.getSession();

    if (error) {
      console.error(error);
      return null;
    }

    return data.session || null;
  }

  async function getCurrentUser() {
    const {
      data,
      error
    } = await sb.auth.getUser();

    if (error) {
      return null;
    }

    return data.user || null;
  }

  async function requireLogin() {
    const session = await getSession();

    if (!session) {
      window.location.href = "index.html";
      return null;
    }

    return session;
  }

  async function isAdminUser(userId) {
    if (!userId) return false;

    const {
      data,
      error
    } = await sb
      .from("admin_profiles")
      .select("id,is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }

    return Boolean(data && data.is_active);
  }

  async function getFacultyProfile(userId) {
    if (!userId) return null;

    const {
      data,
      error
    } = await sb
      .from("faculty_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    return data || null;
  }

  /* =======================================================
     LOGOUT
     ======================================================= */

  window.logout = async function () {
    await sb.auth.signOut();
    window.location.href = "index.html";
  };

  window.facultyLogout = async function () {
    await sb.auth.signOut();
    window.location.href = "index.html";
  };

  window.studentLogout = function () {
    sessionStorage.removeItem("matlib_student_name");
    sessionStorage.removeItem("matlib_student_roll");
    window.location.href = "student.html";
  };

  /* =======================================================
     AUTH REDIRECT
     ======================================================= */

  async function redirectLoggedUser() {
    const session = await getSession();

    if (!session) return;

    const user = session.user;

    if (await isAdminUser(user.id)) {
      window.location.href = "admin-dashboard.html";
      return;
    }

    const faculty = await getFacultyProfile(user.id);

    if (
      faculty &&
      faculty.approval_status === "approved" &&
      faculty.is_active
    ) {
      window.location.href = "faculty-dashboard.html";
    }
  }

  /* =======================================================
     FACULTY LOGIN
     ======================================================= */

  async function facultyLogin(event) {
    event.preventDefault();

    const facultyId = $("facultyLoginId")?.value.trim();
    const password = $("facultyLoginPassword")?.value;

    if (!facultyId || !password) {
      showMessage(
        "facultyLoginMessage",
        "Enter Faculty ID and password.",
        "error"
      );
      return;
    }

    showMessage(
      "facultyLoginMessage",
      "Checking login...",
      "info"
    );

    try {
      const {
        data: emailData,
        error: emailError
      } = await sb.rpc(
        "get_faculty_login_email",
        {
          p_faculty_id: facultyId
        }
      );

      if (emailError) {
        throw emailError;
      }

      let email = emailData;

      if (Array.isArray(emailData)) {
        email = emailData[0]?.email || emailData[0];
      }

      if (
        email &&
        typeof email === "object" &&
        email.email
      ) {
        email = email.email;
      }

      if (!email) {
        throw new Error(
          "Faculty ID not found or faculty account is not approved."
        );
      }

      const {
        error: loginError
      } = await sb.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        throw loginError;
      }

      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Unable to verify logged-in user.");
      }

      const profile = await getFacultyProfile(user.id);

      if (!profile) {
        await sb.auth.signOut();
        throw new Error("Faculty profile not found.");
      }

      if (profile.approval_status !== "approved") {
        await sb.auth.signOut();

        if (profile.approval_status === "pending") {
          throw new Error(
            "Your faculty account is still waiting for admin approval."
          );
        }

        if (profile.approval_status === "rejected") {
          throw new Error(
            profile.rejection_reason
              ? `Your registration was rejected: ${profile.rejection_reason}`
              : "Your faculty registration was rejected."
          );
        }

        throw new Error(
          "Your faculty account is not approved."
        );
      }

      if (!profile.is_active) {
        await sb.auth.signOut();

        throw new Error(
          "Your faculty account is inactive."
        );
      }

      showMessage(
        "facultyLoginMessage",
        "Login successful. Redirecting...",
        "success"
      );

      window.location.href = "faculty-dashboard.html";
    } catch (error) {
      console.error(error);

      showMessage(
        "facultyLoginMessage",
        error.message || "Login failed.",
        "error"
      );
    }
  }

  /* =======================================================
     FACULTY REGISTRATION
     ======================================================= */

  async function facultyRegister(event) {
    event.preventDefault();

    const name = $("facultyName")?.value.trim();
    const facultyId = $("facultyId")?.value.trim();
    const designation = $("facultyDesignation")?.value;
    const phone = $("facultyPhone")?.value.trim();
    const email = $("facultyEmail")?.value.trim();
    const password = $("facultyPassword")?.value;
    const confirmPassword =
      $("facultyConfirmPassword")?.value;

    if (
      !name ||
      !facultyId ||
      !designation ||
      !phone ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      showMessage(
        "facultyRegisterMessage",
        "Please fill all fields.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showMessage(
        "facultyRegisterMessage",
        "Password must contain at least 6 characters.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "facultyRegisterMessage",
        "Passwords do not match.",
        "error"
      );
      return;
    }

    showMessage(
      "facultyRegisterMessage",
      "Creating faculty registration...",
      "info"
    );

    try {
      const {
        data,
        error
      } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            faculty_id: facultyId,
            designation,
            phone
          }
        }
      });

      if (error) {
        throw error;
      }

      /*
       * If email confirmation is enabled, session may be null.
       * The database trigger creates the pending faculty profile.
       */

      if (data?.session) {
        await sb.auth.signOut();
      }

      showMessage(
        "facultyRegisterMessage",
        "Registration submitted successfully. Wait for admin approval before logging in.",
        "success"
      );

      const form = $("facultyRegisterForm");

      if (form) {
        form.reset();
      }
    } catch (error) {
      console.error(error);

      showMessage(
        "facultyRegisterMessage",
        error.message || "Registration failed.",
        "error"
      );
    }
  }

  /* =======================================================
     ADMIN CAPTCHA
     ======================================================= */

  let captchaAnswer = "";

  function randomCaptcha() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 6; i++) {
      result += chars[
        Math.floor(Math.random() * chars.length)
      ];
    }

    return result;
  }

  function generateCaptcha() {
    captchaAnswer = randomCaptcha();

    const el = $("captchaText");

    if (el) {
      el.textContent = captchaAnswer;
    }
  }

  window.generateCaptcha = generateCaptcha;

  /* =======================================================
     ADMIN LOGIN
     ======================================================= */

  async function adminLogin(event) {
    event.preventDefault();

    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;
    const captcha = $("adminCaptcha")?.value.trim();

    if (!email || !password || !captcha) {
      showMessage(
        "adminMessage",
        "Please fill all fields.",
        "error"
      );
      return;
    }

    if (
      captcha.toUpperCase() !==
      captchaAnswer.toUpperCase()
    ) {
      showMessage(
        "adminMessage",
        "Incorrect CAPTCHA.",
        "error"
      );

      generateCaptcha();
      $("adminCaptcha").value = "";

      return;
    }

    showMessage(
      "adminMessage",
      "Checking admin login...",
      "info"
    );

    try {
      const {
        error
      } = await sb.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      const user = await getCurrentUser();

      if (!user || !(await isAdminUser(user.id))) {
        await sb.auth.signOut();

        throw new Error(
          "This account does not have administrator access."
        );
      }

      showMessage(
        "adminMessage",
        "Login successful. Redirecting...",
        "success"
      );

      window.location.href = "admin-dashboard.html";
    } catch (error) {
      console.error(error);

      showMessage(
        "adminMessage",
        error.message || "Admin login failed.",
        "error"
      );

      generateCaptcha();
      $("adminCaptcha").value = "";
    }
  }

  /* =======================================================
     STUDENT GUEST LOGIN
     ======================================================= */

  async function studentGuestLogin(event) {
    event.preventDefault();

    const name = $("studentName")?.value.trim();
    const rollNo = $("rollNo")?.value.trim();

    if (!name || !rollNo) {
      showMessage(
        "studentMessage",
        "Enter your name and roll number.",
        "error"
      );
      return;
    }

    showMessage(
      "studentMessage",
      "Recording access...",
      "info"
    );

    try {
      const {
        error
      } = await sb
        .from("student_access_logs")
        .insert({
          student_name: name,
          roll_no: rollNo,
          access_type: "guest",
          user_agent: getUserAgent()
        });

      if (error) {
        throw error;
      }

      sessionStorage.setItem(
        "matlib_student_name",
        name
      );

      sessionStorage.setItem(
        "matlib_student_roll",
        rollNo
      );

      window.location.href =
        "student-dashboard.html";
    } catch (error) {
      console.error(error);

      showMessage(
        "studentMessage",
        error.message || "Unable to continue.",
        "error"
      );
    }
  }

  /* =======================================================
     STUDENT DASHBOARD
     ======================================================= */

  window.loadStudentStats = async function () {
    const totalEl = $("studentTotalBooks");
    const availableEl = $("studentAvailableBooks");
    const categoriesEl = $("studentCategories");

    try {
      const {
        count: total,
        error: totalError
      } = await sb
        .from("books")
        .select("*", {
          count: "exact",
          head: true
        })
        .neq("status", "inactive");

      if (totalError) {
        throw totalError;
      }

      const {
        count: available,
        error: availableError
      } = await sb
        .from("books")
        .select("*", {
          count: "exact",
          head: true
        })
        .neq("status", "inactive")
        .gt("available_copies", 0);

      if (availableError) {
        throw availableError;
      }

      const {
        count: categories,
        error: categoryError
      } = await sb
        .from("categories")
        .select("*", {
          count: "exact",
          head: true
        });

      if (categoryError) {
        throw categoryError;
      }

      if (totalEl) {
        totalEl.textContent = total ?? 0;
      }

      if (availableEl) {
        availableEl.textContent = available ?? 0;
      }

      if (categoriesEl) {
        categoriesEl.textContent = categories ?? 0;
      }
    } catch (error) {
      console.error(
        "Student stats error:",
        error
      );
    }
  };

  function initializeStudentDashboard() {
    const name =
      sessionStorage.getItem(
        "matlib_student_name"
      );

    const roll =
      sessionStorage.getItem(
        "matlib_student_roll"
      );

    if ($("studentDisplayName")) {
      $("studentDisplayName").textContent =
        name || "Student";
    }

    if ($("studentDisplayRollNo")) {
      $("studentDisplayRollNo").textContent =
        roll || "-";
    }

    if (
      $("studentTotalBooks") ||
      $("studentAvailableBooks") ||
      $("studentCategories")
    ) {
      window.loadStudentStats();
    }
  }

  /* =======================================================
     CATEGORIES
     ======================================================= */

  async function loadCategories(selectId) {
    const select = $(selectId);

    if (!select) return;

    const current = select.value;

    const {
      data,
      error
    } = await sb
      .from("categories")
      .select("*")
      .order("name", {
        ascending: true
      });

    if (error) {
      console.error(error);
      return;
    }

    const options = [
      `<option value="">All Categories</option>`
    ];

    (data || []).forEach(category => {
      options.push(`
        <option value="${escapeHtml(category.id)}">
          ${escapeHtml(category.name)}
        </option>
      `);
    });

    select.innerHTML = options.join("");

    if (
      current &&
      Array.from(select.options).some(
        option => option.value === current
      )
    ) {
      select.value = current;
    }
  }

  async function loadAdminCategories() {
    const body = $("categoriesBody");

    if (!body) return;

    setTableEmpty(
      "categoriesBody",
      4,
      "Loading categories..."
    );

    const {
      data,
      error
    } = await sb
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "categoriesBody",
        4,
        "No categories found."
      );
      return;
    }

    body.innerHTML = data.map(category => `
      <tr>
        <td>${escapeHtml(category.id)}</td>
        <td>${escapeHtml(category.name)}</td>
        <td>${formatDate(category.created_at)}</td>
        <td>
          <div class="actions">
            <button
              class="btn btn-danger btn-sm"
              onclick="deleteCategory(${Number(category.id)})"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  window.openCategoryModal = function () {
    const modal = $("categoryModal");

    if (!modal) return;

    modal.classList.add("active");

    const input = $("categoryName");

    if (input) {
      input.focus();
    }
  };

  window.closeCategoryModal = function () {
    const modal = $("categoryModal");

    if (modal) {
      modal.classList.remove("active");
    }

    const form = $("categoryForm");

    if (form) {
      form.reset();
    }
  };

  async function saveCategory(event) {
    event.preventDefault();

    const input = $("categoryName");

    if (!input) return;

    const name = input.value.trim();

    if (!name) {
      alert("Enter a category name.");
      return;
    }

    try {
      const {
        error
      } = await sb
        .from("categories")
        .insert({
          name
        });

      if (error) {
        throw error;
      }

      window.closeCategoryModal();

      await loadAdminCategories();
      await loadCategories("bookCategory");

      alert("Category created successfully.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to create category.");
    }
  }

  window.deleteCategory = async function (categoryId) {
    if (!categoryId) return;

    const confirmed = confirm(
      "Delete this category? Books using this category must be handled according to the database constraints."
    );

    if (!confirmed) return;

    const password = prompt(
      "Enter your admin password to confirm category deletion:"
    );

    if (!password) return;

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Admin session expired.");
      }

      const {
        error: loginError
      } = await sb.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (loginError) {
        throw new Error("Incorrect admin password.");
      }

      const {
        error
      } = await sb.rpc(
        "admin_delete_category",
        {
          p_category_id: Number(categoryId)
        }
      );

      if (error) {
        throw error;
      }

      alert("Category deleted successfully.");

      await loadAdminCategories();
      await loadCategories("bookCategory");
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to delete category.");
    }
  };

  /* =======================================================
     BOOK CATALOGUE
     ======================================================= */

  window.loadCatalogue = async function () {
    const body = $("catalogueBody");

    if (!body) return;

    setTableEmpty(
      "catalogueBody",
      8,
      "Loading books..."
    );

    const search =
      $("catalogSearch")?.value.trim() || "";

    const category =
      $("catalogCategory")?.value || "";

    const availability =
      $("catalogAvailability")?.value || "";

    let query = sb
      .from("books")
      .select(`
        id,
        book_name,
        author_name,
        cupboard_no,
        availability,
        access_no,
        s_no,
        category_id,
        status,
        total_copies,
        available_copies,
        categories(name)
      `)
      .neq("status", "inactive")
      .order("s_no", {
        ascending: true
      })
      .limit(500);

    if (category) {
      query = query.eq(
        "category_id",
        Number(category)
      );
    }

    if (availability === "available") {
      query = query.gt(
        "available_copies",
        0
      );
    }

    if (availability === "unavailable") {
      query = query.lte(
        "available_copies",
        0
      );
    }

    if (search) {
      const safeSearch =
        search.replace(/,/g, " ");

      query = query.or(
        `book_name.ilike.%${safeSearch}%,author_name.ilike.%${safeSearch}%,access_no.ilike.%${safeSearch}%,s_no.ilike.%${safeSearch}%`
      );
    }

    const {
      data,
      error
    } = await query;

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "catalogueBody",
        8,
        "No books match your search."
      );
      return;
    }

    body.innerHTML = data.map(book => {
      const available =
        Number(
          book.available_copies ??
          book.availability ??
          0
        );

      return `
        <tr>
          <td>${escapeHtml(book.s_no)}</td>

          <td>
            <strong>
              ${escapeHtml(book.book_name)}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              book.author_name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.categories?.name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.access_no || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.cupboard_no || "-"
            )}
          </td>

          <td>
            ${
              available > 0
                ? `<span class="badge badge-success">Available</span>`
                : `<span class="badge badge-danger">Unavailable</span>`
            }
          </td>

          <td>
            ${available}
          </td>
        </tr>
      `;
    }).join("");
  };

  /* =======================================================
     ADMIN BOOKS
     ======================================================= */

  async function loadAdminBooks() {
    const body = $("booksTableBody");

    if (!body) return;

    setTableEmpty(
      "booksTableBody",
      9,
      "Loading books..."
    );

    const {
      data,
      error
    } = await sb
      .from("books")
      .select(`
        id,
        book_name,
        author_name,
        access_no,
        cupboard_no,
        s_no,
        category_id,
        status,
        total_copies,
        available_copies,
        categories(name)
      `)
      .neq("status", "inactive")
      .order("s_no", {
        ascending: true
      })
      .limit(1000);

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "booksTableBody",
        9,
        "No books found."
      );
      return;
    }

    body.innerHTML = data.map(book => {
      const available =
        Number(book.available_copies ?? 0);

      return `
        <tr>
          <td>${escapeHtml(book.s_no)}</td>

          <td>
            <strong>
              ${escapeHtml(book.book_name)}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              book.author_name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.access_no || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.categories?.name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              book.cupboard_no || "-"
            )}
          </td>

          <td>
            ${Number(book.total_copies ?? 0)}
          </td>

          <td>
            ${available}
          </td>

          <td>
            <div class="actions">
              <button
                class="btn btn-yellow btn-sm"
                onclick="editBook(${Number(book.id)})"
              >
                Edit
              </button>

              <button
                class="btn btn-danger btn-sm"
                onclick="deleteBook(${Number(book.id)})"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  /* =======================================================
     BOOK MODAL
     ======================================================= */

  window.openBookModal = async function (bookId = null) {
    const modal = $("bookModal");

    if (!modal) return;

    const form = $("bookForm");

    if (form) {
      form.reset();
    }

    if ($("editBookId")) {
      $("editBookId").value = "";
    }

    if ($("bookTotal")) {
      $("bookTotal").value = "1";
    }

    await loadCategories("bookCategory");

    if (bookId) {
      await loadBookIntoForm(bookId);
    }

    modal.classList.add("active");
  };

  window.closeBookModal = function () {
    const modal = $("bookModal");

    if (modal) {
      modal.classList.remove("active");
    }

    const form = $("bookForm");

    if (form) {
      form.reset();
    }
  };

  async function loadBookIntoForm(bookId) {
    const {
      data,
      error
    } = await sb
      .from("books")
      .select("*")
      .eq("id", Number(bookId))
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if ($("editBookId")) {
      $("editBookId").value = data.id;
    }

    if ($("bookName")) {
      $("bookName").value =
        data.book_name || "";
    }

    if ($("bookAuthor")) {
      $("bookAuthor").value =
        data.author_name || "";
    }

    if ($("bookAccession")) {
      $("bookAccession").value =
        data.access_no || "";
    }

    if ($("bookCategory")) {
      $("bookCategory").value =
        data.category_id || "";
    }

    if ($("bookCupboard")) {
      $("bookCupboard").value =
        data.cupboard_no || "";
    }

    if ($("bookSno")) {
      $("bookSno").value =
        data.s_no || "";
    }

    if ($("bookTotal")) {
      $("bookTotal").value =
        data.total_copies ?? 1;
    }
  }

  window.editBook = async function (bookId) {
    await window.openBookModal(bookId);
  };

  async function saveBook(event) {
    event.preventDefault();

    const id =
      $("editBookId")?.value || "";

    const bookName =
      $("bookName")?.value.trim();

    const authorName =
      $("bookAuthor")?.value.trim();

    const accession =
      $("bookAccession")?.value.trim();

    const category =
      $("bookCategory")?.value;

    const cupboard =
      $("bookCupboard")?.value.trim();

    const sno =
      $("bookSno")?.value.trim();

    const total =
      Number($("bookTotal")?.value || 1);

    if (!bookName || !accession || !category || !sno) {
      alert(
        "Book name, accession number, category and S.No are required."
      );
      return;
    }

    if (total < 1) {
      alert("Total copies must be at least 1.");
      return;
    }

    try {
      if (id) {
        const {
          data: oldBook,
          error: oldError
        } = await sb
          .from("books")
          .select("available_copies,total_copies")
          .eq("id", Number(id))
          .single();

        if (oldError) {
          throw oldError;
        }

        const oldTotal =
          Number(oldBook.total_copies ?? 0);

        const oldAvailable =
          Number(oldBook.available_copies ?? 0);

        const borrowed =
          Math.max(
            oldTotal - oldAvailable,
            0
          );

        const newAvailable =
          Math.max(
            total - borrowed,
            0
          );

        const {
          error
        } = await sb
          .from("books")
          .update({
            book_name: bookName,
            author_name: authorName || null,
            access_no: accession,
            category_id: Number(category),
            cupboard_no: cupboard || null,
            s_no: sno,
            total_copies: total,
            available_copies: newAvailable,
            availability:
              newAvailable > 0 ? 1 : 0
          })
          .eq("id", Number(id));

        if (error) {
          throw error;
        }
      } else {
        const {
          error
        } = await sb
          .from("books")
          .insert({
            book_name: bookName,
            author_name: authorName || null,
            access_no: accession,
            category_id: Number(category),
            cupboard_no: cupboard || null,
            s_no: sno,
            total_copies: total,
            available_copies: total,
            availability: 1,
            status: "active"
          });

        if (error) {
          throw error;
        }
      }

      window.closeBookModal();

      await loadAdminBooks();

      alert(
        id
          ? "Book updated successfully."
          : "Book added successfully."
      );
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to save book.");
    }
  }

  window.deleteBook = async function (bookId) {
    if (!bookId) return;

    const confirmed = confirm(
      "Delete this book from MatLib?"
    );

    if (!confirmed) return;

    const password = prompt(
      "Enter your admin password to confirm deletion:"
    );

    if (!password) return;

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Admin session expired.");
      }

      const {
        error: loginError
      } = await sb.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (loginError) {
        throw new Error("Incorrect admin password.");
      }

      const {
        error
      } = await sb.rpc(
        "admin_delete_book",
        {
          p_book_id: Number(bookId)
        }
      );

      if (error) {
        throw error;
      }

      alert("Book deleted successfully.");

      await loadAdminBooks();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to delete the book."
      );
    }
  };

  /* =======================================================
     ADMIN FACULTY APPROVAL
     ======================================================= */

  async function loadFacultyRequests() {
    const body = $("facultyRequestsBody");

    if (!body) return;

    setTableEmpty(
      "facultyRequestsBody",
      8,
      "Loading faculty requests..."
    );

    const {
      data,
      error
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
        rejection_reason,
        created_at
      `)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "facultyRequestsBody",
        8,
        "No faculty registrations found."
      );
      return;
    }

    body.innerHTML = data.map(faculty => `
      <tr>
        <td>${escapeHtml(faculty.name)}</td>

        <td>${escapeHtml(faculty.faculty_id)}</td>

        <td>${escapeHtml(faculty.designation)}</td>

        <td>${escapeHtml(faculty.phone || "-")}</td>

        <td>${escapeHtml(faculty.email)}</td>

        <td>
          ${statusBadge(faculty.approval_status)}
        </td>

        <td>
          ${formatDate(faculty.created_at)}
        </td>

        <td>
          <div class="actions">
            ${
              faculty.approval_status === "pending"
                ? `
                  <button
                    class="btn btn-success btn-sm"
                    onclick="approveFaculty('${faculty.id}')"
                  >
                    Approve
                  </button>

                  <button
                    class="btn btn-danger btn-sm"
                    onclick="rejectFaculty('${faculty.id}')"
                  >
                    Reject
                  </button>
                `
                : "-"
            }
          </div>
        </td>
      </tr>
    `).join("");
  }

  window.approveFaculty = async function (facultyId) {
    if (!facultyId) return;

    if (!confirm("Approve this faculty account?")) {
      return;
    }

    try {
      const {
        error
      } = await sb.rpc(
        "approve_faculty",
        {
          p_faculty_id: facultyId
        }
      );

      if (error) {
        throw error;
      }

      alert("Faculty approved successfully.");

      await loadFacultyRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to approve faculty."
      );
    }
  };

  window.rejectFaculty = async function (facultyId) {
    if (!facultyId) return;

    const reason = prompt(
      "Enter rejection reason:"
    );

    if (reason === null) return;

    try {
      const {
        error
      } = await sb.rpc(
        "reject_faculty",
        {
          p_faculty_id: facultyId,
          p_reason: reason.trim() || null
        }
      );

      if (error) {
        throw error;
      }

      alert("Faculty registration rejected.");

      await loadFacultyRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to reject faculty."
      );
    }
  };

  /* =======================================================
     BOOK REQUESTS - ADMIN
     ======================================================= */

  async function loadAdminBookRequests() {
    const body = $("bookRequestsBody");

    if (!body) return;

    setTableEmpty(
      "bookRequestsBody",
      8,
      "Loading book requests..."
    );

    const {
      data,
      error
    } = await sb
      .from("book_requests")
      .select(`
        id,
        faculty_id,
        book_id,
        status,
        requested_at,
        processed_at,
        due_date,
        rejection_reason,
        faculty_profiles(
          name,
          faculty_id
        ),
        books(
          book_name,
          author_name,
          access_no,
          s_no
        )
      `)
      .order("requested_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "bookRequestsBody",
        8,
        "No book requests found."
      );
      return;
    }

    body.innerHTML = data.map(request => `
      <tr>
        <td>${request.id}</td>

        <td>
          ${escapeHtml(
            request.faculty_profiles?.name || "-"
          )}
          <br>
          <span class="small muted">
            ${escapeHtml(
              request.faculty_profiles?.faculty_id || ""
            )}
          </span>
        </td>

        <td>
          ${escapeHtml(
            request.books?.book_name || "-"
          )}
        </td>

        <td>
          ${escapeHtml(
            request.books?.access_no || "-"
          )}
        </td>

        <td>
          ${formatDate(request.requested_at)}
        </td>

        <td>
          ${formatDate(request.due_date)}
        </td>

        <td>
          ${statusBadge(request.status)}
        </td>

        <td>
          <div class="actions">
            ${
              request.status === "pending"
                ? `
                  <button
                    class="btn btn-success btn-sm"
                    onclick="approveBookRequest(${request.id})"
                  >
                    Approve
                  </button>

                  <button
                    class="btn btn-danger btn-sm"
                    onclick="rejectBookRequest(${request.id})"
                  >
                    Reject
                  </button>
                `
                : "-"
            }
          </div>
        </td>
      </tr>
    `).join("");
  }

  window.approveBookRequest = async function (
    requestId
  ) {
    const dueDate = prompt(
      "Enter due date (YYYY-MM-DD):",
      todayISO()
    );

    if (!dueDate) return;

    try {
      const {
        error
      } = await sb.rpc(
        "approve_book_request",
        {
          p_request_id: Number(requestId),
          p_due_date: dueDate
        }
      );

      if (error) {
        throw error;
      }

      alert("Book request approved.");

      await loadAdminBookRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to approve book request."
      );
    }
  };

  window.rejectBookRequest = async function (
    requestId
  ) {
    const reason = prompt(
      "Enter rejection reason:"
    );

    if (reason === null) return;

    try {
      const {
        error
      } = await sb.rpc(
        "reject_book_request",
        {
          p_request_id: Number(requestId),
          p_reason: reason.trim() || null
        }
      );

      if (error) {
        throw error;
      }

      alert("Book request rejected.");

      await loadAdminBookRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to reject book request."
      );
    }
  };

  /* =======================================================
     RETURN REQUESTS - ADMIN
     ======================================================= */

  async function loadAdminReturnRequests() {
    const body = $("returnRequestsBody");

    if (!body) return;

    setTableEmpty(
      "returnRequestsBody",
      8,
      "Loading return requests..."
    );

    const {
      data,
      error
    } = await sb
      .from("return_requests")
      .select(`
        id,
        borrow_id,
        status,
        requested_at,
        processed_at,
        rejection_reason,
        borrow_records(
          id,
          issued_at,
          due_date,
          faculty_id,
          books(
            book_name,
            access_no,
            s_no
          ),
          faculty_profiles(
            name,
            faculty_id
          )
        )
      `)
      .order("requested_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "returnRequestsBody",
        8,
        "No return requests found."
      );
      return;
    }

    body.innerHTML = data.map(request => {
      const borrow =
        request.borrow_records;

      return `
        <tr>
          <td>${request.id}</td>

          <td>
            ${escapeHtml(
              borrow?.faculty_profiles?.name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              borrow?.books?.book_name || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              borrow?.books?.access_no || "-"
            )}
          </td>

          <td>
            ${formatDate(
              request.requested_at
            )}
          </td>

          <td>
            ${formatDate(
              borrow?.due_date
            )}
          </td>

          <td>
            ${statusBadge(request.status)}
          </td>

          <td>
            <div class="actions">
              ${
                request.status === "pending"
                  ? `
                    <button
                      class="btn btn-success btn-sm"
                      onclick="approveReturnRequest(${request.id})"
                    >
                      Approve
                    </button>

                    <button
                      class="btn btn-danger btn-sm"
                      onclick="rejectReturnRequest(${request.id})"
                    >
                      Reject
                    </button>
                  `
                  : "-"
              }
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  window.approveReturnRequest = async function (
    requestId
  ) {
    if (
      !confirm(
        "Approve this book return?"
      )
    ) {
      return;
    }

    try {
      const {
        error
      } = await sb.rpc(
        "approve_return_request",
        {
          p_request_id: Number(requestId)
        }
      );

      if (error) {
        throw error;
      }

      alert("Return approved.");

      await loadAdminReturnRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to approve return."
      );
    }
  };

  window.rejectReturnRequest = async function (
    requestId
  ) {
    const reason = prompt(
      "Enter rejection reason:"
    );

    if (reason === null) return;

    try {
      const {
        error
      } = await sb.rpc(
        "reject_return_request",
        {
          p_request_id: Number(requestId),
          p_reason: reason.trim() || null
        }
      );

      if (error) {
        throw error;
      }

      alert("Return request rejected.");

      await loadAdminReturnRequests();
      await loadAdminStats();
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
        "Unable to reject return request."
      );
    }
  };

  /* =======================================================
     ADMIN QUICK ISSUE
     ======================================================= */

  window.quickIssueBook = async function () {
    const accession =
      $("quickAccession")?.value.trim();

    const dueDate =
      $("quickDueDate")?.value;

    if (!accession) {
      alert("Enter accession number.");
      return;
    }

    if (!dueDate) {
      alert("Select a due date.");
      return;
    }

    const facultyId =
      $("quickFaculty")?.value.trim();

    if (!facultyId) {
      alert("Enter Faculty ID.");
      return;
    }

    try {
      const {
        data: emailData,
        error: emailError
      } = await sb.rpc(
        "get_faculty_login_email",
        {
          p_faculty_id: facultyId
        }
      );

      if (emailError) {
        throw emailError;
      }

      let email = emailData;

      if (Array.isArray(emailData)) {
        email =
          emailData[0]?.email ||
          emailData[0];
      }

      if (
        email &&
        typeof email === "object"
      ) {
        email = email.email;
      }

      if (!email) {
        throw new Error(
          "Faculty ID not found."
        );
      }

      const {
        data: facultyData,
        error: facultyError
      } = await sb
        .from("faculty_profiles")
        .select("id")
        .eq("faculty_id", facultyId)
        .single();

      if (facultyError) {
        throw facultyError;
      }

      const {
        error
      } = await sb.rpc(
        "admin_issue_book",
        {
          p_access_no: accession,
          p_faculty_id: facultyData.id,
          p_due_date: dueDate
        }
      );

      if (error) {
        throw error;
      }

      alert("Book issued successfully.");

      if ($("quickAccession")) {
        $("quickAccession").value = "";
      }

      await loadAdminStats();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
        "Unable to issue book."
      );
    }
  };

  /* =======================================================
     ADMIN QUICK RETURN
     ======================================================= */

  window.quickReturnBook = async function () {
    const accession =
      $("quickReturnAccession")?.value.trim();

    if (!accession) {
      alert("Enter accession number.");
      return;
    }

    if (
      !confirm(
        "Confirm return for this accession number?"
      )
    ) {
      return;
    }

    try {
      const {
        error
      } = await sb.rpc(
        "admin_return_book",
        {
          p_access_no: accession
        }
      );

      if (error) {
        throw error;
      }

      alert("Book returned successfully.");

      if ($("quickReturnAccession")) {
        $("quickReturnAccession").value = "";
      }

      await loadAdminStats();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
        "Unable to return book."
      );
    }
  };

  /* =======================================================
     ADMIN DASHBOARD STATS
     ======================================================= */

  async function countRows(
    table,
    filters = []
  ) {
    let query = sb
      .from(table)
      .select("*", {
        count: "exact",
        head: true
      });

    filters.forEach(filter => {
      const [
        method,
        column,
        value
      ] = filter;

      if (method === "eq") {
        query = query.eq(
          column,
          value
        );
      }

      if (method === "neq") {
        query = query.neq(
          column,
          value
        );
      }
    });

    const {
      count,
      error
    } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  }

  async function loadAdminStats() {
    try {
      const [
        totalBooks,
        pendingFaculty,
        pendingRequests,
        pendingReturns
      ] = await Promise.all([
        countRows(
          "books",
          [
            [
              "neq",
              "status",
              "inactive"
            ]
          ]
        ),

        countRows(
          "faculty_profiles",
          [
            [
              "eq",
              "approval_status",
              "pending"
            ]
          ]
        ),

        countRows(
          "book_requests",
          [
            [
              "eq",
              "status",
              "pending"
            ]
          ]
        ),

        countRows(
          "return_requests",
          [
            [
              "eq",
              "status",
              "pending"
            ]
          ]
        )
      ]);

      if ($("totalBooks")) {
        $("totalBooks").textContent =
          totalBooks;
      }

      if ($("pendingFaculty")) {
        $("pendingFaculty").textContent =
          pendingFaculty;
      }

      if ($("pendingRequests")) {
        $("pendingRequests").textContent =
          pendingRequests;
      }

      if ($("pendingReturns")) {
        $("pendingReturns").textContent =
          pendingReturns;
      }
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );
    }
  }

  /* =======================================================
     ADMIN SECTIONS
     ======================================================= */

  window.showSection = async function (
    sectionId
  ) {
    qsa(".admin-panel").forEach(panel => {
      panel.classList.remove("active");
    });

    const section = $(sectionId);

    if (section) {
      section.classList.add("active");
    }

    qsa(".admin-sidebar button").forEach(
      button => {
        button.classList.remove("active");
      }
    );

    const matchingButton =
      document.querySelector(
        `[data-section="${sectionId}"]`
      );

    if (matchingButton) {
      matchingButton.classList.add("active");
    }

    if (sectionId === "booksPanel") {
      await loadAdminBooks();
    }

    if (sectionId === "categoriesPanel") {
      await loadAdminCategories();
    }

    if (sectionId === "facultyPanel") {
      await loadFacultyRequests();
    }

    if (
      sectionId === "bookRequestsPanel"
    ) {
      await loadAdminBookRequests();
    }

    if (
      sectionId === "returnRequestsPanel"
    ) {
      await loadAdminReturnRequests();
    }

    if (sectionId === "drivePanel") {
      await loadDriveRoots();
    }
  };

  /* =======================================================
     FACULTY DASHBOARD
     ======================================================= */

  async function loadFacultyDashboard() {
    const session = await requireLogin();

    if (!session) return;

    const user = session.user;

    if (await isAdminUser(user.id)) {
      window.location.href =
        "admin-dashboard.html";
      return;
    }

    const profile =
      await getFacultyProfile(user.id);

    if (
      !profile ||
      profile.approval_status !== "approved" ||
      !profile.is_active
    ) {
      await sb.auth.signOut();

      window.location.href =
        "faculty.html";

      return;
    }

    if ($("facultyWelcome")) {
      $("facultyWelcome").textContent =
        profile.name;
    }

    if ($("facultyGreeting")) {
      $("facultyGreeting").textContent =
        `Welcome, ${profile.name}`;
    }

    await Promise.all([
      loadFacultyStats(user.id),
      loadFacultyBorrowed(user.id),
      loadFacultyRequests(user.id),
      loadFacultyReturnRequests(user.id)
    ]);

    await loadDriveRoots(
      "facultyDriveRootSelect"
    );
  }

  async function loadFacultyStats(userId) {
    try {
      const {
        data: borrowed,
        error
      } = await sb
        .from("borrow_records")
        .select(
          "id,due_date,returned_at"
        )
        .eq("faculty_id", userId)
        .is("returned_at", null);

      if (error) {
        throw error;
      }

      const records =
        borrowed || [];

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const overdue =
        records.filter(record => {
          if (!record.due_date) {
            return false;
          }

          const due =
            new Date(
              record.due_date
            );

          due.setHours(
            0,
            0,
            0,
            0
          );

          return due < today;
        }).length;

      const {
        count: requests
      } = await sb
        .from("book_requests")
        .select("*", {
          count: "exact",
          head: true
        })
        .eq("faculty_id", userId);

      const {
        count: pending
      } = await sb
        .from("book_requests")
        .select("*", {
          count: "exact",
          head: true
        })
        .eq("faculty_id", userId)
        .eq("status", "pending");

      if ($("facultyBorrowed")) {
        $("facultyBorrowed").textContent =
          records.length;
      }

      if ($("facultyRequests")) {
        $("facultyRequests").textContent =
          requests || 0;
      }

      if ($("facultyPending")) {
        $("facultyPending").textContent =
          pending || 0;
      }

      if ($("facultyOverdue")) {
        $("facultyOverdue").textContent =
          overdue;
      }
    } catch (error) {
      console.error(
        "Faculty stats error:",
        error
      );
    }
  }

  async function loadFacultyBorrowed(
    userId
  ) {
    const body =
      $("facultyBorrowedBody");

    if (!body) return;

    setTableEmpty(
      "facultyBorrowedBody",
      7,
      "Loading borrowed books..."
    );

    const {
      data,
      error
    } = await sb
      .from("borrow_records")
      .select(`
        id,
        issued_at,
        due_date,
        returned_at,
        books(
          book_name,
          author_name,
          access_no,
          s_no
        )
      `)
      .eq("faculty_id", userId)
      .order("issued_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "facultyBorrowedBody",
        7,
        "You have no borrowed books."
      );
      return;
    }

    body.innerHTML = data.map(record => `
      <tr>
        <td>
          ${escapeHtml(
            record.books?.book_name || "-"
          )}
        </td>

        <td>
          ${escapeHtml(
            record.books?.author_name || "-"
          )}
        </td>

        <td>
          ${escapeHtml(
            record.books?.access_no || "-"
          )}
        </td>

        <td>
          ${formatDate(
            record.issued_at
          )}
        </td>

        <td>
          ${formatDate(
            record.due_date
          )}
        </td>

        <td>
          ${
            record.returned_at
              ? statusBadge("returned")
              : statusBadge("borrowed")
          }
        </td>

        <td>
          ${
            !record.returned_at
              ? `
                <button
                  class="btn btn-yellow btn-sm"
                  onclick="requestBookReturn(${record.id})"
                >
                  Request Return
                </button>
              `
              : "-"
          }
        </td>
      </tr>
    `).join("");
  }

  async function loadFacultyRequests(
    userId
  ) {
    const body =
      $("facultyRequestsBody");

    if (!body) return;

    setTableEmpty(
      "facultyRequestsBody",
      6,
      "Loading requests..."
    );

    const {
      data,
      error
    } = await sb
      .from("book_requests")
      .select(`
        id,
        book_id,
        status,
        requested_at,
        processed_at,
        due_date,
        rejection_reason,
        books(
          book_name,
          author_name,
          access_no,
          s_no
        )
      `)
      .eq("faculty_id", userId)
      .order("requested_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "facultyRequestsBody",
        6,
        "No book requests found."
      );
      return;
    }

    body.innerHTML = data.map(request => `
      <tr>
        <td>
          ${escapeHtml(
            request.books?.book_name || "-"
          )}
        </td>

        <td>
          ${escapeHtml(
            request.books?.access_no || "-"
          )}
        </td>

        <td>
          ${formatDate(
            request.requested_at
          )}
        </td>

        <td>
          ${formatDate(
            request.due_date
          )}
        </td>

        <td>
          ${statusBadge(request.status)}
          ${
            request.rejection_reason
              ? `
                <div class="small muted">
                  ${escapeHtml(
                    request.rejection_reason
                  )}
                </div>
              `
              : ""
          }
        </td>

        <td>
          ${
            request.status === "pending"
              ? `
                <button
                  class="btn btn-danger btn-sm"
                  onclick="cancelBookRequest(${request.id})"
                >
                  Cancel
                </button>
              `
              : "-"
          }
        </td>
      </tr>
    `).join("");
  }

  async function loadFacultyReturnRequests(
    userId
  ) {
    const body =
      $("facultyReturnBody");

    if (!body) return;

    setTableEmpty(
      "facultyReturnBody",
      5,
      "Loading return requests..."
    );

    const {
      data,
      error
    } = await sb
      .from("return_requests")
      .select(`
        id,
        borrow_id,
        status,
        requested_at,
        processed_at,
        rejection_reason,
        borrow_records(
          due_date,
          books(
            book_name,
            access_no
          )
        )
      `)
      .eq(
        "borrow_records.faculty_id",
        userId
      )
      .order("requested_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "facultyReturnBody",
        5,
        "No return requests found."
      );
      return;
    }

    body.innerHTML = data.map(request => `
      <tr>
        <td>
          ${escapeHtml(
            request.borrow_records?.books?.book_name || "-"
          )}
        </td>

        <td>
          ${escapeHtml(
            request.borrow_records?.books?.access_no || "-"
          )}
        </td>

        <td>
          ${formatDate(
            request.requested_at
          )}
        </td>

        <td>
          ${statusBadge(request.status)}
        </td>

        <td>
          ${
            request.rejection_reason
              ? escapeHtml(
                  request.rejection_reason
                )
              : "-"
          }
        </td>
      </tr>
    `).join("");
  }

  /* =======================================================
     FACULTY BOOK REQUEST
     ======================================================= */

  window.requestBook = async function (
    bookId
  ) {
    if (!bookId) return;

    const session =
      await getSession();

    if (!session) {
      window.location.href =
        "faculty.html";
      return;
    }

    try {
      const {
        error
      } = await sb.rpc(
        "request_book",
        {
          p_book_id: Number(bookId)
        }
      );

      if (error) {
        throw error;
      }

      alert(
        "Book request submitted successfully."
      );

      await loadFacultyDashboard();
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
        "Unable to request book."
      );
    }
  };

  window.cancelBookRequest =
    async function (requestId) {
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
        } = await sb.rpc(
          "cancel_book_request",
          {
            p_request_id:
              Number(requestId)
          }
        );

        if (error) {
          throw error;
        }

        alert(
          "Book request cancelled."
        );

        await loadFacultyDashboard();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to cancel request."
        );
      }
    };

  window.requestBookReturn =
    async function (borrowId) {
      if (
        !confirm(
          "Send a return request for this book?"
        )
      ) {
        return;
      }

      try {
        const {
          error
        } = await sb.rpc(
          "request_book_return",
          {
            p_borrow_id:
              Number(borrowId)
          }
        );

        if (error) {
          throw error;
        }

        alert(
          "Return request submitted."
        );

        await loadFacultyDashboard();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to request return."
        );
      }
    };

  /* =======================================================
     DRIVE MANAGER
     ======================================================= */

  async function getDriveAuthHeaders() {
    const session =
      await getSession();

    if (!session) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    return {
      Authorization:
        `Bearer ${session.access_token}`,
      apikey:
        window.MATLIB_SUPABASE_ANON_KEY
    };
  }

  async function driveManager(
    action,
    payload = {},
    file = null
  ) {
    const headers =
      await getDriveAuthHeaders();

    let body;

    if (file) {
      const formData =
        new FormData();

      formData.append(
        "action",
        action
      );

      Object.entries(payload).forEach(
        ([key, value]) => {
          if (
            value !== undefined &&
            value !== null
          ) {
            formData.append(
              key,
              String(value)
            );
          }
        }
      );

      formData.append(
        "file",
        file
      );

      body = formData;
    } else {
      headers["Content-Type"] =
        "application/json";

      body = JSON.stringify({
        action,
        ...payload
      });
    }

    const response =
      await fetch(
        `${window.MATLIB_SUPABASE_URL}/functions/v1/drive-manager`,
        {
          method: "POST",
          headers,
          body
        }
      );

    const result =
      await response.json()
        .catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
        `Drive operation failed (${response.status}).`
      );
    }

    return result;
  }

  /* =======================================================
     DRIVE ROOTS
     ======================================================= */

  async function loadDriveRoots(
    selectId = "driveRootSelect"
  ) {
    const select =
      $(selectId);

    const table =
      selectId === "facultyDriveRootSelect"
        ? null
        : $("driveRootsBody");

    try {
      const {
        data,
        error
      } = await sb
        .from("drive_root_folders")
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

      const roots =
        data || [];

      if (select) {
        const current =
          select.value;

        select.innerHTML = `
          <option value="">
            Select root folder
          </option>
          ${roots.map(root => `
            <option value="${root.id}">
              ${escapeHtml(root.name)}
            </option>
          `).join("")}
        `;

        if (
          current &&
          roots.some(
            root =>
              String(root.id) ===
              String(current)
          )
        ) {
          select.value =
            current;
        }
      }

      if (table) {
        if (!roots.length) {
          setTableEmpty(
            "driveRootsBody",
            4,
            "No root folders created yet."
          );
        } else {
          table.innerHTML =
            roots.map(root => `
              <tr>
                <td>${root.id}</td>

                <td>
                  <strong>
                    ${escapeHtml(root.name)}
                  </strong>
                </td>

                <td>
                  ${formatDate(
                    root.created_at
                  )}
                </td>

                <td>
                  <div class="actions">
                    <button
                      class="btn btn-yellow btn-sm"
                      onclick="renameDriveRoot(${root.id})"
                    >
                      Rename
                    </button>

                    <button
                      class="btn btn-danger btn-sm"
                      onclick="deleteDriveRoot(${root.id})"
                    >
                      Delete
                    </button>

                    <a
                      class="btn btn-light btn-sm"
                      href="${escapeHtml(
                        `https://drive.google.com/drive/folders/${root.drive_folder_id}`
                      )}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open
                    </a>
                  </div>
                </td>
              </tr>
            `).join("");
        }
      }

      if (
        selectId === "facultyDriveRootSelect"
      ) {
        await loadFacultyDriveFolders();
      }
    } catch (error) {
      console.error(
        "Drive roots error:",
        error
      );

      if (table) {
        table.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="message error">
                ${escapeHtml(
                  error.message
                )}
              </div>
            </td>
          </tr>
        `;
      }
    }
  }

  window.createDriveRoot =
    async function () {
      const input =
        $("driveRootName");

      if (!input) return;

      const name =
        input.value.trim();

      if (!name) {
        alert(
          "Enter a root folder name."
        );
        return;
      }

      try {
        const result =
          await driveManager(
            "create_root",
            {
              name
            }
          );

        alert(
          result.message ||
          "Root folder created successfully."
        );

        input.value = "";

        await loadDriveRoots();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to create root folder."
        );
      }
    };

  window.renameDriveRoot =
    async function (rootId) {
      const {
        data,
        error
      } = await sb
        .from("drive_root_folders")
        .select("name")
        .eq("id", Number(rootId))
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      const name =
        prompt(
          "Enter new root folder name:",
          data.name
        );

      if (
        name === null ||
        !name.trim()
      ) {
        return;
      }

      try {
        const result =
          await driveManager(
            "rename_root",
            {
              root_id:
                Number(rootId),
              name:
                name.trim()
            }
          );

        alert(
          result.message ||
          "Root folder renamed."
        );

        await loadDriveRoots();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to rename root folder."
        );
      }
    };

  window.deleteDriveRoot =
    async function (rootId) {
      if (
        !confirm(
          "Delete this root folder and its Drive folder? This action may remove its metadata and Drive contents."
        )
      ) {
        return;
      }

      try {
        const result =
          await driveManager(
            "delete_root",
            {
              root_id:
                Number(rootId)
            }
          );

        alert(
          result.message ||
          "Root folder deleted."
        );

        await loadDriveRoots();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to delete root folder."
        );
      }
    };

  /* =======================================================
     DRIVE SUBFOLDERS
     ======================================================= */

  async function loadDriveFolders(
    rootId,
    selectId = "driveFolderSelect"
  ) {
    const select =
      $(selectId);

    if (!select) return;

    if (!rootId) {
      select.innerHTML = `
        <option value="">
          Select folder
        </option>
      `;

      return;
    }

    try {
      const {
        data,
        error
      } = await sb
        .from("drive_folders")
        .select("*")
        .eq(
          "root_folder_id",
          Number(rootId)
        )
        .order("name");

      if (error) {
        throw error;
      }

      select.innerHTML = `
        <option value="">
          Root folder
        </option>
        ${(data || []).map(folder => `
          <option value="${folder.id}">
            ${escapeHtml(folder.name)}
          </option>
        `).join("")}
      `;
    } catch (error) {
      console.error(error);

      select.innerHTML = `
        <option value="">
          Unable to load folders
        </option>
      `;
    }
  }

  window.createDriveFolder =
    async function () {
      const rootId =
        $("driveRootSelect")?.value;

      const parentId =
        $("driveFolderSelect")?.value || "";

      const name =
        $("driveFolderName")?.value.trim();

      if (!rootId) {
        alert(
          "Select a root folder first."
        );
        return;
      }

      if (!name) {
        alert(
          "Enter a folder name."
        );
        return;
      }

      try {
        const result =
          await driveManager(
            "create_folder",
            {
              root_id:
                Number(rootId),
              parent_folder_id:
                parentId
                  ? Number(parentId)
                  : null,
              name
            }
          );

        alert(
          result.message ||
          "Folder created successfully."
        );

        $("driveFolderName").value =
          "";

        await loadDriveFolders(
          rootId
        );
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to create folder."
        );
      }
    };

  /* =======================================================
     FACULTY DRIVE FOLDERS
     ======================================================= */

  async function loadFacultyDriveFolders() {
    const rootId =
      $("facultyDriveRootSelect")?.value;

    const select =
      $("facultyDriveFolderSelect");

    if (!select) return;

    if (!rootId) {
      select.innerHTML = `
        <option value="">
          Root folder
        </option>
      `;

      return;
    }

    await loadDriveFolders(
      rootId,
      "facultyDriveFolderSelect"
    );

    await loadFacultyDriveFiles();
  }

  window.loadFacultyDriveFolders =
    loadFacultyDriveFolders;

  /* =======================================================
     DRIVE FILES
     ======================================================= */

  async function loadDriveFiles(
    folderDriveId
  ) {
    const body =
      $("driveFilesBody");

    if (!body) return;

    if (!folderDriveId) {
      setTableEmpty(
        "driveFilesBody",
        5,
        "Select a folder to view files."
      );
      return;
    }

    setTableEmpty(
      "driveFilesBody",
      5,
      "Loading files..."
    );

    const {
      data,
      error
    } = await sb
      .from("drive_files")
      .select("*")
      .eq(
        "folder_drive_id",
        folderDriveId
      )
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="message error">
              ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        "driveFilesBody",
        5,
        "No files in this folder."
      );
      return;
    }

    body.innerHTML = data.map(file => `
      <tr>
        <td>
          <strong>
            ${escapeHtml(file.name)}
          </strong>
        </td>

        <td>
          ${escapeHtml(
            file.mime_type || "-"
          )}
        </td>

        <td>
          ${formatFileSize(
            file.file_size
          )}
        </td>

        <td>
          ${formatDate(
            file.created_at
          )}
        </td>

        <td>
          <div class="actions">
            ${
              file.drive_url
                ? `
                  <a
                    class="btn btn-light btn-sm"
                    href="${escapeHtml(
                      file.drive_url
                    )}"
                    target="_blank"
                    rel="noopener"
                  >
                    Open
                  </a>
                `
                : ""
            }

            <button
              class="btn btn-danger btn-sm"
              onclick="deleteDriveFile(${file.id})"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function formatFileSize(bytes) {
    if (
      bytes === null ||
      bytes === undefined ||
      bytes === ""
    ) {
      return "-";
    }

    const size =
      Number(bytes);

    if (!Number.isFinite(size)) {
      return "-";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    if (
      size <
      1024 * 1024 * 1024
    ) {
      return `${(
        size /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      size /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }

  async function loadFacultyDriveFiles() {
    const rootId =
      $("facultyDriveRootSelect")?.value;

    const folderSelect =
      $("facultyDriveFolderSelect");

    const selectedFolder =
      folderSelect?.value || "";

    if (!rootId) {
      setTableEmpty(
        "facultyDriveFilesBody",
        5,
        "Select a root folder."
      );
      return;
    }

    let folderDriveId = null;

    if (selectedFolder) {
      const {
        data,
        error
      } = await sb
        .from("drive_folders")
        .select(
          "drive_folder_id"
        )
        .eq(
          "id",
          Number(selectedFolder)
        )
        .single();

      if (error) {
        console.error(error);
        return;
      }

      folderDriveId =
        data?.drive_folder_id;
    } else {
      const {
        data,
        error
      } = await sb
        .from("drive_root_folders")
        .select(
          "drive_folder_id"
        )
        .eq(
          "id",
          Number(rootId)
        )
        .single();

      if (error) {
        console.error(error);
        return;
      }

      folderDriveId =
        data?.drive_folder_id;
    }

    await loadDriveFilesForBody(
      "facultyDriveFilesBody",
      folderDriveId
    );
  }

  async function loadDriveFilesForBody(
    bodyId,
    folderDriveId
  ) {
    const body = $(bodyId);

    if (!body) return;

    if (!folderDriveId) {
      setTableEmpty(
        bodyId,
        5,
        "Select a folder."
      );
      return;
    }

    setTableEmpty(
      bodyId,
      5,
      "Loading files..."
    );

    const {
      data,
      error
    } = await sb
      .from("drive_files")
      .select("*")
      .eq(
        "folder_drive_id",
        folderDriveId
      )
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      body.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="message error">
              ${escapeHtml(
                error.message
              )}
            </div>
          </td>
        </tr>
      `;

      return;
    }

    if (!data?.length) {
      setTableEmpty(
        bodyId,
        5,
        "No files in this folder."
      );
      return;
    }

    body.innerHTML =
      data.map(file => `
        <tr>
          <td>
            <strong>
              ${escapeHtml(file.name)}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              file.mime_type || "-"
            )}
          </td>

          <td>
            ${formatFileSize(
              file.file_size
            )}
          </td>

          <td>
            ${formatDate(
              file.created_at
            )}
          </td>

          <td>
            <div class="actions">
              ${
                file.drive_url
                  ? `
                    <a
                      class="btn btn-light btn-sm"
                      href="${escapeHtml(
                        file.drive_url
                      )}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open
                    </a>
                  `
                  : ""
              }

              <button
                class="btn btn-danger btn-sm"
                onclick="deleteDriveFile(${file.id})"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      `).join("");
  }

  window.uploadDriveFile =
    async function () {
      const rootId =
        $("driveRootSelect")?.value;

      const folderId =
        $("driveFolderSelect")?.value || "";

      const input =
        $("driveFile");

      const file =
        input?.files?.[0];

      if (!rootId) {
        alert(
          "Select a root folder."
        );
        return;
      }

      if (!file) {
        alert(
          "Select a file to upload."
        );
        return;
      }

      if (
        file.size >
        25 * 1024 * 1024
      ) {
        alert(
          "Maximum file size is 25 MB."
        );
        return;
      }

      try {
        const result =
          await driveManager(
            "upload_file",
            {
              root_id:
                Number(rootId),
              folder_id:
                folderId
                  ? Number(folderId)
                  : null
            },
            file
          );

        alert(
          result.message ||
          "File uploaded successfully."
        );

        input.value = "";

        let folderDriveId = null;

        if (folderId) {
          const {
            data
          } = await sb
            .from("drive_folders")
            .select(
              "drive_folder_id"
            )
            .eq(
              "id",
              Number(folderId)
            )
            .single();

          folderDriveId =
            data?.drive_folder_id;
        } else {
          const {
            data
          } = await sb
            .from("drive_root_folders")
            .select(
              "drive_folder_id"
            )
            .eq(
              "id",
              Number(rootId)
            )
            .single();

          folderDriveId =
            data?.drive_folder_id;
        }

        await loadDriveFiles(
          folderDriveId
        );
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to upload file."
        );
      }
    };

  window.uploadFacultyDriveFile =
    async function () {
      const rootId =
        $("facultyDriveRootSelect")?.value;

      const folderId =
        $("facultyDriveFolderSelect")?.value || "";

      const input =
        $("facultyDriveFile");

      const file =
        input?.files?.[0];

      if (!rootId) {
        alert(
          "Select a root folder."
        );
        return;
      }

      if (!file) {
        alert(
          "Select a file to upload."
        );
        return;
      }

      if (
        file.size >
        25 * 1024 * 1024
      ) {
        alert(
          "Maximum file size is 25 MB."
        );
        return;
      }

      try {
        const result =
          await driveManager(
            "upload_file",
            {
              root_id:
                Number(rootId),
              folder_id:
                folderId
                  ? Number(folderId)
                  : null
            },
            file
          );

        alert(
          result.message ||
          "File uploaded successfully."
        );

        input.value = "";

        await loadFacultyDriveFiles();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to upload file."
        );
      }
    };

  window.createFacultyDriveFolder =
    async function () {
      const rootId =
        $("facultyDriveRootSelect")?.value;

      const parentId =
        $("facultyDriveFolderSelect")?.value || "";

      const name =
        $("facultyDriveFolderName")
          ?.value.trim();

      if (!rootId) {
        alert(
          "Select a root folder."
        );
        return;
      }

      if (!name) {
        alert(
          "Enter a folder name."
        );
        return;
      }

      try {
        const result =
          await driveManager(
            "create_folder",
            {
              root_id:
                Number(rootId),
              parent_folder_id:
                parentId
                  ? Number(parentId)
                  : null,
              name
            }
          );

        alert(
          result.message ||
          "Folder created successfully."
        );

        $("facultyDriveFolderName")
          .value = "";

        await loadFacultyDriveFolders();
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to create folder."
        );
      }
    };

  window.deleteDriveFile =
    async function (fileId) {
      if (
        !confirm(
          "Delete this file from Google Drive?"
        )
      ) {
        return;
      }

      try {
        const result =
          await driveManager(
            "delete_file",
            {
              file_id:
                Number(fileId)
            }
          );

        alert(
          result.message ||
          "File deleted successfully."
        );

        await loadFacultyDriveFiles();

        const rootId =
          $("driveRootSelect")?.value;

        const folderId =
          $("driveFolderSelect")?.value;

        if (rootId) {
          let driveFolderId = null;

          if (folderId) {
            const {
              data
            } = await sb
              .from("drive_folders")
              .select(
                "drive_folder_id"
              )
              .eq(
                "id",
                Number(folderId)
              )
              .single();

            driveFolderId =
              data?.drive_folder_id;
          } else {
            const {
              data
            } = await sb
              .from("drive_root_folders")
              .select(
                "drive_folder_id"
              )
              .eq(
                "id",
                Number(rootId)
              )
              .single();

            driveFolderId =
              data?.drive_folder_id;
          }

          await loadDriveFiles(
            driveFolderId
          );
        }
      } catch (error) {
        console.error(error);

        alert(
          error.message ||
          "Unable to delete file."
        );
      }
    };

  /* =======================================================
     DRIVE SELECT EVENTS
     ======================================================= */

  function initializeDriveEvents() {
    const rootSelect =
      $("driveRootSelect");

    if (rootSelect) {
      rootSelect.addEventListener(
        "change",
        async () => {
          await loadDriveFolders(
            rootSelect.value
          );

          const folder =
            $("driveFolderSelect");

          if (folder) {
            folder.dispatchEvent(
              new Event("change")
            );
          }
        }
      );
    }

    const folderSelect =
      $("driveFolderSelect");

    if (folderSelect) {
      folderSelect.addEventListener(
        "change",
        async () => {
          const rootId =
            $("driveRootSelect")?.value;

          const folderId =
            folderSelect.value;

          if (!rootId) return;

          let driveFolderId = null;

          if (folderId) {
            const {
              data
            } = await sb
              .from("drive_folders")
              .select(
                "drive_folder_id"
              )
              .eq(
                "id",
                Number(folderId)
              )
              .single();

            driveFolderId =
              data?.drive_folder_id;
          } else {
            const {
              data
            } = await sb
              .from("drive_root_folders")
              .select(
                "drive_folder_id"
              )
              .eq(
                "id",
                Number(rootId)
              )
              .single();

            driveFolderId =
              data?.drive_folder_id;
          }

          await loadDriveFiles(
            driveFolderId
          );
        }
      );
    }

    const facultyRoot =
      $("facultyDriveRootSelect");

    if (facultyRoot) {
      facultyRoot.addEventListener(
        "change",
        async () => {
          await loadFacultyDriveFolders();
        }
      );
    }

    const facultyFolder =
      $("facultyDriveFolderSelect");

    if (facultyFolder) {
      facultyFolder.addEventListener(
        "change",
        async () => {
          await loadFacultyDriveFiles();
        }
      );
    }
  }

  /* =======================================================
     TAB EVENTS
     ======================================================= */

  function initializeTabs() {
    qsa(".tab").forEach(tab => {
      tab.addEventListener(
        "click",
        () => {
          qsa(".tab").forEach(item => {
            item.classList.remove(
              "active"
            );
          });

          qsa(".tab-panel").forEach(
            panel => {
              panel.classList.remove(
                "active"
              );
            }
          );

          tab.classList.add("active");

          const panelId =
            tab.dataset.panel;

          if (panelId) {
            const panel =
              $(panelId);

            if (panel) {
              panel.classList.add(
                "active"
              );
            }
          }
        }
      );
    });
  }

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  async function initializePage() {
    initializeTabs();
    initializeDriveEvents();

    /*
     * Faculty login
     */
    const facultyLoginForm =
      $("facultyLoginForm");

    if (facultyLoginForm) {
      facultyLoginForm.addEventListener(
        "submit",
        facultyLogin
      );
    }

    /*
     * Faculty registration
     */
    const facultyRegisterForm =
      $("facultyRegisterForm");

    if (facultyRegisterForm) {
      facultyRegisterForm.addEventListener(
        "submit",
        facultyRegister
      );
    }

    /*
     * Admin login
     */
    const adminLoginForm =
      $("adminLoginForm");

    if (adminLoginForm) {
      adminLoginForm.addEventListener(
        "submit",
        adminLogin
      );

      generateCaptcha();
    }

    const refreshCaptcha =
      $("refreshCaptcha");

    if (refreshCaptcha) {
      refreshCaptcha.addEventListener(
        "click",
        generateCaptcha
      );
    }

    /*
     * Student guest login
     */
    const studentGuestForm =
      $("studentGuestForm");

    if (studentGuestForm) {
      studentGuestForm.addEventListener(
        "submit",
        studentGuestLogin
      );
    }

    /*
     * Book form
     */
    const bookForm =
      $("bookForm");

    if (bookForm) {
      bookForm.addEventListener(
        "submit",
        saveBook
      );
    }

    /*
     * Category form
     */
    const categoryForm =
      $("categoryForm");

    if (categoryForm) {
      categoryForm.addEventListener(
        "submit",
        saveCategory
      );
    }

    /*
     * Catalogue
     */
    if ($("catalogueBody")) {
      await loadCategories(
        "catalogCategory"
      );

      await window.loadCatalogue();
    }

    if ($("catalogSearch")) {
      $("catalogSearch")
        .addEventListener(
          "input",
          window.loadCatalogue
        );
    }

    if ($("catalogCategory")) {
      $("catalogCategory")
        .addEventListener(
          "change",
          window.loadCatalogue
        );
    }

    if ($("catalogAvailability")) {
      $("catalogAvailability")
        .addEventListener(
          "change",
          window.loadCatalogue
        );
    }

    /*
     * Student dashboard
     */
    if (
      $("studentTotalBooks") ||
      $("studentDisplayName")
    ) {
      initializeStudentDashboard();
    }

    /*
     * Admin dashboard
     */
    if (
      $("adminWelcome") ||
      $("totalBooks") ||
      $("booksTableBody")
    ) {
      const session =
        await requireLogin();

      if (!session) return;

      if (
        !(await isAdminUser(
          session.user.id
        ))
      ) {
        window.location.href =
          "faculty-dashboard.html";
        return;
      }

      const {
        data: admin
      } = await sb
        .from("admin_profiles")
        .select(
          "name,email"
        )
        .eq(
          "id",
          session.user.id
        )
        .maybeSingle();

      if ($("adminWelcome")) {
        $("adminWelcome").textContent =
          admin?.name ||
          "Administrator";
      }

      await loadAdminStats();

      if ($("booksTableBody")) {
        await loadAdminBooks();
      }

      if ($("categoriesBody")) {
        await loadAdminCategories();
      }

      if ($("facultyRequestsBody")) {
        await loadFacultyRequests();
      }

      if ($("bookRequestsBody")) {
        await loadAdminBookRequests();
      }

      if ($("returnRequestsBody")) {
        await loadAdminReturnRequests();
      }

      if ($("driveRootsBody")) {
        await loadDriveRoots();
      }
    }

    /*
     * Faculty dashboard
     */
    if (
      $("facultyWelcome") ||
      $("facultyBorrowedBody")
    ) {
      await loadFacultyDashboard();
    }

    /*
     * Drive panels
     */
    if ($("facultyDriveRootSelect")) {
      await loadDriveRoots(
        "facultyDriveRootSelect"
      );
    }
  }

  /* =======================================================
     AUTH STATE
     ======================================================= */

  sb.auth.onAuthStateChange(
    (event, session) => {
      console.log(
        "MatLib auth event:",
        event
      );
    }
  );

  /*
   * Start after DOM is ready.
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializePage
    );
  } else {
    initializePage();
  }
})();