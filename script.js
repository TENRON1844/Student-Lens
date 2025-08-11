/* app.js
   - Full role-based editorial workflow (demo/localStorage + firebase-ready toggle)
   - Stages: pending -> editing -> reviewing -> published -> archived
   - Roles: admin, editor, reviewer, publisher, user
   - Views (unique per viewer) replace likes
   - Keeps original modals, login/signup, admin panel, filters, recent/news rendering
*/

/* =========================
   CONFIG
   ========================= */
const USE_FIREBASE = true; // flip later if you integrate Firebase
const LS_KEY = 'studentlens_demo_v1'; // keep same demo key so older demo data stays

/* =========================
   UTILITIES
   ========================= */
const uid = () => 'u_' + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const formatDate = (iso) => {
  const d = new Date(iso);
  return ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()};
};
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// safe element getter
const $ = id => document.getElementById(id);

/* =========================
   Demo seed data (localStorage)
   ========================= */
function seedDemoData() {
  const existing = localStorage.getItem(LS_KEY);
  if (existing) return JSON.parse(existing);

  const adminId = uid();
  const editorId = uid();
  const reviewerId = uid();
  const publisherId = uid();
  const studentId = uid();

  const users = {
    [adminId]: { id: adminId, name: 'Admin One', email: 'admin@school', role: 'admin', totalViews: 0 },
    [editorId]: { id: editorId, name: 'Editor One', email: 'editor@school', role: 'editor', totalViews: 0 },
    [reviewerId]: { id: reviewerId, name: 'Reviewer One', email: 'reviewer@school', role: 'reviewer', totalViews: 0 },
    [publisherId]: { id: publisherId, name: 'Publisher One', email: 'pub@school', role: 'publisher', totalViews: 0 },
    [studentId]: { id: studentId, name: 'Student', email: 'student@school', role: 'user', totalViews: 0 }
  };

  const articles = {};
  const a1 = uid(), a2 = uid(), a3 = uid();
  articles[a1] = {
    id: a1,
    title: 'Community Garden Project Launch',
    body: 'Students are starting a garden at school. Volunteers needed.',
    authorId: publisherId,
    stage: 'published',
    createdAt: nowISO(),
    views: 3,
    viewedBy: [],
    categorySuggested: 'Events',
    categoryFinal: 'Events'
  };
  articles[a2] = {
    id: a2,
    title: 'Math Competition Winners Announced',
    body: 'Results of the inter-school math competition.',
    authorId: publisherId,
    stage: 'pending', // just submitted
    createdAt: nowISO(),
    views: 0,
    viewedBy: [],
    categorySuggested: 'Science',
    categoryFinal: null
  };
  articles[a3] = {
    id: a3,
    title: 'Opinion: Cafeteria Menu Improvements',
    body: 'Short piece about food choices.',
    authorId: publisherId,
    stage: 'editing', // editor queue
    createdAt: nowISO(),
    views: 1,
    viewedBy: [],
    categorySuggested: 'Opinion',
    categoryFinal: null
  };

  const applications = {};
  const app1 = uid();
  applications[app1] = {
    id: app1,
    userId: studentId,
    reason: 'I would like to write about design and tech.',
    status: 'pending',
    reviewedBy: null,
    feedback: null,
    createdAt: nowISO()
  };

  const state = { users, articles, applications, meta: { lastUpdated: nowISO() } };
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  return state;
}

let STATE = seedDemoData();
let CURRENT_USER = null; // { id, name, role, ... }

/* =========================
   Persistence helpers
   ========================= */
function saveState() {
  STATE.meta = STATE.meta || {};
  STATE.meta.lastUpdated = nowISO();
  localStorage.setItem(LS_KEY, JSON.stringify(STATE));
  renderAll();
}

/* =========================
   Viewer ID (for anonymous unique views)
   ========================= */
function getViewerId() {
  if (CURRENT_USER) return CURRENT_USER.id;
  let v = sessionStorage.getItem('visitorId');
  if (!v) { v = 'v_' + Math.random().toString(36).slice(2,9); sessionStorage.setItem('visitorId', v); }
  return v;
}

/* =========================
   Modal helpers (existing in HTML)
   ========================= */
const modalRoot = $('modalRoot');
function showModal(innerHtml) {
  if (!modalRoot) return alert('Modal root missing');
  modalRoot.innerHTML = <div class="modal">${innerHtml}</div>;
  modalRoot.classList.add('show');
  modalRoot.setAttribute('aria-hidden', 'false');
}
function closeModal() {
  if (!modalRoot) return;
  modalRoot.classList.remove('show');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
}

/* =========================
   Authentication: login / logout / signup (demo)
   ========================= */
function loginAs(userId) {
  CURRENT_USER = STATE.users[userId] || null;
  renderAll();
}
function logout() {
  CURRENT_USER = null;
  renderAll();
}

/* =========================
   Render profile/login area
   ========================= */
function renderProfileArea() {
  const area = $('profileArea');
  if (!area) return;
  area.innerHTML = '';
  if (!CURRENT_USER) {
    // login & signup buttons
    const html = document.createElement('div');
    html.innerHTML = `
      <button class="outline-btn" id="loginBtn">Login</button>
      <button class="outline-btn" id="signupBtn">Sign Up</button>
    `;
    area.appendChild(html);
    $('#loginBtn')?.addEventListener('click', openLoginModal);
    $('#signupBtn')?.addEventListener('click', openSignupModal);
  } else {
    const p = document.createElement('div');
    p.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="img/IcsBuilding.jpg" alt="pic" class="prof-pic" onerror="this.style.opacity=.4">
        <div style="text-align:left">
          <div style="font-weight:800">${escapeHtml(CURRENT_USER.name)}</div>
          <div style="font-size:11px; opacity:.8">${escapeHtml(CURRENT_USER.role.toUpperCase())}</div>
        </div>
        <div style="margin-left:8px; display:flex; gap:8px; align-items:center;">
          <button class="outline-btn" id="accountBtn">Account</button>
          <button class="outline-btn" id="logoutBtn">Logout</button>
        </div>
      </div>
    `;
    area.appendChild(p);
    $('#accountBtn')?.addEventListener('click', openAccountPanel);
    $('#logoutBtn')?.addEventListener('click', () => { logout(); });
  }
}

/* =========================
   Render Recent + Small cards
   ========================= */
function renderRecent() {
  const container = $('recentList');
  if (!container) return;
  container.innerHTML = '';

  const published = Object.values(STATE.articles).filter(a => a.stage === 'published').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  const hero = published[0] || null;

  if (!hero) {
    container.innerHTML = <div class="hero-card" style="display:flex;align-items:center;justify-content:center;padding:40px;color:#777">No published articles yet</div>;
  } else {
    const heroHtml = document.createElement('article');
    heroHtml.className = 'hero-card';
    heroHtml.addEventListener('click', () => openArticleModal(hero.id));
    heroHtml.innerHTML = `
      <div class="hero-image"><img src="img/Placeholder.jpg" alt="hero"></div>
      <div class="hero-meta">
        <span class="small-badge badge-blue">${hero.categoryFinal || hero.categorySuggested || 'CATEGORY'}</span>
        <h2 class="hero-title">${escapeHtml(hero.title)}</h2>
        <div class="meta-small">${STATE.users[hero.authorId]?.name || 'Unknown'} • ${formatDate(hero.createdAt)}</div>
      </div>
    `;
    container.appendChild(heroHtml);
  }

  // next two small cards
  const smalls = published.slice(1,3);
  const wrap = document.createElement('div');
  wrap.style.flex = '1';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '12px';
  if (smalls.length === 0) {
    wrap.innerHTML = <div class="small-card" style="padding:24px;text-align:center;color:#777">No other recent articles</div>;
  } else {
    smalls.forEach(s => {
      const node = document.createElement('article');
      node.className = 'small-card';
      node.addEventListener('click', () => openArticleModal(s.id));
      node.innerHTML = `
        <div class="small-image"><img src="img/Placeholder.jpg" alt="small"></div>
        <span class="small-badge badge-blue">${s.categoryFinal || s.categorySuggested || 'CATEGORY'}</span>
        <h4 class="small-title">${escapeHtml(s.title)}</h4>
        <div class="meta-small">${STATE.users[s.authorId]?.name || 'Unknown'} • ${formatDate(s.createdAt)}</div>
      `;
      wrap.appendChild(node);
    });
  }
  container.appendChild(wrap);
}

/* =========================
   News grid / Filters
   ========================= */
let CURRENT_FILTER = 'ALL';
function renderNewsGrid() {
  const grid = $('newsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let list = Object.values(STATE.articles).filter(a => a.stage === 'published').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  if (CURRENT_FILTER !== 'ALL') {
    list = list.filter(a => (a.categoryFinal || a.categorySuggested) === CURRENT_FILTER);
  }

  if (list.length === 0) {
    grid.innerHTML = <div style="grid-column:1/-1;padding:24px;text-align:center;color:#777">No articles</div>;
    return;
  }

  list.forEach(a => {
    const card = document.createElement('article');
    card.className = 'grid-card';
    card.addEventListener('click', () => openArticleModal(a.id));
    const canRemove = (CURRENT_USER && canUserRemove(CURRENT_USER, a));
    card.innerHTML = `
      <div class="card-media"></div>
      <div class="card-body">
        <span class="badge badge-orange small-badge">${a.categoryFinal || a.categorySuggested || 'CATEGORY'}</span>
        <h4 class="card-title">${escapeHtml(a.title)}</h4>
        <div class="meta-small">${STATE.users[a.authorId]?.name || 'Unknown'} • ${formatDate(a.createdAt)}</div>
        <div style="margin-top:8px; display:flex; gap:10px; align-items:center;">
          <div class="muted">Views: ${a.views || 0}</div>
          ${canRemove ? <button class="outline-btn remove-btn" data-id="${a.id}">Remove</button> : ''}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // remove handlers (stop click propagation)
  document.querySelectorAll('.remove-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.getAttribute('data-id');
      if (confirm('Remove article? This will delete it from visible lists (demo mode).')) {
        delete STATE.articles[id];
        saveState();
      }
    });
  });
}

/* =========================
   Permission helpers
   ========================= */
function canUserRemove(user, article) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'reviewer') return true;
  if (article.authorId === user.id && ['pending','editing','reviewing'].includes(article.stage)) return true;
  return false;
}

/* pending count rendering with strict visibility */
function renderPendingCount() {
  let pending = Object.values(STATE.articles).filter(a => a.stage !== 'published' && a.stage !== 'archived');
  if (!CURRENT_USER) pending = [];
  else {
    if (CURRENT_USER.role === 'publisher') pending = pending.filter(a => a.authorId === CURRENT_USER.id);
    else if (CURRENT_USER.role === 'user') pending = [];
    // editor/reviewer/admin see all pending
  }
  const el = $('pendingCount');
  if (el) el.textContent = pending.length;
}

/* =========================
   Article open modal & view tracking
   ========================= */
function openArticleModal(articleId) {
  const a = STATE.articles[articleId];
  if (!a) return alert('Article not found');

  // permission: if not published, restrict to author/editor/reviewer/admin
  if (a.stage !== 'published') {
    if (!CURRENT_USER) return alert('This article is not published yet.');
    const allowed = ['admin','editor','reviewer'];
    if (!(allowed.includes(CURRENT_USER.role) || a.authorId === CURRENT_USER.id)) {
      return alert('You do not have permission to view this pending article.');
    }
  }

  // views tracking (unique viewer)
  const viewer = getViewerId();
  a.viewedBy = a.viewedBy || [];
  if (a.stage === 'published' && !a.viewedBy.includes(viewer)) {
    a.viewedBy.push(viewer);
    a.views = (a.views || 0) + 1;
    const author = STATE.users[a.authorId];
    if (author) author.totalViews = (author.totalViews || 0) + 1;
    saveState();
  }

  // Build modal content with role-specific action buttons
  let html = `<h3>${escapeHtml(a.title)}</h3>
    <div style="opacity:.8;margin-bottom:8px;">By ${escapeHtml(STATE.users[a.authorId]?.name || 'Unknown')} • ${formatDate(a.createdAt)}</div>
    <div style="margin-top:6px;">${escapeHtml(a.body)}</div>
    <div style="margin-top:12px;">Stage: <strong>${a.stage}</strong> • Views: ${a.views||0}</div>
    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">`;

  // Actions for Editor (can edit any article; if article in pending, editors should place it into editing)
  if (CURRENT_USER && CURRENT_USER.role === 'editor') {
    // Editor can see ALL articles and edit them
    html += <button class="outline-btn" id="editorEditBtn">Edit</button>;
    if (a.stage === 'pending' || a.stage === 'editing') {
      html += <button class="outline-btn" id="editorMoveBtn">Move to reviewer</button>;
    }
    html += <button class="outline-btn" id="editorRejectBtn">Reject (Archive)</button>;
  }

  // Actions for Reviewer
  if (CURRENT_USER && CURRENT_USER.role === 'reviewer') {
    // If in reviewing stage -> publish or send back
    if (a.stage === 'reviewing') {
      html += <button class="outline-btn" id="reviewerSendBack">Send Back</button>;
      html += <button class="outline-btn" id="reviewerPublish">Publish</button>;
    } else {
      // reviewer can still edit and archive if needed
      html += <button class="outline-btn" id="reviewerEditBtn">Edit</button>;
      html += <button class="outline-btn" id="reviewerArchiveBtn">Archive</button>;
    }
  }

  // Admin actions (full control)
  if (CURRENT_USER && CURRENT_USER.role === 'admin') {
    html += <button class="outline-btn" id="adminEditBtn">Edit</button>;
    html += <button class="outline-btn" id="adminMoveBtn">Move to reviewer</button>;
    html += <button class="outline-btn" id="adminSendBack">Send Back</button>;
    html += <button class="outline-btn" id="adminPublish">Publish</button>;
    html += <button class="outline-btn" id="adminArchive">Archive</button>;
  }

  // Author actions (publisher can edit their own drafts and delete pending)
  if (CURRENT_USER && a.authorId === CURRENT_USER.id) {
    if (['pending','editing','reviewing'].includes(a.stage)) {
      html += <button class="outline-btn" id="authorEditBtn">Edit</button>;
      html += <button class="outline-btn" id="authorDeleteBtn">Delete</button>;
    }
  }

  html += <button class="outline-btn" id="closeModal">Close</button></div>;

  showModal(html);

  // Binding actions (edit opens edit modal)
  $('#closeModal')?.addEventListener('click', closeModal);

  // Editor handlers
  $('#editorEditBtn')?.addEventListener('click', () => { closeModal(); openEditArticleModal(a.id, 'editor'); });
  $('#editorMoveBtn')?.addEventListener('click', () => {
    a.stage = 'reviewing';
    saveState();
    closeModal();
    alert('Moved to reviewer queue.');
  });
  $('#editorRejectBtn')?.addEventListener('click', () => {
    if (!confirm('Reject and archive this article? This will move it to Archive.')) return;
    a.stage = 'archived';
    saveState();
    closeModal();
    alert('Article archived.');
  });

  // Reviewer handlers
  $('#reviewerSendBack')?.addEventListener('click', () => {
    a.stage = 'editing';
    saveState();
    closeModal();
    alert('Sent back to editor.');
  });
  $('#reviewerPublish')?.addEventListener('click', () => {
    if (!confirm('Publish this article?')) return;
    a.stage = 'published';
    // optionally ensure categoryFinal exists (reviewer should set via edit if needed)
    saveState();
    closeModal();
    alert('Published.');
  });
  $('#reviewerEditBtn')?.addEventListener('click', () => { closeModal(); openEditArticleModal(a.id, 'reviewer'); });
  $('#reviewerArchiveBtn')?.addEventListener('click', () => {
    if (!confirm('Archive this article?')) return;
    a.stage = 'archived';
    saveState();
    closeModal();
    alert('Archived.');
  });

  // Admin handlers
  $('#adminEditBtn')?.addEventListener('click', () => { closeModal(); openEditArticleModal(a.id, 'admin'); });
  $('#adminMoveBtn')?.addEventListener('click', () => { a.stage = 'reviewing'; saveState(); closeModal(); alert('Moved to reviewer.'); });
  $('#adminSendBack')?.addEventListener('click', () => { a.stage = 'editing'; saveState(); closeModal(); alert('Sent back to editor.'); });
  $('#adminPublish')?.addEventListener('click', () => {
    if (!confirm('Publish this article?')) return;
    a.stage = 'published'; saveState(); closeModal(); alert('Published.');
  });
  $('#adminArchive')?.addEventListener('click', () => {
    if (!confirm('Archive this article?')) return;
    a.stage = 'archived'; saveState(); closeModal(); alert('Archived.');
  });

  // Author handlers
  $('#authorEditBtn')?.addEventListener('click', () => { closeModal(); openEditArticleModal(a.id, 'author'); });
  $('#authorDeleteBtn')?.addEventListener('click', () => {
    if (!confirm('Delete this article? This will remove it permanently in demo mode.')) return;
    delete STATE.articles[a.id];
    saveState();
    closeModal();
    alert('Deleted.');
  });
}

/* =========================
   Submit Article (publisher / admin)
   - Publishers' submissions go to editor inbox: stage = 'pending'
   ========================= */
function openSubmissionModal() {
  if (!CURRENT_USER) { alert('Log in to submit'); return; }
  if (!(CURRENT_USER.role === 'publisher' || CURRENT_USER.role === 'admin')) {
    alert('Only publishers (or admins) can submit articles. You can apply to become a writer via "Become a Writer".');
    return;
  }
  const html = `
    <h3>Submit Article</h3>
    <label>Title</label>
    <input id="subTitle" class="input" placeholder="Article title">
    <label style="margin-top:8px;">Body</label>
    <textarea id="subBody" class="input" placeholder="Article body"></textarea>
    <label style="margin-top:8px;">Suggested Category</label>
    <select id="subCat" class="input" style="width:auto;padding:8px;border-radius:8px;">
      <option>Science</option><option>Sports</option><option>Opinion</option><option>Events</option>
    </select>
    <div style="margin-top:12px;text-align:right;">
      <button class="outline-btn" id="submitArticleBtn">Submit</button>
      <button class="outline-btn" id="cancelSubmitBtn">Cancel</button>
    </div>
  `;
  showModal(html);
  $('#submitArticleBtn')?.addEventListener('click', () => {
    const t = $('#subTitle')?.value.trim();
    const b = $('#subBody')?.value.trim();
    const cat = $('#subCat')?.value;
    if (!t || !b) return alert('Add title & body');
    const id = uid();
    STATE.articles[id] = {
      id,
      title: t,
      body: b,
      authorId: CURRENT_USER.id,
      stage: 'pending', // goes to editor inbox
      createdAt: nowISO(),
      views: 0,
      viewedBy: [],
      categorySuggested: cat,
      categoryFinal: null
    };
    saveState();
    closeModal();
    alert('Submitted — will go to editors.');
  });
  $('#cancelSubmitBtn')?.addEventListener('click', closeModal);
}

/* =========================
   Edit article modal (author/editor/reviewer/admin)
   - Editors can edit ANY article (as requested)
   - Provide controls to set final category if needed
   - When editor finishes editing they can choose to save and either move on or not
   ========================= */
function openEditArticleModal(articleId, editorRole = 'author') {
  const a = STATE.articles[articleId];
  if (!a) return alert('Article not found');
  if (!CURRENT_USER) return alert('Log in to edit');
  // permission: author can edit own non-published articles; editors/reviewers/admin can edit all
  if (CURRENT_USER.role === 'user' && a.authorId !== CURRENT_USER.id) return alert('No permission to edit');
  if (CURRENT_USER.role === 'publisher' && a.authorId !== CURRENT_USER.id) return alert('No permission to edit');
  // editors/reviewers/admin allowed

  // Build editor modal
  const html = `
    <h3>Edit Article</h3>
    <label>Title</label>
    <input id="editTitle" class="input" value="${escapeHtml(a.title)}">
    <label style="margin-top:8px;">Body</label>
    <textarea id="editBody" class="input">${escapeHtml(a.body)}</textarea>
    <label style="margin-top:8px;">Suggested Category</label>
    <select id="editSuggested" class="input" style="width:auto;padding:8px;border-radius:8px;">
      <option ${a.categorySuggested==='Science'?'selected':''}>Science</option>
      <option ${a.categorySuggested==='Sports'?'selected':''}>Sports</option>
      <option ${a.categorySuggested==='Opinion'?'selected':''}>Opinion</option>
      <option ${a.categorySuggested==='Events'?'selected':''}>Events</option>
    </select>
    <label style="margin-top:8px;">Final Category (for reviewer/admin)</label>
    <select id="editFinal" class="input" style="width:auto;padding:8px;border-radius:8px;">
      <option ${a.categoryFinal==='Science'?'selected':''}>Science</option>
      <option ${a.categoryFinal==='Sports'?'selected':''}>Sports</option>
      <option ${a.categoryFinal==='Opinion'?'selected':''}>Opinion</option>
      <option ${a.categoryFinal==='Events'?'selected':''}>Events</option>
    </select>
    <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="outline-btn" id="saveEditBtn">Save</button>
      <button class="outline-btn" id="saveAndMoveBtn">Save & Move (Editor → Reviewer)</button>
      <button class="outline-btn" id="cancelEditBtn">Cancel</button>
    </div>
  `;
  showModal(html);

  $('#saveEditBtn')?.addEventListener('click', () => {
    a.title = $('#editTitle')?.value.trim();
    a.body = $('#editBody')?.value.trim();
    a.categorySuggested = $('#editSuggested')?.value;
    a.categoryFinal = $('#editFinal')?.value || a.categoryFinal;
    saveState();
    closeModal();
    alert('Saved changes.');
  });

  $('#saveAndMoveBtn')?.addEventListener('click', () => {
    a.title = $('#editTitle')?.value.trim();
    a.body = $('#editBody')?.value.trim();
    a.categorySuggested = $('#editSuggested')?.value;
    a.categoryFinal = $('#editFinal')?.value || a.categoryFinal;
    // only editors/admin should use this button; move to reviewer stage
    a.stage = 'reviewing';
    saveState();
    closeModal();
    alert('Saved and moved to reviewer.');
  });

  $('#cancelEditBtn')?.addEventListener('click', closeModal);
}

/* =========================
   My Articles view / role-specific sections
   - Publisher: all own articles + totalViews
   - Editor: all editing-stage articles in their "My articles"
   - Reviewer: all reviewing-stage articles in their "My articles"
   - Admin: split into sections: pending / editing / reviewing (plus archive link)
   ========================= */
function openMyArticles() {
  if (!CURRENT_USER) { alert('Login to view your articles'); return; }

  const role = CURRENT_USER.role;
  if (role === 'publisher') {
    const my = Object.values(STATE.articles).filter(a => a.authorId === CURRENT_USER.id).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    let html = `<h3>My Articles (Publisher)</h3>
      <div style="margin-top:8px;">Total views across your articles: <strong>${CURRENT_USER.totalViews||0}</strong></div>
      <div style="margin-top:10px; display:flex;flex-direction:column;gap:8px;">`;
    if (my.length===0) html += <div>No articles yet</div>;
    my.forEach(a => {
      html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;">
        <strong>${escapeHtml(a.title)}</strong> <span style="opacity:.7">(${a.stage})</span>
        <div style="margin-top:6px;">Views: ${a.views||0} • ${formatDate(a.createdAt)}</div>
        <div style="margin-top:8px;">
          <button class="outline-btn edit-mine" data-id="${a.id}">Edit</button>
          ${(a.stage !== 'published') ? <button class="outline-btn delete-mine" data-id="${a.id}">Delete</button> : ''}
        </div>
      </div>`;
    });
    html += </div><div style="margin-top:12px;text-align:right;"><button class="outline-btn" id="closeMy">Close</button></div>;
    showModal(html);
    document.querySelectorAll('.edit-mine').forEach(b => b.addEventListener('click', (e)=> openEditArticleModal(e.target.getAttribute('data-id'), 'author')));
    document.querySelectorAll('.delete-mine').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      if (!confirm('Delete this article?')) return;
      delete STATE.articles[id];
      saveState();
      closeModal();
    }));
    $('#closeMy')?.addEventListener('click', closeModal);
    return;
  }

  if (role === 'editor') {
    const editing = Object.values(STATE.articles).filter(a => a.stage === 'editing').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    let html = <h3>Editor — Editing Queue</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">;
    if (editing.length===0) html += <div>No items in editor queue</div>;
    editing.forEach(a => {
      html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;">
        <strong>${escapeHtml(a.title)}</strong> <div style="opacity:.7">${STATE.users[a.authorId]?.name} • ${formatDate(a.createdAt)}</div>
        <div style="margin-top:8px;">
          <button class="outline-btn editor-edit" data-id="${a.id}">Edit</button>
          <button class="outline-btn editor-move" data-id="${a.id}">Move to reviewer</button>
          <button class="outline-btn editor-reject" data-id="${a.id}">Reject → Archive</button>
        </div>
      </div>`;
    });
    html += </div><div style="margin-top:12px;text-align:right;"><button class="outline-btn" id="closeEd">Close</button></div>;
    showModal(html);
    document.querySelectorAll('.editor-edit').forEach(b => b.addEventListener('click', (e)=> openEditArticleModal(e.target.getAttribute('data-id'),'editor')));
    document.querySelectorAll('.editor-move').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      STATE.articles[id].stage = 'reviewing';
      saveState();
      alert('Moved to reviewer.');
      closeModal();
    }));
    document.querySelectorAll('.editor-reject').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      if (!confirm('Reject this article? This will archive it.')) return;
      STATE.articles[id].stage = 'archived';
      saveState();
      alert('Archived.');
      closeModal();
    }));
    $('#closeEd')?.addEventListener('click', closeModal);
    return;
  }

  if (role === 'reviewer') {
    const reviewing = Object.values(STATE.articles).filter(a => a.stage === 'reviewing').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    let html = <h3>Reviewer — Reviewing Queue</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">;
    if (reviewing.length===0) html += <div>No items in reviewer queue</div>;
    reviewing.forEach(a => {
      html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;">
        <strong>${escapeHtml(a.title)}</strong> <div style="opacity:.7">${STATE.users[a.authorId]?.name} • ${formatDate(a.createdAt)}</div>
        <div style="margin-top:8px;">
          <button class="outline-btn reviewer-edit" data-id="${a.id}">Edit</button>
          <button class="outline-btn reviewer-sendback" data-id="${a.id}">Send Back</button>
          <button class="outline-btn reviewer-publish" data-id="${a.id}">Publish</button>
        </div>
      </div>`;
    });
    html += </div><div style="margin-top:12px;text-align:right;"><button class="outline-btn" id="closeRev">Close</button></div>;
    showModal(html);
    document.querySelectorAll('.reviewer-edit').forEach(b => b.addEventListener('click', (e)=> openEditArticleModal(e.target.getAttribute('data-id'),'reviewer')));
    document.querySelectorAll('.reviewer-sendback').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      STATE.articles[id].stage = 'editing';
      saveState();
      alert('Sent back to editor.');
      closeModal();
    }));
    document.querySelectorAll('.reviewer-publish').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      if (!confirm('Publish this article?')) return;
      STATE.articles[id].stage = 'published';
      saveState();
      alert('Published.');
      closeModal();
    }));
    $('#closeRev')?.addEventListener('click', closeModal);
    return;
  }

  if (role === 'admin') {
    // Admin sees three subsections: pending, editing, reviewing
    const pending = Object.values(STATE.articles).filter(a => a.stage === 'pending').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    const editing = Object.values(STATE.articles).filter(a => a.stage === 'editing').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    const reviewing = Object.values(STATE.articles).filter(a => a.stage === 'reviewing').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    const archived = Object.values(STATE.articles).filter(a => a.stage === 'archived').sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    let html = `<h3>Admin — Articles Overview</h3>
      <div style="margin-top:8px;"><strong>Pending (${pending.length})</strong></div>`;
    pending.forEach(a => {
      html += `<div style="padding:8px;border-radius:6px;background:#fff;margin-top:6px;">
        <strong>${escapeHtml(a.title)}</strong> — ${STATE.users[a.authorId]?.name} <div style="opacity:.7">${formatDate(a.createdAt)}</div>
        <div style="margin-top:6px;"><button class="outline-btn admin-open" data-id="${a.id}">Open</button></div>
      </div>`;
    });
    html += <div style="margin-top:10px;"><strong>Editing (${editing.length})</strong></div>;
    editing.forEach(a => {
      html += `<div style="padding:8px;border-radius:6px;background:#fff;margin-top:6px;">
        <strong>${escapeHtml(a.title)}</strong> — ${STATE.users[a.authorId]?.name}
        <div style="margin-top:6px;"><button class="outline-btn admin-open" data-id="${a.id}">Open</button></div>
      </div>`;
    });
    html += <div style="margin-top:10px;"><strong>Reviewing (${reviewing.length})</strong></div>;
    reviewing.forEach(a => {
      html += `<div style="padding:8px;border-radius:6px;background:#fff;margin-top:6px;">
        <strong>${escapeHtml(a.title)}</strong> — ${STATE.users[a.authorId]?.name}
        <div style="margin-top:6px;"><button class="outline-btn admin-open" data-id="${a.id}">Open</button></div>
      </div>`;
    });
    html += <div style="margin-top:10px;"><strong>Archived (${archived.length})</strong> — viewable by Admin & Reviewer</div>;
    html += <div style="margin-top:12px;text-align:right;"><button class="outline-btn" id="closeAdminArticles">Close</button></div>;
    showModal(html);
    document.querySelectorAll('.admin-open').forEach(b => b.addEventListener('click', (e)=> openArticleModal(e.target.getAttribute('data-id'))));
    $('#closeAdminArticles')?.addEventListener('click', closeModal);
    return;
  }

  // default for other roles not handled above (shouldn't happen)
  alert('No specific My Articles view for your role.');
}

/* =========================
   Become a Writer application flow
   - Students see Become a Writer button
   - Admins can accept/reject applications (promote to publisher on accept)
   ========================= */
function openApplyModal() {
  const html = `
    <h3>Apply to Become a Writer</h3>
    <p>One question: Why do you want to be a writer?</p>
    <textarea id="appReason" class="input" placeholder="Your reason..."></textarea>
    <div style="margin-top:12px;text-align:right;">
      <button class="outline-btn" id="applyNowBtn">Submit Application</button>
      <button class="outline-btn" id="cancelAppBtn">Cancel</button>
    </div>
  `;
  showModal(html);
  $('#applyNowBtn')?.addEventListener('click', () => {
    if (!CURRENT_USER) return alert('Please sign up / log in first');
    const reason = $('#appReason')?.value.trim();
    if (!reason) return alert('Please write a reason');
    const id = uid();
    STATE.applications[id] = {
      id,
      userId: CURRENT_USER.id,
      reason,
      status: 'pending',
      reviewedBy: null,
      feedback: null,
      createdAt: nowISO()
    };
    saveState();
    closeModal();
    alert('Application submitted — admins will review it.');
  });
  $('#cancelAppBtn')?.addEventListener('click', closeModal);
}

/* Admin panel (applications & role changes) - preserve original admin functionality */
function openAdminPanel() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return alert('Admins only');
  let html = <h3>Admin Panel</h3>;

  // Applications
  const apps = Object.values(STATE.applications).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  html += <div style="margin-top:8px;"><strong>Applications</strong><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">;
  if (apps.length===0) html += <div>No applications</div>;
  apps.forEach(ap => {
    const u = STATE.users[ap.userId];
    html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;">
      <div><strong>${escapeHtml(u?.name || 'Unknown')}</strong> • ${formatDate(ap.createdAt)}</div>
      <div style="margin-top:6px;">${escapeHtml(ap.reason)}</div>
      <div style="margin-top:8px;">
        <button class="outline-btn accept-app" data-id="${ap.id}">Accept</button>
        <button class="outline-btn reject-app" data-id="${ap.id}">Reject</button>
      </div>
    </div>`;
  });
  html += </div></div>;

  // User list & role management
  const users = Object.values(STATE.users);
  html += <div style="margin-top:14px;"><strong>Users</strong><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">;
  users.forEach(u => {
    html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;display:flex;justify-content:space-between;align-items:center;">
      <div>${escapeHtml(u.name)} <div style="font-size:12px;opacity:.7">${escapeHtml(u.email || '')}</div></div>
      <div>
        <select class="role-select" data-id="${u.id}">
          <option value="admin"${u.role==='admin'?' selected':''}>Admin</option>
          <option value="reviewer"${u.role==='reviewer'?' selected':''}>Reviewer</option>
          <option value="editor"${u.role==='editor'?' selected':''}>Editor</option>
          <option value="publisher"${u.role==='publisher'?' selected':''}>Publisher</option>
          <option value="user"${u.role==='user'?' selected':''}>User</option>
        </select>
      </div>
    </div>`;
  });
  html += </div></div>;

  html += <div style="margin-top:12px;text-align:right;"><button class="outline-btn" id="closeAdmin">Close</button></div>;
  showModal(html);

  // Application handlers
  document.querySelectorAll('.accept-app').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const ap = STATE.applications[id];
      if (!ap) return;
      ap.status = 'accepted';
      ap.reviewedBy = CURRENT_USER.id;
      ap.feedback = 'Welcome — you are accepted';
      // promote user to publisher
      STATE.users[ap.userId].role = 'publisher';
      saveState();
      alert('Application accepted and user promoted to publisher (demo). Simulated email sent.');
      closeModal();
    });
  });

  document.querySelectorAll('.reject-app').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const ap = STATE.applications[id];
      if (!ap) return;
      const reason = prompt('Reason for rejection (will be stored):', 'Not a fit right now.');
      ap.status = 'rejected';
      ap.reviewedBy = CURRENT_USER.id;
      ap.feedback = reason || 'Rejected';
      saveState();
      alert('Application rejected (demo).');
      closeModal();
    });
  });

  // role-select handlers
  document.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = sel.getAttribute('data-id');
      const r = sel.value;
      STATE.users[id].role = r;
      saveState();
      alert(Set role ${STATE.users[id].name} → ${r});
    });
  });

  $('#closeAdmin')?.addEventListener('click', closeModal);
}

/* =========================
   Login / Signup modals (demo)
   ========================= */
function openLoginModal() {
  let usersHtml = '';
  Object.values(STATE.users).forEach(u => {
    usersHtml += `<div style="padding:8px;border-radius:6px;border:1px solid rgba(0,0,0,.04);margin-bottom:6px; display:flex;justify-content:space-between;align-items:center;">
      <div><strong>${escapeHtml(u.name)}</strong><div style="font-size:12px;opacity:.7">${escapeHtml(u.role)}</div></div>
      <button class="outline-btn small-login" data-id="${u.id}">Use</button>
    </div>`;
  });

  const html = `<h3>Login (Demo)</h3>
    <div style="margin-bottom:12px;">Pick a demo user to impersonate (no password needed in demo)</div>
    ${usersHtml}
    <div style="text-align:right;margin-top:8px;"><button class="outline-btn" id="closeLogin">Close</button></div>`;
  showModal(html);

  document.querySelectorAll('.small-login').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      loginAs(id);
      closeModal();
    });
  });
  $('#closeLogin')?.addEventListener('click', closeModal);
}

function openSignupModal() {
  const html = `
    <h3>Sign Up (Demo)</h3>
    <label>Name</label><input id="suName" class="input" placeholder="Your name">
    <label style="margin-top:8px;">Email</label><input id="suEmail" class="input" placeholder="you@school">
    <div style="margin-top:12px;text-align:right;">
      <button class="outline-btn" id="doSignup">Create</button>
      <button class="outline-btn" id="cancelSignup">Cancel</button>
    </div>
  `;
  showModal(html);
  $('#doSignup')?.addEventListener('click', () => {
    const name = $('#suName')?.value.trim();
    const email = $('#suEmail')?.value.trim();
    if (!name || !email) return alert('Add name and email');
    const id = uid();
    STATE.users[id] = { id, name, email, role: 'user', totalViews: 0 };
    saveState();
    loginAs(id);
    closeModal();
  });
  $('#cancelSignup')?.addEventListener('click', closeModal);
}

/* =========================
   Account panel (role-specific)
   - Admin -> admin panel
   - Publisher -> publisher dashboard (total views + my articles + submit)
   - Editor -> editor queue
   - Reviewer -> reviewer queue + archive access
   - User -> basic info & apply to write
   ========================= */
function openAccountPanel() {
  if (!CURRENT_USER) return openLoginModal();

  if (CURRENT_USER.role === 'admin') return openAdminPanel();

  if (CURRENT_USER.role === 'publisher') {
    let html = `<h3>Publisher Account</h3>
      <div style="margin-top:8px;">Total views across your articles: <strong>${CURRENT_USER.totalViews || 0}</strong></div>
      <div style="margin-top:12px;"><strong>Your Articles</strong><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">`;
    const my = Object.values(STATE.articles).filter(a => a.authorId === CURRENT_USER.id).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    if (my.length === 0) html += <div>No articles yet</div>;
    my.forEach(a => {
      html += `<div style="padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.04);background:#fff;">
        <strong>${escapeHtml(a.title)}</strong> <span style="opacity:.7">(${a.stage})</span>
        <div style="margin-top:6px;">Views: ${a.views || 0}</div>
        <div style="margin-top:8px;">
          <button class="outline-btn edit-mine" data-id="${a.id}">Edit</button>
          ${(a.stage!=='published')? <button class="outline-btn delete-mine" data-id="${a.id}">Delete</button>: ''}
        </div>
      </div>`;
    });
    html += `</div></div><div style="margin-top:12px;text-align:right;">
      <button class="outline-btn" id="openSubmitFromAccount">Submit Article</button>
      <button class="outline-btn" id="closeAccount">Close</button>
    </div>`;
    showModal(html);
    document.querySelectorAll('.edit-mine').forEach(b => b.addEventListener('click', (e)=> openEditArticleModal(e.target.getAttribute('data-id'),'author')));
    document.querySelectorAll('.delete-mine').forEach(b => b.addEventListener('click', (e)=> {
      const id = e.target.getAttribute('data-id');
      if (!confirm('Delete this article?')) return;
      delete STATE.articles[id];
      saveState();
      closeModal();
    }));
    $('#openSubmitFromAccount')?.addEventListener('click', openSubmissionModal);
    $('#closeAccount')?.addEventListener('click', closeModal);
    return;
  }

  if (CURRENT_USER.role === 'editor') return openMyArticles();
  if (CURRENT_USER.role === 'reviewer') return openMyArticles();

  // Normal student / user
  let html = `<h3>Account</h3><div style="margin-top:8px;">Name: <strong>${escapeHtml(CURRENT_USER.name)}</strong></div>
    <div style="margin-top:8px;">Role: <strong>${escapeHtml(CURRENT_USER.role)}</strong></div>
    <div style="margin-top:12px;">
      <button class="outline-btn" id="applyToWrite">Apply to be a writer</button>
      <button class="outline-btn" id="closeAcct">Close</button>
    </div>`;
  showModal(html);
  $('#applyToWrite')?.addEventListener('click', () => { closeModal(); openApplyModal(); });
  $('#closeAcct')?.addEventListener('click', closeModal);
}

/* =========================
   Wiring UI events (safe)
   ========================= */
if ($('becomeWriterBtn')) $('becomeWriterBtn').addEventListener('click', openApplyModal);
// some templates used earlier may refer to becomeWriterLink
if ($('becomeWriterLink')) $('becomeWriterLink').addEventListener('click', openApplyModal);
if ($('newArticleBtn')) $('newArticleBtn').addEventListener('click', openSubmissionModal);
if ($('myArticlesBtn')) $('myArticlesBtn').addEventListener('click', openMyArticles);
if ($('aboutLink')) $('aboutLink').addEventListener('click', (e)=> { e.preventDefault(); alert('This is a demo of the Student Lens workflow.'); });

if ($('filterRow')) {
  $('filterRow').addEventListener('click', (e) => {
    if (e.target && e.target.matches('button.filter')) {
      CURRENT_FILTER = e.target.getAttribute('data-cat') || 'ALL';
      renderNewsGrid();
    }
  });
}

/* quick admin panel via key A */
document.addEventListener('keydown', (e) => {
  if (e.key === 'A' || e.key === 'a') {
    if (CURRENT_USER && CURRENT_USER.role === 'admin') openAdminPanel();
  }
});

/* close modal clicking outside */
if (modalRoot) {
  modalRoot.addEventListener('click', (ev) => {
    if (ev.target === modalRoot) closeModal();
  });
}

/* =========================
   Render all
   ========================= */
function applyButtonVisibility() {
  // Student: should not see newArticleBtn or myArticlesBtn or pending info.
  // Other roles: hide becomeWriterBtn.
  if (!$('becomeWriterBtn')) return; // safety
  if (!CURRENT_USER) {
    $('becomeWriterBtn').style.display = 'block';
    if ($('newArticleBtn')) $('newArticleBtn').style.display = 'none';
    if ($('myArticlesBtn')) $('myArticlesBtn').style.display = 'none';
    return;
  }
  const r = CURRENT_USER.role;
  if (r === 'user') {
    $('becomeWriterBtn').style.display = 'block';
    if ($('newArticleBtn')) $('newArticleBtn').style.display = 'none';
    if ($('myArticlesBtn')) $('myArticlesBtn').style.display = 'none';
  } else {
    $('becomeWriterBtn').style.display = 'none';
    if ($('newArticleBtn')) $('newArticleBtn').style.display = 'block';
    if ($('myArticlesBtn')) $('myArticlesBtn').style.display = 'block';
  }
}

function renderAll() {
  // top date
  if ($('topDate')) $('topDate').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  renderProfileArea();
  renderRecent();
  renderNewsGrid();
  renderPendingCount();
  applyButtonVisibility();
}

renderAll();

/* =========================
   Notes:
   - All destructive operations are two-step confirmations where appropriate.
   - To switch to a page-view instead of modal for articles, replace openArticleModal() calls
     with window.location.href = article.html?id=${articleId} and implement article.html to
     render content from localStorage or a backend.
   - USE_FIREBASE toggle is present for future migration; you'll replace localStorage reads/writes
     with Firestore reads/writes and add auth accordingly.
*/

