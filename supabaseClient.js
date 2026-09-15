// ============================================================
// KONFIGURASI SUPABASE
// Isi dua nilai di bawah ini dengan punya Anda:
// Dashboard Supabase > Project Settings > API
//   - Project URL           -> SUPABASE_URL
//   - anon / public API key -> SUPABASE_ANON_KEY
// (anon key AMAN untuk ditaruh di kode frontend publik, karena akses data
//  tetap dijaga oleh Row Level Security yang mewajibkan login/authenticated)
// ============================================================
const SUPABASE_URL = 'https://glnmzjlvisotysijhcph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsbm16amx2aXNvdHlzaWpoY3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NjcwODksImV4cCI6MjEwNDI0MzA4OX0.Y8taoaWPkT-WR6Tx3f7TdIgyyn-YLLiKnCobmL7V2tE';

// PENTING: jangan pakai "const supabase = ..." di sini — library Supabase dari
// CDN sudah membuat variabel global bernama "supabase", jadi mendeklarasikan
// ulang dengan const/let akan menyebabkan "Identifier 'supabase' has already
// been declared". Timpa langsung window.supabase supaya semua file lain
// (app.js, print/label.html, dll) tetap bisa memanggil variabel "supabase"
// seperti biasa.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
