# AI Asisten Yosep

Proyek awal aplikasi Android berbasis WebView. GitHub Actions membangun APK debug dan menyimpan hasilnya sebagai artifact.

## Cara mendapatkan APK
1. Buka tab Actions.
2. Pilih workflow **Build AI Asisten Yosep APK**.
3. Setelah run sukses, buka hasilnya dan unduh artifact **AI-Asisten-Yosep-APK**. Ekstrak ZIP untuk mendapatkan `app-debug.apk`.

## Koneksi AI
Aplikasi membutuhkan API key dari penyedia API kompatibel OpenAI. Isi pengaturan koneksi di aplikasi. Model gratis dan kuota mengikuti penyedia; jangan menyimpan API key di repositori publik.

## Batasan
Ini APK debug awal, belum aplikasi rilis Play Store. Belum mengotomatisasi Facebook, membuat gambar/video secara native, atau menjalankan tugas latar belakang. API key tersimpan lokal di WebView; untuk produksi diperlukan backend yang aman.


## Hermes AI Yosep — portal web multi-user

Portal baru ada di folder [hermes-web](hermes-web/README.md). Kode portal sudah lulus pemeriksaan GitHub Actions: [lihat workflow](https://github.com/yosepmaulana529-cmd/ai-asisten-yosep/actions/workflows/check-hermes-web.yml). Blueprint hosting tersedia di [render.yaml](render.yaml).

**Status penting:** file portal dan konfigurasi deploy sudah masuk repository, tetapi portal belum otomatis live dan belum bisa menjawab sampai di-deploy ke akun hosting dan dihubungkan ke server Hermes Agent yang aktif. Hosting/model dapat memiliki batas atau biaya. Database SQLite pada hosting sementara tidak cocok untuk layanan produksi karena penyimpanan dapat hilang saat redeploy; sebelum dibuka untuk banyak pengguna, pasang database persisten, verifikasi email, pemulihan kata sandi, dan kebijakan privasi.

Dokumentasi resmi Hermes: https://hermes-agent.nousresearch.com/docs/ — API server: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/
