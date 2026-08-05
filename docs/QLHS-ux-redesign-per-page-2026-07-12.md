# QLHS · Blueprint cải thiện UI — từng page, từng ngóc ngách

> Bổ sung cho `QLHS-ux-audit-2026-07-12.md`. Audit trước liệt kê *gaps*; file này đưa **phương án thiết kế cụ thể** cho mọi page — grounded theo class/token thật (`apps/web/src/design/*.css`), không nói chung chung.
> Mockup TicketDetail (xem được): artifact "TicketDetail — thiết kế lại".
> Ngày: 2026-07-12. Người soi: UX/FE lead.

---

## 0. Nguyên tắc & primitive dùng chung (làm 1 lần, tái dùng khắp nơi)

| Primitive | Vấn đề nó giải | Định nghĩa |
|---|---|---|
| **`.fset` — khung nhóm (fieldset)** | Mọi form/detail đang đổ field vào một lưới phẳng không nhóm | Viền `--line-soft`, radius 12, `padding:26px 14px 14px`; `.fset-hd` là legend notch (`top:-8px`, nền `--panel`) chữ 9.5px uppercase `--ink-3`, số mục `.n` màu accent. Biến thể `.flow-contract/payment/general` tô viền theo luồng. |
| **`.boardnote` — toast/status khung** | 3 chỗ `role=status` là `<p>` inline-style, nhảy layout | 1 dải cao cố định (min-height) `--panel-2` + viền `--line-soft`, radius 9. Thay toast ở StationBoard, ClosedTickets; kênh success cho Admin. |
| **`StatusChip` component** | Bị copy nguyên văn ở MyTickets + inline ở ClosedTickets | Tách `features/tickets/StatusChip.tsx`, thêm class `.chip small`, bỏ màu inline. |
| **Audit `tabular-nums`** | `.amt`, `.sla`, `.dwell`, `.n`, `.flag`, `.ct`, count đều mono nhưng **không** tabular → số nhảy cột | Thêm `font-variant-numeric:tabular-nums` (hoặc dùng chung `.mono` ở `tokens.css:82`). |
| **Skeleton `.skel`** | Không page nào phân biệt "đang tải" với "rỗng" | Khối shimmer `linear-gradient` trên `--panel-2`; reduced-motion thì tĩnh. Ghost columns/lines/rows. |
| **Focus ring cho widget tự chế** | `.stn` node, `.dots` menu, `.pi`, `<tr>` click không có focus nhìn thấy | Global `:focus-visible` (`tokens.css:93`) chỉ phủ control gốc; thêm ring cho phần tử đích (vòng tròn node, glyph `⋯`). |
| **2 tầng "chọn"** | Topbar làm role-switch (đổi cả trang) trông ngang một cái link | Pill accent đầy = **vai/mode** (hệ quả cao nhất); underline tab = **nav trang**. Không để cùng một trọng số. |

---

## 1. TicketDetail — 9 trường phẳng → 4 khung nhóm  *(điểm đau đã nêu — có mockup)*

**Hiện trạng** (`detail.css:77`): `.fgrid` = `grid 1fr 1fr` đổ cả `documentType, contractor, contractNo, projectTeam, paymentTerm, budgetCode, amount, round, description` ngang hàng, không nền/viền/nhóm; tóm tắt là 4 dòng `.kv` phẳng; nhật ký là câu `<b>tên</b> hành động — "lý do"` trôi.

**Thiết kế lại:**
- **① Định danh & phân loại:** Loại chứng từ · Nhà thầu · Số hợp đồng · Dự án/Nhóm — khung viền + header nhãn, mã `mono tabular-nums`.
- **② Tài chính:** **Số tiền** là điểm nhấn duy nhất — `26px mono`, **canh phải**, đơn vị `--ink-3` nhỏ hơn (đúng `DESIGN.md:115-117`); dưới là Tiền tệ · Điều khoản TT · Mã ngân sách gom cùng khung.
- **③ Diễn giải:** khung full-width riêng, chữ thường nhẹ.
- **④ Thông tin DCC nhập** (khu vực 2, audit mục I): Document No · Send to Finance · Ngày ký Worldsoft · Path scan · **Ghi chú DCC1/2/3 tách vai**; ô của vai phụ trách có pill "bạn đang sửa", ô trống = "— chưa có —" nghiêng mờ.
- **Tóm tắt → 4 stat-tiles** (SLA vượt = ô đỏ, vòng = ô xanh) + **thanh SLA meter**.
- **Nhật ký → bảng 4 cột** (Thời gian · Người · Hành động · Lý do); "trả lại" tag đỏ, "sinh mã" tag xanh.
- Phân tầng bằng **tông + viền** (`--panel-2/--panel-3/--line`), **không box-shadow** (tránh lỗi G2 trong audit).

---

## 2. StationBoard (kanban DCC)

**Hiện trạng:** `.fbar` (rail chip built sẵn) chỉ chứa 1 ô search — 90% trống (`StationBoard.tsx:194`); toast `role=status` `<p>` inline đẩy `.cols` xuống 20px mỗi hành động (`:204`); `.ch` header phẳng, `▲` quá-SLA nhỏ inline; card `.amt` không tabular, không đơn vị (`BoardCardView.tsx:58`); menu `⋯` là `<details>` trần; không loading state.

**Thiết kế lại:**
- **Toolbar:** đổ đầy `.fbar` — search + nhóm chip ưu tiên (`.fchip/.on/.hot`): `Tất cả · KHẨN · GẤP · ▲ Quá SLA (n)` (chip cuối `.hot` màu `--sla` khi >0); đẩy "Tìm hồ sơ" sang phải cùng hàng, tách khỏi `<h2>`.
- **Toast slot cố định** dưới `.fbar` (`min-height` 28px) — không đẩy layout; `.boardnote` khung mềm.
- **Header cột 3 vùng:** dòng 1 status EN + count `margin-left:auto`; dòng 2 phụ đề VI; **cột "nóng" tô cả header** `--sla-bg` + viền `--sla` + `.n.hot` — nhìn xuyên board biết ga nào quá tải. Cột reconcile giữ viền đỏ + tag `⚠ Đối chiếu`.
- **Card gộp tín hiệu:** giữ `.over` rule đỏ trái là tín hiệu SLA **duy nhất**; đưa pill `▲{n}n` lên `.r1` cạnh mã; `.amt` thêm tabular + đơn vị `.u`; `.dots` có nền hover/focus (như nút).
- **Loading:** 3 cột skeleton (bar `.ch` + 2 ghost card). **Empty cột:** node rỗng dashed + "Trống" `--ink-3`; reconcile rỗng = "Không có hồ sơ cần đối chiếu 👍".

**Ngóc ngách:** `.cardmenu` bị `overflow-y:auto` của cột **cắt cụt** ở card cuối → cần lật lên/nâng z. `.tcard:hover` thêm lift 1px. `.sla/.dwell/.n` tabular. Poll 4s: fade nhẹ card mới vào (reduced-motion an toàn).

---

## 3. LineMap (sơ đồ điều độ)

**Hiện trạng:** popover `.stnpop` render **dưới cùng** `.board` (`board.css:229`) — click node góc phải, panel mở ở dưới-trái, mất liên kết không gian; không có state "ga đang chọn" (`.node.owned` có sẵn nhưng không gắn); `.lbl` cố định 130px, tên `Contract-Budget` có thể cắt không ellipsis; legend nằm tận đáy, cuộn ngang theo rail min-width 900; "—" rỗng và loading giống nhau; không có tổng quan tải.

**Thiết kế lại:**
- **Neo popover:** đổi `.stnpop` thành **drawer phải cố định** của `.board` (không nằm dưới) — click node nào cũng mở panel cùng chỗ, `.ph` nói rõ ga nào; gắn `.node.owned` (ring accent) + `.snm.own` cho ga đang mở.
- **Dải tổng quan tải** dưới `.sec-head`: `●Hợp đồng 12 · ●Thanh toán 5 · ●General 8` (số tabular) + pill `.alert` đỏ tổng quá-SLA.
- **Đưa legend lên trên** các line và `position:sticky left:0` (không cuộn mất).
- **Line label bền:** `.nm span` nowrap+ellipsis+`title`; `.ct` thêm "· ▲2 quá hạn" màu `--sla` để mỗi tuyến tự báo sức khỏe.
- **Node states:** loading = ghost line mỗi luồng; `.node.hot` thêm nền `--sla-bg` (đỏ đặc, không chỉ viền).

**Ngóc ngách:** `.stn` có `role=button` nhưng **không có focus ring trên vòng tròn** → thêm `.stn:focus-visible .node{box-shadow ring}`. `.flag/.ct/.pi .s` tabular. `.pi:focus-visible` nền. `.pl` (max-h 230) thêm scroll-shadow. Đóng popover trả focus về node đã mở (giờ mất về `<body>`). `.alert` thêm `aria-label`.

---

## 4. MyTickets (danh sách Applicant)

**Hiện trạng:** filter 4 `.fchip` phẳng; returned chỉ nổi lên nhờ sort, không có phân nhóm trong bảng; `unseen` = inline-style 2 chỗ (`:146,:148`), không class, không chú giải; "Thu hồi" nhét **trong ô status** (`:170`); `.upd` column style có sẵn nhưng **không render** cột thời gian → không thấy độ cũ; `.amt` mono không tabular; `.expcap` có sẵn nhưng không dùng; `tr.open td` có style accent nhưng code **không gắn class `open`** → hàng mở không sáng (`table.css:37` chết).

**Thiết kế lại:**
- **Filter thành segmented control** (bọc `--panel-2` như `.roles`) + đếm "(n hồ sơ)" phải.
- **Nhóm theo vòng đời khi lọc = Tất cả:** chèn subheader `.grouphd` — "▲ Bị trả lại — cần bạn sửa (n)" (`--sla`) trên khối returned, "Đang chạy (n)" — biến ranh giới "cái nào cần tôi" thành hiện rõ.
- **`unseen` thành class thật** + legend "● = chưa xem quá 24 giờ" (chấm **accent, KHÔNG đỏ** — `EXPERIENCE.md:108`).
- **"Thu hồi" ra khỏi ô status:** cột action phải riêng (trống với hàng không hành động) hoặc nút trong `.expwrap`.
- **Dùng cột `.upd`:** "Cập nhật · 2 ngày" (mono `--ink-3`) trước status.
- **Khung hàng mở:** dùng `.expcap` header "Tuyến xử lý hồ sơ"; returned thêm dòng `.warn` tóm lý do trên `ReturnPanel`; `.expwrap` nền `--panel-2` + rule accent trái.
- **Loading:** 5 hàng skeleton. **Empty:** đã theo filter (tốt) — bọc card giữa + icon.

**Ngóc ngách:** `.amt` tabular. **Sửa bug `open`:** `className={\`click${openId===t.id?' open':''}\`}`. `<tr>` không focus được bằng bàn phím → biến ô mã thành `<button>` (như ClosedTickets) để mở được bằng keyboard. `.chip small` gom về class. `.st2 .hold` ellipsis+title.

---

## 5. ClosedTickets (tra cứu)

**Hiện trạng:** 6 ô `.fsearch` bằng nhau (`FIELDS.map`), text và date range nhìn giống hệt, chỉ có placeholder (biến mất khi gõ), nút submit trôi cuối wrap; 2 hàng `.fbar` + msg + caption = 4 dải mỏng không khung; chip luồng chỉ hiện cho DCC1 **và khi có kết quả** → nhảy layout; header cột "Mở lại" cố định nhưng DCC2/3 là "Đề nghị Reopen" (lệch nhãn); không loading skeleton.

**Thiết kế lại:**
- **Khung panel tra cứu** (`.searchpanel` card): grid có `<label>` trên mỗi ô (giữ nhãn khi đã gõ), nhóm A "Định danh" (Mã/Nhà thầu/Số HĐ), nhóm B "Người & thời gian" (Mã người nộp *(sub)* + **date range nối** Từ→Đến trong 1 khung có "→"); submit `.btn.primary` góc phải + `.btn.ghost` "Xóa lọc" (giờ chưa có cách clear).
- **Ổn định chip luồng:** render **luôn** (khi role=DCC1) kể cả 0 kết quả, đặt cùng hàng caption: "N hồ sơ · [Tất cả][Contract][Payment][General]".
- **Kết quả:** caption thành thanh trên bảng (đếm trái, chip phải); cột hành động header "Hành động" (không "Mở lại"), nút `.btn.ghost`/`.btn.warn` (Reopen là bất khả hồi), **chỉ render cột khi role hành động được**.
- **StatusChip dùng chung** (bỏ inline `:167`).
- **Loading:** dim `.atbl` opacity .6 + "Đang tìm…" hoặc 4 hàng skeleton. **Empty:** phân biệt "chưa gõ/tải mặc định" vs "đã tìm không khớp".

**Ngóc ngách:** ô rỗng → `—` `--ink-3`; field đang có giá trị → viền accent để thấy filter active; `aria-busy` form; count tabular; `role=status` msg dùng `.boardnote`.

---

## 6. CreateTicketForm (form tạo 9 trường)

**Hiện trạng:** 9 field một lưới `.fg` bằng trọng số; Document Type (chọn luồng, quan trọng nhất) ngang Budget Code; Amount kẹp giữa Project Team và Payment Term (tách khỏi Budget Code); label 10.5px gần bằng input 12.5px; `.req` sao đỏ khắp nơi (mọi field đều bắt buộc → vô nghĩa); lỗi "đủ 9 trường" generic.

**Thiết kế lại — 3 khung `.fset`:**
- **① Định danh hồ sơ** (`.fset.flow-*` tô theo luồng): **Document Type full-width lên đầu** (giữ optgroup) + **chip luồng sống** bên phải ("Contract → Luồng B") màu rail; rồi Contractor · Contract No; rồi Project Team.
- **② Tài chính** (gom tiền lại): Amount `.amtrow` format sống (đã tốt) full-width + `.hint` "= 1.250.000.000 ₫" để verify; rồi Budget Code · Payment Term.
- **③ Diễn giải & ưu tiên:** textarea nâng `min-height` 50→72px; `.prios` thay glyph inline bằng `<span class="dot">` màu `--rush/--urgent`.
- `.noattach` giữ, đưa lên ngay trên footer (là quy tắc, không phải field).

**Ngóc ngách:** autofocus Document Type; submit `aria-busy` + "Đang gửi…"; lỗi **per-field** `aria-invalid` viền `--sla` + summary nêu đúng section; `input:hover{border-color:--ink-3}`.

---

## 7. ReturnPanel (Applicant sửa & nộp lại) — **hợp nhất với form tạo**

**Hiện trạng:** `<section>` inline-style card đỏ (`:86`); form **riêng** `TEXT_FIELDS` label **tiếng Việt**, select `ALL_DOCUMENT_TYPES` **phẳng** (`:117`), currency/amount input thô (không `.amtrow`, không `groupAmount`, không priority), label "Số tiền (đơn vị nhỏ nhất)" lộ cách lưu. → **Lệch hẳn** form tạo (EN/optgroup/format).

**Thiết kế lại:**
- **Tách `<TicketFields>`** từ CreateTicketForm (3 khung `.fset` nhận `CreateTicketBody`) → cả 2 nơi dùng chung, xoá sạch divergence.
- **Chia 2 zone:** Zone A "Lý do trả về" giữ đỏ `--sla/--sla-bg` chỉ bao header lý do + actor + vòng-N (pill); Zone B là `<TicketFields>` trên nền **thường** (không đỏ) để không đấu với `aria-invalid`.
- `Returned` (trước nhận): chỉ Zone A + `.btn.warn`.

**Ngóc ngách:** nhánh "đã lưu nhưng nộp lại lỗi" → giữ form, đổi nút "Nộp lại"; lý do rỗng → "Người gửi không ghi lý do" (không em-dash trần); busy "Đang nộp…".

---

## 8. Ba modal board (Handover / CompleteContract / SendAccounting)

**Hiện trạng:** 3 file gần trùng, mỗi cái ~40 dòng focus-trap copy (FOCUSABLE lệch nhau); 1 field trần nổi giữa modal 400px, không khung, không recap ticket đang thao tác; hệ quả bất khả hồi nằm trong **`window.confirm()` native** (Complete `:54`, Handover `:124`) — phá design system; SendAccounting hardcode regex `^\d{2}-CC-\d+-CT$` chặn `25-PR-3034` client (audit L2).

**Thiết kế lại:**
- **Tách `StationModal`** (overlay + `.modal.sm` + `.mt` + trap/ESC/return-focus 1 bản, 1 FOCUSABLE) → 3 modal còn thân mỏng (bỏ ~120 dòng trùng).
- **Dải `.ref` context** (class có sẵn `modal.css:50`) đầu mỗi body: mã · nhà thầu · số tiền — neo hành động bất khả hồi.
- **Khung `.fset` cho field** theo ý định (ngày nhận / path scan / Document No), mỗi cái `.hint` ví dụ; **SendAccounting bỏ regex client**, giữ báo 409 trùng.
- **Bỏ `window.confirm`** → dòng `.warn-note` màu `--sla` ngay trên footer, nút primary/warn tự là xác nhận (trong hệ thống, đúng theme).
- **Footer thống nhất:** `[warn] … spacer … [ghost Hủy] [primary Xác nhận]`.

**Ngóc ngách:** style `::-webkit-calendar-picker-indicator` theo theme (icon dark dễ đọc), giữ `max=today`; `aria-busy`; autofocus field (dải `.ref` không focus được).

---

## 9. App shell / topbar + RoleSwitcher

**Hiện trạng:** topbar trộn 3 mối lo cùng cấp — brand / role pills (đổi cả trang) / account; **không có nav**; DCC vào Search bằng hash route rồi `.backbtn`; `.tag` banner là "where am I" duy nhất; `.me` chật, role hiện **cả** ở pill lẫn `.me` (thừa).

**Thiết kế lại — topbar 3 vùng + role là context tab:**
- **Trái (định danh + scope):** brand · divider · RoleSwitcher dạng **segmented tab** (pill accent đầy = mode cao nhất); 1 vai → chip tĩnh (không ẩn, giữ mép trái ổn định).
- **Giữa (nav trang mới `.nav`):** DCC = `Bảng điều độ · Tra cứu (· Đã đóng)`; active = **underline accent** (nhẹ hơn pill → phân 2 tầng); Applicant = `Hồ sơ của tôi`; Admin = `Vai · SLA` (§10).
- **Phải:** ThemeToggle · `.me` gọn còn avatar+tên (**bỏ role text thừa**) · logout thoáng hơn.
- Đưa `.tag` scope ra khỏi `<main>`, thành phụ đề dưới nav tab đang active.

**Ngóc ngách:** đổi vai → giữ tab nếu hợp lệ, `aria-live` "Đang xem với vai DCC2"; scroll shadow dưới topbar sticky; `.roles button:hover:not(.on){color:--ink}`; `aria-current="page"` cho tab; `.av` `title`=tên đầy đủ.

---

## 10. Admin (AdminUsers + SlaConfigAdmin)

**Hiện trạng:** 2 công cụ xếp dọc 1 `<section gap:24>` — SLA nằm dưới fold, khó thấy; SLA number input 9 dòng inline-style (`:76`); ma trận vai không zebra/hover/sticky header; feedback là `<p>` trần (lệch `.toast` có sẵn `modal.css:168`).

**Thiết kế lại — console có rail trái + bảng khung:**
- **Sidebar admin** 180px (`Vai người dùng · Ngưỡng SLA` + chỗ cho console tương lai: Danh mục, Audit log — audit mục K) hoặc tab theo topbar; active tô `--accent-soft`.
- **AdminUsers:** toolbar trong `.atbl` (search tên/email + đếm "N người dùng"); `<th colspan>` "Vai" nhóm các cột role tách khỏi cột định danh; zebra + row hover; `accent-color:--accent` cho checkbox; sticky `thead`.
- **SlaConfig:** input số thành `.field.num` (bỏ inline); nhóm hàng theo Luồng với subhead tô `--rail-*`; giữ cap 520px trong `.atbl`.
- **Feedback thống nhất:** `.toast` cho success ("Đã cập nhật…"), `role=alert .err` cho lỗi ("Số ngày không hợp lệ").

**Ngóc ngách:** empty/loading `.empty-note`/skeleton; SLA lưu `onBlur` **im lặng** → flash ô `--accent-soft` 600ms khi lưu, `--sla-bg` khi revert; Tab order xuống nhóm luồng rồi sang nhóm kế.

---

## 11. LocalAdminLogin (break-glass)

**Hiện trạng:** form trần sau `.or` — 3 control xếp + `<h3>` 12px nhỏ, không khung; chỉ placeholder (mất khi gõ); không show-password/caps-lock; `.err` đỏ trần không gắn field.

**Thiết kế lại:**
- Bọc `LocalAdminLogin` trong khung `.fset` "Chỉ dành cho SA nội bộ" (uppercase `--ink-3` + glyph khoá) → đánh dấu đây là đường **ngoại lệ**, không ngang SSO.
- **Label thật** trên mỗi input (Email/Mật khẩu); giữ placeholder làm ví dụ.
- **Show/hide password** (icon phải) + gợi ý caps-lock qua `getModifierState`.
- Nút giữ đúng thứ bậc (SSO accent, local muted `panel-3`); `aria-busy`.
- Lỗi → `aria-invalid` cả 2 input + shake 1 lần (reduced-motion an toàn), `aria-describedby`.

**Ngóc ngách:** autofocus email; disable cả input khi busy (giờ chỉ nút); `input:hover{border-color:--ink-3}`; verify notch legend của `.fset` dùng nền `.login-card` để border-notch đúng cả 2 theme.

---

## Thứ tự đề xuất thi công

1. **Primitive trước** (§0): `.fset`, `.boardnote`, `StatusChip`, tabular audit, `.skel`, focus rings. Chi phí thấp, chạm mọi page.
2. **TicketDetail (§1)** — điểm đau đã có mockup, làm ngay.
3. **Form family (§6→§7→§8)** — tách `TicketFields` + `StationModal` một lần, hết trùng + hết divergence.
4. **Lists (§4→§5)** + **StationBoard/LineMap (§2→§3)** — cần đụng nhẹ server cho một số cột (overdueDays vào `/tickets/mine`, owned/label/terminal vào `/dispatch-map` — xem audit §5–7, §J).
5. **Shell/nav (§9) + Admin console (§10) + Login (§11).**

> TDD như quy ước: mỗi component tách để lại test (component/e2e). File ≤300 dòng — `TicketFields`/`StationModal`/`StatusChip` tách ra giúp các file to (CreateTicketForm, 3 modal) tụt xuống dưới mốc.
