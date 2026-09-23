(() => {
  'use strict';

  const sb = window.matlibSupabase || window.matlib?.sb;
  const $ = id => document.getElementById(id);
  const $$ = sel => [...document.querySelectorAll(sel)];

  if (!sb) {
    console.error('MatLib: Supabase client missing at initial load. Retrying after config.js loads...');
    window.addEventListener('matlib:supabase-ready', () => location.reload(), { once: true });
    window.setTimeout(() => {
      if (!(window.matlibSupabase || window.matlib?.sb)) {
        const el = document.getElementById('systemStatus');
        if (el) { el.textContent = 'Connection error'; el.classList.add('error'); }
        const note = document.createElement('div');
        note.className = 'matlib-fatal-error';
        note.textContent = 'Supabase client is not available. Check assets/config.js.';
        document.body.appendChild(note);
      }
    }, 1200);
    return;
  }

  const state = {
    admin: null,
    books: [],
    categories: [],
    faculty: [],
    borrow: [],
    filteredHistory: [],
    filteredBorrowing: [],
    drive: { roots: [], folders: [], files: [], path: [] },
    calendar: { month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), events: [], filtered: [], selectedStart: null, selectedEnd: null },
    analytics: { book: [], faculty: [], status: [], category: [] },
    bookImportRows: [],
    driveView: 'grid',
    bookPage: 1,
    bookPageSize: 24,
    selectedFaculty: null,
    issueBook: null,
    editBook: null,
    deleteBook: null,
    pendingAnalytics: null,
    driveMoveItem: null,
    activeIssued: [],
    facultyDetail: null,
    facultyDetailExport: []
  };

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const fmt = v => v ? new Date(v).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const dt = v => v ? new Date(v).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const addDays = (iso, days) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + Number(days || 0)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const errText = e => e?.message || e?.details || e?.hint || String(e || 'Unknown error');
  const setText = (id, value) => { const e = $(id); if (e) e.textContent = value; };
  const bind = (id, event, fn) => { const e = $(id); if (!e) return; if (typeof event === 'function' && fn === undefined) { fn = event; event = 'click'; } if (typeof fn !== 'function') return; e.addEventListener(event, fn); };
  const categoryName = id => state.categories.find(c => String(c.id) === String(id))?.name || '';
  const available = b => String(b?.availability) === '1' || String(b?.availability).toLowerCase() === 'true' || String(b?.status || '').toLowerCase() === 'available';
  const bookMatch = (b, q) => {
    q = String(q || '').trim().toLowerCase();
    if (!q) return true;
    return [b.book_name, b.author_name, b.access_no, b.category, b.cupboard_no, categoryName(b.category_id)]
      .some(v => String(v || '').toLowerCase().includes(q));
  };

  function toast(text, type = 'ok') {
    const e = $('message');
    if (!e) return;
    e.textContent = text;
    e.className = `message show ${type}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => e.className = 'message', 4500);
  }

  function showSection(id) {
    $$('.dashboard-section').forEach(s => s.classList.toggle('active', s.id === id));
    $$('#nav .nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
    const active = document.querySelector(`#nav .nav-item[data-section="${CSS.escape(id)}"]`);
    setText('pageTitle', active?.querySelector('span')?.textContent || id);
    if (innerWidth <= 900) $('sidebar')?.classList.remove('open');
    const loaders = {
      dashboard: updateStats,
      issue: prepareIssue,
      return: prepareReturn,
      browse: renderBookCatalogue,
      addBook: prepareAdd,
      editBook: prepareEdit,
      deleteBook: prepareDelete,
      activeIssued: loadActiveIssued,
      deleteFaculty: prepareDeleteFaculty,
      searchFaculty: prepareSearchFaculty,
      deleteBorrowHistory: prepareDeleteBorrowHistory,
      deleteStudentLogs: prepareDeleteStudentLogs,
      documents: loadDocuments,
      bookRequests: loadBookRequests,
      returnRequests: loadReturnRequests,
      facultyRequests: loadFacultyRequests,
      bookHistory: loadBookHistory,
      facultyHistory: loadFacultyHistory,
      mailHistory: loadMailHistory,
      bookRejections: loadBookRejections,
      facultyRejections: loadFacultyRejections,
      studentLogs: loadStudentLogs,
      studentDocuments: loadStudentDocumentHistory,
      categories: loadCategories,
      categoryBrowse: loadCategories,
      overdue: loadOverdue,
      borrowing: loadBorrowing,
      analytics: loadAnalytics,
      calendar: loadCalendar
    };
    if (loaders[id]) Promise.resolve(loaders[id]()).catch(e => { console.error(e); toast(errText(e), 'error'); });
  }

  async function requireAdmin() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data.session) { location.href = 'admin.html'; return false; }
    const r = await sb.from('admin_profiles').select('id,name,email,phone,role,is_active').eq('id', data.session.user.id).maybeSingle();
    if (r.error) {
      console.warn('Admin profile read failed; continuing with auth session:', r.error);
      state.admin = {id:data.session.user.id,name:data.session.user.user_metadata?.name||'Administrator',email:data.session.user.email||'',phone:data.session.user.user_metadata?.phone||'',role:'admin',is_active:true};
    } else {
      if (!r.data || !r.data.is_active || r.data.role !== 'admin') {
        await sb.auth.signOut(); location.href = 'admin.html'; return false;
      }
      state.admin = r.data;
    }
    setText('adminName', state.admin.name || 'Administrator');
    setText('welcome', state.admin.name || 'Administrator');
    setText('avatar', (state.admin.name || 'A').trim()[0]?.toUpperCase() || 'A'); setText('headerAvatar', (state.admin.name || 'A').trim()[0]?.toUpperCase() || 'A');
    setText('systemStatus', 'System Online');
    $('systemStatus')?.classList.add('online');
    return true;
  }

  async function passwordCheck(password) {
    if (!password) return false;
    const { data } = await sb.auth.getSession();
    const email = data?.session?.user?.email;
    if (!email) { toast('Admin session expired. Sign in again.', 'error'); return false; }
    const r = await sb.auth.signInWithPassword({ email, password });
    if (r.error) { toast('Incorrect administrator password.', 'error'); return false; }
    return true;
  }

  async function loadCategories() {
    const r = await sb.from('categories').select('id,name').order('name');
    if (r.error) throw r.error;
    state.categories = r.data || [];
    const ids = ['addCategory','editCategory','bookCategory','bhCategory','borrowCategory','categoryBrowseSelect','activeIssuedCategory'];
    ids.forEach(id => {
      const s = $(id); if (!s) return;
      const cur = s.value;
      const first = id === 'addCategory' ? '<option value="">Choose category first</option>' : '<option value="">All categories</option>';
      s.innerHTML = first + state.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      if ([...s.options].some(o => o.value === cur)) s.value = cur;
    });
    renderCategories();
    renderCategoryBrowse();
    updateFilterSuggestions();
  }

  async function loadBooks() {
    // IMPORTANT:
    // Supabase/PostgREST can return only a limited number of rows per request.
    // fetchAllBooks() loads the books in 1000-row pages so the admin catalogue
    // receives the complete books table instead of only the first 1000 rows.
    state.books = await fetchAllBooks();

    setText('bookCount', state.books.length.toLocaleString('en-IN'));
    setText('sBooks', state.books.length.toLocaleString('en-IN'));
    setText('booksTotalLabel', `${state.books.length.toLocaleString('en-IN')} books`);

    renderBookCatalogue();
    renderCategories();
    renderCategoryBrowse();
    updateFilterSuggestions();
  }

  function updateFilterSuggestions() {
    const unique = arr => [...new Set(arr.filter(Boolean).map(String))].sort((a,b) => a.localeCompare(b));
    const authors = unique(state.books.map(b => b.author_name));
    const titles = unique(state.books.map(b => b.book_name));
    const faculty = unique(state.faculty.map(f => f.name));
    const facultyIds = unique(state.faculty.map(f => f.faculty_id));
    const categories = unique(state.categories.map(c => c.name));
    const fill = (id, values) => { const d = $(id); if (d) d.innerHTML = values.slice(0, 1000).map(v => `<option value="${esc(v)}"></option>`).join(''); };
    fill('authorSuggestions', authors);
    fill('topicSuggestions', titles);
    fill('facultySuggestionsList', faculty);
    fill('facultyIdSuggestions', facultyIds);
    fill('categorySuggestions', categories);
    fill('calendarSuggestions', [...titles, ...faculty, ...categories]);
    fill('docSuggestions', [...state.drive.files.map(f=>f.name), ...state.drive.folders.map(f=>f.name)]);
    fill('activeIssuedSuggestions', [...state.activeIssued.map(x=>x.book_name), ...state.activeIssued.map(x=>x.access_no), ...state.activeIssued.map(x=>x.faculty_name), ...state.activeIssued.map(x=>x.faculty_id_text)]);
  }

  function renderBookCatalogue() {
    const grid = $('booksCatalogGrid');
    if (!grid) return;
    const q = $('bookSearch')?.value || '';
    const cat = $('bookCategory')?.value || '';
    const st = ($('bookStatus')?.value || '').toLowerCase();
    const rows = state.books.filter(b => bookMatch(b, q) && (!cat || String(b.category_id) === cat) && (!st || String(b.status || '').toLowerCase() === st));
    const pages = Math.max(1, Math.ceil(rows.length / state.bookPageSize));
    state.bookPage = Math.min(state.bookPage, pages);
    const start = (state.bookPage - 1) * state.bookPageSize;
    const pageRows = rows.slice(start, start + state.bookPageSize);
    setText('booksResultCount', `${rows.length.toLocaleString('en-IN')} books`);
    if (!pageRows.length) {
      grid.innerHTML = '<div class="catalog-empty">No books found.</div>';
    } else {
      grid.innerHTML = pageRows.map(b => `
        <article class="admin-book-card" data-view-book="${b.id}">
          <div class="book-card-cover">
            <span class="book-cover-mark">√x</span>
            <small>${esc((b.category || categoryName(b.category_id) || 'BOOK').slice(0, 18))}</small>
          </div>
          <div class="book-card-body">
            <div class="book-card-status"><span class="badge ${available(b) ? 'available' : 'issued'}">${available(b) ? 'Available' : 'Issued'}</span><code>${esc(b.access_no || '—')}</code></div>
            <h3>${esc(b.book_name || 'Untitled')}</h3>
            <p>${esc(b.author_name || 'Unknown author')}</p>
            <div class="book-card-meta"><span>${esc(b.category || categoryName(b.category_id) || '—')}</span><span>⌂ ${esc(b.cupboard_no || '—')}</span></div>
            <button type="button" class="btn secondary tiny" data-view-book="${b.id}">View details</button>
          </div>
        </article>
      `).join('');
    }
    const pager = $('booksPager');
    if (pager) {
      pager.innerHTML = pages > 1 ? `<button class="btn secondary tiny" id="booksPrev" ${state.bookPage===1?'disabled':''}>←</button><span>Page ${state.bookPage} of ${pages}</span><button class="btn secondary tiny" id="booksNext" ${state.bookPage===pages?'disabled':''}>→</button>` : '';
      bind('booksPrev','click',()=>{state.bookPage--;renderBookCatalogue();});
      bind('booksNext','click',()=>{state.bookPage++;renderBookCatalogue();});
    }
  }

  async function lookupBookByAccess(access) {
    access = String(access || '').trim();
    if (!access) return null;
    const local = state.books.find(b => String(b.access_no || '').toLowerCase() === access.toLowerCase());
    if (local) return local;
    const r = await sb.from('books').select('id,book_name,author_name,category,cupboard_no,status,created_at,updated_at,category_id,access_no,availability').ilike('access_no', access).maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }

  function renderBookPreview(id, b, extra = '') {
    const e = $(id); if (!e) return;
    if (!b) { e.classList.add('hidden'); e.innerHTML = ''; return; }
    e.classList.remove('hidden');
    e.innerHTML = `<div class="preview-icon">▥</div><div><strong>${esc(b.book_name)}</strong><span>${esc(b.author_name || 'Unknown author')} · ${esc(b.category || categoryName(b.category_id) || 'No category')} · ${esc(b.access_no || '—')}</span>${extra}</div>`;
  }

  async function prepareIssue() {
    if (!state.books.length) await loadBooks();
    if (!state.faculty.length) await loadFacultyData();
    const issueDate = $('issueDate');
    if (issueDate && !issueDate.value) issueDate.value = isoToday();
    const dueDays = $('issueDueDays');
    if (dueDays && !dueDays.value) dueDays.value = '90';
    updateDueDateFromDays();
  }

  async function prepareReturn() { if (!state.books.length) await loadBooks(); if (!state.faculty.length) await loadFacultyData(); }

  async function loadFacultyData() {
    const r = await sb.from('faculty_profiles').select('id,name,faculty_id,email,designation,approval_status,is_active').eq('approval_status','approved').eq('is_active',true).order('name');
    if (r.error) throw r.error;
    state.faculty = r.data || [];
    updateFilterSuggestions();
  }

  function renderFacultySuggestions() {
    const q = String($('issueFacultySearch')?.value || '').trim().toLowerCase();
    const box = $('facultySuggestions'); if (!box) return;
    if (!q) { box.classList.add('hidden'); return; }
    const rows = state.faculty.filter(f => `${f.name} ${f.faculty_id} ${f.email}`.toLowerCase().includes(q)).slice(0, 10);
    box.innerHTML = rows.length ? rows.map(f => `<button type="button" data-select-faculty="${esc(f.id)}"><strong>${esc(f.name)}</strong><span>${esc(f.faculty_id)} · ${esc(f.email)}</span></button>`).join('') : '<div class="suggestion-empty">No approved faculty found.</div>';
    box.classList.remove('hidden');
  }

  function selectFaculty(id) {
    state.selectedFaculty = state.faculty.find(f => String(f.id) === String(id)) || null;
    const chip = $('selectedFaculty');
    if (!chip) return;
    if (state.selectedFaculty) {
      chip.innerHTML = `<strong>${esc(state.selectedFaculty.name)}</strong><span>${esc(state.selectedFaculty.faculty_id)} · ${esc(state.selectedFaculty.email)}</span><button type="button" id="clearFaculty">×</button>`;
      chip.classList.remove('hidden');
      $('issueFacultySearch').value = '';
      $('facultySuggestions').classList.add('hidden');
      bind('clearFaculty','click',()=>{state.selectedFaculty=null;chip.classList.add('hidden');});
    }
  }

  function updateDueDateFromDays() {
    const issueDate = $('issueDate')?.value;
    const dueDays = Number($('issueDueDays')?.value || 90);
    const due = $('issueDue');
    if (!due || !issueDate || !Number.isFinite(dueDays) || dueDays < 0) return;
    due.value = addDays(issueDate, dueDays);
  }

  async function lookupIssueBook() {
    try {
      const b = await lookupBookByAccess($('issueAccession').value);
      state.issueBook = b;
      renderBookPreview('issueBookPreview', b, b && !available(b) ? '<em class="danger-text">Currently issued — cannot issue again.</em>' : '');
    } catch (e) { toast(errText(e), 'error'); }
  }

  async function issueBook() {
    try {
      const access = $('issueAccession').value.trim();
      const issueDate = $('issueDate').value;
      const dueDays = Number($('issueDueDays').value || 90);
      if (!access) return toast('Enter an access number.', 'error');
      state.issueBook = await lookupBookByAccess(access);
      if (!state.issueBook) return toast('Access number not found.', 'error');
      if (!available(state.issueBook)) return toast('This book is currently issued.', 'error');
      if (!state.selectedFaculty) return toast('Select an approved faculty member.', 'error');
      if (!issueDate || issueDate > isoToday()) return toast('Issue date cannot be in the future.', 'error');
      if (!Number.isInteger(dueDays) || dueDays < 0) return toast('Enter a valid due period in days.', 'error');
      const due = addDays(issueDate, dueDays);
      $('issueDue').value = due;

      const rpc = await sb.rpc('admin_issue_book_with_date', {
        p_accession_no: access,
        p_faculty_id: state.selectedFaculty.id,
        p_issued_at: `${issueDate}T12:00:00+05:30`,
        p_due_date: due
      });
      if (rpc.error) {
        // Keep compatibility with the existing RPC when the new SQL has not been run yet.
        if (issueDate === isoToday()) {
          const fallback = await sb.rpc('admin_issue_book', { p_accession_no: access, p_faculty_id: state.selectedFaculty.id, p_due_date: due });
          if (fallback.error) throw rpc.error;
        } else throw rpc.error;
      }
      toast(`Issued ${state.issueBook.book_name} to ${state.selectedFaculty.name}.`);
      $('issueAccession').value = '';
      $('issueBookPreview').classList.add('hidden');
      $('issueFacultySearch').value = '';
      $('selectedFaculty').classList.add('hidden');
      state.selectedFaculty = null;
      await Promise.all([loadBooks(), updateStats(), loadBookHistory()]);
    } catch (e) { toast(errText(e), 'error'); }
  }

  let returnBookObj = null;
  async function lookupReturn() {
    try {
      returnBookObj = await lookupBookByAccess($('returnAccession').value);
      const p = $('returnPreview');
      if (!returnBookObj) { p.classList.add('hidden'); p.innerHTML = ''; return; }
      const r = await sb.from('borrow_records').select('id,faculty_id,student_name,student_roll_no,issued_at,due_date,status').eq('book_id', returnBookObj.id).eq('status','Issued').order('issued_at',{ascending:false}).limit(1).maybeSingle();
      if (r.error) throw r.error;
      const f = r.data?.faculty_id ? state.faculty.find(x => String(x.id) === String(r.data.faculty_id)) : null;
      p.innerHTML = `<strong>${esc(returnBookObj.book_name)}</strong><span>Access ${esc(returnBookObj.access_no||'—')} · ${available(returnBookObj)?'Available':'Currently issued'}</span>${r.data?`<small>Issued to: ${esc(f?.name||r.data.student_name||r.data.student_roll_no||'Unknown')} · Due ${fmt(r.data.due_date)}</small>`:'<small>No active borrow record found.</small>'}`;
      p.classList.remove('hidden');
    } catch (e) { toast(errText(e), 'error'); }
  }

  async function returnBook() {
    try {
      const access = $('returnAccession').value.trim();
      if (!access) return toast('Enter an access number.', 'error');
      const b = await lookupBookByAccess(access);
      if (!b) return toast('Access number not found.', 'error');
      if (available(b)) return toast('This book is already available.', 'error');
      const r = await sb.rpc('admin_return_book', { p_accession_no: access });
      if (r.error) throw r.error;
      toast('Book returned successfully.');
      $('returnAccession').value = ''; $('returnPreview').classList.add('hidden');
      await Promise.all([loadBooks(), updateStats(), loadBookHistory(), loadBorrowing()]);
    } catch (e) { toast(errText(e), 'error'); }
  }

  function suggestAccess(categoryId) {
    const same = state.books.filter(b => String(b.category_id) === String(categoryId) && b.access_no);
    let best = null, max = -1;
    for (const b of same) {
      const m = String(b.access_no).match(/^(.*?)(\d+)$/);
      if (m) { const n = Number(m[2]); if (n > max) { max = n; best = { prefix:m[1], digits:m[2].length }; } }
    }
    if (best) return best.prefix + String(max + 1).padStart(best.digits, '0');
    const cat = categoryName(categoryId).replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3) || 'BOOK';
    let n = 1; while (state.books.some(b => String(b.access_no||'').toUpperCase() === `${cat}${String(n).padStart(3,'0')}`)) n++;
    return `${cat}${String(n).padStart(3,'0')}`;
  }

  async function prepareAdd() { if (!state.categories.length) await loadCategories(); if (!state.books.length) await loadBooks(); }
  async function addBook() {
    try {
      const cat = $('addCategory').value;
      if (!cat) return toast('Choose a category first.', 'error');
      const payload = { book_name:$('addName').value.trim(), author_name:$('addAuthor').value.trim()||null, access_no:$('addAccess').value.trim(), cupboard_no:$('addCupboard').value.trim()||null, category_id:Number(cat), category:categoryName(cat), status:$('addStatus').value, availability:$('addStatus').value==='available'?1:0 };
      if (!payload.book_name || !payload.access_no) return toast('Book name and access number are required.', 'error');
      if (state.books.some(b => String(b.access_no||'').toLowerCase() === payload.access_no.toLowerCase())) return toast('That access number is already used.', 'error');
      const r = await sb.from('books').insert(payload); if (r.error) throw r.error;
      toast('Book added successfully.'); ['addName','addAuthor','addCupboard','addAccess'].forEach(id=>$(id).value=''); $('addCategory').value=''; await loadBooks(); await updateStats();
    } catch(e){toast(errText(e),'error');}
  }

  const BOOK_IMPORT_REQUIRED = ['book_name','author_name','category','cupboard_no','access_no'];
  function cleanImportHeader(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,'_');}
  function importValue(v){return v===undefined||v===null?'':String(v).trim();}
  function renderBookImportPreview(rows,errors=[]){
    const box=$('bookImportPreview');if(!box)return;
    box.classList.remove('hidden');
    if(errors.length){box.innerHTML=`<div class="import-error"><strong>Upload rejected</strong><ul>${errors.slice(0,20).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;return;}
    const shown=rows.slice(0,12);
    box.innerHTML=`<div class="import-preview-head"><div><strong>${rows.length} book${rows.length===1?'':'s'} ready to upload</strong><small>Category is read from the Excel/CSV file. category_id is filled automatically from the category name. All new books are added as Available; ID, created_at, updated_at and availability are generated automatically.</small></div><button id="confirmBookImport" class="btn primary">Upload ${rows.length} Books</button></div><div class="table-wrap import-preview-table"><table class="data-table"><thead><tr><th>Book Name</th><th>Author</th><th>Category</th><th>Cupboard</th><th>Category ID</th><th>Access No.</th></tr></thead><tbody>${shown.map(r=>`<tr><td>${esc(r.book_name)}</td><td>${esc(r.author_name)}</td><td>${esc(r.category)}</td><td>${esc(r.cupboard_no)}</td><td>${esc(r.category_id)}</td><td><code>${esc(r.access_no)}</code></td></tr>`).join('')}</tbody></table></div>${rows.length>shown.length?`<small class="hint">Showing first ${shown.length} rows of ${rows.length}.</small>`:''}`;
    bind('confirmBookImport','click',uploadBookImport);
  }
  async function previewBookImport(file){
    if(!file)return;
    try{
      if(!window.XLSX)throw new Error('Excel library is still loading. Try again.');
      if(file.size>10*1024*1024)throw new Error('Excel/CSV file must be 10 MB or smaller.');
      if(!state.categories.length) await loadCategories();
      const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array'});const sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error('No worksheet found.');
      const raw=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});if(!raw.length)throw new Error('The file contains no book rows.');
      const originalHeaders=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:false})[0]||[];const headers=originalHeaders.map(cleanImportHeader);const missing=BOOK_IMPORT_REQUIRED.filter(k=>!headers.includes(k));
      if(missing.length){renderBookImportPreview([],[`Missing required columns: ${missing.join(', ')}`]);return;}
      const seen=new Set(),errors=[],rows=[];
      for(let i=0;i<raw.length;i++){
        const line=i+2,row={};headers.forEach((h,j)=>{row[h]=importValue(raw[i][originalHeaders[j]]);});
        for(const k of BOOK_IMPORT_REQUIRED)if(!row[k])errors.push(`Row ${line}: ${k} cannot be empty.`);
        const access=row.access_no;
        if(access){const key=access.toLowerCase();if(seen.has(key))errors.push(`Row ${line}: duplicate access_no ${access} in this file.`);seen.add(key);if(state.books.some(b=>String(b.access_no||'').toLowerCase()===key))errors.push(`Row ${line}: access_no ${access} already exists.`);}
        const cat=state.categories.find(c=>String(c.name||'').trim().toLowerCase()===String(row.category||'').trim().toLowerCase());
        if(!cat) errors.push(`Row ${line}: category "${row.category}" was not found in MatLib categories.`);
        rows.push({book_name:row.book_name,author_name:row.author_name,cupboard_no:row.cupboard_no,access_no:row.access_no,category:cat?.name||row.category,category_id:cat?Number(cat.id):null});
      }
      state.bookImportRows=errors.length?[]:rows;
      renderBookImportPreview(rows,errors);
    }catch(e){console.error(e);toast(errText(e),'error');}
  }
  async function uploadBookImport(){
    const rows=state.bookImportRows||[];if(!rows.length)return toast('No validated books to upload.','error');
    try{
      const now=new Date().toISOString();const payload=rows.map(r=>({...r,status:'available',availability:1,created_at:now,updated_at:now}));
      const r=await sb.from('books').insert(payload);if(r.error)throw r.error;
      toast(`${rows.length} books added successfully as Available.`);state.bookImportRows=[];$('bookImportPreview')?.classList.add('hidden');$('bookImportFile').value='';await loadBooks();await updateStats();
    }catch(e){toast(errText(e),'error');}
  }

  async function prepareEdit(){if(!state.categories.length) await loadCategories();}
  async function lookupEdit(){
    try {
      const b = await lookupBookByAccess($('editLookupAccess').value); state.editBook=b;
      renderBookPreview('editLookupPreview', b, b ? `<small>Status: ${esc(b.status)} · Cupboard: ${esc(b.cupboard_no||'—')}</small>` : '');
      const fields=$('editFields'),save=$('editSaveBtn');
      if(!b){fields?.classList.add('hidden');save?.classList.add('hidden');$('editPasswordArea')?.classList.add('hidden');return;}
      fields.classList.remove('hidden');save.classList.remove('hidden');$('editPasswordArea')?.classList.remove('hidden');
      $('editId').value=b.id;$('editName').value=b.book_name||'';$('editAuthor').value=b.author_name||'';$('editAccess').value=b.access_no||'';$('editCupboard').value=b.cupboard_no||'';$('editCategory').value=b.category_id?String(b.category_id):'';$('editStatus').value=String(b.status||'available').toLowerCase();
    } catch(e){toast(errText(e),'error');}
  }
  async function saveEdit(){
    try {
      if(!state.editBook)return toast('Enter a valid access number first.','error');
      if(!(await passwordCheck($('editPassword')?.value||'')))return;
      const cat=$('editCategory').value;const payload={book_name:$('editName').value.trim(),author_name:$('editAuthor').value.trim()||null,access_no:$('editAccess').value.trim(),cupboard_no:$('editCupboard').value.trim()||null,category_id:cat?Number(cat):null,category:cat?categoryName(cat):null,status:$('editStatus').value,availability:$('editStatus').value==='available'?1:0};
      if(!payload.book_name||!payload.access_no)return toast('Book name and access number are required.','error');
      const duplicate=state.books.find(b=>String(b.id)!==String(state.editBook.id)&&String(b.access_no||'').toLowerCase()===payload.access_no.toLowerCase());if(duplicate)return toast('That access number is already used.','error');
      const r=await sb.from('books').update(payload).eq('id',state.editBook.id);if(r.error)throw r.error;toast('Book updated successfully.');$('editPassword').value='';await loadBooks();await lookupEdit();
    }catch(e){toast(errText(e),'error');}
  }

  async function prepareDelete(){if(!state.books.length)await loadBooks();}
  async function lookupDelete(){try{const b=await lookupBookByAccess($('deleteAccess').value);state.deleteBook=b;renderBookPreview('deletePreview',b,b?`<small>Status: ${esc(b.status)} · Category: ${esc(b.category||categoryName(b.category_id)||'—')} · Cupboard: ${esc(b.cupboard_no||'—')}</small>`:'');$('deleteConfirmArea').classList.toggle('hidden',!b);}catch(e){toast(errText(e),'error');}}
  async function confirmDelete(){try{if(!state.deleteBook)return toast('Enter a valid access number.','error');if($('deleteConfirmText').value.trim()!=='CONFIRM')return toast('Type CONFIRM exactly.','error');if(!(await passwordCheck($('deletePassword').value)))return;const r=await sb.rpc('admin_delete_book',{p_book_id:Number(state.deleteBook.id)});if(r.error)throw r.error;toast('Book deleted successfully.');['deleteAccess','deleteConfirmText','deletePassword'].forEach(id=>$(id).value='');$('deleteConfirmArea').classList.add('hidden');$('deletePreview').classList.add('hidden');state.deleteBook=null;await loadBooks();await updateStats();}catch(e){toast(errText(e),'error');}}

  function openDrawer(b){
    $('drawerTitle').textContent=b.book_name||'Book';
    $('drawerBody').innerHTML=`<div class="drawer-cover">▥</div><div class="drawer-meta"><span class="badge ${available(b)?'available':'issued'}">${available(b)?'Available':'Issued'}</span><code>${esc(b.access_no||'—')}</code></div><div class="drawer-grid"><div><small>AUTHOR</small><strong>${esc(b.author_name||'—')}</strong></div><div><small>CATEGORY</small><strong>${esc(b.category||categoryName(b.category_id)||'—')}</strong></div><div><small>CUPBOARD</small><strong>${esc(b.cupboard_no||'—')}</strong></div><div><small>CREATED</small><strong>${fmt(b.created_at)}</strong></div><div><small>UPDATED</small><strong>${fmt(b.updated_at)}</strong></div><div><small>STATUS</small><strong>${esc(b.status||'—')}</strong></div></div><div class="drawer-actions"><button class="btn secondary" data-drawer-edit="${b.id}">Edit</button><button class="btn danger" data-drawer-delete="${b.id}">Delete</button></div>`;
    $('drawer').classList.add('open'); $('drawerBackdrop').classList.add('show');
  }
  function closeDrawer(){$('drawer').classList.remove('open');$('drawerBackdrop').classList.remove('show');}

  async function loadBookRequests(){
    const r=await sb.from('book_requests').select('id,book_id,faculty_id,requested_at,notes,status').eq('status','pending').order('requested_at',{ascending:false});if(r.error)throw r.error;const rows=r.data||[];setText('bookReqCount',rows.length);$('bookReqCount')?.classList.toggle('hidden',rows.length===0);const bids=[...new Set(rows.map(x=>x.book_id))],fids=[...new Set(rows.map(x=>x.faculty_id))];const [br,fr]=await Promise.all([bids.length?sb.from('books').select('id,book_name,access_no').in('id',bids):Promise.resolve({data:[]}),fids.length?sb.from('faculty_profiles').select('id,name,faculty_id,email').in('id',fids):Promise.resolve({data:[]})]);
    $('bookReqBody').innerHTML=rows.length?rows.map(x=>{const b=(br.data||[]).find(v=>v.id===x.book_id),f=(fr.data||[]).find(v=>v.id===x.faculty_id);return `<tr><td><strong>${esc(b?.book_name||'Unknown')}</strong><small>${esc(b?.access_no||'')}</small></td><td>${esc(f?.name||'Unknown')}<small>${esc(f?.faculty_id||'')}</small></td><td>${dt(x.requested_at)}</td><td>${esc(x.notes||'—')}</td><td><div class="actions"><button type="button" class="btn success tiny" data-approve-book="${x.id}">Approve</button><button type="button" class="btn danger tiny" data-reject-book="${x.id}">Reject</button></div></td></tr>`}).join(''):'<tr><td colspan="5" class="empty">No active book requests.</td></tr>';
  }
  async function approveBookRequest(id){
    try{
      const requestId=Number(id);if(!Number.isFinite(requestId))return toast('Invalid book request.','error');
      const due=datePrompt('Set due date',addDays(isoToday(),90));if(!due)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<isoToday())return toast('Enter a valid due date that is today or later.','error');
      const primary=await sb.rpc('approve_book_request',{p_request_id:requestId,p_due_date:due});
      if(primary.error){
        const req=await sb.from('book_requests').select('id,book_id,faculty_id,status').eq('id',requestId).maybeSingle();if(req.error)throw req.error;if(!req.data)throw new Error('Book request was not found.');if(String(req.data.status).toLowerCase()!=='pending')throw new Error('This book request is no longer pending.');
        const book=await sb.from('books').select('id,access_no,book_name,availability,status').eq('id',req.data.book_id).maybeSingle();if(book.error)throw book.error;if(!book.data)throw new Error('Requested book was not found.');if(!available(book.data))throw new Error('This book is currently issued.');
        const issue=await sb.rpc('admin_issue_book',{p_accession_no:book.data.access_no,p_faculty_id:req.data.faculty_id,p_due_date:due});if(issue.error)throw new Error(`${primary.error.message||'Approval RPC failed'}\nFallback issue failed: ${issue.error.message||issue.error}`);
        const now=new Date().toISOString();const update=await sb.from('book_requests').update({status:'approved',decided_at:now,decided_by:state.admin?.id||null,processed_at:now,processed_by:state.admin?.id||null,due_date:due}).eq('id',requestId);if(update.error)throw update.error;
      }
      toast('Book request approved and issued.');await Promise.all([loadBookRequests(),loadBookHistory(),updateStats(),loadBooks()]);
    }catch(e){toast(errText(e),'error');}
  }
  async function rejectBookRequest(id){try{const reason=prompt('Reason for rejection:');if(!reason?.trim())return;const primary=await sb.rpc('reject_book_request',{p_request_id:Number(id),p_reason:reason.trim()});if(primary.error){const now=new Date().toISOString();const update=await sb.from('book_requests').update({status:'rejected',decided_at:now,decided_by:state.admin?.id||null,rejection_reason:reason.trim(),processed_at:now,processed_by:state.admin?.id||null}).eq('id',Number(id)).eq('status','pending');if(update.error)throw new Error(`${primary.error.message||'Rejection RPC failed'}\nFallback update failed: ${update.error.message||update.error}`);}toast('Book request rejected.');await Promise.all([loadBookRequests(),loadBookRejections(),updateStats()]);}catch(e){toast(errText(e),'error');}}
  async function loadReturnRequests(){
    const r=await sb.from('return_requests').select('id,borrow_id,faculty_id,requested_at,status').eq('status','pending').order('requested_at',{ascending:false});if(r.error)throw r.error;const rows=r.data||[];setText('returnReqCount',rows.length);$('returnReqCount')?.classList.toggle('hidden',rows.length===0);const bids=[...new Set(rows.map(x=>x.borrow_id))],fids=[...new Set(rows.map(x=>x.faculty_id))];const [br,fr]=await Promise.all([bids.length?sb.from('borrow_records').select('id,book_id,student_name,student_roll_no').in('id',bids):Promise.resolve({data:[]}),fids.length?sb.from('faculty_profiles').select('id,name,faculty_id').in('id',fids):Promise.resolve({data:[]})]);const bookIds=[...new Set((br.data||[]).map(x=>x.book_id))];const booksR=bookIds.length?await sb.from('books').select('id,book_name,access_no').in('id',bookIds):{data:[]};
    $('returnReqBody').innerHTML=rows.length?rows.map(x=>{const brr=(br.data||[]).find(v=>v.id===x.borrow_id),b=(booksR.data||[]).find(v=>v.id===brr?.book_id),f=(fr.data||[]).find(v=>v.id===x.faculty_id);return `<tr><td><strong>${esc(b?.book_name||'Unknown')}</strong><small>${esc(b?.access_no||'')}</small></td><td>${esc(f?.name||brr?.student_name||'Unknown')}</td><td>${dt(x.requested_at)}</td><td><div class="actions"><button type="button" class="btn success tiny" data-approve-return="${x.id}">Approve</button><button type="button" class="btn danger tiny" data-reject-return="${x.id}">Reject</button></div></td></tr>`}).join(''):'<tr><td colspan="4" class="empty">No active return requests.</td></tr>';
  }
  async function approveReturnRequest(id){
    try {
      const requestId = Number(id);

      // Use the normal server-side approval RPC first.
      // If the old RPC tries to assign "Available" to the book_status enum,
      // use the existing admin_return_book RPC instead and then approve the
      // return request record.
      const r = await sb.rpc('approve_return_request', {
        p_request_id: requestId
      });

      if (r.error) {
        const message = String(r.error.message || '').toLowerCase();
        const enumError =
          message.includes('invalid input value for enum') ||
          message.includes('book_status');

        if (!enumError) throw r.error;

        const req = await sb
          .from('return_requests')
          .select('id,borrow_id,faculty_id,status')
          .eq('id', requestId)
          .maybeSingle();

        if (req.error) throw req.error;
        if (!req.data) throw new Error('Return request was not found.');
        if (String(req.data.status).toLowerCase() !== 'pending') {
          throw new Error('This return request is no longer pending.');
        }

        const borrow = await sb
          .from('borrow_records')
          .select('id,book_id,status')
          .eq('id', req.data.borrow_id)
          .maybeSingle();

        if (borrow.error) throw borrow.error;
        if (!borrow.data) throw new Error('Borrow record was not found.');
        if (String(borrow.data.status).toLowerCase() !== 'issued') {
          throw new Error('This borrow record is no longer active.');
        }

        const book = await sb
          .from('books')
          .select('id,access_no,book_name')
          .eq('id', borrow.data.book_id)
          .maybeSingle();

        if (book.error) throw book.error;
        if (!book.data) throw new Error('Book for this return request was not found.');

        const returned = await sb.rpc('admin_return_book', {
          p_accession_no: book.data.access_no
        });

        if (returned.error) throw returned.error;

        const now = new Date().toISOString();
        const update = await sb
          .from('return_requests')
          .update({
            status: 'approved',
            decided_at: now,
            decided_by: state.admin?.id || null,
            processed_at: now,
            processed_by: state.admin?.id || null
          })
          .eq('id', requestId);

        if (update.error) throw update.error;
      }

      toast('Return request approved.');

      await Promise.all([
        loadReturnRequests(),
        loadBookHistory(),
        loadBorrowing(),
        updateStats(),
        loadBooks()
      ]);

    } catch (e) {
      toast(errText(e), 'error');
    }
  }
  async function rejectReturnRequest(id){try{const reason=prompt('Reason for rejection:');if(!reason?.trim())return;const primary=await sb.rpc('reject_return_request',{p_request_id:Number(id),p_reason:reason.trim()});if(primary.error){const now=new Date().toISOString();const update=await sb.from('return_requests').update({status:'rejected',decided_at:now,decided_by:state.admin?.id||null,rejection_reason:reason.trim(),processed_at:now,processed_by:state.admin?.id||null}).eq('id',Number(id)).eq('status','pending');if(update.error)throw new Error(`${primary.error.message||'Rejection RPC failed'}\nFallback update failed: ${update.error.message||update.error}`);}toast('Return request rejected.');await Promise.all([loadReturnRequests(),loadBookRejections(),updateStats()]);}catch(e){toast(errText(e),'error');}}

  async function loadFacultyRequests(){const r=await sb.from('faculty_profiles').select('id,name,faculty_id,designation,email,created_at,approval_status,is_active').eq('approval_status','pending').order('created_at',{ascending:false});if(r.error)throw r.error;const rows=r.data||[];setText('facultyCount',rows.length);$('facultyCount')?.classList.toggle('hidden',rows.length===0);$('facultyBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.name)}</td><td><code>${esc(x.faculty_id)}</code></td><td>${esc(x.designation||'—')}</td><td>${esc(x.email)}</td><td><div class="actions"><button type="button" class="btn success tiny" data-approve-faculty="${x.id}">Approve</button><button type="button" class="btn danger tiny" data-reject-faculty="${x.id}">Reject</button></div></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No active faculty requests.</td></tr>';}
  async function approveFaculty(id){try{const r=await sb.rpc('approve_faculty',{p_faculty_id:id});if(r.error)throw r.error;const fr=await sb.from('faculty_profiles').select('id,name,faculty_id,email').eq('id',id).maybeSingle();if(fr.error)throw fr.error;let emailWarning='';if(fr.data?.email){const loginUrl=new URL('/MatLib/faculty.html',window.location.origin).href;const mail=await sb.functions.invoke('send-faculty-approval-email',{body:{faculty_id:id,name:fr.data.name,email:fr.data.email,login_url:loginUrl}});if(mail.error)emailWarning=' Faculty approval succeeded, but the login email could not be sent.';}toast(emailWarning||'Faculty approved and login email sent.');await Promise.all([loadFacultyRequests(),loadFacultyData(),loadFacultyHistory(),loadCalendar(),updateStats()]);}catch(e){toast(errText(e),'error');}}
  async function rejectFaculty(id){try{const reason=prompt('Reason for rejection:');if(!reason)return;const r=await sb.rpc('reject_faculty',{p_faculty_id:id,p_reason:reason});if(r.error)throw r.error;toast('Faculty request rejected.');await Promise.all([loadFacultyRequests(),loadFacultyRejections()]);}catch(e){toast(errText(e),'error');}}

  async function enrichBorrow(rows){
    if(!rows.length)return [];
    const bids=[...new Set(rows.map(x=>x.book_id))],fids=[...new Set(rows.map(x=>x.faculty_id).filter(Boolean))];
    const [br,fr]=await Promise.all([sb.from('books').select('id,book_name,author_name,category,category_id,access_no').in('id',bids),fids.length?sb.from('faculty_profiles').select('id,name,faculty_id,email').in('id',fids):Promise.resolve({data:[]})]);
    return rows.map(r=>{const b=(br.data||[]).find(x=>x.id===r.book_id),f=(fr.data||[]).find(x=>x.id===r.faculty_id);return {...r,book_name:b?.book_name||'Unknown',author_name:b?.author_name||'',category:b?.category||categoryName(b?.category_id)||'',access_no:b?.access_no||'',faculty_name:f?.name||r.student_name||'',faculty_id_text:f?.faculty_id||r.student_roll_no||'',faculty_email:f?.email||r.student_email||''};});
  }
  function filterPast(rows,filters){return rows.filter(r=>{const issued=(r.issued_at||'').slice(0,10);return (!filters.from||issued>=filters.from)&&(!filters.to||issued<=filters.to)&&(!filters.category||String(r.category)===filters.category)&&(!filters.author||String(r.author_name||'').toLowerCase().includes(filters.author.toLowerCase()))&&(!filters.topic||`${r.book_name} ${r.access_no}`.toLowerCase().includes(filters.topic.toLowerCase()))&&String(r.status||'').toLowerCase()!=='issued';});}
  async function fetchPastBorrow(){const r=await sb.from('borrow_records').select('id,book_id,faculty_id,student_name,student_roll_no,issued_at,due_date,returned_at,status,notes').order('issued_at',{ascending:false}).limit(5000);if(r.error)throw r.error;return enrichBorrow(r.data||[]);}
  function renderHistory(rows){$('bookHistoryBody').innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.book_name)}</strong><small>${esc(r.access_no)}</small></td><td>${esc(r.faculty_name)}<small>${esc(r.faculty_id_text)}</small></td><td>${dt(r.issued_at)}</td><td>${fmt(r.due_date)}</td><td>${fmt(r.returned_at)}</td><td><span class="badge">${esc(r.status||'')}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No past borrowing records.</td></tr>';}
  async function loadBookHistory(){const rows=await fetchPastBorrow();const filters={from:$('bhFrom')?.value,to:$('bhTo')?.value,category:$('bhCategory')?.value,author:$('bhAuthor')?.value,topic:$('bhTopic')?.value};state.filteredHistory=filterPast(rows,filters);renderHistory(state.filteredHistory);renderHistoryCalendar(state.filteredHistory);}
  async function loadBorrowing(){const rows=await fetchPastBorrow();const filters={from:$('borrowFrom')?.value,to:$('borrowTo')?.value,category:$('borrowCategory')?.value,author:$('borrowAuthor')?.value,topic:$('borrowTopic')?.value};state.filteredBorrowing=filterPast(rows,filters);$('borrowingBody').innerHTML=state.filteredBorrowing.length?state.filteredBorrowing.map(r=>`<tr><td>${esc(r.book_name)}<small>${esc(r.access_no)}</small></td><td>${esc(r.author_name||'—')}</td><td>${esc(r.category||'—')}</td><td>${esc(r.faculty_name||'—')}</td><td>${dt(r.issued_at)}</td><td>${fmt(r.returned_at)}</td><td>${esc(r.status||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No past records.</td></tr>';}
  function renderHistoryCalendar(rows){const box=$('historyCalendar');if(!box)return;const map={};rows.forEach(r=>{const k=(r.issued_at||'').slice(0,10);if(k)(map[k]??=[]).push(r);});const now=new Date(),y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay();let html='<div class="calendar-head"><strong>'+now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})+'</strong><span>Past issues</span></div><div class="calendar-week">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<b>${x}</b>`).join('')+'</div><div class="calendar-grid">';for(let i=0;i<start;i++)html+='<div class="cal-day empty-day"></div>';for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,items=map[key]||[];html+=`<button class="cal-day ${items.length?'has-events':''}" data-cal-date="${key}"><strong>${d}</strong><span>${items.length?items.length+' issue'+(items.length>1?'s':''):''}</span></button>`;}html+='</div>';box.innerHTML=html;}
// ============================================================
// LOAD ALL BOOKS - PAGINATED
// Supabase normally limits one request to 1000 rows.
// This loads everything in batches.
// ============================================================

async function fetchAllBooks() {
    const sb = window.matlib?.sb;

    if (!sb) {
        throw new Error("MatLib Supabase client is not available.");
    }

    const PAGE_SIZE = 1000;
    let from = 0;
    let allBooks = [];

    while (true) {

        const to = from + PAGE_SIZE - 1;

        const {
            data,
            error
        } = await sb
            .from("books")
            .select(`
                id,
                book_name,
                author_name,
                category,
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
            console.error(
                "Failed to load books:",
                error
            );

            throw error;
        }

        if (!data || data.length === 0) {
            break;
        }

        allBooks.push(...data);

        // If fewer than PAGE_SIZE came back,
        // we reached the final batch.
        if (data.length < PAGE_SIZE) {
            break;
        }

        from += PAGE_SIZE;
    }

    console.log(
        `MatLib: Loaded ${allBooks.length} books`
    );

    return allBooks;
}
  async function loadFacultyHistory(){const r=await sb.from('faculty_profiles').select('name,faculty_id,email,approved_at,created_at,approval_status').eq('approval_status','approved').order('approved_at',{ascending:false});if(r.error)throw r.error;let rows=r.data||[];const q=String($('facultyHistorySearch')?.value||'').toLowerCase();rows=rows.filter(x=>!q||`${x.name} ${x.faculty_id} ${x.email}`.toLowerCase().includes(q));$('facultyHistoryBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.faculty_id)}</td><td>${esc(x.email)}</td><td>${fmt(x.approved_at)}</td><td>${fmt(x.created_at)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No past approved faculty records.</td></tr>';}
  async function loadBookRejections(){const r=await sb.from('book_requests').select('id,book_id,faculty_id,requested_at,decided_at,rejection_reason,status').eq('status','rejected').order('decided_at',{ascending:false});if(r.error)throw r.error;const rows=r.data||[],bids=[...new Set(rows.map(x=>x.book_id))],fids=[...new Set(rows.map(x=>x.faculty_id))];const [br,fr]=await Promise.all([bids.length?sb.from('books').select('id,book_name,access_no').in('id',bids):Promise.resolve({data:[]}),fids.length?sb.from('faculty_profiles').select('id,name,faculty_id').in('id',fids):Promise.resolve({data:[]})]);$('rejectedBooksBody').innerHTML=rows.length?rows.map(x=>{const b=(br.data||[]).find(v=>v.id===x.book_id),f=(fr.data||[]).find(v=>v.id===x.faculty_id);return `<tr><td><strong>${esc(b?.book_name||'Unknown')}</strong><small>${esc(b?.access_no||'')}</small></td><td>${esc(f?.name||'Unknown')}</td><td>${dt(x.decided_at||x.requested_at)}</td><td>${esc(x.rejection_reason||'—')}</td></tr>`}).join(''):'<tr><td colspan="4" class="empty">No rejected book requests.</td></tr>';}
  async function loadFacultyRejections(){const r=await sb.from('faculty_profiles').select('name,faculty_id,email,rejection_reason,updated_at,created_at,approval_status').eq('approval_status','rejected').order('updated_at',{ascending:false});if(r.error)throw r.error;$('rejectedFacultyBody').innerHTML=(r.data||[]).length?(r.data||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.faculty_id)}</td><td>${fmt(x.updated_at||x.created_at)}</td><td>${esc(x.rejection_reason||'—')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No rejected faculty requests.</td></tr>';}

  async function loadStudentLogs(){const r=await sb.from('student_access_logs').select('id,student_name,roll_no,access_type,accessed_at,user_agent').order('accessed_at',{ascending:false}).limit(5000);if(r.error)throw r.error;const q=String($('studentLogSearch')?.value||'').toLowerCase();const rows=(r.data||[]).filter(x=>!q||`${x.student_name} ${x.roll_no} ${x.access_type}`.toLowerCase().includes(q));$('studentLogsBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.student_name)}</td><td>${esc(x.roll_no)}</td><td>${esc(x.access_type)}</td><td>${dt(x.accessed_at)}</td><td class="truncate">${esc(x.user_agent||'—')}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No logs.</td></tr>';}

  async function loadStudentDocumentHistory(){
    const r=await sb.from('student_document_send_history').select('id,student_name,roll_no,sender_email,document_name,recipients,sent_at,status,drive_url').order('sent_at',{ascending:false}).limit(2000);
    if(r.error){
      if(String(r.error.message||'').toLowerCase().includes('does not exist')) { $('studentDocHistoryBody').innerHTML='<tr><td colspan="7" class="empty">Run the included database SQL to enable document send history.</td></tr>'; return; }
      throw r.error;
    }
    let rows=r.data||[];const q=String($('studentDocHistorySearch')?.value||'').toLowerCase();rows=rows.filter(x=>!q||`${x.student_name} ${x.roll_no} ${x.sender_email} ${x.document_name}`.toLowerCase().includes(q));
    $('studentDocHistoryBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.student_name||'—')}</td><td>${esc(x.roll_no||'—')}</td><td>${esc(x.document_name||'—')}</td><td>${esc(Array.isArray(x.recipients)?x.recipients.join(', '):x.recipients||'—')}</td><td>${esc(x.sender_email||'—')}</td><td>${dt(x.sent_at)}</td><td>${esc(x.status||'initiated')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No document send history.</td></tr>';
  }

  function renderCategories(){const body=$('categoriesBody');if(!body)return;body.innerHTML=state.categories.map((c,i)=>`<tr><td>${i+1}</td><td><strong>${esc(c.name)}</strong></td><td>${state.books.filter(b=>String(b.category_id)===String(c.id)).length}</td><td><div class="actions"><button type="button" class="btn secondary tiny" data-edit-cat="${c.id}">Edit</button><button type="button" class="btn danger tiny" data-delete-cat="${c.id}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No categories.</td></tr>';}
  async function categoryAdd(){try{const n=prompt('Category name:')?.trim();if(!n)return;const r=await sb.from('categories').insert({name:n});if(r.error)throw r.error;toast('Category added.');await loadCategories();}catch(e){toast(errText(e),'error');}}
  async function categoryEdit(id){try{if(!(await passwordCheck(prompt('Administrator password:')||'')))return;const c=state.categories.find(x=>String(x.id)===String(id));const n=prompt('Category name:',c?.name||'')?.trim();if(!n)return;const r=await sb.from('categories').update({name:n}).eq('id',Number(id));if(r.error)throw r.error;toast('Category updated.');await loadCategories();}catch(e){toast(errText(e),'error');}}
  async function categoryDelete(id){try{if(!(await passwordCheck(prompt('Administrator password:')||'')))return;if(!confirm('Delete this category? Books must not depend on it.'))return;const r=await sb.rpc('admin_delete_category',{p_category_id:Number(id)});if(r.error)throw r.error;toast('Category deleted.');await loadCategories();await loadBooks();}catch(e){toast(errText(e),'error');}}
  function renderCategoryBrowse(){const body=$('categoryBrowseBody');if(!body)return;const c=$('categoryBrowseSelect')?.value||'',q=$('categoryBrowseSearch')?.value||'';const rows=state.books.filter(b=>(!c||String(b.category_id)===c)&&bookMatch(b,q));body.innerHTML=rows.length?rows.map(b=>`<tr><td>${esc(b.book_name)}</td><td>${esc(b.author_name||'—')}</td><td>${esc(b.category||categoryName(b.category_id)||'—')}</td><td><code>${esc(b.access_no||'—')}</code></td><td><span class="badge ${available(b)?'available':'issued'}">${available(b)?'Available':'Issued'}</span></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No books.</td></tr>';}

  async function loadActiveIssued(){
    const r=await sb.from('borrow_records').select('id,book_id,faculty_id,student_name,student_roll_no,issued_at,due_date,status,returned_at').eq('status','Issued').is('returned_at',null).order('due_date',{ascending:true});
    if(r.error)throw r.error;
    let rows=await enrichBorrow(r.data||[]);
    const q=String($('activeIssuedSearch')?.value||'').trim().toLowerCase();
    const cat=$('activeIssuedCategory')?.value||'';
    rows=rows.filter(x=>(!cat||String(x.category)===cat)&&(!q||`${x.book_name} ${x.access_no} ${x.author_name} ${x.faculty_name} ${x.faculty_id_text}`.toLowerCase().includes(q)));
    const sort=$('activeIssuedSort')?.value||'due';
    rows.sort((a,b)=>sort==='faculty'?String(a.faculty_name).localeCompare(String(b.faculty_name)):sort==='issued'?String(a.issued_at||'').localeCompare(String(b.issued_at||'')):String(a.due_date||'').localeCompare(String(b.due_date||'')));
    state.activeIssued=rows;
    setText('activeIssuedCount',`${rows.length.toLocaleString('en-IN')} book${rows.length===1?'':'s'}`);
    const body=$('activeIssuedBody');
    if(body)body.innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.book_name)}</strong><small>${esc(x.category||'—')}</small></td><td><code>${esc(x.access_no||'—')}</code></td><td>${esc(x.author_name||'—')}</td><td>${esc(x.faculty_name||'—')}</td><td><code>${esc(x.faculty_id_text||'—')}</code></td><td>${dt(x.issued_at)}</td><td>${fmt(x.due_date)}</td><td><span class="badge issued">Issued</span></td></tr>`).join(''):'<tr><td colspan="8" class="empty">No active issued books.</td></tr>';
  }

  function facultyById(value){
    const q=String(value||'').trim().toLowerCase();
    return state.faculty.find(f=>String(f.faculty_id||'').toLowerCase()===q)||null;
  }

  function renderFacultyLookupSuggestions(inputId,boxId){
    const q=String($(inputId)?.value||'').trim().toLowerCase();const box=$(boxId);if(!box)return;
    if(!q){box.classList.add('hidden');box.innerHTML='';return;}
    const rows=state.faculty.filter(f=>`${f.faculty_id} ${f.name} ${f.email}`.toLowerCase().includes(q)).slice(0,10);
    box.innerHTML=rows.length?rows.map(f=>`<button type="button" data-faculty-lookup="${esc(f.faculty_id)}"><strong>${esc(f.faculty_id)}</strong><span>${esc(f.name)} · ${esc(f.email)}</span></button>`).join(''):'<div class="suggestion-empty">No approved active faculty found.</div>';
    box.classList.remove('hidden');
  }

  function renderDeleteFacultyPreview(f){
    const box=$('deleteFacultyPreview'),area=$('deleteFacultyConfirmArea');if(!box||!area)return;
    if(!f){box.classList.add('hidden');area.classList.add('hidden');return;}
    box.classList.remove('hidden');box.innerHTML=`<div class="preview-icon">♙</div><div><strong>${esc(f.name)}</strong><span>${esc(f.faculty_id)} · ${esc(f.email)}</span><small>${esc(f.designation||'Faculty')} · ${f.is_active?'Active':'Inactive'}</small></div>`;
    area.classList.remove('hidden');
  }

  function prepareDeleteFaculty(){
    if(!state.faculty.length)loadFacultyData();
    const value=$('deleteFacultySearch')?.value||'';renderDeleteFacultyPreview(facultyById(value));
  }

  function prepareSearchFaculty(){
    if(!state.faculty.length)loadFacultyData();
    const f=facultyById($('facultyDetailSearch')?.value||'');if(f)loadFacultyDetails(f.faculty_id);
  }

  async function deleteFaculty(){
    try{
      const f=facultyById($('deleteFacultySearch')?.value||'');
      if(!f)return toast('Enter a valid approved Faculty ID.','error');
      if($('deleteFacultyConfirmText')?.value.trim()!=='DELETE')return toast('Type DELETE to confirm faculty removal.','error');
      if(!(await passwordCheck($('deleteFacultyPassword')?.value||'')))return;
      const active=await sb.from('borrow_records').select('id').eq('faculty_id',f.id).eq('status','Issued').is('returned_at',null).limit(1);
      if(active.error)throw active.error;
      const docs=await sb.from('drive_files').select('id').eq('uploaded_by',f.id).limit(1);
      if(docs.error)throw docs.error;
      if((active.data||[]).length)return toast('Cannot delete this faculty while they have an active issued book. Return the book first.','error');
      if((docs.data||[]).length)return toast('Cannot delete this faculty while they own uploaded documents. Transfer/delete those documents first; unrelated documents will not be touched.','error');
      if(!confirm(`Delete faculty ${f.name} (${f.faculty_id})? This cannot be undone.`))return;
      let r=await sb.rpc('admin_delete_faculty',{p_faculty_id:f.id});
      if(r.error){
        const msg=String(r.error.message||'').toLowerCase();
        if(msg.includes('does not exist')||msg.includes('could not find the function')){
          r=await sb.from('faculty_profiles').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',f.id);
          if(r.error)throw r.error;
          toast('Faculty deactivated because the secure delete RPC is not installed. No books or documents were deleted.','error');
        }else throw r.error;
      }else toast('Faculty deleted successfully.');
      $('deleteFacultySearch').value='';$('deleteFacultyConfirmText').value='';$('deleteFacultyPassword').value='';$('deleteFacultyPreview').classList.add('hidden');$('deleteFacultyConfirmArea').classList.add('hidden');
      await loadFacultyData();await updateStats();
    }catch(e){toast(errText(e),'error');}
  }

  async function loadFacultyDetails(facultyId){
    try{
      const f=facultyById(facultyId);if(!f)return toast('Enter a valid approved Faculty ID.','error');
      const [borR,docR]=await Promise.all([
        sb.from('borrow_records').select('id,book_id,faculty_id,student_name,student_roll_no,issued_at,due_date,returned_at,status,notes').eq('faculty_id',f.id).order('issued_at',{ascending:false}).limit(5000),
        sb.from('drive_files').select('id,name,drive_file_id,folder_drive_id,root_folder_id,uploaded_by,mime_type,file_size,drive_url,created_at').eq('uploaded_by',f.id).order('created_at',{ascending:false}).limit(5000)
      ]);
      if(borR.error)throw borR.error;if(docR.error)throw docR.error;
      const rows=await enrichBorrow(borR.data||[]);const active=rows.filter(x=>String(x.status||'').toLowerCase()==='issued'&&!x.returned_at);const past=rows.filter(x=>!active.includes(x));
      const folderIds=[...new Set((docR.data||[]).map(x=>x.folder_drive_id).filter(Boolean))];let folderMap=new Map();
      if(folderIds.length){const fr=await sb.from('drive_folders').select('drive_folder_id,name').in('drive_folder_id',folderIds);if(fr.error)throw fr.error;folderMap=new Map((fr.data||[]).map(x=>[String(x.drive_folder_id),x.name]));}
      state.facultyDetail={faculty:f,active,past,documents:docR.data||[]};state.facultyDetailExport=[
        ...active.map(x=>({section:'Active Books',book:x.book_name,access_no:x.access_no,author:x.author_name,issued_at:dt(x.issued_at),due_date:fmt(x.due_date),status:x.status})),
        ...past.map(x=>({section:'Past Borrowing',book:x.book_name,access_no:x.access_no,author:x.author_name,issued_at:dt(x.issued_at),returned_at:fmt(x.returned_at),status:x.status})),
        ...(docR.data||[]).map(x=>({section:'Document',document:x.name,folder:folderMap.get(String(x.folder_drive_id))||'Root',uploaded_at:dt(x.created_at),mime_type:x.mime_type||''}))
      ];
      $('facultyDetailsEmpty')?.classList.add('hidden');$('facultyDetails')?.classList.remove('hidden');setText('facultyDetailName',f.name||'—');setText('facultyDetailMeta',`${f.faculty_id} · ${f.email} · ${f.designation||'Faculty'}`);setText('facultyActiveCount',active.length);setText('facultyPastCount',past.length);setText('facultyDocCount',(docR.data||[]).length);
      $('facultyActiveBooksBody').innerHTML=active.length?active.map(x=>`<tr><td>${esc(x.book_name)}</td><td><code>${esc(x.access_no||'—')}</code></td><td>${dt(x.issued_at)}</td><td>${fmt(x.due_date)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No active books.</td></tr>';
      $('facultyPastBooksBody').innerHTML=past.length?past.map(x=>`<tr><td>${esc(x.book_name)}</td><td><code>${esc(x.access_no||'—')}</code></td><td>${dt(x.issued_at)}</td><td>${fmt(x.returned_at)}</td><td>${esc(x.status||'—')}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No past borrowing records.</td></tr>';
      $('facultyDocumentsBody').innerHTML=(docR.data||[]).length?docR.data.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(folderMap.get(String(x.folder_drive_id))||'Root')}</td><td>${dt(x.created_at)}</td><td>${esc(x.mime_type||'—')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No documents uploaded by this faculty.</td></tr>';
    }catch(e){toast(errText(e),'error');}
  }

/* =========================================================
   OVERDUE MAIL HISTORY
   ========================================================= */

async function loadMailHistory(){
  const body=$('mailHistoryBody');
  if(!body)return;
  try{
    const r=await sb.from('overdue_email_log').select('id,recipient_email,borrow_id,sent_at,sent_by').order('sent_at',{ascending:false}).limit(5000);
    if(r.error)throw r.error;
    const rows=r.data||[];
    const emails=[...new Set(rows.map(x=>x.recipient_email).filter(Boolean))];
    const borrowIds=[...new Set(rows.map(x=>x.borrow_id).filter(Boolean))];
    const [fr,br]=await Promise.all([
      emails.length?sb.from('faculty_profiles').select('id,name,faculty_id,email').in('email',emails):Promise.resolve({data:[]}),
      borrowIds.length?sb.from('borrow_records').select('id,book_id').in('id',borrowIds):Promise.resolve({data:[]})
    ]);
    if(fr.error)throw fr.error;if(br.error)throw br.error;
    const bookIds=[...new Set((br.data||[]).map(x=>x.book_id).filter(Boolean))];
    const books=bookIds.length?await sb.from('books').select('id,book_name,access_no').in('id',bookIds):{data:[]};
    if(books.error)throw books.error;
    const fmap=new Map((fr.data||[]).map(x=>[String(x.email).toLowerCase(),x]));
    const bmap=new Map((br.data||[]).map(x=>[String(x.id),x]));
    const bkmap=new Map((books.data||[]).map(x=>[String(x.id),x]));
    const q=String($('mailHistorySearch')?.value||'').trim().toLowerCase();
    const filtered=rows.filter(x=>{const f=fmap.get(String(x.recipient_email||'').toLowerCase());const b=bmap.get(String(x.borrow_id));const book=bkmap.get(String(b?.book_id));return !q||`${f?.name||''} ${f?.faculty_id||''} ${x.recipient_email||''} ${book?.book_name||''} ${book?.access_no||''}`.toLowerCase().includes(q);});
    body.innerHTML=filtered.length?filtered.map(x=>{const f=fmap.get(String(x.recipient_email||'').toLowerCase());const b=bmap.get(String(x.borrow_id));const book=bkmap.get(String(b?.book_id));return `<tr><td>${esc(f?.name||'—')}</td><td>${esc(x.recipient_email||'—')}</td><td><strong>${esc(book?.book_name||'—')}</strong><small>${esc(book?.access_no||'')}</small></td><td>${dt(x.sent_at)}</td><td><code>#${esc(String(x.id))}</code></td><td><button type="button" class="btn danger tiny" data-delete-mail-history="${esc(String(x.id))}">Delete</button></td></tr>`;}).join(''):'<tr><td colspan="6" class="empty">No mail history found.</td></tr>';
  }catch(e){console.error('MAIL HISTORY:',e);toast(errText(e),'error');}
}

async function deleteMailHistory(id){
  try{if(!confirm('Delete this mail history record?'))return;const r=await sb.rpc('admin_delete_overdue_email_log',{p_log_id:Number(id)});if(r.error)throw r.error;toast('Mail history deleted.','success');await loadMailHistory();}catch(e){toast(errText(e),'error');}
}

/* =========================================================
   OVERDUE BOOKS
   ========================================================= */

   async function deleteOverdueEmailLog(id) {
  try {

    if (!id) {
      return;
    }


    const confirmed =
      confirm(
        "Delete this mail history record?"
      );


    if (!confirmed) {
      return;
    }


    const {
      error
    } = await sb
      .from("overdue_email_log")
      .delete()
      .eq("id", id);


    if (error) {
      console.error(
        "Delete overdue email log:",
        error
      );

      throw error;
    }


    toast(
      "Mail history deleted.",
      "success"
    );


    await loadOverdueEmailHistory();


  } catch (error) {

    console.error(
      "deleteOverdueEmailLog:",
      error
    );

    toast(
      error?.message ||
      "Unable to delete mail history.",
      "error"
    );

  }
}
async function loadOverdueEmailHistory() {
  try {

    const table = document.getElementById("overdueEmailHistoryBody");

    if (!table) {
      console.warn("overdueEmailHistoryBody not found");
      return;
    }

    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          Loading mail history...
        </td>
      </tr>
    `;


    const { data, error } = await sb
      .from("overdue_email_log")
      .select(`
        id,
        recipient_email,
        borrow_id,
        sent_at,
        sent_by
      `)
      .order("sent_at", {
        ascending: false
      })
      .limit(1000);


    if (error) {
      console.error(
        "Overdue email history error:",
        error
      );

      throw error;
    }


    if (!data || data.length === 0) {

      table.innerHTML = `
        <tr>
          <td colspan="6" class="empty">
            No overdue reminder emails have been sent yet.
          </td>
        </tr>
      `;

      return;
    }


    /*
     * Get borrow IDs
     */
    const borrowIds = [
      ...new Set(
        data
          .map(x => x.borrow_id)
          .filter(Boolean)
      )
    ];


    let borrowMap = new Map();


    if (borrowIds.length > 0) {

      const {
        data: borrows,
        error: borrowError
      } = await sb
        .from("borrow_records")
        .select(`
          id,
          book_id,
          faculty_id
        `)
        .in("id", borrowIds);


      if (borrowError) {
        console.warn(
          "Borrow history lookup failed:",
          borrowError
        );
      }


      if (borrows) {

        borrowMap = new Map(
          borrows.map(row => [
            String(row.id),
            row
          ])
        );

      }
    }


    /*
     * Faculty IDs
     */
    const facultyIds = [
      ...new Set(
        data
          .map(row => {
            const borrow =
              borrowMap.get(
                String(row.borrow_id)
              );

            return borrow?.faculty_id;
          })
          .filter(Boolean)
      )
    ];


    let facultyMap = new Map();


    if (facultyIds.length > 0) {

      const {
        data: faculties,
        error: facultyError
      } = await sb
        .from("faculty_profiles")
        .select(`
          id,
          name,
          faculty_id,
          email
        `)
        .in("id", facultyIds);


      if (facultyError) {
        console.warn(
          "Faculty history lookup failed:",
          facultyError
        );
      }


      if (faculties) {

        facultyMap = new Map(
          faculties.map(row => [
            String(row.id),
            row
          ])
        );

      }
    }


    /*
     * Book IDs
     */
    const bookIds = [
      ...new Set(
        [...borrowMap.values()]
          .map(row => row.book_id)
          .filter(Boolean)
      )
    ];


    let bookMap = new Map();


    if (bookIds.length > 0) {

      const {
        data: books,
        error: bookError
      } = await sb
        .from("books")
        .select(`
          id,
          book_name,
          access_no
        `)
        .in("id", bookIds);


      if (bookError) {
        console.warn(
          "Book history lookup failed:",
          bookError
        );
      }


      if (books) {

        bookMap = new Map(
          books.map(row => [
            String(row.id),
            row
          ])
        );

      }
    }


    const searchInput =
      document.getElementById(
        "mailHistorySearch"
      );


    const search =
      String(
        searchInput?.value || ""
      )
        .trim()
        .toLowerCase();


    const filtered =
      data.filter(row => {

        const borrow =
          borrowMap.get(
            String(row.borrow_id)
          );

        const faculty =
          borrow
            ? facultyMap.get(
                String(borrow.faculty_id)
              )
            : null;

        const book =
          borrow
            ? bookMap.get(
                String(borrow.book_id)
              )
            : null;


        const text = [
          faculty?.name,
          faculty?.faculty_id,
          faculty?.email,
          row.recipient_email,
          book?.book_name,
          book?.access_no,
          row.borrow_id,
          row.id
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        return !search ||
          text.includes(search);

      });


    table.innerHTML =
      filtered.length
        ? filtered.map(row => {

            const borrow =
              borrowMap.get(
                String(row.borrow_id)
              );

            const faculty =
              borrow
                ? facultyMap.get(
                    String(borrow.faculty_id)
                  )
                : null;

            const book =
              borrow
                ? bookMap.get(
                    String(borrow.book_id)
                  )
                : null;


            const sentAt =
              row.sent_at
                ? new Date(
                    row.sent_at
                  ).toLocaleString(
                    "en-IN"
                  )
                : "—";


            return `
              <tr>

                <td>
                  <strong>
                    ${escapeHTML(
                      faculty?.name ||
                      "Faculty"
                    )}
                  </strong>
                </td>


                <td>
                  ${escapeHTML(
                    row.recipient_email ||
                    faculty?.email ||
                    "—"
                  )}
                </td>


                <td>
                  <strong>
                    ${escapeHTML(
                      book?.book_name ||
                      "Overdue Book"
                    )}
                  </strong>

                  ${
                    book?.access_no
                      ? `
                        <small>
                          ${escapeHTML(
                            book.access_no
                          )}
                        </small>
                      `
                      : ""
                  }
                </td>


                <td>
                  ${escapeHTML(
                    sentAt
                  )}
                </td>


                <td>
                  ${escapeHTML(
                    String(row.id)
                  )}
                </td>


                <td>
                  <button
                    type="button"
                    class="btn secondary tiny"
                    data-delete-overdue-log="${row.id}"
                  >
                    Delete
                  </button>
                </td>

              </tr>
            `;

          }).join("")

        : `
          <tr>
            <td colspan="6" class="empty">
              No matching mail history.
            </td>
          </tr>
        `;


  } catch (error) {

    console.error(
      "loadOverdueEmailHistory:",
      error
    );

    toast(
      error?.message ||
      "Unable to load mail history.",
      "error"
    );

  }
}

async function loadOverdue() {
  try {
    const today = isoToday();

    const r = await sb
      .from("borrow_records")
      .select(
        "id,book_id,faculty_id,student_name,student_roll_no,due_date,issued_at,status,returned_at"
      )
      .eq("status", "Issued")
      .is("returned_at", null)
      .lt("due_date", today)
      .order("due_date", {
        ascending: true
      });

    if (r.error) {
      throw r.error;
    }

    const totalOverdueRows = r.data || [];
    let rows = await enrichBorrow(
      totalOverdueRows
    );
    setText("overdueCount", totalOverdueRows.length);
    $('overdueCount')?.closest('.nav-item')?.classList.toggle('hidden', totalOverdueRows.length===0);
    if(rows.some(x=>!x.faculty_name || !x.faculty_email || x.faculty_name==='—')){
      const fr=await sb.from('faculty_profiles').select('id,name,faculty_id,email');
      if(!fr.error){
        const allFac=fr.data||[];
        rows=rows.map(x=>{
          const f=allFac.find(v=>String(v.id)===String(x.faculty_id) || String(v.faculty_id)===String(x.faculty_id_text) || String(v.faculty_id)===String(x.student_roll_no));
          return f?{...x,faculty_name:f.name||x.faculty_name,faculty_id_text:f.faculty_id||x.faculty_id_text,faculty_email:f.email||x.faculty_email}:x;
        });
      }
    }

    /* ---------------------------------------------
       Search
       --------------------------------------------- */

    const q = String(
      $("overdueSearch")?.value || ""
    )
      .trim()
      .toLowerCase();

    rows = rows.filter((x) => {
      if (!q) return true;

      return `
        ${x.book_name || ""}
        ${x.access_no || ""}
        ${x.faculty_name || ""}
        ${x.faculty_id_text || ""}
        ${x.faculty_email || ""}
      `
        .toLowerCase()
        .includes(q);
    });

    /* ---------------------------------------------
       Update overdue count
       --------------------------------------------- */

    setText(
      "sOverdue",
      totalOverdueRows.length
    );

    /* ---------------------------------------------
       Render table
       --------------------------------------------- */

    const body = $("overdueBody");
    if (!body) {
      console.warn(
        "overdueBody element not found."
      );
      return;
    }

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty"
          >
            No overdue books.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = rows
      .map((x) => {
        const dueDate = x.due_date
          ? String(x.due_date).substring(0, 10)
          : "";

        let days = 0;

        if (dueDate) {
          const dueTime = new Date(
            `${dueDate}T23:59:59`
          ).getTime();

          days = Math.max(
            0,
            Math.floor(
              (Date.now() - dueTime) /
                86400000
            )
          );
        }

        return `
          <tr>

            <td>
              <strong>
                ${esc(
                  x.book_name || "Unknown Book"
                )}
              </strong>

              <small>
                ${esc(
                  x.access_no || "—"
                )}
              </small>
            </td>

            <td>
              ${esc(
                x.faculty_name || "—"
              )}
            </td>

            <td>
              ${esc(
                x.faculty_id_text || "—"
              )}
            </td>

            <td>
              ${esc(
                x.faculty_email || "—"
              )}
            </td>

            <td>
              ${dueDate
                ? fmt(dueDate)
                : "—"}
            </td>

            <td>
              ${days}
            </td>

            <td>
              <button type="button" class="btn secondary tiny" data-overdue="${esc(String(x.id))}" title="Send overdue email">✉ Mail</button>
            </td>

          </tr>
        `;
      })
      .join("");

  } catch (e) {
    console.error(
      "LOAD OVERDUE ERROR:",
      e
    );

    toast(
      errText(e),
      "error"
    );
  }
}


/* =========================================================
   SEND OVERDUE EMAIL
   ========================================================= */

async function sendOverdueMail(id) {
  try {

    /* ---------------------------------------------
       Validate borrow ID
       --------------------------------------------- */

    if (
      id === undefined ||
      id === null ||
      String(id).trim() === ""
    ) {
      throw new Error(
        "Borrow record ID is missing."
      );
    }

    /*
      IMPORTANT:
      borrow_records.id is a UUID.

      Do NOT use Number(id).
    */

    const borrowId =
      String(id).trim();

    console.log(
      "======================================"
    );

    console.log(
      "MATLIB OVERDUE EMAIL"
    );

    console.log(
      "Borrow ID:",
      borrowId
    );

    console.log(
      "======================================"
    );


    /* ---------------------------------------------
       Optional confirmation
       --------------------------------------------- */

    const confirmed = confirm(
      "Send an overdue reminder email to this faculty member?"
    );

    if (!confirmed) {
      return;
    }


    /* ---------------------------------------------
       Get current session
       --------------------------------------------- */

    const {
      data: sessionData,
      error: sessionError
    } = await sb.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const session =
      sessionData?.session;

    if (!session) {
      throw new Error(
        "Admin session expired. Please login again."
      );
    }


    /* ---------------------------------------------
       Call Edge Function
       --------------------------------------------- */

    const r =
      await sb.functions.invoke(
        "send-overdue-email",
        {
          body: {
            borrow_id: borrowId
          }
        }
      );


    console.log(
      "OVERDUE EMAIL RESPONSE:",
      r
    );


    /* ---------------------------------------------
       Edge Function error
       --------------------------------------------- */

    if (r.error) {

      console.error(
        "OVERDUE EMAIL ERROR:",
        r.error
      );


      /* -------------------------------------------
         Read actual Edge Function response
         ------------------------------------------- */

      if (r.error.context) {

        try {

          const responseBody =
            await r.error.context.text();

          console.error(
            "EDGE FUNCTION RAW RESPONSE:",
            responseBody
          );


          let parsed = null;

          try {
            parsed =
              JSON.parse(
                responseBody
              );
          } catch (_) {
            // Response wasn't JSON
          }


          const actualMessage =
            parsed?.message ||
            parsed?.error ||
            responseBody ||
            r.error.message ||
            "Unable to send overdue email.";


          throw new Error(
            actualMessage
          );

        } catch (readError) {

          if (
            readError instanceof Error
          ) {
            throw readError;
          }

          throw r.error;
        }
      }


      throw r.error;
    }


    /* ---------------------------------------------
       Validate Edge Function response
       --------------------------------------------- */

    if (!r.data) {
      throw new Error(
        "No response received from overdue email service."
      );
    }


    if (
      r.data.success !== true
    ) {

      throw new Error(
        r.data.message ||
        "Unable to send overdue reminder."
      );
    }


    /* ---------------------------------------------
       SUCCESS
       --------------------------------------------- */

    console.log(
      "======================================"
    );

    console.log(
      "OVERDUE EMAIL SENT SUCCESSFULLY"
    );

    await loadOverdue();
    toast(`Reminder sent to ${r.data.recipient || 'faculty'}.`);

    console.log(
      "Recipient:",
      r.data.recipient
    );

    console.log(
      "Overdue count:",
      r.data.overdue_count
    );

    console.log(
      "Email ID:",
      r.data.email_id
    );

    console.log(
      "======================================"
    );


    toast(
      `Reminder sent to ${
        r.data.recipient ||
        "faculty"
      } for ${
        r.data.overdue_count ||
        1
      } overdue book${
        Number(
          r.data.overdue_count || 1
        ) === 1
          ? ""
          : "s"
      }.`,
      "success"
    );


    /* ---------------------------------------------
       Refresh overdue list
       --------------------------------------------- */

    await loadOverdue();


  } catch (e) {

    console.error(
      "FINAL OVERDUE EMAIL ERROR:",
      e
    );

    toast(
      e?.message ||
      "Unable to send overdue email.",
      "error"
    );
  }
}
  function setDriveView(view){state.driveView=view;const grid=$('driveGrid');if(grid)grid.classList.toggle('drive-list-view',view==='list');document.querySelectorAll('.drive-view-btn').forEach(b=>b.classList.toggle('active',b.id===`drive${view==='grid'?'Grid':'List'}View`));renderDrive();}
  async function createDriveFolderAdmin(){
    try{
      const cur=currentDrive();
      if(!cur){toast('Open a Drive root before creating a folder.','error');return;}
      const name=prompt('Folder name:','New Folder')?.trim();if(!name)return;
      const rootId=cur.type==='root'?cur.id:cur.root_folder_id;
      const parentFolderId=cur.type==='folder'?cur.id:'';
      await driveManager('create_folder',{root_id:Number(rootId),parent_folder_id:parentFolderId,name});
      toast('Folder created successfully.');await loadDocuments();
    }catch(e){toast(errText(e),'error');}
  }
  function uploadDriveFileAdmin(){
    const cur=currentDrive();if(!cur){toast('Open a Drive root before uploading a file.','error');return;}
    const input=$('driveUploadInput');if(!input)return;input.value='';input.click();
  }
  async function handleDriveUploadAdmin(file){
    if(!file)return;try{
      const cur=currentDrive();const rootId=cur.type==='root'?cur.id:cur.root_folder_id;const folderId=cur.type==='folder'?cur.id:'';
      await driveManager('upload_file',{root_id:Number(rootId),folder_id:folderId},file);toast('File uploaded successfully.');await loadDocuments();
    }catch(e){toast(errText(e),'error');}
  }

  async function loadDocuments(){
    try {
      const [a,b,c]=await Promise.all([
        sb.from('drive_root_folders').select('id,name,drive_folder_id,created_by,created_at').order('name'),
        sb.from('drive_folders').select('id,name,drive_folder_id,parent_drive_folder_id,root_folder_id,created_by,created_at').order('name'),
        sb.from('drive_files').select('id,name,drive_file_id,folder_drive_id,root_folder_id,uploaded_by,mime_type,file_size,drive_url,created_at').order('name')
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
      state.drive.roots=a.data||[];state.drive.folders=b.data||[];state.drive.files=c.data||[];state.drive.path=[];
      await enrichDrivePeople();
      renderDrive();
      updateFilterSuggestions();
    } catch(e) { toast(errText(e),'error'); }
  }

  async function enrichDrivePeople(){
    const ids=[...new Set([...state.drive.roots.map(x=>x.created_by),...state.drive.folders.map(x=>x.created_by),...state.drive.files.map(x=>x.uploaded_by)].filter(Boolean))];
    if(!ids.length)return;
    const [admins,faculty]=await Promise.all([sb.from('admin_profiles').select('id,name,email').in('id',ids),sb.from('faculty_profiles').select('id,name,email').in('id',ids)]);
    const map=new Map();(admins.data||[]).forEach(x=>map.set(String(x.id),x));(faculty.data||[]).forEach(x=>map.set(String(x.id),x));
    const add=x=>({...x,person:map.get(String(x.created_by||x.uploaded_by))||null});
    state.drive.roots=state.drive.roots.map(add);state.drive.folders=state.drive.folders.map(add);state.drive.files=state.drive.files.map(add);
  }

  function currentDrive(){const p=state.drive.path;return p[p.length-1]||null;}
  function driveFolderChildren(parentDriveId,rootId){return state.drive.folders.filter(f=>String(f.root_folder_id)===String(rootId)&&String(f.parent_drive_folder_id||'')===String(parentDriveId||''));}
  function renderDrive(){
    const q=String($('docSearch')?.value||'').trim().toLowerCase();const cur=currentDrive();
    let rootId=null,parentDriveId=null;
    if(cur?.type==='root'){rootId=cur.id;parentDriveId=cur.drive_folder_id;}
    else if(cur?.type==='folder'){rootId=cur.root_folder_id;parentDriveId=cur.drive_folder_id;}
    let folders=[],files=[];
    if(!cur){
      folders=state.drive.roots.map(x=>({...x,_type:'root'}));
      // Root-level files are stored against the root Google Drive folder ID.
      files=state.drive.files.filter(f=>!f.folder_drive_id || state.drive.roots.some(r=>String(r.id)===String(f.root_folder_id)&&String(r.drive_folder_id)===String(f.folder_drive_id)));
    } else {
      folders=driveFolderChildren(parentDriveId,rootId).map(x=>({...x,_type:'folder'}));
      files=state.drive.files.filter(f=>String(f.root_folder_id)===String(rootId)&&String(f.folder_drive_id||'')===String(parentDriveId||''));
    }
    if(q){folders=folders.filter(x=>String(x.name).toLowerCase().includes(q));files=files.filter(x=>String(x.name).toLowerCase().includes(q));}
    $('driveBreadcrumb').innerHTML=`<button data-drive-home>My Drive</button>`+(cur?`<span>›</span><button data-drive-crumb="0">${esc(cur.type==='root'?cur.name:state.drive.roots.find(r=>String(r.id)===String(cur.root_folder_id))?.name||'Root')}</button>`:'')+state.drive.path.slice(cur?.type==='root'?1:1).map((p,i)=>`<span>›</span><button data-drive-crumb="${i+1}">${esc(p.name)}</button>`).join('');
    let html=folders.map(x=>`<div class="drive-item folder"><button class="drive-open-area" data-drive-open="${x._type}:${x.id}"><div class="drive-icon">▰</div><div class="drive-main"><strong>${esc(x.name)}</strong><small>Folder · ${esc(x.person?.name||'Unknown')} · ${fmt(x.created_at)}</small></div></button><button class="drive-menu-btn" data-drive-actions="folder:${x.id}" title="Folder actions">⋮</button></div>`).join('');
    html+=files.map(x=>`<div class="drive-item file"><button class="drive-open-area" data-drive-file="${x.id}"><div class="drive-icon">${String(x.mime_type||'').includes('pdf')?'PDF':'▤'}</div><div class="drive-main"><strong>${esc(x.name)}</strong><small>${esc(x.mime_type||'File')} · ${esc(x.person?.name||'Unknown')} · ${dt(x.created_at)}</small></div></button><button class="drive-menu-btn" data-drive-actions="file:${x.id}" title="File actions">⋮</button></div>`).join('');
    $('driveGrid').classList.toggle('drive-list-view',state.driveView==='list');$('driveGrid').innerHTML=html;const empty=!folders.length&&!files.length;$('driveEmpty').classList.toggle('hidden',!empty);
  }
  function openDriveItem(token){const [type,id]=token.split(':');if(type==='root'){const r=state.drive.roots.find(x=>String(x.id)===id);if(r)state.drive.path=[{...r,type:'root'}];}else{const f=state.drive.folders.find(x=>String(x.id)===id);if(f)state.drive.path=[...state.drive.path,{...f,type:'folder'}];}renderDrive();}

  async function driveManager(action,payload={}){
    const {data}=await sb.auth.getSession();const token=data?.session?.access_token;if(!token)throw new Error('Admin session expired.');
    const base=window.MATLIB_SUPABASE_URL || window.SUPABASE_URL || '';
    const key=window.MATLIB_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || '';
    const response=await fetch(`${base}/functions/v1/drive-manager`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'apikey':key},body:JSON.stringify({action,...payload})});
    const result=await response.json().catch(()=>({success:false,error:'Invalid Drive Manager response.'}));
    if(!response.ok||result.success===false)throw new Error(result.error||result.message||'Google Drive operation failed.');
    return result;
  }

  function showDriveMenu(type,id){
    document.querySelectorAll('.drive-context-menu').forEach(x=>x.remove());
    const menu=document.createElement('div');menu.className='drive-context-menu';menu.innerHTML=type==='file'?`<button data-drive-open-action="${id}">Open</button><button data-drive-details="${id}">Details</button><button data-drive-move="file:${id}">Move to folder</button><button class="danger-item" data-drive-delete="file:${id}">Delete</button>`:`<button data-drive-open-action="${id}">Open</button><button data-drive-move="folder:${id}">Move to folder</button><button class="danger-item" data-drive-delete="folder:${id}">Delete folder</button>`;document.body.appendChild(menu);const b=document.querySelector(`[data-drive-actions="${type}:${id}"]`);const r=b.getBoundingClientRect();menu.style.left=`${Math.min(r.left,innerWidth-230)}px`;menu.style.top=`${Math.min(r.bottom+6,innerHeight-220)}px`;setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),0);
  }
  async function driveDelete(type,id){try{if(!confirm(`Delete this ${type}? This will remove it from Google Drive.`))return;if(type==='file'){await driveManager('delete_file',{file_id:Number(id)});}else{await driveManager('delete_folder',{folder_id:Number(id)});}toast(`${type==='file'?'File':'Folder'} deleted.`);await loadDocuments();}catch(e){toast(errText(e),'error');}}
  function openDriveDetails(id){const f=state.drive.files.find(x=>String(x.id)===String(id));if(!f)return;openInfoModal('File details',`<div class="info-grid"><div><small>Name</small><strong>${esc(f.name)}</strong></div><div><small>Uploaded by</small><strong>${esc(f.person?.name||'Unknown')}</strong></div><div><small>Email</small><strong>${esc(f.person?.email||'—')}</strong></div><div><small>Uploaded</small><strong>${dt(f.created_at)}</strong></div><div><small>Type</small><strong>${esc(f.mime_type||'File')}</strong></div><div><small>Size</small><strong>${f.file_size?`${(Number(f.file_size)/1024/1024).toFixed(2)} MB`:'—'}</strong></div></div>`);}
  function openInfoModal(title,html){const m=$('infoModal');if(!m)return;setText('infoModalTitle',title);$('infoModalBody').innerHTML=html;m.classList.add('open');}
  function closeInfoModal(){$('infoModal')?.classList.remove('open');}
  function openMoveModal(token){state.driveMoveItem=token;const m=$('moveDriveModal');const list=$('moveDriveList');if(!m||!list)return;const [type,id]=token.split(':');const item=type==='file'?state.drive.files.find(x=>String(x.id)===id):state.drive.folders.find(x=>String(x.id)===id);const options=[];state.drive.roots.forEach(r=>options.push(`<button type="button" data-move-target="root:${r.id}">📁 ${esc(r.name)} <small>Root</small></button>`));state.drive.folders.forEach(f=>{if(type==='folder'&&String(f.id)===id)return;options.push(`<button type="button" data-move-target="folder:${f.id}">📂 ${esc(f.name)} <small>${esc(state.drive.roots.find(r=>String(r.id)===String(f.root_folder_id))?.name||'Folder')}</small></button>`);});list.innerHTML=options.join('')||'<div class="empty">No destination folders.</div>';m.classList.add('open');}
  async function moveDriveItem(targetToken){try{const [type,id]=state.driveMoveItem.split(':');const [tt,tid]=targetToken.split(':');if(type==='file'){const f=state.drive.files.find(x=>String(x.id)===id);if(!f)return;let rootId,folderDriveId='';if(tt==='root'){const r=state.drive.roots.find(x=>String(x.id)===tid);rootId=r?.id;folderDriveId=r?.drive_folder_id;}else{const folder=state.drive.folders.find(x=>String(x.id)===tid);rootId=folder?.root_folder_id;folderDriveId=folder?.drive_folder_id;}if(!rootId||!folderDriveId)return;await driveManager('move_file',{file_id:Number(id),target_root_id:Number(rootId),target_folder_drive_id:folderDriveId});}else{const folder=state.drive.folders.find(x=>String(x.id)===id);if(!folder)return;let rootId,parentDriveId='';if(tt==='root'){const r=state.drive.roots.find(x=>String(x.id)===tid);rootId=r?.id;parentDriveId=r?.drive_folder_id;}else{const p=state.drive.folders.find(x=>String(x.id)===tid);rootId=p?.root_folder_id;parentDriveId=p?.drive_folder_id;}if(!rootId||!parentDriveId)return;await driveManager('move_folder',{folder_id:Number(id),target_root_id:Number(rootId),target_parent_drive_id:parentDriveId});}closeMoveModal();toast('Moved successfully.');await loadDocuments();}catch(e){toast(errText(e),'error');}}
  function closeMoveModal(){$('moveDriveModal')?.classList.remove('open');state.driveMoveItem=null;}

  function updateStats(){const today=isoToday();return Promise.all([sb.from('books').select('id',{count:'exact',head:true}),sb.from('book_requests').select('id',{count:'exact',head:true}).eq('status','pending'),sb.from('borrow_records').select('id',{count:'exact',head:true}).eq('status','Issued'),sb.from('return_requests').select('id',{count:'exact',head:true}).eq('status','pending'),sb.from('faculty_profiles').select('id',{count:'exact',head:true}).eq('approval_status','pending'),sb.from('borrow_records').select('id',{count:'exact',head:true}).eq('status','Issued').is('returned_at',null).lt('due_date',today)]).then(([b,br,bo,rr,fr,od])=>{const counts={bookRequests:Number(br.count||0),returnRequests:Number(rr.count||0),facultyRequests:Number(fr.count||0),overdue:Number(od.count||0)};setText('sBooks',b.count||0);setText('bookCount',(b.count||0).toLocaleString('en-IN'));setText('sReq',counts.bookRequests);setText('sIssued',bo.count||0);setText('bookReqCount',counts.bookRequests);$('bookReqCount')?.classList.toggle('hidden',counts.bookRequests===0);setText('returnReqCount',counts.returnRequests);$('returnReqCount')?.classList.toggle('hidden',counts.returnRequests===0);setText('facultyCount',counts.facultyRequests);$('facultyCount')?.classList.toggle('hidden',counts.facultyRequests===0);setText('sOverdue',counts.overdue);setText('overdueCount',counts.overdue);$('sReq')?.closest('.stat-card')?.classList.toggle('hidden',counts.bookRequests===0);$('overdueCount')?.closest('.nav-item')?.classList.toggle('hidden',counts.overdue===0);renderNotifications();});}

  let pendingExport=null;
  function normalizeExportRows(rows){return (rows||[]).map(r=>{const o={};Object.entries(r||{}).forEach(([k,v])=>{if(Array.isArray(v))o[k]=v.join(', ');else if(v&&typeof v==='object')o[k]=JSON.stringify(v);else o[k]=v??'';});return o;});}
  function labelExportKey(k){return String(k).replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
  function rawExportExcel(data,title,name){if(!window.XLSX)return toast('Excel library is still loading. Try again.','error');const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(data);const keys=Object.keys(data[0]||{});ws['!cols']=keys.map(k=>({wch:Math.min(36,Math.max(12,labelExportKey(k).length+4))}));ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,'MatLib Report');XLSX.writeFile(wb,`${name}.xlsx`);toast('Excel export started.');}
  function rawExportCSV(data,title,name){const keys=Object.keys(data[0]||{});const csv=[keys.map(labelExportKey),...data.map(r=>keys.map(k=>r[k]))].map(row=>row.map(v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(',')).join('\r\n');const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${name}.csv`;a.click();URL.revokeObjectURL(a.href);toast('CSV download started.');}
  function rawExportPDF(data,title,name){if(!window.jspdf?.jsPDF)return toast('PDF library is still loading. Try again.','error');const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});const generated=new Date().toLocaleString('en-IN');doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('MatLib',32,30);doc.setFontSize(13);doc.text(title,32,50);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Generated: ${generated}`,32,65);const keys=Object.keys(data[0]||{}),labels=keys.map(labelExportKey),body=data.map(r=>keys.map(k=>String(r[k]??'')));if(typeof doc.autoTable==='function'){doc.autoTable({head:[labels],body,startY:78,theme:'grid',styles:{font:'helvetica',fontSize:7,cellPadding:4,overflow:'linebreak',valign:'middle'},headStyles:{fillColor:[99,55,23],textColor:255,fontStyle:'bold',fontSize:7},alternateRowStyles:{fillColor:[250,246,239]},margin:{left:28,right:28,top:78,bottom:28},didDrawPage:()=>{doc.setFontSize(7);doc.text(`MatLib · Page ${doc.internal.getNumberOfPages()}`,doc.internal.pageSize.getWidth()-110,doc.internal.pageSize.getHeight()-12);}});}doc.save(`${name}.pdf`);toast('PDF export started.');}
  function openExportChooser(rows,title,name,format){const data=normalizeExportRows(rows);if(!data.length)return toast('No data to export.','error');const keys=[...new Set(data.flatMap(r=>Object.keys(r)))];pendingExport={data,title,name,format,keys};setText('exportChooserTitle',`Export ${title}`);const box=$('exportColumns');box.innerHTML=keys.map(k=>`<label class="export-column-option"><input type="checkbox" data-export-key="${esc(k)}" checked><span>${esc(labelExportKey(k))}</span></label>`).join('');$('exportChooserModal').classList.add('open');}
  function closeExportChooser(){pendingExport=null;$('exportChooserModal')?.classList.remove('open');}
  function confirmExport(){if(!pendingExport)return;const selected=[...document.querySelectorAll('[data-export-key]:checked')].map(x=>x.dataset.exportKey);if(!selected.length)return toast('Select at least one column.','error');const data=pendingExport.data.map(r=>{const o={};selected.forEach(k=>o[k]=r[k]??'');return o;});const p=pendingExport;closeExportChooser();if(p.format==='pdf')rawExportPDF(data,p.title,p.name);else if(p.format==='csv')rawExportCSV(data,p.title,p.name);else rawExportExcel(data,p.title,p.name);}
  function exportExcel(rows,title,name){openExportChooser(rows,title,name,'xlsx');}
  function exportCSV(rows,title,name){openExportChooser(rows,title,name,'csv');}
  function exportPDF(rows,title,name){openExportChooser(rows,title,name,'pdf');}

  async function loadAnalytics(){
    const bor=await sb.from('borrow_records').select('book_id,faculty_id');if(bor.error)throw bor.error;
    const books=state.books.length?state.books:await fetchAllBooks();const fac=state.faculty.length?state.faculty:(await sb.from('faculty_profiles').select('id,name')).data||[];
    const bc={},fc={};(bor.data||[]).forEach(x=>{if(x.book_id)bc[x.book_id]=(bc[x.book_id]||0)+1;if(x.faculty_id)fc[x.faculty_id]=(fc[x.faculty_id]||0)+1;});
    state.analytics.book=books.map(x=>({label:x.book_name,value:bc[x.id]||0})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,12);state.analytics.faculty=fac.map(x=>({label:x.name,value:fc[x.id]||0})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,12);
    const issued=books.filter(x=>!available(x)).length;state.analytics.status=[{label:'Issued',value:issued},{label:'Available',value:books.length-issued}];const catMap={};books.forEach(x=>{const n=x.category||categoryName(x.category_id)||'Uncategorized';catMap[n]=(catMap[n]||0)+1;});state.analytics.category=Object.entries(catMap).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);renderAnalyticsCards();
  }
  function renderAnalyticsCards(){const vals=[['analyticsFacultyValue',state.analytics.faculty[0]?.value||0],['analyticsBookValue',state.analytics.book[0]?.value||0],['analyticsIssuedValue',state.analytics.status.find(x=>x.label==='Issued')?.value||0],['analyticsCategoryValue',state.analytics.category[0]?.value||0]];vals.forEach(([id,v])=>setText(id,Number(v).toLocaleString('en-IN')));const subs=[['analyticsFacultySub',state.analytics.faculty[0]?.label||'No issue data'],['analyticsBookSub',state.analytics.book[0]?.label||'No issue data'],['analyticsIssuedSub',`${state.analytics.status[0]?.value||0} issued · ${state.analytics.status[1]?.value||0} available`],['analyticsCategorySub',state.analytics.category[0]?.label||'No categories']];subs.forEach(([id,v])=>setText(id,v));}
  function openAnalyticsCard(type){const data=state.analytics[type]||[];const title={faculty:'Highest issued faculty',book:'Highly issued books',status:'Currently issued vs available',category:'Category-wise book count'}[type];if(!data.length)return toast('No data is available for this visualization yet.','error');setText('analyticsModalTitle',title);$('analyticsModal').classList.add('open');renderAnalyticsChart(type,data,title);}
  function renderAnalyticsChart(type,data,title){const canvas=$('analyticsChart');if(!canvas)return;if(state.analyticsChart){try{state.analyticsChart.destroy();}catch(_){ }state.analyticsChart=null;}const colors=['#633717','#dfb353','#3f7b52','#ad443d','#7b5aa6','#2d7f8f','#d27c3f','#5d7a3b','#8a4f6d','#3b6ea5','#a65d2a','#5f4b3a'];if(!window.Chart)return toast('Chart library is still loading. Try again.','error');const config=(type==='status'||type==='category')?{type:'doughnut',data:{labels:data.map(x=>x.label),datasets:[{data:data.map(x=>x.value),backgroundColor:colors.slice(0,data.length),borderWidth:3,borderColor:'#fffdf9'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'52%',plugins:{legend:{position:'right',labels:{padding:18,usePointStyle:true}}}}}:{type:'bar',data:{labels:data.map(x=>x.label),datasets:[{label:title,data:data.map(x=>x.value),backgroundColor:colors.slice(0,data.length),borderRadius:8,maxBarThickness:28}]},options:{indexAxis:type==='book'?'y':'x',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{usePointStyle:true}}},scales:{x:{beginAtZero:true,ticks:{precision:0}},y:{beginAtZero:true,ticks:{autoSkip:false}}}}};state.analyticsChart=new Chart(canvas,config);}

  async function loadCalendar(){
    const events=[];
    const [bor,br,rr,fac,logs]=await Promise.all([
      sb.from('borrow_records').select('id,book_id,faculty_id,issued_at,returned_at,status').limit(5000),
      sb.from('book_requests').select('id,book_id,faculty_id,requested_at,decided_at,status,rejection_reason').limit(5000),
      sb.from('return_requests').select('id,borrow_id,faculty_id,requested_at,decided_at,status,rejection_reason').limit(5000),
      sb.from('faculty_profiles').select('id,name,faculty_id,created_at,approved_at,updated_at,approval_status,rejection_reason').limit(5000),
      sb.from('student_access_logs').select('id,student_name,roll_no,access_type,accessed_at').limit(5000)
    ]);
    if(bor.error)throw bor.error;if(br.error)throw br.error;if(rr.error)throw rr.error;if(fac.error)throw fac.error;if(logs.error)throw logs.error;
    const bookIds=[...new Set([...(bor.data||[]).map(x=>x.book_id),...(br.data||[]).map(x=>x.book_id)])],facIds=[...new Set([...(bor.data||[]).map(x=>x.faculty_id),...(br.data||[]).map(x=>x.faculty_id),...(rr.data||[]).map(x=>x.faculty_id)])];
    const [booksR,facR]=await Promise.all([bookIds.length?sb.from('books').select('id,book_name').in('id',bookIds):Promise.resolve({data:[]}),facIds.length?sb.from('faculty_profiles').select('id,name,faculty_id').in('id',facIds):Promise.resolve({data:[]})]);
    const bookMap=new Map((booksR.data||[]).map(x=>[String(x.id),x])),facMap=new Map((facR.data||[]).map(x=>[String(x.id),x]));
    (bor.data||[]).forEach(x=>{if(x.issued_at)events.push({date:x.issued_at.slice(0,10),type:'issued',title:`Book issued — ${bookMap.get(String(x.book_id))?.book_name||'Book'}`,detail:facMap.get(String(x.faculty_id))?.name||'Faculty',id:`borrow-${x.id}`});if(x.returned_at)events.push({date:x.returned_at.slice(0,10),type:'returned',title:`Book returned — ${bookMap.get(String(x.book_id))?.book_name||'Book'}`,detail:facMap.get(String(x.faculty_id))?.name||'Faculty',id:`return-${x.id}`});});
    (br.data||[]).forEach(x=>{const name=bookMap.get(String(x.book_id))?.book_name||'Book',f=facMap.get(String(x.faculty_id))?.name||'Faculty';if(x.requested_at)events.push({date:x.requested_at.slice(0,10),type:'book-request',title:`Book request — ${name}`,detail:f,id:`brq-${x.id}`});if(x.decided_at)events.push({date:x.decided_at.slice(0,10),type:x.status==='approved'?'book-approved':'book-rejected',title:`Book ${x.status} — ${name}`,detail:f,id:`brd-${x.id}`});});
    (rr.data||[]).forEach(x=>{const f=facMap.get(String(x.faculty_id))?.name||'Faculty';if(x.requested_at)events.push({date:x.requested_at.slice(0,10),type:'return-request',title:'Return request',detail:f,id:`rrq-${x.id}`});if(x.decided_at)events.push({date:x.decided_at.slice(0,10),type:x.status==='approved'?'return-approved':'return-rejected',title:`Return ${x.status}`,detail:f,id:`rrd-${x.id}`});});
    (fac.data||[]).forEach(x=>{if(x.approved_at)events.push({date:x.approved_at.slice(0,10),type:'faculty-approved',title:`Faculty approved — ${x.name}`,detail:x.faculty_id,id:`fa-${x.id}`});if(x.approval_status==='rejected'&&x.updated_at)events.push({date:x.updated_at.slice(0,10),type:'faculty-rejected',title:`Faculty rejected — ${x.name}`,detail:x.faculty_id,id:`fr-${x.id}`});});
    (logs.data||[]).forEach(x=>{if(x.accessed_at)events.push({date:x.accessed_at.slice(0,10),type:'student-log',title:`Student log — ${x.student_name}`,detail:`${x.roll_no} · ${x.access_type}`,id:`sl-${x.id}`});});
    state.calendar.events=events;applyCalendarFilters();renderCalendar();
  }
  function applyCalendarFilters(){const q=String($('calendarSearch')?.value||'').toLowerCase();const enabled=[...document.querySelectorAll('[data-calendar-filter]:checked')].map(x=>x.dataset.calendarFilter);state.calendar.filtered=state.calendar.events.filter(e=>(!enabled.length||enabled.includes(e.type))&&(!q||`${e.title} ${e.detail} ${e.type}`.toLowerCase().includes(q)));}
  function renderCalendar(){
    const box=$('calendarGrid');if(!box)return;
    const status=$('calendarSelectionStatus');
    if(status){const a=state.calendar.selectedStart,b=state.calendar.selectedEnd;status.textContent=a&&b?`Selected: ${fmt(a)} – ${fmt(b)}`:a?`Start selected: ${fmt(a)} · click another date to choose the end`: 'Select a start date, then an end date';}
    const d=state.calendar.month,y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay();
    const by={};state.calendar.filtered.forEach(e=>(by[e.date]??=[]).push(e));
    setText('calendarMonthTitle',d.toLocaleDateString('en-IN',{month:'long',year:'numeric'}));
    let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="calendar-week-name">${x}</div>`).join('');
    for(let i=0;i<start;i++)html+='<div class="calendar-cell muted-cell"></div>';
    const a=state.calendar.selectedStart,b=state.calendar.selectedEnd;
    for(let day=1;day<=days;day++){
      const date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,items=by[date]||[];
      const types=[...new Set(items.map(x=>x.type))].slice(0,5);
      const selected=a===date||b===date;
      const inRange=a&&b&&date>=a&&date<=b;
      html+=`<button type="button" class="calendar-cell ${items.length?'has-calendar-events':''} ${selected?'calendar-selected-day':''} ${inRange?'calendar-in-range':''}" data-main-calendar-date="${date}"><strong>${day}</strong><div class="calendar-dots">${types.map(t=>`<i class="event-dot ${esc(t)}"></i>`).join('')}</div><small>${items.length?items.length+' event'+(items.length>1?'s':''):''}</small></button>`;
    }
    box.innerHTML=html;
    renderCalendarDay();
  }
  function renderCalendarDay(){
    const box=$('calendarDayEvents');if(!box)return;
    const a=state.calendar.selectedStart,b=state.calendar.selectedEnd;
    if(!a){box.innerHTML='<div class="calendar-day-empty">Select a date to see its activity.</div>';return;}
    const end=b||a;
    const items=state.calendar.filtered.filter(e=>e.date>=a&&e.date<=end).sort((x,y)=>String(x.date).localeCompare(String(y.date))||String(x.title).localeCompare(String(y.title)));
    const title=b?`${fmt(a)} – ${fmt(b)}`:fmt(a);
    if(!items.length){box.innerHTML=`<div class="calendar-day-title">${title}</div><div class="calendar-day-empty">No activity for the selected date${b?' range':''}.</div>`;return;}
    box.innerHTML=`<div class="calendar-day-title">${title} · ${items.length} event${items.length>1?'s':''}</div>`+items.map(e=>`<div class="calendar-event-row"><span class="event-dot ${esc(e.type)}"></span><div><strong>${esc(e.title)}</strong><small>${esc(e.detail)} · ${esc(e.type.replaceAll('-',' '))} · ${esc(e.date)}</small></div></div>`).join('');
  }
  function selectCalendarDate(date){
    const a=state.calendar.selectedStart,b=state.calendar.selectedEnd;
    if(!a){state.calendar.selectedStart=date;state.calendar.selectedEnd=null;}
    else if(!b){
      if(date===a){state.calendar.selectedStart=date;state.calendar.selectedEnd=null;}
      else if(date<a){state.calendar.selectedStart=date;state.calendar.selectedEnd=a;}
      else{state.calendar.selectedEnd=date;}
    }else{
      state.calendar.selectedStart=date;
      state.calendar.selectedEnd=null;
    }
    renderCalendar();
  }

  function setProfileMessage(text, type=''){
    const e=$('profileMessage');
    if(!e)return;
    e.textContent=text||'';
    e.className=`profile-message${type?' '+type:''}`;
  }

  function resetProfilePanels(){
    $('profileOptions')?.classList.remove('hidden');
    $('profileEditPanel')?.classList.add('hidden');
    ['profilePasswordPanel','profileEmailPanel','profilePhonePanel'].forEach(id=>$(id)?.classList.add('hidden'));
    setProfileMessage('');
  }

  function openProfileOption(type){
    $('profileOptions')?.classList.add('hidden');
    $('profileEditPanel')?.classList.remove('hidden');
    ['profilePasswordPanel','profileEmailPanel','profilePhonePanel'].forEach(id=>$(id)?.classList.add('hidden'));
    const panel={password:'profilePasswordPanel',email:'profileEmailPanel',phone:'profilePhonePanel'}[type];
    if(panel)$(panel)?.classList.remove('hidden');
    setProfileMessage('');
    if(type==='email'){
      $('profileCurrentEmail').value=state.admin?.email||'';
      $('profileNewEmail').value='';
      $('profileNewEmail')?.focus();
    }
    if(type==='phone'){
      $('profileCurrentPhone').value=state.admin?.phone||'—';
      $('profileNewPhone').value='';
      $('profileNewPhone')?.focus();
    }
    if(type==='password'){
      $('profileNewPassword').value='';
      $('profileConfirmPassword').value='';
      $('profileNewPassword')?.focus();
    }
  }

  function openAdminProfile(){
    if(!state.admin)return;
    $('profileCurrentEmail').value=state.admin.email||'';
    $('profileCurrentPhone').value=state.admin.phone||'—';
    $('profileNewEmail').value='';
    $('profileNewPhone').value='';
    $('profileNewPassword').value='';
    $('profileConfirmPassword').value='';
    resetProfilePanels();
    $('adminProfileModal')?.classList.add('open');
  }

  function closeAdminProfile(){
    $('adminProfileModal')?.classList.remove('open');
  }

  async function saveProfilePassword(){
    try{
      const password=String($('profileNewPassword')?.value||'');
      const confirmPassword=String($('profileConfirmPassword')?.value||'');
      if(password.length<6)return setProfileMessage('Password must contain at least 6 characters.','error');
      if(password!==confirmPassword)return setProfileMessage('Passwords do not match.','error');
      setProfileMessage('Changing password…');
      const {error}=await sb.auth.updateUser({password});
      if(error)throw error;
      setProfileMessage('Password changed successfully.','success');
      $('profileNewPassword').value='';
      $('profileConfirmPassword').value='';
      setTimeout(closeAdminProfile,700);
    }catch(e){
      console.error('PROFILE PASSWORD:',e);
      setProfileMessage(errText(e),'error');
    }
  }

  async function saveProfileEmail(){
    try{
      const email=String($('profileNewEmail')?.value||'').trim().toLowerCase();
      if(!email)return setProfileMessage('Enter the new email address.','error');
      if(email===String(state.admin?.email||'').trim().toLowerCase())return setProfileMessage('The new email is the same as the current email.','error');
      setProfileMessage('Changing email…');
      const {error:authError}=await sb.auth.updateUser({email});
      if(authError)throw authError;
      const {data,error}=await sb.from('admin_profiles').update({email}).eq('id',state.admin.id).select('id,name,email,phone,role,is_active').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('Admin profile email could not be updated. Check the admin_profiles UPDATE policy.');
      state.admin=data;
      setText('adminName',data.name||'Administrator');
      setText('welcome',data.name||'Administrator');
      setText('avatar',(data.name||'A').trim()[0]?.toUpperCase()||'A');
      setProfileMessage('Email changed successfully.','success');
      setTimeout(closeAdminProfile,900);
    }catch(e){
      console.error('PROFILE EMAIL:',e);
      setProfileMessage(errText(e),'error');
    }
  }

  async function saveProfilePhone(){
    try{
      const phone=String($('profileNewPhone')?.value||'').trim();
      if(!phone)return setProfileMessage('Enter the new mobile number.','error');
      setProfileMessage('Changing mobile number…');
      const {data,error}=await sb.from('admin_profiles').update({phone:phone||null}).eq('id',state.admin.id).select('id,name,email,phone,role,is_active').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('Admin profile mobile number could not be updated. Check the admin_profiles UPDATE policy.');
      state.admin=data;
      setProfileMessage('Mobile number changed successfully.','success');
      setTimeout(closeAdminProfile,700);
    }catch(e){
      console.error('PROFILE PHONE:',e);
      setProfileMessage(errText(e),'error');
    }
  }

  function prepareDeleteBorrowHistory(){}
  function prepareDeleteStudentLogs(){const t=isoToday();if($('deleteLogsFrom')&&!$('deleteLogsFrom').value)$('deleteLogsFrom').value=t;if($('deleteLogsTo')&&!$('deleteLogsTo').value)$('deleteLogsTo').value=t;}
  async function deleteBorrowHistory(){try{if($('deleteBorrowHistoryConfirm')?.value.trim()!=='DELETE HISTORY')return toast('Type DELETE HISTORY exactly to confirm.','error');if(!(await passwordCheck($('deleteBorrowHistoryPassword')?.value||'')))return;if(!confirm('Permanently delete all past borrowed history? Currently issued books will not be deleted.'))return;const r=await sb.from('borrow_records').select('id').neq('status','Issued').not('returned_at','is',null);if(r.error)throw r.error;const ids=(r.data||[]).map(x=>x.id);if(!ids.length)return toast('No past borrowed history found.');const rr=await sb.from('return_requests').delete().in('borrow_id',ids);if(rr.error)throw rr.error;const d=await sb.from('borrow_records').delete().in('id',ids);if(d.error)throw d.error;toast(`Deleted ${ids.length} past borrowing record${ids.length===1?'':'s'}.`);$('deleteBorrowHistoryConfirm').value='';$('deleteBorrowHistoryPassword').value='';await Promise.all([loadBookHistory(),loadBorrowing(),updateStats()]);}catch(e){toast(errText(e),'error');}}
  async function deleteStudentLogs(){try{const from=$('deleteLogsFrom')?.value,to=$('deleteLogsTo')?.value;if(!from||!to)return toast('Select both start and end dates.','error');if(from>to)return toast('Start date cannot be after end date.','error');if($('deleteLogsConfirm')?.value.trim()!=='DELETE LOGS')return toast('Type DELETE LOGS exactly to confirm.','error');if(!(await passwordCheck($('deleteLogsPassword')?.value||'')))return;if(!confirm(`Delete all student logs from ${from} to ${to}? This cannot be undone.`))return;const endExclusive=addDays(to,1);const r=await sb.from('student_access_logs').delete().gte('accessed_at',`${from}T00:00:00`).lt('accessed_at',`${endExclusive}T00:00:00`);if(r.error)throw r.error;toast('Student logs deleted for the selected date range.');$('deleteLogsConfirm').value='';$('deleteLogsPassword').value='';await loadStudentLogs();}catch(e){toast(errText(e),'error');}}
  function datePrompt(title, defaultValue){const value=prompt(`${title}\nEnter date (YYYY-MM-DD):`,defaultValue);return value?.trim();}

  function updateCalendarSuggestion(){const input=$('calendarSearch');if(!input)return;}

  function resetAdd(){['addName','addAuthor','addCupboard','addAccess'].forEach(id=>$(id).value='');$('addCategory').value='';}

  function init(){
    setText('today',new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}));
    $$('#nav .nav-item').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
    $$('[data-go]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.go)));
    bind('menu','click',()=>$('sidebar').classList.toggle('open'));bind('openAdminProfile','click',openAdminProfile);bind('sidebarAdminProfile','click',openAdminProfile);bind('notificationBtn','click',toggleNotifications);bind('closeNotifications','click',closeNotifications);bind('closeAdminProfileModal','click',closeAdminProfile);bind('profileBackBtn','click',resetProfilePanels);bind('saveProfilePassword','click',saveProfilePassword);bind('saveProfileEmail','click',saveProfileEmail);bind('saveProfilePhone','click',saveProfilePhone);$$('[data-profile-option]').forEach(b=>b.addEventListener('click',()=>openProfileOption(b.dataset.profileOption)));
    bind('logout',async()=>{
      try { await sb.auth.signOut(); }
      catch (e) { console.error('Logout error:', e); }
      try { localStorage.removeItem('matlib-admin-session'); sessionStorage.clear(); } catch (_) {}
      location.replace('admin.html');
    });
    bind('refreshAll',async()=>{await updateStats();await loadBooks();await loadCategories();toast('Dashboard refreshed.');});
    bind('issueAccession','input',lookupIssueBook);bind('issueFacultySearch','input',renderFacultySuggestions);bind('issueBtn','click',issueBook);bind('issueDate','change',updateDueDateFromDays);bind('issueDueDays','input',updateDueDateFromDays);
    bind('returnAccession','input',lookupReturn);bind('returnBtn','click',returnBook);bind('deleteBorrowHistoryBtn','click',deleteBorrowHistory);bind('deleteStudentLogsBtn','click',deleteStudentLogs);bind('closeExportChooser','click',closeExportChooser);bind('cancelExportChooser','click',closeExportChooser);bind('confirmExportChooser','click',confirmExport);bind('exportSelectAll','click',()=>$$('[data-export-key]').forEach(x=>x.checked=true));bind('exportSelectNone','click',()=>$$('[data-export-key]').forEach(x=>x.checked=false));
    bind('activeIssuedSearch','input',loadActiveIssued);bind('activeIssuedCategory','change',loadActiveIssued);bind('activeIssuedSort','change',loadActiveIssued);bind('refreshActiveIssued','click',loadActiveIssued);bind('deleteFacultySearch','input',()=>{renderDeleteFacultyPreview(facultyById($('deleteFacultySearch').value));renderFacultyLookupSuggestions('deleteFacultySearch','deleteFacultySuggestions');});bind('deleteFacultyBtn','click',deleteFaculty);bind('facultyDetailSearch','input',()=>renderFacultyLookupSuggestions('facultyDetailSearch','facultyDetailSuggestions'));bind('searchFacultyBtn','click',()=>loadFacultyDetails($('facultyDetailSearch').value));bind('clearFacultyDetails','click',()=>{$('facultyDetailSearch').value='';$('facultyDetails')?.classList.add('hidden');$('facultyDetailsEmpty')?.classList.remove('hidden');state.facultyDetail=null;state.facultyDetailExport=[];});bind('overdueSearch','input',loadOverdue);bind('mailHistorySearch','input',loadMailHistory);bind('refreshMailHistory','click',loadMailHistory);
    bind('addCategory','change',()=>{$('addAccess').value=$('addCategory').value?suggestAccess($('addCategory').value):'';});bind('addBookBtn','click',addBook);
    bind('editLookupAccess','change',lookupEdit);bind('editLookupAccess','keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupEdit();}});bind('editSaveBtn','click',saveEdit);bind('deleteAccess','change',lookupDelete);bind('deleteAccess','keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupDelete();}});bind('deleteConfirmBtn','click',confirmDelete);
    bind('bookSearch','input',()=>{state.bookPage=1;renderBookCatalogue();});bind('bookCategory','change',()=>{state.bookPage=1;renderBookCatalogue();});bind('bookStatus','change',()=>{state.bookPage=1;renderBookCatalogue();});bind('refreshBooks','click',loadBooks);
    bind('docSearch','input',renderDrive);bind('refreshDocs','click',loadDocuments);bind('driveGridView','click',()=>setDriveView('grid'));bind('driveListView','click',()=>setDriveView('list'));bind('newDriveFolder','click',createDriveFolderAdmin);bind('uploadDriveFile','click',uploadDriveFileAdmin);bind('driveUploadInput','change',e=>handleDriveUploadAdmin(e.target.files?.[0]));bind('bookImportBtn','click',()=>$('bookImportFile')?.click());bind('bookImportFile','change',e=>previewBookImport(e.target.files?.[0]));
    bind('loadBookHistory','click',loadBookHistory);bind('clearBookHistory','click',()=>{['bhFrom','bhTo','bhCategory','bhAuthor','bhTopic'].forEach(id=>$(id).value='');loadBookHistory();});
    bind('historyTableBtn','click',()=>{$('historyTableBtn').classList.add('active');$('historyCalendarBtn').classList.remove('active');$('bookHistoryTableWrap').classList.remove('hidden');$('historyCalendar').classList.add('hidden');});bind('historyCalendarBtn','click',()=>{$('historyCalendarBtn').classList.add('active');$('historyTableBtn').classList.remove('active');$('bookHistoryTableWrap').classList.add('hidden');$('historyCalendar').classList.remove('hidden');renderHistoryCalendar(state.filteredHistory);});
    bind('loadBorrowing','click',loadBorrowing);bind('clearBorrowing','click',()=>{['borrowFrom','borrowTo','borrowCategory','borrowAuthor','borrowTopic'].forEach(id=>$(id).value='');loadBorrowing();});
    bind('facultyHistorySearch','input',loadFacultyHistory);bind('refreshStudentLogs','click',loadStudentLogs);bind('studentLogSearch','input',loadStudentLogs);bind('studentDocHistorySearch','input',loadStudentDocumentHistory);
    bind('addCategoryBtn','click',categoryAdd);bind('categoryBrowseSelect','change',renderCategoryBrowse);bind('categoryBrowseSearch','input',renderCategoryBrowse);
    bind('refreshAnalytics','click',loadAnalytics);bind('refreshCalendar','click',loadCalendar);bind('calendarSearch','input',()=>{applyCalendarFilters();renderCalendar();});bind('prevCalendar','click',()=>{state.calendar.month=new Date(state.calendar.month.getFullYear(),state.calendar.month.getMonth()-1,1);state.calendar.selectedStart=null;state.calendar.selectedEnd=null;renderCalendar();});bind('nextCalendar','click',()=>{state.calendar.month=new Date(state.calendar.month.getFullYear(),state.calendar.month.getMonth()+1,1);state.calendar.selectedStart=null;state.calendar.selectedEnd=null;renderCalendar();});bind('todayCalendar','click',()=>{const n=new Date();state.calendar.month=new Date(n.getFullYear(),n.getMonth(),1);state.calendar.selectedStart=null;state.calendar.selectedEnd=null;renderCalendar();});
    $$('.calendar-filter').forEach(e=>e.addEventListener('change',()=>{applyCalendarFilters();renderCalendar();}));
    bind('analyticsCardFaculty','click',()=>openAnalyticsCard('faculty'));bind('analyticsCardBook','click',()=>openAnalyticsCard('book'));bind('analyticsCardStatus','click',()=>openAnalyticsCard('status'));bind('analyticsCardCategory','click',()=>openAnalyticsCard('category'));bind('closeAnalyticsModal','click',closeAnalyticsModal);bind('downloadAnalyticsPNG','click',()=>{if(state.analyticsChart){const a=document.createElement('a');a.href=state.analyticsChart.toBase64Image();a.download='matlib-analytics.png';a.click();}});
    bind('closeInfoModal','click',closeInfoModal);bind('closeMoveDriveModal','click',closeMoveModal);
    bind('exportBookHistory','click',()=>exportExcel(state.filteredHistory,'MatLib Book History','matlib-book-history'));bind('pdfBookHistory','click',()=>exportPDF(state.filteredHistory,'MatLib Book History','matlib-book-history'));bind('exportBorrowing','click',()=>exportExcel(state.filteredBorrowing,'MatLib Borrowing History','matlib-borrowing-history'));bind('pdfBorrowing','click',()=>exportPDF(state.filteredBorrowing,'MatLib Borrowing History','matlib-borrowing-history'));
    bind('exportFacultyHistory',async()=>{const r=await sb.from('faculty_profiles').select('name,faculty_id,email,approved_at,created_at').eq('approval_status','approved').order('approved_at',{ascending:false});if(r.error)throw r.error;exportExcel(r.data||[],'MatLib Faculty History','matlib-faculty-history');});bind('pdfFacultyHistory',async()=>{const r=await sb.from('faculty_profiles').select('name,faculty_id,email,approved_at,created_at').eq('approval_status','approved').order('approved_at',{ascending:false});if(r.error)throw r.error;exportPDF(r.data||[],'MatLib Faculty History','matlib-faculty-history');});
    bind('exportBookRejections',async()=>{const r=await sb.from('book_requests').select('id,book_id,faculty_id,decided_at,rejection_reason').eq('status','rejected').order('decided_at',{ascending:false});if(r.error)throw r.error;exportExcel(r.data||[],'MatLib Book Rejections','matlib-book-rejections');});bind('pdfBookRejections',async()=>{const r=await sb.from('book_requests').select('id,book_id,faculty_id,decided_at,rejection_reason').eq('status','rejected').order('decided_at',{ascending:false});if(r.error)throw r.error;exportPDF(r.data||[],'MatLib Book Rejections','matlib-book-rejections');});
    bind('exportFacultyRejections',async()=>{const r=await sb.from('faculty_profiles').select('name,faculty_id,email,updated_at,rejection_reason').eq('approval_status','rejected').order('updated_at',{ascending:false});if(r.error)throw r.error;exportExcel(r.data||[],'MatLib Faculty Rejections','matlib-faculty-rejections');});bind('pdfFacultyRejections',async()=>{const r=await sb.from('faculty_profiles').select('name,faculty_id,email,updated_at,rejection_reason').eq('approval_status','rejected').order('updated_at',{ascending:false});if(r.error)throw r.error;exportPDF(r.data||[],'MatLib Faculty Rejections','matlib-faculty-rejections');});
    bind('exportCategory','click',()=>{const c=$('categoryBrowseSelect').value,q=$('categoryBrowseSearch').value;exportExcel(state.books.filter(b=>(!c||String(b.category_id)===c)&&bookMatch(b,q)),'MatLib Category Books','matlib-category-books');});bind('pdfCategory','click',()=>{const c=$('categoryBrowseSelect').value,q=$('categoryBrowseSearch').value;exportPDF(state.books.filter(b=>(!c||String(b.category_id)===c)&&bookMatch(b,q)),'MatLib Category Books','matlib-category-books');});
    bind('exportStudentLogs',async()=>{const r=await sb.from('student_access_logs').select('student_name,roll_no,access_type,accessed_at,user_agent').order('accessed_at',{ascending:false}).limit(5000);if(r.error)throw r.error;exportExcel(r.data||[],'MatLib Student Logs','matlib-student-logs');});bind('pdfStudentLogs',async()=>{const r=await sb.from('student_access_logs').select('student_name,roll_no,access_type,accessed_at,user_agent').order('accessed_at',{ascending:false}).limit(5000);if(r.error)throw r.error;exportPDF(r.data||[],'MatLib Student Logs','matlib-student-logs');});
    bind('exportStudentDocHistory',async()=>{const r=await sb.from('student_document_send_history').select('student_name,roll_no,sender_email,document_name,recipients,sent_at,status,drive_url').order('sent_at',{ascending:false}).limit(5000);if(r.error)throw r.error;exportExcel(r.data||[],'MatLib Document Send History','matlib-document-send-history');});bind('pdfStudentDocHistory',async()=>{const r=await sb.from('student_document_send_history').select('student_name,roll_no,sender_email,document_name,recipients,sent_at,status,drive_url').order('sent_at',{ascending:false}).limit(5000);if(r.error)throw r.error;exportPDF(r.data||[],'MatLib Document Send History','matlib-document-send-history');});
    bind('exportActiveIssuedCsv',()=>exportCSV(state.activeIssued,'MatLib Active Issued Books','matlib-active-issued-books'));bind('pdfActiveIssued',()=>exportPDF(state.activeIssued,'MatLib Active Issued Books','matlib-active-issued-books'));bind('exportFacultyDetailsCsv',()=>exportCSV(state.facultyDetailExport,'MatLib Faculty Details','matlib-faculty-details'));bind('pdfFacultyDetails',()=>exportPDF(state.facultyDetailExport,'MatLib Faculty Details','matlib-faculty-details'));
    bind('exportOverdue',async()=>{const today=isoToday();const r=await sb.from('borrow_records').select('id,book_id,faculty_id,due_date,issued_at,status').eq('status','Issued').lt('due_date',today).order('due_date');if(r.error)throw r.error;const rows=await enrichBorrow(r.data||[]);exportExcel(rows,'MatLib Overdue Books','matlib-overdue-books');});
    bind('pdfOverdue',async()=>{const today=isoToday();const r=await sb.from('borrow_records').select('id,book_id,faculty_id,due_date,issued_at,status').eq('status','Issued').lt('due_date',today).order('due_date');if(r.error)throw r.error;const rows=await enrichBorrow(r.data||[]);exportPDF(rows,'MatLib Overdue Books','matlib-overdue-books');});
    bind('exportCalendar','click',()=>exportExcel(state.calendar.filtered,'MatLib Calendar Events','matlib-calendar-events'));bind('pdfCalendar','click',()=>exportPDF(state.calendar.filtered,'MatLib Calendar Events','matlib-calendar-events'));

    document.addEventListener('click',async e=>{
      try {
        const sf=e.target.closest('[data-select-faculty]');if(sf){selectFaculty(sf.dataset.selectFaculty);return;}
        const fl=e.target.closest('[data-faculty-lookup]');if(fl){const id=fl.dataset.facultyLookup;if(e.target.closest('#deleteFacultySuggestions')){$('deleteFacultySearch').value=id;renderDeleteFacultyPreview(facultyById(id));$('deleteFacultySuggestions').classList.add('hidden');}else{$('facultyDetailSearch').value=id;loadFacultyDetails(id);$('facultyDetailSuggestions').classList.add('hidden');}return;}
        const vb=e.target.closest('[data-view-book]');if(vb){const b=state.books.find(x=>String(x.id)===String(vb.dataset.viewBook));if(b)openDrawer(b);return;}
        const de=e.target.closest('[data-drawer-edit]');if(de){closeDrawer();showSection('editBook');$('editLookupAccess').value=state.books.find(x=>String(x.id)===String(de.dataset.drawerEdit))?.access_no||'';lookupEdit();return;}
        const dd=e.target.closest('[data-drawer-delete]');if(dd){closeDrawer();showSection('deleteBook');$('deleteAccess').value=state.books.find(x=>String(x.id)===String(dd.dataset.drawerDelete))?.access_no||'';lookupDelete();return;}
        const ap=e.target.closest('[data-approve-book]');if(ap){await approveBookRequest(ap.dataset.approveBook);return;}
        const rb=e.target.closest('[data-reject-book]');if(rb){await rejectBookRequest(rb.dataset.rejectBook);return;}
        const ar=e.target.closest('[data-approve-return]');if(ar){await approveReturnRequest(ar.dataset.approveReturn);return;}
        const rr=e.target.closest('[data-reject-return]');if(rr){await rejectReturnRequest(rr.dataset.rejectReturn);return;}
        const af=e.target.closest('[data-approve-faculty]');if(af){await approveFaculty(af.dataset.approveFaculty);return;}
        const rf=e.target.closest('[data-reject-faculty]');if(rf){await rejectFaculty(rf.dataset.rejectFaculty);return;}
        const ec=e.target.closest('[data-edit-cat]');if(ec){await categoryEdit(ec.dataset.editCat);return;}
        const dc=e.target.closest('[data-delete-cat]');if(dc){await categoryDelete(dc.dataset.deleteCat);return;}
        const ov=e.target.closest('[data-overdue]');if(ov){await sendOverdueMail(ov.dataset.overdue);return;}
        const home=e.target.closest('[data-drive-home]');if(home){state.drive.path=[];renderDrive();return;}
        const crumb=e.target.closest('[data-drive-crumb]');if(crumb){const i=Number(crumb.dataset.driveCrumb);state.drive.path=state.drive.path.slice(0,i+1);renderDrive();return;}
        const di=e.target.closest('[data-drive-open]');if(di){openDriveItem(di.dataset.driveOpen);return;}
        const df=e.target.closest('[data-drive-file]');if(df){const f=state.drive.files.find(x=>String(x.id)===String(df.dataset.driveFile));if(f)window.open(f.drive_url||`https://drive.google.com/file/d/${f.drive_file_id}/view`,'_blank','noopener,noreferrer');return;}
        const da=e.target.closest('[data-drive-actions]');if(da){const [type,id]=da.dataset.driveActions.split(':');showDriveMenu(type,id);return;}
        const dop=e.target.closest('[data-drive-open-action]');if(dop){const id=dop.dataset.driveOpenAction;const f=state.drive.files.find(x=>String(x.id)===String(id));if(f)window.open(f.drive_url||`https://drive.google.com/file/d/${f.drive_file_id}/view`,'_blank','noopener,noreferrer');return;}
        const det=e.target.closest('[data-drive-details]');if(det){openDriveDetails(det.dataset.driveDetails);return;}
        const dm=e.target.closest('[data-drive-move]');if(dm){openMoveModal(dm.dataset.driveMove);return;}
        const del=e.target.closest('[data-drive-delete]');if(del){const [type,id]=del.dataset.driveDelete.split(':');await driveDelete(type,id);return;}
        const mt=e.target.closest('[data-move-target]');if(mt){await moveDriveItem(mt.dataset.moveTarget);return;}
        const cd=e.target.closest('[data-main-calendar-date]');if(cd){selectCalendarDate(cd.dataset.mainCalendarDate);return;}
        const ns=e.target.closest('[data-notification-section]');if(ns){closeNotifications();showSection(ns.dataset.notificationSection);return;}
      } catch(err){console.error(err);toast(errText(err),'error');}
    });
    document.addEventListener('click',e=>{if(!e.target.closest('.faculty-picker'))$('facultySuggestions')?.classList.add('hidden');});
  }

  function renderNotifications(){
    const items=[
      {label:'Book Requests',count:Number($('bookReqCount')?.textContent||0),section:'bookRequests',icon:'✉'},
      {label:'Return Requests',count:Number($('returnReqCount')?.textContent||0),section:'returnRequests',icon:'↩'},
      {label:'Faculty Requests',count:Number($('facultyCount')?.textContent||0),section:'facultyRequests',icon:'♙'},
      {label:'Overdue Books',count:Number($('overdueCount')?.textContent||0),section:'overdue',icon:'⚠'}
    ];
    const total=items.reduce((a,x)=>a+x.count,0);
    const badge=$('notificationCount'); if(badge){badge.textContent=total;badge.classList.toggle('hidden',total===0);}
    const body=$('notificationBody'); if(!body)return;
    body.innerHTML=items.filter(x=>x.count>0).map(x=>`<button type="button" class="notification-item" data-notification-section="${x.section}"><span class="notification-icon">${x.icon}</span><span><strong>${esc(x.label)}</strong><small>${x.count} pending</small></span><b>${x.count}</b></button>`).join('');
  }
  function toggleNotifications(){const p=$('notificationPanel');if(!p)return;renderNotifications();p.classList.toggle('hidden');}
  function closeNotifications(){$('notificationPanel')?.classList.add('hidden');}

  function closeAnalyticsModal(){$('analyticsModal')?.classList.remove('open');if(state.analyticsChart){state.analyticsChart.destroy();state.analyticsChart=null;}}

  // Backward-compatible global used by older cached dashboard markup.
  // Profile editing no longer requires verification codes.
  window.sendProfileVerificationCode = function(){
    toast('Verification code is no longer required. Choose Change Password, Change Mail, or Change Mobile No.','success');
  };

  window.matlibAdminActions={approveBookRequest,rejectBookRequest,approveReturnRequest,rejectReturnRequest,approveFaculty,rejectFaculty,openAdminProfile,saveProfilePassword,saveProfileEmail,saveProfilePhone};

  (async()=>{
    try{
      if(!(await requireAdmin()))return;
      init();
      const results=await Promise.allSettled([loadCategories(),loadBooks(),loadFacultyData(),updateStats()]);
      const failures=results.filter(r=>r.status==='rejected');
      if(failures.length){
        console.warn('MatLib partial dashboard load:',failures.map(r=>errText(r.reason)));
        setText('systemStatus','System Online');$('systemStatus')?.classList.remove('error');
        toast(`${failures.length} optional section${failures.length>1?'s':''} could not load. Other dashboard data is available.`,'error');
      }else{
        setText('systemStatus','System Online');$('systemStatus')?.classList.remove('error');
      }
      renderNotifications();
    }catch(e){console.error(e);setText('systemStatus','Connection error');$('systemStatus')?.classList.add('error');toast(errText(e),'error');}
  })();
})();
