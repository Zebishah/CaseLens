#!/usr/bin/env bash
# Sends a signed conversation.created webhook to your local server.
# Usage: ./scripts/test-webhook.sh [base_url]
# Example: ./scripts/test-webhook.sh http://localhost:3002

set -euo pipefail

BASE_URL="${1:-http://localhost:3002}"
FIXTURE="tests/fixtures/intercom/webhook.conversation.created.json"

cd "$(dirname "$0")/.."

if [[ ! -f "$FIXTURE" ]]; then
  echo "Fixture not found: $FIXTURE"
  exit 1
fi

SIG=$(node -e "
  const crypto = require('crypto');
  const fs = require('fs');
  require('dotenv').config();
  const body = fs.readFileSync('$FIXTURE');
  const secret = process.env.INTERCOM_CLIENT_SECRET;
  if (!secret) { console.error('INTERCOM_CLIENT_SECRET missing in .env'); process.exit(1); }
  process.stdout.write('sha1=' + crypto.createHmac('sha1', secret).update(body).digest('hex'));
")

echo "→ POST $BASE_URL/webhooks/intercom"
echo "→ Using fixture: $FIXTURE"
echo ""

HTTP_CODE=$(curl -s -o /tmp/webhook-response.txt -w "%{http_code}" \
  -X POST "$BASE_URL/webhooks/intercom" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature: $SIG" \
  --data-binary @"$FIXTURE")

echo "HTTP $HTTP_CODE"
if [[ -s /tmp/webhook-response.txt ]]; then
  cat /tmp/webhook-response.txt
  echo ""
fi

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✓ Webhook accepted — check server terminal for [webhook] / [conversation] / [queue] / [worker] logs"
else
  echo "✗ Webhook failed — check signature secret and that server is running"
  exit 1
fi
