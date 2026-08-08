const LS_DRAFT_KEY = 'ai_app_portal_draft_v2';
let baseState = null;
let state = { meta: { title: 'AI 应用导航台', subtitle: '', adminPassword: '' }, categories: [], apps: [] };
let isAdmin = false;
let hasDraft = false;
let filter = { category: 'all', view: 'group', q: '' };

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---- data ----
async function loadBase() {
  try {
    const res = await fetch('apps.json?_=' + Date.now());
    return await res.json();
  } catch (e) {
    return { meta: { title: 'AI 应用导航台', subtitle: '', adminPassword: '' }, categories: [], apps: [] };
  }
}
function loadDraft() { try { return JSON.parse(localStorage.getItem(LS_DRAFT_KEY)); } catch (e) { return null; } }
function saveDraft() { localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(state)); }
function markDraft() { hasDraft = true; saveDraft(); renderBanner(); }

function hasPassword() { return !!(state.meta && state.meta.adminPassword); }

// ---- auth ----
function promptSetPassword() {
  const p1 = prompt('设置管理员密码（团队里只有你知道，建议至少 4 位）：');
  if (p1 === null) return;
  if (p1.length < 4) { toast('密码至少 4 位'); return; }
  const p2 = prompt('再输一次确认：');
  if (p2 !== p1) { toast('两次输入不一致'); return; }
  state.meta.adminPassword = p1;
  isAdmin = true;
  markDraft();
  applyMode();
  toast('已是管理员 · 现在可以编辑了');
}
function promptLogin() {
  const pwd = prompt('请输入管理员密码：');
  if (pwd === null) return;
  if (pwd === state.meta.adminPassword) {
    isAdmin = true;
    applyMode();
    toast('已进入管理模式');
  } else {
    toast('密码错误');
  }
}
function promptChangePassword() {
  const old = prompt('当前管理员密码：');
  if (old === null) return;
  if (old !== state.meta.adminPassword) { toast('原密码错误'); return; }
  const p1 = prompt('新密码（至少 4 位）：');
  if (p1 === null) return;
  if (p1.length < 4) { toast('密码至少 4 位'); return; }
  const p2 = prompt('再输一次新密码：');
  if (p2 !== p1) { toast('两次输入不一致'); return; }
  state.meta.adminPassword = p1;
  markDraft();
  toast('密码已修改（仅本地草稿，发布后同步给团队）');
}
function clearAdmin() {
  if (!confirm('确定取消管理员保护？取消后所有人都能编辑（不建议）。')) return;
  state.meta.adminPassword = '';
  isAdmin = true;
  markDraft();
  applyMode();
  toast('已取消管理员保护');
}
function logout() {
  isAdmin = false;
  applyMode();
  toast('已退出管理模式');
}

function applyMode() {
  document.body.classList.toggle('readonly', !isAdmin);
  renderMenu();
  updateTitleEditable();
  render();
}
function renderBanner() {
  const b = $('#draftBanner');
  if (b) b.hidden = !hasDraft;
}

// ---- dynamic menu ----
function renderMenu() {
  const wrap = $('#menuItems');
  if (!wrap) return;
  wrap.innerHTML = '';
  const hasPwd = hasPassword();
  if (!isAdmin) {
    if (!hasPwd) addM(wrap, '🔐  成为管理员（设置密码）', promptSetPassword);
    else addM(wrap, '🔑  管理员登录', promptLogin);
    addSep(wrap);
  } else {
    addM(wrap, '🏷️  管理分类', openCatModal);
    addM(wrap, '🔑  修改管理员密码', promptChangePassword);
    addM(wrap, '🔓  取消管理员保护', clearAdmin);
    addSep(wrap);
    addM(wrap, '⬆️  导入配置', () => $('#importFile').click());
    if (hasDraft) addM(wrap, '🗑  放弃本地草稿', discardDraft);
    addSep(wrap);
    addM(wrap, '🚪  退出管理模式', logout);
  }
  addM(wrap, '📤  导出配置' + (hasDraft ? '（发布给团队）' : ''), exportConfig);
}
function addM(wrap, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  if (fn) b.addEventListener('click', () => { $('#menu').hidden = true; fn(); });
  wrap.appendChild(b);
}
function addSep(wrap) {
  const d = document.createElement('div');
  d.className = 'menu-sep';
  wrap.appendChild(d);
}

// ---- editable title ----
function updateTitleEditable() {
  const t = $('#pageTitle');
  if (!t) return;
  if (isAdmin) { t.contentEditable = 'true'; t.classList.add('editable-title'); t.title = '点击修改名称'; }
  else { t.contentEditable = 'false'; t.classList.remove('editable-title'); t.removeAttribute('title'); }
}
function bindTitleEvents() {
  const t = $('#pageTitle');
  if (!t || t._titleBound) return;
  t._titleBound = true;
  t.addEventListener('blur', () => {
    if (!isAdmin) return;
    const v = (t.textContent || '').trim();
    const before = state.meta.title;
    state.meta.title = v || (before || 'AI 应用导航台');
    if (t.textContent !== state.meta.title) t.textContent = state.meta.title;
    if (state.meta.title !== before) markDraft();
  });
  t.addEventListener('keydown', (e) => {
    if (!isAdmin) return;
    if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
  });
}

// ---- category management ----
function openCatModal() { $('#catModal').hidden = false; renderCatList(); }
function closeCatModal() { $('#catModal').hidden = true; }
function renderCatList() {
  const list = $('#catList');
  if (!list) return;
  list.innerHTML = '';
  if (!state.categories.length) {
    list.innerHTML = '<div class="cat-empty">还没有分类，点击下方"添加分类"</div>';
    return;
  }
  state.categories.forEach((c, i) => {
    const used = state.apps.filter((a) => a.category === c.id).length;
    const row = document.createElement('div');
    row.className = 'cat-row';
    const ico = document.createElement('span'); ico.className = 'cat-icon'; ico.textContent = c.icon || '📦';
    const nm = document.createElement('span'); nm.className = 'cat-name'; nm.textContent = c.name;
    const cnt = document.createElement('span'); cnt.className = 'cat-count'; cnt.textContent = used + ' 个应用';
    const acts = document.createElement('div'); acts.className = 'cat-actions';
    const eb = document.createElement('button'); eb.textContent = '✎'; eb.title = '编辑';
    eb.addEventListener('click', () => editCat(i));
    const db = document.createElement('button'); db.textContent = '🗑'; db.title = '删除';
    db.addEventListener('click', () => delCat(i));
    acts.append(eb, db);
    row.append(ico, nm, cnt, acts);
    list.appendChild(row);
  });
}
function editCat(i) {
  const c = state.categories[i];
  const name = prompt('分类名称：', c.name);
  if (name === null) return;
  const icon = prompt('分类图标（emoji）：', c.icon || '📦');
  if (icon === null) return;
  c.name = (name || '').trim() || c.name;
  c.icon = (icon || '').trim() || c.icon;
  markDraft();
  renderCategories(); render(); renderCatList();
  toast('已更新分类');
}
function delCat(i) {
  const c = state.categories[i];
  const used = state.apps.filter((a) => a.category === c.id).length;
  let msg = '确定删除分类「' + c.name + '」？';
  if (used > 0) msg += '\n该分类下有 ' + used + ' 个应用，删除后这些应用会归到"未分类"。';
  if (!confirm(msg)) return;
  if (used > 0) state.apps.forEach((a) => { if (a.category === c.id) a.category = '__uncategorized__'; });
  state.categories.splice(i, 1);
  markDraft();
  renderCategories(); render(); renderCatList();
  toast('已删除');
}
function addCat() {
  const name = prompt('新分类名称：');
  if (!name) return;
  const icon = prompt('分类图标（emoji）：', '📁') || '📁';
  state.categories.push({ id: 'cat_' + Date.now(), name: name.trim(), icon: icon.trim(), color: '#6b7280' });
  markDraft();
  renderCategories(); render(); renderCatList();
  toast('已添加分类');
}

// ---- export / discard ----
function exportConfig() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'apps-config.json'; a.click();
  URL.revokeObjectURL(url);
  toast(hasDraft ? '已导出草稿 · 把 JSON 发给管理员更新部署版，即可全员同步' : '已导出配置');
}
function discardDraft() {
  if (!hasDraft) { toast('没有本地草稿'); return; }
  if (!confirm('放弃本地草稿？所有未发布的修改将丢失，恢复到部署版。')) return;
  localStorage.removeItem(LS_DRAFT_KEY);
  state = JSON.parse(JSON.stringify(baseState));
  state.meta = state.meta || {};
  state.meta.adminPassword = state.meta.adminPassword || '';
  state.categories = state.categories || [];
  state.apps = state.apps || [];
  hasDraft = false;
  $('#pageTitle').textContent = state.meta.title || 'AI 应用导航台';
  $('#pageSubtitle').textContent = state.meta.subtitle || '';
  applyMode();
  bindTitleEvents();
  renderCategories(); render();
  renderBanner();
  toast('已恢复到部署版');
}

// ---- init ----
async function init() {
  // 清理旧版 localStorage（v1 数据覆盖架构，已废弃）
  if (localStorage.getItem('ai_app_portal_data_v1')) {
    localStorage.removeItem('ai_app_portal_data_v1');
  }

  baseState = await loadBase();
  const draft = loadDraft();
  if (draft) {
    // 只比对应用和分类数据（不含 adminPassword，因为本地密码可能与部署版不同）
    const draftData = JSON.stringify({ categories: draft.categories || [], apps: draft.apps || [], title: draft.meta?.title, subtitle: draft.meta?.subtitle });
    const baseData = JSON.stringify({ categories: baseState.categories || [], apps: baseState.apps || [], title: baseState.meta?.title, subtitle: baseState.meta?.subtitle });
    if (draftData === baseData) {
      localStorage.removeItem(LS_DRAFT_KEY);
      state = JSON.parse(JSON.stringify(baseState));
      hasDraft = false;
    } else {
      state = draft;
      hasDraft = true;
    }
  } else {
    state = JSON.parse(JSON.stringify(baseState));
    hasDraft = false;
  }
  state.meta = state.meta || {};
  state.meta.adminPassword = state.meta.adminPassword || '';
  state.categories = state.categories || [];
  state.apps = state.apps || [];
  isAdmin = false;

  $('#pageTitle').textContent = state.meta.title || 'AI 应用导航台';
  $('#pageSubtitle').textContent = state.meta.subtitle || '';

  bind();
  applyMode();
  bindTitleEvents();
  renderCategories();
  render();
  renderBanner();
}

function bind() {
  $('#searchInput').addEventListener('input', (e) => { filter.q = e.target.value.trim().toLowerCase(); render(); });
  $$('.view-switch button').forEach((b) => b.addEventListener('click', () => {
    $$('.view-switch button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    filter.view = b.dataset.view;
    render();
  }));
  $('#addBtn').addEventListener('click', () => { if (isAdmin) openModal(); });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalCancel').addEventListener('click', closeModal);
  $('#appModal .modal-mask').addEventListener('click', closeModal);
  $('#appForm').addEventListener('submit', onSubmit);
  $('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').hidden = !$('#menu').hidden; });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu') && !e.target.closest('#menuBtn')) $('#menu').hidden = true;
  });
  $('#importFile').addEventListener('change', onImport);
  $('#draftDiscardBtn').addEventListener('click', discardDraft);
  $('#catModalClose').addEventListener('click', closeCatModal);
  $('#catModalCancel').addEventListener('click', closeCatModal);
  $('#catModalAdd').addEventListener('click', addCat);
  $('#catModal .modal-mask').addEventListener('click', closeCatModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && !document.activeElement.isContentEditable) {
      e.preventDefault();
      $('#searchInput').focus();
    }
    if (e.key === 'Escape') { closeModal(); closeCatModal(); }
  });
}

function renderCategories() {
  const wrap = $('#categoryChips');
  wrap.innerHTML = '';
  wrap.appendChild(makeChip('all', '全部', state.apps.length, filter.category === 'all'));
  state.categories.forEach((c) => {
    const count = state.apps.filter((a) => a.category === c.id).length;
    wrap.appendChild(makeChip(c.id, (c.icon || '📦') + ' ' + c.name, count, filter.category === c.id));
  });
}
function makeChip(id, label, count, active) {
  const b = document.createElement('button');
  b.className = 'chip' + (active ? ' active' : '');
  b.innerHTML = label + ' <span>' + count + '</span>';
  b.addEventListener('click', () => { filter.category = id; renderCategories(); render(); });
  return b;
}
function getFiltered() {
  let apps = state.apps.slice();
  if (filter.category !== 'all') apps = apps.filter((a) => a.category === filter.category);
  if (filter.q) {
    apps = apps.filter((a) => {
      const t = [a.name, a.description, a.platform, a.contact, (a.tags || []).join(' ')].join(' ').toLowerCase();
      return t.includes(filter.q);
    });
  }
  apps.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  return apps;
}
function render() {
  const apps = getFiltered();
  const c = $('#content');
  if (apps.length === 0) {
    c.innerHTML = '<div class="empty"><div class="big">🔍</div><p>没有匹配的应用</p></div>';
    return;
  }
  if (filter.view === 'flat') {
    c.innerHTML = '<div class="grid">' + apps.map(cardHTML).join('') + '</div>';
  } else {
    const groups = {};
    apps.forEach((a) => { (groups[a.category] = groups[a.category] || []).push(a); });
    const catOrder = state.categories.slice();
    Object.keys(groups).forEach((id) => {
      if (!catOrder.find((cc) => cc.id === id)) {
        catOrder.push({ id, name: id === '__uncategorized__' || id === '' ? '未分类' : id, icon: '📦' });
      }
    });
    c.innerHTML = catOrder.filter((cc) => groups[cc.id]).map((cc) => {
      return '<div class="group"><div class="group-head"><span class="gicon">' + (cc.icon || '📦') + '</span><h3>' + escapeHTML(cc.name) + '</h3><span class="gcount">' + groups[cc.id].length + '</span></div><div class="grid">' + groups[cc.id].map(cardHTML).join('') + '</div></div>';
    }).join('');
  }
  bindCards();
}
function cardHTML(a) {
  const tags = (a.tags || []).slice(0, 3).map((t) => '<span>' + escapeHTML(t) + '</span>').join('');
  const isImg = a.icon && /^https?:\/\//.test(a.icon);
  const iconHTML = isImg
    ? '<div class="card-icon img" style="background-image:url(\'' + escapeHTML(a.icon) + '\')"></div>'
    : '<div class="card-icon">' + escapeHTML(a.icon || '🔗') + '</div>';
  return '<div class="card' + (a.pinned ? ' pinned' : '') + '" data-id="' + a.id + '">'
    + iconHTML
    + '<div class="card-top"><div class="card-name" title="' + escapeHTML(a.name) + '">' + escapeHTML(a.name) + '</div>' + (a.platform || a.contact ? '<div class="card-badges">' + (a.platform ? '<span class="card-platform">' + escapeHTML(a.platform) + '</span>' : '') + (a.contact ? '<span class="card-contact">联系人：' + escapeHTML(a.contact) + '</span>' : '') + '</div>' : '') + '</div>'
    + '<div class="card-desc">' + escapeHTML(a.description || '') + '</div>'
    + (tags ? '<div class="card-tags">' + tags + '</div>' : '')
    + (isAdmin ? '<div class="card-actions"><button data-act="edit" title="编辑">✎</button><button data-act="pin" title="置顶">' + (a.pinned ? '📌' : '📍') + '</button><button data-act="del" title="删除">🗑</button></div>' : '')
    + '</div>';
}
function bindCards() {
  $$('.card').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions')) return;
      const a = state.apps.find((x) => x.id === id);
      if (a) window.open(a.url, '_blank', 'noopener');
    });
    card.querySelectorAll('.card-actions button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'edit') openModal(id);
        else if (act === 'pin') {
          const a = state.apps.find((x) => x.id === id);
          a.pinned = !a.pinned;
          markDraft(); render(); renderCategories();
          toast(a.pinned ? '已置顶' : '已取消置顶');
        } else if (act === 'del') {
          if (confirm('确定删除该应用？')) {
            state.apps = state.apps.filter((x) => x.id !== id);
            markDraft(); render(); renderCategories();
            toast('已删除');
          }
        }
      });
    });
  });
}
function openModal(id) {
  if (!isAdmin) return;
  const modal = $('#appModal');
  $('#modalTitle').textContent = id ? '编辑应用' : '添加应用';
  const sel = $('#f_category');
  sel.innerHTML = state.categories.map((c) => '<option value="' + c.id + '">' + (c.icon || '📦') + ' ' + escapeHTML(c.name) + '</option>').join('') + '<option value="other">📦 其他</option>';
  if (id) {
    const a = state.apps.find((x) => x.id === id) || {};
    $('#f_id').value = a.id || '';
    $('#f_name').value = a.name || '';
    $('#f_url').value = a.url || '';
    $('#f_desc').value = a.description || '';
    $('#f_icon').value = a.icon || '🔗';
    $('#f_category').value = a.category || 'other';
    $('#f_platform').value = a.platform || '';
    $('#f_contact').value = a.contact || '';
    $('#f_tags').value = (a.tags || []).join(', ');
    $('#f_pinned').checked = !!a.pinned;
  } else {
    $('#appForm').reset();
    $('#f_id').value = '';
    $('#f_icon').value = '🔗';
  }
  modal.hidden = false;
}
function closeModal() { $('#appModal').hidden = true; }
function onSubmit(e) {
  e.preventDefault();
  const id = $('#f_id').value || 'a' + Date.now();
  const data = {
    id,
    name: $('#f_name').value.trim(),
    url: $('#f_url').value.trim(),
    description: $('#f_desc').value.trim(),
    icon: $('#f_icon').value.trim() || '🔗',
    category: $('#f_category').value,
    platform: $('#f_platform').value.trim(),
    contact: $('#f_contact').value.trim(),
    tags: $('#f_tags').value.split(',').map((s) => s.trim()).filter(Boolean),
    pinned: $('#f_pinned').checked
  };
  const idx = state.apps.findIndex((x) => x.id === id);
  if (idx >= 0) state.apps[idx] = data; else state.apps.push(data);
  markDraft();
  closeModal();
  renderCategories();
  render();
  toast(idx >= 0 ? '已更新' : '已添加');
}
async function onImport(e) {
  if (!isAdmin) { toast('需要管理员权限'); e.target.value = ''; return; }
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    state = data;
    state.meta = state.meta || {};
    state.meta.adminPassword = state.meta.adminPassword || '';
    state.categories = state.categories || [];
    state.apps = state.apps || [];
    hasDraft = true;
    saveDraft();
    $('#pageTitle').textContent = state.meta.title || 'AI 应用导航台';
    $('#pageSubtitle').textContent = state.meta.subtitle || '';
    applyMode();
    bindTitleEvents();
    renderCategories(); render();
    renderBanner();
    toast('已导入为本地草稿');
  } catch (err) {
    toast('导入失败：JSON 格式错误');
  }
  e.target.value = '';
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2500);
}
function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

init();