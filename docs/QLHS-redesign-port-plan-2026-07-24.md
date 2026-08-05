# Kế hoạch port Redesign v2 "Phòng điều độ ban đêm" → `apps/web`

> Nguồn chuẩn: `design-previews/` (16 trang HTML đã được user duyệt 2026-07-24) + `design-previews/_SPEC.md`.
> Nguyên tắc xuyên suốt: port **đúng 99%** so với mock; lát cắt nhỏ có verify; KHÔNG đụng state machine / contracts / audit (AD-2, AD-4); status tiếng Anh canonical giữ nguyên (AD-13 — chỉ đổi nhãn tiếng Việt trình bày); file ≤300 dòng, một component/file; test xanh mới sang lát kế.

---

## LOẠI 1 — Port giao diện thuần (KHÔNG cần BMAD, không đổi backend)

Mỗi lát: sửa → `pnpm --filter @qlhs/web test` + typecheck → mở `https://qlhs.pmh.com.vn:5173` bằng Playwright chụp đối chiếu mock → mới sang lát kế. Test bị đổi label/flow thì **sửa test trong cùng lát** (đó là spec sống, không phải nợ).

### Lát 1 — Fonts + tokens (nền của mọi thứ)
- `apps/web/public/fonts/`: XÓA `BeVietnamPro-*.woff2`; copy từ `design-previews/fonts/`: `Inter-*.woff2`, `ChakraPetch-*.woff2` (giữ JetBrainsMono cũ).
- `apps/web/src/design/fonts.css`: viết lại @font-face theo `design-previews/fonts.css` (đổi path `fonts/` → `/fonts/`).
- `apps/web/src/design/tokens.css`: giữ TÊN token cũ, cập nhật giá trị + THÊM token mới từ SPEC §3: `--display`, `--bg-2`, `--hairline`, `--accent-2`, `--done-soft`, `--grad-contract/payment/general`, `--glow-accent/sla`, `--elev-1/2`, `--grid-dot`, `--r-s/m/l`; body đổi `--sans` = Inter, nền dot-grid.
- DoD: app chạy, chữ Việt render Inter/Chakra Petch, không còn tham chiếu Be Vietnam Pro (`grep -r "Be Vietnam"` = 0).

### Lát 2 — Shell: topbar + login + màn trạng thái
- `shell.css` + `App.tsx`: topbar command-bar theo mock (brand Chakra Petch + icon tàu, roles pill glow, đồng hồ mono, theme toggle, cụm me). Login theo `00-login.html` (hero metro art trái + card phải). `rolewarn` → màn 403 theo `14-states.html` (+ 404/500/offline/bảo trì nếu routing chạm tới).
- Đổi h1/label: "Bảng điều độ" → "Bảng Hồ sơ" (App.tsx, các feature, test).
- DoD: login + topbar + 403 giống mock 2 theme; test label xanh.

### Lát 3 — Metro v3 (LineMap) — lát NẶNG nhất, signature
- `features/dispatch/LineMap.tsx` tách thành: `LineMap.tsx` (compose) + `MetroLine.tsx` (rail + stations) + `StationNode.tsx` + `StationDrawer.tsx` + `StationPopover.tsx` + hook `useStationData.ts` (giữ API `getDispatchMap/getStationTickets` hiện có — KHÔNG đổi endpoint).
- Port từ `04`: mapinner (ambient + hairline), youband "GA CỦA BẠN" theo vai đang active, thứ tự tuyến **A → B → C**, rail ống 3D + sheen, **fill = tiến độ**: gradient trải toàn tuyến ngả `--done`, `--p` = vị trí ga xa nhất có hồ sơ (TÍNH TỪ DỮ LIỆU dispatch map, không hardcode), train chạy tới `--p`; node đếm-trong-viên-bi, **viền dày theo count** (1→3px/32 · 2-3→4px/36 · ≥4→5px/40 · 0→dim), flag ▲ ga quá hạn, phụ đề ga (chậm nhất Xn — lấy từ dwell max của ga), legend.
- Hover/focus ga → popover preview (≤3 hồ sơ + n nữa); click → drawer (4 stat + slameter + list + CTA). Esc/scroll đóng; focus trả về node.
- DoD: DCC1 thấy 3 tuyến, DCC2/DCC3 thấy 1 tuyến đúng vai (mock 05/06); reduced-motion tắt sạch animation; test LineMap cập nhật.

### Lát 4 — StationBoard (kanban) + confirm popup
- `features/board/`: BoardCardView port hiệu ứng thẻ (border-left luồng, hover pop scale 1.045 + glow, tilt 3D theo chuột — tách hook `useCardTilt.ts`, guard hover:hover + reduced-motion), stagger vào bảng, `.dots` sáng khi hover thẻ.
- Toolbar: search + fchip Tất cả/KHẨN/GẤP/▲QuáSLA — **lọc thật** (hiện mock chỉ đổi class); toastslot cố định.
- **ConfirmModal component mới** (`shared/ConfirmModal.tsx`) thay `window.confirm`/`window.prompt` trong `StationBoard.tsx:90-106`: Trả lại/Báo thiếu = bắt lý do (disable nút khi rỗng), hành động bất khả hồi = nêu hệ quả; giữ nguyên use-case/API gọi xuống.
- Port style 3 modal có sẵn (Handover/SendAccounting/CompleteContract) theo mock 05/06/07.
- DoD: mọi hành động chạy qua confirm mới, Undo 5s giữ nguyên; board test xanh.

### Lát 5 — Applicant: MyTickets + modal Tạo hồ sơ + TicketDetail
- `MyTickets.tsx` theo `01`: KPI 3 ô, segmented filter, bảng nhóm vòng đời (grouphd), unseen dot, cột Cập nhật, expand hàng = mini-metro (dùng lại MetroLine thu gọn), retbox.
- **CreateTicketForm → modal** (quyết định user): nút "+ Tạo hồ sơ mới" mở `CreateTicketModal.tsx` (3 fset, chip luồng sống theo DOCUMENT_TYPE_GROUPS, format tiền + đọc số, priority card, giữ giá trị khi đóng/mở). Route/trang tạo riêng (nếu có) bỏ.
- `TicketDetail.tsx` theo `03`/`07`: header mã + chip + lockpill, metro route, 4 stat-tile + slameter, 4 khung fset (④ DCC editable theo vai), nhật ký bảng 4 cột, actionbar workbox sticky (vai DCC).
- DoD: e2e tạo→nộp→trả→sửa-nộp-lại vẫn xanh (sửa selector theo modal); đối chiếu mock 2 theme.

### Lát 6 — ClosedTickets + Admin restyle (phần ĐÃ có backend)
- `ClosedTickets.tsx` theo `08`: searchpanel 2 nhóm có label, date-range nối, chip luồng luôn hiện, modal Mở lại (lý do bắt buộc), 3 demo state.
- Admin shell theo mock: nav rail 6 item (item "Tổng quan" tạm dẫn tới trang overview UI-only dữ liệu mock/ẩn sau flag — xem Loại 2), khối user cuối rail; restyle `AdminUsers` (09) + `SlaConfigAdmin` (10 — stepper, footer sticky đếm thay đổi). CSS admin đã tách sẵn theo màn (`admin-*.css`) — giữ cấu trúc đó.
- DoD: admin test + API 276 test không đỏ; đối chiếu mock.

### Lát 7 — Quét chốt
- Sweep overflow 390/768 mọi màn thật (recipe iframe của _SPEC), 2 theme, keyboard path (menu ⋯, modal, drawer), reduced-motion.
- `/code-review` + cập nhật `docs/QLHS-flow-walkthrough.md` ảnh chụp nếu có.
- Trap đã biết (từ vòng mock — tránh dẫm lại): `.overlay[hidden]` bị display đè; fonts.css đổi thì bust cache; mini-metro cần padding-bottom ~30px; label wrap ở cột trái map (158px+).

---

## LOẠI 2 — Tính năng MỚI (backend chưa có → đi đường BMAD story)

> UI đã có sẵn trong mock (port ở Lát 6 dạng dữ liệu mock/feature-flag). Mỗi mục dưới = 1 story `bmad-create-story`, TDD chặt (domain thuần → use-case → http → web). KHÔNG code trước khi có story + test đỏ. Epics cũ đã đóng → cần cập nhật `_bmad-output/planning-artifacts/epics.md` (epic mới "Admin console mở rộng"?) + sprint-status.

### Story N1 — Admin Overview API (`15-admin-overview.html`)
- Use-case `GetAdminOverviewUseCase`: đếm user/chưa-gán-vai (UserRoleRepo), hồ sơ đang chạy + quá SLA theo tuyến (TicketRepo + overdue()), sự kiện audit hôm nay (SELECT-only trên ticket_event), % đúng hạn 30 ngày/tuyến.
- Controller `GET /api/admin/overview` (Roles Admin). "Việc cần làm" derive từ chính các số trên (không bảng mới). "Hệ thống": version/uptime từ env + health.
- Web: thay mock bằng API; giữ nguyên layout đã port.

### Story N2 — Audit log viewer (`12-admin-audit.html`)
- `GET /api/admin/audit?ticket=&actor=&event=&from=&to=&page=` — SELECT-only trên ticket_event (tôn trọng GRANT INSERT+SELECT, một writer duy nhất là transition() — AD-4; endpoint tuyệt đối read-only), phân trang, sidebar thống kê hôm nay.
- Chú ý: event name trả về đúng contracts `event.ts`; from→to theo ngày làm việc hiển thị.

### Story N3 — Danh mục Payment Term / Project Team (`11-admin-options.html`)
- Bảng mới `option_item(kind, label, sort_order, active)` + migration; use-case list/create/rename/toggle (KHÔNG delete — hồ sơ cũ giữ giá trị, đúng copy mock).
- `GET/POST/PATCH /api/admin/options/:kind`; form tạo hồ sơ đọc từ API này thay hằng số hiện tại (đụng `CreateTicketModal` — làm SAU lát 5).
- Ràng buộc: tắt giá trị chỉ ẩn khỏi form tạo mới; validate không trùng label.

### Story N4 — Bổ nhiệm qua SSO (`13-admin-appoint.html`)
- Use-case `SearchDirectoryUseCase` (DirectoryClient PMH ID có sẵn trong infra auth — xem [[pmh-id-sso]]) + `AppointUserUseCase`: upsert user theo **sub** (AD-7, không email) + gán vai trước lần đăng nhập đầu.
- `GET /api/admin/directory?query=` + `POST /api/admin/appoint`. Cảnh báo gán Admin giữ như mock. Audit việc bổ nhiệm (ghi qua đường nào? — KHÔNG ghi ticket_event; cân nhắc bảng `admin_event` riêng → hỏi user trước khi thêm bảng).

### Thứ tự đề xuất & phụ thuộc
N1 (chỉ đọc, nhanh, làm Overview sống ngay) → N2 (chỉ đọc) → N3 (có migration + đụng form tạo) → N4 (đụng identity, rủi ro cao nhất, cần bàn `admin_event`).

### Điểm phải hỏi user trước khi code Loại 2
1. N3: giá trị Danh mục hiện hardcode ở đâu (contracts hay web)? — quyết định chỗ đặt nguồn chuẩn.
2. N4: có cần audit riêng cho hành động quản trị không (bảng mới) hay ghi log app là đủ?
3. Overview "% đúng hạn 30 ngày": định nghĩa chính xác (đóng trong hạn / không từng quá hạn?) — chốt công thức trước khi viết test domain.
