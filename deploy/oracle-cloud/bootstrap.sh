#!/usr/bin/env bash
set -euo pipefail

# Run on a fresh Ubuntu 22.04/24.04 Oracle Cloud VM as root.
# Usage: bash bootstrap.sh your-domain.example.com owner@email.com
DOMAIN="${1:-}"
OWNER_EMAIL="${2:-}"
if [[ -z "$DOMAIN" || -z "$OWNER_EMAIL" ]]; then
  echo "Usage: bash bootstrap.sh your-domain.example.com owner@email.com"
  exit 2
fi
if [[ "$DOMAIN" == *"example.com"* ]]; then echo "Ganti dengan domain/subdomain milikmu."; exit 2; fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git python3 python3-venv python3-pip openssl caddy

if ! id hermesapp >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash hermesapp
fi
mkdir -p /opt/ai-asisten-yosep /var/lib/hermes-yosep
chown -R hermesapp:hermesapp /opt/ai-asisten-yosep /var/lib/hermes-yosep

if [[ ! -d /opt/ai-asisten-yosep/.git ]]; then
  sudo -u hermesapp git clone https://github.com/yosepmaulana529-cmd/ai-asisten-yosep.git /opt/ai-asisten-yosep
else
  sudo -u hermesapp git -C /opt/ai-asisten-yosep pull --ff-only
fi

# Install the official Hermes Agent CLI for the dedicated service user.
sudo -u hermesapp -H bash -lc 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --non-interactive'

HERMES_HOME="/home/hermesapp/.hermes"
mkdir -p "$HERMES_HOME"
chmod 700 "$HERMES_HOME"
API_KEY="$(openssl rand -hex 32)"
PORTAL_SECRET="$(openssl rand -hex 32)"

# Preserve an existing provider configuration; only write the API gateway settings.
ENV_FILE="$HERMES_HOME/.env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
for key in API_SERVER_ENABLED API_SERVER_HOST API_SERVER_PORT API_SERVER_KEY; do
  sed -i "/^${key}=/d" "$ENV_FILE"
done
cat >> "$ENV_FILE" <<EOF
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=$API_KEY
EOF
chown hermesapp:hermesapp "$ENV_FILE"

cat > /etc/hermes-yosep-portal.env <<EOF
SECRET_KEY=$PORTAL_SECRET
OWNER_EMAIL=$OWNER_EMAIL
HERMES_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=$API_KEY
DAILY_MESSAGE_LIMIT=50
DATABASE_PATH=/var/lib/hermes-yosep/data.sqlite3
EOF
chmod 600 /etc/hermes-yosep-portal.env
chown root:root /etc/hermes-yosep-portal.env

python3 -m venv /opt/ai-asisten-yosep/hermes-web/.venv
/opt/ai-asisten-yosep/hermes-web/.venv/bin/pip install --upgrade pip
/opt/ai-asisten-yosep/hermes-web/.venv/bin/pip install -r /opt/ai-asisten-yosep/hermes-web/requirements.txt
chown -R hermesapp:hermesapp /opt/ai-asisten-yosep /var/lib/hermes-yosep

cat > /etc/systemd/system/hermes-yosep-agent.service <<'EOF'
[Unit]
Description=Hermes AI Yosep Agent API
After=network-online.target
Wants=network-online.target
[Service]
User=hermesapp
Group=hermesapp
WorkingDirectory=/home/hermesapp
Environment=HOME=/home/hermesapp
Environment=PATH=/home/hermesapp/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/hermesapp/.local/bin/hermes gateway
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/hermes-yosep-portal.service <<'EOF'
[Unit]
Description=Hermes AI Yosep Multi-user Web Portal
After=network-online.target hermes-yosep-agent.service
Wants=network-online.target
[Service]
User=hermesapp
Group=hermesapp
WorkingDirectory=/opt/ai-asisten-yosep/hermes-web
EnvironmentFile=/etc/hermes-yosep-portal.env
ExecStart=/opt/ai-asisten-yosep/hermes-web/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8000
}
EOF

systemctl daemon-reload
systemctl enable --now hermes-yosep-agent.service hermes-yosep-portal.service
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

echo
echo "Instalasi awal selesai. Portal: https://$DOMAIN"
echo "PENTING: pastikan DNS A record domain menunjuk ke IP VM dan OCI ingress TCP 80/443 terbuka."
echo "PENTING: Hermes belum bisa menjawab sampai provider/model AI dikonfigurasi."
echo "Setelah login SSH, jalankan: sudo -u hermesapp -H bash -lc 'hermes setup'"
echo "Lalu ikuti wizard untuk memilih provider/model dan masukkan kredensial provider di terminal."
echo "Jangan bagikan file /etc/hermes-yosep-portal.env atau /home/hermesapp/.hermes/.env."
