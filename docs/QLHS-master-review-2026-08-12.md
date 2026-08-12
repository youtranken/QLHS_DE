# QLHS — Đánh giá toàn bộ nhánh `master` (2026-08-12)

**Phạm vi:** 55 commit trên `master` (`youtranken/QLHS_DE`), ~27.4k dòng TS/TSX, apps/api (DDD) + apps/web (React) + packages/contracts.
**Phương pháp:** 6 chuyên gia độc lập (Domain/State-machine · Backend/API · Database · Security · Frontend · Commit-history/Concurrency) quét song song → gộp trùng → **kiểm chứng đối kháng** mọi phát hiện CRITICAL/HIGH (verifier cố phản bác, chỉ giữ cái dựng được kịch bản lỗi cụ thể). DB được chạy lại một lượt riêng do lượt tự động đầu bị lỗi output.

---

## 1. Điểm số theo mảng

| Mảng | Điểm | Nhận định 1 dòng |
|---|---|---|
| Domain & State-machine | **6.5** | Lõi state-machine rất chắc; kéo điểm là bất biến contractNo/paymentNo chỉ được ép ở **form React**, không ở server |
| Backend / API | **7.0** | Transaction atomic, DTO có cap, unique index là chốt TOCTOU thật; hở ở clone + updateFields |
| Database & Data-integrity | **8.5** | Numbering atomic, FOR UPDATE + audit cùng tx, index đúng & case-safe cho Contract; hở nhỏ ở Payment-No case-sensitive + ledger chưa append-only |
| Security / Auth / RBAC | **8.5** | Phân quyền nhiều lớp, object-level auth thật, không có lỗ IDOR/CRITICAL; chỉ thiếu idle-timeout + SMTP-test SSRF |
| Frontend / React / UX | **8.0** | Optimistic rollback, chống double-submit, i18n parity ép ở compile-time; 1 dead-end UX nhỏ |
| Commit-history & Concurrency | **7.0** | Concurrency đã trưởng thành qua 23 commit fix; regression duy nhất rò ra là đợt tách contractNo/paymentNo |

**Điểm tổng thể ≈ 7.6 / 10** — "chạy tốt trong thực tế, nhưng còn một mạch gap có hệ thống chưa đóng". Không có lỗi CRITICAL. Không có lỗ hổng bảo mật HIGH.

---

## 2. "Cái còn thiếu mà bạn cảm nhận" — một nguyên nhân gốc, 4 biểu hiện

Cả 4 chuyên gia độc lập (Domain, Backend, History, DB) hội tụ về **cùng một điểm**: đợt tách `documentNo → contractNo + paymentNo` (commit `cd8f983`, thay đổi lớn gần nhất) **ép bất biến ở tầng UI React chứ chưa ép ở server** — vi phạm chính nguyên tắc AD-16 "enforce server-side" của dự án. UI hiện tại che được đường thường, nên test xanh và demo chạy, nhưng invariant thật đang hở.

Bất biến bị hở: *"Với hồ sơ luồng Contract, cột Contract No là của DCC2; slot của Applicant phải là `N/A`."* Server không nơi nào ép điều này.

Bốn biểu hiện:

### 🔴 HIGH-1 — Clone (FR-3) hỏng cho mọi hồ sơ Contract đã có số *(đã kiểm chứng: CONFIRMED)*
`apps/api/src/application/lifecycle/create-from-existing.usecase.ts:37`
`CreateFromExisting` copy `contractNo` nguyên xi từ nguồn. Clone một hồ sơ Contract đã qua DCC2 (đã có `contract_no='CT-ACC-42'`) → ticket mới ở trạng thái `Submitted` mang đúng số đó → **đụng partial-unique index** `ticket_contract_no_contract_key` → `P2002` → `DocumentNoDuplicateError`. Nghĩa là **tính năng clone tài liệu (FR-3) không bao giờ chạy được cho hồ sơ Contract đã có số** — đúng trường hợp phổ biến nhất người dùng muốn clone. Endpoint `POST /applicant/tickets/from/:sourceId` là live, không qua form nên không có lớp che `N/A`.
**Fix:** sau khi resolve flow, `fields.contractNo = flow === FLOW.Contract ? 'N/A' : (source.contractNo ?? '')`. Thêm test clone nguồn Contract có số → thành công với `N/A`.

### 🟠 MEDIUM-1 — Applicant ghi đè được Contract No của DCC2 ở Return-fixing *(kiểm chứng: CONFIRMED, hạ HIGH→MEDIUM)*
`apps/api/src/infra/prisma/ticket/ticket-write.repo.ts:149`
`updateFields` ghi `contractNo` vô điều kiện trong cửa sổ sửa. Guard duy nhất sau khi đã cấp code là *flow-crossing* (`resolvedFlow !== t.flow`), **không** chặn sửa chính Contract No. Hồ sơ Contract bị ACC/BOP trả về tới Return-fixing (đã có số DCC2 cấp) → applicant PATCH một `contractNo` khác → server ghi đè số "authoritative", trong khi audit `SendToAccounting` vẫn ghi số cũ → **state và audit bất biến lệch nhau**. Verifier hạ xuống MEDIUM vì: lối ra Completion luôn phải qua DCC2 `SendToAccounting` (ghi lại số mới), có audit `field_changed`, và va chạm bị index chặn — nên hại thực tế bị chặn trên. Nhưng đúng là commit `cd8f983` đã thêm guard server cho **Document Type (#2)** mà **bỏ sót cho Contract No (#3)**.
**Fix:** khi `t.code !== null` và flow Contract → ép `next.contractNo = t.contractNo` (hoặc throw `FieldsLockedError` nếu khác), đối xứng với cách `flow` bị ghim.

### 🟠 MEDIUM-2 — Payment No lưu **phân biệt hoa/thường**, lệch với Contract No *(mới, từ lượt DB)*
`apps/api/src/infra/prisma/ticket/accounting.repo.ts:63`
`storedNumber = flow === Payment ? documentNo : documentNo.toUpperCase()` — Contract No được uppercase, Payment No lưu nguyên. Index `ticket_payment_no_active_key` trên cột thô ⇒ case-sensitive; pre-flight `existingDocumentNos` cũng chỉ trim, không uppercase. Kịch bản: đã tồn tại Payment `PMT-A1`; DCC3 gửi `pmt-a1` → pre-check báo "chưa có", index cho qua → **hai hồ sơ Payment sống cùng số thật chỉ khác hoa/thường** — đúng vi phạm 1-1 mà đợt tách muốn ngăn. Chính migration đã coi case-collision là bug đáng chặn *cho Contract* nhưng không làm cho Payment.
**Fix:** chuẩn hoá Payment No đối xứng (uppercase, hoặc index trên `upper(payment_no)` + `citext`) ở `submitToAccounting`, ở nhánh Payment của `existingDocumentNos`, và backfill dữ liệu cũ. Nếu Payment No chắc chắn chỉ số → ghi rõ giả định.

### 🟠 MEDIUM-3 — Luật "trùng khi tiếp nhận" trở nên vô nghĩa cho cả luồng Contract *(logic)*
`apps/api/src/domain/ticket/duplicate.ts:88`
Luật F12 cần trùng Document Type + Contract No + Project/Team. Nhưng ở cổng DCC1, hồ sơ Contract luôn mang `contract_no='N/A'` (DCC2 mới cấp số thật về sau) và `contractKey('N/A')='NA'` (khác null) → điều kiện số-hợp-đồng **luôn đúng** → phép so trùng co lại còn `documentType+projectTeam`. Kết quả: DCC1 nhận **cảnh báo trùng giả** cho các hồ sơ Contract khác nhau cùng team+loại trong 30 ngày → badge "trùng" thành nhiễu, làm khó phát hiện re-submit thật. Chỉ là gợi ý (không chặn cứng) nên không hỏng dữ liệu.
**Fix:** coi `'N/A'` là *vắng* (trả `null` từ `contractKey` khi giá trị gập là `'NA'/'N/A'`); có thể tăng cường luồng Contract bằng contractor+amount đã có sẵn trên `DupSubject`.

> **Kết luận mạch gap:** ép bất biến contractNo/paymentNo ở **server** (create / clone / update-fields) tại một chỗ tập trung, để UI chỉ còn là lớp tiện dụng chứ không phải lớp bảo vệ duy nhất. Đây là việc đáng làm trước tiên.

---

## 3. Các phát hiện còn lại

| # | Mức | Mảng | Vấn đề | Vị trí |
|---|---|---|---|---|
| 4 | MEDIUM | DB | Migration split **non-idempotent** (`ADD COLUMN` không `IF NOT EXISTS`) + guard `RAISE EXCEPTION`: nếu dữ liệu prod va chạm case, `migrate deploy` fail lúc boot → có thể để schema dở, re-run lại fail "column exists" → crash-loop | `migrations/20260812120000_split_contract_payment_no/migration.sql:11,28-40` |
| 5 | MEDIUM | DB | **Append-only chỉ thật với `ticket_event`.** `notification`, `processed_webhook_event`, `ticket_sla_pause`, các outbox… vẫn được `qlhs_app` GRANT UPDATE/DELETE (default privileges). Là finding B4 (review 08-03) **vẫn mở** | `migrations/20260710170137_ticket_audit_sla/migration.sql:87` |
| 6 | LOW→MED | DB/Ops | `connection_limit` không set trên `DATABASE_URL` + analytics aggregate toàn bảng `ticket_event` không cửa sổ ngày ⇒ rủi ro khi scale-out + chậm dần theo thời gian | `docker-compose.prod.yml:39`, `analytics.repo.ts:41-88` |
| 7 | LOW | Security | **Không có idle/inactivity timeout** — session sống tới hạn tuyệt đối 12h dù không hoạt động; rủi ro máy kiosk/bỏ mở | `apps/api/src/infra/session/session.store.ts:43` |
| 8 | LOW | Security | Admin **SMTP-test = máy quét cổng nội bộ / SSRF oracle**: nối TCP tới host:port tuỳ ý, lỗi thô trả về client phân biệt open/closed | `application/admin/test-smtp.usecase.ts:22`, `admin-config.controller.ts:47` |
| 9 | LOW | Frontend | Chọn thủ công **lẫn nhóm** (General + Contract/Payment) ở cột Andy → thanh bulk hiện "N đã chọn" nhưng **0 nút hành động** (dead-end) | `apps/web/src/features/board/StationBoard.tsx:276`, `BulkActionBar.tsx:35` |
| 10 | LOW | Domain | **Không pause được SLA** ở các ga chờ-ngoài holder-null (vd `Submitted to Accounting`, owner DCC1 nhưng do DCC2 bấm ⇒ holder=null) → `NotHolderError` | `application/sla/sla-pause.usecase.ts:71` |
| 11 | LOW | DB | Pre-check va chạm của migration false-positive với hàng Contract `'n/a'` chữ thường (lọc `<> 'N/A'` case-sensitive trước khi uppercase) | `migration.sql:32-36` |
| 12 | LOW | DB | Thiếu FK từ các bảng gắn-ticket (`notification`, `ticket_lock`, `ticket_view`, outbox…) về `ticket` — chỉ lý thuyết vì ticket không bao giờ bị xoá | `schema.prisma` |

---

## 4. Điểm mạnh đã xác nhận (không phải lỗi — để khỏi "sửa nhầm")

- **State-machine**: tập cạnh đóng & theo luồng; `transition()` là **writer status duy nhất**; round chỉ tăng ở return "nặng" (`enteredFlow`); numbering atomic có rollback (không nhảy số).
- **Concurrency**: mọi status-write qua `SELECT … FOR UPDATE` + audit cùng transaction; soft-lock là upsert `ON CONFLICT` (đúng một racer thắng); SLA có partial-unique "một pause mở/ticket" + trigger tự đóng pause khi chuyển trạng thái; webhook idempotent theo `event_id`; undo re-check `status==edge.to` trong lock.
- **Security**: `AuthGuard` đọc lại role từ DB mỗi request (thu hồi tức thì); object-level auth thật (applicant mutation re-scope theo `applicantSub`; ticket-detail chặn deep-link chéo bằng 404 không lộ oracle); mọi admin surface Admin-only; webhook HMAC timing-safe + fail-closed; CSV chống formula-injection; SMTP password AES-256-GCM; break-glass scrypt + khoá theo IP.
- **Frontend**: optimistic + rollback nhất quán; chống double-submit bằng `inFlightRef`; refetch-after-mutation qua SSE/`useLiveRefetch`; **i18n vi/en parity ép ở compile-time** (`MessagesShape`) — không có key render thô; `tsc --noEmit` xanh.
- **DB**: index Contract-No đúng & case-safe; Cancelled-nhả-số nhất quán, không reopen-vào-va-chạm; audit `ticket_event` bất biến 3 lớp (REVOKE + trigger + từ chối superuser lúc boot).

---

## 5. Thứ tự đề xuất xử lý

1. **Đóng mạch gap server-side (HIGH-1, MED-1, MED-2, MED-3):** ép bất biến contractNo/paymentNo tập trung ở create/clone/update-fields; chuẩn hoá case Payment No; coi `'N/A'` là vắng trong luật trùng. → khôi phục FR-3, đóng lệch state/audit, chặn dup Payment.
2. **Robust migration (MED-4) + append-only ledger (MED-5):** `IF NOT EXISTS`/xác nhận transaction cho migration split; `REVOKE UPDATE,DELETE` cho `processed_webhook_event` (& cân nhắc `ticket_sla_pause`).
3. **Hardening bảo mật (LOW-7, LOW-8):** idle-timeout 30–60' cạnh cap 12h; allow-list/chặn dải private cho SMTP-test + trả lỗi generic.
4. **Polish (LOW-6,9,10,11,12):** set `connection_limit` + cửa sổ hoá analytics; hint cho bulk-bar mixed-selection; quyết định rõ pause ở ga holder-null; sửa pre-check `'n/a'`.

*Phát hiện đã kiểm chứng đối kháng: 2/2 CONFIRMED, 0 false-positive. Không phát hiện lỗi CRITICAL hay lỗ hổng bảo mật HIGH trên `master` hiện tại.*
