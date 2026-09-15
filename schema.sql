-- ============================================================
-- SISTEM ETIKET KEMOTERAPI — SKEMA SUPABASE
-- Jalankan seluruh file ini di: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1) TABEL PENGATURAN (nama RS, sub judul)
create table if not exists pengaturan (
  key   text primary key,
  value text
);

insert into pengaturan (key, value) values
  ('nama_rs', 'RSUD AM PARIKESIT'),
  ('sub_judul', 'INSTALASI FARMASI - UNIT DISPENSING STERIL')
on conflict (key) do nothing;

-- 2) TABEL DATABASE OBAT
create table if not exists obat (
  id           bigint generated always as identity primary key,
  nama_obat    text not null unique,
  konsentrasi  numeric,
  satuan       text default 'mg/ml',
  created_at   timestamptz default now()
);

insert into obat (nama_obat, konsentrasi, satuan) values
  ('Epirubicin', 2, 'mg/ml'),
  ('Asam Zoledronat', 0.8, 'mg/ml'),
  ('Asam Ibandronat', 1, 'mg/ml'),
  ('Bortezomib', 1, 'mg/ml'),
  ('Bleomicin', 1.5, 'mg/ml'),
  ('Dosetaksel', 20, 'mg/ml'),
  ('Bendamustin', 5, 'mg/ml'),
  ('Brentuksimab', 5, 'mg/ml'),
  ('Fluorouracil', 50, 'mg/ml'),
  ('Cisplatin', 1, 'mg/ml'),
  ('Doksorubisin', 2, 'mg/ml'),
  ('Desitabin', 5, 'mg/ml'),
  ('Dekarbazin', 10, 'mg/ml'),
  ('Daunorubisin', 5, 'mg/ml'),
  ('Etoposid', 20, 'mg/ml'),
  ('Pemetreksed', 25, 'mg/ml'),
  ('Fludarabin', 25, 'mg/ml'),
  ('Gemsitabin', 38, 'mg/ml'),
  ('Ifosfamid', 40, 'mg/ml'),
  ('Trastuzumab', 22, 'mg/ml'),
  ('Eribulin', 0.5, 'mg/ml'),
  ('Irinotekan', 20, 'mg/ml'),
  ('Calcium Folinat', 10, 'mg/ml'),
  ('Karboplatin', 10, 'mg/ml'),
  ('Asparaginase', 2000, 'mg/ml'),
  ('Mesna', 100, 'mg/ml'),
  ('Metotreksat', 25, 'mg/ml'),
  ('Oksaliplatin', 5, 'mg/ml'),
  ('Paklitaksel', 6, 'mg/ml'),
  ('Rituksimab', 10, 'mg/ml'),
  ('Siklofosfamid', 20, 'mg/ml'),
  ('Sitarabin', 100, 'mg/ml'),
  ('Vinkristin', 1, 'mg/ml')
on conflict (nama_obat) do nothing;

-- 3) TABEL PASIEN
create table if not exists pasien (
  no_rm         text primary key,
  nama_pasien   text not null,
  tanggal_lahir date,
  updated_at    timestamptz default now()
);

-- 4) TABEL ETIKET (1 baris = 1 etiket, setara sheet "Data")
create table if not exists etiket (
  id                  text primary key,
  batch_id            text,
  nama_pasien         text,
  no_rm               text references pasien(no_rm) on update cascade,
  tanggal_lahir       date,
  lokasi              text,
  obat_dosis          text,
  nama_obat           text,
  dosis_mg            numeric,
  hari_ke             integer,
  ambil               text,
  sediaan             text,
  total_volume_ml     text,
  rute                text,
  nama_pelarut        text,
  volume_pelarut_ml   numeric,
  cara_pemberian      text,
  pelarut             text,
  frekuensi           text,
  bud_durasi_jam      numeric default 24,
  tanggal_dibuat      timestamptz,
  tanggal_bud         timestamptz,
  kondisi_simpan      text,
  petugas             text,
  created_at          timestamptz default now()
);

create index if not exists idx_etiket_no_rm on etiket (no_rm);
create index if not exists idx_etiket_dedup on etiket (no_rm, hari_ke, lower(nama_obat));
create index if not exists idx_etiket_tanggal on etiket (tanggal_dibuat);

-- ============================================================
-- ROW LEVEL SECURITY
-- Aplikasi login pakai Supabase Auth (email + password). Hanya user yang
-- sudah login (authenticated) yang boleh baca/tulis data pasien & etiket.
-- ============================================================
alter table pengaturan enable row level security;
alter table obat       enable row level security;
alter table pasien     enable row level security;
alter table etiket     enable row level security;

create policy "auth_all_pengaturan" on pengaturan for all
  to authenticated using (true) with check (true);

create policy "auth_all_obat" on obat for all
  to authenticated using (true) with check (true);

create policy "auth_all_pasien" on pasien for all
  to authenticated using (true) with check (true);

create policy "auth_all_etiket" on etiket for all
  to authenticated using (true) with check (true);

-- ============================================================
-- SELESAI. Langkah berikutnya:
-- 1. Authentication > Providers > pastikan "Email" aktif.
-- 2. Authentication > Users > Add user (buat akun untuk petugas farmasi).
-- 3. Project Settings > API > salin "Project URL" & "anon public key"
--    lalu tempel ke js/supabaseClient.js di aplikasi web.
-- ============================================================
