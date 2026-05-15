#!/usr/bin/env bash
# Setup de segurança — rode UMA VEZ no repositório
# Leia este script antes de executar (o próprio princípio da skill)

set -euo pipefail

echo "=== Setup de segurança rifa-app ==="

# ── 1. Instalar gitleaks via pré-commit hook ──────────────────────────────────
if ! command -v gitleaks &>/dev/null; then
  echo "[INFO] gitleaks não encontrado. Tentando instalar..."
  if command -v brew &>/dev/null; then
    brew install gitleaks
  elif command -v apt-get &>/dev/null; then
    GITLEAKS_VERSION="8.18.4"
    curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
      | tar -xz -C /tmp gitleaks
    sudo mv /tmp/gitleaks /usr/local/bin/gitleaks
    chmod +x /usr/local/bin/gitleaks
  else
    echo "[WARN] Instale gitleaks manualmente: https://github.com/gitleaks/gitleaks"
  fi
fi

# ── 2. Criar pre-commit hook ──────────────────────────────────────────────────
HOOK_FILE=".git/hooks/pre-commit"
mkdir -p .git/hooks

cat > "$HOOK_FILE" <<'HOOK'
#!/usr/bin/env bash
set -e

# Bloqueia commits com segredos detectados pelo gitleaks
if command -v gitleaks &>/dev/null; then
  gitleaks protect --staged --no-banner -q || {
    echo ""
    echo "❌ COMMIT BLOQUEADO: gitleaks detectou possível segredo no diff."
    echo "   Remova o segredo antes de commitar."
    echo "   Para bypass TEMPORÁRIO (emergência): git commit --no-verify"
    echo ""
    exit 1
  }
fi

# Garante que .env não está sendo commitado
if git diff --cached --name-only | grep -qE '^\.env($|\.[^e])'; then
  echo ""
  echo "❌ COMMIT BLOQUEADO: arquivo .env detectado no staging."
  echo "   Use .env.example para valores de exemplo sem segredos reais."
  echo ""
  exit 1
fi
HOOK

chmod +x "$HOOK_FILE"
echo "[OK] pre-commit hook instalado em $HOOK_FILE"

# ── 3. Verificar .gitignore ───────────────────────────────────────────────────
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo "[WARN] .gitignore não contém .env — adicione manualmente."
fi

# ── 4. Verificar variáveis de ambiente ───────────────────────────────────────
echo ""
echo "=== Checklist de variáveis de ambiente ==="
for VAR in JWT_SECRET ADMIN_PASSWORD_HASH UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN PIX_KEY; do
  if [ -z "${!VAR:-}" ]; then
    echo "[FALTA] $VAR"
  else
    echo "[OK]    $VAR"
  fi
done

echo ""
echo "=== Setup concluído ==="
echo "Próximo passo: verifique .env.example e configure .env com valores reais."
