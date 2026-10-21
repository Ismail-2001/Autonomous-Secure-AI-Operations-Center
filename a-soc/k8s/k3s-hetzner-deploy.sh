#!/usr/bin/env bash
# ==============================================================================
# Hetzner Cloud k3s Production Deployment Script for A-SOC
# Optimized for Hetzner CPX31 (€13.50/mo: 4 vCPU, 8 GB RAM, 160 GB NVMe)
# ==============================================================================

set -euo pipefail

DOMAIN="${1:-asoc.example.com}"
LETSENCRYPT_EMAIL="${2:-security@example.com}"

echo "=========================================================="
echo "🚀 Deploying A-SOC on Hetzner k3s"
echo "   Domain: ${DOMAIN}"
echo "   ACME Contact: ${LETSENCRYPT_EMAIL}"
echo "=========================================================="

# 1. Verify k3s / kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "📦 Installing k3s..."
    curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
fi

# 2. Install cert-manager if not installed
if ! kubectl get namespace cert-manager &> /dev/null; then
    echo "🔒 Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
    echo "⏳ Waiting for cert-manager to be ready..."
    kubectl wait --namespace cert-manager --for=condition=ready pod --selector=app.kubernetes.io/instance=cert-manager --timeout=120s
fi

# 3. Create A-SOC Namespace
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: asoc
EOF

# 4. Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: traefik
EOF

# 5. Apply Core K8s Manifests
echo "📦 Deploying OPA Guardrails & Redis..."
kubectl apply -f k8s/opa.yaml
kubectl apply -f k8s/redis.yaml

echo "📦 Deploying Backend & Multi-Replica Worker..."
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/dashboard.yaml

# 6. Apply Ingress with customized host
echo "🌐 Configuring Ingress for ${DOMAIN}..."
sed "s/asoc.example.com/${DOMAIN}/g" k8s/ingress.yaml | kubectl apply -f -

# 7. Verification
echo "⏳ Waiting for deployments to rollout..."
kubectl rollout status deployment/asoc-backend -n asoc --timeout=180s
kubectl rollout status deployment/asoc-worker -n asoc --timeout=180s
kubectl rollout status deployment/asoc-dashboard -n asoc --timeout=180s

echo "=========================================================="
echo "✅ A-SOC Production Deployment Completed Successfully!"
echo "   Endpoint: https://${DOMAIN}"
echo "   Healthcheck: https://${DOMAIN}/health"
echo "=========================================================="
