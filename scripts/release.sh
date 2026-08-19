#!/usr/bin/env bash
# Publishes marko-zag to npm using the 1Password item "npm"
# (username + password + TOTP) — no long-lived publish token needed.
#
# Flow: mint a short-lived session token via the registry's login endpoint,
# publish with it (plus a fresh OTP for the 2FA-on-publish check), then
# revoke the token again.
#
# Requirements: `op` CLI with the 1Password desktop-app integration unlocked.
#   bun run release            # verify + publish
#   bun run release --dry-run  # verify + pack preview, no upload
set -euo pipefail
cd "$(dirname "$0")/.."

OP_ITEM="${NPM_OP_ITEM:-npm}"
REGISTRY="https://registry.npmjs.org"

echo "» type check"
bun run check
echo "» tests"
bun run test

echo "» reading npm credentials from 1Password (item: $OP_ITEM)"
NPM_USER="$(op item get "$OP_ITEM" --fields username)"
NPM_PASS="$(op item get "$OP_ITEM" --fields password --reveal)"

echo "» minting session token"
LOGIN_RESPONSE="$(curl -sS -X PUT "$REGISTRY/-/user/org.couchdb.user:$NPM_USER" \
  -H "content-type: application/json" \
  -H "npm-otp: $(op item get "$OP_ITEM" --otp)" \
  -d "{\"name\":\"$NPM_USER\",\"password\":$(printf '%s' "$NPM_PASS" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}")"
NPM_CONFIG_TOKEN="$(printf '%s' "$LOGIN_RESPONSE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')" || {
  echo "login failed: $LOGIN_RESPONSE" >&2
  exit 1
}
export NPM_CONFIG_TOKEN

revoke_token() {
  # best-effort: a session token left behind is still a credential
  curl -sS -X DELETE "$REGISTRY/-/user/token/$NPM_CONFIG_TOKEN" \
    -H "authorization: Bearer $NPM_CONFIG_TOKEN" \
    -H "npm-otp: $(op item get "$OP_ITEM" --otp)" >/dev/null || true
}
trap revoke_token EXIT

echo "» publishing $(bun -e 'const p=require("./package.json");console.log(`${p.name}@${p.version}`)')"
bun publish --access public --auth-type legacy --otp "$(op item get "$OP_ITEM" --otp)" "$@"
