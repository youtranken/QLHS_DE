# Project_QLHS — Hệ thống quản lý hồ sơ (ticket nội bộ)

Web app theo dõi hồ sơ qua Applicant → DCC1 → DCC2/DCC3 → Andy/ACC/BOP; 3 luồng (General / Contract-Budget / Payment), state machine đóng, audit bất biến, SLA badge. On-prem.

**Stack:** Node 24 LTS · TypeScript 6 · NestJS 11 · React 19 + Vite 8 · Prisma 7 · PostgreSQL 18 · Docker Compose.

**HAI CHẾ ĐỘ — không bao giờ chạy song song** (chạy cả hai = 2 api ghi chung 1 DB + docker web chiếm `:5173` phục vụ bundle cũ → lỗi "sai mật khẩu" / "UI không cập nhật"):

- **Dev (code hằng ngày) — `ops/dev.sh`:** chỉ hạ tầng `docker compose up postgres mailpit` (Postgres host `:5492`, Mailpit SMTP `:11025`/UI `:18025`), API+Web chạy host bằng pnpm hot-reload: `pnpm --filter @qlhs/api start:dev` (`:3000`) + `pnpm --filter @qlhs/web dev` (HTTPS `:5173` qua cert `pmh.com.vn/`). `.env` là chân lý; thấy thay đổi source ngay. Cần hosts `127.0.0.1 qlhs.pmh.com.vn` + `id.pmh.com.vn`. Playwright MCP lái browser + screenshot. `pnpm test` cần Postgres up.
- **Prod-like / on-prem — `ops/deploy.sh`:** `docker compose build && up -d` (đủ stack). `:5173` do **docker web (nginx, bundle build sẵn)** phục vụ, proxy `/api` → docker api (host `:13000`). Image bất biến → **đổi code phải build lại** mới hiện ở `:5173`. Api tự chạy `prisma migrate deploy` khi khởi động (entrypoint) + có healthcheck; web chờ api `service_healthy`. Đổi mật khẩu/OIDC trong `.env` → `docker compose up -d api` để bootstrap lại (bootstrap chỉ chạy lúc boot).

**Hợp đồng chuẩn — đọc khi cần chi tiết, đừng đoán:**
- Tổng quan (business + dataflow + ER/sequence): `docs/QLHS-business-and-dataflow.md`
- PRD (FR/NFR, state machine §4, SLA §8.2): `_bmad-output/planning-artifacts/prds/prd-Project_QLHS-2026-07-07/prd.md`
- Architecture (20 AD): `_bmad-output/planning-artifacts/architecture/architecture-Project_QLHS-2026-07-07/ARCHITECTURE-SPINE.md`
- SPEC (12 CAP): `_bmad-output/specs/spec-qlhs/SPEC.md`
- Epics & stories: `_bmad-output/planning-artifacts/epics.md`
- Story file + sprint-status: `_bmad-output/implementation-artifacts/`
- **Luồng A/B/C từng bước gửi↔nhận + SLA từng ga (đọc-cho-người-mới):** `docs/QLHS-flow-walkthrough.md`
- **UX/UI (hướng "bản đồ tuyến điều độ" — Azure + Be Vietnam Pro/JetBrains Mono):**
  - Hệ thống thiết kế: `_bmad-output/planning-artifacts/ux-designs/ux-Project_QLHS-2026-07-07/DESIGN.md`
  - Trải nghiệm/tương tác: `.../ux-Project_QLHS-2026-07-07/EXPERIENCE.md`
  - Prototype tương tác chuẩn (mở thử): `.../ux-Project_QLHS-2026-07-07/mockups/MASTER-prototype.html`
  - *(bản navy-A cũ giữ ở `DESIGN-navyA-backup.md` / `EXPERIENCE-navyA-backup.md` — không dùng)*

## Quy ước code — BẮT BUỘC (áp cả khi chưa mở architecture)

- **File ngắn, dễ maintain:** một-trách-nhiệm-một-file; **≤300 dòng/file**. File chạm mốc **>400 dòng = TÁCH NGAY** trong chính lần code đó, không để nợ.
- `state-machine` tách **theo luồng** (`general.ts` / `contract.ts` / `payment.ts` / `shared.ts` + `index.ts` compose) — không một file ôm mọi cạnh.
- `transition()` giữ **MỎNG** (validate → apply → audit); logic từng event = handler/policy nhỏ trong registry — **KHÔNG `switch` khổng lồ**.
- **Một use-case = một file** ở `application/`; controller tách theo **vai** (`applicant` / `dcc1` / `dcc2` / `dcc3`), không một controller ôm hết.
- React: **một component/file**, hook tách riêng, tổ chức feature-folder.

## TDD — BẮT BUỘC (Red → Green → Refactor)

- **Test TRƯỚC, code SAU.** Không viết code sản xuất khi chưa có một test đang **đỏ** đòi hỏi nó. Chu trình từng hành vi nhỏ: 🔴 viết test fail → 🟢 code tối thiểu cho xanh → 🔵 refactor (test vẫn xanh).
- **`domain/**` test THUẦN, không DB/IO** (state-machine, `transition()` guard, `overdue()/dwell()`, `mapFlow`) — đây là nơi TDD chặt nhất, phủ mọi cạnh + guard vai×trạng thái + biên SLA.
- **Test pyramid khớp kiến trúc:** domain (unit thuần, nhiều & nhanh) → application (use-case + port giả) → http (integration, Postgres thật qua Docker) → web (component/e2e).
- **Cổng kiểm mỗi story (Definition of Done):** toàn bộ test **xanh** + lint + typecheck + quy ước granularity (file ≤300 dòng, `domain` không import framework). Không sang story kế khi còn đỏ.
- **Chạy test:** `pnpm test` (unit/domain) nhanh; integration/e2e chạy cuối story. Mỗi story để lại test là "spec sống" cho hành vi của nó.

## Bất biến dễ vi phạm (đầy đủ ở ARCHITECTURE-SPINE.md)

- Chỉ `transition()` được đổi `ticket.status` (AD-2). Audit `ticket_event` **append-only, một writer duy nhất** là `transition()` (AD-4) — GRANT chỉ INSERT+SELECT.
- `domain/**` **KHÔNG** import framework/IO (`@nestjs/*`, `@prisma/*`, `http/`, `infra/`) — mọi ra-ngoài qua port (AD-1).
- Tham chiếu user bằng PMH ID **`sub`**, KHÔNG dùng email (AD-7). **Không đính kèm file** trong hệ thống (bản cứng đi ngoài; chỉ path scan ở Hardcopy).
- Tên status dùng **tiếng Anh canonical** y hệt ở tab/chip/metro/log/actionbar (AD-13); chú thích tiếng Việt chỉ là trình bày.
## Comment tiết chế — giải thích WHY, không kể WHAT

- **Comment thưa.** Code tự nói được thì KHÔNG comment. Không kể lể từng dòng, không comment hiển nhiên (`// tăng i`, `// gọi API`).
- Comment chỉ xứng đáng khi code không tự nói được: **bất biến không hiển nhiên, lý do một lựa chọn lạ, tham chiếu AD-x/quyết định, cạm bẫy/race**. Ưu tiên MỘT dòng ngắn ở đầu khối, không rải khắp.
- Đặt tên rõ > comment. Nếu phải comment để hiểu một đoạn, cân nhắc tách hàm đặt tên thay vì thêm comment.
- Sửa code thì xóa comment đã lỗi thời; không để comment "nói dối".
