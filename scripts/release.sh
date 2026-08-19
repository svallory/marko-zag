#!/usr/bin/env bash
# Publishes marko-zag to npm with the token fetched from 1Password.
#
# Requirements:
#   - `op` CLI with the 1Password desktop-app integration unlocked
#   - the npm automation token stored in 1Password
#
# Point NPM_TOKEN_OP_REF at your item (defaults below), then:
#   bun run release            # verify + publish
#   bun run release --dry-run  # verify + pack preview, no upload
set -euo pipefail
cd "$(dirname "$0")/.."

OP_REF="${NPM_TOKEN_OP_REF:-op://Private/npm-publish-token/credential}"

echo "» type check"
bun run check
echo "» tests"
bun run test

echo "» reading npm token from 1Password ($OP_REF)"
NPM_CONFIG_TOKEN="$(op read "$OP_REF")"
export NPM_CONFIG_TOKEN

echo "» publishing $(bun -e 'const p=require("./package.json");console.log(`${p.name}@${p.version}`)')"
bun publish --access public "$@"
