# Ruang Dinas

Aplikasi manajemen jadwal dokter berbasis **Nuxt 4, Tailwind CSS 4, dan TypeScript**. Tampilan menggunakan turquoise dan hijau terang yang terinspirasi Kemenkes, font Inter yang disimpan bersama aplikasi, dan ikon garis tanpa emoji.

## Mulai cepat

Gunakan Node.js **24** dan npm. Ekstrak ZIP, lalu buka terminal di folder yang berisi `package.json`.

```bash
npm ci
npm run dev
```

Buka alamat lokal yang ditampilkan terminal. Tanpa environment tambahan, aplikasi berjalan dalam **mode demo lokal**. Data contoh menggunakan nama Dokter 01–09; perubahan disimpan pada browser tersebut.

Untuk memakai jadwal asli Oktober, buka **Pengaturan → Cadangan data → Pilih berkas JSON**, pilih berkas `Jadwal_RSUD_Lewoleba_2026-10.json` yang diberikan terpisah, lalu konfirmasi impor. Berkas data asli tidak dimasukkan ke source code atau aset publik.

Panduan unggah GitHub dan deploy Vercel tersedia di **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Fitur

| Halaman | Fungsi |
|---|---|
| Ringkasan | Total jam, perbandingan dokter, catatan pola, dan legenda jam |
| Jadwal bulanan | Isian kode, tampilan kode/jam/keduanya, pencarian, filter layanan, bulan baru/salin, kunci bulan dan tanggal |
| Rekap jam kerja | Dinas, jam, libur, cuti, belum mulai, pemerataan berdasarkan ketersediaan, saran pertukaran yang ditinjau sebelum diterapkan |
| Kode & jam dinas | Master kode, jam khusus, template A/B/8 jam, snapshot jam per bulan |
| Daftar dokter | Identitas, ruang anak, tanggal bergabung, cuti, status aktif |
| Cetak jadwal | Dokumen A4 landscape dengan jam dinas, nama pengesah, NIP, dan ruang tanda tangan; simpan PDF melalui dialog browser |
| Pengaturan | Fasilitas, aturan, periode, batas bulan, impor/cadangan JSON, audit perubahan, pengguna dan peran |

CSV UTF-8 dapat dibuka di Excel atau Google Sheets. Impor JSON adalah format cadangan aplikasi; impor langsung XLSX belum disediakan.

## Logika jadwal

- Durasi dihitung dari jam mulai/selesai, termasuk dinas yang melewati tengah malam. `24 JAM` memiliki durasi manual karena waktu sumbernya belum diketahui.
- L, C, dan BM masing-masing 0 jam. Isian kosong tetap ditandai belum lengkap. Kode tidak dikenal menghasilkan status tidak valid, bukan 0 jam.
- Tanggal dinas adalah **tanggal mulai**. Pergantian periode penyesuaian tidak menghapus dinas pada hari sebelumnya.
- Pemeriksaan meliputi dinas panjang berurutan, dua hari tanpa dinas setelah dua dinas panjang, jeda antar dinas, cuti/tanggal mulai, pembatasan ruang anak, dan cakupan IGD/ruangan.
- Kebutuhan cakupan awal ialah satu dokter per layanan dan blok waktu. Ini mengikuti asumsi pada workbook; admin dapat mengubah kebutuhan.
- Aturan awal: maksimal dua dinas ≥12 jam berurutan, dua hari tanpa dinas setelahnya, dan jeda 11 jam. Nilai ini adalah aturan penyusunan dari proyek, bukan penetapan standar klinis atau ketenagakerjaan.
- Saran pemerataan mencari **satu pertukaran** pada kelompok rotasi sebulan penuh. Saran menjaga jumlah petugas per unit karena hanya menukar dua penugasan pada tanggal yang sama. Ini bukan generator roster optimal untuk seluruh bulan.
- Jam master disalin ke `shiftSnapshot` saat membuat bulan. Mengubah master tidak mengubah jam historis; admin harus memilih **Perbarui bulan ini** untuk menerapkannya ke bulan yang terbuka.
- Kode batas bulan memakai snapshot bulan tetangga jika jadwalnya tersedia. Bila belum tersedia, input manual memakai jam bulan yang sedang diperiksa. Isi data bulan tetangga jika jamnya berbeda.

## Arsitektur

| Folder | Tanggung jawab |
|---|---|
| `app/domain/` | Model, kontrak Zod, kalender, durasi, rekap, pemeriksaan, perintah perubahan, izin, saran pertukaran |
| `app/repositories/` | Kontrak penyimpanan dan adapter browser/Supabase |
| `app/composables/` | State aplikasi, orkestrasi simpan/muat, notifikasi |
| `app/components/`, `app/pages/` | Tampilan, input, navigasi dan penyajian hasil domain |
| `app/services/`, `app/workers/` | Ekspor dan perhitungan saran di background worker |
| `server/api/` | Verifikasi sesi, pemeriksaan izin dan aturan domain sebelum penyimpanan bersama |
| `supabase/migrations/` | PostgreSQL, RLS, transaksi simpan, version guard, dan audit server |
| `tests/` | Rekonsiliasi sumber, aturan, izin, konflik simpan, dan integrasi SQL PostgreSQL |

Komponen UI tidak menghitung ulang aturan bisnis sendiri. Backend memakai modul domain yang sama dengan frontend. Database menegakkan hak akses, kunci, transaksi, dan revisi secara independen.

Mode Supabase menyimpan satu aggregate JSON per ruang kerja dengan revisi transaksional. Untuk lingkup awal sembilan dokter, model ini menjaga seluruh perubahan roster tetap atomik. Batas satu permintaan/cadangan adalah 2 MB dan maksimum 100 dokter/kode. Bila berkembang menjadi banyak fasilitas atau data bertahun-tahun dalam volume besar, pecah penyimpanan per bulan atau normalisasi tabel melalui adapter repository; kontrak domain dan UI dapat dipertahankan. Versi ini mendukung satu ruang kerja per akun.

## Penyimpanan dan akses

| Mode | Perilaku |
|---|---|
| Demo | Penyimpanan browser, tanpa login; peran admin demo. Tidak berbagi data antarbrowser. |
| Supabase | Akun email/password, data bersama PostgreSQL, admin/planner/viewer, RLS, validasi server, optimistic concurrency, dan audit server. |

Kunci pada mode demo adalah kontrol pengeditan di aplikasi. Penggunaan bersama memakai Supabase agar izin juga diterapkan oleh server/database. Akun pembaca dapat melihat, mengekspor, dan mencetak data ruang kerjanya. Nomor HP tidak dimasukkan ke dokumen cetak; berkas cadangan tetap memuat data ruang kerja.

Pengguna kedua mendaftar dan memverifikasi email, kemudian admin menambahkan email tersebut pada **Pengaturan → Hak akses**. Aplikasi tidak mengirim undangan khusus. Admin terakhir tidak dapat dihapus atau diturunkan perannya.

## Pemeriksaan

```bash
npm run typecheck
npm test
npm run build
```

Test database memakai PGlite, yaitu PostgreSQL embedded dengan stub tabel/identitas Supabase. Test tersebut menjalankan migrasi dan memeriksa RLS, izin RPC, metadata, kunci, revision conflict, dan admin terakhir. Akun email, konfigurasi hosting, serta koneksi Supabase milik pengguna tetap perlu diperiksa setelah konfigurasi deployment.

CI GitHub menjalankan typecheck, test, dan build pada setiap push ke `main` serta pull request. Semua versi package dikunci dalam `package-lock.json`. TypeScript dipatok ke 5.9.3 agar cocok dengan `vue-tsc` yang digunakan.

Lihat **[docs/MAINTENANCE.md](docs/MAINTENANCE.md)** untuk pedoman penambahan fitur dan perubahan skema.

## Referensi resmi

- [Nuxt 4](https://nuxt.com/docs/4.x)
- [Tailwind pada Nuxt](https://tailwindcss.com/docs/installation/framework-guides/nuxt)
- [Nuxt pada Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Identitas warna Kemenkes](https://kemkes.go.id/id/filosofi-logo/)
