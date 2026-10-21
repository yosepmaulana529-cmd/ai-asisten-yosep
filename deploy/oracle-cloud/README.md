# Hermes AI Yosep — deploy gratis ke Oracle Cloud

Panduan ini menyiapkan portal web dan Hermes Agent pada satu VM Ubuntu. Ini **belum berarti aplikasi sudah online**: akun Oracle, VM, DNS, aturan jaringan, dan provider model harus tersedia lebih dulu.

## Jalur gratis yang disarankan

1. Buat satu akun Oracle Cloud Free Tier di https://www.oracle.com/cloud/free/ . Gunakan data dan metode verifikasi milik sendiri yang valid. Jangan buat akun ganda.
2. Buat VM Ubuntu yang berlabel **Always Free Eligible** di home region. Jika kapasitas habis, coba availability domain lain atau tunggu. Jangan memilih resource berbayar.
3. Catat public IPv4 VM. Di Virtual Cloud Network/security list atau Network Security Group, izinkan inbound TCP 22 (batasi ke IP sendiri jika memungkinkan), TCP 80, dan TCP 443.
4. Gunakan domain/subdomain yang bisa diarahkan ke IP VM (misalnya subdomain gratis dari penyedia DNS dinamis), lalu buat DNS A record yang menunjuk ke public IPv4. Caddy akan mengurus sertifikat HTTPS.
5. Masuk ke VM melalui SSH, unggah folder ini atau ambil skrip dari repository, lalu jalankan sebagai root:
   `bash bootstrap.sh ai-domain-anda.example nama@email-anda.com`
   Ganti contoh domain dengan domain/subdomain yang benar-benar Anda miliki.
6. Setelah skrip selesai, konfigurasi provider model untuk Hermes:
   `sudo -u hermesapp -H bash -lc 'hermes setup'`
   Pilih provider yang memang sudah memiliki akses. Provider gratis biasanya memiliki kuota/limit; jangan menganggap pemakaian tanpa batas.
7. Buka `https://domain-anda`, buat akun dengan email yang sama persis dengan OWNER_EMAIL agar akun pertama pemilik mendapat peran admin. Uji login dan chat.

## Apa yang disiapkan skrip

- Menginstal paket dasar Ubuntu, Caddy, dan Hermes Agent resmi.
- Mengunduh repository proyek ini.
- Menjalankan Hermes Gateway dan portal sebagai service systemd yang otomatis start saat reboot.
- Membuat API key acak, menyimpan rahasia di file environment server, dan mengarahkan HTTPS ke portal.
- Menyimpan database portal di `/var/lib/hermes-yosep`.

## Penting

- Saya tidak bisa membuat/menyetujui akun Oracle, menyelesaikan OTP/identitas, mengonfigurasi kartu, membuat VM di akun pribadi, atau mengatur DNS milik Anda dari repository ini. Jangan kirim password, OTP, private key SSH, atau API key ke chat.
- Oracle Always Free memiliki batas kapasitas, dan Oracle dapat mengambil kembali instance yang dinilai idle menurut kebijakannya. Free tier tidak memberikan SLA 24/7.
- VM perlu DNS dan port 80/443 terbuka agar HTTPS aktif. Tanpa domain/DNS yang valid, cookie login portal yang aman tidak akan berfungsi dengan baik.
- Hermes memerlukan provider/model dan tool backend yang dikonfigurasi. Skrip tidak menciptakan akses model gratis tanpa batas.
- Portal ini versi awal: sebelum mengundang publik, tambahkan pemulihan akun, verifikasi email, rate limiting lebih kuat, backup, kebijakan privasi, dan pengujian keamanan.
- Jangan menaruh API key Hermes pada browser atau APK. Jangan membuka port 8642 ke internet; skrip mengikatnya ke localhost.
- Status service:
  `systemctl status hermes-yosep-agent hermes-yosep-portal caddy`
  Log:
  `journalctl -u hermes-yosep-agent -u hermes-yosep-portal -f`
