const $ = (s) => document.querySelector(s);
const fmt = new Intl.NumberFormat('uz-UZ');
const OTHER = 'other';
let assets = [];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function selectAsset(id) {
  $('#assetSel').value = String(id);
  $('#assetSel').dispatchEvent(new Event('change'));
  $('#form').scrollIntoView({ behavior: 'smooth' });
}

async function load() {
  try {
    assets = await (await fetch('/api/assets')).json();
  } catch {
    $('#assets').innerHTML = '<p class="muted">Aktivlar yuklanmadi. Sahifani yangilang.</p>';
    assets = [];
  }
  $('#assets').innerHTML = assets.length
    ? assets.map((a) => `
      <article class="card">
        <span class="tag">${esc(a.category)}</span>
        <h3>${esc(a.title)}</h3>
        <p class="muted" style="margin:0">${esc(a.description)}</p>
        <div class="price">${a.price != null ? fmt.format(a.price) + ' so\'m' : 'Narx kelishiladi'}</div>
        <button type="button" data-id="${a.id}">Ariza qoldirish</button>
      </article>`).join('')
    : '<p class="muted">Hozircha aktivlar yo\'q. Quyida o\'zingizga kerak aktivni yozib ariza qoldiring.</p>';
  $('#assetSel').innerHTML =
    assets.map((a) => `<option value="${a.id}">${esc(a.title)}</option>`).join('') +
    `<option value="${OTHER}">Boshqa aktiv…</option>`;
  $('#assetSel').dispatchEvent(new Event('change'));
}

$('#assets').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (b) selectAsset(b.dataset.id);
});
$('#assetSel').addEventListener('change', () => {
  $('#customWrap').hidden = $('#assetSel').value !== OTHER;
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.querySelectorAll('[data-err]').forEach((n) => (n.textContent = ''));
  $('#formErr').textContent = '';
  const f = new FormData(e.target);
  const sel = f.get('asset_id');
  const body = {
    asset_id: sel === OTHER ? null : Number(sel),
    custom_asset: f.get('custom_asset'),
    full_name: f.get('full_name'),
    phone: f.get('phone'),
    comment: f.get('comment'),
    website: f.get('website'),
  };
  const btn = $('#submitBtn');
  btn.disabled = true;
  try {
    const r = await fetch('/api/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      e.target.reset();
      $('#assetSel').dispatchEvent(new Event('change'));
      $('#appNo').textContent = j.id ? '№' + j.id : '';
      $('#done').hidden = false;
      $('#done').scrollIntoView({ behavior: 'smooth' });
    } else if (j.errors) {
      for (const [k, m] of Object.entries(j.errors)) {
        const n = document.querySelector(`[data-err="${k}"]`);
        if (n) n.textContent = m;
      }
    } else {
      $('#formErr').textContent = j.error || 'Xatolik yuz berdi. Qayta urinib ko\'ring.';
    }
  } catch {
    $('#formErr').textContent = 'Tarmoq xatosi. Qayta urinib ko\'ring.';
  } finally {
    btn.disabled = false;
  }
});

load();
