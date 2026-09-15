-- ============================================================
-- TAMBAHAN SKEMA: ETIKET TPN (terpisah dari tabel etiket onko)
-- Jalankan file ini di: Supabase Dashboard > SQL Editor > New query
-- (Jalankan SETELAH schema.sql utama sudah pernah dijalankan, karena
--  tabel ini masih memakai tabel "pasien" & "pengaturan" yang sama)
-- ============================================================

-- TABEL ETIKET TPN (1 baris = 1 etiket TPN)
-- Komposisi disimpan sebagai jsonb array, tiap elemen:
--   { "nama": "D10%", "volume": "250 ml" }
-- supaya tampil di etiket sebagai baris terpisah:
--   D10% 250 ml
--   KCl 7,46% 12 ml
create table if not exists etiket_tpn (
  id                  text primary key,
  batch_id            text,
  nama_pasien         text,
  no_rm               text references pasien(no_rm) on update cascade,
  tanggal_lahir       date,
  lokasi              text,
  komposisi           jsonb,
  bud_durasi_jam       numeric default 24,
  tanggal_dibuat      timestamptz,
  tanggal_bud         timestamptz,
  petugas             text,
  created_at          timestamptz default now()
);

create index if not exists idx_etiket_tpn_no_rm on etiket_tpn (no_rm);
create index if not exists idx_etiket_tpn_tanggal on etiket_tpn (tanggal_dibuat);

alter table etiket_tpn enable row level security;

create policy "auth_all_etiket_tpn" on etiket_tpn for all
  to authenticated using (true) with check (true);

-- ============================================================
-- SELESAI. Tabel "pasien" dan "pengaturan" dipakai bersama dengan
-- etiket onko (identitas pasien & nama RS sama), tetapi data etiket
-- TPN sepenuhnya terpisah dari tabel "etiket" (onko).
-- ============================================================
