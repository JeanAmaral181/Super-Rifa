#!/usr/bin/env bash
# Auditoria de segurança — rode toda sexta ou antes de deploy
# Tempo: ~30s

set -euo pipefail

PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
info() { echo "  ℹ️  $1"; }
section() { echo ""; echo "── $1 ──────────────────────────────"; }

echo "=== Auditoria de Segurança — $(date '+%Y-%m-%d %H:%M') ==="

# ── 1. npm audit ──────────────────────────────────────────────────────────────
section "Dependências (npm audit)"
HIGH=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo 0)
CRIT=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo 0)
if [ "$CRIT" -gt 0 ]; then
  fail "$CRIT vulnerabilidade(s) CRÍTICA(S) encontrada(s). Rode: npm audit fix"
elif [ "$HIGH" -gt 0 ]; then
  fail "$HIGH vulnerabilidade(s) ALTA(S) encontrada(s). Rode: npm audit fix"
else
  ok "Sem vulnerabilidades críticas ou altas"
fi

# ── 2. Segredos no git history ────────────────────────────────────────────────
section "Segredos no histórico git"
if command -v gitleaks &>/dev/null; then
  if gitleaks detect --no-banner -q 2>/dev/null; then
    ok "Nenhum segredo detectado no histórico"
  else
    fail "gitleaks encontrou possíveis segredos no histórico git"
    info "Rode: gitleaks detect --verbose para ver detalhes"
  fi
else
  info "gitleaks não instalado — rode scripts/setup-security.sh primeiro"
fi

# ── 3. Arquivos .env escapando do .gitignore ──────────────────────────────────
section "Arquivos .env"
TRACKED=$(git ls-files | grep -E '\.env$|\.env\.' | grep -v '\.env\.example' || true)
if [ -n "$TRACKED" ]; then
  fail "Arquivo .env rastreado pelo git: $TRACKED"
else
  ok ".env não rastreado pelo git"
fi

if git log --oneline --all -- '.env' 2>/dev/null | grep -q '.'; then
  fail ".env aparece no histórico de commits — considere revogar segredos"
else
  ok ".env nunca commitado"
fi

# ── 4. Variáveis NEXT_PUBLIC_ suspeitas ──────────────────────────────────────
section "Variáveis NEXT_PUBLIC_ (expostas ao browser)"
DANGEROUS_PUBLIC=$(grep -r "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | \
  xargs grep -l "NEXT_PUBLIC_\(JWT\|SECRET\|KEY\|HASH\|TOKEN\|PASSWORD\|ADMIN\)" 2>/dev/null || true)
if [ -n "$DANGEROUS_PUBLIC" ]; then
  fail "Variável sensível com prefixo NEXT_PUBLIC_: $DANGEROUS_PUBLIC"
else
  ok "Nenhuma variável sensível exposta via NEXT_PUBLIC_"
fi

# ── 5. console.log de objetos request/headers ─────────────────────────────────
section "Logs que podem vazar dados sensíveis"
LEAKY_LOGS=$(grep -rn "console\.log(req" src/app/api/ --include="*.ts" 2>/dev/null || true)
if [ -n "$LEAKY_LOGS" ]; then
  fail "console.log de objeto request encontrado (pode vazar Authorization/cookies):"
  echo "$LEAKY_LOGS"
else
  ok "Nenhum console.log de request detectado"
fi

# ── 6. Middleware de autenticação ────────────────────────────────────────────
section "Middleware de autenticação"

# Detecta arquivos que PARECEM middleware mas têm nome errado — Next.js os ignora
WRONG_MIDDLEWARE=$(find src/ -maxdepth 2 -type f \
  \( -name "proxy.ts" -o -name "proxy.tsx" \
     -o -name "_middleware.ts" -o -name "_middleware.tsx" \
     -o -name "middleware.tsx" \
     -o -name "auth-middleware.ts" -o -name "auth-middleware.tsx" \) \
  2>/dev/null || true)
if [ -n "$WRONG_MIDDLEWARE" ]; then
  fail "Arquivo com nome errado detectado — Next.js IGNORA (rotas desprotegidas): $WRONG_MIDDLEWARE"
  info "O middleware DEVE ser: src/middleware.ts com 'export default function middleware()'"
fi

if [ -f "src/middleware.ts" ] || [ -f "middleware.ts" ]; then
  MFILE="src/middleware.ts"
  [ -f "middleware.ts" ] && MFILE="middleware.ts"
  ok "$MFILE encontrado"

  if grep -q "jwtVerify\|verifyAdminToken" "$MFILE"; then
    ok "Verificação de JWT presente no middleware"
  else
    fail "Middleware não verifica JWT — rotas admin podem estar abertas"
  fi

  if grep -q "algorithms:" "$MFILE"; then
    ok "Whitelist de algoritmos JWT configurada (proteção contra alg:none)"
  else
    fail "Falta whitelist de algoritmos no jwtVerify — vulnerável a alg:none/downgrade"
    info "Corrija: jwtVerify(token, secret, { algorithms: ['HS256'] })"
  fi

  if grep -q "export default" "$MFILE"; then
    ok "Middleware tem 'export default' (Next.js vai reconhecê-lo)"
  else
    fail "Middleware sem 'export default' — Next.js IGNORA o arquivo"
  fi
else
  fail "src/middleware.ts NÃO encontrado — rotas admin DESPROTEGIDAS"
fi

# Verifica também auth.server.ts — jwt.verify sem algoritmo é vulnerável
if [ -f "src/lib/auth.server.ts" ]; then
  if grep -q "algorithms:" src/lib/auth.server.ts; then
    ok "auth.server.ts tem whitelist de algoritmos no jwt.verify"
  else
    fail "auth.server.ts: jwt.verify sem algorithms — vulnerável a alg confusion"
    info "Corrija: jwt.verify(token, secret, { algorithms: ['HS256'] })"
  fi
fi

# ── 7. Dependências desatualizadas ────────────────────────────────────────────
section "Dependências desatualizadas (segurança)"
OUTDATED=$(npm outdated --json 2>/dev/null | jq 'keys | length' 2>/dev/null || echo 0)
if [ "$OUTDATED" -gt 5 ]; then
  fail "$OUTDATED pacotes desatualizados — verifique se há patches de segurança"
else
  ok "Dependências razoavelmente atualizadas ($OUTDATED desatualizadas)"
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  Resultado: $PASS passaram · $FAIL falharam"
echo "═══════════════════════════════════════"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
