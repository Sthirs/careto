#!/usr/bin/env bash
set -euo pipefail

echo "=== Building backend image ==="
minikube image build -f apps/backend/Dockerfile -t careto/backend:dev .

echo "=== Building frontend image ==="
minikube image build -f apps/frontend/Dockerfile -t careto/frontend:dev .
