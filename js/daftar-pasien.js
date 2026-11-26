/* ============================================================
   MODUL TAMBAHAN: DAFTAR ETIKET PER PASIEN
   ------------------------------------------------------------
   Dimuat SETELAH js/app.js dan js/sitostatika.js. Tidak mengubah app.js.

   Tab "Etiket Kemo (Infus)" di menu Daftar Etiket diganti:
     1. Daftar nama pasien (cari nama / No RM)
     2. Klik pasien -> etiket pasien itu, dikelompokkan per siklus & tanggal
     3. Centang etiket -> cetak Label Obat / Label Identitas /
        Bukti Serah Terima / Formulir Sitostatika (khusus pasien itu)
   Tab "Etiket Obat" tetap memakai tampilan lama.
   ============================================================ */
(function () {
  const MAX_LIST = 60;                       // jumlah pasien yang ditampilkan sekaligus
  const URL_CETAK = {
    label:    'print/label.html',
    identitas:'print/label-identitas.html',
    serah:    'print/serah-terima.html',
    formulir: 'print/formulir-sitostatika.html'
  };
  // key = no_rm (atau nama bila No RM kosong), sama seperti pengelompokan lama
  const PV = { key: null, q: '', sel: new Set(), keep: false, pendingDefault: false };

  const $ = id => document.getElementById(id);
  const esc = s => escapeHtml(s);

  /* ---------------- gaya ---------------- */
  (function injectStyle() {
    if ($('pvStyle')) return;
    const st = document.createElement('style');
    st.id = 'pvStyle';
    st.textContent = `
    .pv-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;}
    .pv-top .spacer{flex:1;}
    .pv-search{flex:1;min-width:220px;max-width:420px;}
    .pv-count{font-size:12.5px;color:var(--muted);margin:2px 0 10px;}
    .pv-list{display:flex;flex-direction:column;gap:8px;}
    .pv-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--border);border-radius:12px;background:#fff;cursor:pointer;transition:border-color .15s, box-shadow .15s;}
    .pv-item:hover,.pv-item:focus{border-color:var(--accent);box-shadow:var(--shadow-sm);outline:none;}
    .pv-avatar{flex:none;width:38px;height:38px;border-radius:50%;background:var(--accent-grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;}
    .pv-main{flex:1;min-width:0;}
    .pv-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .pv-sub{font-size:12px;color:var(--muted);margin-top:1px;}
    .pv-meta{font-size:12px;color:var(--muted);text-align:right;white-space:nowrap;}
    .pv-chev{color:var(--muted);font-size:20px;line-height:1;}
    .pv-empty{text-align:center;padding:28px 10px;color:var(--muted);}
    .pv-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px;}
    .pv-title{font-size:16px;}
    .pv-quick{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 12px;}
    .pv-quick .lbl{font-size:12px;color:var(--muted);font-weight:600;margin-right:2px;}
    .pv-cycle{border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden;background:#fff;}
    .pv-cyc-h{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f3f9f6;font-weight:700;font-size:13.5px;}
    .pv-cyc-h .grow{flex:1;}
    .pv-day-h{display:flex;align-items:center;gap:10px;padding:6px 12px;border-top:1px solid var(--border);background:#fafcfb;font-size:12px;font-weight:700;color:#3d4f46;}
    .pv-row{display:grid;grid-template-columns:28px 1fr auto auto auto;gap:10px;align-items:center;padding:8px 12px;border-top:1px solid var(--border);font-size:13.5px;}
    .pv-row.sel{background:#f0fbf6;}
    .pv-bud{font-size:12px;color:var(--muted);white-space:nowrap;}
    .pv-pills{white-space:nowrap;}
    .pv-act{display:flex;gap:4px;opacity:.4;transition:opacity .15s;}
    .pv-row:hover .pv-act,.pv-row:focus-within .pv-act{opacity:1;}
    .pv-act .icon-btn{padding:3px 7px;font-size:12px;}
    .pv-bar{position:sticky;bottom:10px;z-index:5;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px;padding:9px 12px;background:#fff;border:1px solid var(--accent);border-radius:12px;box-shadow:var(--shadow);}
    .pv-bar .cnt{font-size:13px;font-weight:700;margin-right:4px;}
    .pv-bar .grow{flex:1;}
    .pv-bar select{width:auto;flex:none;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:#fff;font-size:12px;}
    .pv-bar .btn{white-space:nowrap;}
    .pv-bar .btn.danger{background:#fff;color:var(--danger);border-color:var(--danger);box-shadow:none;}
    .pv-bar .btn.small{padding:6px 11px;}
    @media (max-width:760px){
      .pv-row{grid-template-columns:28px 1fr auto;}
      .pv-bud,.pv-pills{grid-column:2 / -1;}
      .pv-meta{display:none;}
    }`;
    document.head.appendChild(st);
  })();

  /* ---------------- data ---------------- */
  function hariKe(r) { const h = parseInt(r.hari_ke, 10); return h > 0 ? h : 1; }
  function tglKey(r) { return localDateKey(r.tanggal_dibuat); }
  function mulaiKey(r) { const k = tglKey(r); return k ? addDaysKey(k, -(hariKe(r) - 1)) : ''; }
  function urutRow(a, b) {
    return (new Date(a.tanggal_dibuat) - new Date(b.tanggal_dibuat)) ||
      (new Date(a.created_at) - new Date(b.created_at)) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  }
  function belumCetak(r) { return printState(r) !== 'sudah'; }

  // huruf awal nama tanpa gelar (Ny., Tn., An., dst.)
  function inisial(nama) {
    const n = String(nama || '').trim().replace(/^(ny|tn|nn|an|by|sdr|sdri|bpk|ibu|hj|h)\.?\s+/i, '');
    return (n.charAt(0) || '?').toUpperCase();
  }

  function daftarPasien() {
    const map = new Map();
    CACHE.etiket.forEach(r => {
      const k = String(r.no_rm || r.nama_pasien || '-');
      if (!map.has(k)) map.set(k, { key: k, nama: r.nama_pasien || '-', rm: r.no_rm || '', lahir: r.tanggal_lahir, rows: [] });
      map.get(k).rows.push(r);
    });
    const list = Array.from(map.values());
    list.forEach(p => {
      p.terakhir = p.rows.reduce((m, r) => { const k = tglKey(r); return k > m ? k : m; }, '');
    });
    list.sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));
    return list;
  }

  function defaultSel(p) {                    // etiket yang tanggalnya hari ini
    const today = localDateKey(new Date());
    return new Set(p.rows.filter(r => tglKey(r) === today).map(r => String(r.id)));
  }

  /* ---------------- tampilan ---------------- */
  function tabsHtml() {
    return `<div class="chip-row" id="jenisEtiketTabs">
      <span class="chip active" data-j="kemo" onclick="setJenisEtiket('kemo')">🧪 Etiket Kemo (Infus)</span>
      <span class="chip" data-j="obat" onclick="setJenisEtiket('obat')">💊 Etiket Obat</span>
    </div>`;
  }

  function filterPasien(list) {
    const q = PV.q.toLowerCase().trim();
    if (!q) return list;
    return list.filter(p => String(p.nama).toLowerCase().includes(q) || String(p.rm).toLowerCase().includes(q));
  }

  function itemsHtml(filtered) {
    if (!CACHE.etiket.length) {
      return `<div class="pv-empty">Belum ada etiket. Klik <b>Entri Baru</b> untuk membuat etiket pertama.</div>`;
    }
    if (!filtered.length) return `<div class="pv-empty">Tidak ada pasien yang cocok dengan “${esc(PV.q)}”.</div>`;
    const printOn = hasPrintCols();
    return filtered.slice(0, MAX_LIST).map(p => {
      const belum = printOn ? p.rows.filter(belumCetak).length : 0;
      const pill = !printOn ? '' : (belum
        ? `<span class="pill warn">${belum} belum dicetak</span>`
        : `<span class="pill ok">✓ semua tercetak</span>`);
      const lahir = p.lahir ? ' · lahir ' + esc(fmtDate(p.lahir)) : '';
      return `<div class="pv-item" data-open="${esc(p.key)}" tabindex="0">
        <div class="pv-avatar">${esc(inisial(p.nama))}</div>
        <div class="pv-main">
          <div class="pv-name">${esc(p.nama)}</div>
          <div class="pv-sub">${esc(p.rm || 'tanpa No RM')}${lahir}</div>
        </div>
        <div class="pv-meta">${p.rows.length} etiket<br>terakhir ${esc(fmtDateKey(p.terakhir))}</div>
        ${pill}
        <span class="pv-chev">›</span>
      </div>`;
    }).join('') + (filtered.length > MAX_LIST
      ? `<div class="pv-count" style="text-align:center;">Menampilkan ${MAX_LIST} dari ${filtered.length} pasien — ketik nama / No RM untuk mempersempit.</div>` : '');
  }

  function listHtml(list) {
    const filtered = filterPasien(list);
    return `
    <div class="card">
      <div class="pv-top">
        <input type="text" id="pvSearch" class="pv-search" placeholder="Cari nama pasien / No RM..." value="${esc(PV.q)}" autocomplete="off">
        <div class="spacer"></div>
        <button class="btn secondary" onclick="navigate('entri')">➕ Entri Baru</button>
      </div>
      <div class="pv-count" id="pvCountList">${filtered.length} pasien${PV.q ? ' cocok' : ''} · klik nama pasien untuk membuka etiketnya</div>
      <div class="pv-list" id="pvListBody">${itemsHtml(filtered)}</div>
    </div>`;
  }

  function siklusPasien(p) {
    // siklus = tanggal Hari ke-1; di dalamnya per tanggal (+ Hari ke-)
    const cm = new Map();
    p.rows.slice().sort(urutRow).forEach(r => {
      const ck = mulaiKey(r);
      if (!cm.has(ck)) cm.set(ck, { mulai: ck, days: new Map(), ids: [] });
      const c = cm.get(ck);
      const dk = tglKey(r) + '|' + (r.hari_ke || '');
      if (!c.days.has(dk)) c.days.set(dk, { dateKey: tglKey(r), hari: r.hari_ke, rows: [], ids: [] });
      c.days.get(dk).rows.push(r); c.days.get(dk).ids.push(String(r.id)); c.ids.push(String(r.id));
    });
    const arr = Array.from(cm.values()).sort((a, b) => b.mulai.localeCompare(a.mulai));   // terbaru di atas
    arr.forEach(c => { c.dayList = Array.from(c.days.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || (a.hari || 0) - (b.hari || 0)); });
    return arr;
  }

  function pillsHtml(r) {
    const p = (label, at, title) => at
      ? `<span class="pill ok" title="${title} dicetak ${esc(fmtDateTime(at))}">${label} ✓</span>`
      : `<span class="pill off" title="${title} belum dicetak">${label} –</span>`;
    return p('Label', r.dicetak_at, 'Label obat') + ' ' + p('Identitas', r.identitas_dicetak_at, 'Label identitas');
  }

  function detailHtml(p) {
    const printOn = hasPrintCols();
    const cycles = siklusPasien(p);
    const lahir = p.lahir ? 'Lahir ' + esc(fmtDate(p.lahir)) + ' · ' : '';
    const body = cycles.map(c => {
      const belum = printOn ? c.dayList.reduce((n, d) => n + d.rows.filter(belumCetak).length, 0) : 0;
      const maxH = Math.max.apply(null, c.dayList.map(d => parseInt(d.hari, 10) || 1));
      const durasi = maxH > 1 ? ` · ${maxH} hari` : '';
      const pill = !printOn ? '' : (belum ? `<span class="pill warn">${belum} belum dicetak</span>` : `<span class="pill ok">✓ tercetak</span>`);
      return `<div class="pv-cycle">
        <div class="pv-cyc-h">
          <input type="checkbox" data-act="sel-grp" data-ids="${esc(c.ids.join(','))}" title="Pilih semua etiket di siklus ini">
          <span class="grow">Kemo mulai ${esc(fmtDateKey(c.mulai))}<span class="muted" style="font-weight:500;"> · ${c.ids.length} etiket${durasi}</span></span>
          ${pill}
        </div>
        ${c.dayList.map(d => `
        <div class="pv-day-h">
          <input type="checkbox" data-act="sel-grp" data-ids="${esc(d.ids.join(','))}" title="Pilih semua etiket tanggal ini">
          <span>${d.hari ? 'H-' + esc(d.hari) + ' · ' : ''}${esc(fmtDateKey(d.dateKey))}</span>
        </div>
        ${d.rows.map(r => `
        <div class="pv-row" data-rid="${esc(r.id)}">
          <input type="checkbox" data-act="sel-row" value="${esc(r.id)}">
          <div>${esc(r.obat_dosis)}</div>
          <div class="pv-bud" title="Beyond Use Date">BUD ${esc(computeBud(r))}</div>
          <div class="pv-pills">${printOn ? pillsHtml(r) : ''}</div>
          <div class="pv-act">
            <button class="icon-btn" title="Edit" data-act="edit" data-id="${esc(r.id)}">✏️</button>
            <button class="icon-btn danger" title="Hapus" data-act="del" data-id="${esc(r.id)}">🗑️</button>
          </div>
        </div>`).join('')}`).join('')}
      </div>`;
    }).join('');

    return `
    <div class="card">
      <div class="pv-head">
        <button class="btn ghost small" data-act="back">← Semua pasien</button>
        <div class="pv-title"><b>${esc(p.nama)}</b> <span class="muted rm-code">${esc(p.rm)}</span>
          <div class="pv-sub">${lahir}${p.rows.length} etiket</div></div>
      </div>
      <div class="pv-quick">
        <span class="lbl">Pilih:</span>
        <span class="chip" data-act="quick" data-v="today">Hari ini</span>
        ${printOn ? '<span class="chip" data-act="quick" data-v="belum">Belum dicetak</span>' : ''}
        <span class="chip" data-act="quick" data-v="all">Semua</span>
        <span class="chip" data-act="quick" data-v="none">Kosongkan</span>
      </div>
      ${body}
      <div class="pv-bar">
        <span class="cnt" id="pvCount"></span>
        <button class="btn small" data-need data-act="print" data-k="label">🏷️ Label Obat</button>
        <button class="btn small" data-need data-act="print" data-k="identitas">🪪 Label Identitas</button>
        <button class="btn small" data-need data-act="print" data-k="serah">📄 Bukti Serah Terima</button>
        <button class="btn small" data-need data-act="print" data-k="formulir">🧾 Formulir Sitostatika</button>
        <span class="grow"></span>
        ${printOn ? `<select id="pvTandai" data-need title="Ubah status cetak etiket terpilih secara manual">
          <option value="">Tandai…</option><option value="sudah">✔ Sudah dicetak</option><option value="belum">↺ Belum dicetak</option></select>` : ''}
        <button class="btn danger small" data-need data-act="hapus-sel">🗑️ Hapus</button>
      </div>
    </div>`;
  }

  function draw() {
    const root = $('pvRoot');
    if (!root) return;
    const s0 = $('pvSearch');
    const hadFocus = !!s0 && document.activeElement === s0;
    const pos = hadFocus ? s0.selectionStart : 0;
    const list = daftarPasien();
    const cur = PV.key != null ? list.find(p => p.key === PV.key) : null;
    if (PV.key != null && !cur) { PV.key = null; PV.sel.clear(); }
    root.innerHTML = tabsHtml() + (cur ? detailHtml(cur) : listHtml(list));
    if (cur) { syncSel(); return; }
    const s = $('pvSearch');
    if (s && (hadFocus || window.matchMedia('(pointer:fine)').matches)) {
      s.focus(); try { s.setSelectionRange(pos || s.value.length, pos || s.value.length); } catch (e) { /* abaikan */ }
    }
  }

  function syncSel() {
    const root = $('pvRoot');
    if (!root) return;
    root.querySelectorAll('input[data-act]').forEach(cb => {
      if (cb.dataset.act === 'sel-row') {
        cb.checked = PV.sel.has(cb.value);
        const row = cb.closest('.pv-row'); if (row) row.classList.toggle('sel', cb.checked);
        return;
      }
      const ids = (cb.dataset.ids || '').split(',').filter(Boolean);
      const n = ids.reduce((c, id) => c + (PV.sel.has(id) ? 1 : 0), 0);
      cb.checked = ids.length > 0 && n === ids.length;
      cb.indeterminate = n > 0 && n < ids.length;
    });
    const cnt = $('pvCount');
    if (cnt) cnt.textContent = PV.sel.size ? PV.sel.size + ' etiket dipilih' : 'Pilih etiket untuk dicetak';
    root.querySelectorAll('[data-need]').forEach(b => { b.disabled = !PV.sel.size; });
  }

  /* ---------------- aksi ---------------- */
  function pasienAktif() { return daftarPasien().find(p => p.key === PV.key) || null; }

  function bukaPasien(key) {
    PV.key = key; PV.sel = new Set();
    const p = pasienAktif(); if (p) PV.sel = defaultSel(p);
    clearToasts(); draw(); window.scrollTo(0, 0);
    const c = $('content'); if (c && c.scrollTo) c.scrollTo(0, 0);
  }
  function clearToasts() { const c = $('content'); if (c) c.querySelectorAll(':scope > .msg').forEach(m => m.remove()); }

  function pilihCepat(v) {
    const p = pasienAktif(); if (!p) return;
    const today = localDateKey(new Date());
    let rows = [];
    if (v === 'today') rows = p.rows.filter(r => tglKey(r) === today);
    else if (v === 'belum') rows = p.rows.filter(belumCetak);
    else if (v === 'all') rows = p.rows;
    PV.sel = new Set(rows.map(r => String(r.id)));
    syncSel();
  }

  function cetak(kind) {
    const ids = Array.from(PV.sel);
    if (!ids.length || !URL_CETAK[kind]) return;
    window.open(URL_CETAK[kind] + '?ids=' + encodeURIComponent(ids.join(',')), '_blank');
  }

  async function tandai(val) {
    const ids = Array.from(PV.sel);
    if (!ids.length || !val) return;
    const at = val === 'sudah' ? new Date().toISOString() : null;
    const { error } = await supabase.from('etiket').update({ dicetak_at: at, identitas_dicetak_at: at }).in('id', ids);
    if (error) { alert('Gagal memperbarui status cetak: ' + error.message); return; }
    const set = new Set(ids);
    CACHE.etiket.forEach(r => { if (set.has(String(r.id))) { r.dicetak_at = at; r.identitas_dicetak_at = at; } });
    draw();
  }

  async function hapusDaftar(ids, pesan) {
    if (!ids.length) return;
    if (!confirm(pesan)) return;
    const { error } = await supabase.from('etiket').delete().in('id', ids);
    if (error) { alert('Gagal menghapus: ' + error.message); return; }
    ids.forEach(id => PV.sel.delete(String(id)));
    await loadAllData();
    draw();
  }

  function onClick(e) {
    const open = e.target.closest('[data-open]');
    if (open) { bukaPasien(open.dataset.open); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    switch (el.dataset.act) {
      case 'back': PV.key = null; PV.sel = new Set(); clearToasts(); draw(); break;
      case 'quick': pilihCepat(el.dataset.v); break;
      case 'print': cetak(el.dataset.k); break;
      case 'edit': editEtiket(el.dataset.id); break;
      case 'del': hapusDaftar([el.dataset.id], 'Hapus etiket ini?'); break;
      case 'hapus-sel': {
        const ids = Array.from(PV.sel);
        hapusDaftar(ids, 'Hapus ' + ids.length + ' etiket terpilih? Tindakan ini tidak bisa dibatalkan.');
        break;
      }
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'pvTandai') { const v = t.value; t.value = ''; tandai(v); return; }
    if (!(t instanceof HTMLInputElement) || !t.dataset.act) return;
    const ids = t.dataset.act === 'sel-row' ? [t.value] : (t.dataset.ids || '').split(',').filter(Boolean);
    ids.forEach(id => { if (t.checked) PV.sel.add(id); else PV.sel.delete(id); });
    syncSel();
  }

  function onInput(e) {
    if (e.target.id !== 'pvSearch') return;
    PV.q = e.target.value;
    const filtered = filterPasien(daftarPasien());
    $('pvListBody').innerHTML = itemsHtml(filtered);
    $('pvCountList').textContent = filtered.length + ' pasien' + (PV.q ? ' cocok' : '') + ' · klik nama pasien untuk membuka etiketnya';
  }

  function onKeydown(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'pvSearch') {
      const f = filterPasien(daftarPasien());
      if (f.length === 1) bukaPasien(f[0].key);
      return;
    }
    const item = e.target.closest && e.target.closest('[data-open]');
    if (item) bukaPasien(item.dataset.open);
  }

  /* ---------------- kait ke aplikasi ---------------- */
  const renderAsli = PAGES.dashboard.render;          // tampilan lama (tetap dipakai tab Etiket Obat)
  PAGES.dashboard.sub = 'Pilih pasien untuk melihat dan mencetak etiketnya';

  PAGES.dashboard.render = function (content) {
    initDashState();
    pruneSelection();
    if (window._dash.jenis === 'obat') return renderAsli(content);
    // buka lagi pasien tertentu hanya bila diminta (mis. setelah Simpan); selain itu mulai dari daftar pasien
    if (!PV.keep) { PV.key = null; PV.sel = new Set(); }
    const pending = PV.pendingDefault; PV.keep = false; PV.pendingDefault = false;
    content.innerHTML = '<div id="pvRoot"></div>';
    const root = $('pvRoot');
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeydown);
    if (pending && PV.key != null) { const p = pasienAktif(); PV.sel = p ? defaultSel(p) : new Set(); }
    draw();
  };

  // ganti tab Kemo <-> Obat
  window.setJenisEtiket = function (jenis) {
    window._dash.jenis = jenis;
    PAGES.dashboard.render($('content'));
  };

  // Setelah "Simpan Semua" berhasil, langsung tampilkan etiket pasien yang baru disimpan
  const simpanAsli = window.simpanEntriBatch;
  window.simpanEntriBatch = async function () {
    const rm = ($('f_noRM') || {}).value ? $('f_noRM').value.trim() : '';
    const nama = ($('f_namaPasien') || {}).value ? $('f_namaPasien').value.trim() : '';
    const prev = { key: PV.key, sel: PV.sel };
    PV.key = rm || nama || null; PV.keep = !!PV.key; PV.pendingDefault = true;
    try {
      return await simpanAsli.apply(this, arguments);
    } finally {
      if (CURRENT_ROUTE !== 'dashboard') {            // validasi/simpan gagal -> tetap di halaman Entri
        PV.key = prev.key; PV.sel = prev.sel; PV.keep = false; PV.pendingDefault = false;
      }
    }
  };

  // Segarkan status cetak saat petugas kembali dari tab cetak
  let lastRefresh = 0;
  async function segarkan() {
    if (CURRENT_ROUTE !== 'dashboard' || !$('pvRoot')) return;
    if (!window._dash || window._dash.jenis !== 'kemo') return;
    const now = Date.now();
    if (now - lastRefresh < 3000) return;
    lastRefresh = now;
    const { data, error } = await supabase.from('etiket').select('*').order('created_at', { ascending: false });
    if (error || !data || !$('pvRoot')) return;
    CACHE.etiket = data;
    const ada = new Set(data.map(r => String(r.id)));
    PV.sel.forEach(id => { if (!ada.has(id)) PV.sel.delete(id); });
    draw();
  }
  window.addEventListener('focus', segarkan);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) segarkan(); });

  // Bila dashboard sudah sempat tergambar sebelum file ini selesai dimuat, gambar ulang dengan tampilan baru.
  try {
    if (CURRENT_ROUTE === 'dashboard' && $('content') && $('content').querySelector('#etiketTable')) {
      PAGES.dashboard.render($('content'));
    }
  } catch (e) { console.warn('daftar-pasien: gambar ulang', e); }
})();
