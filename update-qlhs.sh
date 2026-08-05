#!/usr/bin/env bash
# update-qlhs — cập nhật QLHS lên code mới từ GitHub: git pull → build + recreate → chờ health.
# api tự chạy migration lúc boot; entrypoint đặt lại mật khẩu app-role từ env. Chạy: bash ~/QLHS_DE/update-qlhs.sh
set -euo pipefail

QLHS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # script ở gốc QLHS_DE
cd "$QLHS"
ENVF="apps/api/.env"
CJ=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "==> [1/4] Kiểm repo sạch rồi kéo code mới (ff-only)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "!! ${QLHS} có thay đổi cục bộ chưa commit — dừng. Xem: git -C ${QLHS} status" >&2; exit 1
fi
git pull --ff-only

echo "==> [2/4] Bắc cầu mật khẩu DB từ ${ENVF} cho compose"
set -a; . <(grep -E '^(POSTGRES_PASSWORD|QLHS_APP_PASSWORD)=' "$ENVF" || true); set +a
{ [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${QLHS_APP_PASSWORD:-}" ]; } || {
  echo "!! ${ENVF} thiếu POSTGRES_PASSWORD / QLHS_APP_PASSWORD." >&2; exit 1; }

echo "==> [3/4] Build + recreate (prod overlay)"
"${CJ[@]}" up -d --build

echo "==> [4/4] Chờ /api/health qua edge"
ok=0
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: qlhs.pmh.com.vn' https://localhost:8443/api/health || true)
  [[ "$code" == "200" ]] && { ok=1; echo "    health OK (200)"; break; }
  echo "    ...chờ (HTTP ${code:-x}) ${i}/30"; sleep 3
done
echo
"${CJ[@]}" ps
[[ "$ok" == 1 ]] || { echo "!! Chưa 200 — log: cd ${QLHS} && ${CJ[*]} logs -f api" >&2; exit 1; }
echo "XONG update QLHS."
