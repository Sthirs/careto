#!/usr/bin/env bash
set -euo pipefail

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi

# Node version comes from .nvmrc (kept current by Renovate)
cd "$(dirname "$0")/.."
nvm install >/dev/null
nvm use >/dev/null
npm ci
