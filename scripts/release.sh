#!/usr/bin/env bash
# Publishes marko-zag to npm.
#
# Primary release path is now CI: .github/workflows/release.yml
# (workflow_dispatch, npm OIDC trusted publishing, no token needed).
# This script is the local fallback for when CI publishing isn't available.
#
# Auth, tried in order:
#   1. NPM_TOKEN already in the environment (granular automation token —
#      no OTP needed).
#   2. NPM_TOKEN from a .env file at the hyperspace root (local-only,
#      never committed).
#   3. Fall back to the 1Password item "npm" (username + password + TOTP):
#      mint a short-lived session token via the registry's login endpoint,
#      publish with it (plus a fresh OTP for the 2FA-on-publish check), then
#      revoke the token again. Requires the `op` CLI, desktop-app
#      integration unlocked.
#
#   bun run release            # verify + publish
#   bun run release --dry-run  # verify + pack preview, no upload
#
# RELEASE_DRY_RUN=1 prints the chosen auth path and exits before any
# type-check/test/publish work — for testing the auth selection itself.
set -euo pipefail
cd "$(dirname "$0")/.."

OP_ITEM="${NPM_OP_ITEM:-npm}"
REGISTRY="https://registry.npmjs.org"

resolve_npm_auth() {
  if [ -n "${NPM_TOKEN:-}" ]; then
    echo "token-from-env"
    return
  fi

  local space_root env_file
  space_root="$(dirname "$(git rev-parse --git-common-dir)")"
  env_file="$space_root/.env"
  if [ -f "$env_file" ]; then
    local line
    line="$(grep '^NPM_TOKEN=' "$env_file" || true)"
    if [ -n "$line" ]; then
      NPM_TOKEN="${line#NPM_TOKEN=}"
      export NPM_TOKEN
      echo "token-from-.env"
      return
    fi
  fi

  echo "op"
}

NPM_AUTH_PATH="$(resolve_npm_auth)"
echo "» npm auth: $NPM_AUTH_PATH" >&2

if [ -n "${RELEASE_DRY_RUN:-}" ]; then
  echo "$NPM_AUTH_PATH"
  exit 0
fi

echo "» type check"
bun run check
echo "» tests"
bun run test

echo "» publishing $(bun -e 'const p=require("./package.json");console.log(`${p.name}@${p.version}`)')"

if [ "$NPM_AUTH_PATH" != "op" ]; then
  export NPM_CONFIG_TOKEN="$NPM_TOKEN"
  bun publish --access public "$@"
  exit 0
fi

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

bun publish --access public --auth-type legacy --otp "$(op item get "$OP_ITEM" --otp)" "$@"
