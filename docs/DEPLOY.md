# Menjalankan Ruang Dinas di GitHub dan Vercel

## 1. Siapkan proyek

1. Ekstrak `Ruang_Dinas_Nuxt_Vercel.zip`.
2. Buka folder `ruang-dinas` di VS Code atau terminal. `package.json` harus berada di folder tersebut.
3. Pasang Node.js **24**, lalu jalankan:

```bash
npm ci
npm run dev
```

Untuk mencoba demo, tidak perlu membuat file `.env`. Aplikasi memakai data contoh dan menyimpan perubahan di browser.

## 2. Unggah source ke GitHub

Buat repository kosong, misalnya `ruang-dinas`. Dari folder proyek jalankan perintah berikut; ganti URL contoh dengan repository Anda.

```bash
git init
git add .
git commit -m "Build Ruang Dinas doctor scheduling application"
git branch -M main
git remote add origin https://github.com/USERNAME/ruang-dinas.git
git push -u origin main
```

Alternatifnya, unggah isi folder melalui GitHub atau GitHub Desktop. Pastikan `package.json`, `package-lock.json`, `nuxt.config.ts`, folder `app`, `server`, `supabase`, serta `.github` ikut masuk.

`node_modules`, `.nuxt`, `.output`, `.vercel`, dan `.env` sudah diabaikan oleh `.gitignore`. Berkas `Jadwal_RSUD_Lewoleba_2026-10.json` berisi data asli dan diberikan **terpisah**; gunakan untuk impor setelah aplikasi berjalan, bukan sebagai aset source publik.

## 3. Deploy demo di Vercel

1. Di Vercel, pilih **Add New → Project**.
2. Import repository GitHub tadi.
3. Gunakan konfigurasi berikut:

| Pengaturan | Nilai |
|---|---|
| Framework Preset | Nuxt.js |
| Root Directory | Folder yang memuat `package.json` |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Biarkan sesuai deteksi framework |

4. Klik **Deploy**. Environment demo boleh dikosongkan, atau set `NUXT_PUBLIC_STORAGE_MODE=demo`.
5. Buka URL hasil deployment. Ini adalah demo; perubahan tersimpan pada browser masing-masing.

GitHub menyimpan source dan menjalankan CI. Vercel membangun dan menjalankan aplikasinya. Push berikutnya ke branch terhubung akan memicu deployment sesuai konfigurasi Vercel.

## 4. Aktifkan penggunaan bersama dengan Supabase

1. Buat project Supabase.
2. Buka **SQL Editor**, salin seluruh isi `supabase/migrations/001_initial.sql`, lalu jalankan.
3. Aktifkan login email/password. Tetap gunakan konfirmasi email untuk akun baru.
4. Pada pengaturan Auth, isi **Site URL** dengan URL aplikasi Vercel. Tambahkan URL aplikasi/`masuk` pada daftar redirect yang diizinkan. Jika mencoba lokal, tambahkan `http://localhost:3000/masuk`.
5. Ambil Project URL, anon/publishable key, dan service-role key dari konfigurasi project.
6. Pada Vercel → **Project Settings → Environment Variables**, isi:

| Variabel | Isi |
|---|---|
| `NUXT_PUBLIC_STORAGE_MODE` | `supabase` |
| `NUXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Service-role key khusus server |

**Service-role key hanya untuk variabel tanpa awalan PUBLIC.** Jangan memasukkannya ke source, halaman UI, atau repository. API memverifikasi identitas dan peran sebelum menggunakan kunci server untuk transaksi tulis. Browser tidak diberi izin menjalankan RPC simpan secara langsung.

7. Redeploy aplikasi setelah environment disimpan.
8. Daftar akun admin pertama, verifikasi email, lalu masuk dan buat ruang kerja rumah sakit.
9. Buka **Pengaturan → Cadangan data**, impor berkas jadwal Oktober yang diberikan terpisah.
10. Isi NIP dan tanggal pengesahan pada **Fasilitas & pengesahan**.
11. Anggota tim mendaftar dan memverifikasi email. Admin memasukkan email mereka pada **Hak akses**, lalu memilih admin, penyusun, atau pembaca. Anggota memilih **Muat ulang akses** atau masuk kembali.

Untuk menjalankan mode Supabase secara lokal, salin `.env.example` menjadi `.env`, isi variabel, kemudian jalankan ulang `npm run dev`.

## 5. Periksa setelah deploy

1. Admin dapat mengubah master/pengaturan; pembaca hanya dapat melihat, ekspor, dan cetak.
2. Penyusun dapat mengedit tanggal terbuka dan tidak dapat mengubah tanggal riwayat atau bulan terkunci.
3. Uji satu kode dinas, pastikan total dan jam berubah sesuai kode. Kembalikan kode setelah pengujian.
4. Buka dua tab dengan revisi yang sama. Simpan tab pertama; tab kedua harus meminta muat ulang ketika menyimpan data lama.
5. Pastikan halaman **Cetak jadwal** memuat tanggal 1–31, legenda, direktur, kepala seksi, dan NIP.
6. Pada dialog cetak browser pilih **Simpan sebagai PDF**, A4, Landscape, dan nonaktifkan header/footer browser.

Migrasi dan aturan database sudah memiliki pengujian otomatis PostgreSQL embedded. Email verifikasi dan koneksi project Supabase/Vercel Anda harus diuji setelah konfigurasi akun di atas selesai.

## Berkas impor Oktober

Berkas terpisah mengikuti urutan sembilan dokter, cuti, tanggal bergabung, ruang anak, serta kode pada workbook terbaru. Riwayat 1–9 dikunci secara default dan penyesuaian dimulai tanggal 10. Benturan dari sumber tetap ditampilkan untuk ditinjau. Nama, nomor HP, dan jadwal yang terkait identitas asli tidak ditanamkan dalam demo yang dibundel.

## Referensi

- [Nuxt pada Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)
- [Node.js pada Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
