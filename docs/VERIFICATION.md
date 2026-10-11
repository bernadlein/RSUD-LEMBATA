# Hasil pemeriksaan — 9 Oktober 2026

## Lulus

- `npm run typecheck` pada source final.
- `npm test`: 27 tes, termasuk 19 tes domain/persistence/export dan 8 tes integrasi PostgreSQL.
- `npm run build`: Nitro `node-server`.
- `NITRO_PRESET=vercel npm run build`: dua build berturut-turut setelah pemeriksaan akhir menghasilkan fungsi server dan aset Vercel dengan sukses; konfigurasi fungsi memakai `nodejs24.x`.
- Rekonsiliasi sembilan total dokter dan jumlah 1.661 jam terhadap workbook versi 4.
- Enam dokter rotasi sebulan penuh memiliki jam yang sama; dua rangkaian 12×3 bawaan dan enam pasangan kurang libur tetap terdeteksi.
- Cakupan dua layanan pada empat blok waktu dari tanggal 10 memenuhi kebutuhan awal.
- Perubahan baru yang menambah benturan, cuti, ruang anak, riwayat terkunci, atau bulan terkunci ditolak oleh kebijakan terkait.
- Test PostgreSQL menjalankan migrasi, RLS, grant RPC server, proteksi master/riwayat, stale revision, audit pelaku server, dan perlindungan admin terakhir.

## Batas verifikasi

Browser visual/manual belum dijalankan pada lingkungan pengerjaan ini. Periksa responsive layout dan hasil dialog cetak di browser target setelah menjalankan aplikasi.

Tidak ada akun/credential Supabase atau deployment GitHub/Vercel pengguna yang diisi pada proyek. Login email, callback verifikasi, endpoint dengan layanan Supabase nyata, dan koneksi deployment harus diverifikasi sesudah environment diatur. Test PostgreSQL menggunakan identitas Supabase stub dan bukan login jaringan ke project pengguna.

Output PDF dibuat melalui dialog cetak browser; pengaturan kertas dan header/footer browser dapat memengaruhi hasilnya. Semua nama dan ruang tanda tangan berasal dari konfigurasi pengguna, tanpa membuat tanda tangan palsu.
