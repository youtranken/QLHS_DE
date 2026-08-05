# QLHS — Rà soát toàn diện trước Prod (Pre-Production Audit)

**Ngày:** 2026-07-31 · **Nhánh:** `feat/assistant-chatbot` · **Phương pháp:** 6 chuyên gia (Opus) rà song song theo lát cắt không chồng lấn, đối chiếu GRAPH_REPORT.md + PRD §4/§6 + walkthrough + ARCHITECTURE-SPINE (20 AD).

> **Kết luận nhanh:** **Phần code/nghiệp vụ đã rất chắc** (state machine, RBAC, OIDC, concurrency, append-only audit ở tầng DB đều đạt). **Điểm chặn Prod nằm ở cấu hình triển khai (deployment hardening), không phải ở logic.** Có **1 CRIT + 3 HIGH** phải xử lý trước khi lên Prod — tất cả đều là fix nhỏ, khu trú rõ.

---

## ✳️ TRẠNG THÁI KHẮC PHỤC (cập nhật 2026-07-31, sau audit)

Đã CODE + TEST xong (**422 unit + 242 e2e xanh**, typecheck sạch, compose hợp lệ). E2e (boot `AppModule` thật) đã bắt & fix một lỗi DI hồi quy — thiếu `exports: [SessionAuthService]` ở `AuthModule` khiến `EventsModule`/`NotificationsModule` không resolve được `AuthGuard`:

- ✅ **BLOCK-4** — bỏ `SubmitToAndy` khỏi `GENERIC_ACTION_EVENTS` (`ticket-action.dto.ts`), thêm test `ticket-action.dto.spec.ts` (single + batch reject). Đường hợp lệ `/pool/:id/confirm` không đổi.
- ✅ **BLOCK-3** — pin `NODE_ENV: production` trong `docker-compose.yml` khối `environment:` (thắng `env_file`), khóa dev-login/cookie-Secure/superuser-guard/group-gate về đúng thế prod.
- ✅ **BLOCK-2 + phần LAN của BLOCK-1** — bind `postgres`/`api`/`mailpit` về `127.0.0.1` (bỏ phơi LAN). nginx dùng `http://api:3000` qua mạng compose nên không ảnh hưởng; web `5173`/`18080` giữ public.
- ✅ **M4 (session-expiry, nâng mức do BCL chưa hoạt động)** — thêm `SessionAuthService` (silent refresh mỗi request, phân loại revoke↔outage, single-flight) + `SessionStore.updateTokens`; `AuthGuard` gọi `resolve()`. Cửa sổ phiên-cũ: **12h → ~TTL access-token (~5')** không cần BCL. 8 unit test mới. Học pattern từ QLTS.

**CÒN LẠI — hành động của người vận hành (không phải code):**
- ⏳ **BLOCK-1 (xoay creds)** — đổi mật khẩu superuser `qlhs` + `qlhs_app` khỏi giá trị literal. Loopback binding đã chặn LAN, nhưng vẫn nên xoay: `ALTER ROLE qlhs PASSWORD '…'; ALTER ROLE qlhs_app PASSWORD '…';` rồi cập nhật `DATABASE_URL`/`MIGRATE_DATABASE_URL`/backup env. **Không tự đổi trong compose** vì volume đã init → đổi literal không có tác dụng và làm lệch healthcheck/backup.
- ⏳ **Env prod BẮT BUỘC** (nếu thiếu, `NODE_ENV=production` sẽ khiến api **refuse-boot** theo `auth.config.ts:60` — đúng fail-closed): `OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET/REDIRECT_URI`, `QLHS_ALLOWED_GROUPS=…` (hoặc `QLHS_ALLOW_ALL_GROUPS=1`), `QLHS_LOCAL_ADMIN_USERNAME` + `QLHS_LOCAL_ADMIN_PASSWORD` (mạnh), `WEB_ORIGIN=https://qlhs.pmh.com.vn`.
- ⏳ **BCL phía IdP** — đăng ký endpoint `POST /auth/backchannel-logout` với PMH ID để có kênh kill-tức-thì (đã bớt gấp nhờ silent-refresh). Endpoint đã sẵn trong code.

---

## 1. Verdict & Điểm số

**Tổng điểm sẵn-sàng-Prod: 7.5 / 10 → 🔴 NO-GO (có điều kiện).**
Xử lý xong cụm 4 lỗi chặn (§3) → **GO**. Không có lỗi nào cần refactor lớn; ước tính < 1 ngày công.

| Lát cắt | Điểm | Ghi chú |
|---|---|---|
| Domain / State Machine | **9.3** | Không crit/high. Edge đủ 3 luồng, SLA math chuẩn, prior-bug "Payment thiếu DCC3 Return" đã fix |
| Frontend (web) | **8.5** | Chắc; chỉ vài MED robustness màn Admin |
| Assistant chatbot (mới) | **8.8** | Bảo mật rất chắc (RBAC double-gate, fail-closed); 1 MED read-only |
| Application / Controllers | **8.3** | 1 HIGH logic (code=NULL); phần còn lại layering tốt |
| Auth / RBAC / SSO | **7.8** | Code-side xuất sắc; kéo điểm bởi cụm phơi cổng + session-expiry |
| **DB / Infra / Deploy** | **6.5** | Nơi trú của lỗi CRIT — creds yếu + phơi cổng |

**Phân bố finding:** 1 CRIT · 3 HIGH · 9 MED · ~16 LOW · 5 INFO.

---

## 2. Chủ đề bao trùm

Điều quan trọng nhất: **rủi ro Prod hầu như không đến từ code, mà đến từ 3 cụm cấu hình triển khai** cộng hưởng nhau và được **nhiều agent xác nhận chéo**:

1. **Phơi cổng ra host** (`5432:5432`, `13000:3000`) — bỏ qua nginx.
2. **Credential yếu/literal cắm cứng** trong compose & migration (`qlhs`, `qlhs_app`).
3. **`NODE_ENV` phụ thuộc `env_file` của máy dev** — có thể âm thầm tắt hardening prod.

Ba cụm này chồng lên nhau tạo ra chuỗi tấn công: chạm được LAN → login superuser Postgres bằng mật khẩu đoán được → **DROP trigger append-only → viết lại audit bất biến (phá AD-4)**. Đây là lý do điểm DB/Infra bị kéo xuống dù schema/logic tốt.

---

## 3. 🔴 LỖI CHẶN PROD (phải fix trước khi deploy)

### BLOCK-1 · [CRIT] Superuser Postgres mật khẩu đoán được + phơi cổng → phá vỡ audit bất biến (AD-4)
- **Vị trí:** `docker-compose.yml:10-14` (`POSTGRES_PASSWORD: qlhs`, `ports: 5432:5432`) · `apps/api/prisma/migrations/20260710170137_.../migration.sql:79` (`CREATE ROLE qlhs_app ... PASSWORD 'qlhs_app'`) · trigger miễn trừ superuser: `migrations/20260725120000:17`.
- **Kịch bản:** Toàn bộ thiết kế append-only dựa trên việc app kết nối bằng role thường `qlhs_app`; trigger `ticket_event_append_only` **cố tình miễn trừ superuser**. Nhưng superuser `qlhs` mật khẩu `qlhs` và Postgres publish ra host `:5432`. Ai chạm được LAN → login superuser bằng 1 từ → `UPDATE/DELETE/TRUNCATE ticket_event`, hoặc `DROP` chính trigger → **audit bất biến sụp đổ**.
- **Fix:** (1) **Bỏ mapping `5432:5432`** trong compose on-prem — api đã tới postgres qua mạng compose. (2) Đặt mật khẩu mạnh/mỗi-deploy qua secret env, **không literal trong VCS**; `ALTER ROLE qlhs_app` đọc mật khẩu từ env. (3) Xoay (rotate) creds đã lộ trong git history.

### BLOCK-2 · [HIGH] API + Postgres publish `0.0.0.0` → bypass throttle (brute-force Admin) + phá DB
- **Vị trí:** `docker-compose.yml:98-99` (`13000:3000`), `:13-14` (`5432:5432`); `hardening.ts:13` (`trust proxy = 1`); `auth.controller.ts:35` (`clientIp()`).
- **Kịch bản:** `trust proxy=1` chỉ đúng khi **mọi** request qua nginx. Client gọi thẳng `host:13000` là socket-peer, nên tự đặt `X-Forwarded-For` tùy ý → `clientIp()` trả IP giả → **bypass `LoginThrottle` per-IP + `ThrottlerGuard` 300/min** → brute-force mật khẩu Admin local không giới hạn (chỉ còn scrypt cản). Song song, Postgres lộ LAN (xem BLOCK-1).
- **Fix:** Không publish 2 cổng này ở compose on-prem. Nếu cần cho ops thì bind `127.0.0.1:13000` tối đa; **không bao giờ** hở `5432` ra ngoài box.

### BLOCK-3 · [HIGH] Prod container nạp `.env` của máy dev → 1 dòng lạc làm tắt hardening prod
- **Vị trí:** `docker-compose.yml:66-67` (`env_file: apps/api/.env`); `Dockerfile:14` (`ENV NODE_ENV=production`); `auth.config.ts:45,48,60-66`; `group-access.ts:17-20`.
- **Kịch bản:** compose `env_file` **override** `ENV` của Dockerfile lúc runtime. Prod deliberately nạp `.env` **không kiểm soát** của dev. Chỉ cần dev thêm `NODE_ENV=development` (hoặc file drift) → ship prod với: `/auth/dev-login` mở (mint phiên Admin không cần creds), cookie mất `Secure`, **superuser-guard tắt**, và **group-gate thành no-op → admit MỌI user PMH ID đã đăng nhập**. `loadEnv` chỉ validate `PORT`/`DATABASE_URL` nên **không bắt được**.
- **Fix:** Cho prod một env-template riêng (không phải file dev); **pin `NODE_ENV: production` trong khối `environment:`** của compose (thắng `env_file`); thêm assertion lúc boot: refuse start nếu image deploy mà `NODE_ENV !== 'production'`.

### BLOCK-4 · [HIGH] `submitToAndy` gọi được qua generic/batch action → hồ sơ `code = NULL` vĩnh viễn
- **Vị trí:** `apps/api/src/http/dcc-shared/ticket-action.dto.ts:11-20` (`GENERIC_ACTION_EVENTS` chứa `SubmitToAndy`) → `dcc1-pool.controller.ts:59-85` (single **và** batch) → `TransitionTicketUseCase` → `transition.ts`. Đường hợp lệ: `POST /dcc1/pool/:id/confirm` → `confirm-flow.repo.ts`.
- **Kịch bản:** Chỉ đường `/confirm` mới (a) mint `code` nếu NULL (AD-5) và (b) từ chối nếu soft-lock `heldByOther`. Đường generic **không làm cả hai** — bất kỳ DCC1 nào `POST .../action {"event":"submitToAndy"}` trên hồ sơ Pool → đẩy sang *Submitted to VP Andy* với `code` **vẫn NULL**, rồi trôi qua Andy → BOP → Completed mang NULL mãi (confirm-flow chỉ bắn từ `Submitted`). Dedup / closed-search / notification đều key theo `code` → hỏng. Batch → tái tạo hàng loạt. UI giấu (route qua synthetic `__confirm`) nhưng **API phơi ra, không có defense-in-depth**.
- **Fix:** Bỏ `SubmitToAndy` khỏi `GENERIC_ACTION_EVENTS` (cả single & batch), ép mọi `Submitted → Andy` qua `ConfirmFlowUseCase`. Nếu cần "Trình Sếp" hàng loạt → route batch qua use-case confirm-flow (mint code + honor lock).

---

## 4. 🟡 MEDIUM (nên fix trước Prod hoặc ngay sau, có kế hoạch)

| # | Sev | Lỗi | Vị trí | Fix |
|---|---|---|---|---|
| M1 | MED | Chatbot vi phạm read-only: `get_ticket_detail` thiếu `markSeen:false` → hỏi chi tiết là âm thầm xóa badge "chưa xem" | `assistant/tools/get-ticket-detail.tool.ts:16` | Truyền `{markSeen:false}` (1 dòng, giống `whats-next.tool.ts:18`) |
| M2 | MED | `BatchActionDto.ticketIds` không `@ArrayMaxSize` → `Promise.all` fan-out vô hạn tx `FOR UPDATE` → cạn connection pool (DoS) | `ticket-action.dto.ts:45-57` + `batch-action.usecase.ts:24-38` | `@ArrayMaxSize(200)` + xử lý theo chunk |
| M3 | MED | `amount` cho 20 chữ số → tràn `bigint` int8 → 500 (rò lỗi nội bộ) thay vì 400; chấp nhận `"0"` | `applicant/create-ticket.dto.ts:49-51` | Validate range `0 < amount ≤ INT8_MAX`, reject `0` |
| M4 | MED | Không enforce hết hạn phiên IdP: `accessExpiresAt`/`refresh()` lưu nhưng **không đọc**; user bị IdP khóa vẫn giữ phiên tới 12h; không idle-timeout | `session.store.ts:15,39-48`; `pmh-id.identity.ts:98-107` | `AuthGuard` check `accessExpiresAt` → refresh-or-invalidate + idle-timeout |
| M5 | MED | Duplicate email khi crash giữa SMTP-send và mark `sent` (at-least-once) | `outbox.dispatcher.ts:88-91`; `digest.dispatcher.ts:70-77` | Dedupe key tầng SMTP, hoặc chấp nhận + document |
| M6 | MED | Không có row-claim cross-process: chỉ cờ `running` in-memory; `--scale api=2` → double-send mọi mail/escalation | `outbox.dispatcher.ts:63`; `digest.dispatcher.ts:46` | `FOR UPDATE SKIP LOCKED` hoặc advisory leader-lock; hoặc **ép single-instance** rõ ràng |
| M7 | MED | Backup host-local, không mã hóa; `globals-*.sql` chứa mật khẩu role cleartext | `docker-compose.yml:44-47`; `ops/backup/backup.sh` | Off-box encrypted copy; siết perms `backups/` |
| M8 | MED | Cron scan full-table không `LIMIT` (escalation, return-reminder); escalation thiếu overlap-guard | `escalation.scheduler.ts:65`; `return-reminder.scheduler.ts:43` | Paginate/cap; thêm cờ `running` |
| M9 | MED | `AdminUsers` không load/error state → fetch lỗi hiện y như "nhóm rỗng"; assign/remove vai **fail im lặng** (không toast, không revert) | `AdminUsers.tsx:91-96,126-152` | try/catch + `StateNotice` + `toast.err` + `load()` trong `finally` |
| M10 | MED | Round-count vênh PRD §6: sendBack tại `Received by DCC2/DCC3` set `enteredFlow:true` (đếm vòng) dù chưa qua ACC/BOP | `contract.ts:110-117`; `payment.ts:48-55` | Chốt lại doc↔code (test đang cố ý coi "đã vào custody DCC2/3" = qua external) |

---

## 5. ⚪ LOW / INFO (tinh chỉnh, không chặn Prod)

**E2e-harness (ops hazard — mới):** mọi `*.e2e-spec.ts` hardcode `OWNER_URL=…/qlhs` và `beforeEach` chạy `deleteMany({})` → chạy e2e sẽ **xóa sạch bảng trên DB tên `qlhs`** bất kể `DATABASE_URL`. Khi stack deploy đang chạy trên chính DB `qlhs`, một lần `pnpm test` vô tình sẽ **phá dữ liệu live** (L, nhưng nguy hiểm khi prod). Đã né bằng cách chạy trên DB cô lập `qlhs_e2e`. Fix đề xuất: cho harness đọc DB name từ env (mặc định `qlhs_e2e`), không hardcode `qlhs`.

**Backend/Infra:** thiếu FK `ticket_id` trên `ticket_lock`/`notification*`/`ticket_view` (L); `CREATE INDEX` non-concurrent trên `ticket_event` đang lớn dần → khóa insert khi deploy (L); doc port dev lệch `:5492` vs compose `5432` (L); `AuthGuard` per-controller không global → controller mới quên guard = mở (L); admin-bootstrap tin claim `email` không check `email_verified` (L); CSRF chỉ dựa `SameSite=Strict` + dev-login là admin-minter nếu chạy không OIDC (L); forward-transition không check soft-lock (advisory — lost-update vẫn bị `FOR UPDATE` chặn) (L); analytics export CSV không giới hạn dòng/thời gian (L); `amount "0"` (gộp M3); `ValidationPipe` thiếu `forbidNonWhitelisted` (INFO); "một writer duy nhất" trong CLAUDE.md quá lời — nhiều nơi INSERT event *non-status* nhưng status vẫn chỉ qua `transition()`, AD-2 giữ vững (INFO).

**Domain:** `resolveActiveRole` xếp Applicant trước DCCx → user đa vai kẹt ở vai yếu tới khi tự switch (L); Reopen là cửa một chiều không undo (L); `legalActions` shadowing shared/flow chưa có test chốt (L); `transition()` không check ownership — đúng layering vì use-case chặn `NotTicketOwnerError`, domain không có defense-in-depth (INFO).

**Frontend:** `AdminOptions` nút "Thêm" double-fire → trùng mục + toggle enable fail im lặng (L-M); route `/ticket/<code>` standalone không auto-refresh (L-M); logout không nhánh lỗi → kẹt view đã-đăng-nhập (L); vài chỗ hardcode `'vi-VN'` bỏ qua locale (L); form tạo hồ sơ không cảnh báo mất dữ liệu khi bỏ dở (L).

---

## 6. ✅ Đã kiểm chứng TỐT (không cần hành động)

- **Append-only audit (AD-4) ĐÃ enforce ở tầng DB** — trigger `ticket_event_append_only` chặn UPDATE/DELETE cho non-superuser + `REVOKE` + boot-refuse-superuser. *(Prior finding "chưa enforce ở DB" đã giải quyết — chỉ còn BLOCK-1 là đường vòng.)*
- **State machine đủ & đúng:** mọi hàng PRD §4.2/§4.3 map ra edge (3 luồng), không state chết/không tới được, return/reopen đối xứng; prior "Payment thiếu DCC3 Return" đã fix (`payment.ts:48-55`).
- **SLA math chuẩn:** overdue strict-greater (đúng biên deadline), loại cuối tuần theo lịch Asia/Ho_Chi_Minh bất kể TZ container, pause merge/clamp không âm, áp pause nhất quán mọi read-path + scheduler.
- **RBAC không leo thang:** `activeRole` luôn re-derive server-side, **re-read DB mỗi request**; không header/body nào mang vai vào authz; `transition()` re-check `edge.ownerRole`.
- **OIDC chuẩn:** PKCE S256, state single-use TTL 10', nonce, verify iss/aud/exp, `redirect_uri` cố định server, backchannel-logout verify JWKS.
- **Concurrency race-safe:** numbering `INSERT…ON CONFLICT…RETURNING` trong tx `FOR UPDATE` (không gap/dup); soft-lock upsert `ON CONFLICT WHERE expired-or-mine`.
- **Assistant chatbot:** RBAC double-gate (resolve + service), identity từ server, render whitelist (drop `amount`/`*Sub`/email — AD-7), fail-closed, không XSS/ReDoS/IDOR/prototype-pollution.
- **Frontend:** CSV injection escaping còn nguyên, không `dangerouslySetInnerHTML`, i18n parity ép bởi compiler (tsc xanh), double-submit `busy` guard, SSE ref-count đóng đúng, session-expiry FR#3 + metro projection đã fix.
- **IDOR/ownership** (application): scope `applicantSub` ở cả use-case lẫn repo (`updateMany where applicantSub`, không TOCTOU); `TicketDetailUseCase` không có exists-oracle; `DomainErrorFilter` map đủ.
- **File-size rule** (≤300 dòng) đạt toàn bộ application/http (lớn nhất `station-board.usecase.ts` 273).

---

## 7. Checklist trước khi bấm Prod

**Bắt buộc (chặn):**
- [ ] BLOCK-1: Bỏ `5432:5432`; mật khẩu Postgres + `qlhs_app` mạnh qua secret; rotate creds đã lộ.
- [ ] BLOCK-2: Bỏ publish `13000` (hoặc bind `127.0.0.1`); xác nhận mọi traffic qua nginx.
- [ ] BLOCK-3: Pin `NODE_ENV: production` trong `environment:`; env-template prod riêng; boot-assert.
- [ ] BLOCK-4: Bỏ `SubmitToAndy` khỏi `GENERIC_ACTION_EVENTS`.

**Rất nên (trước Prod):**
- [ ] M1 chatbot read-only (1 dòng) · M2 `@ArrayMaxSize` · M3 amount range · M4 session-expiry · M9 AdminUsers error-state.
- [ ] Xác nhận `QLHS_ALLOWED_GROUPS` được set (nếu để trống → group-gate fail-open) và OIDC luôn cấu hình trên mọi box reachable.
- [ ] Kiểm seed `sla_config` phủ đủ mọi cặp `(status, flow)` non-terminal (thiếu row ⇒ null ⇒ âm thầm không-bao-giờ-overdue).
- [ ] Xác nhận chủ ý single-instance (M6) hoặc thêm row-claim trước khi scale.

**Sau Prod (theo dõi):** cụm LOW §5 + backup off-box (M7) + cron cap (M8).

---

*Báo cáo tạo bởi đội 6-agent (Opus). Mỗi finding kèm `file:line` + kịch bản lỗi + fix cụ thể ở các mục trên. Các cụm hạ tầng được xác nhận chéo bởi ≥2 agent độc lập.*
