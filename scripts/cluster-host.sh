#!/usr/bin/env bash
set -euo pipefail

if [ -n "${CARETO_CLUSTER_HOST:-}" ]; then
  printf '%s\n' "$CARETO_CLUSTER_HOST"
  exit 0
fi

printf 'careto.%s.nip.io\n' "$(minikube ip)"
