# Rà soát toàn hệ thống QLHS (FE · BE · DB) — Báo cáo gaps & bug tiềm ẩn

- **Ngày:** 2026-07-25
- **Nguồn bản đồ:** `graphify-out/GRAPH_REPORT.md` (1514 nodes · 3685 edges · 88 communities)
- **Phương pháp:** đọc GRAPH_REPORT lấy bản đồ → tự đọc lõi (state-machine, `transition()`, SLA, auth, repo tx) → fan-out 4 agent quét sâu 4 tầng (DB/repo · domain · application/HTTP · web) → **tự xác minh từng phát hiện đầu bảng** với code + PRD/`docs/QLHS-flow-walkthrough.md`.
- Mỗi mục có `file:line` + kịch bản hỏng cụ thể. Phân biệt rõ **confirmed bug** vs **cần chốt intent**.

---

> **Cập nhật fix (2026-07-25):** ✅ **H2 ĐÃ FIX** (TDD, e2e xanh — thêm edge Payment `Received by DCC3 --sendBack(DCC1)--> Returned` + đường đẩy-ngược DCC3 + khoá send-accounting khi đang chờ đối chiếu). ✅ **H1 ĐÃ FIX** (migration `20260725120000` thêm trigger chặn UPDATE/DELETE `ticket_event` với mọi non-superuser bất kể ownership; test `audit-append-only.e2e-spec.ts` xanh; ghi chú two-role model vào `schema.prisma`). API 313 + web 54 test xanh.

## 🟥 HIGH — nên xử trước

### H1. `ticket_event` KHÔNG thực sự append-only (bất biến lõi AD-4 chưa được cưỡng chế) — ✅ ĐÃ FIX
`prisma/migrations/…170137/migration.sql:74-91` tạo role `qlhs_app` rồi `REVOKE UPDATE, DELETE ON ticket_event`. Chú thích của chính migration thừa nhận *"owner bypasses grants; migrations run as the owner"* — nhưng repo **chỉ có một** `DATABASE_URL = qlhs_app` (`.env`), `schema.prisma` **không có `directUrl`**, và `prisma:migrate` = `migrate deploy` chạy đúng URL đó.

- Nếu migrate chạy bằng `qlhs_app` → `qlhs_app` **sở hữu** `ticket_event` → `REVOKE` vô hiệu → audit **có thể bị UPDATE/DELETE**.
- Role `qlhs_app` được tạo *bên trong* migration 170137 → bootstrap DB mới bằng URL `qlhs_app` sẽ **chicken-and-egg** (connect fail). Bắt buộc chạy migrate bằng superuser `qlhs` — không script nào ghi lại.

**Fix:** thêm `directUrl` (owner = `qlhs`) cho migrate; assert app-role không sở hữu `ticket_event`; document quy trình.

### H2. Luồng Payment thiếu cửa Return trước khi đóng (spec bắt buộc, code không có) — ✅ ĐÃ FIX
`domain/ticket/state-machine/payment.ts` — không có edge `Received by DCC3 --sendBack(DCC1)--> Returned`; `handover.repo.ts:30 PUSHBACK_STATES` chỉ chứa 2 state Contract; không có endpoint đẩy-ngược cho DCC3. Contract có cặp đối xứng (`contract.ts:107-126`).

- Kịch bản: DCC3 đã xác nhận nhận bản cứng (`Received by DCC3`), phát hiện giấy sai → lối ra **duy nhất** là `SendToAccounting` (test `state-machine.spec.ts:275` chốt đúng điều này). Buộc gửi nhầm sang ACC rồi gỡ bằng Reopen (nặng hơn).
- Trái `docs/QLHS-flow-walkthrough.md:83` (*"DCC3 phát hiện bản cứng sai/thiếu ở `Received by DCC3` → đẩy ngược DCC1 → DCC1 Return … đối xứng Contract, b4"*) và `:97`.
- Comment "irreversible → fix only via Reopen" trong `payment.ts` **mâu thuẫn** walkthrough.

**Fix:** thêm edge `{from: ReceivedByDcc3, event: SendBack, to: Returned, ownerRole: Dcc1, flow: Payment, enteredFlow: true}` + đưa `ReceivedByDcc3` vào pushback + endpoint DCC3 đẩy-ngược.

### H3. "Hồ sơ của tôi" KHÔNG tự refresh dù UI hứa "cập nhật tự động mỗi 4 giây"
`web/features/tickets/MyTickets.tsx:122` in "…mỗi 4 giây", nhưng `useEffect` (71-73) chỉ chạy lại khi `reloadKey` đổi (chỉ bump lúc tạo hồ sơ). **Không có `setInterval`/focus listener** (khác `StationBoard`/`useStationData` poll 4s).

- Kịch bản: DCC1 trả lại hồ sơ → Applicant không thấy nhóm "▲ Bị trả lại — cần bạn sửa"/KPI sáng cho tới khi reload tay.

### H4. Soft-lock (AD-9) không cưỡng chế ở server; transition không kiểm holder
`application/transition-ticket.usecase.ts:27-38` không đọc `LockRepo`; `domain/ticket/transition.ts:62` chỉ check `edge.ownerRole === activeRole`, **không** check `actor.sub === currentHolderSub`. `dcc1-pool.controller.ts:59-72 /action` gọi thẳng transition.

- Kịch bản: DCC1-A "bốc" + giữ lock; DCC1-B (không giữ lock) vẫn `POST /action` thành công. Phạm vi giới hạn **cùng vai** (mất công/ghi đè, không leo quyền).
- ⚠️ **Cần chốt intent:** AD-9 có thể cố ý để advisory. Nếu muốn hard-lock → bug; nếu không → sửa lại lời invariant.

---

## 🟧 MEDIUM

- **M1. `undoTransition()` không kiểm owner-role** — `domain/ticket/undo.ts:24-58`. An toàn hôm nay *do trùng hợp* (mọi edge reversible đều DCC1). → thêm guard `edge.ownerRole === actor.activeRole`.
- **M2. `/admin/audit` query thô, không DTO → `Invalid Date` → 500** — ✅ **ĐÃ FIX**: thêm `AuditFilterDto` với `@IsDateOnly()` cho `from`/`to` (validator dùng chung `http/common/is-date-only.ts` — chỉ nhận `YYYY-MM-DD` là ngày lịch thật, chặn datetime + ngày ảo `2026-02-30`). Controller giờ parse UTC đối xứng (`from` đầu ngày, `to` cuối ngày). Rác → 400 sạch qua ValidationPipe thay vì 500 lộ stack. e2e xanh (`admin-audit.e2e`).
- **M3. Phân trang audit không tiebreaker → trùng/sót giữa trang** — `audit.repo.ts:59,72` chỉ `orderBy occurredAt desc`. → thêm `{ id: 'desc' }`.
- **M4. N+1 render board/pool** — `list-pool.usecase.ts:44-47`, `station-board.usecase.ts:166-167`, `dispatch-map.usecase.ts:45,84`, `list-workbox.usecase.ts:48`: mỗi card 2-3 query (SLA threshold + lock). → cache threshold, gom lock `IN (...)`.
- **M5. Form sửa hồ sơ trả lại thiếu sanitize số tiền/tiền tệ** — `web/features/tickets/ReturnPanel.tsx:117-127` input text trần; server `BigInt(dto.amount)` throw với "1.000.000".
- **M6. Không xử lý 401 toàn cục** — `web/shared/api-client.ts:19-32`; hết phiên giữa chừng không redirect login.
- **M7. Logout bỏ qua `redirectTo` → không kết thúc SSO** — `web/App.tsx:153`; máy dùng chung vào lại không hỏi credential.
- **M8. RBAC UI cache tới khi reload** — không phải lỗ bảo mật (server re-check mỗi request).
- **M9. Nút action trên card không disable khi pending → double-submit** — `BoardCardView.tsx:54-64` + `StationBoard.run()`.

---

## 🟨 LOW (chọn lọc)

- **Nhiều writer ghi thẳng `ticket_event`** (`ticket.repo.ts:186,252,282`; `handover.repo.ts:217`; `lock.repo.ts:62,93`) — đều note event (`from==to`), an toàn giữ nguyên, nhưng lời invariant AD-4 "một writer = transition()" không còn đúng nghĩa đen.
- **Dùng `new Date()` thay `SystemClock`** ở note-write (`ticket.repo.ts:194,260,290`, `handover.repo.ts:230`) — không tất định.
- **`ValidationPipe` thiếu `forbidNonWhitelisted`** (`main.ts:14`) + body auth gõ tay không qua DTO (`auth.controller.ts:95,117,136,161`).
- **Ranh giới overdue = N+1 business day** (`sla/overdue.ts` + `business-days.ts`) — cần chốt N hay N+1.
- **Không guard SLA row trên status terminal** (`sla-config.ts:6-8`).
- **`resolveActiveRole([])`=null vs `effectiveRoles([])`=[Applicant]** — an toàn hôm nay.
- **Cột "Cập nhật" hiển thị giờ tạo** (`MyTickets.tsx:240`).
- **`ReturnPanel.tsx:93` in raw `sub`** (trái AD-7/AD-12).
- **`SessionStore` không quét phiên hết hạn**; **`lock.seize` đọc `prev` không FOR UPDATE**; **`OptionRepo.create` `sortOrder` non-atomic** + P2002 duplicate value không map.
- **`local-login` timing oracle**; **cookie/session không rotate sid khi đổi role**.
- **Vặt UI:** `window.confirm` ×3; deep-link `#/search` → trang trắng (`App.tsx:164`); drawer/popover giữ snapshot cũ khi poll; `CreateTicketForm` mọi lỗi báo "chưa đủ 9 trường"; badge flow `TicketDetail.tsx:67` suy từ `documentType`.

---

## ✅ Đã kiểm và ĐÚNG (không cần sửa)

Atomicity transition (FOR UPDATE + audit + email-intent một tx) · **Applicant IDOR đã đóng** (mọi use-case check `applicantSub===actorSub`) · **FE/BE action không lệch** (card render `actions` từ server) · RoleSwitcher re-validate ở server · BigInt→string mọi biên · numbering atomic không nhảy/trùng · soft-lock upsert đúng "một người thắng" + TTL 5' · outbox idempotent (UNIQUE ticket,round,kind + ON CONFLICT) gửi ngoài tx + chống reminder cũ · index/constraint khớp schema (partial-unique `document_no` loại Cancelled) · không rò rỉ `Cancelled` · round-counting `enteredFlow` đúng 5 heavy edge · `DomainErrorFilter` map đủ 15 code (fallback 400).

---

## Ưu tiên đề xuất
1. **H1** (bất biến audit) + **H2** (thiếu cửa Return Payment) — đụng lõi hợp đồng nghiệp vụ.
2. **H3/H4** — trải nghiệm & toàn vẹn thao tác hàng ngày.
3. MEDIUM theo thứ tự M2/M3 (đúng đắn dữ liệu) → M4 (hiệu năng) → M5-M7 (FE).

---

# PHẦN II — Đối chiếu BMAD code review (2026-07-25, 5 reviewer độc lập, blind)

Chạy `bmad-code-review` (Blind Hunter + Edge-Case Hunter + Acceptance Auditor) trên **toàn bộ** code, **không** cho reviewer thấy Phần I. Kết quả: hai bên **trùng khớp toàn bộ HIGH** (H1, H2, H4, M1 được xác nhận độc lập; Acceptance Auditor tìm đúng dòng PRD §4.2 cho H2). Bổ sung dưới đây đã tự xác minh lại với code.

## A. BMAD SỬA Phần I (mình đã sai / quá rộng lượng)
- **Outbox KHÔNG "đúng hoàn toàn"** — ✅ **ĐÃ FIX** (commit `f026d54`): SMTP chập >~75s (5×15s) → row `status='failed'` **vĩnh viễn, không có đường requeue** → mất email thầm lặng; thiếu-email cũng park `failed`; `nodemailer` không set timeout → in-flight guard kẹt. Fix: cột `next_attempt_at` + backoff mũ (15s→cap 30m), `MAX_ATTEMPTS=12` (~vài giờ outage vẫn hồi), timeout nodemailer; e2e backoff/long-outage xanh. *(Idempotency vốn đã đúng.)*
- **Closed-tickets KHÔNG an toàn như đã nói:** ✅ **ĐÃ FIX** (cùng commit date-500): `ClosedFiltersDto.@IsDateString` nhận cả datetime → `new Date(\`${q.from}T00:00:00Z\`)` = Invalid Date → Prisma 500. Đổi sang `@IsDateOnly()` dùng chung; datetime/rác → 400. e2e xanh (`closed-tickets.e2e`).

## B. BMAD BỔ SUNG (net-new — thêm vào backlog)
**DB/infra**
- Mật khẩu DB yếu hardcode `qlhs_app` commit trong migration.
- `station-board.usecase.ts:104` `listByFlows` load **toàn bộ** bảng ticket (không lọc status) rồi lọc in-memory.
- `ticket.repo.ts:151-171 lastTransitionEvent` không tiebreaker `id` → chọn **sai event để Undo** khi trùng timestamp (correctness, không chỉ phân trang).
- `ticket-detail.usecase.ts:137` route projection `events.find` (first-match) → sau Reopen hiện holder/ngày **vòng 1** cũ.
- `lock.repo.ts:118-126 seize()` không giành được lock **còn hạn** của người khác dù tên/hợp đồng nói vậy → nút "Giành quyền" no-op thầm.
- `receivedAt` client gửi không validate → ngày tương lai ghi vào audit bất biến (`confirm-received-dcc2`, `receive-from-acc`).
- `batch-action.usecase.ts:35` lỗi non-domain gộp thành chuỗi `'error'` mờ mịt.
- `mutate-option.usecase` check-then-write TOCTOU → P2002 → 500 (chốt rõ hơn mục LOW của Phần I).

**Domain**
- Undo (M1) hệ quả nặng hơn: `deriveHolder` gán holder theo **người undo** → ticket **mồ côi** `currentHolderSub=null`.
- `admin/audit.ts:16-18 totalPages` bỏ clamp 200 mà `pageWindow` áp → `pageSize=500,total=600` báo 2 trang nhưng cần 3 → **200 dòng audit không tới được**.
- `route.ts:55-65 projectedRoute` cho Returned/Reopened/Cancelled không có vị trí `now` (map hiện như chưa bắt đầu); `flowStations` vs `projectedRoute` lệch ga BOP (General).
- `overview.ts:33-35 makeThresholdOf` key nối bằng dấu cách (status có dấu cách) — latent collision.

**HTTP**
- **Không rate-limit `/auth/local-login`** → brute-force không giới hạn tài khoản SA (nâng mức so với "timing oracle" LOW ở Phần I).
- `DispatchController` cấp `@Roles(...Admin)` nhưng comment nói "DCC only" — comment lỗi thời, bẫy khi sửa guard.

**Web**
- `AdminUsers.tsx:77-80` Admin **tự gỡ role Admin của chính mình** → khoá ngoài console, không đường phục hồi.
- Poll loader board/dispatch **không try/catch** → 401/403 giữa phiên → im lặng hiển thị data cũ mãi (sâu hơn M6).
- `HandoverModal` ngày nhận có thể để trống → server ghi ngày mặc định thầm.
- `SlaConfigAdmin` PUT tuần tự, lỗi giữa chừng → UI mâu thuẫn server; `AdminOverview` React key trùng; `AdminAudit` "Trang 1/0" + `fmtDate` mất năm; double-submit rộng hơn (ClosedTickets/AdminAppoint/AdminOptions).

## C. Phần I ĐÚNG mà BMAD hụt (giữ nguyên)
- **H3** MyTickets khoe "cập nhật mỗi 4 giây" nhưng không có poll — bmad web **không** bắt.
- Dùng `new Date()` thay `SystemClock` ở note-write; **doc-drift AD-4** "một writer" — bmad soi *enforcement* (H1) chứ không soi lời invariant.
- Acceptance Auditor **đóng dấu "AD-4 compliant"** chỉ vì thấy dòng `REVOKE` → chính là chỗ H1 vạch ra là vô hiệu ⇒ Phần I sâu hơn ở điểm này.

## D. Bất đồng đã phân xử
- Domain Blind Hunter nghi "General BOP sendBack không đếm vòng" là bug → **Acceptance Auditor bác** (PRD §6: Andy/BOP-General reject trước ACC = return nhẹ, KHÔNG đếm vòng). ⇒ **không phải bug**.
- Domain Hunter lưỡng lự H2 "cần chốt intent" → Acceptance Auditor **chốt là vi phạm spec** (PRD §4.2 dòng 53). ⇒ H2 là gap thật.
