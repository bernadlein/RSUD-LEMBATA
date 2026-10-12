# Deploy RSUD LEWOLEBA

Proyek memakai Nuxt 4, Tailwind CSS 4, TypeScript, font Inter, dan Supabase.

## GitHub dan Vercel

Pasang semua file perubahan pada path yang sama dalam repository yang sudah ada. Vercel membangun branch terhubung setelah commit sesuai konfigurasi proyek.

| Pengaturan Vercel | Nilai |
|---|---|
| Framework Preset | Nuxt.js |
| Root Directory | Folder yang memuat package.json |
| Node.js | 24.x |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | Deteksi framework |

## Database

Jalankan migrasi berurutan di Supabase SQL Editor:

1. supabase/migrations/001_initial.sql
2. supabase/migrations/002_attendance.sql
3. supabase/migrations/003_doctor_photos.sql
4. supabase/migrations/004_portal_location.sql

Jika 001–003 sudah dijalankan, cukup jalankan 004. Menyimpan file SQL ke GitHub tidak menjalankannya otomatis di Supabase. Migrasi 004 memerlukan tabel dari 001 dan 002.

## Environment

| Nama | Nilai |
|---|---|
| NUXT_PUBLIC_STORAGE_MODE | supabase |
| NUXT_PUBLIC_SUPABASE_URL | URL project Supabase |
| NUXT_PUBLIC_SUPABASE_ANON_KEY | Anon/publishable key |
| NUXT_SUPABASE_SERVICE_ROLE_KEY | Service-role key khusus server |
| NUXT_PUBLIC_HOSPITAL_ID | UUID ruang kerja RS, disalin dari Portal & lokasi RS |

Service-role key hanya disimpan di environment server tanpa awalan PUBLIC. Setelah mengubah environment, redeploy. Source sudah memakai mode Supabase sebagai nilai awal, tetapi URL dan kunci tetap harus diisi.

Untuk admin pertama tanpa ruang kerja, isi HOSPITAL_ID setelah membuat fasilitas. Untuk fasilitas yang sudah ada, gunakan ID yang sudah ada dan akun admin yang sudah menjadi anggotanya. Panduan akun pertama ada di [LOGIN_AWAL.md](LOGIN_AWAL.md).

## Informasi publik dan absensi

Admin menyimpan profil/kontak/berita melalui Portal & lokasi RS, memilih bulan terkunci, menyimpan draf, lalu menerbitkan informasi. Perubahan internal tidak langsung mengubah publikasi. Data pribadi dokter, cuti, audit, absensi, dan koordinat tidak ikut diterbitkan.

Tetapkan titik RS dan radius absensi sebelum mencatat masuk/pulang. Hubungkan akun dokter pada halaman Absensi, lalu cetak QR untuk ruangan. Periksa GPS di lapangan pada perangkat dokter.

Untuk fasilitas yang sudah tersimpan, simpan identitas melalui Pengaturan → Fasilitas & pengesahan dan terbitkan ulang setelah memperbarui nama. Brand yang tampil pada aplikasi ialah RSUD LEWOLEBA.

## Pemeriksaan

```bash
npm ci
npm run check
NITRO_PRESET=vercel npm run build
```

Setelah deploy, periksa Beranda/Jadwal dokter/Berita tanpa login, halaman internal dengan login, peran admin/pembaca, foto dokter, serta absensi di dalam dan di luar radius.

Cadangan JSON pada Pengaturan hanya mencakup data ruang kerja jadwal. Database absensi, draf/publikasi portal, pengaturan lokasi, dan gambar di Storage harus dicadangkan terpisah.

Referensi: [Nuxt](https://nuxt.com/docs/4.x), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
