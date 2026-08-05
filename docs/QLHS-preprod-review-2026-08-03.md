# QLHS — Pre-Production Full-Stack Source Review (2026-08-03)

**Branch:** `master` (post-merge `feat/assistant-chatbot`) · **Method:** 6 chuyên gia review song song (Domain/State-machine · HTTP-RBAC · Auth/SSO/Session · DB/Prisma · Frontend · DevOps), neo theo bản đồ `graphify-out/GRAPH_REPORT.md` (3176 nodes, 0 import cycle). Các phát hiện giá trị cao đã được coordinator **tự kiểm chứng lại trên code**.

## Kết luận tổng

**GO có điều kiện (8.5/10).** Phần lõi nghiệp vụ + bảo mật **rất chắc** và đã được xác minh: state machine đóng/đủ cạnh, audit append-only enforce ở DB (REVOKE + trigger chặn cả owner non-superuser), OIDC (state/nonce/PKCE single-use, RS256 pinned, iss/aud), session fixation-immune, HMAC webhook fail-closed timing-safe, RBAC/IDOR sạch, XSS sạch, CSV-injection guarded, i18n parity ép bởi compiler. **Không có defect CRITICAL/HIGH nào trong logic code.** 3/4 blocker cấu hình của audit 31/7 đã fix (loopback-bind cổng, `NODE_ENV: production` pinned, `submitToAndy` khỏi generic action).

Rủi ro go-live còn lại **nằm ở ops/cấu hình triển khai**, cộng **1 lỗi HIGH insider-DoS** dễ vá.

---

## A. GO-LIVE BLOCKERS (phải xử lý trước prod)

### A1 · [CRITICAL — OPS] Rotate mật khẩu Postgres `qlhs` (superuser) + `qlhs_app`
Vẫn là literal `qlhs`/`qlhs_app` ở `docker-compose.yml:10-11,82-83`, `ops/backup/backup.sh:24`, migration `...170137:79`. **Toàn bộ đảm bảo append-only (AD-4) dựa trên app kết nối bằng non-superuser** — trigger `ticket_event_append_only` cố ý miễn trừ superuser (`infra/prisma/superuser-guard.ts`). Loopback-bind đã đóng LAN, nhưng **bất kỳ process host-local hoặc container nào trên compose/edge net** vẫn `psql` vào bằng superuser mật khẩu 1 từ và DROP trigger / UPDATE/DELETE `ticket_event` → sập audit bất biến.
**Fix (ops, không phải code):** `ALTER ROLE qlhs PASSWORD '<strong>'; ALTER ROLE qlhs_app PASSWORD '<strong>';` rồi cập nhật `DATABASE_URL` / `MIGRATE_DATABASE_URL` / backup `PGPASSWORD` qua secret (không để literal). *Lưu ý: volume `qlhs-pg` đã init → sửa literal trong compose vô tác dụng, phải `ALTER ROLE`.*

### A2 · [HIGH — CODE] `BatchActionDto.ticketIds` thiếu `@ArrayMaxSize` + `Promise.all` không giới hạn → insider DoS
`http/dcc-shared/ticket-action.dto.ts:49-53` (chỉ `@IsArray @ArrayNotEmpty @IsString`) → `application/board/batch-action.usecase.ts:24` fan `Promise.all(ticketIds.map(...))`, mỗi id mở 1 transaction `FOR UPDATE`. Một DCC1 gửi ~2500 UUID → saturate Prisma pool, chặn mọi request khác. **CONFIRMED (coordinator đọc lại code).** *(Memory tưởng đã fix 31/7 — bản trên master chưa có.)*
**Fix:** thêm `@ArrayMaxSize(100)` + chunk với bounded concurrency (`p-limit`) thay `Promise.all` trần.

### A3 · [HIGH — OPS] Điền đủ env prod bắt buộc (nếu thiếu → refuse-boot)
`config/auth.config.ts:63` fail-closed: prod + OIDC bật + `QLHS_ALLOWED_GROUPS` rỗng (và không `QLHS_ALLOW_ALL_GROUPS=1`) → throw lúc boot (đúng thiết kế). Bắt buộc set: `OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET`, `QLHS_ALLOWED_GROUPS`, `PMH_WEBHOOK_SECRET`, `QLHS_LOCAL_ADMIN_PASSWORD` — tất cả blank trong `.env.example`.

### A4 · [HIGH — OPS] `edge` network + cert phải tồn tại trước; `deploy.sh` không áp prod override
- `docker-compose.prod.yml:23` yêu cầu external network `edge` (precondition ẩn) và cert `./pmh.com.vn/{fullchain.pem,private.key}`. Thiếu → `up` fail ngay.
- `ops/deploy.sh:12,15` chạy compose **không** `-f docker-compose.prod.yml` → không join edge, không realize Model B. Deploy chỉ chờ **api** healthy nên web chết vẫn báo thành công.
**Fix:** `deploy.sh` include cả 2 file `-f`; gate deploy trên sự hiện diện của cert + network.

---

## B. SHOULD-FIX (correctness/bảo mật, effort thấp — trước hoặc ngay sau go-live)

| # | Sev | Vấn đề | File | Ghi chú |
|---|-----|--------|------|---------|
| B1 | MED | `amount` 20 chữ số lọt validate → int64 overflow → **500** (int64 max = 19 digits) | `http/applicant/create-ticket.dto.ts:17,49-51` | **Corroborated ×3 + coordinator confirm.** Hạ `AMOUNT_MAX=18` hoặc range-guard → 400 |
| B2 | MED | `reason` không `@MaxLength` (3 DTO) → ghi thẳng `ticket_event` **append-only không sửa được** | `http/dcc-shared/ticket-action.dto.ts:30,39,58` | **Coordinator confirm.** Thêm `@MaxLength(500)` |
| B3 | MED | `QLHS_DISABLE_THROTTLE=1` tắt **cả** global throttler **và** login-lockout, **không gate theo prod** | `app.module.ts:28`, `http/auth/auth.controller.ts:156` | Khác `DEV_AUTH`/`cookieSecure`. Nếu lọt env prod → break-glass admin brute-force vô hạn. Gate `NODE_ENV!=='production'` |
| B4 | MED | `ALTER DEFAULT PRIVILEGES` cấp sẵn UPDATE/DELETE mọi bảng tương lai → `notification` & `processed_webhook_event` **không thật sự append-only** dù GRANT hẹp | migration `...170137:87` | ticket_event vẫn an toàn (có REVOKE+trigger). Thêm `REVOKE UPDATE,DELETE` trên các ledger |
| B5 | MED | `TicketDetail` Retry hỏng: `load()` không `setError(null)` → thành công vẫn kẹt màn lỗi; thiếu `key`/gen-guard → stale khi đổi ticket | `web/features/tickets/TicketDetail.tsx:68-74`; `App.tsx:175` | **Coordinator confirm.** `setError(null)` + key by `ticketId` |
| B6 | MED | AD-4 "single writer" chỉ là quy ước: 4-6 site INSERT `ticket_event` (đều append, `from==to`) nhưng **không có CHECK** chặn non-transition writer ghi row `from!=to` | `domain/audit/ticket-event.ts`; write-repos | Domain + DB agent trùng. Thêm DB CHECK `from_status=to_status` cho action non-transition, hoặc integration test |
| B7 | MED | web nginx crash-loop nếu thiếu cert; web **không có healthcheck** | `web/nginx.conf:41`, `docker-compose.yml:115-127` | Tách HTTPS server ra override, thêm healthcheck |

---

## C. HARDENING / BACKLOG (post-launch)

- **Perf/scale:** board `listByFlows` không lọc status → nạp toàn bộ lịch sử flow, seq scan phình dần (`infra/prisma/ticket/ticket-query.repo.ts:88`); thêm `status notIn [terminal]` + partial index. `toCard` gọi `lock.get` per-card → batch `getMany`.
- **Auth defense-in-depth:** admin auto-grant theo claim `email` không check `email_verified` (`auth.controller.ts:234`); webhook thiếu `event_id` bỏ qua idempotency → replay được (minor); pin `algorithms:['RS256']` cho `verifyLogoutToken`; boot-assert refuse nếu build prod mà `NODE_ENV!=='production'`.
- **Consistency:** SSE firehose (`domain/auth/roles.ts:41`) quyết định visibility theo union `roles` thay vì `activeRole` → DCC2/DCC3 nhận change-event ngoài flow (metadata leak nội bộ nhẹ); group-gate fail-open khi allow-list rỗng.
- **DB:** timestamp là `timestamp(3)` không TZ (an toàn vì on-prem 1 TZ, nhưng nên `timestamptz`); `dwellByStatus` thiếu tie-break `localeCompare` → e2e equivalence có thể flake.
- **Container/supply-chain:** api image copy cả dev-deps+TS source (`apps/api/Dockerfile:16`); container chạy **root** (cả 3); `mailpit:latest` unpinned; thiếu resource limits + log rotation; nginx SPA thiếu security headers + gzip.
- **FE nhỏ:** SSE `EventSource` không `onerror` (reconnect vô hạn sau 401); `useLiveRefetch` thiếu generation-guard (last-resolver-wins); `TERMINAL` regex substring thay vì `isTerminal` từ contract (đúng hiện tại nhưng brittle); vài string bypass `t()`.
- **Backup:** `PGPASSWORD` default literal `qlhs` — require thay vì default.

---

## D. ĐÃ XÁC MINH TỐT (VERIFIED OK — không cần động vào)

State machine đóng/đủ cạnh, không duplicate `(from,event,flow)`; AD-2 (chỉ `transition()` đổi status); AD-1 domain purity (0 framework import, clock injected); code-mint atomic + unique; soft-lock race-safe; reopen/undo không strand; SLA business-day + pause/dwell math; append-only `ticket_event` enforce ở DB không bypass được; migrate deploy (không db push) two-role model; OIDC full verify; session fixation-immune + silent-refresh fail-closed; HMAC webhook raw-body timing-safe idempotent; scrypt local-admin; RBAC mọi mutating endpoint + IDOR ownership re-check; DomainErrorFilter map 4xx không leak stack; CSV escape RFC-4180; XSS sạch; open-redirect SSO an toàn; 401-handling tập trung; double-submit guard; board cache invalidation; action buttons server-driven; i18n parity compiler-enforced; modal a11y + metro lit-line đúng; secrets không bị commit (`.gitignore` phủ `.env`/certs/backups).
