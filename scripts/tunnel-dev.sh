#!/usr/bin/env bash
# Dev tunnel for Telegram webhook testing.
# Starts a cloudflared quick tunnel and auto-registers the Telegram webhook.
# Run from host: ./scripts/tunnel-dev.sh
#
# Requires: cloudflared (apt install cloudflared), TELEGRAM_BOT_TOKEN in .env

set -euo pipefail

# Load .env from project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN not set in .env"
  exit 1
fi

LOGFILE=$(mktemp /tmp/cf-tunnel-XXXX.log)
trap 'rm -f "$LOGFILE"; kill $CF_PID 2>/dev/null' EXIT

echo "Starting cloudflared tunnel..."
cloudflared tunnel --url http://localhost:5173 --protocol http2 2>&1 | tee "$LOGFILE" &
CF_PID=$!

# Poll for the tunnel URL
TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOGFILE" 2>/dev/null | head -1 || true)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: Failed to get tunnel URL after 30 seconds"
  exit 1
fi

echo ""
echo "Tunnel: $TUNNEL_URL"
echo "Webhook: $TUNNEL_URL/api/telegram/webhook"
echo ""

# Register webhook with Telegram
RESPONSE=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${TUNNEL_URL}/api/telegram/webhook\"}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "Webhook registered successfully"
else
  echo "WARNING: Webhook registration failed: $RESPONSE"
fi

echo ""
echo "Tunnel running. Press Ctrl+C to stop."
wait $CF_PID
