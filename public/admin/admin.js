const $ = (s) => document.querySelector(s);
const fmt = new Intl.NumberFormat('uz-UZ');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIELDS = ['full_name', 'phone', 'phone2', 'address', 'passport', 'birth_date', 'email', 'source', 'asset_title',
  'budget', 'responsible', 'next_contact_at', 'stage', 'comment'];

let token = sessionStorage.getItem('adminToken') || '';
let stages = [];
let leads = [];
let editingId = null; // null = yangi lead
let dragId = null;

async function api(path, opts = {}) {
  const r = await fetch('/api/admin' + path, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  });
  if (r.status === 401) { logout(); throw new Error('401'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'xato'), { data });
  return data;
}

function logout() {
  token = ''; sessionStorage.removeItem('adminToken');
  $('#app').hidden = true; $('#login').hidden = false; $('#ov').hidden = true;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const dt = (s) => (s || '').slice(0, 16).replace('T', ' ');

function cardHtml(l) {
  const late = l.next_contact_at && l.next_contact_at < todayStr() && !['contract', 'junk'].includes(l.stage);
  return `<div class="card" draggable="true" data-id="${l.id}">
    <div class="n">${esc(l.full_name)}</div>
    <div class="m"><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a></div>
    ${l.asset_title ? `<div class="m">${esc(l.asset_title)}</div>` : ''}
    ${l.address ? `<div class="m">📍 ${esc(l.address)}</div>` : ''}
    ${l.budget != null ? `<div class="b">${fmt.format(l.budget)} so'm</div>` : ''}
    ${l.next_contact_at ? `<div class="m ${late ? 'late' : ''}">⏰ ${esc(l.next_contact_at)}</div>` : ''}
    <div class="m">№${l.id} · ${esc(l.source)}${l.responsible ? ' · ' + esc(l.responsible) : ''} · ${esc(dt(l.created_at))}</div>
  </div>`;
}

function render() {
  $('#board').innerHTML = stages.map((s) => {
    const list = leads.filter((l) => l.stage === s.key);
    const sum = list.reduce((a, l) => a + (l.budget || 0), 0);
    const slots = '<div class="slot"></div>'.repeat(Math.max(0, 2 - list.length));
    return `<section class="col k-${s.kind}" data-stage="${s.key}">
      <div class="head"><b>${esc(s.title)}</b>${s.hint ? `<small>${esc(s.hint)}</small>` : ''}
        <span class="sum">${list.length} ta${sum ? ' · ' + fmt.format(sum) + ' so\'m' : ''}</span></div>
      <div class="drop" data-stage="${s.key}">${list.map(cardHtml).join('')}${slots}</div>
    </section>`;
  }).join('');
}

async function load() {
  const q = $('#q').value.trim();
  if (!stages.length) stages = await api('/stages');
  leads = await api('/leads' + (q ? '?q=' + encodeURIComponent(q) : ''));
  $('#login').hidden = true; $('#app').hidden = false;
  $('#stageSel').innerHTML = stages.map((s) => `<option value="${s.key}">${esc(s.title)}</option>`).join('');
  render();
}

// ---- Drag & drop ----
$('#board').addEventListener('dragstart', (e) => {
  const c = e.target.closest('.card');
  if (!c) return;
  dragId = Number(c.dataset.id);
  c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragId));
});
$('#board').addEventListener('dragend', () => {
  dragId = null;
  document.querySelectorAll('.dragging,.over').forEach((n) => n.classList.remove('dragging', 'over'));
});
$('#board').addEventListener('dragover', (e) => {
  const d = e.target.closest('.drop');
  if (!d || dragId == null) return;
  e.preventDefault();
  document.querySelectorAll('.over').forEach((n) => n !== d && n.classList.remove('over'));
  d.classList.add('over');
});
$('#board').addEventListener('drop', async (e) => {
  const d = e.target.closest('.drop');
  if (!d || dragId == null) return;
  e.preventDefault();
  const id = dragId, stage = d.dataset.stage;
  const lead = leads.find((l) => l.id === id);
  if (!lead || lead.stage === stage) return;
  const prev = lead.stage;
  lead.stage = stage; render(); // darhol ko'rsatamiz, xato bo'lsa qaytaramiz
  try { await api('/leads/' + id, { method: 'PATCH', body: JSON.stringify({ stage }) }); }
  catch { lead.stage = prev; render(); }
});
$('#board').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const c = e.target.closest('.card');
  if (c) openLead(Number(c.dataset.id));
});

// ---- Lead oynasi ----
const clearErrors = () => { document.querySelectorAll('[data-e]').forEach((n) => (n.textContent = '')); $('#fe').textContent = ''; };

function fillForm(l) {
  const f = $('#lf');
  for (const k of FIELDS) f.elements[k].value = l[k] ?? '';
}

function renderNotes(notes) {
  $('#notes').innerHTML = notes.map((n) =>
    `<div class="note ${n.kind === 'system' ? 'sys' : ''}"><time>${esc(dt(n.created_at))}</time>${esc(n.text)}</div>`).join('') ||
    '<div class="note sys">Hozircha yozuv yo\'q</div>';
}

async function openLead(id) {
  clearErrors();
  editingId = id;
  const l = id == null ? { stage: 'new', source: 'qo\'lda' } : await api('/leads/' + id);
  $('#lt').textContent = id == null ? 'Yangi lead' : `Lead №${id}`;
  fillForm(l);
  $('#hist').hidden = id == null;
  if (id != null) renderNotes(l.notes);
  $('#ov').hidden = false;
}

const closeModal = () => { $('#ov').hidden = true; editingId = null; };
$('#cancel').addEventListener('click', closeModal);
$('#ov').addEventListener('mousedown', (e) => { if (e.target === $('#ov')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#ov').hidden) closeModal(); });
$('#newLead').addEventListener('click', () => openLead(null));

$('#lf').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const body = Object.fromEntries(FIELDS.map((k) => [k, e.target.elements[k].value]));
  const btn = $('#save');
  btn.disabled = true;
  try {
    await api(editingId == null ? '/leads' : '/leads/' + editingId, {
      method: editingId == null ? 'POST' : 'PATCH', body: JSON.stringify(body),
    });
    closeModal();
    await load();
  } catch (err) {
    const errs = err.data?.errors;
    if (errs) for (const [k, m] of Object.entries(errs)) {
      const n = document.querySelector(`[data-e="${k}"]`);
      if (n) n.textContent = m; else $('#fe').textContent = m;
    } else if (err.message !== '401') $('#fe').textContent = err.message;
  } finally { btn.disabled = false; }
});

$('#noteBtn').addEventListener('click', async () => {
  const text = $('#noteText').value.trim();
  if (!text || editingId == null) return;
  await api(`/leads/${editingId}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
  $('#noteText').value = '';
  renderNotes((await api('/leads/' + editingId)).notes);
});
$('#noteText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#noteBtn').click(); } });

// ---- Kirish, qidiruv, yangilash ----
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#token').value;
  $('#loginErr').textContent = '';
  try { await load(); sessionStorage.setItem('adminToken', token); }
  catch { $('#loginErr').textContent = 'Parol noto\'g\'ri'; }
});
$('#logout').addEventListener('click', logout);
let qTimer;
$('#q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => load().catch(() => {}), 250); });
// Yangi arizalar o'zi paydo bo'lishi uchun (oyna yopiq va sudralmayotgan bo'lsa)
setInterval(() => { if (token && $('#ov').hidden && dragId == null) load().catch(() => {}); }, 30000);
if (token) load().catch(() => {});
