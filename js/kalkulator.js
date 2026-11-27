/* =====================================================================
   kalkulator.js — Menu Kalkulator (BSA, Calvert, ClCr, Antrasiklin)
   Modul mandiri: hanya mendaftarkan halaman baru ke PAGES.
   Tidak mengubah/menimpa fungsi lain di aplikasi.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- helper ---------------- */
  function $(id) { return document.getElementById(id); }
  function num(id) {
    const el = $(id);
    if (!el) return NaN;
    const v = parseFloat(String(el.value).replace(',', '.'));
    return isFinite(v) ? v : NaN;
  }
  function numEl(el) {
    if (!el) return NaN;
    const v = parseFloat(String(el.value).replace(',', '.'));
    return isFinite(v) ? v : NaN;
  }
  function fmt(v, d) {
    d = d == null ? 2 : d;
    return v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const PLACEHOLDER = '<span class="muted">Isi data di atas untuk melihat hasil.</span>';

  /* ---------------- gaya (disuntik sekali) ---------------- */
  function injectStyle() {
    if ($('kalStyle')) return;
    const st = document.createElement('style');
    st.id = 'kalStyle';
    st.textContent = `
      .kal-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
      .kal-tab{padding:9px 16px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:600;font-size:13px;cursor:pointer;}
      .kal-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}
      .kal-panel{display:none;}
      .kal-panel.active{display:block;}
      .kal-formula{background:#f6faf8;border:1px dashed var(--border);border-radius:10px;padding:10px 14px;font-size:12.5px;line-height:1.7;margin-top:14px;}
      .kal-formula b{display:block;margin-bottom:2px;}
      .kal-formula code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;}
      .kal-result{margin-top:16px;padding:14px 16px;border-radius:12px;background:linear-gradient(135deg,rgba(16,185,129,.10),rgba(45,212,191,.10));border:1px solid var(--border);}
      .kal-big{font-size:26px;font-weight:800;color:var(--accent);line-height:1.2;}
      .kal-big small{font-size:13px;font-weight:600;color:var(--muted);margin-left:4px;}
      .kal-res-row{display:flex;gap:28px;flex-wrap:wrap;}
      .kal-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}
      .kal-table th,.kal-table td{padding:7px 9px;border-bottom:1px solid var(--border);text-align:left;}
      .kal-table tr.sel td{background:rgba(16,185,129,.12);font-weight:700;}
      .kal-an-row{display:grid;grid-template-columns:2fr 1.2fr 1fr .8fr auto;gap:8px;align-items:end;margin-bottom:8px;}
      .kal-st-ok{color:#166534;font-weight:700;}
      .kal-st-warn{color:#92400e;font-weight:700;}
      .kal-st-bad{color:#991b1b;font-weight:700;}
      @media (max-width:700px){.kal-an-row{grid-template-columns:1fr 1fr;}}
    `;
    document.head.appendChild(st);
  }

  /* ---------------- rumus ---------------- */
  const bsaMosteller = (bb, tb) => Math.sqrt(tb * bb / 3600);
  const bsaDubois = (bb, tb) => 0.007184 * Math.pow(bb, 0.425) * Math.pow(tb, 0.725);
  const ibw = (tb, jk) => (jk === 'P' ? 45.5 : 50) + 0.91 * (tb - 152.4);

  // Antrasiklin: batas kumulatif (mg/m²) & faktor konversi ke ekuivalen doksorubisin
  const ANTRA = {
    dox: { nama: 'Doksorubisin',  batas: 550, faktor: 1 },
    epi: { nama: 'Epirubisin',    batas: 900, faktor: 0.8 },
    dau: { nama: 'Daunorubisin',  batas: 550, faktor: 0.5 },
    ida: { nama: 'Idarubisin',    batas: 150, faktor: 5 },
    mit: { nama: 'Mitoksantron',  batas: 140, faktor: 4 }
  };
  const BATAS_EKUIVALEN = 550;   // total ekuivalen doksorubisin
  const AMBANG_WASPADA = 0.8;    // >= 80% batas => peringatan kuning

  /* ---------------- state antar-tab ---------------- */
  const state = { crcl: null };

  /* ---------------- render halaman ---------------- */
  function renderKalkulator(content) {
    injectStyle();
    content.innerHTML = `
      <div class="kal-tabs">
        <button type="button" class="kal-tab active" data-tab="bsa">BSA</button>
        <button type="button" class="kal-tab" data-tab="calvert">Calvert (Carboplatin)</button>
        <button type="button" class="kal-tab" data-tab="clcr">ClCr</button>
        <button type="button" class="kal-tab" data-tab="antra">Antrasiklin Kumulatif</button>
      </div>

      <!-- ===== BSA ===== -->
      <div class="kal-panel active" id="kal_p_bsa">
        <div class="card" style="max-width:640px;">
          <h2>Kalkulator BSA (Luas Permukaan Tubuh)</h2>
          <div class="row2">
            <div><label>Berat Badan (kg)</label><input type="text" inputmode="decimal" id="kal_bsa_bb" placeholder="mis. 60"></div>
            <div><label>Tinggi Badan (cm)</label><input type="text" inputmode="decimal" id="kal_bsa_tb" placeholder="mis. 165"></div>
          </div>
          <div class="kal-result" id="kal_bsa_out">${PLACEHOLDER}</div>
          <div class="kal-formula">
            <b>Rumus</b>
            Mosteller: <code>BSA (m²) = √( TB(cm) × BB(kg) / 3600 )</code><br>
            DuBois &amp; DuBois: <code>BSA (m²) = 0,007184 × BB(kg)^0,425 × TB(cm)^0,725</code>
          </div>
        </div>
      </div>

      <!-- ===== CALVERT ===== -->
      <div class="kal-panel" id="kal_p_calvert">
        <div class="card" style="max-width:640px;">
          <h2>Calvert Formula (Carboplatin)</h2>
          <div class="row2">
            <div><label>Target AUC (mg/mL·menit)</label><input type="text" inputmode="decimal" id="kal_cv_auc" value="5"></div>
            <div>
              <label>GFR / ClCr (mL/menit)</label>
              <input type="text" inputmode="decimal" id="kal_cv_gfr" placeholder="mis. 90">
              <div class="hint">Bisa diisi manual atau dikirim dari tab ClCr.</div>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-weight:600;">
            <input type="checkbox" id="kal_cv_cap" checked style="width:auto;margin:0;"> Batasi GFR maksimum 125 mL/menit
          </label>
          <div class="kal-result" id="kal_cv_out">${PLACEHOLDER}</div>
          <div class="kal-formula">
            <b>Rumus</b>
            <code>Dosis (mg) = Target AUC × ( GFR + 25 )</code><br>
            GFR maksimum 125 mL/menit → dosis maksimum = AUC × 150 mg
          </div>
        </div>
      </div>

      <!-- ===== CLCR ===== -->
      <div class="kal-panel" id="kal_p_clcr">
        <div class="card" style="max-width:640px;">
          <h2>Kalkulator ClCr (Cockcroft-Gault)</h2>
          <div class="row3">
            <div><label>Usia (tahun)</label><input type="text" inputmode="decimal" id="kal_cc_usia"></div>
            <div><label>Jenis Kelamin</label>
              <select id="kal_cc_jk"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
            </div>
            <div><label>Serum Kreatinin (mg/dL)</label><input type="text" inputmode="decimal" id="kal_cc_scr"></div>
          </div>
          <div class="row3" style="margin-top:8px;">
            <div><label>Berat Badan (kg)</label><input type="text" inputmode="decimal" id="kal_cc_bb"></div>
            <div><label>Tinggi Badan (cm)</label><input type="text" inputmode="decimal" id="kal_cc_tb"><div class="hint">Diperlukan untuk BB ideal / adjusted.</div></div>
            <div><label>BB yang dipakai</label>
              <select id="kal_cc_basis">
                <option value="aktual">BB aktual</option>
                <option value="ibw">BB ideal (IBW)</option>
                <option value="adj">BB adjusted</option>
              </select>
            </div>
          </div>
          <div class="kal-result" id="kal_cc_out">${PLACEHOLDER}</div>
          <button type="button" class="btn secondary small" id="kal_cc_kirim" style="margin-top:10px;display:none;">➡️ Gunakan di Calvert</button>
          <div class="kal-formula">
            <b>Rumus</b>
            <code>ClCr (mL/menit) = (140 − usia) × BB(kg) / (72 × SCr)</code> &nbsp; × 0,85 bila perempuan<br>
            IBW pria: <code>50 + 0,91 × (TB − 152,4)</code> &nbsp;|&nbsp; IBW wanita: <code>45,5 + 0,91 × (TB − 152,4)</code><br>
            BB adjusted: <code>IBW + 0,4 × (BB aktual − IBW)</code>
          </div>
        </div>
      </div>

      <!-- ===== ANTRASIKLIN ===== -->
      <div class="kal-panel" id="kal_p_antra">
        <div class="card" style="max-width:820px;">
          <h2>Dosis Kumulatif Antrasiklin</h2>
          <div style="max-width:260px;margin-bottom:12px;">
            <label>BSA pasien (m²)</label>
            <input type="text" inputmode="decimal" id="kal_an_bsa" placeholder="untuk dosis yang diinput dalam mg">
          </div>
          <div id="kal_an_rows"></div>
          <button type="button" class="btn secondary small" id="kal_an_add">➕ Tambah baris</button>
          <div class="hint" style="margin-top:6px;">Masukkan seluruh pemberian, termasuk riwayat sebelumnya (jumlah × dosis per pemberian).</div>
          <div class="kal-result" id="kal_an_out">${PLACEHOLDER}</div>
          <div class="kal-formula">
            <b>Rumus</b>
            <code>Dosis kumulatif (mg/m²) = Σ ( dosis per pemberian × jumlah pemberian )</code><br>
            Bila dosis dalam mg: <code>mg/m² = mg / BSA</code><br>
            Ekuivalen doksorubisin = dosis × faktor: doksorubisin 1 · epirubisin 0,8 · daunorubisin 0,5 · idarubisin 5 · mitoksantron 4<br>
            Batas kumulatif (mg/m²): doksorubisin 550 · epirubisin 900 · daunorubisin 550 · idarubisin 150 · mitoksantron 140.
            Peringatan kuning bila ≥ 80% batas, merah bila ≥ 100%.
          </div>
        </div>
      </div>
    `;

    /* tab */
    content.querySelectorAll('.kal-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    /* BSA, Calvert, ClCr: hitung ulang saat input berubah */
    ['kal_bsa_bb', 'kal_bsa_tb'].forEach(id => $(id).addEventListener('input', calcBSA));
    ['kal_cv_auc', 'kal_cv_gfr', 'kal_cv_cap'].forEach(id => $(id).addEventListener('input', calcCalvert));
    ['kal_cc_usia', 'kal_cc_jk', 'kal_cc_scr', 'kal_cc_bb', 'kal_cc_tb', 'kal_cc_basis'].forEach(id => {
      $(id).addEventListener('input', calcCrCl);
      $(id).addEventListener('change', calcCrCl);
    });
    $('kal_cc_kirim').addEventListener('click', () => {
      if (state.crcl == null) return;
      $('kal_cv_gfr').value = (Math.round(state.crcl * 10) / 10).toString().replace('.', ',');
      calcCalvert();
      switchTab('calvert');
    });

    /* Antrasiklin */
    $('kal_an_bsa').addEventListener('input', calcAntra);
    $('kal_an_add').addEventListener('click', () => { addAntraRow(); });
    addAntraRow(); addAntraRow();
    calcAntra();
  }

  function switchTab(name) {
    document.querySelectorAll('.kal-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === name));
    document.querySelectorAll('.kal-panel').forEach(p => p.classList.toggle('active', p.id === 'kal_p_' + name));
  }

  /* ---------------- 1. BSA ---------------- */
  function calcBSA() {
    const bb = num('kal_bsa_bb'), tb = num('kal_bsa_tb'), out = $('kal_bsa_out');
    if (!(bb > 0 && tb > 0)) { out.innerHTML = PLACEHOLDER; return; }
    out.innerHTML = `
      <div class="kal-res-row">
        <div><div class="muted" style="font-size:12px;">Mosteller</div><div class="kal-big">${fmt(bsaMosteller(bb, tb))}<small>m²</small></div></div>
        <div><div class="muted" style="font-size:12px;">DuBois</div><div class="kal-big">${fmt(bsaDubois(bb, tb))}<small>m²</small></div></div>
      </div>`;
  }

  /* ---------------- 2. CALVERT ---------------- */
  function calcCalvert() {
    const auc = num('kal_cv_auc'), gfr = num('kal_cv_gfr'), cap = $('kal_cv_cap').checked, out = $('kal_cv_out');
    if (!(auc > 0 && gfr > 0)) { out.innerHTML = PLACEHOLDER; return; }
    const dipakai = cap ? Math.min(gfr, 125) : gfr;
    const dosis = auc * (dipakai + 25);
    const maks = auc * 150;
    out.innerHTML = `
      <div class="kal-big">${fmt(dosis, 0)}<small>mg carboplatin</small></div>
      <div style="margin-top:8px;font-size:13px;line-height:1.7;">
        GFR dipakai: <b>${fmt(dipakai, 1)}</b> mL/menit${cap && gfr > 125 ? ' <span class="kal-st-warn">(dibatasi dari ' + fmt(gfr, 1) + ')</span>' : ''}<br>
        Perhitungan: ${fmt(auc, 1)} × (${fmt(dipakai, 1)} + 25) = ${fmt(dosis, 1)} mg<br>
        Dosis maksimum (GFR 125): ${fmt(maks, 0)} mg
      </div>`;
  }

  /* ---------------- 3. CLCR ---------------- */
  function calcCrCl() {
    const age = num('kal_cc_usia'), bb = num('kal_cc_bb'), tb = num('kal_cc_tb'), scr = num('kal_cc_scr');
    const jk = $('kal_cc_jk').value, basis = $('kal_cc_basis').value;
    const out = $('kal_cc_out'), btn = $('kal_cc_kirim');
    state.crcl = null;
    btn.style.display = 'none';
    if (!(age > 0 && bb > 0 && scr > 0)) { out.innerHTML = PLACEHOLDER; return; }

    const k = jk === 'P' ? 0.85 : 1;
    const cg = w => (140 - age) * w / (72 * scr) * k;
    const rows = [{ key: 'aktual', nama: 'BB aktual', w: bb }];
    if (tb > 0) {
      const i = ibw(tb, jk);
      rows.push({ key: 'ibw', nama: 'BB ideal (IBW)', w: i });
      rows.push({ key: 'adj', nama: 'BB adjusted', w: i + 0.4 * (bb - i) });
    }
    rows.forEach(r => { r.cl = Math.max(0, cg(r.w)); });
    const sel = rows.find(r => r.key === basis);

    let head;
    if (sel) {
      state.crcl = sel.cl;
      btn.style.display = '';
      head = `<div class="kal-big">${fmt(sel.cl, 1)}<small>mL/menit (${sel.nama})</small></div>`;
    } else {
      head = '<div class="kal-st-warn">Isi tinggi badan untuk menghitung dengan BB ideal / adjusted.</div>';
    }
    out.innerHTML = head + `
      <table class="kal-table">
        <tr><th>Basis BB</th><th>BB (kg)</th><th>ClCr (mL/menit)</th></tr>
        ${rows.map(r => `<tr class="${r.key === basis ? 'sel' : ''}"><td>${r.nama}</td><td>${fmt(r.w, 1)}</td><td>${fmt(r.cl, 1)}</td></tr>`).join('')}
      </table>`;
  }

  /* ---------------- 4. ANTRASIKLIN ---------------- */
  function addAntraRow() {
    const wrap = $('kal_an_rows');
    const div = document.createElement('div');
    div.className = 'kal-an-row';
    div.innerHTML = `
      <div><label>Obat</label>
        <select class="kal-an-drug">${Object.keys(ANTRA).map(k => `<option value="${k}">${ANTRA[k].nama}</option>`).join('')}</select></div>
      <div><label>Dosis / pemberian</label><input type="text" inputmode="decimal" class="kal-an-dose"></div>
      <div><label>Satuan</label>
        <select class="kal-an-unit"><option value="m2">mg/m²</option><option value="mg">mg</option></select></div>
      <div><label>Jumlah</label><input type="text" inputmode="numeric" class="kal-an-n" value="1"></div>
      <div><button type="button" class="btn ghost small kal-an-del" title="Hapus baris">✕</button></div>`;
    wrap.appendChild(div);
    div.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', calcAntra);
      el.addEventListener('change', calcAntra);
    });
    div.querySelector('.kal-an-del').addEventListener('click', () => { div.remove(); calcAntra(); });
  }

  function calcAntra() {
    const out = $('kal_an_out');
    const bsa = num('kal_an_bsa');
    const total = {};
    let adaData = false, butuhBSA = false;

    document.querySelectorAll('#kal_an_rows .kal-an-row').forEach(row => {
      const drug = row.querySelector('.kal-an-drug').value;
      const unit = row.querySelector('.kal-an-unit').value;
      const dose = numEl(row.querySelector('.kal-an-dose'));
      const n = numEl(row.querySelector('.kal-an-n'));
      if (!(dose > 0 && n > 0)) return;
      let perM2 = dose;
      if (unit === 'mg') {
        if (!(bsa > 0)) { butuhBSA = true; return; }
        perM2 = dose / bsa;
      }
      total[drug] = (total[drug] || 0) + perM2 * n;
      adaData = true;
    });

    let html = '';
    if (butuhBSA) html += '<div class="msg warn" style="margin-bottom:10px;">Ada baris dalam satuan mg — isi BSA pasien agar dapat dikonversi ke mg/m².</div>';
    if (!adaData) { out.innerHTML = html || PLACEHOLDER; return; }

    let ekuivalen = 0;
    const baris = Object.keys(total).map(k => {
      const a = ANTRA[k], t = total[k], pct = t / a.batas;
      ekuivalen += t * a.faktor;
      return `<tr><td>${a.nama}</td><td>${fmt(t, 1)}</td><td>${a.batas}</td><td>${fmt(pct * 100, 0)}%</td><td>${statusHtml(pct)}</td></tr>`;
    }).join('');
    const pctEk = ekuivalen / BATAS_EKUIVALEN;

    html += `
      <div class="kal-big">${fmt(ekuivalen, 1)}<small>mg/m² ekuivalen doksorubisin</small></div>
      <div style="margin-top:6px;font-size:13px;">${fmt(pctEk * 100, 0)}% dari batas ${BATAS_EKUIVALEN} mg/m² &nbsp;${statusHtml(pctEk)}</div>
      <table class="kal-table">
        <tr><th>Obat</th><th>Kumulatif (mg/m²)</th><th>Batas (mg/m²)</th><th>% batas</th><th>Status</th></tr>
        ${baris}
      </table>`;
    out.innerHTML = html;
  }

  function statusHtml(p) {
    if (p >= 1) return '<span class="kal-st-bad">Melewati batas</span>';
    if (p >= AMBANG_WASPADA) return '<span class="kal-st-warn">Mendekati batas</span>';
    return '<span class="kal-st-ok">Aman</span>';
  }

  /* ---------------- daftarkan ke router ---------------- */
  if (typeof PAGES !== 'undefined') {
    PAGES.kalkulator = {
      title: 'Kalkulator',
      sub: 'BSA, Calvert, ClCr, dan dosis kumulatif antrasiklin',
      render: renderKalkulator
    };
  }
})();
