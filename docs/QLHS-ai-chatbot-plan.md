# QLHS Trợ lý nội bộ — Kế hoạch kỹ thuật (v2.0, không-LLM)

> Trợ lý hỏi–đáp cho QLHS chạy **hoàn toàn nội bộ, KHÔNG LLM, KHÔNG cloud, KHÔNG GPU**.
> Một **intent engine tất định** hiểu câu hỏi (khớp mẫu + bóc slot) → gọi **read-tool** (bọc
> mỏng quanh use-case đọc sẵn có) → backend lấy dữ liệu đúng quyền → **template** diễn đạt.
> **Read-only tuyệt đối** — không bao giờ ghi/action vào hệ thống từ trợ lý.
>
> Trạng thái: *đề xuất — chờ duyệt trước khi code.* Ngày: 2026-07-31.
> **v2.0** thay hẳn hướng Gemini tool-calling (v1.1) sau khi chốt: on-prem không GPU → bỏ LLM.
> **v2.1** fold review chuyên gia đối chiếu use-case thật: sửa `whats_next`/`get_analytics`/`closed_lookup`, thêm `get_paused_tickets` + workbox DCC2/3, `activeRole` thay `roles[]`, và tầng **hỏi-nhiều-ý** (§4.1).
> **Code review (bmad, 2026-07-31):** 3 lớp đối kháng — KHÔNG có rò rỉ cross-user/oracle. Đã vá: bỏ chip "đang trễ" (không lọc được), chặn `markViewed` cho `whats_next` (giữ read-only), rate-limit per-user theo số tool (`rate-limiter.ts`), cap số dòng render, sửa cap-đếm-tool ở service (không rớt tool sau `unknown`), bỏ dấu-tách không-dấu (con/va/voi), key React ổn định. 7 mục nhỏ hoãn → `_bmad-output/implementation-artifacts/deferred-work.md`.

---

## 0. Quyết định đã chốt với chủ dự án (2026-07-31)

- **KHÔNG LLM.** Máy chủ on-prem không có GPU → LLM open-weight trên CPU quá chậm + tool-calling kém tin cậy. Bỏ hẳn.
- **KHÔNG cloud.** Không gửi dữ liệu ra Gemini/Vertex hay bất kỳ LLM cloud nào → toàn bộ governance egress (redact/ẩn danh/valueBand/ADC) **biến mất**.
- **READ-ONLY tuyệt đối.** Trợ lý chỉ quét-đọc qua tool để trả lời; **không có** hành động ghi (không Pha 3).
- **Nhập kiểu hybrid:** ô gõ tự do + vài **chip gợi ý** bấm chọn sẵn.

**Không phải ngõ cụt:** lớp tool + RBAC giống hệt dù front-end là luật hay LLM. Có GPU sau này = gắn thêm router LLM *trước* lớp tool y nguyên, không đập đi làm lại.

---

## 1. Mục tiêu & phạm vi

**Trong phạm vi:**
- Hỏi–đáp tiếng Việt về **dữ liệu hồ sơ đúng quyền của người hỏi** (Applicant, DCC1/2/3, Admin/BOP).
- 12 read-tool, tự động scope theo `activeRole`. Một câu hỏi có thể gồm nhiều ý (≤4 tool, §4.1).
- Panel trợ lý trong web app: ô gõ tự do + chip gợi ý; trả lời dạng **thẻ/bảng có cấu trúc**.

**NGOÀI phạm vi (cố ý):** mọi hành động *ghi*; hiểu ngữ nghĩa/tổ hợp tự do (chỉ khớp mẫu); ghi nhớ dài hạn xuyên phiên; RAG tài liệu (có thể là pha sau, tra `docs/*.md` bằng full-text, vẫn không-LLM).

---

## 2. Bất biến bắt buộc (vi phạm = hỏng hệ thống)

1. **Phân quyền ở backend.** Tool chạy qua use-case với danh tính lấy từ session. Intent engine **không** chọn "xem dữ liệu của ai".
2. **Không chạm DB trực tiếp.** Trợ lý chỉ *chọn tool*; tool gọi use-case sẵn có. Không sinh SQL/Prisma mới.
3. **Read-only.** Không tool nào gọi use-case ghi; không đụng `transition()`.
4. **Không bịa.** Hết dữ liệu → nói "không tìm thấy". Không hiểu → gợi ý chip. Không phịa mã/số/tên — mọi số liệu đến thẳng từ tool.
5. **Intent engine thuần (kiểu domain).** `resolveIntent` không import framework/IO — chỉ `(text, roles) → intent`. Test dày ở đây.
6. **TDD.** intent + slots + tool + render test trước.
7. **File ≤300 dòng, một-trách-nhiệm-một-file.**
8. **Tên status tiếng Anh canonical** (AD-13) trong logic; nhãn VN chỉ ở lớp render.

*Ghi chú riêng tư dữ liệu:* trợ lý chỉ hiện đúng thứ UI thường **đã** hiện cho **chính người đó** (cùng use-case, cùng RBAC). Không có bề mặt rò rỉ mới → **không cần redact như khi gửi ra cloud**. Vẫn nên gọn payload (không nhồi field thừa) như vệ sinh thường.

---

## 3. Kiến trúc & layout file

**MỘT thư mục tự chứa** `apps/api/src/assistant/` (không rải vào `application/`/`http/` —
chỉ *import* use-case đọc + đăng ký module vào `app.module.ts`):
```
apps/api/src/assistant/                 # ← toàn bộ backend chatbot ở đây
  intent/
    types.ts               # TOOL, Intent, Chip, Filters (một nguồn sự thật)
    slots.ts               # fold bỏ dấu + hasPhrase; bóc mã HS (text gốc)/flow/status/cờ lọc
    intents.ts             # từ khoá NEXT/NOTIF/MYTICKETS + hasAny
    resolve-intent.ts      # THUẦN: 1 mệnh đề → {tool,args} | {clarify} | {unknown}
    resolve-intents.ts     # THUẦN: tách nhiều ý (§4.1) → Intent[]
    suggestions.ts         # chip gợi ý (default + clarify)
  assistant-tool.ts        # interface AssistantTool + Caller{sub,roles,activeRole}
  tools/                   # get-my-tickets · get-ticket-detail · whats-next · get-my-notifications
  tool-registry.ts         # gom tool + forActiveRole(activeRole)
  render/
    answer.ts              # kiểu Block/AnswerPayload
    render.ts              # Intent(tool)+output → Block[] (lọc hậu-kỳ TicketView)
  assistant.service.ts     # điều phối: resolveIntents → runTool(RBAC) → render (1 ý lỗi ≠ hỏng cả câu)
  assistant.controller.ts  # POST /api/assistant/ask (JSON thường, KHÔNG SSE) — ASSISTANT_ENABLED
  assistant.dto.ts
  assistant.module.ts      # imports TicketModule + NotificationsModule (tái dùng use-case)

apps/web/src/features/assistant/        # ← toàn bộ frontend chatbot ở đây
  api.ts · useAssistant.ts · SuggestionChips.tsx · AnswerCard.tsx · AssistantPanel.tsx · assistant.css
```

**Luồng một request (đơn giản, không có vòng lặp agentic):**
```
POST /api/assistant/ask { text }
  → AssistantController (CurrentUser từ guard)
  → AssistantService.ask(caller, text):        // caller = { sub, roles[], activeRole }
        intents = resolveIntents(text, caller.activeRole, caller.roles)   // 1..N (§4.1)
        for (const it of intents.slice(0, MAX_INTENTS=4)):
          it.unknown|clarify → block = renderClarify(it)
          it.tool            → tool = registry.forActiveRole(caller.activeRole).find(name)
                               try   → block = render(it, await tool.run(args, caller))
                               catch → block = renderError(it, e)   // 1 clause hỏng KHÔNG làm hỏng cả câu
        answer.blocks = [...các block theo đúng thứ tự]
  → JSON { answer: AnswerPayload, suggestions?: Chip[] }
```
Không SSE, không history-token-management, không adapter LLM. Rate-limit đếm theo **số tool chạy** (N-intent × req), không theo số HTTP request.

---

## 4. Intent engine (trái tim, thay LLM) — THUẦN, test dày

```ts
export type Intent =
  | { kind: 'tool'; tool: string; args: Record<string, unknown> }
  | { kind: 'clarify'; reason: string; suggestions: Chip[] }   // mơ hồ → hỏi lại bằng chip
  | { kind: 'unknown'; suggestions: Chip[] }                   // không khớp → gợi ý

export function resolveIntent(text: string, activeRole: Role, roles: Role[]): Intent
```
> **`activeRole` chứ không phải cả `roles[]`.** App scope dữ liệu theo **một active role** đã chọn trong session (`resolveActiveRole` + `RolesGuard` chỉ *đọc* `activeRole`), không tự "chọn effective role". Trợ lý phải khớp đúng hành vi đó — user có cả DCC2 lẫn Applicant mà đang ở vai Applicant thì trợ lý trả lời theo Applicant. **Ngoại lệ duy nhất:** `get_my_notifications` cần cả `roles[]` (hộp thư theo vai).

**Cách khớp (theo thứ tự, tất định):**
1. **Chuẩn hoá** text: lowercase, bỏ dấu tuỳ chọn để so khớp từ khoá (giữ bản gốc cho slot).
2. **Bóc slot** (`slots.ts`) trước, độc lập với intent:
   - mã HS: `/\b(g|ct)-\d{4}-\d{4}\b/i` chạy trên **text gốc** (không fold dấu) ⇒ có mã ⇒ ưu tiên `get_ticket_detail`/`whats_next`. (seq cố định 4 chữ số — đủ dùng.)
   - flow: `{general|tổng hợp}→General, {contract|hợp đồng|hđ}→Contract, {payment|thanh toán|chi trả}→Payment`. **Bỏ từ khoá "chung"** — bẫy "nói chung / thông tin chung".
   - status/ga: khớp 17 tên EN + nhãn VN đồng nghĩa.
   - bộ lọc: `{trễ|quá hạn|overdue}→sla=overdue`, `{gấp|ưu tiên|urgent}→priority`, `{chưa đọc|unseen}` — là **field lọc trên kết quả**, KHÔNG phải tool riêng.
   - ngày: `{hôm nay, hôm qua, tuần này, tháng này, từ…đến…}` → dateFrom/dateTo.
3. **Khớp intent** (`intents.ts`): mỗi intent = tập từ khoá bắt buộc/tuỳ chọn + vai được phép + hàm dựng args từ slot. Chấm điểm khớp; cao nhất & vượt ngưỡng ⇒ `tool`; nhiều intent sát điểm ⇒ `clarify`; dưới ngưỡng ⇒ `unknown`.
4. **Lọc theo vai (`activeRole`):** intent mà `activeRole` không được phép ⇒ loại khỏi ứng viên (Applicant hỏi "phân tích/analytics" ⇒ unknown + chip hợp vai, **không lộ tồn tại tool admin**).

**Không đoán ngoài mẫu.** Câu tổ hợp lạ → `unknown` + chip. Đây là giới hạn đã chấp nhận (§0), không phải bug.

### 4.1. Hỏi nhiều ý một lúc (deterministic, không LLM)

`resolveIntent` trả **một** ý; người dùng hay hỏi 2–4 ý ("cho tôi hồ sơ của tôi, thông báo chưa đọc, **và** hồ sơ nào sắp trễ"). `resolveIntents` tách rồi giải từng mệnh đề:

```ts
export function resolveIntents(text: string, activeRole: Role, roles: Role[]): Intent[]  // 1..4
```

1. **Tách CÓ PHÒNG VỆ.** Chỉ tách chắc trên `;`, xuống dòng, `?`, và **`còn`** (từ chuyển-chủ-đề: "…, còn hồ sơ nào trễ"). `và` / `với` / `,` là **yếu** — chỉ tách khi **cả hai vế đều tự giải ra `tool`**. Đây là lá chắn cho bẫy **"hồ sơ trễ và gấp"** = *hai bộ lọc trên MỘT truy vấn*, cả `trễ` lẫn `gấp` đều không phải tool ⇒ **không tách**.
2. **Giải từng mệnh đề** bằng `resolveIntent`.
3. **Gộp lại** mảnh chỉ-có-filter vào tool intent gần nhất (dấu phẩy trong một truy vấn không bị hiểu nhầm thành ý mới).
4. **Khử trùng** `{tool,args}` giống nhau (hỏi lặp → trả một lần).
5. Trần **N=4** mệnh đề; quá → một `clarify`. Tất cả `unknown` → gộp một `unknown` + chip.

**Giữ thứ tự nguồn** khi render block. **Một mệnh đề lỗi** (VD `TicketNotFoundError`) → block đó `empty`/lỗi mềm, **không** làm hỏng cả câu. Mệnh đề thuộc vai khác → block `unknown`+chip, các block còn lại vẫn hiện.

**Giới hạn thành thật:** chỉ ghép được các ý *đã biết*. Câu thực sự tổ hợp ("so sánh hồ sơ trễ của DCC2 với tháng trước") vẫn `unknown` + chip — nhất quán ranh giới §0. Phần mong manh nhất là **bộ tách** ⇒ test dày ở đây.

---

## 5. Tool + registry (mang nguyên từ thiết kế cũ, đã đối chiếu code thật)

```ts
export interface AssistantTool {
  name: string
  activeRoles: Role[]                 // activeRole nào được THẤY/gọi tool này
  run(args: unknown, caller: { sub: string; roles: Role[]; activeRole: Role }): Promise<unknown>
}
```
Mỗi `.run()`: validate args (zod) → gọi use-case với **`activeRole`** (khớp cách app scope; đừng tự tính effective role) → trả về. **code→id đã có sẵn:** `ticket-detail.usecase` nhận cả UUID lẫn code (`findByIdOrCode`) và tự chặn cross-user (ném `TicketNotFoundError`) — không cần resolve thủ công.

| Tool | Slot/arg | Use-case | activeRole |
|---|---|---|---|
| `get_my_tickets` | `active?` | `lifecycle/list-my-tickets(sub)` — gồm cả hồ sơ đã đóng | tất cả |
| `get_ticket_detail` | `code` | `core/ticket-detail(code, {activeRole,sub})` | tất cả* |
| `closed_lookup` | `code?,contractor?,contractNo?,applicant?,dateFrom?,dateTo?` | `closed/search-closed-tickets(activeRole, filters)` — scope theo `roleFlows` | **DCC1/2/3, Admin** (Applicant → dùng `get_my_tickets`) |
| `get_my_notifications` | `unreadOnly?` | `notify/list-notifications(sub, roles[])` — **tool duy nhất dùng `roles[]`** | tất cả |
| `whats_next` | `code` | **`core/ticket-detail` → đọc field `actions`** (KHÔNG dùng `legal-actions` trần) | tất cả* |
| `get_my_workbox` | `includePool?` | DCC1 → `board/list-workbox()` (+`list-pool`); **DCC2/DCC3 → `dispatch/station-board(activeRole, sub)`** | DCC1/2/3 |
| `get_dispatch_map` | `flow?` | `dispatch/dispatch-map(activeRole)` | DCC1/2/3, Admin, BOP |
| `get_station_tickets` | `status,flow?` | `dispatch/station-board — StationTicketsUseCase(status, activeRole, flow?)` | DCC1/2/3, Admin, BOP |
| `get_paused_tickets` | — | `sla/list-sla-pauses()` — "hồ sơ đang chờ bổ sung / tạm dừng SLA" | Admin, BOP |
| `get_overview` | — | `admin/get-admin-overview()` | Admin, BOP |
| `get_analytics` | `period` (→ `Granularity`) | `admin/get-analytics(granularity)` — **một arg**; render chọn khối để hiện | Admin, BOP |
| `search_audit` | `actor?,ticket?,event?,dateFrom?,dateTo?` | `admin/search-audit(filters, page, pageSize)` | Admin, BOP |

\* `get_ticket_detail`/`whats_next`: đều đi qua `ticket-detail` → tự chặn nếu không có quyền (ném `TicketNotFoundError` cho cả "không tồn tại" lẫn "không có quyền" → **không lộ tồn tại, không oracle**). **KHÔNG** wrap `legal-actions.usecase` trực tiếp: nó dùng `findById` (chỉ UUID) + **không guard sở hữu/flow** → oracle trạng thái.

**Tool per data-source, KHÔNG per câu hỏi:** "trễ SLA / gấp / theo nhà thầu" là *field lọc*, không phải tool. Enum từ `@qlhs/contracts`.

*Tuỳ chọn (nice-to-have, Admin):* `get_sla_config` (`admin/get-sla-config` — "SLA bước X mấy ngày"), `who_has_role` (`admin/search-directory` — "ai đang là DCC2"). Chưa cần Pha 1.

---

## 6. Render (thay diễn đạt LLM bằng template có cấu trúc)

`AnswerPayload = { title, summary?, blocks: Block[] }`; `Block` = `table | detailCard | statGrid | text | empty`.
- **List/search/workbox/station** → `table` các `TicketRow` (mã, flow, status, ga, người-giữ theo **vai**, SLA badge, tuổi hồ sơ) + dòng tóm tắt ("3 hồ sơ, 1 trễ hạn").
- **detail** → `detailCard` (mã, flow, status, SLA) + timeline rút gọn theo **vai** (không đổ tên tự do vào chat; muốn xem đầy đủ → link mở trang chi tiết thật).
- **overview/analytics** → `statGrid` số tổng hợp.
- **rỗng** → `empty` "Không tìm thấy hồ sơ nào khớp."
- Web dựng lại bằng component sẵn có (SLA badge, bảng) → nhất quán UI, không dựng lại từ đầu.

Nhãn VN ở lớp render (tái dùng i18n zero-dep sẵn có). Logic vẫn dùng status EN canonical.

---

## 7. HTTP + FE

- `POST /api/assistant/ask` — body `{ text }`; guard PMH-ID/local; `@GetCurrentUser()`. Trả `{ answer, suggestions? }`.
- **Rate-limit** theo user, **đếm theo số tool chạy** (không theo HTTP request — một câu N=4 ý = tối đa 4 lần gọi use-case) — chống lạm dụng + enumeration mã HS.
- `ASSISTANT_ENABLED=0` → controller off, FE ẩn panel.
- FE: `AssistantPanel` = ô gõ + `SuggestionChips` (khởi tạo theo vai). Gõ Enter → gọi API → render `AnswerCard`. Không hiểu → hiện chip "Ý bạn là…?". Lịch sử hội thoại chỉ ở client cho UX (không load-bearing).

---

## 8. Cấu hình (`.env`)

```
ASSISTANT_ENABLED=1
ASSISTANT_RATE_PER_MIN=20
```
Không secret, không endpoint ngoài, không GPU. Chạy trong chính api hiện có.

---

## 9. Test plan (TDD)

| Lớp | Test | Loại |
|---|---|---|
| `slots` | mã HS regex (G/CT, biên); flow/status đồng nghĩa; cụm ngày → range; không nhầm số khác thành mã | unit thuần |
| `resolve-intent` | mỗi intent khớp đúng; đồng nghĩa; slot→args; mơ hồ → `clarify`; dưới ngưỡng → `unknown`; **lọc theo `activeRole`** (Applicant hỏi analytics → unknown, không lộ tool admin) | unit thuần (nhiều) |
| `resolve-intents` (§4.1) | tách đúng "A, B và C" → 3 ý; **KHÔNG tách "trễ và gấp"** (2 filter/1 truy vấn); gộp mảnh filter; khử trùng; trần N=4; tất cả unknown → gộp 1 | unit thuần (nhiều) |
| `suggestions` | chip đúng theo vai + đúng ngữ cảnh clarify | unit |
| mỗi `*.tool.ts` | delegate đúng use-case; effective role; read-only (không gọi use-case ghi); args sai → lỗi mềm | unit (mock use-case) |
| `tool-registry` | `forRoles` lọc đúng | unit |
| `render/*` | list/detail/overview/empty ra `AnswerPayload` đúng; status EN→nhãn VN | unit |
| `assistant.service` | intent→tool→render nối đúng; unknown/clarify không gọi tool | unit |
| `assistant.controller` (e2e) | Applicant KHÔNG chạm `get_analytics`; **user A KHÔNG đọc detail/`whats_next` hồ sơ user B** (RBAC âm cross-user, không oracle); nhiều-ý: 1 mệnh đề lỗi → block lỗi mềm, các block khác vẫn hiện; `ASSISTANT_ENABLED=0` → off; rate-limit theo tool | e2e (Postgres thật) |
| web `useAssistant`/`AssistantPanel` | gọi API, render thẻ, hiện chip, trạng thái loading/empty | component |

Không cần eval LLM/LLM-judge (không có mô hình sinh) — mọi hành vi tất định, phủ bằng test thường.

---

## 10. Lộ trình theo pha

- **Pha 1 — Nền đọc tất định (MVP): ✅ ĐÃ LÀM (2026-07-31).** `slots` + `resolve-intent` + `resolve-intents` (nhiều-ý §4.1) + `intents` → 4 tool Nhóm 1 (`get_my_tickets`, `get_ticket_detail`, `whats_next` **qua ticket-detail**, `get_my_notifications`) → `render` list/detail/actions/notifications → `assistant.service` (caller có `activeRole`, 1 ý lỗi ≠ hỏng cả câu) → controller (`ASSISTANT_ENABLED`) + RBAC e2e (cross-user âm + không oracle). FE panel nổi + chip + gõ tự do. **DoD đạt:** api unit 373 (gồm 35 assistant) + assistant e2e 5 + web 176 (gồm 3) xanh; typecheck + lint:boundaries sạch; mọi file ≤106 dòng. Gói gọn trong `assistant/` (BE) + `features/assistant/` (FE).
- **Pha 2 — Đủ tool + hoàn thiện chip: ✅ ĐÃ LÀM (2026-07-31).** 8 tool còn lại (`closed_lookup`, `get_my_workbox` [DCC1→list-workbox, DCC2/3→station-board], `get_dispatch_map`, `get_station_tickets`, `get_paused_tickets`, `get_overview`, `get_analytics`, `search_audit`). **Role-gating thật:** bảng `TOOL_ROLES` (nguồn sự thật chung intent-gating + tool.activeRoles); intent engine đổi sang bảng `RULES` có thứ tự — khớp-nhưng-sai-vai thì bỏ qua (không lộ tool ngoài quyền). Render thêm block `stats` (dispatch/overview/analytics) + `lines` (paused/audit); `ticketList` thêm `overdueDays`. Chip gợi ý theo vai (Applicant/DCC/Admin). Use-case admin lấy từ AuthModule, dispatch/closed/workbox từ TicketModule (thêm exports). **DoD đạt:** api unit 394 (56 assistant) + assistant e2e 8 (gồm Applicant-chặn-analytics, Admin-overview, DCC-workbox) + web 177 xanh; typecheck + lint sạch; file lớn nhất 191 dòng. (Tuỳ chọn còn lại: `get_sla_config`, `who_has_role`, slot ngày cho closed/audit.)
- **Pha 3 (tuỳ chọn) — Tra tài liệu không-LLM:** `lookup_process_doc` full-text search `docs/*.md` (luồng A/B/C, SLA) → trả đoạn khớp. Vẫn không LLM.
- **Pha 4 (tương lai, nếu có GPU) — Bọc LLM:** thêm `ChatModelPort` + router LLM *trước* lớp tool y nguyên; intent tất định thành fallback. Lớp tool/RBAC/render không đổi.

---

## 11. Rủi ro & quyết định

| Vấn đề | Xử lý |
|---|---|
| Không GPU / không cloud | ✅ Không-LLM tất định — chạy trong api hiện có, độ trễ ~0 |
| Rò rỉ dữ liệu | ✅ Không egress; chỉ hiện thứ UI đã hiện cho chính người đó; cùng RBAC use-case |
| Hiểu câu tổ hợp lạ | Chấp nhận: khớp mẫu, không ngữ nghĩa → `unknown` + chip; mở rộng mẫu dần |
| Enumeration mã HS | use-case ném `TicketNotFoundError` (không phân biệt "không có" vs "cấm") + rate-limit |
| Bịa số/mã | Triệt tận gốc: số liệu đến thẳng từ tool, template không tự sinh |
| Đổi sang LLM sau này | Chỉ gắn router trước lớp tool; không đập lại (Pha 4) |

---

## 12. Phụ thuộc thêm

- `zod` (đã có) cho validate args tool.
- **KHÔNG** `@google/genai`, LangChain, LlamaIndex, hay bất kỳ SDK LLM/cloud nào.
