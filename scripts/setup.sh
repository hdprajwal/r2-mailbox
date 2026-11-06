#!/usr/bin/env bash
# r2-mailbox setup: create the bucket, add a retention rule, deploy the Worker, and
# (optionally) create the Email Routing rule that sends ADDRESS to the Worker.
#
# Usage:
#   ./scripts/setup.sh                                   # bucket + retention + deploy
#   ADDRESS=inbox@example.com ZONE_ID=... CLOUDFLARE_API_TOKEN=... ./scripts/setup.sh
#
# Env:
#   BUCKET          R2 bucket name (default r2-mailbox; must match worker/wrangler.jsonc)
#   RETENTION_DAYS  delete stored mail after N days (default 30, 0 = keep forever)
#   ADDRESS         address to route to the Worker, e.g. inbox@example.com
#   ZONE_ID         zone id of ADDRESS's domain (dashboard > domain > Overview)
#   CLOUDFLARE_API_TOKEN  API token with "Email Routing Rules: Edit" on that zone
#   CLOUDFLARE_ACCOUNT_ID needed only if your login has several accounts
set -euo pipefail

cd "$(dirname "$0")/.."
BUCKET="${BUCKET:-r2-mailbox}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
WRANGLER="${WRANGLER:-npx --yes wrangler@latest}"

if ! grep -q "\"bucket_name\": \"$BUCKET\"" worker/wrangler.jsonc; then
  echo "worker/wrangler.jsonc does not use bucket_name \"$BUCKET\". Edit it first." >&2
  exit 1
fi

echo "==> Checking Cloudflare login"
$WRANGLER whoami >/dev/null || { echo "Run: $WRANGLER login" >&2; exit 1; }

echo "==> Creating R2 bucket '$BUCKET' (skipped if it exists)"
$WRANGLER r2 bucket create "$BUCKET" 2>&1 | grep -viE "telemetry" || true

if [ "$RETENTION_DAYS" != "0" ]; then
  echo "==> Expiring stored mail after $RETENTION_DAYS days"
  $WRANGLER r2 bucket lifecycle add "$BUCKET" "expire-${RETENTION_DAYS}d" mail/ \
    --expire-days "$RETENTION_DAYS" --force 2>&1 | tail -1 || true
fi

echo "==> Deploying the Worker"
(cd worker && $WRANGLER deploy)

if [ -n "${ADDRESS:-}" ] && [ -n "${ZONE_ID:-}" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "==> Routing $ADDRESS to the Worker"
  api="https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing"
  enabled=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$api" \
    | python3 -I -c "import json,sys; print(json.load(sys.stdin)['result'].get('enabled'))" || echo "unknown")
  if [ "$enabled" != "True" ]; then
    echo "Email Routing is not enabled on this zone (got: $enabled)." >&2
    echo "Enable it once in the dashboard (Email > Email Routing), then re-run this script." >&2
    exit 1
  fi
  curl -fsS -X POST "$api/rules" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    -d "{\"name\":\"$ADDRESS -> r2-mailbox\",\"enabled\":true,
         \"matchers\":[{\"type\":\"literal\",\"field\":\"to\",\"value\":\"$ADDRESS\"}],
         \"actions\":[{\"type\":\"worker\",\"value\":[\"r2-mailbox\"]}]}" \
    | python3 -I -c "import json,sys; d=json.load(sys.stdin); print('rule created' if d['success'] else d['errors'])"
else
  cat <<EOF

==> Last step, in the dashboard (or re-run with ADDRESS, ZONE_ID, CLOUDFLARE_API_TOKEN):
    Your domain > Email > Email Routing > Routing rules > Create address
      Custom address: the address you want (e.g. inbox@yourdomain.com)
      Action: Send to a Worker -> r2-mailbox
EOF
fi

cat <<EOF

==> To read mail, create a read-only R2 key:
    R2 > Manage API tokens > Create token
      Permission: Object Read only    Bucket: $BUCKET only
    Then put the Access Key ID and Secret Access Key in ~/.config/r2-mailbox/config.json
    (see config.example.json) and run: python3 reader/mailbox.py check
EOF
