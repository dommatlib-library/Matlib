(() => {
  'use strict';
  const sb = window.matlibSupabase || window.matlib?.sb;
  const $ = id => document.getElementById(id);
  if (!sb) return;
  const state = { books: [], categories: [], page: 1, size: 24 };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const available = b => String(b.availability)==='1' || String(b.availability).toLowerCase()==='true' || String(b.status||'').toLowerCase()==='available';
  const categoryName = id => state.categories.find(c=>String(c.id)===String(id))?.name || '';
  async function requireAdmin(){const {data,error}=await sb.auth.getSession();if(error)throw error;if(!data.session){location.href='admin.html';return false;}const r=await sb.from('admin_profiles').select('id,role,is_active').eq('id',data.session.user.id).maybeSingle();if(r.error)throw r.error;if(!r.data||r.data.role!=='admin'||!r.data.is_active){await sb.auth.signOut();location.href='admin.html';return false;}return true;}
  async function load(){
    const [cats,books]=await Promise.all([sb.from('categories').select('id,name').order('name'),sb.from('books').select('id,book_name,author_name,category,cupboard_no,status,created_at,updated_at,category_id,access_no,availability').order('book_name').limit(5000)]);
    if(cats.error)throw cats.error;if(books.error)throw books.error;state.categories=cats.data||[];state.books=books.data||[];
    const sel=$('catalogCategory');sel.innerHTML='<option value="">All categories</option>'+state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    $('totalBooks').textContent=state.books.length.toLocaleString('en-IN');$('availableBooks').textContent=state.books.filter(available).length.toLocaleString('en-IN');$('issuedBooks').textContent=state.books.filter(b=>!available(b)).length.toLocaleString('en-IN');$('categoryCount').textContent=state.categories.length.toLocaleString('en-IN');
    render();
  }
  function render(){
    const q=String($('catalogSearch').value||'').toLowerCase().trim(),cat=$('catalogCategory').value,status=$('catalogStatus').value;
    const rows=state.books.filter(b=>(!q||[b.book_name,b.author_name,b.access_no,b.cupboard_no,b.category,categoryName(b.category_id)].some(v=>String(v||'').toLowerCase().includes(q)))&&(!cat||String(b.category_id)===cat)&&(!status||String(b.status||'').toLowerCase()===status));
    const pages=Math.max(1,Math.ceil(rows.length/state.size));state.page=Math.min(state.page,pages);const pageRows=rows.slice((state.page-1)*state.size,state.page*state.size);const grid=$('catalogGrid');
    grid.innerHTML=pageRows.length?pageRows.map(b=>`<article class="admin-catalog-card"><div class="admin-catalog-cover"><span>√x</span><small>${esc((b.category||categoryName(b.category_id)||'BOOK').slice(0,18))}</small></div><div class="admin-catalog-body"><div class="admin-catalog-top"><span class="badge ${available(b)?'available':'issued'}">${available(b)?'Available':'Issued'}</span><code>${esc(b.access_no||'—')}</code></div><h3>${esc(b.book_name||'Untitled')}</h3><p>${esc(b.author_name||'Unknown author')}</p><div class="admin-catalog-meta"><span>${esc(b.category||categoryName(b.category_id)||'—')}</span><span>⌂ ${esc(b.cupboard_no||'—')}</span></div></div></article>`).join(''):'<div class="catalog-empty">No books found.</div>';
    $('catalogPager').innerHTML=pages>1?`<button class="btn secondary tiny" id="catPrev" ${state.page===1?'disabled':''}>←</button><span>Page ${state.page} of ${pages} · ${rows.length.toLocaleString('en-IN')} results</span><button class="btn secondary tiny" id="catNext" ${state.page===pages?'disabled':''}>→</button>`:'';
    $('catPrev')?.addEventListener('click',()=>{state.page--;render();});$('catNext')?.addEventListener('click',()=>{state.page++;render();});
  }
  document.addEventListener('DOMContentLoaded',async()=>{try{if(!(await requireAdmin()))return;await load();$('catalogSearch').addEventListener('input',()=>{state.page=1;render();});$('catalogCategory').addEventListener('change',()=>{state.page=1;render();});$('catalogStatus').addEventListener('change',()=>{state.page=1;render();});$('catalogRefresh').addEventListener('click',load);}catch(e){console.error(e);alert(e.message||'Unable to load catalogue.');}});
})();
