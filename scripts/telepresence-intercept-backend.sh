#!/usr/bin/env bash
set -euo pipefail

telepresence intercept careto-backend --port 3000:3000 --mount false
