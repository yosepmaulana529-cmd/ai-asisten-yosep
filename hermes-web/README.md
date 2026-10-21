# Hermes AI Yosep — portal web

Portal multi-user untuk Hermes Agent. Portal ini mengelola akun, sesi chat, dan meneruskan permintaan ke Hermes API yang dikonfigurasi di server. Ini bukan server Hermes itu sendiri.

Dokumentasi resmi Hermes API: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/

## Deploy
Buat Web Service dari repo ini dengan Root Directory `hermes-web`, Build Command `pip install -r requirements.txt`, dan Start Command `uvicorn app:app --host 0.0.0.0 --port $PORT`.

Atur environment variables `SECRET_KEY` (acak, minimal 32 karakter), `OWNER_EMAIL`, `HERMES_BASE_URL` (URL server Hermes tanpa `/v1`), `HERMES_API_KEY` (API key Hermes), dan `DAILY_MESSAGE_LIMIT` (default 50). Jangan taruh API key di browser atau APK.

Server Hermes harus dikonfigurasi dan dijalankan terpisah dengan autentikasi yang kuat. Hosting/model/tools mungkin berbayar atau memiliki kuota; tidak ada jaminan gratis tanpa batas. Sebelum membuka layanan publik, aktifkan HTTPS, backup database, pemulihan kata sandi dan verifikasi email.