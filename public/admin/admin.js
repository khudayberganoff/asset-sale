const $ = (s) => document.querySelector(s);
const LABELS = { new: 'Yangi', in_progress: 'Jarayonda', done: 'Bajarildi', rejected: 'Rad etildi' };
let token = sessionStorage.getItem('adminToken') || '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const r = await fetch('/api/admin' + path, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  });
  if (r.status === 401) { logout(); throw new Error('401'); }
  return r.json();
}

function logout() {
  token = ''; sessionStorage.removeItem('adminToken');
  $('#panel').hidden = true; $('#login').hidden = false;
}

async function load() {
  const rows = await api('/applications' + ($('#filter').value ? '?status=' + $('#filter').value : ''));
  $('#login').hidden = true; $('#panel').hidden = false;
  $('#empty').hidden = rows.length > 0;
  $('#rows').innerHTML = rows.map((a) => `
    <tr>
      <td>${a.id}</td>
      <td>${esc(a.created_at)} UTC</td>
      <td>${esc(a.asset_title)}</td>
      <td>${esc(a.full_name)}</td>
      <td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></td>
      <td>${esc(a.comment)}</td>
      <td><select data-id="${a.id}" class="s-${a.status}">
        ${Object.entries(LABELS).map(([k, v]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select></td>
    </tr>`).join('');
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#token').value;
  $('#loginErr').textContent = '';
  try { await load(); sessionStorage.setItem('adminToken', token); }
  catch { $('#loginErr').textContent = 'Parol noto\'g\'ri'; }
});
$('#rows').addEventListener('change', async (e) => {
  const s = e.target.closest('select[data-id]');
  if (!s) return;
  await api('/applications/' + s.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: s.value }) });
  load();
});
$('#filter').addEventListener('change', load);
$('#reload').addEventListener('click', load);
$('#logout').addEventListener('click', logout);
if (token) load().catch(() => {});
