# Pedoman maintenance

## Tambahkan aturan di domain

Perhitungan dan validasi berada di `app/domain`, bukan dalam template Vue. Tambahkan fungsi atau perintah domain, uji dengan kasus nyata, lalu panggil dari composable. UI cukup menerima data turunan dan mengirim perintah.

Server `PUT /api/workspace` memakai kontrak Zod dan kebijakan domain yang sama. Aturan pengeditan otomatis memblokir benturan baru, sambil mempertahankan data lama yang diimpor untuk ditinjau. Perubahan administrasi hanya diizinkan bagi admin dan tetap diaudit.

Jika menambah jenis perubahan, periksa ketiga lapisan: domain, endpoint, dan izin database. Jangan mengandalkan menyembunyikan tombol sebagai kontrol akses.

## Snapshot bulan

`shiftSnapshot` menyimpan definisi jam pada bulan tersebut. Simpan code ID stabil. Jangan memperbarui seluruh snapshot lama saat mengubah master. Bulan terkunci harus dibuka secara eksplisit sebelum jamnya diperbarui.

Aturan pemeriksaan menggunakan konfigurasi operasional ruang kerja saat ini. Nama dan NIP pengesah juga memakai konfigurasi fasilitas saat cetak. Untuk arsip pengesahan yang tidak boleh berubah, simpan PDF final di arsip institusi; versi berikutnya dapat menambahkan snapshot dokumen dan alur persetujuan.

## Penyimpanan

Implementasikan `WorkspaceRepository` untuk mengganti backend. Frontend tidak menulis ke database secara langsung pada mode bersama. Pertahankan revision guard, transaksi atomik, dan audit server ketika memecah aggregate menjadi tabel/record per bulan.

Pada versi ini data maksimum 2 MB per dokumen. Untuk banyak fasilitas, tambahkan pemilih workspace dan ubah onboarding satu-workspace-per-akun sebelum memperluas deployment. Untuk roster besar, pindahkan pencarian pertukaran ke job server; worker browser saat ini menjaga UI tetap responsif selama pencarian.

## Dependency dan CI

Gunakan `npm ci` untuk instalasi reproducible. Commit `package-lock.json`. Update dependency melalui branch terpisah dan jalankan typecheck, tests, dan build. Node.js mengikuti `.nvmrc` dan `engines` 24.x.

Saat dibuat, TypeScript terbaru 7 tidak cocok dengan jalur `vue-tsc` yang dipakai. Karena itu TypeScript dipatok ke 5.9.3; naikkan setelah dukungan upstream terverifikasi.

`prebuild` membersihkan `.output` dan `.vercel/output` sebelum membangun. Ini menangani symlink route lama pada preset Nitro Vercel ketika build diulang. Konfigurasi project Vercel dan cache dependency tetap dipertahankan.

Runtime fungsi Vercel dipatok ke `nodejs24.x` pada konfigurasi Nitro agar sesuai dengan versi Node untuk build dan CI. Jangan hanya mengubah `engines` ketika memperbarui runtime.

## Migrasi database

Tambahkan file baru bernomor urut pada `supabase/migrations`. Jangan mengubah migrasi yang sudah dijalankan pada produksi. Test `database.test.ts` menjalankan migrasi PostgreSQL embedded dengan identitas Supabase stub; tambahkan seluruh migrasi baru ke setup test ketika membuatnya.

RPC simpan hanya dapat dieksekusi service-role. Endpoint memverifikasi JWT dengan Supabase dan membaca membership melalui RLS terlebih dahulu. Jangan memberikan kembali izin RPC simpan ke `authenticated`; hal tersebut akan melewati validasi domain endpoint.

## Cakupan versi ini

Sudah tersedia editor, rekap, saran satu pertukaran, cuti, kode fleksibel, kunci, login/peran, backup JSON, CSV, dan cetak PDF melalui browser.

Belum tersedia generator optimal jadwal sebulan, impor langsung XLSX, tanda tangan elektronik, login SSO, reset password melalui UI, realtime push, atau approval bertingkat. Session/password recovery dapat dikonfigurasi melalui Supabase dan dikembangkan sebagai halaman tersendiri. PDF menyediakan ruang untuk tanda tangan, bukan tanda tangan digital tersertifikasi.
