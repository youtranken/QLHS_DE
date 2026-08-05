# QLHS · UX/UI Audit & Improvement Plan

> Người soi: UX/FE lead. Ngày: 2026-07-12. Phạm vi: toàn bộ `apps/web/src`, đối chiếu concept `concept-dispatch-full.jpeg` + design system `ux-Project_QLHS-2026-07-07`.
> Mỗi mục có: **hiện trạng (kèm `file:line`) → vì sao là vấn đề → cách sửa**. Không đoán — mọi nhận định trích từ code thật.

---

## ✅ Tiến độ thực thi (checklist sống — cập nhật mỗi khi làm xong)

> Cập nhật gần nhất: 2026-07-12. Mã ID khớp với bảng duyệt tương tác.

**Đã xong (có test xanh + xem trên app thật):**
- [x] **FIX lỗi màn trắng** — build lại `@qlhs/contracts` (dist cũ thiếu export `DOCUMENT_TYPE_GROUPS` làm cả web crash). App login lại bình thường.
- [x] **Sprint 1 quick wins** (chi tiết ở §E0): `#1` logo→Home · `#2` format số tiền sống · `#3` màu ưu tiên · `#4a` bỏ hint Luồng · `#14` USD grouping · `#8` filter Applicant · `#9` tra cứu có data mặc định · `F` microcopy.
- [x] **A1 (§K)** — Admin có **sidebar console** (`AdminShell.tsx` + `admin.css`), 2 mục chạy + 3 mục "sắp có" (Bổ nhiệm SSO · Danh mục · Nhật ký). *(3 test)*
- [x] **A2 (bản chốt: Master–detail)** — "Người dùng & Vai" dạng **danh sách trái + chi tiết phải**; **Applicant = mặc định (LUÔN BẬT)**, chỉ Admin/DCC1/2/3 là **công tắc** kèm mô tả vai. *(test)*
- [x] **A3** — **Tìm user** (tên/email) trong danh sách trái + đếm live (dùng được ở 200–300 user). *(test)*
- [x] **A4** — Ô số ngày SLA: bỏ style inline → class `.slanum`.
- [x] **Đợt làm đẹp Admin** — sidebar có icon + chip active + gạch accent; thẻ nội dung có header; avatar; đồng bộ dark/light. *(xem trên app thật)*
  - *Ghi chú: đã so 3 hướng (A Roster · B Control tower · C Master–detail) → chốt **C**. File so sánh: `/mockup/admin-styles.html`.*

**Đang chờ làm (theo thứ tự đề xuất):**
- [ ] **A5** — SLA: gom nhóm theo **Luồng** (*/Contract/Payment/General) thay vì 15 hàng phẳng.
- [ ] **A6** — Thông báo lưu (Admin) bằng `.toast` + `role=alert` cho lỗi.
- [ ] **A7** — SLA: **nháy xanh ô vừa lưu** (giờ lưu `onBlur` im lặng).
- [ ] **Admin sub-consoles (cần backend):** Bổ nhiệm Admin qua SSO · Danh mục (Payment Term/Project Team) · Nhật ký hệ thống.
- [ ] **Chi tiết hồ sơ (D1–D5):** 9 trường → 4 khung nhóm · số tiền nổi bật · khu DCC · tóm tắt stat-tiles · nhật ký bảng. *(có mockup)*
- [ ] **Bảng điều độ (B1–B11)** · **Sơ đồ điều độ (L1–L9)** *(có mockup)*.
- [ ] **Hồ sơ của tôi (M1–M10)** · **Tra cứu (C1–C10)**.
- [ ] **Form tạo (F2–F7)** · **Sửa & nộp lại (R1–R6)** · **3 modal (MO1–MO6)**.
- [ ] **Topbar & điều hướng (S2–S7)** · **Đăng nhập (LG2–LG5)**.
- [ ] Nền tảng dùng chung: `.fset` khung · `StatusChip` · `.boardnote` toast · audit `tabular-nums` · skeleton · focus rings.

*(Blueprint thiết kế chi tiết từng page: `QLHS-ux-redesign-per-page-2026-07-12.md`.)*

---

## 0. Bảng ưu tiên (đọc cái này trước)

| # | Vấn đề | Mức | Công sức | Nhóm |
|---|--------|-----|----------|------|
| 1 | Logo không bấm về Home | Cao | XS | Điều hướng |
| 2 | Số tiền không format sống khi gõ | Cao | S | Nhập liệu |
| 3 | Nhãn ưu tiên chọn xong vẫn xanh (không phân biệt Khẩn/Gấp) | Cao | XS | Tín hiệu |
| 4 | Form tạo hồ sơ: bỏ hint "→ Luồng", ẩn field không liên quan theo loại | Cao | M | Nhập liệu |
| 5 | Ga terminal (Completed/Hardcopy/Sent to Accounting) cộng dồn vô nghĩa | Cao | S | Line-map |
| 6 | Luồng Payment thiếu ga "Hoàn tất" ở cuối | Cao | S | Line-map |
| 7 | Line-map ga trạm chưa giống concept (nhãn, code-chip, ga-của-tôi) | Cao | M–L | Line-map |
| 8 | Applicant thiếu bộ lọc (trạng thái/loại/luồng) | TB | S | Lọc |
| 9 | "Tìm hồ sơ" mở ra trống trơn — cần dữ liệu mặc định | TB | S | Tìm kiếm |
| 10 | Chưa có nút chuyển ngôn ngữ VI–EN | TB | M–L | i18n |
| 11 | Chưa responsive (mobile/tablet gần như vỡ) | TB | M | Layout |
| 12 | Chưa có drag-and-drop cho "Trạm của tôi" | Thấp | M | Tương tác |
| 13 | `window.prompt/confirm` thô cho lý do/nút xác nhận | TB | M | Design system |
| 14 | Grouping số tiền USD sai (dùng dấu chấm kiểu VND) | Thấp | XS | Nhập liệu |
| 15 | Empty state / loading / toast còn sơ sài | Thấp | M | Trải nghiệm |

XS ≈ <30′, S ≈ nửa buổi, M ≈ 1 ngày, L ≈ nhiều ngày.

---

## A. Các điểm anh đã nêu (đối chiếu code)

> ⚠️ **LƯU Ý ĐỌC (sau review 2026-07-12):** Phần "Hiện trạng" của #1, #2, #3, #4a, #8, #9, #14 và **toàn bộ mục F** mô tả **code TRƯỚC khi Sprint 1 sửa** — các mục này **đã hoàn tất** (xem E0), giữ lại chỉ để tra cứu bối cảnh. Khi triển khai, lấy **E0** làm sự thật. Vài `file:line` đã dịch dòng sau khi sửa (vd `ClosedTickets` prompt/confirm nay ở `:60-61`, `MyTickets` cancel ở `:63`).

### 1. Logo không dẫn về Home — **Cao**
- **Hiện trạng:** `App.tsx:73-75` — `.brand` là `<div>` tĩnh, không có `onClick`. `route.ts` đã có sẵn `goHome()`.
- **Vấn đề:** Quy ước web phổ quát — logo = nút Home. Người dùng đang ở trang chi tiết/tìm kiếm không có đường "một bấm" quay về bảng điều độ (chỉ có nút "← Về bảng điều độ" ở view search, còn view `ticket` thì nút back nằm trong `TicketDetail`).
- **Sửa:**
  ```tsx
  <button type="button" className="brand" onClick={goHome} aria-label="Về trang chủ">
    <span className="q">◱</span> QLHS · Điều độ
  </button>
  ```
  CSS `.brand` bỏ nền/viền mặc định của button, thêm `cursor:pointer`. Áp cho cả login-card thì không cần (đang anon).

### 2. Số tiền phải hiện theo định dạng khi gõ (5.000.000) — **Cao**
- **Hiện trạng:** `CreateTicketForm.tsx:112` — input `amount` là số thô, không nhóm. `format.ts:groupAmount()` chỉ dùng để *hiển thị* ở bảng/thẻ, không áp vào lúc nhập.
- **Vấn đề:** Gõ `3480500000` không có dấu phân cách → rất dễ sai số 0. Concept hiển thị `3.480.500.000 đ`.
- **Sửa:** Format sống — hiển thị nhóm, lưu số thô (giữ nguyên "data là string, không float"):
  ```tsx
  const onAmount = (raw: string) => {
    const digits = raw.replace(/\D/g, '')          // chỉ giữ số
    set('amount', digits)                           // state = số thô
  }
  // value hiển thị:
  <input value={groupAmount(form.amount)} onChange={(e) => onAmount(e.target.value)} />
  ```
  Thêm hậu tố đơn vị (₫ / $) bám phải input (adornment). Lưu ý: `groupAmount` hiện dùng dấu **chấm** (đúng chuẩn VN) — ví dụ anh viết `5,000,000` là kiểu Anh–Mỹ; nên thống nhất **một** quy ước, khuyến nghị dấu chấm cho VND theo concept.

### 3. Nhãn ưu tiên cần màu khác biệt — **Cao**
- **Hiện trạng:** `modal.css:132-136` — `.prios .p.on` **luôn** dùng `--accent` (xanh) bất kể Thường/Gấp/Khẩn. Token màu đã có sẵn (`tokens.css:33 --urgent` đỏ, `:34 --rush` cam) nhưng không áp vào nút chọn.
- **Vấn đề:** Chọn "Khẩn" mà nút vẫn xanh dương → mất tín hiệu mức độ. Trong thẻ board thì `cards.css:201-205` đã tô đúng (đỏ/cam), nhưng lúc *tạo* thì không.
- **Sửa:** Tô nút theo mức khi `.on`:
  ```css
  .prios .p.on.rush   { border-color: var(--rush);   color: var(--rush);   background: var(--rush-soft); }
  .prios .p.on.urgent { border-color: var(--urgent); color: var(--urgent); background: var(--urgent-soft); }
  ```
  (thêm `--rush-soft`/`--urgent-soft` vào tokens; class mức gắn ở `CreateTicketForm.tsx:143`). Đồng thời **chip trạng thái** và **thẻ** dùng chung một thang màu để nhất quán.

### 4. Form tạo hồ sơ: chỉ chọn Loại chứng từ, đừng "ghi luồng" — **Cao**
- **Hiện trạng:** `CreateTicketForm.tsx:18-21, 87` — có `FLOW_HINT` map và render dòng `→ Luồng {flow}` ngay dưới select. Ngoài ra form ép **9 trường bắt buộc** cho *mọi* loại (dòng lỗi `:54` "kiểm tra đã điền đủ 9 trường").
- **Vấn đề:**
  - "Luồng" là khái niệm nội bộ của hệ thống (A/B/C) — Applicant không cần biết, để lộ ra gây rối. Anh nói đúng: người dùng **chỉ chọn loại chứng từ**, hệ thống tự map luồng ở backend.
  - 9 trường bắt buộc như nhau là sai UX: hồ sơ **General** không cần `Mã ngân sách`/`Điều khoản thanh toán` như **Payment/Contract**. Bắt điền hết → người dùng nhập bừa cho qua.
- **Chốt với anh (2026-07-12):** GIỮ **9 trường dùng chung** (không tách theo loại — đơn giản, thống nhất). Thay vào đó:
  1. Xoá dòng hint `→ Luồng` (`:87`) và `FLOW_HINT`. ✅ *(đã làm)*
  2. **Title tiếng Anh** cho mọi input. ✅ *(đã làm)*
  3. **Document Type** = dropdown **gom nhóm 3 luồng** bằng `<optgroup>` (General / Contract·VO·Annex·Budget / Payment) — canonical hoá bằng `DOCUMENT_TYPE_GROUPS` trong `packages/contracts` (+ spec chống drift). ✅ *(đã làm)*
  4. **Payment Term** & **Project Team** → dropdown **admin cấu hình** (mục H). ⏳ *(chờ backend)*
  5. Thông báo lỗi nêu đúng field còn thiếu, không nói "đủ 9 trường". ⏳

### 5. Ga terminal cộng dồn vô nghĩa (Completed 1–2 năm → số khổng lồ) — **Cao**
- **Hiện trạng:** `LineMap.tsx:78` hiển thị `s.count` cho *mọi* ga, kể cả ga cuối. `dispatch/api.ts` trả `count` thô từ server.
- **Vấn đề:** Ga kết thúc (Completed / Hardcopy / Sent to Accounting) là **kho tích luỹ** — sau 1–2 năm có thể hàng nghìn, làm sai lệch cảm nhận "tải hiện tại". Concept xử lý đúng: ga "Hoàn tất" vẽ **vòng rỗng (—)**, không đếm.
- **Sửa:**
  - Line-map là bản đồ **hồ sơ đang chạy** → ga terminal **không đếm tồn**, chỉ vẽ node đích rỗng (hoặc đếm trong cửa sổ thời gian, vd "7 ngày").
  - Backend `/dispatch-map`: với status terminal, trả `count: 0` (hoặc `count` giới hạn theo `closedWithin`), hoặc thêm cờ `terminal: true` để FE vẽ node rỗng. FE: `if (s.terminal) render '—'`.

### 6. Luồng Payment thiếu "Hoàn tất" ở cuối — **Cao**
- **Hiện trạng:** `statusLabel.ts:14` — Payment đóng ở `Sent to Accounting` = "Đã chuyển Kế toán (đóng)". Line-map dựng ga theo status server trả; ray Payment kết thúc ở ga này, **không có node đích "Hoàn tất"** như concept (concept: Thanh toán → … → **Hoàn tất**).
- **Vấn đề:** Người xem toàn tuyến thấy 2 luồng (Hợp đồng/General) có đích "Hoàn tất" còn Payment cụt → tưởng luồng lỗi/chưa xong. Về nghiệp vụ Payment *đóng* ở "Sent to Accounting", nhưng **thị giác** cần một ga đích thống nhất.
- **Sửa:** Thêm ga đích ảo "Hoàn tất" (terminal, rỗng) vào cuối ray Payment trong `/dispatch-map`, ánh xạ `Sent to Accounting` = ga đóng ngay trước đích. Nhãn VI hiển thị rõ "Đã chuyển Kế toán → đóng". Giữ nguyên state machine (chỉ là lớp trình bày, đúng AD-13).
- **Cần anh chốt:** Payment có "Hoàn tất" như một **ga hiển thị cuối** (đề xuất: có, cho đồng bộ concept), hay giữ đóng ở "Sent to Accounting" và đổi nhãn cho rõ là điểm-đóng?

### 7. Ga/trạm chưa đẹp & giống concept — **Cao** (đây là khoảng cách lớn nhất)
Đối chiếu concept `concept-dispatch-full.jpeg` với `LineMap.tsx` + `board.css` hiện tại:

| Yếu tố trong concept | Hiện trạng code | Thiếu gì |
|---|---|---|
| Nhãn ga thân thiện: *Pool, VP Andy, DCC2 nhận, Kế toán (ACC), Về DCC1, Trình BOP, Hardcopy, Hoàn tất* | `LineMap.tsx:81-83` in **raw EN status** (`s.status`) | Cần map status→nhãn ngắn thân thiện (đã có `statusVi` nhưng dài; cần bản "nhãn ga" ngắn) |
| **Code-chip nổi trên node**: `CT-0042 ③`, `+1` (xem nhanh hồ sơ nào đang ở ga) | Node chỉ có **con số đếm** | Chưa có chip mã nổi phía trên node |
| **Ga-của-tôi khoanh sáng** (ring xanh quanh node DCC phụ trách) | CSS `.node.owned` **có sẵn** (`board.css:120`) nhưng `LineMap` **không bao giờ set** class `owned`; `StationNode` API không trả cờ `owned` | Thiếu cờ `owned` từ server + gắn class |
| Node "Pool" có **gradient** đậm, kích thước lớn hơn | Node phẳng, một cỡ | Chưa có biến thể node đầu tuyến |
| Chú giải có mục "ga do bạn phụ trách" | `LineMap.tsx:89-105` legend **thiếu** mục owned | Bổ sung mục chú giải |
| Chip "▲ 2 quá SLA" góc phải tiêu đề | Đã có (`LineMap.tsx:49`) ✓ | OK |

- **Sửa (đề xuất triển khai):**
  1. Server `/dispatch-map` trả thêm: `label` (nhãn ga ngắn), `owned` (ga vai hiện tại phụ trách), `sample` (2–3 mã hồ sơ đầu để làm chip), `terminal`.
  2. `LineMap` render: chip mã nổi (`.stn .codes`), node owned có ring, node đầu (Pool) biến thể lớn/gradient, nhãn thân thiện.
  3. Tinh chỉnh `board.css`: khoảng cách ga, độ dày ray, bo tròn, đổ bóng nhẹ cho panel để khớp concept (concept có chiều sâu hơn — panel `--panel` + viền + shadow mềm).

### 8. Applicant thiếu bộ lọc — **TB**
- **Hiện trạng:** `MyTickets.tsx:93-106` chỉ có **1 ô tìm free-text** (mã/nhà thầu) + nút hiện/ẩn hoàn tất. Không lọc theo **trạng thái**, **loại chứng từ**, hay **luồng**. (So sánh: `ClosedTickets` cho DCC1 có chip lọc luồng.)
- **Vấn đề:** Applicant nhiều hồ sơ không lọc nhanh được "cái nào đang bị trả lại", "cái nào Payment"…
- **Sửa:** Thêm hàng chip lọc: `[Tất cả] [Đang chạy] [Bị trả lại] [Hoàn tất]` + (tuỳ chọn) lọc loại chứng từ. Tái dùng `.fchip` đã có. Bị-trả-lại nên có chip màu cảnh báo (`--sla`).

### 9. "Tìm hồ sơ" mở ra trống — cần dữ liệu mặc định — **TB**
- **Hiện trạng:** `ClosedTickets.tsx:32` khởi tạo `rows = null` → không hiển thị gì tới khi bấm "Tìm". Màn trắng.
- **Vấn đề:** Mở trang ra trống → người dùng không biết bắt đầu từ đâu, cảm giác "hỏng".
- **Sửa:** Tải sẵn tập mặc định khi mở (vd hồ sơ đã đóng gần nhất, giới hạn ~20, mới nhất trước). `useEffect` chạy `searchClosed({})` lúc mount. Ô lọc vẫn để tinh chỉnh. Kèm caption "20 hồ sơ đóng gần nhất — lọc để thu hẹp".

### 10. Chưa có nút chuyển ngôn ngữ VI–EN — **TB**
- **Hiện trạng:** Không có i18n. Chuỗi VI hardcode khắp nơi; status EN là canonical (AD-13), chú thích VI rời rạc (`statusVi`).
- **Vấn đề:** Không đổi được ngôn ngữ; người dùng quốc tế/ban lãnh đạo đọc EN không có lối.
- **Sửa:**
  - Thêm nút VI/EN cạnh `ThemeToggle` (`App.tsx:78`).
  - Đưa chuỗi ra `i18n` (khuyến nghị **`react-i18next`** — nhẹ, chuẩn). Status vẫn giữ EN canonical; chỉ dịch phần *chú thích/nhãn UI*.
  - Lưu lựa chọn vào `localStorage`, mặc định VI.
  - Đây là việc **M–L** vì phải bóc chuỗi — nên làm sau nhóm Cao. Có thể làm dần: bọc `t('key')` cho shell + form trước.

### 11. Responsive — **TB** (anh bổ sung)
- **Hiện trạng:** Toàn repo chỉ **2** `@media`: `tokens.css:93` (reduce-motion) và `detail.css:50` (max-width 920). Topbar (`shell.css:2`) là flex một hàng, `main` (`:89`) `max-width:1760`, board/cols dựa `overflow-x:auto` (`cards.css:6`) — cuộn ngang cứu được kanban nhưng **topbar, form, sec-head, line-map** chưa có breakpoint.
- **Vấn đề:** Trên tablet/mobile: topbar tràn (brand + role switcher + theme + user + logout), form modal 2 cột chật, line-map min-width 900px buộc cuộn ngang toàn trang.
- **Sửa:**
  - Breakpoints: `≤1200` (thu gọn 2 cột form → 1), `≤768` (topbar xuống hàng/thu gọn role switcher thành dropdown, ẩn chữ "Thoát" còn icon), `≤560` (cột kanban full-width cuộn dọc từng cái).
  - Line-map: dưới 768 chuyển từ "ray ngang" sang danh sách ga dọc (giữ ngữ nghĩa, bỏ min-width 900).
  - Dùng `clamp()` cho font tiêu đề, `min()` cho padding.

### 12. Chưa có drag-and-drop cho "Trạm của tôi" — **Thấp** (nhưng anh muốn)
- **Hiện trạng:** `StationBoard.tsx:32-34` comment nói "Drag-drop is an enhancement… ⋯ menu là đường keyboard bắt buộc"; `cards.css:17 .col.dragover` **đã có sẵn style** nhưng **chưa nối logic** kéo-thả. Concept ghi rõ *"Không kéo-thả — bấm thẻ → chi tiết, chuyển bước bằng nút"*.
- **Lưu ý quan trọng (bất biến):** Đây là state machine đóng (AD-2/AD-13) — kéo-thả **không được** phá guard vai×trạng thái. DnD chỉ là *launcher khác* cho cùng action hợp lệ: thả thẻ vào cột đích ⇒ gọi đúng `action.event` mà `⋯ menu` cho phép; nếu đích không hợp lệ → từ chối + rung nhẹ.
- **Sửa (nếu anh chốt làm):**
  - Dùng thư viện **`@dnd-kit/core`** (nhẹ, a11y tốt, hỗ trợ keyboard sensor — giữ được đường bàn phím bắt buộc).
  - Chỉ cho kéo tới cột mà thẻ có action hợp lệ (highlight cột đích hợp lệ bằng `.dragover`, làm mờ cột cấm).
  - Thả = mở đúng modal/confirm như bấm nút (không bỏ qua lý do/confirm bắt buộc).
- **Cần anh chốt:** Concept **cố ý bỏ** kéo-thả để bảo toàn tính kỷ luật của state machine. Anh muốn **thêm** DnD (song song với nút), hay giữ nguyên nút cho an toàn? Tôi khuyến nghị *thêm nhưng chỉ như phím tắt của action hợp lệ*.

### 13. `window.prompt/confirm` thô — **TB**
- **Hiện trạng:** Lý do trả lại/mở lại và xác nhận dùng `window.prompt`/`window.confirm`: `StationBoard.tsx:90,94,102,105`; `ClosedTickets.tsx:50-51`; `MyTickets.tsx:55`.
- **Vấn đề:** Hộp thoại trình duyệt phá vỡ design system (không theo Azure/font dự án), không style được, không a11y nhất quán, không nhập nhiều dòng đẹp cho "lý do".
- **Sửa:** Thay bằng modal của dự án (đã có `modal.css`, `HandoverModal`…). Làm 1 `ConfirmModal` + `ReasonModal` tái dùng. Toast thay cho `msg` text nhỏ (`StationBoard.tsx:204`).

### 14. Grouping số tiền USD sai — **Thấp**
- **Hiện trạng:** `format.ts:groupAmount` luôn chèn dấu **chấm**; hiển thị USD thành `12.750.000 $` (concept dòng Pool Payment cũng đang vậy).
- **Vấn đề:** USD theo chuẩn quốc tế dùng dấu **phẩy** nhóm nghìn. Trộn quy ước gây hiểu nhầm.
- **Sửa:** `groupAmount(amount, currency)` — VND dùng `.`, USD dùng `,` (hoặc `Intl.NumberFormat` theo currency). Áp ở bảng/thẻ/line-map.

### 15. Empty / loading / toast sơ sài — **Thấp**
- **Hiện trạng:** Cột trống chỉ chữ "Trống" (`StationBoard.tsx:239`), popover trống "Ga này chưa có hồ sơ" — ổn nhưng nhạt; không có skeleton khi tải; feedback là `<p>` nhỏ.
- **Sửa:** Skeleton lúc load, empty-state có icon + gợi ý hành động, toast (khuyến nghị **`sonner`**) cho "Đã gửi ACC", "Đã hoàn tác (5s)"… thay text mảnh.

---

## B. Vấn đề tôi phát hiện thêm (ngoài danh sách của anh)

1. **Line-map dùng raw EN status làm nhãn ga** (`LineMap.tsx:81-83`) — người vận hành đọc `Submitted to VP Andy` thay vì "VP Andy". Concept dùng nhãn ngắn. (Đã gộp vào mục 7.)
2. **`title=` popover node** dùng `statusVi` (`LineMap.tsx:71`) nhưng nhãn nhìn thấy lại EN — không nhất quán EN/VI trong cùng một ga.
3. **Polling 4s reload toàn bộ** (`LineMap.tsx:31`, `StationBoard.tsx:59`) — mỗi 4s `setState` cả mảng ⇒ có thể nhấp nháy/nhảy focus, menu ⋯ đang mở bị đóng. Nên diff/patch hoặc giữ trạng thái UI khi refetch (MyTickets đã lưu ý điều này ở `:39`).
4. **Avatar initials** (`App.tsx:19-27`) lấy 2 từ cuối — với tên VN ("Nguyễn Thị Thuỳ Trâm") ra "TT" ổn, nhưng sub dạng UUID/email ra ký tự khó đọc; nên fallback đẹp hơn.
5. **Nút "Thoát"** (`App.tsx:98`) chữ mờ (`--ink-3`) dễ bị bỏ sót; hover mới thành đỏ. Cân nhắc icon + tooltip.
6. **Chip trạng thái hiện cả EN + VI** (`MyTickets.tsx:17-26`) khá rối trong ô hẹp; khi có i18n nên chỉ hiện 1 theo ngôn ngữ, giữ cái kia ở tooltip.
7. **Số tiền trong thẻ board — thiếu đơn vị VÀ sai dấu phân cách** (`BoardCardView.tsx:58` gọi `groupAmount(c.amount)` không truyền currency) → USD bị nhóm bằng dấu chấm (đúng lỗi #14 đã sửa nơi khác) **và** không có "₫/$". Cần thêm currency vào `BoardCard` (server) rồi `groupAmount(c.amount, c.currency)` + hiện đơn vị.
8. **Accessibility:** menu `⋯` dùng `<details>/<summary>` (`BoardCardView.tsx:28`) — mở/đóng bằng bàn phím ổn, nhưng không đóng khi click ngoài, không `aria-haspopup`; focus trap trong modal cần kiểm lại.
9. **Deep-link chỉ có 3 view** (`route.ts`) — không có route cho "danh sách theo luồng/ga" để share; cân nhắc mở rộng khi làm filter.

---

## F. Microcopy / chất lượng chữ — **TB** (anh bổ sung)

**Nguyên tắc:** UI tốt tự giải thích — không nhúng "hướng dẫn sử dụng" vào màn. Các dòng phụ đề hiện tại đang *dạy người dùng cách bấm*, đọc như cẩm nang:

| Hiện trạng | `file:line` | Vấn đề | Sửa |
|---|---|---|---|
| "bấm hàng → bung tuyến · hồ sơ hoàn tất được ẩn" | `App.tsx:132` | Chỉ dẫn thao tác + tiết lộ cơ chế ẩn | Bỏ. Nếu cần, để tooltip/empty-state, không phải phụ đề thường trực |
| "ga hiện số hồ sơ · cờ đỏ ▲ khi quá SLA" | `LineMap.tsx:48` | Giải thích ký hiệu tự-hiển-nhiên | Bỏ; chú giải đã có ở legend |
| "các ga bạn phụ trách · menu ⋯ mở hành động hợp lệ" | `StationBoard.tsx:190` | Dạy cách dùng menu | Bỏ; menu ⋯ tự lộ khi hover |
| "tra cứu để xem lại / mở lại · lọc mã · nhà thầu · hợp đồng…" | `ClosedTickets.tsx:78` | Liệt kê field = thừa (đã có placeholder trong ô lọc) | Rút gọn còn 1 câu ngắn |
| "kiểm tra đã điền đủ 9 trường" | `CreateTicketForm.tsx:54` | Nói bằng ngôn ngữ hệ thống ("9 trường") | Nêu đúng trường còn thiếu |

**Quy tắc copy đề xuất:** phụ đề chỉ nói *"cái này là gì / dùng để làm gì"*, không nói *"bấm vào đâu"*. Onboarding (nếu cần) tách thành tour/empty-state, không thường trực. Rà toàn bộ chuỗi `.d`, `.hint`, `.note`, `.vi` theo nguyên tắc này — làm luôn ở Sprint 1 (chi phí ~0, tác động lớn tới cảm nhận "chuyên nghiệp").

## G. Trang chi tiết hồ sơ (TicketDetail) — **TB** (anh bổ sung)

- **Hiện trạng:** `TicketDetail.tsx` đã có bố cục 2 cột (field-grid `:99`, timeline dọc `:125`, tóm tắt `:147`, **nhật ký bàn giao dạng list text** `:171-183`). Không tệ, nhưng phần dữ liệu và nhật ký đều là *text trôi*, thiếu cấu trúc bảng nên khó quét.
- **Vấn đề:** Nhật ký bất biến (thời gian · người · hành động · lý do) là dữ liệu **dạng bảng** đúng nghĩa nhưng đang render thành đoạn `<b>tên</b> hành động — "lý do"` → khó so hàng, khó quét theo cột thời gian/người.
- **Sửa:**
  1. **Nhật ký → bảng** (`.qtbl` tái dùng): cột *Thời gian · Người · Hành động · Lý do*, mã hoá màu hành động (trả lại/hủy = đỏ). Dễ quét, xuất/in đẹp.
  2. **Dữ liệu hồ sơ**: giữ field-grid nhưng nhóm rõ (Định danh / Tài chính / Diễn giải), số tiền nổi bật (font lớn + đơn vị), ẩn field rỗng thay vì "—" dày đặc.
  3. **Tóm tắt SLA**: thay dòng chữ bằng thanh tiến trình/among badge màu (Trong hạn = xanh, Vượt = đỏ) cho quét nhanh.
  4. **Timeline**: tốt rồi; chỉ cần nhãn ga thân thiện (đồng bộ mục #7) và thu gọn khi nhiều bước.

---

## C. Khuyến nghị thư viện (anh gợi ý "dùng thư viện cho chuyên nghiệp")

Giữ **stack hiện tại** (React 19 + Vite 8, design tokens CSS thuần) — không đập đi. Bổ sung có chọn lọc, ưu tiên thư viện **headless/nhẹ** để không phá design system Azure đang có:

| Nhu cầu | Thư viện đề xuất | Vì sao |
|---|---|---|
| Modal/Dropdown/Tooltip a11y chuẩn | **Radix UI Primitives** (headless) | Không áp style riêng — ta tự tô bằng tokens; thay `window.confirm/prompt`, `<details>` menu; focus-trap/ESC/aria có sẵn |
| Toast | **sonner** | Nhẹ, đẹp, thay `msg` text mảnh |
| Drag-and-drop | **@dnd-kit/core** | Có keyboard sensor (giữ đường bàn phím bắt buộc), nhẹ, không opinionated về UI |
| i18n | **react-i18next** | Chuẩn ngành, tách chuỗi VI/EN, lazy-load namespace |
| Nhập số tiền | **@react-input/number-format** (hoặc tự viết ~15 dòng) | Format sống, giữ giá trị thô |
| Icon | **lucide-react** | Thay các ký tự `◱ ⋯ ▲ ⌕ ✕` bằng icon nét đều, đồng bộ |
| Animation vi mô | **Framer Motion** (tuỳ chọn) | Chuyển ga/mở popover mượt; tôn trọng `prefers-reduced-motion` đã có (`tokens.css:93`) |

**Không khuyến nghị** kéo cả UI-kit nặng (MUI/AntD) vào — sẽ đè lên design system "bản đồ tuyến điều độ" đã dựng công phu và làm nặng bundle. Ưu tiên headless + tokens sẵn có.

---

## D. Thứ tự đề xuất triển khai

**Sprint 1 — "Quick wins" (nửa ngày, rủi ro thấp, chạm nhiều):**
`#1 Logo→Home` · `#3 màu ưu tiên` · `#4a bỏ hint Luồng` · `#2 format số tiền` · `#14 USD grouping` · `#8 filter Applicant` · `#9 tìm-hồ-sơ có dữ liệu mặc định`.

**Sprint 2 — Line-map giống concept (mục #5, #6, #7):**
Cần đụng backend `/dispatch-map` (thêm `label/owned/terminal/sample`). Đây là phần "đẹp như concept" anh quan tâm nhất — làm gọn một sprint riêng, có review thị giác đối chiếu ảnh.

**Sprint 3 — Nền tảng trải nghiệm:**
`#13 modal thay prompt/confirm` + `#15 toast/skeleton` (Radix + sonner) → `#11 responsive` → `G` cải thiện trang chi tiết → **mục H** (dropdown Payment Term/Project Team admin-config).

**Sprint 4 — Lớn, làm sau:**
`#10 i18n VI/EN` (bóc chuỗi) · `#12 drag-and-drop` (ràng buộc: đúng trạm kế + popup — E.3).

---

## E0. Tiến độ triển khai

**Sprint 1 (Quick wins) — ĐÃ LÀM** ✅ (typecheck sạch, 9/9 test web xanh):
- `#1` Logo → Home (`App.tsx` brand thành `<button onClick={goHome}>`).
- `#2` Số tiền format **sống** khi gõ (lưu số thô, hiện nhóm) — `CreateTicketForm` + `groupAmount`.
- `#3` Nút ưu tiên **tô màu theo mức** (Khẩn=đỏ, Gấp=cam) — `modal.css` + token `--urgent-soft/--rush-soft`.
- `#4a` Bỏ dòng "→ Luồng" khỏi form tạo hồ sơ.
- `#14` `groupAmount(amount, currency)` — VND dấu chấm, USD dấu phẩy (+ `format.spec.ts`), áp ở MyTickets/TicketDetail.
- `#8` Applicant có **chip lọc**: Tất cả / Đang chạy / Bị trả lại / Hoàn tất (kèm số đếm; "Bị trả lại" tô đỏ khi >0).
- `#9` "Hồ sơ đã đóng" **tải sẵn** tập gần nhất khi mở, không còn màn trắng.
- `F` Microcopy: gỡ 3 dòng phụ đề "hướng dẫn thao tác" (Home/LineMap/StationBoard), rút gọn phụ đề trang tra cứu.

**Cũng đã làm (theo chốt của anh):** form giữ 9 trường dùng chung · **label tiếng Anh** · **Document Type dạng optgroup 3 luồng** (`DOCUMENT_TYPE_GROUPS` trong contracts + spec). Payment Term/Project Team **vẫn là input** cho tới khi backend config (mục H) xong.
**Chưa kiểm mắt trên browser** (cần `docker compose up postgres mailpit` + dev server) — logic/test đã xanh, sẽ chụp đối chiếu concept ở Sprint 2.

---

## E. Quyết định đã chốt (2026-07-12)

1. ✅ **Bắt đầu:** Quick wins trước (Sprint 1).
2. ✅ **Ga terminal:** không đếm tồn tích luỹ — **chỉ giữ "đang tồn" hiện tại**; số hoàn tất tính **theo tháng**, qua tháng mới reset (không cộng dồn qua các tháng/năm). → Line-map: ga terminal hiển thị đếm-đang-tồn (thường là `—` với ga đích), throughput hoàn tất tính trong tháng hiện tại. *Cần chỉnh `/dispatch-map`: count = đang-ở-ga; nếu hiển thị hoàn tất thì bó theo `month-to-date`.*
3. ✅ **Drag-and-drop:** **có làm**, nhưng ràng buộc chặt — (a) trong UI giải thích **vì sao mặc định không kéo-thả** (state machine đóng, kỷ luật bàn giao); (b) chỉ cho kéo tới **đúng trạm kế tiếp theo thứ tự** (không nhảy cóc, không lùi); (c) nếu bước đó cần dữ liệu (vai đó phải nhập, vd Document No / ngày nhận / scan-path) thì **thả ra mở popup điền thông tin** đúng như bấm nút. Không bao giờ bỏ qua guard/lý do/confirm. → thuộc Sprint 4.
4. ✅ **i18n:** để **Sprint 4**. Nút VI/EN có thể thêm sớm, dịch dần.
5. ✅ **Payment "Hoàn tất":** **có** — thêm ga đích rỗng ở cuối ray Payment cho đồng bộ concept (Sprint 2, phần line-map). *Caveat review: node "Hoàn tất" là **ga ảo**, không phải `TICKET_STATUS` thật → phải cho nó **không click được** (hoặc popover báo "ga đích") vì `GET /stations/:status/tickets` với status ảo sẽ trả `[]` (dead popover). Ngoài ra `DispatchMapUseCase.execute(role)` hiện chỉ nhận **role, chưa có sub** (`dispatch-map.usecase.ts:33`) — `owned` theo-vai suy được, nếu cần theo người giữ cụ thể phải luồn thêm `sub`.*
6. ✅ **Form tạo hồ sơ:** **giữ 9 trường dùng chung** (KHÔNG tách theo loại). Chốt:
   - Title input **tiếng Anh**: Document Type · Contractor · Contract No · Project Team · Amount · Currency · Payment Term · Budget Code · Description (+ Priority).
   - **Document Type = dropdown gom nhóm 3 luồng** (`<optgroup>`): General / Contract (Contract·VO·Annex·Budget) / Payment — vẫn chọn được đủ 6 loại, giữ nguyên mapFlow.
   - **Payment Term = dropdown, admin cấu hình** (thêm/bớt). Seed: `Warranty payment, Onetime, 1st, 2nd, 3rd, 4th … 20th, 21st …` (admin tự thêm).
   - **Project Team = dropdown, admin cấu hình** (thêm/bớt).
   - → xem **mục H** cho backend config.
7. ✅ **Thư viện:** **đồng ý** cài Radix + sonner + @dnd-kit + react-i18next + lucide (bundle on-prem, không CDN ngoài).
8. ✅ **Xem browser:** **có** — khi làm Sprint 2 sẽ mở dev server + Playwright chụp đối chiếu concept.
9. ✅ **Trang chi tiết hồ sơ (①):** chia 2 khu — Thông tin chung (9 trường Applicant + người tạo) & Thông tin DCC (luôn hiện, trống nếu chưa có). Xem **mục I**.
10. ✅ **Vai DCC2 / DCC3 (②):** nhập bộ trường xử lý (Document No **free text** · Send to Finance · Ngày ký Worldsoft · Path scan · Ghi chú tách DCC1/2/3); chỉ vai giữ ga sửa, người khác chỉ xem. Xem **mục I**.

---

## H. Backend config — Payment Term & Project Team (dropdown admin cấu hình)

Mô hình **gần giống** màn SLA config (`SlaConfigAdmin.tsx`) về UI, **nhưng KHÁC ở API** — đính chính sau review: SLA config chỉ có **GET + PUT-upsert** trên tập khóa `(flow,status)` **cố định** (`admin.controller.ts:41,46`), **không có POST/DELETE**. `option_config` cần **CRUD đầy đủ** (thêm/xoá giá trị tuỳ ý, `id` autoincrement) → đây là **pattern MỚI**, không phải tái dùng SLA. Không chặn, nhưng đừng kỳ vọng copy nguyên.

- **Dữ liệu:** 1 bảng `option_config(kind, value, sort_order, active, updated_by_sub, updated_at)`, `kind ∈ {paymentTerm, projectTeam}`; unique `(kind, value)`.
- **Seed Payment Term** (admin sửa được sau): `Warranty payment, Onetime, 1st, 2nd, 3rd, … , 20th, 21st, …`.
- **Seed Project Team:** để trống hoặc vài giá trị mẫu — admin tự thêm.
- **API:**
  - `GET /config/options?kind=paymentTerm|projectTeam` → danh sách `active`, sắp theo `sort_order` (Applicant form gọi cái này).
  - `GET /admin/options`, `POST /admin/options`, `PUT/DELETE /admin/options/:id` (SA CRUD).
- **FE:**
  - `CreateTicketForm`: Payment Term & Project Team đổi từ `<input>` → `<select>` nạp từ `GET /config/options`. Có mục "— chọn —" và chặn submit nếu chưa chọn.
  - Màn admin mới `OptionConfigAdmin` (soi `SlaConfigAdmin`): thêm/sửa/tắt giá trị theo `kind`.
- **TDD:** domain thuần cho validate (value không rỗng, không trùng); application use-case; http integration (Postgres thật).
- **Công sức:** ~1 ngày. *(Chưa code — chờ chốt file.)*

## I. Trang chi tiết hồ sơ (①) + vai DCC2/DCC3 (②) — CẦN ANH MÔ TẢ

> Hai phần này anh muốn tự định nghĩa. Tôi liệt kê **hiện trạng** để anh chỉ cần nói *thêm/bớt/đổi gì*.

### ① Trang chi tiết hồ sơ — CHỐT: chia **2 khu vực dữ liệu**
Sắp xếp lại phần dữ liệu (giữ timeline · tóm tắt · nhật ký bổ trợ):

**Khu vực 1 — Thông tin chung** (Applicant nhập lúc tạo hồ sơ; ở detail **chỉ đọc**):
- 9 trường: Document Type · Contractor · Contract No · Project Team · Amount · Currency · Payment Term · Budget Code · Description.
- **+ Người tạo** (hiển thị tên người tạo hồ sơ — resolve từ sub qua directory, AD-12).
- **Form TẠO hồ sơ của Applicant chỉ có 9 trường này** — KHÔNG có trường DCC.

**Khu vực 2 — Thông tin DCC nhập** (xem ②): Document No · Send to Finance (ngày) · Ngày ký Worldsoft (ngày) · Path scan · Ghi chú (theo DCC1/2/3).
- Ở detail **luôn hiển thị khu vực 2**; trường nào **chưa có thì để trống** (placeholder "— chưa có —").

*Giữ nguyên:* Tuyến xử lý (timeline dọc), Tóm tắt SLA, Nhật ký bàn giao bất biến (đề xuất mục G: đổi sang **bảng**).

### ② Vai DCC2 / DCC3 — CHỐT: **nhập bộ trường xử lý** sau khi DCC1 gửi đến
Khi hồ sơ **đã tới tay DCC2 (luồng Contract) / DCC3 (luồng Payment)** — tức sau khi DCC1 gửi đến — vai đó được **nhập/sửa** các trường ở *Khu vực 2*:

| Trường | Kiểu nhập | Ghi chú |
|---|---|---|
| **Document No** | text | mã chứng từ, ví dụ anh cho: `25-PR-3034` — ⚠️ xem cảnh báo format bên dưới |
| **Send to Finance** | **date picker** (chọn lịch) | ngày gửi Tài chính |
| **Ngày ký Worldsoft** | **date picker** (chọn lịch) | ngày ký trên Worldsoft |
| **Path scan** | text | đường dẫn fileserver, ví dụ `//fileserver/...` (không upload file — AD) |
| **Ghi chú** | text nhiều dòng, **tách theo DCC1 / DCC2 / DCC3** | mỗi vai có ô ghi chú riêng của mình |

- **Điều kiện sửa (quyền):** **chỉ vai đang phụ trách** ga hiện tại của hồ sơ mới sửa được, và chỉ khi hồ sơ đang ở bước tương ứng (đóng rồi thì khoá). **Người không liên quan chỉ XEM** (read-only), không sửa. Mọi thay đổi ghi **audit** (append-only).
- **Ghi chú tách vai:** DCC1, DCC2, DCC3 mỗi vai **một ô ghi chú riêng** — vai nào chỉ sửa được ô của vai đó; các ô khác hiển thị read-only.
- **Giữ nguyên** các hành động hiện có (nhận 2 pha, báo thiếu giấy, gửi Kế toán, hoàn tất, nhận từ ACC, đề nghị/đẩy trả lại, tra cứu/reopen).

**Hệ quả kỹ thuật (để triển khai):**
- **Data model:** thêm cột ticket: `sendToFinanceDate`, `worldsoftSignDate`, và **ghi chú tách vai** `dccNote1 / dccNote2 / dccNote3`. `scanPath` & `documentNo` **đã tồn tại** — tái dùng (documentNo chỉ nới validator thành free text, giữ unique).
- **Quyền (RBAC):** endpoint guard **vai đang giữ ga × trạng thái hồ sơ**; ghi chú theo vai → chỉ vai đó sửa ô của mình. Ai khác = view.
- **API:** `PATCH /dccX/tickets/:id/processing-fields` (guard) + trả các trường này trong `GET /ticket/:id`.
- **FE:** *Khu vực 2* là form sửa (2 ô date = date picker) cho vai có quyền; read-only + placeholder "— chưa có —" cho người xem.
- **TDD:** domain guard (ai/khi nào sửa được) → application use-case → http integration → web component.

> ✅ **ĐÃ CHỐT — `Document No` để TỰ DO (free text).**
> `documentNo` chính là "Document No do DCC2/DCC3 nhập trước khi gửi Kế toán" (comment `document-no.ts:1-8`) — không phải field mới, tái dùng cột sẵn có.
> **Việc code:** (1) **nới validator** `isValidDocumentNo` từ `^\d{2}-CC-\d+-CT$` → chỉ cần **không rỗng** (chữ + số + ký tự) — sửa `document-no.ts` + cập nhật `document-no.spec.ts`; (2) **cho nhập sớm ở detail** (không chỉ ở bước gửi Kế toán) qua PATCH processing-fields, soi theo `updateFields`.
> **Uniqueness:** GIỮ unique partial index (chống trùng số toàn hệ thống) — đã có thông báo 409 "trùng" ở `SendAccountingModal`; nhân rộng thông báo thân thiện ở detail. *(Nếu anh muốn cho phép trùng thì bỏ index — nói tôi biết; mặc định giữ.)*
>
> **Path scan `//fileserver/...`** = free text đường dẫn, không upload — OK, không ràng buộc format.
> **Bất biến đúng:** audit là **append-only**, code đã ghi `field_changed` ngoài transition ở **`TicketRepo.updateFields`** (`ticket.repo.ts:214-266`) → PATCH này soi theo đó. Chỉ `ticket.status` là độc-quyền-`transition()` (AD-2).

**Đã chốt với anh (2026-07-12):**
- Note = **ghi chú của DCC, tách theo DCC1/DCC2/DCC3** (KHÔNG phải trường Applicant thứ 10 → không phá 9 trường). ✅
- DCC2 & DCC3 dùng chung bộ trường khu vực 2. ✅
- Người không liên quan **chỉ xem**, không sửa. ✅
- **Document No = free text** (nới validator, giữ unique chống trùng). ✅ → **hết điểm chặn, file trọn vẹn.**

---

## J. Bảng hồ sơ của Applicant — thêm cột + nhãn dễ đọc

- **Hiện trạng:** `MyTickets.tsx` bảng chỉ có **5 cột**: Mã hồ sơ · Nhà thầu · Loại chứng từ · Số tiền · Trạng thái.
- **Anh muốn:** thêm cột + **nhãn (badge màu)** để nhìn là biết ngay.
- **Đề xuất cột** (ưu tiên theo dữ liệu đã có trong `TicketView`):

| Cột | Nguồn | Nhãn/định dạng |
|---|---|---|
| Mã hồ sơ | `code` | mono; chấm xanh "chưa xem >24h" (đã có) |
| Nhà thầu | `contractor` | |
| Loại chứng từ | `documentType` | |
| **Luồng** *(mới)* | `flow` | badge nhỏ (Contract/Payment/General) |
| Số tiền | `amount`+`currency` | nhóm nghìn + đơn vị (đã có) |
| **Ưu tiên** *(mới)* | `priority` | **badge màu**: Thường (xám) · ◆ Gấp (cam) · ◆ Khẩn (đỏ) — tái dùng `.prio` |
| **Ngày tạo** *(mới)* | `createdAt` | `dd/MM/yyyy` |
| **Đang ở / Người giữ** *(mới)* | `status`+`currentHolderSub` | nhãn ga thân thiện + tên người giữ (cần directory) |
| Trạng thái | `status` | chip màu (đã có); Returned = đỏ |

- **Cần server bổ sung:** (a) `overdueDays` vào `/tickets/mine` nếu muốn **badge SLA "▲ N ngày"** ở bảng Applicant (hiện list chưa trả); (b) `directory` (sub→tên) để hiện "người giữ". Nếu không muốn đụng server, bỏ 2 cột này ở đợt đầu.
- **Nhất quán:** nhãn dùng chung thang màu với board (ưu tiên/So SLA/Returned). Bảng vẫn bấm hàng → bung timeline như hiện tại.

## K. Khu vực Quản trị (Admin) — sidebar · user SSO · danh mục · audit log

**Bối cảnh anh nêu:** Admin **local là dự phòng**; về sau **Admin SSO** (user được gán vai Admin từ PMH ID) đảm nhiệm quản trị chính. UI hai bên **giống nhau**, chỉ khác nguồn xác thực.

- **Hiện trạng:** trang Admin = 2 khối xếp dọc (`App.tsx:121-126` → `AdminUsers` + `SlaConfigAdmin`). `AdminUsers` liệt kê user **đã đăng nhập** rồi tick vai (`/admin/users`).
- **Anh muốn:** **Sidebar** chia khu quản trị, gồm:
  1. **Người dùng & Vai** — như `AdminUsers` (tick vai). *(đã có)*
  2. **Người dùng SSO & Bổ nhiệm Admin** *(mới)* — **tìm user SSO theo email** rồi bổ nhiệm (gán vai, đặc biệt **Admin dự án**). ✅ **Khả thi — đã xác minh README §5:**
     - Directory API (M2M, client-credentials): **`GET /api/v1/users?search=<email>&page=`** — hỗ trợ **search theo email/tên, phân trang** → đúng cách anh muốn (gõ email chọn user). Mỗi user trả `id`(=`sub`) · `employee_code` · `email` · `full_name` · `groups[]` · `status`.
     - **Bổ nhiệm Admin** = lấy `sub` từ kết quả search → gọi RBAC nội bộ `setUserRoles(sub, [...,'Admin'])` (dùng đúng `sub`, AD-7). Không cần user đó đăng nhập trước.
     - ⚠️ **Ràng buộc phạm vi:** README §5 + §8 — client **chỉ thấy user thuộc group đã gán cho client** (không thấy toàn bộ công ty). Muốn search **mọi nhân viên** để bổ nhiệm, cần admin PMH ID gán thêm group hoặc bật **`allow_all_groups`** cho client QLHS. → **1 việc cấu hình phía SSO admin, không phải code.**
     - Token M2M lấy qua `POST /oidc/token grant_type=client_credentials` (BFF giữ secret, không đẩy xuống SPA).
  3. **Danh mục (master data)** *(mới)* — các **dropdown cấu hình được**: Payment Term, Project Team (mục H), có thể mở rộng (loại tiền tệ…). Mỗi danh mục CRUD (thêm/sửa/tắt/sắp thứ tự).
  4. **Ngưỡng SLA** — như `SlaConfigAdmin`. *(đã có)*
  5. **Audit log** *(mới)* — màn xem `ticket_event` **toàn hệ thống** (append-only, bất biến): lọc theo hồ sơ/người/hành động/khoảng ngày, **chỉ đọc**. *(dữ liệu đã có; cần API list mới — hiện `ticket_event` chỉ lộ qua timeline của từng hồ sơ.)*
- **Đăng xuất — CHỐT: chỉ dùng LOCAL** (anh muốn: thoát app này nhưng **giữ phiên SSO** để vào dự án khác):
  - **Đã xác minh code ĐÚNG:** `/auth/logout` (`auth.controller.ts:146-152`) chỉ xoá session + cookie, **KHÔNG** gọi `/oidc/logout` → phiên SSO còn sống, user vào dự án khác/vào lại QLHS không phải nhập mật khẩu. ✅ **Không cần thêm nút "Đăng xuất toàn hệ".**
  - **Back-Channel Logout đã có sẵn** (`auth.controller.ts:159` + `pmh-id.identity.ts:119`) → khi bị khoá/đăng xuất từ nơi khác vẫn văng tức thì. ✅
  - Nên rà thêm: callback có bắt `error=access_denied` chưa (README §4.5) → báo "chưa được cấp quyền", không văng 500.
- **RBAC:** chỉ vai **Admin** thấy sidebar Quản trị. Guard ở server cho mọi endpoint admin (đang có cho users/sla).
- **Local vs SSO admin:** cùng bộ màn; local admin (đăng nhập local, dự phòng) và Admin-SSO (vai Admin gán từ IdP) **thấy y hệt**. Ghi rõ trong tài liệu để vận hành không nhầm quyền.
- **Việc mới cần làm:** layout sidebar admin · endpoint Directory-search (tuỳ IdP) · module danh mục (mục H mở rộng) · endpoint + màn audit-log · điều hướng (thêm route admin con).

---

## L. Rà soát bổ sung — full sweep (2026-07-12)

Soi nốt ReturnPanel · 3 modal · RoleSwitcher · LocalAdminLogin · ThemeToggle · table.css.

### L1. ReturnPanel (form sửa khi Return-fixing) — **lệch create form, cần đồng bộ · Cao**
`ReturnPanel.tsx:11-20,113-142` là form Applicant sửa lại 9 trường rồi nộp lại, NHƯNG **không khớp** create form đã sửa:
- Label **tiếng Việt** ("Mô tả", "Điều khoản thanh toán", "Số hợp đồng", "Dự án / Nhóm", "Tiền tệ", "Nhà thầu", "Loại hồ sơ") — create form nay **tiếng Anh**.
- Document Type dùng **`ALL_DOCUMENT_TYPES` phẳng** (`:118`), không **optgroup 3 luồng**.
- Số tiền = input thô, **không format sống**; Currency = **input text tự do** (không phải select VND/USD). Label khó hiểu "Số tiền (đơn vị nhỏ nhất)" (`:17`).
- Lỗi "…đủ 9 trường" (`:69`) — ngôn ngữ hệ thống.
- **Sửa:** tách **1 component form dùng chung** cho cả *Tạo mới* và *Return-fixing* (cùng label EN · optgroup · format số tiền · select currency) — vừa nhất quán vừa hết trùng code. *(Sprint 1 mới sửa create; ReturnPanel còn bản cũ.)*
- ⚠️ **Cờ đỏ dữ liệu:** label "đơn vị nhỏ nhất" gợi ý amount lưu theo **đơn vị nhỏ nhất** (cents), trong khi `groupAmount` coi amount là **số nguyên thường** → cần chốt amount lưu dạng nào để không sai 100 lần.

### L2. SendAccountingModal — **vẫn ép format cũ, chặn `25-PR-3034` · Cao**
`SendAccountingModal.tsx:4,55-57,108,115` hardcode `^\d{2}-CC-\d+-CT$`, validate client-side + placeholder/hint "26-CC-..-CT". Đã chốt **Document No = free text** → modal này **phải nới**: bỏ regex client, đổi placeholder/hint, giữ báo lỗi **409 trùng** (đã có, tốt). Nếu không, DCC gõ `25-PR-3034` **bị chặn ngay ở client**. → làm cùng lúc với việc nới `document-no.ts`.

### L3. Các modal khác — nhỏ
- **CompleteContractModal** (`:54`) & **HandoverModal** (`:124`) dùng **`window.confirm()`** cho hệ quả/‌"thiếu giấy" → thuộc #13 (thay bằng modal xác nhận của design system). Placeholder scan `\\share\scans\…` (`CompleteContractModal.tsx:100`) — thống nhất với ví dụ `//fileserver/...` của anh.
- **Điểm tốt (giữ khi refactor):** 3 modal đều **focus-trap + ESC + aria-modal + trả focus** rất chuẩn; date input `max=today` chặn ngày tương lai. `FOCUSABLE`/logic trap lặp 3 nơi → gom **1 hook `useModalA11y`** khi làm Radix.

### L4. Vụn khác
- **Bảng Applicant: highlight hàng mở bị chết** — `table.css:37 tr.open td` có style nền accent, nhưng `MyTickets.tsx` chỉ set `aria-expanded`, **không thêm class `open`** → hàng đang mở không sáng. Thêm `open` vào className khi mở (mục J làm luôn).
- **RoleSwitcher** (`:13`) chỉ hiện khi >1 vai, dạng pills — concept có **tab điều hướng ngang** (Toàn cảnh/DCC1/DCC2/DCC3/Applicant) ở giữa header. Cân nhắc căn theo concept ở Sprint 2 (thẩm mỹ).
- **ThemeToggle** — OK: `main.tsx:14-15` đã set `data-theme` từ `localStorage` trước `createRoot`. Chỉ còn **micro-flash** cho user chọn Light (HTML gốc chưa có `data-theme`, chờ JS bundle chạy) → nếu muốn mượt tuyệt đối, chèn 1 script inline nhỏ ở `<head>` của `index.html`. Ưu tiên thấp.
- **LocalAdminLogin** ổn; đây là break-glass SA (khớp mục K "local là dự phòng").

---
*File tổng hợp — cập nhật liên tục theo trao đổi. **Đã qua review đối chiếu code (2026-07-12):** vá các claim lỗi thời (A/F), `documentNo` → free text (giữ unique), đính chính bất biến audit (soi `updateFields`), sửa "pattern SLA", caveat ga ảo Payment. Sprint 1 đã code (xanh test, chưa commit). Mọi điểm chặn spec đã gỡ; mục J/K là yêu cầu mới (bảng Applicant + khu Quản trị). TDD (đỏ → xanh → refactor), file ≤300 dòng.*
