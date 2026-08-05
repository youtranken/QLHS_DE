# QLHS — Sao lưu & khôi phục Postgres (runbook 1.5)

On-prem, dữ liệu hồ sơ là tài sản không được mất. Trang này: sao lưu gì · ở đâu · khôi phục thế nào.

## 1. Sao lưu cái gì

Service `pg-backup` (trong `docker-compose.yml`) chạy `ops/backup/backup.sh` — mỗi đêm **02:00**, sinh 2 file vào `./backups/` (mount ra host):

| File | Nội dung |
|---|---|
| `qlhs-<ts>.dump` | **Toàn database** (custom format, nén). Hồ sơ + audit (`ticket`, `ticket_event`) **và mọi rule/config nằm trong DB**: `sla_config` (ngưỡng SLA), `option_item` (danh mục), `user_role` (phân quyền), `local_credential` (mật khẩu admin dự phòng), `notification`, `digest_outbox`… |
| `globals-<ts>.sql` | **Role cluster + mật khẩu** (`qlhs`, `qlhs_app`). Dump 1-DB KHÔNG chứa role global, mà schema có `GRANT` trỏ tới `qlhs_app` → thiếu file này thì restore vào cluster trắng sẽ fail ở GRANT. |

**Giữ 30 bản cuốn chiếu** mỗi loại (`KEEP=30`), tự dọn bản cũ nhất.

### KHÔNG nằm trong backup (khôi phục riêng)
Những thứ ở ngoài Postgres — git đã giữ phần không bí mật:
- Env/secret: `apps/api/.env` (OIDC client secret, SMTP, `DATABASE_URL`, ngưỡng escalation `QLHS_ESCALATE_*`).
- Cert PMH ID: thư mục `pmh.com.vn/` (fullchain + key).
- `docker-compose.yml`, migrations (`apps/api/prisma/migrations/`) — đều trong git.

→ Sao lưu secret + cert bằng kênh bí mật riêng (không đẩy git, không nhét vào dump đêm).

## 2. Tài khoản người dùng sau khi restore

- **User ứng dụng, phân vai, mật khẩu admin dự phòng** (`user`, `user_role`, `local_credential`) → nằm trong bảng DB → **CÒN NGUYÊN** sau restore.
- **Đăng nhập SSO** do PMH ID (OIDC) quyết định, không phải DB này (AD-7) → không phụ thuộc backup.
- **Role DB `qlhs_app`** → nằm ở `globals-*.sql`, hoặc được migration `20260710170137` tạo lại.

## 3. Khôi phục

Chạy **AS owner `qlhs`**, KHÔNG dùng `qlhs_app` (owner mới dựng lại được role + trigger append-only). Chọn 1 trong 2 đường:

### Đường A — cluster trắng, chạy migrate trước (khuyên dùng khi dựng máy mới)
```bash
# 1. Dựng Postgres trắng + role qlhs (compose 'postgres' làm sẵn khi volume rỗng).
docker compose up -d postgres

# 2. Nạp role app + trigger append-only bằng migrations (tạo qlhs_app, GRANT, trigger).
DATABASE_URL="postgresql://qlhs:qlhs@localhost:5492/qlhs?schema=public" \
  pnpm --filter @qlhs/api exec prisma migrate deploy

# 3. Đổ lại DATA từ bản dump gần nhất (bỏ owner; --clean thay bảng seed của migrate).
pg_restore --clean --if-exists --no-owner \
  -h localhost -p 5492 -U qlhs -d qlhs backups/qlhs-<ts>.dump
```

### Đường B — restore thẳng "ảnh chụp" (nhanh, đúng thời điểm backup)
```bash
# 1. Nạp role global trước (dựng lại qlhs_app + mật khẩu).
psql -h localhost -p 5492 -U qlhs -d postgres -f backups/globals-<ts>.sql

# 2. Tạo DB trắng rồi restore toàn bộ.
createdb -h localhost -p 5492 -U qlhs qlhs   # nếu chưa có
pg_restore --no-owner -h localhost -p 5492 -U qlhs -d qlhs backups/qlhs-<ts>.dump
```

> Trong container: thay host/port bằng `PGHOST=postgres PGPORT=5432` và chạy qua
> `docker compose run --rm --entrypoint bash pg-backup -c '<lệnh>'` (phải override
> entrypoint vì mặc định của service là vòng lặp `backup.sh`).

## 4. Kiểm thử backup (bắt buộc định kỳ)

Backup chưa test = chưa có backup. Script phục hồi vào DB tạm rồi xoá:
```bash
# Host:
PGHOST=localhost PGPORT=5492 ./ops/backup/test-restore.sh backups/qlhs-<ts>.dump
# Container (override entrypoint — mặc định service là vòng lặp backup.sh):
docker compose run --rm --entrypoint bash pg-backup /ops/test-restore.sh /backups/qlhs-<ts>.dump
```
In ra số dòng `ticket / ticket_event / sla_config / user_role` → khác 0 là bản dump dùng được.

## 5. Vận hành nhanh
```bash
docker compose up -d pg-backup                 # bật service backup
docker compose logs -f pg-backup               # xem lịch + kết quả từng đêm
docker compose run --rm -e RUN_ONCE=1 -e BACKUP_ON_START=1 pg-backup   # ép backup ngay 1 lần
```
Chỉnh qua env trong compose: `KEEP` (số bản giữ), `BACKUP_HOUR` (giờ chạy). **Copy `./backups/` ra ổ/máy khác** — backup nằm chung máy với DB không cứu được sự cố mất nguyên máy.
