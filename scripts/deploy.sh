#!/usr/bin/env bash
set -euo pipefail

DEV_HOST="${CARETO_DEV_HOST:-careto.$(minikube ip).nip.io}"

helm upgrade --install careto ./helm/careto \
  --namespace careto \
  --create-namespace \
  --wait \
  --set devMode.enabled=true \
  --set dex.enabled=true \
  --set ingress.host="$DEV_HOST" \
  --set backend.env.CORS_ORIGIN="http://$DEV_HOST"
