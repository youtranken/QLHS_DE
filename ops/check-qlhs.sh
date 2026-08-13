#!/usr/bin/env bash
# check-qlhs — kiểm tra TOÀN VẸN cụm QLHS trên prod. CHỈ ĐỌC, không đổi gì.
# Chạy trên host prod:  bash ~/QLHS_DE/ops/check-qlhs.sh
# Thoát 0 = mọi mục PASS; thoát 1 = có mục ✗ (HỎNG). ! = cảnh báo (xem lại, chưa chắc lỗi).
set -uo pipefail

# Tự dò gốc repo: đi từ thư mục chứa script lên trên tới khi thấy docker-compose.yml
# → chạy đúng dù đặt ở ~/QLHS_DE hay ~/QLHS_DE/ops/.
QLHS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [ "$QLHS" != / ] && [ ! -f "$QLHS/docker-compose.yml" ]; do QLHS="$(dirname "$QLHS")"; done
[ -f "$QLHS/docker-compose.yml" ] || QLHS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="qlhs_de"                       # tên compose project (từ thư mục QLHS_DE)
EDGE_HOST="de-qlhs.pmh.com.vn"
EDGE_URL="https://localhost:8443/api/health"
BACKUP_MAX_H=26                      # backup chạy 02:00 mỗi ngày → mới nhất phải < 26h

pass=0; fail=0; warn=0
ok(){ printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
no(){ printf '  \033[31m✗ %s\033[0m\n' "$1"; fail=$((fail+1)); }
wn(){ printf '  \033[33m! %s\033[0m\n' "$1"; warn=$((warn+1)); }
hdr(){ printf '\n\033[1m%s\033[0m\n' "$1"; }
cid(){ docker ps -aq --filter "name=${PROJ}-$1" | head -1; }   # container id theo service

hdr "1) Container prod bắt buộc đang chạy"
for svc in web api postgres pg-backup; do
  c=$(cid "$svc")
  if [ -z "$c" ]; then no "$PROJ-$svc: KHÔNG tồn tại"; continue; fi
  st=$(docker inspect -f '{{.State.Status}}' "$c")
  if [ "$st" = running ]; then ok "$PROJ-$svc: $st"; else no "$PROJ-$svc: $st (không chạy)"; fi
done

hdr "2) KHÔNG lẫn thứ dev vào prod"
if [ -z "$(docker ps -q --filter "name=${PROJ}-mailpit")" ]; then
  ok "mailpit không chạy (đúng — dev-only)"
else
  no "mailpit ĐANG chạy — không được có ở prod"
fi
ne=$(docker exec "$(cid api)" printenv NODE_ENV 2>/dev/null || true)
if [ "$ne" = production ]; then ok "api NODE_ENV=production"; else no "api NODE_ENV='$ne' (phải = production)"; fi

hdr "3) Healthcheck"
for svc in api postgres; do
  c=$(cid "$svc")
  h=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null || echo err)
  if [ "$h" = healthy ]; then ok "$svc: $h"; else wn "$svc: $h"; fi
done

hdr "4) Cổng KHÔNG lộ 0.0.0.0"
bad=$(docker ps --format '{{.Names}} {{.Ports}}' | grep "$PROJ" | grep '0.0.0.0' || true)
if [ -z "$bad" ]; then ok "không có cổng 0.0.0.0 nào"; else no "còn cổng lộ ra ngoài:"; echo "$bad" | sed 's/^/      /'; fi
wp=$(docker ps --format '{{.Names}} {{.Ports}}' | grep "${PROJ}-web" || true)
if echo "$wp" | grep -q '127.0.0.1'; then ok "web bind 127.0.0.1"; else wn "web ports: ${wp:-<none>}"; fi

hdr "5) Restart policy (tự sống lại sau reboot)"
for svc in web api postgres pg-backup; do
  rp=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$(cid "$svc")" 2>/dev/null || echo '')
  if [ "$rp" = unless-stopped ] || [ "$rp" = always ]; then ok "$svc: $rp"; else no "$svc: '${rp:-?}' (nên unless-stopped)"; fi
done

hdr "6) web nối mạng edge"
if docker inspect "$(cid web)" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | grep -qw edge; then
  ok "web ở mạng edge (route de-qlhs:8443 → qlhs-web:80)"
else
  no "web KHÔNG ở mạng edge — edge sẽ không tới được"
fi

hdr "7) Health thật qua EDGE (de-qlhs:8443)"
code=$(curl -sk -o /dev/null -w '%{http_code}' -H "Host: $EDGE_HOST" "$EDGE_URL" 2>/dev/null || echo x)
if [ "$code" = 200 ]; then ok "edge /api/health = 200"; else no "edge /api/health = $code (login/route có thể hỏng)"; fi

hdr "8) OIDC trỏ đúng cụm edge :8443"
iss=$(docker exec "$(cid api)" printenv OIDC_ISSUER 2>/dev/null || true)
rdr=$(docker exec "$(cid api)" printenv OIDC_REDIRECT_URI 2>/dev/null || true)
if echo "$iss" | grep -q ':8443'; then ok "OIDC_ISSUER=$iss"; else wn "OIDC_ISSUER='${iss:-<trống>}' (không phải :8443?)"; fi
if echo "$rdr" | grep -q "$EDGE_HOST:8443"; then ok "OIDC_REDIRECT_URI=$rdr"; else wn "OIDC_REDIRECT_URI='${rdr:-<trống>}'"; fi

hdr "9) Backup còn mới"
BK="$QLHS/data-backups"
bp=$(grep -E '^BACKUP_PATH=' "$QLHS/.env" 2>/dev/null | cut -d= -f2- || true)
[ -n "$bp" ] && BK="$bp"
if [ ! -d "$BK" ]; then
  wn "không thấy thư mục backup: $BK"
else
  newest=$(ls -t "$BK" 2>/dev/null | head -1)
  if [ -z "$newest" ]; then
    wn "thư mục backup rỗng: $BK"
  else
    age_h=$(( ( $(date +%s) - $(stat -c %Y "$BK/$newest") ) / 3600 ))
    if [ "$age_h" -le "$BACKUP_MAX_H" ]; then ok "backup mới nhất: $newest (${age_h}h trước)"
    else wn "backup mới nhất ${age_h}h trước (>$BACKUP_MAX_H h) — kiểm cron pg-backup"; fi
  fi
fi

hdr "10) Repo prod sạch & khớp GitHub"
if git -C "$QLHS" rev-parse --git-dir >/dev/null 2>&1; then
  if [ -z "$(git -C "$QLHS" status --porcelain)" ]; then ok "repo sạch"; else no "repo có thay đổi chưa commit — update-qlhs.sh sẽ bị chặn"; fi
  git -C "$QLHS" fetch -q origin 2>/dev/null || true
  lc=$(git -C "$QLHS" rev-parse HEAD 2>/dev/null || echo '')
  rc=$(git -C "$QLHS" rev-parse '@{u}' 2>/dev/null || echo '')
  if [ -n "$rc" ] && [ "$lc" = "$rc" ]; then ok "khớp origin (${lc:0:7})"
  elif [ -n "$rc" ]; then wn "lệch origin: local ${lc:0:7} vs remote ${rc:0:7} — chạy update-qlhs.sh nếu cần"; fi
else
  wn "$QLHS không phải git repo?"
fi

hdr "11) Cert cụm"
if [ -f "$QLHS/pmh.com.vn/fullchain.pem" ]; then ok "pmh.com.vn/fullchain.pem có"; else wn "thiếu pmh.com.vn/fullchain.pem"; fi

hdr "12) Đĩa trống (tham khảo)"
df -h "$QLHS" | awk 'NR==2{printf "  %s trống / %s (dùng %s)\n",$4,$2,$5}'

printf '\n\033[1mKẾT QUẢ:\033[0m %d ✓   %d !   %d ✗\n' "$pass" "$warn" "$fail"
if [ "$fail" -eq 0 ]; then echo "→ QLHS prod TOÀN VẸN (xem lại các mục ! nếu có)."; else echo "→ Có $fail mục HỎNG — xử lý các dòng ✗ ở trên."; fi
exit $(( fail > 0 ? 1 : 0 ))
