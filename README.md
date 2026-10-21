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
