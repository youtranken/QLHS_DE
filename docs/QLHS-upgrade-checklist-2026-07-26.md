# QLHS — Checklist nâng cấp (lập 2026-07-26)

Điểm hiện tại: **7.4/10** · Mục tiêu sau 3 đợt: **~9.0/10**
(Chi tiết chấm điểm: kiến trúc 9.0 · tài liệu 9.5 · test 8.0 · code 8.0 · UX 7.5 · tính năng 7.0 · bảo mật 6.5 · vận hành 5.5 · CI 4.0)

Quy ước: mỗi mục làm theo TDD + quy ước file ≤300 dòng như CLAUDE.md. Xong mục nào tick mục đó, ghi ngày + commit.

---

## 🟥 ĐỢT 1 — Nền tảng (≈1 tuần) → mục tiêu 8.3

- [x] **1.1 CI pipeline** — ✅ XONG 2026-07-26: `.github/workflows/ci.yml` — 3 job song song (lint · typecheck · test) + composite action `setup` dùng chung. Job test dựng Postgres 18 ở :5492, migrate bằng owner `qlhs` (tạo role `qlhs_app` + trigger append-only + seed SLA), test chạy AS `qlhs_app`. Contracts build trước (dist gitignore), prisma generate cho tsc. *(CI 4.0→8.0)*
- [x] **1.2 Gia cố lớp ngoài API** — ✅ XONG 2026-07-26 *(Bảo mật 6.5→8.0)*
  - [x] `helmet` cho mọi response — qua `applyHardening(app)` (main.ts + e2e cùng gọi 1 chỗ)
  - [x] `@nestjs/throttler` — global 300/phút (backstop DoS) + **5/phút trên `POST /auth/local-login`**; `skipIf` tắt trong test, e2e riêng bật để kiểm; `trust proxy 1` lấy IP thật sau nginx
  - [x] Cookie phiên `SameSite=Strict` — an toàn vì OIDC state server-side + web/api/id cùng `pmh.com.vn` (same-site), deep-link email vẫn chạy qua XHR same-site
- [x] **1.3 Login hợp nhất — identifier-first (1 form duy nhất)** — ✅ XONG 2026-07-26 *(UX + Bảo mật)*
  - Người dùng chỉ thấy **một ô email** + nút "Tiếp tục".
  - [x] `POST /auth/probe { email } → { mode }` — `ProbeIdentityUseCase` tra `local_credential`; có → `local`, không → `sso` (không xác nhận email SSO có tồn tại ở IdP hay không)
  - [x] FE `LoginPage`: nhập email → Tiếp tục → probe. `local` hiện ô mật khẩu (local-login cũ), `sso` redirect `/api/auth/login`. Có nút 'đổi' quay lại sửa email.
  - [x] `/auth/probe` throttle 5/phút chung ngưỡng local-login (chống dò local admin)
  - [x] Xoá `LocalAdminLogin.tsx`, thay bằng `LoginPage.tsx` hợp nhất; 5 test web (2 nhánh probe + lỗi + quay lại) + 4 unit + 2 e2e probe
- [x] **1.4 Tách `StationBoard.tsx`** — ✅ XONG 2026-07-26: 410 → 272 dòng (`cardAction.ts` giữ bảng quyết định hành động, `ask.ts` giữ type). *(Code 8.0→8.5)*
- [x] **1.5 Backup Postgres + runbook khôi phục** — ✅ XONG 2026-07-27: service `pg-backup` (postgres:18, `ops/backup/backup.sh`) mỗi đêm 02:00 sinh **full `pg_dump` (custom) + `pg_dumpall --globals-only`** → `./backups/` mount ra host, **giữ 30 bản cuốn chiếu** tự dọn. Full = mặc định: một dump ôm hồ sơ + audit + mọi rule/config-trong-DB (sla_config, option_item, user_role, local_credential…); globals riêng để restore vào cluster trắng không fail GRANT. `test-restore.sh` phục hồi vào DB tạm + đếm dòng rồi xoá (đã chạy thật: ticket/sla_config 15/user_role 6 về đủ). Runbook `docs/QLHS-backup-runbook.md` (2 đường restore, AS owner `qlhs`, danh sách config-ngoài-DB). *(Vận hành 5.5→7.0)*

## 🟧 ĐỢT 2 — Tính năng "phòng điều độ sống" (≈2–3 tuần) → mục tiêu 8.8

- [x] **2.1 SSE real-time** — ✅ XONG 2026-07-27: trigger Postgres `NOTIFY` (bắt cả 6 repo ghi status) → 1 kết nối `pg` LISTEN → RxJS Subject → `@Sse('events/stream')` (guard cookie, heartbeat 25s, reconnect). Web: singleton EventSource ref-counted + `useLiveRefetch` (debounce 250ms + fallback poll 30s); MyTickets/StationBoard/LineMap **bỏ polling 4s**. nginx thêm block `/api/events/` unbuffered. Tín hiệu→refetch (server vẫn là nơi lọc quyền). 3 e2e + 4+2 web. *(UX 7.5→8.2)*
- [x] **2.2 Notification center 🔔** — ✅ XONG 2026-07-27: bảng `notification` (1 dòng/sự kiện, addressed theo `recipient_sub` HOẶC `recipient_role`) + `notification_read` (đã-đọc per-user), ghi bằng TRIGGER trong txn transition (bắt mọi writer). Applicant: Trả lại/Hoàn tất. DCC: hồ sơ vào inbox vai (Pool/Dcc2/Dcc3/Hardcopy). **Đọc là của riêng từng người**; thông báo theo-vai **tự tan cho cả nhóm** khi ticket rời ga (suy ở read, AD-6). Chuông 🔔 + badge + dropdown + deep-link theo mã, ăn SSE 2.1. 7 e2e + 6 domain + 10 web. *(UX →8.5)*
- [~] **2.3 Ủy quyền khi vắng mặt** — ⛔ BỎ (chốt 2026-07-27, lý do kiến trúc): bảng điều độ DCC **vốn đã chung theo vai** (`listByFlows`, không phải theo người) và `transition()` chặn theo **vai** chứ không theo cá nhân → một group 2–3 DCC thì ai cũng thấy + bốc xử lý hồ sơ đồng nghiệp đang giữ ngay, KHÔNG cần cơ chế ủy quyền/act-as. Thứ duy nhất riêng-theo-người là **digest sáng + thông báo đích danh** của người vắng — giải quyết tự nhiên bằng **2.5 escalation ladder** (hồ sơ sắp trễ không ai động → CC cả ga → Admin/Andy), tức "vắng mặt" được cover bởi *leo thang*, không phải *khai báo vắng*. Tránh nợ một bảng + trang quản lý cho giá trị ~0.
- [x] **2.4 Trang analytics quản lý** — ✅ XONG 2026-07-27: domain thuần `analytics/*` (dwell reconstruct từ khoảng-cách 2 event liên tiếp · throughput created↔completed bucket tuần/tháng theo lịch ICT · return rate/luồng · top-overdue live qua SlaClock · CSV BOM). Đọc **toàn bộ `ticket_event`** (all-time, bounded on-prem) nên timeline không bị cắt; `GET /admin/analytics` + `/analytics/export` (CSV UTF-8, mở thẳng Excel). Trang Admin "Analytics": heatmap ga×luồng, biểu đồ cột vào↔ra + toggle tuần/tháng, thanh Return, top-10 trễ deep-link. Mọi số derive ở read (AD-6), không bảng mới. 18 domain + 3 e2e + 4 web. *(Tính năng →8.5)*
- [x] **2.5 SLA escalation ladder** — ✅ XONG 2026-07-27: domain thuần `notify/escalation.ts` (`escalationIntent` → warn/overdue/critical theo overdue+daysLeft, cấu hình `warnDays`/`criticalOverdueDays` qua env, không hardcode). Scheduler giờ (`escalation.scheduler.ts`, gate `QLHS_DISABLE_CRON`) quét mọi hồ sơ DCC đang chạy, **pause-adjusted** (F8), leo thang: **sắp trễ → nhắc người giữ** (recipient_sub, hoặc role nếu chưa ai bốc) → **trễ → CC cả ga** (recipient_role owner — đây cũng là cách cover người vắng, thay 2.3) → **trễ ≥N → báo Admin** (recipient_role Admin). Ghi thẳng vào bảng `notification` 2.2 nên **hiện trên chuông + tự-resolve khi hồ sơ rời ga**; partial unique index `(ticket_id,kind,waiting_status) WHERE kind LIKE 'Escalate%'` khiến quét mỗi giờ **idempotent** (một tier/ga, re-arm khi chuyển ga hoặc lên tier cao hơn). Applicant-owned/terminal do Return-reminder lo, không leo thang. 9 domain + 6 e2e + 1 web. *(Andy là actor NGOÀI hệ thống không login → tầng management = Admin in-app; email cho Andy để lại F-tier.)*

## 🟨 ĐỢT 3 — Hoàn thiện chuẩn sản phẩm → mục tiêu 9.0

- [x] **3.1 E2e browser Playwright** — ✅ XONG 2026-07-27: 3 hành trình vàng lái browser thật (Playwright chromium). **General** trọn vòng (tạo→bốc→sinh mã→Andy Hoàn tất) · **Contract** đủ ga (Pool→Andy→DCC2 handover→ACC→BOP→DCC2 hardcopy→Completed, qua lại DCC1↔DCC2 4 lần, 3 modal) · **Payment** bị Return (DCC3 đẩy ngược→DCC1 Trả lại). Harness: Playwright tự dựng API build (`:3100`) + vite dev (E2E=1 ép HTTP `:5273`) → **cổng riêng, KHÔNG đụng docker/dev**; auth qua `dev-login`; **DB `qlhs_e2e` tách biệt** (owner reset giữa test, không mất data dev); assert lai trạng thái đã-persist qua `pg` (poll tránh race). Cắm vào CI 1.1 (job `e2e`, dùng DB `qlhs` fresh của CI). Chạy xanh cục bộ 2 lần liên tiếp (ổn định). *(Test 8.0→9.0)*
- [x] **3.2 Metrics + alert** — ✅ XONG 2026-07-27: `GET /metrics` Prometheus (dependency-free, `domain/metrics/prometheus.ts` thuần) — gauge hồ sơ theo luồng×trạng thái, `sla_pauses_open` (F8), `mail_outbox`/`digest_outbox` pending·failed (AD-15/F11), uptime; token-gate tùy chọn `QLHS_METRICS_TOKEN`, **miễn throttler**. Cảnh báo outbox tồn đọng: `OpsHealthScheduler` hằng giờ (gate `QLHS_DISABLE_CRON`) + `domain/metrics/backlog.ts` thuần → **1 dòng log JSON/giờ** WARN (pending ùn) / ERROR (mail **mất** — failed>0) cho Loki/journald, **không đụng chuông** (log cho operator, chuông cho người). Số derive ở read (AD-6), không bảng mới. Runbook `docs/QLHS-observability.md` (scrape config + alert-rule mẫu). 11 domain + 4 unit + 3 e2e. *(Vận hành →8.0)*
- [~] **3.3 i18n** — ⏸ HOÃN Sprint 4 (đã chốt): làm sau khi tính năng ổn định; là refactor cơ học lớn, chỉ làm khi thật sự cần song ngữ.
- [x] **3.4′ Responsive nội bộ + PWA-lite** — ✅ XONG 2026-07-27 (thay 3.4 gốc). **3.4 gốc "mobile view người duyệt cho Andy/ACC/BOP" ⛔ BỎ**: họ là actor NGOÀI hệ thống, KHÔNG login (chốt F11/2.5) → không có trang để cho họ xem/duyệt. Làm bản nội bộ: (1) **sửa body h-scroll** — DCC home là CSS grid bọc LineMap+StationBoard; grid item mặc định `min-width:auto` nên kéo cả trang rộng ~1532px (lỗi cả laptop <1590px, không riêng phone) → `.dcc-home > * { min-width: 0 }` để line-map/workbox cuộn ngang TRONG hộp của nó. scrollWidth 1546→390 ở viewport 390px. (2) **PWA-lite**: `manifest.webmanifest` (standalone, theme/bg color) + `icon.svg` (brand line-map) + favicon + apple-touch + theme-color theo light/dark → "Thêm vào màn hình chính". KHÔNG service worker (tránh vỡ SSE/auth). 1 e2e (assets served) + 3 golden journey vẫn xanh.

---

## 💡 BACKLOG TÍNH NĂNG MỚI (đề xuất — chọn dần vào các sprint)

> **Thứ tự thực hiện bộ F12 → F8 → F11 (chốt 2026-07-26):**
> ① **F12** trước — nhỏ nhất (~1–1.5 ngày), backend Return từ pool đã sẵn, chỉ nối query + UI; giao được giá trị ngay cho DCC1. Tầng ①② làm trước, tầng ③ (pg_trgm) ghép cùng F13 sau được.
> ② **F8** kế — nặng domain (~2 ngày): migration `paused_at` + audit kinds + sửa `overdue()`/`dwell()` (TDD thuần, phủ biên kỹ).
> ③ **F11** cuối (~1.5–2 ngày) — **phụ thuộc F8**: digest tính "sắp trễ/trễ" bằng `overdue()`; làm trước F8 thì digest sẽ nhắc oan hồ sơ đang pause → thành spam, đúng cái ta muốn tránh.

Xếp theo độ "wow" × độ khớp với văn hóa hồ sơ giấy của PMH:

- [ ] **F1. Chế độ TV "phòng điều độ"** — route `/wall` full-screen cho màn hình lớn treo phòng DCC: line-map phóng to, hồ sơ chạy real-time (ăn theo SSE 2.1), đồng hồ + đếm hồ sơ trễ. Biến bản sắc thiết kế thành hiện diện vật lý — demo cho lãnh đạo cực kỳ ấn tượng.
- [ ] **F2. Hành trình hồ sơ (metro replay)** — trong ticket detail, vẽ lại đường đi trên line-map: ga đã qua sáng dần theo timestamp, ga hiện tại nhấp nháy, dwell từng ga. Dữ liệu sẵn trong `ticket_event` + `TimelineEntry`.
- [ ] **F3. Command palette `Ctrl+K`** — gõ mã/tên hồ sơ/người tạo → nhảy thẳng detail; kèm lệnh nhanh ("Tạo hồ sơ Payment"…).
- [ ] **F4. QR trên bản cứng + phiếu bìa in tự động** — nút "In phiếu bìa": trang in gồm mã hồ sơ, luồng, QR trỏ deep-link. DCC2/DCC3 quét bằng điện thoại → mở ticket → bấm "Đã nhận". Cầu nối vật lý–số đúng triết lý không-đính-kèm-file.
- [ ] **F5. Trao đổi trên hồ sơ (comment + @mention)** — thread nhẹ tách riêng khỏi `ticket_event` (giữ bất biến một-writer); @mention bắn vào notification 2.2. Giảm Return "chỉ để hỏi một câu".
- [ ] **F6. Biên bản bàn giao in được** — mỗi lần handover DCC1→DCC2/DCC3 sinh phiếu bàn giao (danh sách hồ sơ, người giao/nhận, ngày giờ) để ký nhận bản cứng — khớp quy trình giấy thực tế.
- [ ] **F7. Template hồ sơ định kỳ** — nâng `CreateFromExistingUseCase` thành template có tên ("Thanh toán điện tháng…"); Payment lặp hàng tháng là pattern chắc chắn có.
- [x] **F8. SLA pause "chờ bổ sung"** — ✅ ĐÃ CHỐT SPEC (2026-07-26): KHÔNG thêm status mới; cờ `paused_at` + cặp audit `SlaPaused`/`SlaResumed` bắt buộc lý do; `overdue()`/`dwell()` trừ khoảng pause; badge "⏸ chờ bổ sung" trên card. **Chỉ người đang giữ hồ sơ** được pause/resume. Chống lạm dụng: ✅ ĐÃ LÀM 2026-07-26 — trang Admin **"Tạm dừng SLA"** liệt kê mọi đồng hồ đang dừng (lâu nhất lên đầu, cờ "quá lâu" ≥5 ngày làm việc) + tần suất pause theo ga 30 ngày; số hồ sơ đang dừng hiện luôn ở Tổng quan.
- [ ] **F9. Theo dõi hồ sơ (watch/follow)** — nhận notification cho hồ sơ mình không giữ nhưng quan tâm (sếp theo dõi hồ sơ gấp).
- [ ] **F10. Bộ lọc đã lưu + chia sẻ** — lưu filter hay dùng ("Payment trễ tuần này"), chia sẻ cho đồng nghiệp cùng vai.
- [x] **F11. Email digest buổi sáng** — ✅ ĐÃ CHỐT SPEC (2026-07-26): chỉ gửi **DCC1/DCC2/DCC3** (Andy/ACC/BOP là actor NGOÀI hệ thống, không đăng nhập — role.ts; Applicant đã có email sự kiện). Ngày làm việc 7h30, **tối đa 1 email/người/ngày** (UNIQUE recipient+date trên outbox), **không có việc đáng nói → không gửi** (chỉ gửi khi giữ hồ sơ sắp trễ ≤1 ngày / đã trễ / chờ xác nhận). Toggle tắt/bật per user. Escalation SLA (2.5) sau này gộp vào digest thay vì email lẻ.
- [x] **F12. Cảnh báo hồ sơ trùng** — ✅ ĐÃ CHỐT SPEC (2026-07-26): **DCC1 ở pool là người quyết định**, không chặn Applicant.
  - Nhận biết 3 tầng: ① MẠNH: cùng luồng + `contractNo` + `amount` với hồ sơ đang mở; ② VỪA: cùng `contractor` + `amount` trong 30 ngày (kể cả đã đóng); ③ NHẸ: `description` tương tự (pg_trgm ≥ 0.5, không dấu) cùng người nộp 30 ngày. (`documentNo` kế toán chỉ có ở bước gửi ACC — không dùng lúc tạo.)
  - `ListPoolUseCase` trả thêm `dupOf[]`; card pool hiện badge ⚠ "nghi trùng", **hover** popover đối chiếu (mã, trạng thái, số tiền, nhà thầu, ngày).
  - DCC1 cho qua → Tiếp nhận/Sinh mã như thường; trùng thật → **nút "Trả lại" trên card pool** — cạnh domain `Submitted --SendBack--> Returned` (shared.ts, FR-15) + API `POST /dcc1/tickets/:id/action` ĐÃ CÓ SẴN, chỉ thiếu nút ở UI (station-board.usecase.ts hiện chỉ trả PICK/CONFIRM cho pool). Lý do gợi ý sẵn "Trùng với hồ sơ QLHS-xxx".
  - Applicant vẫn thấy gợi ý nhẹ (tầng ③) khi đang gõ form — thông tin, không chặn.
- [ ] **F13. Tìm kiếm tiếng Việt không dấu** — Postgres `unaccent` + index cho search toàn cục (nền cho F3).
- [ ] **F14. Tour onboarding** — lần đầu đăng nhập theo vai nào thì tour hướng dẫn đúng màn hình vai đó.

---

## Nhật ký thực hiện

| Ngày | Mục | Commit | Ghi chú |
|---|---|---|---|
| 2026-07-26 | F12 | (nhánh refactor/auth-repo-and-css-fonts) | Domain `duplicate.ts` 2 tầng + `ScanDuplicatesUseCase` + badge ⚠ hover trên card Pool + nút Trả lại (dẫn xuất từ state machine, không hardcode). 18 unit + 5 e2e. Tầng ③ pg_trgm hoãn sang F13. |
| 2026-07-26 | F8 | (nhánh refactor/auth-repo-and-css-fonts) | Bảng `ticket_sla_pause` + `SlaClock` (một chỗ duy nhất tính SLA, mọi màn hình tự hiểu pause) + ⏸ badge/menu holder-only. 13+8 unit + 10 e2e. KHÔNG ghi `ticket_event` — giữ single-writer AD-4. |
| 2026-07-26 | F11 | (nhánh refactor/auth-repo-and-css-fonts) | Domain `digest.ts` (digest rỗng = `null`, không gửi) + `digest-template.ts` + bảng `digest_outbox` UNIQUE(recipient,ngày) + scheduler cron 7h30 T2–T6 + dispatcher dựng lại nội dung lúc gửi + công tắc 🔔 "Nhắc sáng" trên topbar. 23 unit + 9 e2e + 4 web. |
| 2026-07-26 | 1.4 | (kèm F8) | Tách `StationBoard.tsx` 410→272 dòng (`cardAction.ts` + `ask.ts`) theo quy ước ≤300. |
| 2026-07-26 | F8 (nợ giám sát) | (nhánh refactor/auth-repo-and-css-fonts) | Trả nốt phần chống lạm dụng của spec F8: cột `status` ghi **ga lúc dừng** (đọc `ticket.status` lúc báo cáo sẽ đổ oan sai ga cho pause đã resume) + domain `pause-report.ts` + `GET /admin/sla-pauses` + trang Admin "Tạm dừng SLA" + `pausedTotal` ở Tổng quan. 11 unit + 7 e2e + 6 web. |

---

## 🔍 Kết quả code review F8 / F11 / F12 (2026-07-26)

Ba lớp review độc lập (adversarial · edge-case · acceptance) trên dải `133785d~1..1ff5b4c`.
Đã tự đọc code kiểm chứng trước khi xếp hạng. **Bất biến kiến trúc GIỮ ĐƯỢC HẾT**: AD-2 (chỉ `transition()` đổi status), AD-4 (`ticket_event` một writer — pause cố ý không ghi vào đây), AD-6 (SLA derive ở read), AD-7 (dùng `sub`), AD-17 (nút Trả lại dẫn xuất từ state machine), `domain/**` không import framework, mọi file ≤300 dòng.

### Đã quyết + đã sửa (5) — 2026-07-26

- [x] **[Decision→XONG] Pause không được đóng khi hồ sơ sang ga khác** → chốt: **tự động resume khi chuyển ga**, ép bằng TRIGGER `ticket_close_sla_pause` (6 repo cùng ghi chuyển ga, vá ở use-case sẽ sót). — không có gì trong `transition()` đóng pause đang mở. Sau khi chuyển ga, `windowsFor()` bỏ qua cửa sổ cũ (lọc `pausedAt >= statusEnteredAt`) nên UI báo "không pause" và mời bấm Dừng, nhưng `openFor()` vẫn thấy dòng mở → API trả 409 vĩnh viễn; partial unique index khiến không bao giờ chèn được dòng mới. Dòng ma cũng nằm mãi trong `pausedTotal` + danh sách giám sát. Nặng nhất trong toàn bộ review. `sla-pause.repo.ts:22,72`
- [x] **[Decision→GIỮ NGUYÊN] Pause qua đêm được tha trọn một ngày làm việc** → chốt 2026-07-26: **giữ đơn vị NGÀY**, pause qua ngày tính 1 trở lên. ⚠️ RỦI RO ĐÃ BIẾT & ĐÃ CHẤP NHẬN: pause 16h55→8h05 vẫn được tha 1 ngày; lặp mỗi tối = tha cả tuần SLA mà không chạm cờ 'quá lâu'. Đối trọng duy nhất là trang giám sát Admin. — `businessDaysBetween` đếm theo mốc ngày dân sự, nên pause 16:55 T2 → 08:05 T3 = 1 ngày được trừ, còn pause 09:00→17:00 cùng ngày = 0 ngày. Làm mỗi tối 5 hôm = tha cả tuần SLA mà không để lại dòng "quá lâu" nào cho Admin thấy. `domain/sla/business-days.ts:32`
- [x] **[Decision→XONG] Digest gửi DCC1 mỗi sáng bất kể gấp hay không** → chốt: Pool chỉ báo khi **hết hạn mức hôm nay hoặc đã trễ** (`daysLeft <= 0`), chặt hơn hồ sơ tự giữ (`<= 1`) vì ngưỡng Submitted mặc định chỉ 1 ngày — nếu không thì hồ sơ vừa nộp đã là 'sắp trễ' và lại thành thư hằng ngày. — nhánh `awaiting` chỉ lọc `!paused`, không lọc ngưỡng/tuổi, và được nạp toàn bộ Pool. Pool gần như không bao giờ rỗng ⇒ email hằng ngày ⇒ đúng cái "thành spam" đã lo. Nhánh `held` thì lọc đúng. `domain/notify/digest.ts:63`
- [x] **[Decision→XONG] Hồ sơ đã trễ rồi mới pause thì mất luôn badge ▲** → chốt: hiện **cả hai** (▲ hạ giọng + ⏸), trên cả card lẫn trang chi tiết. — server đã trừ pause khi tính `overdueDays`, FE lại trừ lần nữa: `over = c.overdueDays > 0 && !c.paused`. Hồ sơ trễ 5 ngày, bấm pause → badge đỏ biến mất sau 4s. `BoardCardView.tsx:21`
- [x] **[Decision→XONG] Timeline hồ sơ không lưu dấu vết đã từng dừng đồng hồ** → chốt: **ghép pause vào nhật ký lúc đọc** (`mergeLog`), `ticket_event` vẫn một writer duy nhất (AD-4). — spec F8 yêu cầu cặp audit `SlaPaused`/`SlaResumed`; đã cố ý bỏ để giữ AD-4 một-writer. Hệ quả: resume xong là không còn dấu vết trên hồ sơ, chỉ Admin thấy. Cần chốt: chấp nhận, hay thêm `pause` vào timeline dựng ở read từ `ticket_sla_pause`.

### Patch — ĐÃ SỬA HẾT 17/17 (2026-07-26)

- [x] [Patch] Tổng quan Admin đếm quá-SLA **không trừ pause** — `summarizeLines` dùng `statusEnteredAt` thô, là read path duy nhất `SlaClock` bỏ sót [`domain/admin/overview.ts:50`]
- [x] [Patch] `addBusinessDays` tính theo ngày UTC trong khi phần còn lại tính theo lịch Asia/Ho_Chi_Minh — lệch tới 1 ngày với mốc 17:00–24:00Z [`domain/sla/pause.ts:35,41`]
- [x] [Patch] So trùng bỏ qua `currency` dù có mang và có hiển thị — 50.000 USD ≡ 50.000 VND [`domain/ticket/duplicate.ts:76`]
- [x] [Patch] Không chặn pause hồ sơ đã đóng; báo cáo cũng liệt kê pause của hồ sơ đã đóng như đồng hồ đang chạy [`sla-pause.usecase.ts:27`, `sla-pause.repo.ts:38`]
- [x] [Patch] Hai request pause đồng thời → Prisma P2002 chưa map → 500 thay vì 409 [`sla-pause.usecase.ts:31`]
- [x] [Patch] N+1: `sla.threshold()` gọi mỗi ticket, ×2 query, chạy 2 lần/người/ngày [`build-digest.usecase.ts:43`]
- [x] [Patch] Digest mù ga `Submitted to DCC2 (Hardcopy)` — bàn giao 2 pha do DCC2 sở hữu, holder null nên không ai thấy [`build-digest.usecase.ts:16`]
- [x] [Patch] `paused`/`pauseReason` tính cho trang chi tiết nhưng UI không hề render [`TicketDetail.tsx`]
- [x] [Patch] FE nuốt sạch mã lỗi vừa xây (403/400/409) bằng `catch` trống → mọi lỗi thành một câu chung [`cardAction.ts:166`]
- [x] [Patch] Dispatcher digest không khoá dòng (`FOR UPDATE SKIP LOCKED`), cờ chống chạy chồng chỉ trong bộ nhớ → 2 tiến trình gửi 2 lần [`digest.dispatcher.ts:46`]
- [x] [Patch] `resume()` dùng `new Date()` thay vì `SystemClock` đã inject [`sla-pause.repo.ts:55`]
- [x] [Patch] 10 import chết còn lại trong `StationBoard.tsx` sau khi tách [`StationBoard.tsx:3-26`]
- [x] [Patch] Cửa sổ trùng MEDIUM so tuổi ứng viên với `now` chứ không so hai hồ sơ với nhau [`duplicate.ts:88`]
- [x] [Patch] Cờ "quá lâu" bật tại đúng 5 ngày, chữ trên màn hình ghi "Quá 5 ngày" [`pause-report.ts:67`]
- [x] [Patch] Nhãn "30 ngày gần nhất" nhưng truy vấn còn gộp mọi pause đang mở cũ hơn [`sla-pause.repo.ts:45`]
- [x] [Patch] Badge trùng hiện số đã bị cắt (tối đa 5) như thể là tổng thật [`DupBadge.tsx:24`]
- [x] [Patch] Digest bị bỏ qua vẫn ghi `status='sent'`, nhét ghi chú vào `last_error` [`digest.dispatcher.ts:60`]

### Hoãn (9)

- [x] [Defer] Prisma schema không diễn tả được partial unique index → `db push` sẽ xoá mất
- [x] [Defer] `GRANT UPDATE` trên `ticket_sla_pause` mâu thuẫn với việc gọi nó là "bản ghi audit"
- [x] [Defer] Quét trùng O(pool × mọi hồ sơ đang mở) mỗi 4 giây khi poll
- [x] [Defer] `digest_outbox` chưa có prune/retention
- [x] [Defer] `build-digest.usecase.spec.ts` chỉ test bảng tra cứu, không test use-case
- [x] [Defer] `DigestToggle` biến mất im lặng nếu GET hỏng — người dùng hết đường tắt mail
- [x] [Defer] F12 tầng ② gắn cờ hồ sơ Payment định kỳ hằng tháng (đúng spec nhưng ồn)
- [x] [Defer] `digest_date` ép kiểu `::date` theo TZ phiên DB
- [x] [Defer] Applicant không được pause (chặn theo vai) → nhánh pause trong `return-reminder.scheduler` là code chết

### Bác bỏ (2)

- `Submitted to Accounting` bị cho là mù trong digest — sai: `deriveHolder` giao ga này cho chính DCC1 thực hiện nên `listHeldBy` đã phủ.
- Cáo buộc vi phạm AD-2/AD-4 — không có: pause không đổi status và không ghi `ticket_event`.

### Ghi chú sau khi vá (2026-07-26)

- **Trigger `ticket_close_sla_pause`** là bảo đảm mạnh nhất trong đợt này: bất kỳ đường nào đổi `ticket.status` cũng đóng pause đang mở, `resumed_by_sub` để NULL (không ai resume — việc chuyển ga làm). Kéo theo nó tự sửa luôn "pause của hồ sơ đã đóng hiện như đồng hồ đang chạy".
- **Trang giám sát đọc 2 truy vấn**: `listForReport(30 ngày)` cho thống kê theo ga, `listOpen()` cho danh sách đang dừng — nhãn "30 ngày gần nhất" giờ đúng nghĩa, mà pause 8 tuần vẫn không bị rơi khỏi tầm mắt.
- **`digest_outbox` có thêm trạng thái `sending` + `skipped`**: `due()` giành dòng bằng `FOR UPDATE SKIP LOCKED` kèm lease 10 phút (tiến trình chết thì dòng tự về hàng đợi); digest bị bỏ qua không còn ghi nhầm là 'sent'; `markSent` nằm NGOÀI try của `mail.send` để lỗi ghi sổ không gây gửi lại.
- **Nợ còn lại (defer)** giữ nguyên 9 mục ở trên; đáng làm sớm nhất là prune `digest_outbox` và unit test cho `BuildDigestUseCase`.

---

## 🔍 Kết quả code review Đợt 3 (3.1 e2e / 3.2 metrics) — 2026-07-27

Ba lớp review độc lập (adversarial · edge-case · acceptance) trên dải `86df30a..0e61081`. Đã tự đọc code kiểm chứng trước khi xếp hạng. **KHÔNG có finding High. Bất biến kiến trúc GIỮ HẾT**: AD-1 (`domain/metrics/*` không import framework), AD-6 (metrics đếm thô ở read, không bảng mới, overdue để ở Analytics), AD-7 (chỉ nhãn flow/status, không email), AD-4/AD-2 (mọi code mới read-only; TRUNCATE chỉ trong harness bằng vai owner), AD-13 (assert e2e dùng tên trạng thái English canonical). File đều <300 dòng, một-trách-nhiệm-một-file, TDD present (11 domain + 4 unit + 3 e2e).

### Decision (1) — đã xử

- [x] **[Decision→GIỮ NGUYÊN + tài liệu hóa] `cardAction` có thể bắn lặp một action không idempotent (test flaky)** — `expect(...).toPass()` bọc cả `button.click({force})`; board live-refetch làm `<details>` sập giữa chừng → nếu click đã kích hoạt transition rồi mới throw, `toPass` thử lại → hiếm khi bắn lần 2 / treo 15s. Chỉ ảnh hưởng CI/test. **Bạn chọn "harden ngay" (2026-07-27) — tôi đã thử 2 cách guard nhưng CẢ HAI làm ĐỎ cả 3 journey**: fix generic không phân biệt được "action đã bắn" với "nút đang re-render tạm mất" (giữa 2 action liên tiếp, `count()` chớp về 0 khi card dựng lại → nuốt nhầm cú click thật → mint không chạy). Kết luận: **giữ bản gốc đã xanh (×2 lại sau khi revert)**, ghi rõ giới hạn + cách sửa đúng ngay trong comment (`app.ts`): truyền *trạng thái kế tiếp kỳ vọng* vào `cardAction` rồi poll — theo dõi như follow-up. Rủi ro tồn dư: flake hiếm, rerun-green. `apps/web/e2e/support/app.ts:60-82`

### Patch (3) — ĐÃ SỬA HẾT

- [x] **[Patch] Ngưỡng cảnh báo backlog vỡ khi env sai** → thêm `posIntEnv(raw, fallback)`: chỉ nhận số dương hữu hạn, còn lại (rỗng/`NaN`/≤0) về default → `""` không còn thành 0 (spam), `abc` không còn thành `NaN` (tắt âm thầm). +2 unit test khoá hành vi. `apps/api/src/infra/scheduler/ops-health.scheduler.ts`
- [x] **[Patch] `MetricsGuard` so token không constant-time + token rỗng/space** → `crypto.timingSafeEqual` (check độ dài trước) + `?.trim()` để `""`/space coi như chưa cấu hình (mở, không khoá nhầm) + parse `Bearer ` tường minh. +1 e2e (blank token → mở). `apps/api/src/http/metrics/metrics.guard.ts`
- [x] **[Patch] Artifact CI đặt tên sai** → đổi `name: playwright-report` → `e2e-failure-traces` (khớp `path: apps/web/test-results`) + comment nói rõ chỉ có trace/screenshot. `.github/workflows/ci.yml`

### Hoãn (1)

- [x] [Defer] `get-metrics.usecase.ts` chưa có unit test riêng — chỉ phủ gián tiếp qua e2e; là composition mỏng, rủi ro thấp. (Cùng lớp: `escalation.scheduler.ts` cũng dùng `Number(env ?? d)` — sibling tiền-tồn cùng bug env, không thuộc Đợt 3; nên áp `posIntEnv` cho nó ở đợt sau.)

### Bác bỏ (4)

- **`reuseExistingServer: !CI` có thể bám nhầm DB** — thật nhưng xác suất thấp: cổng `:3100/:5273` chọn riêng đúng để tránh va, `workers:1`, chỉ harness này dùng 2 cổng đó. Rủi ro tồn dư chấp nhận được.
- **`MetricsRepo.by()` bỏ bucket status khác `pending/failed`** — đúng thiết kế (gauge chỉ báo pending+failed; `sent/skipped` không quan tâm).
- **`renderPrometheus` không validate tên metric/nhãn theo `[a-zA-Z_]...`** — không tới được: mọi tên metric + khoá nhãn là hằng cứng; chỉ *giá trị* nhãn từ DB và đã được escape đúng (backslash/quote/newline).
- **`vite.config` `Number(VITE_PORT ?? 5173)` NaN khi env xấu** — chỉ dev-tooling, harness luôn set `VITE_PORT=5273`.

---
| 2026-07-26 | 1.1 | (nhánh refactor/auth-repo-and-css-fonts) | CI GitHub Actions: lint+typecheck+test mỗi push/PR; Postgres 18 service, migrate owner→test qlhs_app (append-only thật sự được kiểm). Xác minh cục bộ trọn chuỗi trước khi đẩy. |
| 2026-07-26 | 1.2 | (nhánh refactor/auth-repo-and-css-fonts) | helmet + throttler (5/phút login, 300/phút global) + SameSite=Strict + trust proxy 1; `applyHardening()` dùng chung main+test; 2 e2e mới (hardening headers, login 429). |
| 2026-07-26 | 1.3 | (nhánh refactor/auth-repo-and-css-fonts) | Login hợp nhất identifier-first: 1 ô email → `/auth/probe` → local(mật khẩu)/sso(PMH ID). Xoá 2-nút cũ. `goSso` inject để test được jsdom. |
| 2026-07-27 | 2.1 | (nhánh refactor/auth-repo-and-css-fonts) | SSE real-time: trigger NOTIFY + pg LISTEN + @Sse; web singleton EventSource + useLiveRefetch bỏ polling 4s (fallback 30s). nginx unbuffered cho /api/events/. Thêm dep `pg`. |
| 2026-07-27 | 2.2 | (nhánh refactor/auth-repo-and-css-fonts) | Notification center: trigger ghi notification trong txn; addressed sub|role; read per-user + role tự-resolve khi ticket rời waiting_status; chuông web ăn SSE. |
| 2026-07-27 | 2.3 | — | ⛔ BỎ có lý do: bảng điều độ chung theo vai + transition chặn theo vai → group DCC tự cover; residual (digest/thông báo người vắng) đẩy sang 2.5 escalation. Không viết code. |
| 2026-07-27 | 2.4 | (nhánh refactor/auth-repo-and-css-fonts) | Analytics quản lý: domain `analytics/*` thuần (dwell/throughput/return/top-overdue/csv) đọc all-time ticket_event; `GET /admin/analytics` + export CSV; trang Admin heatmap+cột+Return+top-trễ. Derive ở read, không bảng mới. 18 domain + 3 e2e + 4 web. |
| 2026-07-27 | 2.5 | (nhánh refactor/auth-repo-and-css-fonts) | Escalation ladder: domain `notify/escalation.ts` + scheduler giờ (pause-adjusted, gate cron) ghi tiered notification vào bảng 2.2 (holder→ga→Admin); partial unique index làm idempotent; hiện trên chuông + tự-resolve. Migration `20260727140000`. 9 domain + 6 e2e + 1 web. |
| 2026-07-27 | 1.5 | (nhánh refactor/auth-repo-and-css-fonts) | Backup: service `pg-backup` trong compose (full pg_dump + globals, 30 bản cuốn chiếu) + `ops/backup/*.sh` + runbook. Đã chạy thật 1 lần + test-restore vào DB tạm (sla_config/user_role về đủ). `/backups/` gitignore. |
| 2026-07-27 | 3.1 | (nhánh refactor/auth-repo-and-css-fonts) | Playwright e2e 3 golden journey (General/Contract/Payment) lái browser thật; harness tự dựng API+vite cổng riêng, DB qlhs_e2e tách biệt, dev-login, assert DB qua pg. Job CI `e2e`. `apps/web/e2e/**` + playwright.config + vite.config E2E override. Xanh 2 lần liên tiếp. |
| 2026-07-27 | 3.2 | (nhánh refactor/auth-repo-and-css-fonts) | Metrics + alert: `GET /metrics` Prometheus (dependency-free, domain `metrics/prometheus.ts` thuần) — gauge tickets×flow/status, sla_pauses_open, mail/digest_outbox pending·failed, uptime; token-gate optional `QLHS_METRICS_TOKEN`, miễn throttler. Cảnh báo outbox: `OpsHealthScheduler` hằng giờ (gate cron) + domain `metrics/backlog.ts` → log JSON WARN/ERROR khi ùn/mất mail (không đụng chuông). Runbook `docs/QLHS-observability.md` (scrape + alert-rule). 11 domain + 4 unit + 3 e2e. Số derive ở read, không bảng mới. |
| 2026-07-27 | review Đợt 3 | 0bb0d3e | 3 lớp review (0 High): sửa P1 `posIntEnv` ngưỡng backlog (chống env rỗng/NaN tắt cảnh báo âm thầm) + P2 `MetricsGuard` timingSafeEqual & trim token + P3 tên artifact CI. D1 cardAction thử harden ×2 đều đỏ suite → giữ bản gốc + tài liệu hóa. API 520 xanh. |
| 2026-07-27 | 3.4′ | (nhánh refactor/auth-repo-and-css-fonts) | Responsive nội bộ + PWA-lite (3.4 gốc bỏ: Andy/ACC/BOP không login). Sửa body h-scroll: `.dcc-home > * { min-width:0 }` cho grid bọc line-map+workbox → cuộn ngang trong hộp (scrollWidth 1546→390 @390px, lợi cả laptop <1590). PWA-lite: manifest + icon.svg + theme-color + apple-touch, KHÔNG service worker. 1 e2e assets + 3 golden journey xanh. |
| 2026-07-27 | copy audit (tiền 3.3 i18n) | (nhánh refactor/auth-repo-and-css-fonts) | Chuyên gia UX-writing quét toàn UI (5 vùng song song) → 36 câu dài/vô nghĩa/sai vị trí. User chốt từng câu. Nổi bật: bỏ jargon DB lộ ra (ticket_event/append-only/derive ở read/console/sub/Directory/pause/throughput); nhãn hành động sai vai **Andy→"Sếp"** ("Sếp đã duyệt→Hoàn tất", "Trình Sếp"), "BOP đã duyệt"; rút gọn nhãn nút; chip vai "DCC1·Cả 3 tuyến"; bỏ 8 eyebrow trang admin + vài caption thừa (id.pmh, thêm·sửa·tắt, append-only). Sửa 3 e2e + 2 web spec cho khớp nhãn mới. Là danh mục chuỗi để bóc vào catalog i18n sau. Web 106 + e2e 4 + API xanh. |
