# Login awal RSUD LEWOLEBA

Login memakai **email dan kata sandi akun Supabase**. Tidak ada email/password bawaan. Source code dan SQL tidak berisi akun admin siap pakai.

## Jika sudah memiliki akun admin

Buka /masuk dan gunakan email serta kata sandi yang sebelumnya didaftarkan pada Supabase project yang sama. Ruang kerja dan data tetap tersimpan pada project tersebut. Jika masuk tetapi melihat "Menunggu akses", akun itu belum menjadi anggota fasilitas yang dipilih.

## Jika ini pemasangan pertama tanpa ruang kerja

1. Di Vercel, isi environment:
   - NUXT_PUBLIC_STORAGE_MODE = supabase
   - NUXT_PUBLIC_SUPABASE_URL = URL project Supabase
   - NUXT_PUBLIC_SUPABASE_ANON_KEY = anon/publishable key
   - NUXT_SUPABASE_SERVICE_ROLE_KEY = service-role key khusus server
2. Pada Supabase Auth, aktifkan email/password dan konfirmasi email. Isi Site URL dengan domain website. Tambahkan domain sendiri dengan path /masuk** ke Redirect URLs, agar parameter tujuan login diterima.
3. Jalankan SQL 001 → 002 → 003 → 004 pada project yang sama. Jika 001–003 sudah dijalankan, cukup jalankan 004.
4. Biarkan NUXT_PUBLIC_HOSPITAL_ID kosong hanya saat membuat fasilitas pertama. Redeploy setelah environment diisi.
5. Buka /masuk → Daftar akun. Gunakan email aktif milik Anda dan kata sandi minimal 10 karakter. Verifikasi email.
6. Masuk dengan akun tersebut. Pada halaman Aktivasi fasilitas, pilih Aktifkan fasilitas. Nama awalnya RSUD LEWOLEBA. Akun yang membuat fasilitas menjadi administrator fasilitas itu.
7. Buka Portal & lokasi RS. Salin ID fasilitas ke environment NUXT_PUBLIC_HOSPITAL_ID di Vercel, lalu redeploy.
8. Setelah ID fasilitas terpasang, akun baru menunggu admin memberikan akses. Jangan membuat fasilitas kedua untuk menggantikan fasilitas yang sebenarnya sudah ada.

## Anggota tim dan dokter

Dokter mendaftar dan memverifikasi email. Admin menambahkan email tersebut pada Pengaturan → Hak akses. Peran Pembaca cukup untuk melihat jadwal dan mencatat absensi sendiri. Pada Absensi → Akun dokter, admin menghubungkan email dengan nama dokter yang benar.

## Nama fasilitas dan publikasi

Tampilan dan ruang kerja baru memakai RSUD LEWOLEBA. Untuk data fasilitas yang sudah tersimpan, admin membuka Pengaturan → Fasilitas & pengesahan lalu Simpan pengaturan. Isi nama pengesah, NIP, dan tanggal yang benar. Terbitkan ulang informasi melalui Portal & lokasi RS agar snapshot publik juga memakai identitas terbaru.

Profil, layanan, kontak, dan berita diisi admin. Website tidak mengisi berita atau informasi RS contoh. Bagian kosong di Beranda tidak ditampilkan.

## Absensi lokasi

Admin menyimpan latitude/longitude dan radius RS melalui Portal & lokasi RS → Lokasi absensi. Tetapkan titik ketika berada di RS dan periksa pada peta. Absensi ditolak sampai titik tersimpan. Dokter scan QR fasilitas, login, izinkan lokasi presisi, lalu catat masuk/pulang. Pemeriksaan GPS dilakukan pada kedua tindakan. Uji langsung di ruangan RS sebelum dipakai rutin.

Referensi: [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

