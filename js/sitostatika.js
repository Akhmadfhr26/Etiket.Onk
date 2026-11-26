/* ============================================================
   MODUL TAMBAHAN: FORMULIR PENCAMPURAN OBAT SITOSTATIKA
   ------------------------------------------------------------
   File ini dimuat SETELAH js/app.js dan hanya MENAMBAH fitur.
   Tidak ada fungsi/alur lama yang diganti: setiap "kait" di bawah
   memanggil fungsi aslinya dulu, baru menambahkan bagian baru.

   Yang ditambahkan:
   1. Kartu "Data Klinis Formulir Sitostatika" di halaman Entri
      (BB, TB, BSA + kalkulator Mosteller / DuBois, diagnosa, DPJP, ruang).
   2. Penyimpanan data klinis ke tabel formulir_sitostatika
      (lihat supabase/schema_formulir_sitostatika.sql) setelah
      "Simpan Semua" berhasil.
   3. Tombol "Formulir Sitostatika" di Daftar Etiket (bar filter
      per tanggal dan bar pilihan) -> print/formulir-sitostatika.html
   ============================================================ */
(function () {
  const RUANG_DEFAULT = 'Murai Lt. 3';
  const DOKTER_DEFAULT = ['dr. Muhammad', 'dr. Ridho'];

  let FORMULIR = [];            // cache baris formulir_sitostatika
  let FORMULIR_LOADED = false;
  let FORMULIR_OK = true;       // false bila tabel belum dibuat di Supabase

  /* ---------------- helper ---------------- */
  function $(id) { return document.getElementById(id); }

  // Rumus BSA (m²). BB dalam kg, TB dalam cm.
  //  Mosteller : sqrt(TB × BB / 3600)
  //  DuBois    : 0,007184 × BB^0,425 × TB^0,725
  function hitungBSA(bb, tb, metode) {
    bb = parseFloat(bb); tb = parseFloat(tb);
    if (!(bb > 0) || !(tb > 0)) return null;
    const v = metode === 'dubois'
      ? 0.007184 * Math.pow(bb, 0.425) * Math.pow(tb, 0.725)
      : Math.sqrt(tb * bb / 3600);
    return Math.round(v * 100) / 100;
  }
  window.hitungBSA = window.hitungBSA || hitungBSA;

  function daftarDokter() {
    const t = (CACHE.settings && CACHE.settings.dokter_dpjp) || '';
    const arr = String(t).split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : DOKTER_DEFAULT;
  }

  async function ensureFormulirCache(force) {
    if (FORMULIR_LOADED && !force) return;
    const { data, error } = await supabase.from('formulir_sitostatika').select('*');
    if (error) { FORMULIR_OK = false; FORMULIR = []; FORMULIR_LOADED = true; return; }
    FORMULIR_OK = true; FORMULIR = data || []; FORMULIR_LOADED = true;
  }

  // Data klinis terakhir pasien: yang tepat di tanggal itu, atau kunjungan terdekat sebelumnya.
  function cariKlinis(noRM, dateKey) {
    const list = FORMULIR.filter(k => k.no_rm === noRM)
      .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
    if (!list.length) return null;
    const exact = list.find(k => String(k.tanggal).slice(0, 10) === dateKey);
    if (exact) return { rec: exact, exact: true };
    const before = list.find(k => String(k.tanggal).slice(0, 10) <= dateKey);
    return { rec: before || list[0], exact: false };
  }

  function tanggalForm() {            // YYYY-MM-DD (tanggal LOKAL) dari field Tanggal & Jam Kemoterapi
    const v = ($('f_tanggalMulai') || {}).value || '';
    return v.slice(0, 10);
  }

  /* ============================================================
     1. KARTU DATA KLINIS DI HALAMAN ENTRI
     ============================================================ */
  function kartuHtml() {
    return `
    <div class="card" id="sitoCard">
      <h2>🧾 Data Klinis Formulir Sitostatika <span class="muted" style="font-weight:500;font-size:12.5px;">(opsional)</span></h2>
      <p class="hint" style="margin:0 0 6px;">Dipakai untuk mengisi otomatis <b>Formulir Pencampuran Obat Sitostatika</b> (cetak dari Daftar Etiket). Kosongkan bila formulir tidak diperlukan.</p>
      <div id="sitoInfo"></div>
      <div class="row3">
        <div><label>Berat Badan (kg)</label><input type="number" id="sito_bb" step="0.1" min="0" placeholder="mis. 60" oninput="sitoHitungBSA()"></div>
        <div><label>Tinggi Badan (cm)</label><input type="number" id="sito_tb" step="0.1" min="0" placeholder="mis. 165" oninput="sitoHitungBSA()"></div>
        <div>
          <label>Metode BSA</label>
          <select id="sito_metode" onchange="sitoHitungBSA()">
            <option value="mosteller">Mosteller</option>
            <option value="dubois">DuBois</option>
          </select>
        </div>
      </div>
      <div class="row3">
        <div>
          <label>BSA (m²)</label>
          <input type="number" id="sito_bsa" step="0.01" min="0" placeholder="otomatis dari BB &amp; TB">
          <div class="hint" id="sito_bsaHint">Dihitung otomatis dari BB &amp; TB, bisa diubah manual.</div>
        </div>
        <div>
          <label>DPJP (Dokter)</label>
          <input type="text" id="sito_dokter" list="sitoDokterList" placeholder="Pilih / ketik nama dokter">
          <datalist id="sitoDokterList">${daftarDokter().map(d => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
          <div class="hint"><a href="#" onclick="sitoKelolaDokter();return false;">✏️ Ubah daftar dokter</a></div>
        </div>
        <div>
          <label>Ruang Rawat</label>
          <input type="text" id="sito_ruang" value="${escapeHtml(RUANG_DEFAULT)}">
        </div>
      </div>
      <label>Diagnosa</label>
      <input type="text" id="sito_diagnosa" placeholder="mis. Ca Mammae Dextra T2N1M0">
    </div>`;
  }

  window.sitoHitungBSA = function () {
    const bb = $('sito_bb').value, tb = $('sito_tb').value, metode = $('sito_metode').value;
    const m = hitungBSA(bb, tb, 'mosteller'), d = hitungBSA(bb, tb, 'dubois');
    const hint = $('sito_bsaHint');
    if (m == null) {
      hint.innerHTML = 'Dihitung otomatis dari BB &amp; TB, bisa diubah manual.';
      return;
    }
    $('sito_bsa').value = metode === 'dubois' ? d : m;
    hint.innerHTML = 'Mosteller <b>' + m + '</b> m² &nbsp;·&nbsp; DuBois <b>' + d + '</b> m² &nbsp;(dipakai: ' + (metode === 'dubois' ? 'DuBois' : 'Mosteller') + ')';
  };

  window.sitoKelolaDokter = async function () {
    const now = daftarDokter().join(', ');
    const input = prompt('Daftar dokter DPJP (pisahkan dengan koma):', now);
    if (input === null) return;
    const list = input.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    const value = (list.length ? list : DOKTER_DEFAULT).join('\n');
    const { error } = await supabase.from('pengaturan').upsert({ key: 'dokter_dpjp', value });
    if (error) { alert('Gagal menyimpan daftar dokter: ' + error.message); return; }
    CACHE.settings.dokter_dpjp = value;
    const dl = $('sitoDokterList');
    if (dl) dl.innerHTML = daftarDokter().map(d => `<option value="${escapeHtml(d)}">`).join('');
  };

  function klinisKosong() {
    return !($('sito_bb').value || $('sito_tb').value || $('sito_bsa').value || $('sito_dokter').value.trim() || $('sito_diagnosa').value.trim());
  }

  function resetKartu() {
    ['sito_bb', 'sito_tb', 'sito_bsa', 'sito_dokter', 'sito_diagnosa'].forEach(id => { $(id).value = ''; });
    $('sito_metode').value = 'mosteller';
    $('sito_ruang').value = RUANG_DEFAULT;
    $('sito_bsaHint').innerHTML = 'Dihitung otomatis dari BB &amp; TB, bisa diubah manual.';
    $('sitoInfo').innerHTML = '';
    $('sitoCard').dataset.rm = '';
  }

  function isiKartu(rec) {
    $('sito_bb').value = rec.bb != null ? rec.bb : '';
    $('sito_tb').value = rec.tb != null ? rec.tb : '';
    $('sito_metode').value = rec.metode_bsa === 'dubois' ? 'dubois' : 'mosteller';
    $('sito_bsa').value = rec.bsa != null ? rec.bsa : '';
    $('sito_dokter').value = rec.dokter || '';
    $('sito_ruang').value = rec.ruang || RUANG_DEFAULT;
    $('sito_diagnosa').value = rec.diagnosa || '';
    const m = hitungBSA(rec.bb, rec.tb, 'mosteller'), d = hitungBSA(rec.bb, rec.tb, 'dubois');
    if (m != null) $('sito_bsaHint').innerHTML = 'Mosteller <b>' + m + '</b> m² &nbsp;·&nbsp; DuBois <b>' + d + '</b> m²';
  }

  // Isi kartu dari data tersimpan (kunjungan ini, atau kunjungan terakhir pasien sebagai usulan)
  async function prefillKartu(silent) {
    if (!$('sitoCard')) return;
    await ensureFormulirCache();
    if (!$('sitoCard')) return;                       // sudah pindah halaman selama menunggu
    const info = $('sitoInfo');
    if (!FORMULIR_OK) {
      info.innerHTML = '<div class="msg warn">Tabel data klinis belum dibuat. Jalankan <b>supabase/schema_formulir_sitostatika.sql</b> di Supabase &gt; SQL Editor, lalu muat ulang halaman. Sebelum itu, data di kartu ini tidak bisa disimpan.</div>';
      return;
    }
    const rm = ($('f_noRM') || {}).value ? $('f_noRM').value.trim() : '';
    const card = $('sitoCard');
    // No RM berganti pasien lain -> buang isian otomatis milik pasien sebelumnya (supaya tidak tersimpan ke pasien yang salah)
    if (card.dataset.rm && card.dataset.rm !== rm) resetKartu();
    if (!rm) { info.innerHTML = ''; return; }
    const hit = cariKlinis(rm, tanggalForm());
    if (!hit) { info.innerHTML = ''; return; }
    if (!klinisKosong() && silent) return;            // jangan timpa yang sedang diketik
    isiKartu(hit.rec);
    card.dataset.rm = rm;
    info.innerHTML = hit.exact
      ? '<div class="hint" style="margin-bottom:6px;">✔ Data klinis kunjungan ini dimuat dari database.</div>'
      : '<div class="msg warn">Diisi dari kunjungan terakhir (' + escapeHtml(fmtDate(hit.rec.tanggal + 'T00:00:00')) + '). <b>Periksa BB &amp; TB terbaru</b> — BSA akan dihitung ulang bila BB/TB diubah.</div>';
  }

  function bacaKlinis() {
    if (!$('sitoCard')) return null;
    const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
    const snap = {
      no_rm: ($('f_noRM').value || '').trim(),
      tanggal: tanggalForm(),
      bb: num('sito_bb'), tb: num('sito_tb'), bsa: num('sito_bsa'),
      metode_bsa: $('sito_metode').value,
      diagnosa: $('sito_diagnosa').value.trim() || null,
      dokter: $('sito_dokter').value.trim() || null,
      ruang: $('sito_ruang').value.trim() || RUANG_DEFAULT
    };
    if (snap.bsa == null && snap.bb != null && snap.tb != null) snap.bsa = hitungBSA(snap.bb, snap.tb, snap.metode_bsa);
    snap.adaIsi = !!(snap.bb != null || snap.tb != null || snap.bsa != null || snap.diagnosa || snap.dokter || snap.ruang !== RUANG_DEFAULT);
    return snap;
  }

  async function simpanKlinis(snap) {
    const row = {
      no_rm: snap.no_rm, tanggal: snap.tanggal, bb: snap.bb, tb: snap.tb, bsa: snap.bsa,
      metode_bsa: snap.metode_bsa, diagnosa: snap.diagnosa, dokter: snap.dokter, ruang: snap.ruang,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('formulir_sitostatika').upsert(row, { onConflict: 'no_rm,tanggal' });
    if (error) return error;
    FORMULIR = FORMULIR.filter(k => !(k.no_rm === row.no_rm && String(k.tanggal).slice(0, 10) === row.tanggal));
    FORMULIR.push(row);
    return null;
  }

  /* ---- kait: halaman Entri ---- */
  const entriAsli = PAGES.entri.render;
  PAGES.entri.render = async function (content) {
    await entriAsli.call(this, content);
    const firstCard = content.querySelector('.card');
    if (firstCard && !$('sitoCard')) firstCard.insertAdjacentHTML('afterend', kartuHtml());
    // BSA/kolom lain mengikuti perubahan No RM & tanggal
    const tgl = $('f_tanggalMulai');
    if (tgl) tgl.addEventListener('change', () => prefillKartu(true));
    await prefillKartu(false);
  };

  /* ---- kait: ketik No RM -> usulkan data klinis terakhir ---- */
  const lookupAsli = window.lookupPasienByRM;
  window.lookupPasienByRM = function () {
    lookupAsli.apply(this, arguments);
    prefillKartu(true);
  };

  /* ---- kait: Simpan Semua -> simpan juga data klinis ---- */
  const simpanAsli = window.simpanEntriBatch;
  window.simpanEntriBatch = async function () {
    const snap = bacaKlinis();                         // dibaca SEBELUM form ditutup oleh fungsi asli
    await simpanAsli.apply(this, arguments);
    if (!snap || !snap.adaIsi) return;
    if (CURRENT_ROUTE !== 'dashboard') return;         // validasi/simpan asli gagal -> masih di halaman Entri
    if (!snap.no_rm || !snap.tanggal) return;
    const dash = $('content');
    if (!FORMULIR_OK) {
      if (dash) toast(dash, 'err', 'Data klinis formulir sitostatika belum tersimpan: tabel belum dibuat. Jalankan supabase/schema_formulir_sitostatika.sql di Supabase.');
      return;
    }
    const err = await simpanKlinis(snap);
    if (dash) {
      if (err) toast(dash, 'err', 'Etiket tersimpan, tetapi data klinis formulir sitostatika gagal disimpan: ' + err.message);
      else toast(dash, 'ok', 'Data klinis formulir sitostatika (BB/TB/BSA/diagnosa/dokter) tersimpan.');
    }
  };

  /* ============================================================
     2. TOMBOL DI DAFTAR ETIKET
     ============================================================ */
  window.bukaFormulirSito = function (dariPilihan) {
    if (dariPilihan) {
      const ids = Array.from(window._sel.kemo);
      if (!ids.length) { alert('Pilih minimal satu etiket dulu (centang di tabel).'); return; }
      window.open('print/formulir-sitostatika.html?ids=' + encodeURIComponent(ids.join(',')), '_blank');
      return;
    }
    const d = window._dash || {};
    const today = localDateKey(new Date());
    const key = d.range === 'tomorrow' ? addDaysKey(today, 1) : (d.range === 'date' && d.date ? d.date : today);
    window.open('print/formulir-sitostatika.html?date=' + encodeURIComponent(key), '_blank');
  };

  function tombolDi(container, buatTombol) {
    const ref = Array.from(container.querySelectorAll('button')).find(b => /Serah Terima/i.test(b.textContent));
    if (!ref) return;
    ref.insertAdjacentElement('afterend', buatTombol());
  }

  // bar filter (per tanggal)
  const filtersAsli = window.renderDashFilters;
  window.renderDashFilters = function () {
    filtersAsli.apply(this, arguments);
    try {
      const box = $('dashFilters');
      if (!box || !window._dash || window._dash.jenis !== 'kemo') return;
      tombolDi(box, () => {
        const b = document.createElement('button');
        b.className = 'btn ghost small';
        b.textContent = '🧾 Formulir Sitostatika';
        b.title = 'Formulir pencampuran obat sitostatika: pasien yang Hari ke-1 kemoterapinya jatuh pada tanggal yang dipilih (obat beberapa hari digabung, ditandai H1-H3)';
        b.onclick = () => window.bukaFormulirSito(false);
        return b;
      });
    } catch (e) { console.warn('sitostatika: tombol filter', e); }
  };

  // bar pilihan (etiket yang dicentang)
  const selBarAsli = window.updateSelBar;
  window.updateSelBar = function () {
    selBarAsli.apply(this, arguments);
    try {
      const bar = $('selBar');
      if (!bar || bar.classList.contains('hidden')) return;
      if (window._dash && window._dash.jenis === 'obat') return;
      const actions = bar.querySelector('.sel-actions');
      if (!actions) return;
      tombolDi(actions, () => {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = '🧾 Formulir Sitostatika';
        b.title = 'Formulir pencampuran obat sitostatika untuk etiket yang dicentang (1 formulir per pasien per siklus; obat beberapa hari digabung, ditandai H1-H3)';
        b.onclick = () => window.bukaFormulirSito(true);
        return b;
      });
    } catch (e) { console.warn('sitostatika: tombol pilihan', e); }
  };

  // Bila dashboard sudah sempat tergambar sebelum file ini selesai dimuat, gambar ulang bagian yang diberi tombol.
  try {
    if (CURRENT_ROUTE === 'dashboard' && $('dashFilters')) {
      window.renderDashFilters();
      if (typeof syncSelectionUI === 'function') syncSelectionUI();
    }
  } catch (e) { console.warn('sitostatika: gambar ulang', e); }
})();
