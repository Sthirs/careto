#!/usr/bin/env bash
set -euo pipefail

telepresence leave careto-backend || true
telepresence leave careto-frontend || true
