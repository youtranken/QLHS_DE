# Review UI/UX khu DCC (board · dispatch · closed) — 2026-07-28

> **✅ ĐÃ ÁP DỤNG (2026-07-28):** toàn bộ P1 + P2 + P3 bên dưới đã sửa xong (pure-web, không đụng API).
> P1: try/catch + StateNotice ở StationBoard/LineMap/ClosedTickets; cổng ConfirmModal cho SendAccounting Payment;
> in-flight guard chống double-click (`useBoardActions`); seize xử lý `{acquired}`. P2: toast bus thay banner `msg`;
> label↔input + `*`; `window.confirm`→ConfirmModal; StationDrawer aria-modal+focus-trap; aria-pressed. P3: tách
> `shared/useFocusTrap.ts` (3 modal board + drawer); StationBoard 302→185 (`useBoardActions.ts`), ClosedTickets
> 296→220 (`ClosedResultsTable.tsx`); `<details>` ⋯ tự đóng. Verify: tsc+build+**112** unit+**5** e2e xanh.

> Backlog để nối lại sau. Đã quét bằng 3 sub-agent theo bản đồ `graphify-out/GRAPH_REPORT.md`,
> lấy chuẩn chất lượng từ khu admin (Aurora) + màn Applicant vừa polish (StateNotice / toast /
> ConfirmModal / focus-trap / label↔input). **Chưa sửa gì** — mới review.
> Trạng thái lúc ghi: Applicant đã xong P1+P2+P3; routing bỏ `#`; admin redesign — tất cả còn ở
> working tree, chưa commit. **Đang tạm dừng DCC để chỉnh lại Applicant trước.**

## Phạm vi file DCC (theo graph)
- **board/**: `StationBoard.tsx` (253, sát trần 300), `BoardCardView.tsx`, `cardAction.ts`,
  `DupBadge.tsx`, `api.ts`, `ask.ts`, `slaPauseActions.ts`; modal: `HandoverModal.tsx`,
  `SendAccountingModal.tsx`, `CompleteContractModal.tsx`
- **dispatch/**: `LineMap.tsx`, `MetroLine.tsx`, `StationNode.tsx`, `StationDrawer.tsx`,
  `StationPopover.tsx`, `useStationData.ts`, `api.ts`
- **closed/**: `ClosedTickets.tsx` (278, sát trần 300), `api.ts`
- i18n: `i18n/vi/board.ts`, `i18n/vi/closed.ts`

---

## 🔴 P1 — nặng (đã xác minh tận dòng)

1. **Bảng ga "chết câm"** — `StationBoard.tsx:43-45`: `load()` không try/catch, không state loading.
   `useLiveRefetch` nuốt rejection → API lỗi thì `cols` vẫn `[]`, DCC **tưởng hết việc** (màn dùng
   nhiều nhất). *Sửa:* try/catch + state `error`/`loaded` + `<StateNotice kind="error" onRetry={load}/>`;
   giữ cột cũ khi refetch-sau-thành-công lỗi (đúng pattern `MyTickets.tsx:36-44`). Thêm skeleton/loading.

2. **Bản đồ tuyến "trắng câm"** — `useStationData.ts:11-14`: `load()` không try/catch, không state.
   `ticketsOf` (18-24) cũng không catch. *Sửa:* thêm `loading/error` trong hook, try/catch; `LineMap`
   render `StateNotice loading|error onRetry` + empty rõ ràng.

3. **ClosedTickets kẹt "Đang tải…"** — `ClosedTickets.tsx:35-41` (load mặc định `searchClosed({}).then`
   không `.catch`) và `run()` (43-51) `try/finally` thiếu `catch`. Lỗi → `rows` giữ `null` (kẹt loading)
   hoặc stale. *Sửa:* try/catch + StateNotice/toast.err.

4. **Gửi ACC (Payment) đóng hồ sơ VĨNH VIỄN, không cổng xác nhận** — `SendAccountingModal.tsx:53-72`:
   `submit()` validate format rồi gọi thẳng `onSubmit(value)`. Cảnh báo Payment không-hoàn-tác chỉ là
   `note` thụ động (`:124`). Khác `CompleteContractModal` (có `confirm`). *Sửa:* bật `ConfirmModal danger`
   (nêu hệ quả) trước `onSubmit` cho nhánh có `note`/không-hoàn-tác.

5. **Hành động ⋯ trực tiếp không chống double-click** — `cardAction.ts` (các nhánh chạy-ngay `__pick`,
   `__confirm`, `__resend/-dcc3`, `RESUME_EVENT`, reversible) POST ngay, nút `BoardCardView.tsx:79-85`
   bấm liên tục được → double-pick / `__confirm` **sinh 2 mã**. Modal + ConfirmModal có `busy` guard,
   đường trực tiếp thì không. *Sửa:* Set in-flight theo `card.id` truyền xuống để disable nút khi đang gửi.

## 🟡 P2 — port polish + a11y

- **Board & Closed vẫn dùng banner `msg` xám thay `toast` bus** — `StationBoard.tsx:35,141-155`;
  `ClosedTickets.tsx:29,53-70,173-177`. Hệ quả: ok/err **cùng màu xám**, không tự tắt, đẩy layout.
  App đã mount `<ToastHost/>`. *Sửa:* `toast.ok/err`; Undo → `toast.action(text,{label,run})`; bỏ state
  `msg`/`undoId` + JSX kèm (~15 dòng).
- **Seize không phản hồi/không catch** — `StationBoard.tsx:186-189`: `seizeCard(id).then(load)`. Bỏ qua
  `{acquired:boolean}` → giành hụt thì reload câm. *Sửa:* `toast[acquired?'ok':'err']`, try/catch, disable.
- **3 modal DCC + StationDrawer: label không gắn input** — `HandoverModal.tsx:108-115`,
  `SendAccountingModal.tsx:102-114`, `CompleteContractModal.tsx:94-106`. *Sửa:* `id`+`htmlFor` (như `ct-*`).
- **`window.confirm` trong modal** — `HandoverModal.tsx:125`, `CompleteContractModal.tsx:55`. Vi phạm
  UX-DR15. *Sửa:* `ConfirmModal danger` (đã có reason gate + a11y).
- **`StationDrawer.tsx:31` `role="dialog"` thiếu `aria-modal` + focus-trap + restore-focus** — Tab lọt ra
  nền sau scrim. *Sửa:* mượn mẫu ConfirmModal (xem P3 useFocusTrap).
- **Dấu `*` thiếu** ở `SendAccountingModal.tsx:102`, `CompleteContractModal.tsx:94`.
- **`aria-pressed` thiếu** ở chip lọc Closed — `ClosedTickets.tsx:165` (đã tránh `role=tab`, dùng group).
- **`ticketsOf`/open/hover không catch** — `LineMap.tsx:48-55`, `StationNode.tsx:47`: drawer không mở khi
  lỗi, câm. *Sửa:* try/catch + `toast.err`.

## 🟢 P3 — dọn nợ + tách file

- **Tách file sát trần 300:** `StationBoard.tsx` (253) → rút 6 handler modal (54-112) ra
  `useBoardModals`/`boardModalActions.ts`. `ClosedTickets.tsx` (278) → `ClosedSearchForm` +
  `ClosedResultsTable`/`ClosedRow` + hook `useClosedSearch`.
- **Trích `useFocusTrap` / `<ModalShell>` dùng chung** (đòn bẩy cao nhất) — 5 chỗ lặp y hệt overlay +
  `role=dialog` + `onKeyDown` trap + restore-focus: ConfirmModal, CreateTicketForm, 3 modal board,
  StationDrawer. Trích một lần → fix luôn StationDrawer thiếu trap + gom `FOCUSABLE` (đang khác nhau
  giữa các file).
- **BoardCardView `<details>` ⋯ không tự đóng** khi mở modal (`BoardCardView.tsx:61-90`).
- **Mặt thẻ không có chip status English** khi lọc/tìm (rời ngữ cảnh cột) — cân nhắc chip nhỏ `lang="en"`.
- **Inline-style:** `SendAccountingModal.tsx:124` (note), `ClosedTickets.tsx:96,126,174,227`.
- **i18n nhỏ Closed:** `ClosedTickets.tsx:90` (subStatuses hardcode), `:211` (chip flow thiếu `lang="en"`).
- **HandoverModal:** autofocus rơi vào `✕` thay vì ô ngày (`:45`); `guard()` (71-79) không catch; nút
  đóng/`✕` không `disabled` khi `busy`.
- **Kiểm `tabular-nums`** cho số ở StationDrawer `.dstat .v`/`.slameter` và cột số Closed (rà `design/*.css`).

---

## Điểm mạnh giữ nguyên
- `useLiveRefetch` (SSE debounce 250ms + fallback 30s) chuẩn cả board lẫn map.
- Soft-lock có affordance (`lockedBy` → "đang xử lý" + Giành quyền; SLA gate theo `card.mine`).
- Tín hiệu SLA/ưu tiên tinh tế (quá-hạn-trước-khi-dừng vs thật; ⏸; KHẨN/GẤP; F12 nghi-trùng có popup).
- 3 modal + ConfirmModal đã có `role=dialog`+`aria-modal`+`aria-labelledby`+trap+`busy` guard.
- ClosedTickets empty-state phân biệt có/không truy vấn; reopen qua ConfirmModal(reason, danger); bảng
  responsive `th scope`+`data-label` sập card mobile.
- StationNode `aria-label` giàu ngữ cảnh + `onFocus/onBlur` phản chiếu hover (bàn phím cũng có popover).

## Thứ tự đề xuất khi nối lại
P1 (5) → P2 (toast bus + seize + label + ConfirmModal + StationDrawer trap) → P3 (useFocusTrap chung +
tách 2 file sát trần). Mỗi đợt: `pnpm exec tsc -b && vite build` + `vitest run` + `pnpm run e2e`.
