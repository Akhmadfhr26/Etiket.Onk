/* ============================================================
   SISTEM ETIKET KEMOTERAPI — app.js
   ============================================================ */

let CURRENT_USER = null;
let CACHE = { etiket: [], pasien: [], obat: [], pelarut: [], settings: {} };
let CURRENT_ROUTE = 'dashboard';
let PREFILL_ENTRI = null; // dipakai saat "Gunakan" dari Daftar Pasien

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
  const [etiketRes, pasienRes, obatRes, pelarutRes, settingsRes] = await Promise.all([
    supabase.from('etiket').select('*').order('created_at', { ascending: false }),
    supabase.from('pasien').select('*').order('nama_pasien', { ascending: true }),
    supabase.from('obat').select('*').order('nama_obat', { ascending: true }),
    supabase.from('pelarut').select('*').order('nama_pelarut', { ascending: true }),
    supabase.from('pengaturan').select('*')
  ]);
  CACHE.etiket = etiketRes.data || [];
  CACHE.pasien = pasienRes.data || [];
  CACHE.obat = obatRes.data || [];
  CACHE.pelarut = pelarutRes.data || [];
  CACHE.settings = {};
  (settingsRes.data || []).forEach(r => CACHE.settings[r.key] = r.value);
  document.getElementById('sbNamaRS').textContent = CACHE.settings.nama_rs || 'Etiket Kemo';
}

/* ---------------- ROUTING ---------------- */
const PAGES = {
  dashboard:  { title: 'Daftar Etiket',    sub: 'Semua etiket yang tersimpan',              render: renderDashboard },
  entri:      { title: 'Entri Data Baru',  sub: 'Tambah atau perbarui etiket pasien',        render: renderEntri },
  pasien:     { title: 'Daftar Pasien',    sub: 'Riwayat kunjungan tiap pasien',             render: renderPasien },
  obat:       { title: 'Database Obat',    sub: 'Nama obat & konsentrasi untuk kalkulasi',   render: renderObat },
  pelarut:    { title: 'Database Pelarut', sub: 'Daftar pelarut baku (NaCl 0,9%, D5%, dll)', render: renderPelarut },
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
function renderDashboard(content) {
  const rows = CACHE.etiket;
  const dateSet = Array.from(new Set(rows.map(r => toISODateInput(r.tanggal_dibuat)).filter(Boolean))).sort().reverse();

  content.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="num">${rows.length}</div><div class="lab">Total Etiket</div></div>
      <div class="stat-box"><div class="num">${CACHE.pasien.length}</div><div class="lab">Total Pasien</div></div>
      <div class="stat-box"><div class="num">${Array.from(new Set(rows.map(r=>r.batch_id).filter(Boolean))).length}</div><div class="lab">Total Kunjungan (Batch)</div></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="searchEtiket" class="search-box" placeholder="Cari nama pasien / No RM / obat...">
        <div class="spacer"></div>
        <button class="btn secondary" onclick="navigate('entri')">➕ Entri Baru</button>
        <button class="btn" onclick="cetakTerpilih('label')">🏷️ Cetak Label Obat</button>
        <button class="btn" onclick="cetakTerpilih('identitas')">🪪 Cetak Label Identitas</button>
        <button class="btn danger" onclick="hapusTerpilih()">🗑️ Hapus Terpilih</button>
      </div>
      <div class="chip-row" id="dateChips">
        <span class="chip active" data-d="" onclick="filterByDate('')">Semua Tanggal</span>
        ${dateSet.map(d => `<span class="chip" data-d="${d}" onclick="filterByDate('${d}')">${fmtDate(d)}</span>`).join('')}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-grid" id="etiketTable">
          <thead>
            <tr>
              <th class="checkbox-cell"><input type="checkbox" onclick="toggleAllRows(this)"></th>
              <th>Pasien / No RM</th>
              <th>Obat &amp; Dosis</th>
              <th>Hari Ke</th>
              <th>Tanggal Dibuat</th>
              <th>BUD (EXP)</th>
              <th>Petugas</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="etiketTbody"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('searchEtiket').addEventListener('input', renderEtiketRows);
  window._activeDateFilter = '';
  renderEtiketRows();
}

function filterByDate(d) {
  window._activeDateFilter = d;
  document.querySelectorAll('#dateChips .chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-d') === d));
  renderEtiketRows();
}

function renderEtiketRows() {
  const q = (document.getElementById('searchEtiket')?.value || '').toLowerCase().trim();
  const dateFilter = window._activeDateFilter || '';
  const rows = CACHE.etiket.filter(r => {
    if (dateFilter && toISODateInput(r.tanggal_dibuat) !== dateFilter) return false;
    if (!q) return true;
    return [r.nama_pasien, r.no_rm, r.obat_dosis, r.nama_obat].some(v => String(v || '').toLowerCase().includes(q));
  });
  const tbody = document.getElementById('etiketTbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="checkbox-cell"><input type="checkbox" class="row-check" value="${r.id}"></td>
      <td><b>${escapeHtml(r.nama_pasien)}</b><br><span class="muted rm-code">${escapeHtml(r.no_rm)}</span></td>
      <td>${escapeHtml(r.obat_dosis)}</td>
      <td>${r.hari_ke ? '<span class="badge">H-' + r.hari_ke + '</span>' : ''}</td>
      <td>${fmtDateTime(r.tanggal_dibuat)}</td>
      <td>${computeBud(r)}</td>
      <td>${escapeHtml(r.petugas || '')}</td>
      <td class="actions-cell">
        <button class="icon-btn" title="Edit" onclick="editEtiket('${r.id}')">✏️</button>
        <button class="icon-btn danger" title="Hapus" onclick="hapusSatuEtiket('${r.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function toggleAllRows(cb) {
  document.querySelectorAll('.row-check').forEach(c => c.checked = cb.checked);
}
function getCheckedIds() {
  return Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
}

function cetakTerpilih(jenis) {
  const ids = getCheckedIds();
  if (!ids.length) { alert('Pilih minimal satu etiket dulu (centang di tabel).'); return; }
  const page = jenis === 'identitas' ? 'print/label-identitas.html' : 'print/label.html';
  window.open(page + '?ids=' + encodeURIComponent(ids.join(',')), '_blank');
}

async function hapusTerpilih() {
  const ids = getCheckedIds();
  if (!ids.length) { alert('Pilih minimal satu etiket dulu.'); return; }
  if (!confirm('Hapus ' + ids.length + ' etiket terpilih? Tindakan ini tidak bisa dibatalkan.')) return;
  const { error } = await supabase.from('etiket').delete().in('id', ids);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  await loadAllData();
  navigate('dashboard');
}

async function hapusSatuEtiket(id) {
  if (!confirm('Hapus etiket ini?')) return;
  const { error } = await supabase.from('etiket').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }
  await loadAllData();
  navigate('dashboard');
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
  PREFILL_ENTRI = {
    editId: row.id,
    namaPasien: row.nama_pasien, noRM: row.no_rm, tanggalLahir: toISODateInput(row.tanggal_lahir),
    lokasi: row.lokasi,
    tanggalMulai: row.tanggal_dibuat ? new Date(row.tanggal_dibuat).toISOString().slice(0,16) : '',
    items: expandEtiketRowToItems(row)
  };
  navigate('entri');
}

/* ============================================================
   HALAMAN: ENTRI DATA BARU
   ============================================================ */
let itemUid = 0;

function renderEntri(content) {
  const prefill = PREFILL_ENTRI;
  PREFILL_ENTRI = null;
  itemUid = 0;

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
      <button class="btn" onclick="simpanEntriBatch()">💾 Simpan Semua</button>
      <button class="btn ghost" onclick="navigate('dashboard')">Batal</button>
    </div>
    <datalist id="daftarObatList">${CACHE.obat.map(o => `<option value="${escapeHtml(o.nama_obat)}">`).join('')}</datalist>
    <datalist id="daftarPelarutList">${CACHE.pelarut.map(p => `<option value="${escapeHtml(p.nama_pelarut)}">`).join('')}</datalist>
  `;

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
  } else {
    document.getElementById('f_tanggalMulai').value = defaultTanggalMulai();
    tambahRegimenItem();
  }
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

  await loadAllData();
  navigate('dashboard');
  const dash = document.getElementById('content');
  toast(dash, 'ok', `Tersimpan. ${inserted} etiket baru, ${overwritten} etiket diperbarui (ditimpa).`);
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
