# QLHS — Luồng xử lý hồ sơ (đọc cho người mới) · từng bước gửi/nhận + SLA

> Tài liệu người-đọc, bám theo state machine chốt trong `prd.md §4.2/§8.2` và `ARCHITECTURE-SPINE.md`. Cập nhật 2026-07-10 (đã áp toàn bộ quyết định design-review).
> **Tên trạng thái = tiếng Anh canonical**; chú thích tiếng Việt chỉ để đọc.

## 👥 Nhân vật
- **Applicant** — nộp hồ sơ (chỉ thấy hồ sơ của mình).
- **DCC1** — điều phối, thấy **cả 3 luồng**; vai **duy nhất** bấm Return / Reopen / nhận-từ-ACC / trình-BOP.
- **DCC2** — xử luồng **Contract**. **DCC3** — xử luồng **Payment**.
- **Andy** (VP ký) · **ACC** (Kế toán) · **BOP** (Ban Giám đốc) — **ở ngoài hệ thống**; DCC nhập hộ kết quả.

## ⏱️ SLA hoạt động thế nào
- Mỗi **trạng thái** có một **ngưỡng ngày** (cấu hình theo `(status, flow)` ở bảng `sla_config`).
- Đếm bằng **ngày làm việc** (bỏ Thứ 7 / Chủ nhật; lịch nghỉ lễ để giai đoạn sau), tính từ `status_entered_at` — mốc ticket **vào** trạng thái đó.
- Vượt ngưỡng → **badge đỏ "▲ Quá hạn N ngày"** tự bật (tính lúc đọc, không lưu cờ — AD-6).
- **SLA đặt lên người NHẬN / người phải hành động tiếp** để rời ga đó (chủ ga), **không phải người gửi**. Đổi trạng thái → đồng hồ **reset**, sang người mới.
- Đo **theo từng ga, không đo tổng**. Qua **vòng return mới** → reset.

## 🔑 Sinh mã hồ sơ
- **Tự động** khi DCC1 xác nhận Document type (bốc từ Pool). Hệ thống sinh số **atomic** (không trùng/không nhảy), **prefix theo luồng**: `G-` (General), `CT-` (Contract & Payment).
- Mã **giữ nguyên** qua mọi vòng return/reopen (AD-5). Trước khi xác nhận luồng, `code = NULL`.

---

## 🟢 BƯỚC CHUNG (cả 3 luồng)

| Bước | Hành động | → Trạng thái | SLA | Đồng hồ đặt lên |
|---|---|---|---|---|
| 1 | Applicant nộp 9 trường | **`Submitted`** (Pool) | 1 | DCC1 (phải bốc) |
| 2 | DCC1 **bốc** (khóa mềm) + kiểm Document type + **sinh mã tự động** | **`Submitted to VP Andy`** | 1 | DCC1 (lấy chữ ký Andy) |

- Sai Document type (khâu tiếp nhận) → `Returned` (trước khi sinh mã).
- Andy **từ chối** → `Returned`. Andy **duyệt** → rẽ luồng theo Document type.
- Applicant **Thu hồi** khi còn `Submitted` & chưa ai bốc → `Cancelled`.

---

## 🅰️ LUỒNG A — General *(DCC1 xử suốt; KHÔNG qua DCC2/3, KHÔNG ACC, KHÔNG scan)*

| Bước | Hành động | → Trạng thái | SLA | Đồng hồ đặt lên |
|---|---|---|---|---|
| 1 | Applicant nộp | **`Submitted`** (Pool) | 1 | DCC1 |
| 2 | DCC1 bốc + sinh mã (auto, `G-`) | **`Submitted to VP Andy`** | 1 | DCC1 |
| 3a | Andy duyệt, **không cần BOP** | **`Completed`** ✓ (email Applicant) | — | — (đóng) |
| 3b | Andy duyệt, **cần BOP** → DCC1 trình BOP | **`Submitted to BOP`** | 2 | DCC1 (lấy duyệt BOP) |
| 4 | BOP approved | **`Completed`** ✓ (email Applicant) | — | — |

*Andy/BOP từ chối → `Returned`. General **chỉ chuyển trạng thái**, không nhập path-scan.* **Tổng kỳ vọng ≈ 7 ngày.**

---

## 🅱️ LUỒNG B — Contract / VO / Annex / Budget *(qua DCC2 · ACC · BOP · Hardcopy)*

| Bước | Hành động | → Trạng thái | SLA | Đồng hồ đặt lên |
|---|---|---|---|---|
| 1 | Applicant nộp | **`Submitted`** (Pool) | 1 | DCC1 |
| 2 | DCC1 bốc + sinh mã (auto, `CT-`) | **`Submitted to VP Andy`** | 1 | DCC1 |
| 3 · **GỬI** | Andy duyệt → DCC1 **gửi bản cứng cho DCC2** | **`Submitted to DCC2`** | 1 | **DCC2** (phải nhận) |
| 4 · **NHẬN** | DCC2 **xác nhận đã nhận bản cứng** (2 pha) | **`Received by DCC2`** | 2 | DCC2 (nhập + gửi ACC) |
| 5 · **GỬI ACC** | DCC2 nhập **Document No** → gửi ACC | **`Submitted to Accounting`** | 7 | DCC1 (chờ ACC, nhận về) |
| 6 · **NHẬN từ ACC** | DCC1 bấm **"nhận về từ ACC"** | **`Received from ACC`** | 2 | DCC1 (trình BOP) |
| 7 · **TRÌNH BOP** | DCC1 trình BOP | **`Submitted to BOP`** | 7 | DCC1 (lấy duyệt BOP) |
| 8 · **GỬI** | BOP approved → DCC1 **gửi bản cứng cho DCC2** | **`Submitted to DCC2 (Hardcopy)`** | 2 | **DCC2** (phải nhận) |
| 9 · **NHẬN** | DCC2 **xác nhận đã nhận bản cứng** (2 pha) | **`Hardcopy`** | 2 | DCC2 (nhập path scan) |
| 10 · **ĐÓNG** | DCC2 nhập **path scan** (bằng chứng) → hoàn tất | **`Completed`** ✓ (email Applicant) | — | — |

**Cửa Return:** ACC return (b6) · BOP từ chối (b7) · DCC2 phát hiện giấy sai/thiếu → đẩy ngược DCC1 (b4/b9).
**Tổng kỳ vọng ≈ 26 ngày.**

---

## 🅲 LUỒNG C — Payment *(qua DCC3 + ACC, KHÔNG qua BOP)*

| Bước | Hành động | → Trạng thái | SLA | Đồng hồ đặt lên |
|---|---|---|---|---|
| 1 | Applicant nộp | **`Submitted`** (Pool) | 1 | DCC1 |
| 2 | DCC1 bốc + sinh mã (auto, `CT-`) | **`Submitted to VP Andy`** | 1 | DCC1 |
| 3 · **GỬI** | Andy duyệt → DCC1 **gửi bản cứng cho DCC3** | **`Submitted to DCC3`** | 1 | **DCC3** (phải nhận) |
| 4 · **NHẬN** | DCC3 **xác nhận đã nhận bản cứng** (2 pha) | **`Received by DCC3`** | 2 | DCC3 (nhập + gửi ACC) |
| 5 · **GỬI ACC = ĐÓNG** | DCC3 nhập **Document No** → gửi ACC | **`Sent to Accounting`** ⭐ (đóng ngay, **KHÔNG email**) | — | — |

*⭐ `Sent to Accounting` là **trạng thái đóng riêng của Payment** (≠ `Completed`, để số Completed không hiểu nhầm là "đã trả tiền"); Document No = bằng chứng đã chuyển Kế toán.*
**Cửa Return (trước khi đóng):** DCC3 phát hiện bản cứng sai/thiếu ở `Received by DCC3` → **đẩy ngược DCC1** → DCC1 Return về Applicant (đối xứng Contract, b4).
**Reopen:** ACC trả bản cứng **sai** → DCC1 nhận về → **Reopen** → `Returned`.
**Tổng thực tế ≈ 27 ngày** (phần lớn chờ ACC ngoài hệ thống, không gate SLA).

---

## ↩️ RETURN — 2 pha (mọi luồng, cũng tách gửi ↔ nhận)

| Bước | Hành động | → Trạng thái | SLA | Đồng hồ đặt lên |
|---|---|---|---|---|
| **GỬI ngược** | DCC1 Return (**lý do bắt buộc**) → trao lại bản cứng cho Applicant | **`Returned`** | 2 | **Applicant** (phải nhận lại giấy) |
| **NHẬN** | Applicant **xác nhận đã nhận lại bản cứng** (2 pha) | **`Return-fixing`** | 3 | Applicant (sửa & nộp lại; nhắc email nếu quá) |
| **NỘP LẠI** | Applicant sửa & nộp | → **`Submitted`** — đi lại **từ đầu** (đếm vòng nếu đã qua ACC/BOP, đồng hồ reset) | — | — |

- DCC2/DCC3 **không tự Return** — phát hiện giấy sai thì **đẩy ngược DCC1**; DCC1 là đầu mối duy nhất bấm Return.
- Applicant bỏ luôn (không sửa) → ticket đỏ mãi ở tab Return (chấp nhận, không có kết cục tự động).

## 🔄 REOPEN
Từ **`Completed`** (General/Contract) hoặc **`Sent to Accounting`** (Payment) → **`Reopened`** (SLA 1) → `Returned`. DCC1 **Reopen**; DCC2/DCC3 chỉ **"Đề nghị Reopen"**. Giữ nguyên mã + toàn bộ lịch sử; không thời hiệu.

---

## 📌 Tóm tắt SLA theo trạng thái (ngày làm việc)
| Trạng thái | SLA | Ghi chú |
|---|---|---|
| `Submitted` (Pool) | 1 | DCC1 bốc |
| `Submitted to VP Andy` | 1 | chờ Andy |
| `Submitted to DCC2` / `Submitted to DCC3` | 1 | chờ bên nhận cầm giấy |
| `Received by DCC2` / `Received by DCC3` | 2 | nhập Document No + gửi ACC |
| `Submitted to Accounting` (Contract) | 7 | chờ ACC, DCC1 nhận về |
| `Received from ACC` (Contract) | 2 | DCC1 trình BOP |
| `Submitted to BOP` | **2 (General) / 7 (Contract)** | chờ BOP duyệt |
| `Submitted to DCC2 (Hardcopy)` | 2 | chờ DCC2 cầm giấy |
| `Hardcopy` | 2 | nhập path scan → đóng |
| `Returned` | 2 | Applicant nhận lại giấy |
| `Return-fixing` | 3 | Applicant sửa & nộp lại (nhắc email) |
| `Reopened` | 1 | DCC1 xử lý mở lại |
| `Completed` / `Sent to Accounting` | — | trạng thái đóng |
