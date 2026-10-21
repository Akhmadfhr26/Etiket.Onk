/* ============================================================
   SISTEM ETIKET KEMOTERAPI — app.js
   ============================================================ */

let CURRENT_USER = null;
let CACHE = { etiket: [], pasien: [], obat: [], pelarut: [], settings: {}, etiketTpn: [], sediaanTpn: [], etiketObat: [] };
let CURRENT_ROUTE = 'dashboard';
let PREFILL_ENTRI = null; // dipakai saat "Gunakan" dari Daftar Pasien
let PREFILL_TPN = null;   // sama seperti PREFILL_ENTRI, tapi untuk form Entri TPN

/* ---------------- SIDEBAR ---------------- */

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/* ---------------- AUTH ---------------- */

// Petugas cukup ketik username pendek (mis. "depo") tanpa perlu mengetik
// alamat email lengkap tiap kali login. Di belakang layar, username itu
// diubah jadi email dengan domain palsu ini sebelum dikirim ke Supabase
// (Supabase Auth memang mewajibkan format email/telepon untuk akunnya).
// Kalau user mengetik alamat yang sudah mengandung "@", dipakai apa adanya.
const LOGIN_USERNAME_DOMAIN = '@etiketkemo.local';

function toLoginEmail(input) {
  const v = (input || '').trim();
  if (!v) return v;
  return v.includes('@') ? v.toLowerCase() : v.toLowerCase() + LOGIN_USERNAME_DOMAIN;
}
function displayUsername(email) {
  if (!email) return '';
  return email.toLowerCase().endsWith(LOGIN_USERNAME_DOMAIN) ? email.slice(0, -LOGIN_USERNAME_DOMAIN.length) : email;
}

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) {
    CURRENT_USER = data.session.user;
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

async function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('sbUserEmail').textContent = CURRENT_USER ? displayUsername(CURRENT_USER.email) : '';
  await loadAllData();
  navigate('dashboard');
}

async function doLogin() {
  const usernameInput = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msgEl = document.getElementById('loginMsg');
  msgEl.innerHTML = '';
  if (!usernameInput || !password) {
    msgEl.innerHTML = '<div class="msg err">Username dan password wajib diisi.</div>';
    return;
  }
  const email = toLoginEmail(usernameInput);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    msgEl.innerHTML = '<div class="msg err">' + escapeHtml(error.message) + '</div>';
    return;
  }
  CURRENT_USER = data.user;
  showApp();
}

async function doLogout() {
  await supabase.auth.signOut();
  CURRENT_USER = null;
  showLogin();
}

/* ---------------- DATA LOADING ---------------- */
async function loadAllData() {
  const [etiketRes, pasienRes, obatRes, pelarutRes, settingsRes, etiketTpnRes, sediaanTpnRes, etiketObatRes] = await Promise.all([
    supabase.from('etiket').select('*').order('created_at', { ascending: false }),
    supabase.from('pasien').select('*').order('nama_pasien', { ascending: true }),
    supabase.from('obat').select('*').order('nama_obat', { ascending: true }),
    supabase.from('pelarut').select('*').order('nama_pelarut', { ascending: true }),
    supabase.from('pengaturan').select('*'),
    supabase.from('etiket_tpn').select('*').order('created_at', { ascending: false }),
    supabase.from('sediaan_tpn').select('*').order('nama_sediaan', { ascending: true }),
    supabase.from('etiket_obat').select('*').order('created_at', { ascending: false })
  ]);
  CACHE.etiket = etiketRes.data || [];
  CACHE.pasien = pasienRes.data || [];
  CACHE.obat = obatRes.data || [];
  CACHE.pelarut = pelarutRes.data || [];
  CACHE.settings = {};
  (settingsRes.data || []).forEach(r => CACHE.settings[r.key] = r.value);
  CACHE.etiketTpn = etiketTpnRes.data || [];
  CACHE.sediaanTpn = sediaanTpnRes.data || [];
  CACHE.etiketObat = etiketObatRes.data || [];
  document.getElementById('sbNamaRS').textContent = CACHE.settings.nama_rs || 'Etiket Kemo';
}

/* ---------------- ROUTING ---------------- */
const PAGES = {
  dashboard:  { title: 'Daftar Etiket',    sub: 'Semua etiket yang tersimpan',              render: renderDashboard },
  entri:      { title: 'Entri Data Baru',  sub: 'Tambah atau perbarui etiket pasien',        render: renderEntri },
  pasien:     { title: 'Daftar Pasien',    sub: 'Riwayat kunjungan tiap pasien',             render: renderPasien },
  obat:       { title: 'Database Obat',    sub: 'Nama obat & konsentrasi untuk kalkulasi',   render: renderObat },
  pelarut:    { title: 'Database Pelarut', sub: 'Daftar pelarut baku (NaCl 0,9%, D5%, dll)', render: renderPelarut },
  tpn_dashboard: { title: 'Daftar Etiket TPN', sub: 'Semua etiket TPN yang tersimpan',        render: renderTpnDashboard },
  tpn_entri:     { title: 'Entri TPN Baru',    sub: 'Tambah atau perbarui etiket TPN pasien', render: renderTpnEntri },
  tpn_pasien:    { title: 'Daftar Pasien TPN', sub: 'Riwayat resep TPN tiap pasien',          render: renderTpnPasien },
  tpn_sediaan:   { title: 'Database Sediaan TPN', sub: 'Nama sediaan & volume/satuan baku',   render: renderTpnSediaan },
  pengaturan: { title: 'Pengaturan',       sub: 'Identitas rumah sakit',                     render: renderPengaturan }
};

async function navigate(route) {
  if (!PAGES[route]) route = 'dashboard';
  CURRENT_ROUTE = route;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-route') === route);
  });
  document.getElementById('pageTitle').textContent = PAGES[route].title;
  document.getElementById('pageSub').textContent = PAGES[route].sub;
  const content = document.getElementById('content');
  content.innerHTML = '<p class="muted">Memuat...</p>';
  await PAGES[route].render(content);
}

/* ---------------- HELPERS ---------------- */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('id-ID');
}
function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('id-ID') + ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function toISODateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}
function isoLocalFromInput(v) {
  // v = value dari <input type=datetime-local>, sudah waktu lokal
  if (!v) return null;
  return new Date(v).toISOString();
}
function computeBud(item) {
  if (item.tanggal_bud) return fmtDateTime(item.tanggal_bud);
  if (item.tanggal_dibuat && item.bud_durasi_jam) {
    const base = new Date(item.tanggal_dibuat);
    const bud = new Date(base.getTime() + parseFloat(item.bud_durasi_jam) * 3600000);
    return fmtDateTime(bud.toISOString());
  }
  return '';
}

/* PERBAIKAN: nextEtiketId() sekarang mencari nomor urut tertinggi yang
   benar-benar ada di CACHE.etiket (format "inj-NNN"), bukan mengandalkan
   CACHE.etiket.length. Sebelumnya, kalau ada baris yang pernah dihapus
   atau cache "ketinggalan" dari database, length-based ID bisa
   bertabrakan dengan ID yang sudah ada -> insert() gagal di tengah loop
   penyimpanan banyak regimen sekaligus, dan sisa regimen tidak
   tersimpan tanpa pesan yang jelas terlihat. */
function nextEtiketId() {
  let maxN = 0;
  CACHE.etiket.forEach(e => {
    const m = /^inj-(\d+)$/.exec(String(e.id || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  });
  let candidate, n = maxN + 1;
  do {
    candidate = 'inj-' + String(n).padStart(3, '0');
    n++;
  } while (CACHE.etiket.some(e => e.id === candidate));
  return candidate;
}

function toast(container, type, text) {
  container.insertAdjacentHTML('afterbegin', `<div class="msg ${type}">${escapeHtml(text)}</div>`);
}

/* ============================================================
   HALAMAN: DASHBOARD / DAFTAR ETIKET
   ============================================================ */
/* ============================================================
   DAFTAR ETIKET (dashboard)
   - Kelompok: Pasien > Hari (1 hari = 1 label identitas) > baris etiket
   - Filter ringkas: Tanggal (Hari ini / Besok / 7 hari ke depan / Semua / pilih tanggal)
     + Status cetak + kotak cari
   - Pilihan (centang) disimpan di memori (Set), BUKAN di DOM, jadi tidak hilang
     saat mengetik di kotak cari, ganti filter, atau tabel dirender ulang
   - Bar aksi menempel di bawah layar: jumlah terpilih + Cetak / Tandai / Hapus
   - Status cetak: kolom etiket.dicetak_at (label obat) dan
     etiket.identitas_dicetak_at (label identitas) -> lihat supabase/schema_dicetak.sql
   ============================================================ */

window._dash = window._dash || null;
window._sel = window._sel || { kemo: new Set(), obat: new Set() };
window._expand = window._expand || {};   // key pasien -> true/false (pilihan manual buka/tutup)
window._dashView = { jenis: 'kemo', groups: [], ids: [] }; // model hasil render terakhir

/* ---------- helper tanggal LOKAL (toISODateInput memakai UTC, bisa meleset 1 hari di WITA) ---------- */
function localDateKey(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
}
function addDaysKey(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + n));
}
function fmtDateKey(key) {
  if (!key) return '-';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- status cetak ---------- */
function hasPrintCols() {
  return CACHE.etiket.some(r => 'dicetak_at' in r);
}
function printState(r) {
  const a = !!r.dicetak_at, b = !!r.identitas_dicetak_at;
  return a && b ? 'sudah' : (a || b ? 'sebagian' : 'belum');
}
function printPills(r) {
  const p = (label, at, title) => at
    ? `<span class="pill ok" title="${title} dicetak ${escapeHtml(fmtDateTime(at))}">${label} ✓</span>`
    : `<span class="pill off" title="${title} belum dicetak">${label} –</span>`;
  return p('🏷️', r.dicetak_at, 'Label obat') + ' ' + p('🪪', r.identitas_dicetak_at, 'Label identitas');
}

/* ---------- state dashboard ---------- */
function initDashState() {
  if (window._dash) return;
  const today = localDateKey(new Date());
  const adaHariIni = CACHE.etiket.some(r => localDateKey(r.tanggal_dibuat) === today);
  // Kalau hari ini kosong tapi data ada, mulai dari "Semua" supaya tidak terlihat seperti data hilang
  window._dash = { jenis: 'kemo', range: (adaHariIni || !CACHE.etiket.length) ? 'today' : 'all', date: '', status: 'all' };
}

function rangeMatch(key, range, date) {
  const today = localDateKey(new Date());
  switch (range) {
    case 'today':    return key === today;
    case 'tomorrow': return key === addDaysKey(today, 1);
    case 'week':     return key >= today && key <= addDaysKey(today, 6);
    case 'date':     return !date || key === date;
    default:         return true;
  }
}

function currentSel() {
  return window._sel[window._dash && window._dash.jenis === 'obat' ? 'obat' : 'kemo'];
}

// Buang id yang sudah tidak ada lagi di data (mis. sudah dihapus)
function pruneSelection() {
  const k = new Set(CACHE.etiket.map(r => String(r.id)));
  window._sel.kemo.forEach(id => { if (!k.has(id)) window._sel.kemo.delete(id); });
  const o = new Set(CACHE.etiketObat.map(r => String(r.id)));
  window._sel.obat.forEach(id => { if (!o.has(id)) window._sel.obat.delete(id); });
}

function renderDashboard(content) {
  initDashState();
  pruneSelection();
  const rows = CACHE.etiket;
  const d = window._dash;

  content.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="num">${rows.length}</div><div class="lab">Total Etiket</div></div>
      <div class="stat-box"><div class="num">${CACHE.pasien.length}</div><div class="lab">Total Pasien</div></div>
      <div class="stat-box"><div class="num">${Array.from(new Set(rows.map(r => r.batch_id).filter(Boolean))).length}</div><div class="lab">Total Kunjungan (Batch)</div></div>
    </div>
    <div class="card">
      <div class="chip-row" id="jenisEtiketTabs">
        <span class="chip ${d.jenis === 'kemo' ? 'active' : ''}" data-j="kemo" onclick="setJenisEtiket('kemo')">🧪 Etiket Kemo (Infus)</span>
        <span class="chip ${d.jenis === 'obat' ? 'active' : ''}" data-j="obat" onclick="setJenisEtiket('obat')">💊 Etiket Obat</span>
      </div>
      <div class="toolbar">
        <input type="text" id="searchEtiket" class="search-box" placeholder="Cari nama pasien / No RM / obat...">
        <div class="spacer"></div>
        <button class="btn ghost small" id="btnBukaSemua" onclick="bukaTutupSemuaGrup(true)">▾ Buka semua</button>
        <button class="btn ghost small" id="btnTutupSemua" onclick="bukaTutupSemuaGrup(false)">▸ Tutup semua</button>
        <button class="btn secondary" onclick="navigate('entri')">➕ Entri Baru</button>
      </div>
      <div id="dashFilters"></div>
      <div class="muted" id="viewSummary" style="font-size:12.5px;margin:2px 0 8px;"></div>
      <div style="overflow-x:auto;">
        <table class="data-grid" id="etiketTable">
          <thead id="etiketThead"></thead>
          <tbody id="etiketTbody"></tbody>
        </table>
      </div>
    </div>
    <div id="selBar" class="sel-bar hidden"></div>
  `;
  document.getElementById('searchEtiket').addEventListener('input', renderEtiketRows);
  document.getElementById('etiketTable').addEventListener('change', onEtiketChange);
  document.getElementById('etiketTbody').addEventListener('click', onEtiketClick);
  renderEtiketTheadAndButtons();
  renderDashFilters();
  renderEtiketRows();
}

/* ---------------- TOGGLE JENIS ETIKET: KEMO / OBAT ---------------- */
function setJenisEtiket(jenis) {
  window._dash.jenis = jenis;
  document.querySelectorAll('#jenisEtiketTabs .chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-j') === jenis));
  renderEtiketTheadAndButtons();
  renderDashFilters();
  renderEtiketRows();
}

function renderEtiketTheadAndButtons() {
  const isObat = window._dash.jenis === 'obat';
  const printOn = hasPrintCols();
  document.getElementById('etiketThead').innerHTML = isObat ? `
    <tr>
      <th class="checkbox-cell"><input type="checkbox" id="chkAll" data-act="sel-all" title="Pilih semua yang tampil"></th>
      <th>Pasien / No RM</th>
      <th>Nama &amp; Dosis Obat</th>
      <th>Aturan Pakai</th>
      <th>Waktu Makan</th>
      <th>Tanggal Dibuat</th>
      <th>Petugas</th>
      <th></th>
    </tr>` : `
    <tr>
      <th class="checkbox-cell"><input type="checkbox" id="chkAll" data-act="sel-all" title="Pilih semua yang tampil"></th>
      <th>Pasien / Obat &amp; Dosis</th>
      <th>Hari Ke</th>
      <th>Tanggal Dibuat</th>
      <th>BUD (EXP)</th>
      ${printOn ? '<th title="🏷️ = Label Obat · 🪪 = Label Identitas">Status Cetak</th>' : ''}
      <th>Petugas</th>
      <th></th>
    </tr>`;
  document.getElementById('btnBukaSemua').classList.toggle('hidden', isObat);
  document.getElementById('btnTutupSemua').classList.toggle('hidden', isObat);
}

/* ---------------- FILTER (satu bar) ---------------- */
function renderDashFilters() {
  const box = document.getElementById('dashFilters');
  if (!box) return;
  const d = window._dash;
  if (d.jenis !== 'kemo') { box.innerHTML = ''; return; }
  const printOn = hasPrintCols();
  const cnt = (range) => CACHE.etiket.filter(r => rangeMatch(localDateKey(r.tanggal_dibuat), range, d.date)).length;
  const rng = (v, label) => `<span class="chip ${d.range === v ? 'active' : ''}" onclick="setDashRange('${v}')">${label} <small>${cnt(v)}</small></span>`;
  const st = (v, label) => `<span class="chip ${d.status === v ? 'active' : ''}" onclick="setDashStatus('${v}')">${label}</span>`;
  box.innerHTML = `
    ${(!printOn && CACHE.etiket.length) ? `<div class="msg warn">Status cetak belum aktif. Jalankan file <b>supabase/schema_dicetak.sql</b> di Supabase &gt; SQL Editor, lalu muat ulang halaman ini.</div>` : ''}
    <div class="filter-line">
      <span class="filter-label">Tanggal</span>
      ${rng('today', 'Hari ini')}${rng('tomorrow', 'Besok')}${rng('week', '7 hari ke depan')}${rng('all', 'Semua')}
      <input type="date" class="date-chip ${d.range === 'date' ? 'active' : ''}" value="${escapeHtml(d.date || '')}" onchange="setDashDate(this.value)" title="Pilih tanggal tertentu">
    </div>
    ${printOn ? `
    <div class="filter-line">
      <span class="filter-label">Status</span>
      ${st('all', 'Semua')}${st('belum', '⏳ Belum dicetak')}${st('sudah', '✅ Sudah dicetak')}
      <span class="spacer"></span>
      <button class="btn ghost small" onclick="pilihBelumDicetak()" title="Centang semua etiket yang tampil dan belum lengkap dicetak">☑ Pilih yang belum dicetak</button>
    </div>` : ''}
  `;
}
function setDashRange(v) { window._dash.range = v; if (v !== 'date') window._dash.date = ''; renderDashFilters(); renderEtiketRows(); }
function setDashDate(v) { window._dash.date = v || ''; window._dash.range = v ? 'date' : 'all'; renderDashFilters(); renderEtiketRows(); }
function setDashStatus(v) { window._dash.status = v; renderDashFilters(); renderEtiketRows(); }
function resetDashFilters() { window._dash.range = 'all'; window._dash.date = ''; window._dash.status = 'all'; renderDashFilters(); renderEtiketRows(); }

/* ---------------- BUKA / TUTUP KELOMPOK ---------------- */
function isGroupExpanded(key, totalGroups, searching) {
  if (key in window._expand) return window._expand[key];
  return totalGroups <= 3 || (searching && totalGroups <= 8);
}
function bukaTutupSemuaGrup(open) {
  (window._dashView.groups || []).forEach(g => { window._expand[g.key] = open; });
  renderEtiketRows();
}

function waktuMakanLabel(v) {
  if (v === 'sebelum') return 'Sebelum Makan';
  if (v === 'sesudah') return 'Sesudah Makan';
  if (v === 'bebas') return 'Boleh Kapan Saja';
  return '-';
}

/* ---------------- RENDER BARIS ---------------- */
function renderEtiketRows() {
  if (window._dash.jenis === 'obat') renderObatRows(); else renderKemoRows();
  syncSelectionUI();
}

function renderKemoRows() {
  const d = window._dash;
  const printOn = hasPrintCols();
  const q = (document.getElementById('searchEtiket')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('etiketTbody');
  const cols = printOn ? 8 : 7;

  const rows = CACHE.etiket.filter(r => {
    if (!rangeMatch(localDateKey(r.tanggal_dibuat), d.range, d.date)) return false;
    if (printOn && d.status === 'belum' && printState(r) === 'sudah') return false;
    if (printOn && d.status === 'sudah' && printState(r) !== 'sudah') return false;
    if (!q) return true;
    return [r.nama_pasien, r.no_rm, r.obat_dosis, r.nama_obat].some(v => String(v || '').toLowerCase().includes(q));
  });

  // Kelompok 1: pasien
  const map = new Map();
  rows.forEach(r => {
    const k = String(r.no_rm || r.nama_pasien || '-');
    if (!map.has(k)) map.set(k, { key: k, nama: r.nama_pasien, norm: r.no_rm, rows: [] });
    map.get(k).rows.push(r);
  });
  const groups = Array.from(map.values()).sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));

  groups.forEach((g, gi) => {
    g.gi = gi;
    // Kelompok 2: hari (tanggal + hari ke) = persis 1 label identitas
    const dm = new Map();
    g.rows.forEach(r => {
      const dk = localDateKey(r.tanggal_dibuat);
      const k = dk + '|' + (r.hari_ke || '');
      if (!dm.has(k)) dm.set(k, { key: k, dateKey: dk, hari: r.hari_ke, rows: [] });
      dm.get(k).rows.push(r);
    });
    g.days = Array.from(dm.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.hari || 0) - (b.hari || 0));
    g.days.forEach((dy, di) => {
      dy.di = di;
      dy.rows.sort((a, b) => (new Date(a.tanggal_dibuat) - new Date(b.tanggal_dibuat)) || String(a.id).localeCompare(String(b.id)));
      dy.ids = dy.rows.map(r => String(r.id));
    });
    g.ids = g.days.flatMap(dy => dy.ids);
    g.expanded = isGroupExpanded(g.key, groups.length, !!q);
  });

  window._dashView = { jenis: 'kemo', groups, ids: groups.flatMap(g => g.ids) };

  const rangeLabel = { today: 'Hari ini', tomorrow: 'Besok', week: '7 hari ke depan', all: 'Semua tanggal', date: d.date ? fmtDateKey(d.date) : 'Semua tanggal' }[d.range];
  document.getElementById('viewSummary').innerHTML =
    `Menampilkan <b>${rows.length}</b> etiket dari <b>${groups.length}</b> pasien · ${escapeHtml(rangeLabel)}` +
    (printOn && d.status !== 'all' ? ' · ' + (d.status === 'belum' ? 'belum dicetak' : 'sudah dicetak') : '') +
    (q ? ` · cari "${escapeHtml(q)}"` : '');

  if (!groups.length) {
    const adaData = CACHE.etiket.length > 0;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:24px;">Tidak ada data${adaData ? ' untuk filter ini.<br><button class="btn ghost small" style="margin-top:10px;" onclick="resetDashFilters()">Tampilkan semua</button>' : '.'}</td></tr>`;
    return;
  }

  let html = '';
  groups.forEach(g => {
    const belum = printOn ? g.days.reduce((n, dy) => n + dy.rows.filter(r => printState(r) !== 'sudah').length, 0) : 0;
    const statusPill = !printOn ? '' : (belum
      ? `<span class="pill warn">${belum} belum dicetak</span>`
      : `<span class="pill ok">✓ semua tercetak</span>`);
    html += `
      <tr class="grp-pasien" data-act="toggle-pasien" data-gi="${g.gi}">
        <td class="checkbox-cell"><input type="checkbox" data-act="sel-pasien" data-gi="${g.gi}" title="Pilih semua etiket pasien ini"></td>
        <td colspan="${cols - 1}">
          <span class="caret">${g.expanded ? '▾' : '▸'}</span>
          <b>${escapeHtml(g.nama)}</b> <span class="muted rm-code">${escapeHtml(g.norm)}</span>
          <span class="grp-meta">· ${g.ids.length} etiket · ${g.days.length} hari</span> ${statusPill}
        </td>
      </tr>`;
    if (!g.expanded) return;
    g.days.forEach(dy => {
      html += `
      <tr class="grp-hari">
        <td class="checkbox-cell"><input type="checkbox" data-act="sel-hari" data-gi="${g.gi}" data-di="${dy.di}" title="Pilih semua etiket hari ini"></td>
        <td colspan="${cols - 1}">${dy.hari ? 'H-' + escapeHtml(dy.hari) + ' · ' : ''}${escapeHtml(fmtDateKey(dy.dateKey))} <span class="grp-meta">· ${dy.rows.length} etiket</span></td>
      </tr>`;
      dy.rows.forEach(r => {
        html += `
      <tr class="row-etiket">
        <td class="checkbox-cell"><input type="checkbox" data-act="sel-row" value="${escapeHtml(r.id)}"></td>
        <td>${escapeHtml(r.obat_dosis)}</td>
        <td>${r.hari_ke ? '<span class="badge">H-' + escapeHtml(r.hari_ke) + '</span>' : ''}</td>
        <td>${fmtDateTime(r.tanggal_dibuat)}</td>
        <td>${computeBud(r)}</td>
        ${printOn ? `<td style="white-space:nowrap;">${printPills(r)}</td>` : ''}
        <td>${escapeHtml(r.petugas || '')}</td>
        <td class="actions-cell">
          <button class="icon-btn" title="Edit" onclick="editEtiket('${escapeHtml(r.id)}')">✏️</button>
          <button class="icon-btn danger" title="Hapus" onclick="hapusSatuEtiket('${escapeHtml(r.id)}')">🗑️</button>
        </td>
      </tr>`;
      });
    });
  });
  tbody.innerHTML = html;
}

function renderObatRows() {
  const q = (document.getElementById('searchEtiket')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('etiketTbody');
  const rowsObat = CACHE.etiketObat.filter(r => {
    if (!q) return true;
    return [r.nama_pasien, r.no_rm, r.nama_obat, r.dosis_obat, r.aturan_pakai].some(v => String(v || '').toLowerCase().includes(q));
  });
  window._dashView = { jenis: 'obat', groups: [], ids: rowsObat.map(r => String(r.id)) };
  document.getElementById('viewSummary').innerHTML = `Menampilkan <b>${rowsObat.length}</b> etiket obat` + (q ? ` · cari "${escapeHtml(q)}"` : '');
  if (!rowsObat.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = rowsObat.map(r => `
    <tr>
      <td class="checkbox-cell"><input type="checkbox" data-act="sel-row-obat" value="${escapeHtml(r.id)}"></td>
      <td><b>${escapeHtml(r.nama_pasien)}</b><br><span class="muted rm-code">${escapeHtml(r.no_rm)}</span></td>
      <td><b>${escapeHtml(r.nama_obat)}</b><br><span class="muted">${escapeHtml(r.dosis_obat || '')}</span></td>
      <td>${escapeHtml(r.aturan_pakai || '')}</td>
      <td>${escapeHtml(waktuMakanLabel(r.waktu_makan))}</td>
      <td>${fmtDateTime(r.created_at)}</td>
      <td>${escapeHtml(r.petugas || '')}</td>
      <td class="actions-cell">
        <button class="icon-btn danger" title="Hapus" onclick="hapusSatuEtiketObat('${escapeHtml(r.id)}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

/* ---------------- PILIHAN (disimpan di Set, bukan di DOM) ---------------- */
function idsForCheckbox(cb) {
  const v = window._dashView;
  const act = cb.dataset.act;
  if (act === 'sel-all') return v.ids;
  const g = v.groups[parseInt(cb.dataset.gi, 10)];
  if (!g) return [];
  if (act === 'sel-pasien') return g.ids;
  if (act === 'sel-hari') { const dy = g.days[parseInt(cb.dataset.di, 10)]; return dy ? dy.ids : []; }
  return [];
}

function onEtiketChange(e) {
  const cb = e.target;
  if (!(cb instanceof HTMLInputElement) || !cb.dataset.act) return;
  const sel = currentSel();
  const act = cb.dataset.act;
  const ids = (act === 'sel-row' || act === 'sel-row-obat') ? [cb.value] : idsForCheckbox(cb);
  ids.forEach(id => { if (cb.checked) sel.add(id); else sel.delete(id); });
  syncSelectionUI();
}

function onEtiketClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  if (el.dataset.act === 'toggle-pasien') {
    const g = window._dashView.groups[parseInt(el.dataset.gi, 10)];
    if (!g) return;
    window._expand[g.key] = !g.expanded;
    renderEtiketRows();
  }
}

// Samakan tampilan semua checkbox dengan isi Set (termasuk status "sebagian" pada pasien/hari)
function syncSelectionUI() {
  const table = document.getElementById('etiketTable');
  if (!table) return;
  const sel = currentSel();
  table.querySelectorAll('input[data-act]').forEach(cb => {
    const act = cb.dataset.act;
    if (act === 'sel-row' || act === 'sel-row-obat') { cb.checked = sel.has(cb.value); return; }
    const ids = idsForCheckbox(cb);
    const n = ids.reduce((c, id) => c + (sel.has(id) ? 1 : 0), 0);
    cb.checked = ids.length > 0 && n === ids.length;
    cb.indeterminate = n > 0 && n < ids.length;
  });
  updateSelBar();
}

function pilihBelumDicetak() {
  const sel = window._sel.kemo;
  (window._dashView.groups || []).forEach(g => g.days.forEach(dy => dy.rows.forEach(r => {
    if (printState(r) !== 'sudah') sel.add(String(r.id));
  })));
  syncSelectionUI();
}

function kosongkanPilihan() {
  currentSel().clear();
  syncSelectionUI();
}

function hiddenSelCount() {
  const visible = new Set(window._dashView.ids);
  let n = 0;
  currentSel().forEach(id => { if (!visible.has(id)) n++; });
  return n;
}

function updateSelBar() {
  const bar = document.getElementById('selBar');
  if (!bar) return;
  const sel = currentSel();
  if (!sel.size) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  const isObat = window._dash.jenis === 'obat';
  const src = isObat ? CACHE.etiketObat : CACHE.etiket;
  const byId = new Map(src.map(r => [String(r.id), r]));
  const pasienSet = new Set();
  sel.forEach(id => { const r = byId.get(id); if (r) pasienSet.add(r.no_rm || r.nama_pasien); });
  const hidden = hiddenSelCount();
  const printOn = hasPrintCols();

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="sel-info">
      <b>${sel.size}</b> etiket · <b>${pasienSet.size}</b> pasien dipilih
      ${hidden ? `<span class="sel-hidden">(${hidden} di luar filter saat ini)</span>` : ''}
    </div>
    <div class="sel-actions">
      ${isObat ? `
        <button class="btn" onclick="cetakTerpilihObat()">💊 Cetak Etiket Obat</button>
        <button class="btn danger" onclick="hapusTerpilihObat()">🗑️ Hapus</button>
      ` : `
        <button class="btn" onclick="cetakTerpilih('label')">🏷️ Cetak Label Obat</button>
        <button class="btn" onclick="cetakTerpilih('identitas')">🪪 Cetak Label Identitas</button>
        ${printOn ? `<select onchange="tandaiCetakTerpilih(this.value); this.value='';" title="Ubah status cetak etiket terpilih secara manual">
          <option value="">Tandai…</option>
          <option value="sudah">✔ Sudah dicetak</option>
          <option value="belum">↺ Belum dicetak</option>
        </select>` : ''}
        <button class="btn danger" onclick="hapusTerpilih()">🗑️ Hapus</button>
      `}
      <button class="btn ghost" onclick="kosongkanPilihan()">✕ Kosongkan</button>
    </div>`;
}

/* ---------------- AKSI: CETAK / TANDAI / HAPUS ---------------- */
function cetakTerpilih(jenis) {
  const ids = Array.from(window._sel.kemo);
  if (!ids.length) { alert('Pilih minimal satu etiket dulu (centang di tabel).'); return; }
  const page = jenis === 'identitas' ? 'print/label-identitas.html' : 'print/label.html';
  window.open(page + '?ids=' + encodeURIComponent(ids.join(',')), '_blank');
}

function cetakTerpilihObat() {
  const ids = Array.from(window._sel.obat);
  if (!ids.length) { alert('Pilih minimal satu etiket obat dulu (centang di tabel).'); return; }
  window.open('print/label-obat.html?ids=' + encodeURIComponent(ids.join(',')), '_blank');
}

async function tandaiCetakTerpilih(val) {
  if (!val) return;
  const ids = Array.from(window._sel.kemo);
  if (!ids.length) return;
  const at = val === 'sudah' ? new Date().toISOString() : null;
  const { error } = await supabase.from('etiket').update({ dicetak_at: at, identitas_dicetak_at: at }).in('id', ids);
  if (error) { alert('Gagal memperbarui status cetak: ' + error.message); return; }
  const byId = new Map(CACHE.etiket.map(r => [String(r.id), r]));
  ids.forEach(id => { const r = byId.get(id); if (r) { r.dicetak_at = at; r.identitas_dicetak_at = at; } });
  renderDashFilters();
  renderEtiketRows();
}

async function hapusTerpilih() {
  const ids = Array.from(window._sel.kemo);
  if (!ids.length) { alert('Pilih minimal satu etiket dulu.'); return; }
  const hidden = hiddenSelCount();
  const extra = hidden ? '\n\n⚠ ' + hidden + ' di antaranya tidak terlihat karena filter yang sedang aktif.' : '';
  if (!confirm('Hapus ' + ids.length + ' etiket terpilih? Tindakan ini tidak bisa dibatalkan.' + extra)) return;
  const { error } = await supabase.from('etiket').delete().in('id', ids);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  window._sel.kemo.clear();
  await loadAllData();
  navigate('dashboard');
}

async function hapusSatuEtiket(id) {
  if (!confirm('Hapus etiket ini?')) return;
  const { error } = await supabase.from('etiket').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  window._sel.kemo.delete(String(id));
  await loadAllData();
  navigate('dashboard');
}

async function hapusTerpilihObat() {
  const ids = Array.from(window._sel.obat);
  if (!ids.length) { alert('Pilih minimal satu etiket obat dulu.'); return; }
  const hidden = hiddenSelCount();
  const extra = hidden ? '\n\n⚠ ' + hidden + ' di antaranya tidak terlihat karena pencarian yang sedang aktif.' : '';
  if (!confirm('Hapus ' + ids.length + ' etiket obat terpilih? Tindakan ini tidak bisa dibatalkan.' + extra)) return;
  const { error } = await supabase.from('etiket_obat').delete().in('id', ids);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  window._sel.obat.clear();
  await loadAllData();
  navigate('dashboard');
}

async function hapusSatuEtiketObat(id) {
  if (!confirm('Hapus etiket obat ini?')) return;
  const { error } = await supabase.from('etiket_obat').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  window._sel.obat.delete(String(id));
  await loadAllData();
  navigate('dashboard');
}

/* ---------------- SEGARKAN STATUS CETAK SAAT KEMBALI DARI TAB CETAK ---------------- */
// Halaman cetak (tab baru) menulis dicetak_at ke database setelah petugas
// mengonfirmasi. Begitu petugas kembali ke tab ini, ambil ulang data etiket
// secara diam-diam supaya status & filter langsung mutakhir.
let _lastEtiketRefresh = 0;
async function refreshEtiketQuietly() {
  if (CURRENT_ROUTE !== 'dashboard' || !window._dash || window._dash.jenis !== 'kemo') return;
  if (!document.getElementById('etiketTbody')) return;
  const now = Date.now();
  if (now - _lastEtiketRefresh < 3000) return;
  _lastEtiketRefresh = now;
  const { data, error } = await supabase.from('etiket').select('*').order('created_at', { ascending: false });
  if (error || !data) return;
  CACHE.etiket = data;
  pruneSelection();
  if (!document.getElementById('etiketTbody')) return; // sudah pindah halaman selama menunggu
  renderDashFilters();
  renderEtiketRows();
}
window.addEventListener('focus', refreshEtiketQuietly);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshEtiketQuietly(); });

/* ---------------- DETEKSI PERUBAHAN ISI LABEL (reset status cetak saat diedit) ---------------- */
function labelDataChanged(oldRow, newRow) {
  const s = v => (v == null ? '' : String(v).trim());
  const n = v => (v == null || v === '' || isNaN(Number(v)) ? '' : String(Number(v)));
  const t = v => { const x = new Date(v); return isNaN(x.getTime()) ? '' : String(x.getTime()); };
  const dOnly = v => s(String(v || '').split('T')[0]);
  return ['nama_pasien', 'no_rm', 'obat_dosis', 'ambil', 'sediaan', 'pelarut', 'total_volume_ml'].some(k => s(oldRow[k]) !== s(newRow[k]))
    || n(oldRow.hari_ke) !== n(newRow.hari_ke)
    || n(oldRow.bud_durasi_jam) !== n(newRow.bud_durasi_jam)
    || t(oldRow.tanggal_dibuat) !== t(newRow.tanggal_dibuat)
    || dOnly(oldRow.tanggal_lahir) !== dOnly(newRow.tanggal_lahir);
}

// Pecah satu baris etiket (yang mungkin berisi >1 obat digabung dalam 1 pelarut)
// menjadi array item regimen untuk ditampilkan/diedit di form Entri.
function expandEtiketRowToItems(row) {
  if (Array.isArray(row.detail_obat) && row.detail_obat.length > 1) {
    return row.detail_obat.map((d, idx) => ({
      obatNama: d.obatNama, dosisMg: d.dosisMg, obatDosis: d.obatDosis,
      ambil: d.ambil, sediaan: d.sediaan,
      namaPelarut: row.nama_pelarut, volPelarut: row.volume_pelarut_ml, caraPemberian: row.cara_pemberian,
      pelarut: row.pelarut, hariKe: row.hari_ke, budDurasi: row.bud_durasi_jam,
      merge: idx > 0
    }));
  }
  return [{
    obatNama: row.nama_obat, dosisMg: row.dosis_mg, obatDosis: row.obat_dosis,
    ambil: row.ambil, sediaan: row.sediaan,
    namaPelarut: row.nama_pelarut, volPelarut: row.volume_pelarut_ml, caraPemberian: row.cara_pemberian,
    pelarut: row.pelarut, hariKe: row.hari_ke, budDurasi: row.bud_durasi_jam
  }];
}

function editEtiket(id) {
  const row = CACHE.etiket.find(r => r.id === id);
  if (!row) return;
  const obatItems = row.batch_id
    ? CACHE.etiketObat.filter(o => o.batch_id === row.batch_id).map(o => ({
        dbid: o.id, obatNama: o.nama_obat, dosisObat: o.dosis_obat,
        aturanPakai: o.aturan_pakai, waktuMakan: o.waktu_makan
      }))
    : [];
  PREFILL_ENTRI = {
    editId: row.id,
    namaPasien: row.nama_pasien, noRM: row.no_rm, tanggalLahir: toISODateInput(row.tanggal_lahir),
    lokasi: row.lokasi,
    tanggalMulai: row.tanggal_dibuat ? new Date(row.tanggal_dibuat).toISOString().slice(0,16) : '',
    items: expandEtiketRowToItems(row),
    obatItems
  };
  navigate('entri');
}

/* ============================================================
   HALAMAN: ENTRI DATA BARU
   ============================================================ */
let itemUid = 0;
let obatItemUid = 0; // uid terpisah untuk item "Etiket Obat" (di bawah), tidak berbagi hitungan dgn regimen

function renderEntri(content) {
  const prefill = PREFILL_ENTRI;
  PREFILL_ENTRI = null;
  itemUid = 0;
  obatItemUid = 0;

  content.innerHTML = `
    <div id="entriMsg"></div>
    <div class="card">
      <h2>Data Pasien</h2>
      <div class="row3">
        <div>
          <label>No RM *</label>
          <input type="text" id="f_noRM" list="pasienRmList" placeholder="000123456" oninput="lookupPasienByRM()">
          <datalist id="pasienRmList">${CACHE.pasien.map(p => `<option value="${escapeHtml(p.no_rm)}">${escapeHtml(p.nama_pasien)}</option>`).join('')}</datalist>
        </div>
        <div>
          <label>Nama Pasien *</label>
          <input type="text" id="f_namaPasien" placeholder="Nama lengkap">
        </div>
        <div>
          <label>Tanggal Lahir</label>
          <input type="date" id="f_tanggalLahir">
        </div>
      </div>
      <div class="row2">
        <div>
          <label>Lokasi / Ruang</label>
          <input type="text" id="f_lokasi" placeholder="ENGGANG LT.3 / KAMAR 305 / BED 03">
        </div>
        <div>
          <label>Tanggal &amp; Jam Kemoterapi (Hari ke-1) *</label>
          <input type="datetime-local" id="f_tanggalMulai" onchange="updateAllTanggal()">
        </div>
      </div>
      <div id="riwayatBanner"></div>
    </div>

    <div class="card">
      <h2>Regimen Obat</h2>
      <div id="regimenContainer"></div>
      <button class="btn secondary" type="button" onclick="tambahRegimenItem()">➕ Tambah Obat</button>
    </div>

    <div class="card">
      <h2>💊 Etiket Obat <span class="muted" style="font-weight:500;font-size:12.5px;">(opsional)</span></h2>
      <p class="hint" style="margin:0 0 10px;">Isi bagian ini kalau pasien juga perlu etiket untuk obat lain (bukan obat infus kemo di atas) — mis. obat oral pulang. Identitas pasien memakai data yang sudah diisi di kartu "Data Pasien".</p>
      <div id="obatLabelContainer"></div>
      <button class="btn secondary" type="button" onclick="tambahObatLabelItem()">➕ Tambah Obat</button>
    </div>

    <div class="card">
      <button class="btn" onclick="simpanEntriBatch()">💾 Simpan Semua</button>
      <button class="btn ghost" onclick="navigate('dashboard')">Batal</button>
    </div>
    <datalist id="daftarObatList">${CACHE.obat.map(o => `<option value="${escapeHtml(o.nama_obat)}">`).join('')}</datalist>
    <datalist id="daftarPelarutList">${CACHE.pelarut.map(p => `<option value="${escapeHtml(p.nama_pelarut)}">`).join('')}</datalist>
  `;

  const obatLabelContainer = document.getElementById('obatLabelContainer');
  obatLabelContainer.dataset.originalIds = '[]';

  if (prefill) {
    document.getElementById('f_noRM').value = prefill.noRM || '';
    document.getElementById('f_namaPasien').value = prefill.namaPasien || '';
    document.getElementById('f_tanggalLahir').value = prefill.tanggalLahir || '';
    document.getElementById('f_lokasi').value = prefill.lokasi || '';
    document.getElementById('f_tanggalMulai').value = prefill.tanggalMulai || defaultTanggalMulai();
    document.getElementById('regimenContainer').dataset.editId = prefill.editId || '';
    (prefill.items || []).forEach(it => tambahRegimenItem(it));
    if (!prefill.items || !prefill.items.length) tambahRegimenItem();
    if (prefill.noRM) tampilkanRiwayat(prefill.noRM, /*silent*/true);
    (prefill.obatItems || []).forEach(it => tambahObatLabelItem(it));
    obatLabelContainer.dataset.originalIds = JSON.stringify((prefill.obatItems || []).map(o => o.dbid).filter(Boolean));
  } else {
    document.getElementById('f_tanggalMulai').value = defaultTanggalMulai();
    tambahRegimenItem();
  }
}

/* ============================================================
   BAGIAN: ETIKET OBAT (melekat di halaman Entri yang sama)
   ============================================================ */
function obatLabelItemTemplate(uid) {
  return `
  <div class="obat-label-item" id="obatItem_${uid}" data-uid="${uid}">
    <div class="item-head">
      <span class="item-title"><span class="item-badge item-num-obat"></span>Obat</span>
      <button type="button" class="btn ghost" style="padding:4px 10px;" onclick="hapusObatLabelItem(${uid})">🗑 Hapus</button>
    </div>
    <label>Nama Obat *</label>
    <input type="text" id="obatLabelNama_${uid}" list="daftarObatList" placeholder="mis. Ondansetron Tablet">
    <div class="row2">
      <div><label>Dosis Obat *</label><input type="text" id="obatLabelDosis_${uid}" placeholder="mis. 8 mg"></div>
      <div><label>Aturan Pakai *</label><input type="text" id="obatLabelAturan_${uid}" placeholder="mis. 3 x 1 tablet"></div>
    </div>
    <label>Keterangan Waktu</label>
    <select id="obatLabelWaktu_${uid}">
      <option value="">— Tanpa keterangan —</option>
      <option value="sebelum">Sebelum Makan</option>
      <option value="sesudah">Sesudah Makan</option>
      <option value="bebas">Boleh Kapan Saja</option>
    </select>
  </div>`;
}

function tambahObatLabelItem(prefillItem) {
  obatItemUid += 1;
  const uid = obatItemUid;
  document.getElementById('obatLabelContainer').insertAdjacentHTML('beforeend', obatLabelItemTemplate(uid));
  if (prefillItem) {
    document.getElementById('obatLabelNama_' + uid).value = prefillItem.obatNama || '';
    document.getElementById('obatLabelDosis_' + uid).value = prefillItem.dosisObat || '';
    document.getElementById('obatLabelAturan_' + uid).value = prefillItem.aturanPakai || '';
    document.getElementById('obatLabelWaktu_' + uid).value = prefillItem.waktuMakan || '';
    if (prefillItem.dbid) document.getElementById('obatItem_' + uid).dataset.dbid = prefillItem.dbid;
  }
  renderObatItemNumbers();
}

function hapusObatLabelItem(uid) {
  document.getElementById('obatItem_' + uid)?.remove();
  renderObatItemNumbers();
}

function renderObatItemNumbers() {
  document.querySelectorAll('.obat-label-item').forEach((el, idx) => {
    const badge = el.querySelector('.item-num-obat');
    if (badge) badge.textContent = idx + 1;
  });
}

/* PERBAIKAN: default jam untuk field "Tanggal & Jam Kemoterapi (Hari ke-1)"
   sekarang selalu jam 11:00 pada tanggal hari ini, bukan ikut jam saat
   petugas membuka form entri. Kalau petugas mengubah field ini secara
   manual, nilai yang diketik tetap dipakai (fungsi ini hanya dipanggil
   sekali untuk mengisi nilai awal). */
function defaultTanggalMulai() {
  const d = new Date();
  d.setHours(11, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function lookupPasienByRM() {
  const rm = document.getElementById('f_noRM').value.trim();
  const p = CACHE.pasien.find(x => x.no_rm === rm);
  if (p) {
    document.getElementById('f_namaPasien').value = p.nama_pasien;
    document.getElementById('f_tanggalLahir').value = toISODateInput(p.tanggal_lahir);
    tampilkanRiwayat(rm);
  } else {
    document.getElementById('riwayatBanner').innerHTML = '';
  }
}

function tampilkanRiwayat(noRM, silent) {
  const batches = getBatchesForPasien(noRM);
  const el = document.getElementById('riwayatBanner');
  if (!batches.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="hint" style="margin-top:10px;">Pasien ini punya ${batches.length} riwayat kunjungan.
    <select id="riwayatPicker" onchange="terapkanRiwayat(this.value)">
      <option value="">— pilih kunjungan untuk isi otomatis regimen —</option>
      ${batches.map((b,i) => `<option value="${i}">${fmtDateTime(b.tanggal)} — ${escapeHtml(b.ringkasan)}</option>`).join('')}
    </select></div>
  `;
}

function getBatchesForPasien(noRM) {
  const rows = CACHE.etiket.filter(r => r.no_rm === noRM);
  const map = {};
  rows.forEach(r => {
    const bid = r.batch_id || r.id;
    if (!map[bid]) map[bid] = { tanggal: r.tanggal_dibuat, items: [] };
    if (r.tanggal_dibuat && (!map[bid].tanggal || new Date(r.tanggal_dibuat) > new Date(map[bid].tanggal))) map[bid].tanggal = r.tanggal_dibuat;
    map[bid].items.push(r);
  });
  const list = Object.values(map);
  list.forEach(b => b.ringkasan = Array.from(new Set(b.items.map(i=>i.nama_obat).filter(Boolean))).join(', ') || '(tanpa nama obat)');
  list.sort((a,b) => new Date(b.tanggal||0) - new Date(a.tanggal||0));
  return list;
}

function terapkanRiwayat(idx) {
  if (idx === '') return;
  const noRM = document.getElementById('f_noRM').value.trim();
  const batch = getBatchesForPasien(noRM)[parseInt(idx, 10)];
  if (!batch) return;
  document.getElementById('regimenContainer').innerHTML = '';
  batch.items.forEach(r => {
    expandEtiketRowToItems(r).forEach(it => tambahRegimenItem(it));
  });
}

function itemTemplate(uid) {
  return `
  <div class="regimen-item" id="item_${uid}" data-uid="${uid}">
    <div class="item-head">
      <span class="item-title"><span class="item-badge item-num"></span>Obat</span>
      <button type="button" class="btn ghost" style="padding:4px 10px;" onclick="hapusRegimenItem(${uid})">🗑 Hapus</button>
    </div>
    <div class="merge-row hidden" id="mergeRow_${uid}">
      <label class="checkbox-inline">
        <input type="checkbox" id="merge_${uid}" onchange="toggleMerge(${uid})">
        🔗 Gabungkan dengan obat di atas dalam 1 etiket (pakai 1 pelarut &amp; jadwal yang sama)
      </label>
      <div class="hint hidden" id="mergeHint_${uid}">Pelarut &amp; jadwal etiket ini memakai punya obat sebelumnya.</div>
    </div>
    <label>Nama Obat (ketik untuk cari) *</label>
    <input type="text" id="obatNama_${uid}" list="daftarObatList" placeholder="Ketik nama obat..." oninput="hitungOtomatis(${uid})">
    <div class="row2">
      <div><label>Dosis Diminta (mg)</label><input type="number" id="dosisMg_${uid}" step="0.01" oninput="hitungOtomatis(${uid})"></div>
      <div><label>Konsentrasi (otomatis)</label><input type="text" id="konsentrasiInfo_${uid}" disabled></div>
    </div>
    <div class="calc-box hidden" id="calcBox_${uid}">Volume yang diambil: <b id="calcResult_${uid}">-</b> mL</div>
    <label>Nama Obat &amp; Dosis (tampil di etiket) *</label>
    <input type="text" id="obatDosis_${uid}" placeholder="Ondansetron Injeksi (3 mg)">
    <div class="row2">
      <div><label>Ambil (Volume Diambil) *</label><input type="text" id="ambil_${uid}" placeholder="1.5 mL" oninput="hitungTotalVolume(${uid})"></div>
      <div><label>Sediaan</label><input type="text" id="sediaan_${uid}" placeholder="4 mg / 2 mL"></div>
    </div>
    <div id="pelarutSection_${uid}">
      <div class="subsection-divider">Pelarut</div>
      <label>Nama Pelarut (ketik untuk cari) *</label>
      <input type="text" id="namaPelarut_${uid}" list="daftarPelarutList" placeholder="Ketik atau pilih pelarut..." oninput="composePelarut(${uid})">
      <div class="row2">
        <div><label>Volume Pelarut (mL)</label><input type="number" id="volPelarut_${uid}" step="0.01" oninput="composePelarut(${uid}); hitungTotalVolume(${uid})"></div>
        <div><label>Cara Pemberian</label><input type="text" id="caraPemberian_${uid}" placeholder="Bolus Pelan" oninput="composePelarut(${uid})"></div>
      </div>
      <label>Pelarut (tampil di etiket)</label>
      <input type="text" id="pelarut_${uid}" placeholder="Terisi otomatis dari field di atas">
      <div class="calc-box hidden" id="totalBox_${uid}">Total Volume: <b id="totalResult_${uid}">-</b> mL</div>
    </div>
    <div id="jadwalSection_${uid}">
      <div class="subsection-divider">Jadwal item ini</div>
      <div class="row2">
        <div><label>Hari Ke-</label><input type="number" id="hariKe_${uid}" min="1" step="1" oninput="hitungTanggalItem(${uid})"></div>
        <div><label>BUD Durasi (jam)</label><input type="number" id="budDurasi_${uid}" value="24" step="0.5"></div>
      </div>
      <div class="tanggal-info" id="tanggalInfo_${uid}">📅 Akan dibuat: -</div>
    </div>
  </div>`;
}

function toggleMerge(uid) {
  const cb = document.getElementById('merge_' + uid);
  const checked = !!(cb && cb.checked);
  document.getElementById('pelarutSection_' + uid)?.classList.toggle('hidden', checked);
  document.getElementById('jadwalSection_' + uid)?.classList.toggle('hidden', checked);
  document.getElementById('mergeHint_' + uid)?.classList.toggle('hidden', !checked);
}

function tambahRegimenItem(prefillItem) {
  itemUid += 1;
  const uid = itemUid;
  document.getElementById('regimenContainer').insertAdjacentHTML('beforeend', itemTemplate(uid));

  // Hari Ke- default: ikuti hari ke item sebelumnya (bukan urutan penambahan).
  // Kalau ini item pertama, defaultnya hari ke-1.
  const items = document.querySelectorAll('.regimen-item');
  let defaultHariKe = 1;
  if (items.length > 1) {
    const prevUid = items[items.length - 2].getAttribute('data-uid');
    const prevVal = parseInt(document.getElementById('hariKe_' + prevUid)?.value, 10);
    defaultHariKe = isNaN(prevVal) ? 1 : prevVal;
  }
  document.getElementById('hariKe_' + uid).value = defaultHariKe;

  if (prefillItem) {
    document.getElementById('obatNama_' + uid).value = prefillItem.obatNama || '';
    document.getElementById('dosisMg_' + uid).value = prefillItem.dosisMg || '';
    document.getElementById('obatDosis_' + uid).value = prefillItem.obatDosis || '';
    document.getElementById('ambil_' + uid).value = prefillItem.ambil || '';
    document.getElementById('sediaan_' + uid).value = prefillItem.sediaan || '';
    document.getElementById('namaPelarut_' + uid).value = prefillItem.namaPelarut || '';
    document.getElementById('volPelarut_' + uid).value = prefillItem.volPelarut || '';
    document.getElementById('caraPemberian_' + uid).value = prefillItem.caraPemberian || '';
    document.getElementById('pelarut_' + uid).value = prefillItem.pelarut || '';
    document.getElementById('hariKe_' + uid).value = prefillItem.hariKe || defaultHariKe;
    document.getElementById('budDurasi_' + uid).value = prefillItem.budDurasi || 24;
    if (prefillItem.merge) {
      const cb = document.getElementById('merge_' + uid);
      if (cb) cb.checked = true;
    }
  }
  renderItemNumbers();
  if (prefillItem && prefillItem.merge) toggleMerge(uid);
  hitungTanggalItem(uid);
}

function hapusRegimenItem(uid) {
  const items = document.querySelectorAll('.regimen-item');
  if (items.length <= 1) return;
  document.getElementById('item_' + uid)?.remove();
  renderItemNumbers();
}
function renderItemNumbers() {
  const allItems = document.querySelectorAll('.regimen-item');
  allItems.forEach((el, idx) => {
    el.querySelector('.item-num').textContent = idx + 1;
    el.querySelector('.btn.ghost').style.display = allItems.length > 1 ? 'inline-flex' : 'none';
    const uid = el.getAttribute('data-uid');
    const mergeRow = document.getElementById('mergeRow_' + uid);
    if (!mergeRow) return;
    if (idx === 0) {
      // Obat pertama tidak bisa digabung (tidak ada obat sebelumnya)
      mergeRow.classList.add('hidden');
      const cb = document.getElementById('merge_' + uid);
      if (cb && cb.checked) { cb.checked = false; toggleMerge(uid); }
    } else {
      mergeRow.classList.remove('hidden');
    }
  });
}

function cariObat(nama) {
  if (!nama) return null;
  const n = nama.trim().toLowerCase();
  return CACHE.obat.find(o => o.nama_obat.toLowerCase() === n) || null;
}

function cariPelarut(nama) {
  if (!nama) return null;
  const n = nama.trim().toLowerCase();
  return CACHE.pelarut.find(p => p.nama_pelarut.toLowerCase() === n) || null;
}

function hitungOtomatis(uid) {
  const namaInput = document.getElementById('obatNama_' + uid);
  const dosisInput = document.getElementById('dosisMg_' + uid);
  const konsentrasiInfo = document.getElementById('konsentrasiInfo_' + uid);
  const calcBox = document.getElementById('calcBox_' + uid);
  const obatDosisField = document.getElementById('obatDosis_' + uid);
  const ambilField = document.getElementById('ambil_' + uid);
  const obat = cariObat(namaInput.value);
  const dosis = parseFloat(dosisInput.value);

  if (!obat) { konsentrasiInfo.value = ''; calcBox.classList.add('hidden'); return; }
  konsentrasiInfo.value = obat.konsentrasi + ' ' + (obat.satuan || 'mg/ml');
  if (!isNaN(dosis) && obat.konsentrasi) {
    const vol = dosis / obat.konsentrasi;
    document.getElementById('calcResult_' + uid).textContent = round2(vol);
    calcBox.classList.remove('hidden');
    ambilField.value = round2(vol) + ' mL';
  }
  if (!obatDosisField.value || obatDosisField.dataset.auto === '1') {
    obatDosisField.value = obat.nama_obat + (dosis ? ' Injeksi (' + dosis + ' mg)' : ' Injeksi');
    obatDosisField.dataset.auto = '1';
  }
  hitungTotalVolume(uid);
}

function composePelarut(uid) {
  const nama = document.getElementById('namaPelarut_' + uid).value.trim();
  const vol = document.getElementById('volPelarut_' + uid).value;
  const cara = document.getElementById('caraPemberian_' + uid).value.trim();
  const field = document.getElementById('pelarut_' + uid);
  if (!nama && !vol && !cara) return;
  let s = nama;
  const parts = [];
  if (vol) parts.push(vol + ' mL');
  if (cara) parts.push(cara);
  if (parts.length) s += ' (' + parts.join(', ') + ')';
  field.value = s;
}

function hitungTotalVolume(uid) {
  const ambilTxt = document.getElementById('ambil_' + uid).value;
  const volPelarut = parseFloat(document.getElementById('volPelarut_' + uid).value) || 0;
  const ambilNum = parseFloat(ambilTxt);
  const box = document.getElementById('totalBox_' + uid);
  if (isNaN(ambilNum)) { box.classList.add('hidden'); return; }
  const total = ambilNum + volPelarut;
  document.getElementById('totalResult_' + uid).textContent = round2(total);
  box.classList.remove('hidden');
}

function round2(n) { return Math.round(n * 100) / 100; }

function hitungTanggalItem(uid) {
  const base = document.getElementById('f_tanggalMulai').value;
  const hariKe = parseInt(document.getElementById('hariKe_' + uid).value, 10) || 1;
  const infoEl = document.getElementById('tanggalInfo_' + uid);
  if (!infoEl) return;
  if (!base) { infoEl.textContent = '📅 Isi dulu Tanggal & Jam Kemoterapi (Hari ke-1) di atas.'; return; }
  const baseDate = new Date(base);
  baseDate.setDate(baseDate.getDate() + (hariKe - 1));
  infoEl.textContent = '📅 Akan dibuat: ' + baseDate.toLocaleDateString('id-ID') + ' ' +
    baseDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (Hari ke-' + hariKe + ')';
  infoEl.dataset.iso = baseDate.toISOString();
}
function updateAllTanggal() {
  document.querySelectorAll('.regimen-item').forEach(el => hitungTanggalItem(el.getAttribute('data-uid')));
}

async function simpanEntriBatch() {
  const msgBox = document.getElementById('entriMsg');
  msgBox.innerHTML = '';
  const noRM = document.getElementById('f_noRM').value.trim();
  const namaPasien = document.getElementById('f_namaPasien').value.trim();
  const tanggalLahir = document.getElementById('f_tanggalLahir').value || null;
  const lokasi = document.getElementById('f_lokasi').value.trim();
  const tanggalMulai = document.getElementById('f_tanggalMulai').value;

  if (!noRM || !namaPasien || !tanggalMulai) {
    toast(msgBox, 'err', 'No RM, Nama Pasien, dan Tanggal & Jam Kemoterapi wajib diisi.');
    return;
  }

  const itemEls = Array.from(document.querySelectorAll('.regimen-item'));
  const rawItems = [];
  for (let i = 0; i < itemEls.length; i++) {
    const uid = itemEls[i].getAttribute('data-uid');
    const obatDosis = document.getElementById('obatDosis_' + uid).value.trim();
    const ambil = document.getElementById('ambil_' + uid).value.trim();
    if (!obatDosis || !ambil) {
      toast(msgBox, 'err', 'Item Obat #' + (i + 1) + ': Nama Obat & Dosis dan Ambil wajib diisi.');
      return;
    }
    const infoEl = document.getElementById('tanggalInfo_' + uid);
    const merge = i > 0 && !!document.getElementById('merge_' + uid)?.checked;
    rawItems.push({
      merge,
      obatNama: document.getElementById('obatNama_' + uid).value.trim(),
      dosisMg: parseFloat(document.getElementById('dosisMg_' + uid).value) || null,
      obatDosis,
      ambil,
      sediaan: document.getElementById('sediaan_' + uid).value.trim(),
      namaPelarut: document.getElementById('namaPelarut_' + uid).value.trim(),
      volPelarut: parseFloat(document.getElementById('volPelarut_' + uid).value) || null,
      caraPemberian: document.getElementById('caraPemberian_' + uid).value.trim(),
      pelarut: document.getElementById('pelarut_' + uid).value.trim(),
      hariKe: parseInt(document.getElementById('hariKe_' + uid).value, 10) || null,
      budDurasi: parseFloat(document.getElementById('budDurasi_' + uid).value) || 24,
      tanggalDibuatISO: infoEl?.dataset.iso || isoLocalFromInput(tanggalMulai)
    });
  }

  // Kelompokkan item yang dicentang "gabung" ke dalam item sebelumnya (leader).
  // Satu kelompok = satu etiket, memakai pelarut & jadwal dari item leader (yang tidak digabung).
  const groups = [];
  for (const it of rawItems) {
    if (!it.merge || !groups.length) {
      groups.push([it]);
    } else {
      groups[groups.length - 1].push(it);
    }
  }

  const items = groups.map(members => {
    const leader = members[0];
    if (members.length === 1) {
      return {
        obatNama: leader.obatNama, dosisMg: leader.dosisMg, obatDosis: leader.obatDosis,
        ambil: leader.ambil, sediaan: leader.sediaan,
        namaPelarut: leader.namaPelarut, volPelarut: leader.volPelarut, caraPemberian: leader.caraPemberian,
        pelarut: leader.pelarut, hariKe: leader.hariKe, budDurasi: leader.budDurasi,
        tanggalDibuatISO: leader.tanggalDibuatISO,
        totalVolumeMl: (parseFloat(leader.ambil) || 0) + (leader.volPelarut || 0),
        detailObat: null
      };
    }
    const totalAmbilNum = members.reduce((sum, m) => sum + (parseFloat(m.ambil) || 0), 0);
    return {
      obatNama: members.map(m => m.obatNama).filter(Boolean).join(', '),
      dosisMg: null, // dosis campuran, lihat detail_obat untuk rincian per obat
      obatDosis: members.map(m => m.obatDosis).filter(Boolean).join(' + '),
      ambil: members.map(m => m.ambil).filter(Boolean).join(' + '),
      sediaan: members.map(m => m.sediaan).filter(Boolean).join(' ; '),
      namaPelarut: leader.namaPelarut, volPelarut: leader.volPelarut, caraPemberian: leader.caraPemberian,
      pelarut: leader.pelarut, hariKe: leader.hariKe, budDurasi: leader.budDurasi,
      tanggalDibuatISO: leader.tanggalDibuatISO,
      totalVolumeMl: totalAmbilNum + (leader.volPelarut || 0),
      detailObat: members.map(m => ({
        obatNama: m.obatNama, dosisMg: m.dosisMg, obatDosis: m.obatDosis, ambil: m.ambil, sediaan: m.sediaan
      }))
    };
  });

  // 1) upsert pasien
  await supabase.from('pasien').upsert({ no_rm: noRM, nama_pasien: namaPasien, tanggal_lahir: tanggalLahir, updated_at: new Date().toISOString() });

  // 2) simpan tiap item: timpa kalau memang baris yang sama sudah ada, kalau tidak insert baru
  const batchId = 'b-' + Date.now();
  const editId = document.getElementById('regimenContainer').dataset.editId;
  let overwritten = 0, inserted = 0;

  /* PERBAIKAN BUG #2 (duplikat nama obat, dosis beda dalam 1x entri):
     `usedExistingIds` mencatat baris database mana saja yang SUDAH
     "diklaim" oleh salah satu grup dalam proses simpan kali ini.
     Ini mencegah grup berikutnya salah mencocokkan diri ke baris
     yang baru saja dibuat/ditimpa oleh grup sebelumnya dalam loop
     yang sama (mis. Mesna 900 mg dan Mesna 2000 mg pada hari yang
     sama — tanpa penanda ini, grup kedua akan menganggap baris
     Mesna 900 yang baru dibuat sebagai "existing" miliknya sendiri
     dan menimpanya, sehingga salah satu dosis hilang). */
  const usedExistingIds = new Set();

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    let existing = null;

    /* ============================================================
       PERBAIKAN BUG #1
       ------------------------------------------------------------
       SEBELUM: kalau form dibuka dalam mode edit (editId terisi),
       SEMUA grup regimen dicocokkan ke `existing = editId` yang SAMA.
       Akibatnya, kalau ada >1 grup (mis. >4 regimen, atau beberapa
       regimen yang tidak digabung), tiap grup saling menimpa baris
       database yang sama secara berurutan. Hasil akhirnya hanya
       grup TERAKHIR yang benar-benar tersimpan di baris itu.

       SESUDAH: `editId` hanya dipakai untuk mencari existing pada
       grup PERTAMA (idx === 0), yaitu baris yang sedang diedit.
       ============================================================ */
    if (editId && idx === 0) {
      existing = CACHE.etiket.find(e => e.id === editId);
    } else {
      /* PERBAIKAN BUG #2: kriteria pencocokan ditambah dosis_mg dan
         nama_pelarut (tidak hanya no_rm + hari_ke + nama_obat), dan
         baris yang sudah dipakai grup lain (usedExistingIds) di-skip.
         Ini membedakan Mesna 900mg vs Mesna 2000mg pada hari yang
         sama, yang sebelumnya dianggap "obat yang sama" lalu saling
         menimpa. */
      existing = CACHE.etiket.find(e =>
        e.no_rm === noRM &&
        String(e.hari_ke || '') === String(it.hariKe || '') &&
        String(e.nama_obat || '').toLowerCase() === String(it.obatNama || '').toLowerCase() &&
        String(e.dosis_mg ?? '') === String(it.dosisMg ?? '') &&
        String(e.nama_pelarut || '').toLowerCase() === String(it.namaPelarut || '').toLowerCase() &&
        it.obatNama &&
        e.id !== editId &&
        !usedExistingIds.has(e.id)
      );
    }
    if (existing) usedExistingIds.add(existing.id);

    const payload = {
      nama_pasien: namaPasien, no_rm: noRM, tanggal_lahir: tanggalLahir, lokasi,
      obat_dosis: it.obatDosis, nama_obat: it.obatNama, dosis_mg: it.dosisMg,
      hari_ke: it.hariKe, ambil: it.ambil, sediaan: it.sediaan,
      total_volume_ml: it.totalVolumeMl ? String(round2(it.totalVolumeMl)) + ' mL' : null,
      nama_pelarut: it.namaPelarut, volume_pelarut_ml: it.volPelarut, cara_pemberian: it.caraPemberian,
      pelarut: it.pelarut, bud_durasi_jam: it.budDurasi,
      tanggal_dibuat: it.tanggalDibuatISO, batch_id: batchId,
      detail_obat: it.detailObat
    };

    if (existing) {
      payload.id = existing.id;
      // Isi label berubah -> label lama sudah tidak valid, status cetak dikembalikan ke "belum".
      // (Hanya diisi kalau kolom status cetak memang sudah ada di database.)
      if (hasPrintCols() && labelDataChanged(existing, payload)) {
        payload.dicetak_at = null;
        payload.identitas_dicetak_at = null;
      }
      const { error } = await supabase.from('etiket').update(payload).eq('id', existing.id);
      if (error) { toast(msgBox, 'err', 'Gagal menyimpan (regimen #' + (idx + 1) + '): ' + error.message); return; }
      overwritten++;
    } else {
      payload.id = nextEtiketId();
      const { error } = await supabase.from('etiket').insert(payload);
      if (error) { toast(msgBox, 'err', 'Gagal menyimpan (regimen #' + (idx + 1) + '): ' + error.message); return; }
      CACHE.etiket.push(payload); // supaya nextEtiketId() berikutnya tidak tabrakan dalam loop yang sama
      inserted++;
    }
  }

  // ---- Simpan Etiket Obat (opsional, melekat pada data pasien yang sama di atas) ----
  const obatLabelContainer = document.getElementById('obatLabelContainer');
  const originalObatIds = JSON.parse(obatLabelContainer?.dataset.originalIds || '[]');
  const obatEls = Array.from(document.querySelectorAll('.obat-label-item'));
  const keptObatIds = [];
  let obatInserted = 0, obatUpdated = 0;

  for (let i = 0; i < obatEls.length; i++) {
    const uid = obatEls[i].getAttribute('data-uid');
    const namaObatLabel = document.getElementById('obatLabelNama_' + uid).value.trim();
    const dosisObatLabel = document.getElementById('obatLabelDosis_' + uid).value.trim();
    const aturanPakai = document.getElementById('obatLabelAturan_' + uid).value.trim();
    const waktuMakan = document.getElementById('obatLabelWaktu_' + uid).value;
    if (!namaObatLabel || !dosisObatLabel || !aturanPakai) {
      toast(msgBox, 'err', 'Etiket Obat #' + (i + 1) + ': Nama Obat, Dosis Obat, dan Aturan Pakai wajib diisi.');
      return;
    }
    const dbid = obatEls[i].dataset.dbid || '';
    const payloadObat = {
      nama_pasien: namaPasien, no_rm: noRM, tanggal_lahir: tanggalLahir,
      nama_obat: namaObatLabel, dosis_obat: dosisObatLabel, aturan_pakai: aturanPakai,
      waktu_makan: waktuMakan || null, batch_id: batchId
    };
    if (dbid) {
      const { error } = await supabase.from('etiket_obat').update(payloadObat).eq('id', dbid);
      if (error) { toast(msgBox, 'err', 'Gagal menyimpan Etiket Obat #' + (i + 1) + ': ' + error.message); return; }
      keptObatIds.push(String(dbid));
      obatUpdated++;
    } else {
      const { data: insertedRow, error } = await supabase.from('etiket_obat').insert(payloadObat).select().single();
      if (error) { toast(msgBox, 'err', 'Gagal menyimpan Etiket Obat #' + (i + 1) + ': ' + error.message); return; }
      if (insertedRow) keptObatIds.push(String(insertedRow.id));
      obatInserted++;
    }
  }
  // Baris Etiket Obat lama (dari mode edit) yang barisnya sudah dihapus petugas di form ini, ikut dihapus dari database.
  const obatIdsToDelete = originalObatIds.map(String).filter(id => !keptObatIds.includes(id));
  if (obatIdsToDelete.length) {
    await supabase.from('etiket_obat').delete().in('id', obatIdsToDelete);
  }

  await loadAllData();
  navigate('dashboard');
  const dash = document.getElementById('content');
  let pesan = `Tersimpan. ${inserted} etiket baru, ${overwritten} etiket diperbarui (ditimpa).`;
  if (obatInserted || obatUpdated) pesan += ` Etiket Obat: ${obatInserted} baru, ${obatUpdated} diperbarui.`;
  toast(dash, 'ok', pesan);
}

/* ============================================================
   HALAMAN: DAFTAR PASIEN
   ============================================================ */
function renderPasien(content) {
  const list = CACHE.pasien.map(p => {
    const batches = getBatchesForPasien(p.no_rm);
    return { ...p, jumlahKunjungan: batches.length, terakhir: batches[0] };
  });
  content.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input type="text" id="searchPasien" class="search-box" placeholder="Cari nama / No RM...">
      </div>
      <div style="overflow-x:auto;">
        <table class="data-grid">
          <thead><tr><th>Nama Pasien</th><th>No RM</th><th>Tgl Lahir</th><th>Kunjungan</th><th>Kunjungan Terakhir</th><th>Regimen Terakhir</th><th></th></tr></thead>
          <tbody id="pasienTbody">
            ${list.map(p => `
              <tr data-search="${escapeHtml((p.nama_pasien+' '+p.no_rm).toLowerCase())}">
                <td><b>${escapeHtml(p.nama_pasien)}</b></td>
                <td class="rm-code">${escapeHtml(p.no_rm)}</td>
                <td>${fmtDate(p.tanggal_lahir)}</td>
                <td>${p.jumlahKunjungan}</td>
                <td>${p.terakhir ? fmtDateTime(p.terakhir.tanggal) : '-'}</td>
                <td>${p.terakhir ? escapeHtml(p.terakhir.ringkasan) : '-'}</td>
                <td class="actions-cell">
                  <button class="btn secondary" style="padding:5px 10px;" onclick="gunakanPasien('${escapeHtml(p.no_rm)}')">Gunakan</button>
                  <button class="icon-btn danger" title="Hapus total" onclick="hapusPasienTotal('${escapeHtml(p.no_rm)}')">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('searchPasien').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#pasienTbody tr').forEach(tr => {
      tr.style.display = tr.getAttribute('data-search').includes(q) ? '' : 'none';
    });
  });
}

function gunakanPasien(noRM) {
  const p = CACHE.pasien.find(x => x.no_rm === noRM);
  if (!p) return;
  const batches = getBatchesForPasien(noRM);
  const last = batches[0];
  PREFILL_ENTRI = {
    noRM: p.no_rm, namaPasien: p.nama_pasien, tanggalLahir: toISODateInput(p.tanggal_lahir),
    lokasi: last ? last.items[0].lokasi : '',
    tanggalMulai: defaultTanggalMulai(),
    items: last ? last.items.flatMap(r => expandEtiketRowToItems(r)) : []
  };
  navigate('entri');
}

async function hapusPasienTotal(noRM) {
  if (!confirm('Hapus pasien ini beserta SEMUA riwayat etiketnya? Tindakan ini tidak bisa dibatalkan.')) return;
  await supabase.from('etiket').delete().eq('no_rm', noRM);
  await supabase.from('pasien').delete().eq('no_rm', noRM);
  await loadAllData();
  navigate('pasien');
}

/* ============================================================
   MODUL TPN — terpisah dari etiket onko (tabel etiket_tpn sendiri),
   tapi berbagi tabel "pasien" & "pengaturan" (identitas & nama RS sama).
   Satu etiket TPN = satu baris "komposisi" (nama sediaan + volume)
   yang dicetak berbaris pada label yang sama, contoh:
     D10% 250 ml
     KCl 7,46% 12 ml
   ============================================================ */

function nextTpnId() {
  let maxN = 0;
  CACHE.etiketTpn.forEach(e => {
    const m = /^tpn-(\d+)$/.exec(String(e.id || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  });
  let candidate, n = maxN + 1;
  do {
    candidate = 'tpn-' + String(n).padStart(3, '0');
    n++;
  } while (CACHE.etiketTpn.some(e => e.id === candidate));
  return candidate;
}

function defaultTanggalMulaiTpn() {
  const d = new Date();
  d.setHours(16, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function cariSediaanTpn(nama) {
  if (!nama) return null;
  const n = nama.trim().toLowerCase();
  return CACHE.sediaanTpn.find(s => s.nama_sediaan.toLowerCase() === n) || null;
}

// Saat nama sediaan cocok dengan Database Sediaan TPN, Volume otomatis
// diisi "volume_default satuan" (mis. "250 ml"). Kalau petugas mengubah
// Volume secara manual (markVolumeManual), nilai itu tidak akan ditimpa
// lagi oleh pengisian otomatis ini.
function onSediaanTpnInput(uid) {
  const namaInput = document.getElementById('tpnNama_' + uid);
  const volInput = document.getElementById('tpnVolume_' + uid);
  if (!namaInput || !volInput) return;
  const sediaan = cariSediaanTpn(namaInput.value);
  if (!sediaan) return;
  if (!volInput.value || volInput.dataset.auto === '1') {
    const parts = [];
    if (sediaan.volume_default !== null && sediaan.volume_default !== undefined) parts.push(sediaan.volume_default);
    if (sediaan.satuan) parts.push(sediaan.satuan);
    volInput.value = parts.join(' ');
    volInput.dataset.auto = '1';
  }
}
function markVolumeManual(uid) {
  const volInput = document.getElementById('tpnVolume_' + uid);
  if (volInput) volInput.dataset.auto = '0';
}

/* ---------------- HALAMAN: DAFTAR ETIKET TPN ---------------- */
function renderTpnDashboard(content) {
  const rows = CACHE.etiketTpn;
  const dateSet = Array.from(new Set(rows.map(r => toISODateInput(r.tanggal_dibuat)).filter(Boolean))).sort().reverse();

  content.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="num">${rows.length}</div><div class="lab">Total Etiket TPN</div></div>
      <div class="stat-box"><div class="num">${Array.from(new Set(rows.map(r=>r.no_rm).filter(Boolean))).length}</div><div class="lab">Total Pasien TPN</div></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="searchTpn" class="search-box" placeholder="Cari nama pasien / No RM...">
        <div class="spacer"></div>
        <button class="btn secondary" onclick="navigate('tpn_entri')">➕ Entri TPN Baru</button>
        <button class="btn" onclick="cetakTerpilihTpn()">🏷️ Cetak Etiket TPN</button>
        <button class="btn danger" onclick="hapusTerpilihTpn()">🗑️ Hapus Terpilih</button>
      </div>
      <div class="chip-row" id="tpnDateChips">
        <span class="chip active" data-d="" onclick="filterByDateTpn('')">Semua Tanggal</span>
        ${dateSet.map(d => `<span class="chip" data-d="${d}" onclick="filterByDateTpn('${d}')">${fmtDate(d)}</span>`).join('')}
      </div>
      <div style="overflow-x:auto;margin-top:10px;">
        <table class="data-grid" id="tpnTable">
          <thead>
            <tr>
              <th class="checkbox-cell"><input type="checkbox" onclick="toggleAllRowsTpn(this)"></th>
              <th>Pasien / No RM</th>
              <th>Komposisi</th>
              <th>Tanggal Dibuat</th>
              <th>BUD (EXP)</th>
              <th>Petugas</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tpnTbody"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('searchTpn').addEventListener('input', renderTpnRows);
  window._activeDateFilterTpn = '';
  renderTpnRows();
}

function filterByDateTpn(d) {
  window._activeDateFilterTpn = d;
  document.querySelectorAll('#tpnDateChips .chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-d') === d));
  renderTpnRows();
}

function komposisiRingkas(row) {
  if (!Array.isArray(row.komposisi) || !row.komposisi.length) return '';
  return row.komposisi.map(k => [k.nama, k.volume].filter(Boolean).join(' ')).join(', ');
}

function renderTpnRows() {
  const q = (document.getElementById('searchTpn')?.value || '').toLowerCase().trim();
  const dateFilter = window._activeDateFilterTpn || '';
  const rows = CACHE.etiketTpn.filter(r => {
    if (dateFilter && toISODateInput(r.tanggal_dibuat) !== dateFilter) return false;
    if (!q) return true;
    return [r.nama_pasien, r.no_rm, komposisiRingkas(r)].some(v => String(v || '').toLowerCase().includes(q));
  });
  const tbody = document.getElementById('tpnTbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px;">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="checkbox-cell"><input type="checkbox" class="row-check-tpn" value="${r.id}" data-norm="${escapeHtml(r.no_rm)}"></td>
      <td><b>${escapeHtml(r.nama_pasien)}</b><br><span class="muted rm-code">${escapeHtml(r.no_rm)}</span></td>
      <td>${escapeHtml(komposisiRingkas(r))}</td>
      <td>${fmtDateTime(r.tanggal_dibuat)}</td>
      <td>${computeBud(r)}</td>
      <td>${escapeHtml(r.petugas || '')}</td>
      <td class="actions-cell">
        <button class="icon-btn" title="Edit" onclick="editTpn('${r.id}')">✏️</button>
        <button class="icon-btn danger" title="Hapus" onclick="hapusSatuTpn('${r.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function toggleAllRowsTpn(cb) {
  document.querySelectorAll('.row-check-tpn').forEach(c => c.checked = cb.checked);
}
function getCheckedIdsTpn() {
  return Array.from(document.querySelectorAll('.row-check-tpn:checked')).map(c => c.value);
}

function cetakTerpilihTpn() {
  const ids = getCheckedIdsTpn();
  if (!ids.length) { alert('Pilih minimal satu etiket TPN dulu (centang di tabel).'); return; }
  window.open('print/label-tpn.html?ids=' + encodeURIComponent(ids.join(',')), '_blank');
}

async function hapusTerpilihTpn() {
  const ids = getCheckedIdsTpn();
  if (!ids.length) { alert('Pilih minimal satu etiket TPN dulu.'); return; }
  if (!confirm('Hapus ' + ids.length + ' etiket TPN terpilih? Tindakan ini tidak bisa dibatalkan.')) return;
  const { error } = await supabase.from('etiket_tpn').delete().in('id', ids);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  await loadAllData();
  navigate('tpn_dashboard');
}

async function hapusSatuTpn(id) {
  if (!confirm('Hapus etiket TPN ini?')) return;
  const { error } = await supabase.from('etiket_tpn').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  await loadAllData();
  navigate('tpn_dashboard');
}

function editTpn(id) {
  const row = CACHE.etiketTpn.find(r => r.id === id);
  if (!row) return;
  PREFILL_TPN = {
    editId: row.id,
    namaPasien: row.nama_pasien, noRM: row.no_rm, tanggalLahir: toISODateInput(row.tanggal_lahir),
    lokasi: row.lokasi,
    tanggalMulai: row.tanggal_dibuat ? new Date(row.tanggal_dibuat).toISOString().slice(0,16) : '',
    budDurasi: row.bud_durasi_jam || 24,
    komposisi: Array.isArray(row.komposisi) ? row.komposisi : []
  };
  navigate('tpn_entri');
}

/* ---------------- HALAMAN: ENTRI TPN BARU ---------------- */
let tpnItemUid = 0;

function renderTpnEntri(content) {
  const prefill = PREFILL_TPN;
  PREFILL_TPN = null;
  tpnItemUid = 0;

  content.innerHTML = `
    <div id="tpnEntriMsg"></div>
    <div class="card">
      <h2>Data Pasien</h2>
      <div class="row3">
        <div>
          <label>No RM *</label>
          <input type="text" id="t_noRM" list="pasienRmListTpn" placeholder="000123456" oninput="lookupPasienByRMTpn()">
          <datalist id="pasienRmListTpn">${CACHE.pasien.map(p => `<option value="${escapeHtml(p.no_rm)}">${escapeHtml(p.nama_pasien)}</option>`).join('')}</datalist>
        </div>
        <div>
          <label>Nama Pasien *</label>
          <input type="text" id="t_namaPasien" placeholder="Nama lengkap">
        </div>
        <div>
          <label>Tanggal Lahir</label>
          <input type="date" id="t_tanggalLahir">
        </div>
      </div>
      <div class="row2">
        <div>
          <label>Lokasi / Ruang</label>
          <input type="text" id="t_lokasi" placeholder="ENGGANG LT.3 / KAMAR 305 / BED 03">
        </div>
        <div>
          <label>Tanggal &amp; Jam Dibuat *</label>
          <input type="datetime-local" id="t_tanggalMulai">
        </div>
      </div>
      <div class="row2">
        <div>
          <label>BUD Durasi (jam)</label>
          <input type="number" id="t_budDurasi" value="24" step="0.5">
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Komposisi TPN</h2>
      <p class="hint" style="margin-top:0;">Tiap baris akan tampil di etiket persis seperti ditulis, contoh: <b>D10% 250 ml</b>, <b>KCl 7,46% 12 ml</b>. Ketik nama sediaan yang sudah ada di Database Sediaan TPN untuk mengisi Volume otomatis (tetap bisa diubah).</p>
      <div id="tpnKomposisiContainer"></div>
      <button class="btn secondary" type="button" onclick="tambahKomposisiItem()">➕ Tambah Sediaan</button>
    </div>

    <div class="card">
      <button class="btn" onclick="simpanTpnEntri()">💾 Simpan Etiket TPN</button>
      <button class="btn ghost" onclick="navigate('tpn_dashboard')">Batal</button>
    </div>
    <datalist id="daftarSediaanTpnList">${CACHE.sediaanTpn.map(s => `<option value="${escapeHtml(s.nama_sediaan)}">`).join('')}</datalist>
  `;

  document.getElementById('tpnKomposisiContainer').dataset.editId = (prefill && prefill.editId) || '';

  if (prefill) {
    document.getElementById('t_noRM').value = prefill.noRM || '';
    document.getElementById('t_namaPasien').value = prefill.namaPasien || '';
    document.getElementById('t_tanggalLahir').value = prefill.tanggalLahir || '';
    document.getElementById('t_lokasi').value = prefill.lokasi || '';
    document.getElementById('t_tanggalMulai').value = prefill.tanggalMulai || defaultTanggalMulaiTpn();
    document.getElementById('t_budDurasi').value = prefill.budDurasi || 24;
    (prefill.komposisi || []).forEach(k => tambahKomposisiItem(k));
    if (!prefill.komposisi || !prefill.komposisi.length) tambahKomposisiItem();
  } else {
    document.getElementById('t_tanggalMulai').value = defaultTanggalMulaiTpn();
    tambahKomposisiItem();
  }
}

function lookupPasienByRMTpn() {
  const rm = document.getElementById('t_noRM').value.trim();
  const p = CACHE.pasien.find(x => x.no_rm === rm);
  if (p) {
    document.getElementById('t_namaPasien').value = p.nama_pasien;
    document.getElementById('t_tanggalLahir').value = toISODateInput(p.tanggal_lahir);
  }
}

function komposisiItemTemplate(uid) {
  return `
  <div class="regimen-item" id="tpnItem_${uid}" data-uid="${uid}">
    <div class="item-head">
      <span class="item-title"><span class="item-badge item-num"></span>Sediaan</span>
      <button type="button" class="btn ghost" style="padding:4px 10px;" onclick="hapusKomposisiItem(${uid})">🗑 Hapus</button>
    </div>
    <div class="row2">
      <div><label>Nama Sediaan (ketik untuk cari) *</label><input type="text" id="tpnNama_${uid}" list="daftarSediaanTpnList" placeholder="D10%" oninput="onSediaanTpnInput(${uid})"></div>
      <div><label>Volume (otomatis, bisa diubah) *</label><input type="text" id="tpnVolume_${uid}" placeholder="250 ml" oninput="markVolumeManual(${uid})"></div>
    </div>
  </div>`;
}

function tambahKomposisiItem(prefillItem) {
  tpnItemUid += 1;
  const uid = tpnItemUid;
  document.getElementById('tpnKomposisiContainer').insertAdjacentHTML('beforeend', komposisiItemTemplate(uid));
  if (prefillItem) {
    document.getElementById('tpnNama_' + uid).value = prefillItem.nama || '';
    const volInput = document.getElementById('tpnVolume_' + uid);
    volInput.value = prefillItem.volume || '';
    volInput.dataset.auto = '0'; // nilai dari data tersimpan/riwayat dianggap sudah final, jangan ditimpa otomatis
  }
  renderKomposisiNumbers();
}

function hapusKomposisiItem(uid) {
  const items = document.querySelectorAll('#tpnKomposisiContainer .regimen-item');
  if (items.length <= 1) return;
  document.getElementById('tpnItem_' + uid)?.remove();
  renderKomposisiNumbers();
}

function renderKomposisiNumbers() {
  const allItems = document.querySelectorAll('#tpnKomposisiContainer .regimen-item');
  allItems.forEach((el, idx) => {
    el.querySelector('.item-num').textContent = idx + 1;
    el.querySelector('.btn.ghost').style.display = allItems.length > 1 ? 'inline-flex' : 'none';
  });
}

async function simpanTpnEntri() {
  const msgBox = document.getElementById('tpnEntriMsg');
  msgBox.innerHTML = '';
  const noRM = document.getElementById('t_noRM').value.trim();
  const namaPasien = document.getElementById('t_namaPasien').value.trim();
  const tanggalLahir = document.getElementById('t_tanggalLahir').value || null;
  const lokasi = document.getElementById('t_lokasi').value.trim();
  const tanggalMulai = document.getElementById('t_tanggalMulai').value;
  const budDurasi = parseFloat(document.getElementById('t_budDurasi').value) || 24;

  if (!noRM || !namaPasien || !tanggalMulai) {
    toast(msgBox, 'err', 'No RM, Nama Pasien, dan Tanggal & Jam Dibuat wajib diisi.');
    return;
  }

  const itemEls = Array.from(document.querySelectorAll('#tpnKomposisiContainer .regimen-item'));
  const komposisi = [];
  for (let i = 0; i < itemEls.length; i++) {
    const uid = itemEls[i].getAttribute('data-uid');
    const nama = document.getElementById('tpnNama_' + uid).value.trim();
    const volume = document.getElementById('tpnVolume_' + uid).value.trim();
    if (!nama || !volume) {
      toast(msgBox, 'err', 'Sediaan #' + (i + 1) + ': Nama Sediaan dan Volume wajib diisi.');
      return;
    }
    komposisi.push({ nama, volume });
  }
  if (!komposisi.length) {
    toast(msgBox, 'err', 'Minimal harus ada 1 sediaan pada komposisi.');
    return;
  }

  await supabase.from('pasien').upsert({ no_rm: noRM, nama_pasien: namaPasien, tanggal_lahir: tanggalLahir, updated_at: new Date().toISOString() });

  const editId = document.getElementById('tpnKomposisiContainer').dataset.editId;
  const payload = {
    nama_pasien: namaPasien, no_rm: noRM, tanggal_lahir: tanggalLahir, lokasi,
    komposisi, bud_durasi_jam: budDurasi,
    tanggal_dibuat: isoLocalFromInput(tanggalMulai),
    batch_id: editId || ('tpn-b-' + Date.now())
  };

  let error;
  if (editId) {
    ({ error } = await supabase.from('etiket_tpn').update(payload).eq('id', editId));
  } else {
    payload.id = nextTpnId();
    ({ error } = await supabase.from('etiket_tpn').insert(payload));
  }
  if (error) { toast(msgBox, 'err', 'Gagal menyimpan: ' + error.message); return; }

  await loadAllData();
  navigate('tpn_dashboard');
  const dash = document.getElementById('content');
  toast(dash, 'ok', editId ? 'Etiket TPN diperbarui.' : 'Etiket TPN baru tersimpan.');
}

/* ---------------- HALAMAN: DAFTAR PASIEN TPN ---------------- */
// Terpisah dari "Daftar Pasien" milik onko: hanya menampilkan pasien yang
// punya riwayat etiket_tpn, dipakai untuk mengedit/menggunakan-ulang
// resep TPN sebelumnya.
function getTpnHistoryForPasien(noRM) {
  return CACHE.etiketTpn
    .filter(r => r.no_rm === noRM)
    .sort((a, b) => new Date(b.tanggal_dibuat || 0) - new Date(a.tanggal_dibuat || 0));
}

function renderTpnPasien(content) {
  const map = {};
  CACHE.etiketTpn.forEach(r => {
    if (!map[r.no_rm]) map[r.no_rm] = { no_rm: r.no_rm, nama_pasien: r.nama_pasien, tanggal_lahir: r.tanggal_lahir };
  });
  const list = Object.values(map).map(p => {
    const riwayat = getTpnHistoryForPasien(p.no_rm);
    return { ...p, jumlahResep: riwayat.length, terakhir: riwayat[0] };
  });
  list.sort((a, b) => a.nama_pasien.localeCompare(b.nama_pasien, 'id'));

  content.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input type="text" id="searchPasienTpn" class="search-box" placeholder="Cari nama / No RM...">
      </div>
      <div style="overflow-x:auto;">
        <table class="data-grid">
          <thead><tr><th>Nama Pasien</th><th>No RM</th><th>Tgl Lahir</th><th>Jumlah Resep TPN</th><th>Resep Terakhir</th><th>Komposisi Terakhir</th><th></th></tr></thead>
          <tbody id="pasienTpnTbody">
            ${list.map(p => `
              <tr data-search="${escapeHtml((p.nama_pasien+' '+p.no_rm).toLowerCase())}">
                <td><b>${escapeHtml(p.nama_pasien)}</b></td>
                <td class="rm-code">${escapeHtml(p.no_rm)}</td>
                <td>${fmtDate(p.tanggal_lahir)}</td>
                <td>${p.jumlahResep}</td>
                <td>${p.terakhir ? fmtDateTime(p.terakhir.tanggal_dibuat) : '-'}</td>
                <td>${p.terakhir ? escapeHtml(komposisiRingkas(p.terakhir)) : '-'}</td>
                <td class="actions-cell">
                  <button class="btn secondary" style="padding:5px 10px;" onclick="editTpn('${escapeHtml(p.terakhir.id)}')">✏️ Edit Resep Terakhir</button>
                  <button class="btn ghost" style="padding:5px 10px;" onclick="gunakanPasienTpn('${escapeHtml(p.no_rm)}')">Gunakan (Resep Baru)</button>
                  <button class="icon-btn danger" title="Hapus semua riwayat TPN pasien ini" onclick="hapusPasienTpnTotal('${escapeHtml(p.no_rm)}')">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('searchPasienTpn').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#pasienTpnTbody tr').forEach(tr => {
      tr.style.display = tr.getAttribute('data-search').includes(q) ? '' : 'none';
    });
  });
}

// Prefill sebagai ETIKET BARU (bukan edit) memakai komposisi resep TPN
// terakhir milik pasien tsb — dipakai saat resep diulang di kunjungan lain.
function gunakanPasienTpn(noRM) {
  const p = CACHE.pasien.find(x => x.no_rm === noRM);
  const riwayat = getTpnHistoryForPasien(noRM);
  const last = riwayat[0];
  if (!last) return;
  PREFILL_TPN = {
    noRM,
    namaPasien: (p && p.nama_pasien) || last.nama_pasien,
    tanggalLahir: toISODateInput((p && p.tanggal_lahir) || last.tanggal_lahir),
    lokasi: last.lokasi,
    tanggalMulai: defaultTanggalMulaiTpn(),
    budDurasi: last.bud_durasi_jam || 24,
    komposisi: Array.isArray(last.komposisi) ? last.komposisi : []
  };
  navigate('tpn_entri');
}

// Hanya menghapus riwayat etiket_tpn milik pasien ini — TIDAK menyentuh
// tabel "pasien" ataupun riwayat etiket onko pasien yang sama.
async function hapusPasienTpnTotal(noRM) {
  if (!confirm('Hapus SEMUA riwayat etiket TPN pasien ini? (Riwayat etiket kemoterapi pasien ini tidak akan terpengaruh.) Tindakan ini tidak bisa dibatalkan.')) return;
  const { error } = await supabase.from('etiket_tpn').delete().eq('no_rm', noRM);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  await loadAllData();
  navigate('tpn_pasien');
}

/* ---------------- HALAMAN: DATABASE SEDIAAN TPN ---------------- */
// Terpisah dari "Database Obat" milik onko. Kolom "satuan" otomatis
// terisi "ml" saat sediaan baru ditambahkan, tapi tetap bisa diubah
// manual (persis seperti kolom "satuan" pada Database Obat kemo).
function renderTpnSediaan(content) {
  content.innerHTML = `
    <div class="card">
      <h2>Tambah Sediaan TPN Baru</h2>
      <div class="row3">
        <div><label>Nama Sediaan</label><input type="text" id="sediaanNamaBaru" placeholder="D10%"></div>
        <div><label>Volume Default</label><input type="number" id="sediaanVolBaru" step="0.01" placeholder="250"></div>
        <div><label>Satuan</label><input type="text" id="sediaanSatuanBaru" value="ml"></div>
      </div>
      <button class="btn" style="margin-top:10px;" onclick="tambahSediaanTpn()">➕ Tambah</button>
      <div id="sediaanTpnMsg"></div>
    </div>
    <div class="card">
      <h2>Daftar Sediaan TPN (${CACHE.sediaanTpn.length})</h2>
      <div style="overflow-x:auto;">
        <table class="data-grid">
          <thead><tr><th>Nama Sediaan</th><th>Volume Default</th><th>Satuan</th><th></th></tr></thead>
          <tbody>
            ${CACHE.sediaanTpn.map(s => `
              <tr>
                <td>${escapeHtml(s.nama_sediaan)}</td>
                <td><input type="number" step="0.01" value="${s.volume_default ?? ''}" id="vd_${s.id}" style="width:100px;"></td>
                <td><input type="text" value="${escapeHtml(s.satuan || '')}" id="sd_${s.id}" style="width:90px;"></td>
                <td class="actions-cell">
                  <button class="icon-btn" title="Simpan" onclick="updateSediaanTpn(${s.id})">💾</button>
                  <button class="icon-btn danger" title="Hapus" onclick="hapusSediaanTpn(${s.id})">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function tambahSediaanTpn() {
  const nama = document.getElementById('sediaanNamaBaru').value.trim();
  const vol = parseFloat(document.getElementById('sediaanVolBaru').value);
  const satuan = document.getElementById('sediaanSatuanBaru').value.trim() || 'ml';
  const msgBox = document.getElementById('sediaanTpnMsg');
  if (!nama) { toast(msgBox, 'err', 'Nama sediaan wajib diisi.'); return; }
  const { error } = await supabase.from('sediaan_tpn').insert({ nama_sediaan: nama, volume_default: isNaN(vol) ? null : vol, satuan });
  if (error) { toast(msgBox, 'err', 'Gagal: ' + error.message); return; }
  await loadAllData();
  navigate('tpn_sediaan');
}
async function updateSediaanTpn(id) {
  const vd = parseFloat(document.getElementById('vd_' + id).value);
  const sd = document.getElementById('sd_' + id).value.trim() || 'ml';
  await supabase.from('sediaan_tpn').update({ volume_default: isNaN(vd) ? null : vd, satuan: sd }).eq('id', id);
  await loadAllData();
  navigate('tpn_sediaan');
}
async function hapusSediaanTpn(id) {
  if (!confirm('Hapus sediaan ini dari database?')) return;
  await supabase.from('sediaan_tpn').delete().eq('id', id);
  await loadAllData();
  navigate('tpn_sediaan');
}

/* ============================================================
   HALAMAN: DATABASE OBAT
   ============================================================ */
function renderObat(content) {
  content.innerHTML = `
    <div class="card">
      <h2>Tambah Obat Baru</h2>
      <div class="row3">
        <div><label>Nama Obat</label><input type="text" id="obatNamaBaru" placeholder="Paklitaksel"></div>
        <div><label>Konsentrasi</label><input type="number" id="obatKonsBaru" step="0.01" placeholder="6"></div>
        <div><label>Satuan</label><input type="text" id="obatSatuanBaru" value="mg/ml"></div>
      </div>
      <button class="btn" style="margin-top:10px;" onclick="tambahObat()">➕ Tambah</button>
      <div id="obatMsg"></div>
    </div>
    <div class="card">
      <h2>Daftar Obat (${CACHE.obat.length})</h2>
      <div style="overflow-x:auto;">
        <table class="data-grid">
          <thead><tr><th>Nama Obat</th><th>Konsentrasi</th><th>Satuan</th><th></th></tr></thead>
          <tbody>
            ${CACHE.obat.map(o => `
              <tr>
                <td>${escapeHtml(o.nama_obat)}</td>
                <td><input type="number" step="0.01" value="${o.konsentrasi ?? ''}" id="k_${o.id}" style="width:100px;"></td>
                <td><input type="text" value="${escapeHtml(o.satuan || '')}" id="s_${o.id}" style="width:100px;"></td>
                <td class="actions-cell">
                  <button class="icon-btn" title="Simpan" onclick="updateObat(${o.id})">💾</button>
                  <button class="icon-btn danger" title="Hapus" onclick="hapusObat(${o.id})">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function tambahObat() {
  const nama = document.getElementById('obatNamaBaru').value.trim();
  const kons = parseFloat(document.getElementById('obatKonsBaru').value);
  const satuan = document.getElementById('obatSatuanBaru').value.trim() || 'mg/ml';
  const msgBox = document.getElementById('obatMsg');
  if (!nama) { toast(msgBox, 'err', 'Nama obat wajib diisi.'); return; }
  const { error } = await supabase.from('obat').insert({ nama_obat: nama, konsentrasi: isNaN(kons) ? null : kons, satuan });
  if (error) { toast(msgBox, 'err', 'Gagal: ' + error.message); return; }
  await loadAllData();
  navigate('obat');
}
async function updateObat(id) {
  const k = parseFloat(document.getElementById('k_' + id).value);
  const s = document.getElementById('s_' + id).value.trim();
  await supabase.from('obat').update({ konsentrasi: isNaN(k) ? null : k, satuan: s }).eq('id', id);
  await loadAllData();
  navigate('obat');
}
async function hapusObat(id) {
  if (!confirm('Hapus obat ini dari database?')) return;
  await supabase.from('obat').delete().eq('id', id);
  await loadAllData();
  navigate('obat');
}

/* ============================================================
   HALAMAN: DATABASE PELARUT
   ============================================================ */
function renderPelarut(content) {
  content.innerHTML = `
    <div class="card">
      <h2>Tambah Pelarut Baru</h2>
      <div class="row2">
        <div><label>Nama Pelarut</label><input type="text" id="pelarutNamaBaru" placeholder="NaCl 0,9%"></div>
        <div><label>Keterangan (opsional)</label><input type="text" id="pelarutKetBaru" placeholder="Normal Saline"></div>
      </div>
      <button class="btn" style="margin-top:10px;" onclick="tambahPelarut()">➕ Tambah</button>
      <div id="pelarutMsg"></div>
    </div>
    <div class="card">
      <h2>Daftar Pelarut (${CACHE.pelarut.length})</h2>
      <div style="overflow-x:auto;">
        <table class="data-grid">
          <thead><tr><th>Nama Pelarut</th><th>Keterangan</th><th></th></tr></thead>
          <tbody>
            ${CACHE.pelarut.map(p => `
              <tr>
                <td><input type="text" value="${escapeHtml(p.nama_pelarut)}" id="np_${p.id}" style="min-width:160px;"></td>
                <td><input type="text" value="${escapeHtml(p.keterangan || '')}" id="kp_${p.id}"></td>
                <td class="actions-cell">
                  <button class="icon-btn" title="Simpan" onclick="updatePelarut(${p.id})">💾</button>
                  <button class="icon-btn danger" title="Hapus" onclick="hapusPelarut(${p.id})">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function tambahPelarut() {
  const nama = document.getElementById('pelarutNamaBaru').value.trim();
  const ket = document.getElementById('pelarutKetBaru').value.trim();
  const msgBox = document.getElementById('pelarutMsg');
  if (!nama) { toast(msgBox, 'err', 'Nama pelarut wajib diisi.'); return; }
  const { error } = await supabase.from('pelarut').insert({ nama_pelarut: nama, keterangan: ket || null });
  if (error) { toast(msgBox, 'err', 'Gagal: ' + error.message); return; }
  await loadAllData();
  navigate('pelarut');
}
async function updatePelarut(id) {
  const nama = document.getElementById('np_' + id).value.trim();
  const ket = document.getElementById('kp_' + id).value.trim();
  await supabase.from('pelarut').update({ nama_pelarut: nama, keterangan: ket || null }).eq('id', id);
  await loadAllData();
  navigate('pelarut');
}
async function hapusPelarut(id) {
  if (!confirm('Hapus pelarut ini dari database?')) return;
  await supabase.from('pelarut').delete().eq('id', id);
  await loadAllData();
  navigate('pelarut');
}

/* ============================================================
   HALAMAN: PENGATURAN
   ============================================================ */
function renderPengaturan(content) {
  content.innerHTML = `
    <div class="card" style="max-width:520px;">
      <h2>Identitas Rumah Sakit</h2>
      <label>Nama Rumah Sakit</label>
      <input type="text" id="p_namaRS" value="${escapeHtml(CACHE.settings.nama_rs || '')}">
      <label>Sub Judul</label>
      <input type="text" id="p_subJudul" value="${escapeHtml(CACHE.settings.sub_judul || '')}">
      <button class="btn" style="margin-top:14px;" onclick="simpanPengaturan()">💾 Simpan</button>
      <div id="pengaturanMsg"></div>
    </div>
    <div class="card" style="max-width:520px;">
      <h2>Akun</h2>
      <p class="muted" style="font-size:12.5px;">Login sebagai: <b>${escapeHtml(CURRENT_USER ? displayUsername(CURRENT_USER.email) : '-')}</b></p>
      <p class="hint">Untuk menambah/menghapus akun petugas, gunakan Supabase Dashboard &gt; Authentication &gt; Users. Isi kolom Email dengan &lt;username&gt;@etiketkemo.local (mis. depo@etiketkemo.local).</p>
    </div>
  `;
}
async function simpanPengaturan() {
  const namaRS = document.getElementById('p_namaRS').value.trim();
  const subJudul = document.getElementById('p_subJudul').value.trim();
  const msgBox = document.getElementById('pengaturanMsg');
  const { error } = await supabase.from('pengaturan').upsert([
    { key: 'nama_rs', value: namaRS },
    { key: 'sub_judul', value: subJudul }
  ]);
  if (error) { toast(msgBox, 'err', 'Gagal: ' + error.message); return; }
  await loadAllData();
  toast(msgBox, 'ok', 'Pengaturan tersimpan.');
}

/* ---------------- INIT ---------------- */
checkSession();
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});
