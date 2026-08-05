---
title: "QLHS — Business Overview, Main Flow & Data Flow"
project: Project_QLHS
created: 2026-07-07
sources:
  - _bmad-output/specs/spec-qlhs/SPEC.md
  - _bmad-output/planning-artifacts/architecture/architecture-Project_QLHS-2026-07-07/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-Project_QLHS-2026-07-07/prd.md
---

# QLHS — Business Overview, Main Flow & Data Flow

Tài liệu tổng quan hệ thống quản lý hồ sơ QLHS: **vì sao làm**, **kết quả kỳ vọng**, **luồng chính**, **luồng dữ liệu**, kèm sơ đồ **ER** và **sequence**. Thuật ngữ kỹ thuật và tên trạng thái giữ tiếng Anh (canonical).

---

## 1. Business Overview

Hồ sơ nội bộ (hợp đồng, thanh toán, ngân sách…) đi qua nhiều vai — **Applicant → DCC1 → DCC2/DCC3 → Andy/ACC/BOP** — nhưng không ai nhìn thấy hồ sơ đang ở đâu, chờ ai, bao lâu. Applicant nộp xong là mù thông tin; bị trả về không rõ lý do; việc giao–nhận không để lại dấu vết tra cứu được.

QLHS biến mỗi hồ sơ thành một **ticket minh bạch, tự vận hành**. Nguyên tắc thiết kế số 1: **"Minh bạch thay cho luật cứng"** — hệ thống không ép quy trình bằng quy định, mà làm mọi thứ hiển thị rõ (timeline hiện trạng, dấu "đã xem", badge quá hạn, lý do return bắt buộc). Sự hiển thị tạo áp lực xử lý — không cần cảnh sát quy trình.

### Vai trò

| Vai | Trong/ngoài hệ thống | Việc chính |
|---|---|---|
| **Applicant** | Trong | Mọi nhân viên; tạo/gửi ticket, theo dõi, sửa khi bị return; chỉ thấy hồ sơ của mình |
| **DCC1** | Trong | Nhận từ Pool, sinh mã, trình Andy, phân luồng; đầu mối Return/Reopen |
| **DCC2** | Trong | Luồng Contract/Budget: làm việc bản cứng với ACC/BOP, hoàn tất Hardcopy |
| **DCC3** | Trong | Luồng Payment: gửi ACC, đóng ticket |
| **Andy / ACC / BOP** | **Ngoài** | Duyệt/ký/kiểm trên bản cứng ngoài hệ thống; DCC cập nhật kết quả hộ |

### Ba luồng nghiệp vụ

- **Luồng A — General:** DCC1 xử suốt tuyến; Andy duyệt (có thể kèm BOP) → Completed.
- **Luồng B — Contract / VO / Annex / Budget:** DCC2 ↔ ACC → DCC1 trình BOP → DCC2 Hardcopy → Completed.
- **Luồng C — Payment:** DCC3 gửi ACC = Completed ngay (không BOP, không email Applicant).

---

## 2. Business Outcome

### Đau → Giải → Kết quả đo được

| Đau hiện tại | QLHS giải bằng | Outcome đo được |
|---|---|---|
| Applicant mù thông tin, phải đi hỏi | Timeline "bản đồ ga tàu" + trạng thái realtime | **100% hồ sơ tra được vị trí realtime** |
| Giao–nhận không dấu vết | Audit log **bất biến** mọi cú chuyển | **100% cú giao–nhận có log đầy đủ** |
| Hồ sơ "kẹt im lặng" | Badge đỏ SLA theo từng chặng + nhắc email | Hồ sơ quá hạn **hiện đỏ tự động**, không escalate thủ công |
| Bị return không rõ lý do | Lý do return **bắt buộc** trên timeline + email | Applicant tự sửa, không cần hỏi ai |
| Trạng thái hệ thống lệch thực tế giấy | Bàn giao bản cứng **2 pha** (bên nhận xác nhận) | Trạng thái **khớp thực tế vật lý** |

### Giá trị theo stakeholder

- **Applicant:** tự biết hồ sơ ở đâu mọi lúc; sửa nhanh khi bị trả về; nộp gấp có nhãn ưu tiên.
- **DCC:** hộp việc rõ ràng theo tab-trạng-thái; không nhận trùng (khóa mềm); đầu mối Return/Reopen tập trung.
- **Tổ chức:** dấu vết kiểm toán đầy đủ; nền dữ liệu timestamp cho dashboard điểm nghẽn (giai đoạn 2).

### Counter-metric (chống tối ưu lệch)

Thời gian trung bình mỗi hồ sơ **không được tăng** so với quy trình giấy hiện tại.

### Ngoài phạm vi GĐ1

Tài khoản + nút duyệt trong hệ thống cho Andy/ACC/BOP; dashboard analytics; realtime push (dùng polling); đổi luồng tại chỗ.

> **Known-limitation (đã chốt):** audit ghi kết quả Andy/ACC/BOP do DCC nhập — chứng minh *DCC đã ghi gì, lúc nào*, không xác thực chữ ký gốc. Minh bạch đảm bảo trong phạm vi vòng DCC.

---

## 3. Main Flow

Giai đoạn đầu chung cho cả 3 luồng, sau đó rẽ theo Document type.

```mermaid
flowchart TD
  START([Applicant nộp hồ sơ]) --> SUB[Submitted · Pool]
  SUB --> PICK[DCC1 bốc Pool + khóa mềm]
  PICK --> CHK{Document type đúng?}
  CHK -- Sai --> RET[Return về Applicant]
  RET --> SUB
  CHK -- Đúng --> CODE[Sinh mã atomic + phân luồng]
  CODE --> ANDY[Submitted to VP Andy]
  ANDY -- Andy từ chối --> RET
  ANDY -- Andy duyệt --> BR{Luồng?}

  BR -- A General --> G{Cần BOP?}
  G -- Không --> DONE1[Completed]
  G -- Có --> GBOP[Submitted to BOP] --> DONE1

  BR -- B Contract/Budget --> C1[Submitted to DCC2]
  C1 --> C2[DCC2 nhận bản cứng · Received by DCC2]
  C2 --> C3[Document No + gửi ACC · Submitted to Accounting]
  C3 --> C4[DCC1 nhận về từ ACC · Received from ACC]
  C4 -- ACC return --> RET
  C4 -- ACC approved --> C5[Submitted to BOP]
  C5 -- BOP từ chối --> RET
  C5 -- BOP approved --> C6[Submitted to DCC2 Hardcopy]
  C6 --> C7[DCC2 nhận bản cứng · Hardcopy + path scan]
  C7 --> DONE2[Completed · email Applicant]

  BR -- C Payment --> P1[Submitted to DCC3]
  P1 --> P2[DCC3 nhận bản cứng · Received by DCC3]
  P2 --> P3[Document No + gửi ACC]
  P3 --> DONE3[Completed ngay · KHÔNG email]
  DONE3 -. ACC trả bản cứng sai .-> REO[DCC1 Reopen] --> RET

  DONE1 --> END([Kết thúc])
  DONE2 --> END
  DONE3 --> END
```

**Bất biến của luồng:** trình Andy 1 lần & BOP ≤1 lần **trong một vòng**; return đếm-vòng mở round mới chạy lại cửa. Mã hồ sơ sinh một lần, giữ nguyên qua mọi vòng. Mỗi điểm bàn giao bản cứng cần bên nhận **xác nhận đã cầm giấy** mới tiến bước.

---

## 4. Data Flow

### 4.1 Tổng quan luồng dữ liệu (hệ thống)

```mermaid
flowchart LR
  subgraph Users[Người dùng]
    AP[Applicant]
    DCC[DCC1 / DCC2 / DCC3]
  end
  subgraph OnPrem[On-prem · Docker Compose]
    WEB[Web SPA · React/nginx]
    API[API · NestJS BFF]
    DB[(PostgreSQL)]
  end
  subgraph Ext[Dịch vụ ngoài]
    PMH[PMH ID · OIDC SSO / Directory]
    SMTP[SMTP nội bộ]
  end
  OFF[["Andy / ACC / BOP<br/>(ngoài hệ thống — bản cứng)"]]

  AP -->|HTTPS| WEB
  DCC -->|HTTPS| WEB
  WEB -->|JSON + cookie phiên| API
  API -->|Prisma| DB
  API <-->|OIDC verify offline · Directory sync| PMH
  API -->|email outbox| SMTP
  WEB -.->|redirect login| PMH
  DCC -. bàn giao giấy vật lý .-> OFF
  OFF -. DCC cập nhật kết quả hộ .-> DCC
```

**Nguyên tắc dữ liệu:**
- Mọi đổi trạng thái đi qua **một** `transition()` trong **một DB transaction**: ghi `status` + `current_holder_sub` + **đúng một `ticket_event`** (audit) + (nếu cần) **outbox** thông báo.
- **Audit append-only** (GRANT chỉ INSERT+SELECT) — dấu vết không sửa/xóa.
- **SLA/dwell là giá trị dẫn xuất** lúc đọc (không lưu cờ); ngưỡng cấu hình được.
- **Danh tính** = PMH ID `sub` (không dùng email); vai suy từ claim `groups`.
- **Thông báo** = hàm của sự kiện đã commit, phát post-commit exactly-once (Payment Completed **không** email).

### 4.2 Vòng đời dữ liệu một ticket

```mermaid
flowchart LR
  A[Applicant nhập<br/>9 trường + ưu tiên] --> B[(ticket<br/>Submitted, code=NULL)]
  B --> C[DCC1 sinh mã<br/>number_counter]
  C --> D[(ticket.code<br/>immutable)]
  D --> E[Mỗi chuyển bước<br/>transition]
  E --> F[(ticket_event<br/>append-only)]
  E --> G[(ticket.status<br/>+ current_holder_sub)]
  E --> H[(notification_outbox)]
  H --> I[Dispatcher post-commit] --> J[SMTP email]
  G --> K[Đọc: overdue/dwell dẫn xuất<br/>+ sla_config]
  K --> L[Badge đỏ SLA · timeline]
```

---

## 5. ER Diagram

```mermaid
erDiagram
  USER ||--o{ TICKET : "nộp (applicant_sub)"
  USER ||--o{ USER_GROUP : "thuộc"
  GROUP ||--o{ USER_GROUP : "gồm"
  GROUP ||--o| GROUP_ROLE_MAP : "map sang vai"
  TICKET ||--o{ TICKET_EVENT : "audit append-only"
  TICKET ||--o| TICKET_LOCK : "khóa mềm"
  TICKET ||--o{ TICKET_VIEW : "đã xem / người"
  TICKET ||--o{ NOTIFICATION_OUTBOX : "ý-định thông báo"
  NUMBER_COUNTER ||..|| TICKET : "cấp mã (prefix,year)"
  SLA_CONFIG ||..o{ TICKET : "ngưỡng theo status"

  USER {
    string sub PK "PMH ID id nội bộ (ổn định)"
    string employee_code
    string email "hiển thị, KHÔNG làm khóa"
    string full_name
    string status
    datetime synced_at
  }
  GROUP {
    string name PK "tên group PMH ID"
  }
  USER_GROUP {
    string user_sub FK
    string group_name FK
  }
  GROUP_ROLE_MAP {
    string group_name PK
    string role "Applicant|DCC1|DCC2|DCC3"
  }
  TICKET {
    uuid id PK
    string code UK "G-YYYY-NNNN / CT-YYYY-NNNN · null tới khi mint"
    string applicant_sub FK
    string document_type
    string flow "A|B|C"
    string status "canonical EN"
    string priority "normal|rush|urgent"
    int round_no
    string current_holder_sub
    string description
    string payment_term
    string contract_no
    string project_team
    string currency
    bigint amount "đơn vị nhỏ nhất"
    string budget_code
    string contractor
    string document_no "26-CC-..-CT · UNIQUE (DCC nhập)"
    string scan_path "điền ở Hardcopy (Contract)"
    datetime created_at
  }
  TICKET_EVENT {
    uuid id PK
    uuid ticket_id FK
    string actor_sub
    string action
    string from_status
    string to_status
    string reason
    int round_no
    datetime occurred_at
    json meta
  }
  TICKET_LOCK {
    uuid ticket_id PK
    string holder_sub
    datetime acquired_at
    datetime expires_at "+5 phút"
  }
  TICKET_VIEW {
    uuid ticket_id FK
    string viewer_sub
    datetime last_viewed_at
  }
  NUMBER_COUNTER {
    string prefix_year PK "vd G-2026 / CT-2026"
    int next_seq
  }
  SLA_CONFIG {
    string status PK
    int threshold_days "admin sửa được"
  }
  NOTIFICATION_OUTBOX {
    uuid id PK
    uuid ticket_id FK
    string kind "Completed|Return|Reminder"
    datetime created_at
    datetime sent_at "null tới khi phát"
  }
```

---

## 6. Sequence — Data Flow

### 6.1 Đăng nhập qua PMH ID (OIDC / BFF)

```mermaid
sequenceDiagram
  actor U as Nhân viên
  participant W as Web SPA
  participant A as API (BFF)
  participant P as PMH ID (OIDC)

  U->>W: Mở app
  W->>A: GET /me
  A-->>W: 401 (chưa có phiên)
  W->>A: GET /auth/login
  A->>P: Redirect Authorization Code (Discovery URL)
  U->>P: Đăng nhập (trang PMH ID)
  P-->>A: /auth/callback?code=...
  A->>P: Đổi code lấy token (client_secret)
  P-->>A: access + refresh (JWT RS256)
  A->>A: Verify offline JWKS (kid, iss, aud)
  A->>A: Map groups→role; tạo phiên cookie httpOnly
  A-->>W: Set-Cookie; vào app
  Note over A,P: refresh token GIỮ ở API · access ~5' · idle 15' · PMH ID sập vẫn dùng tiếp tới khi hết hạn
```

### 6.2 Applicant tạo hồ sơ → DCC1 xử General → Completed (walking skeleton)

```mermaid
sequenceDiagram
  actor AP as Applicant
  actor D1 as DCC1
  participant W as Web SPA
  participant API as API
  participant T as Domain transition()
  participant DB as PostgreSQL

  AP->>W: Nhập 9 trường + nhãn ưu tiên
  W->>API: POST /tickets
  API->>DB: INSERT ticket (Submitted, code=NULL)
  API-->>AP: Hiện ở hộp việc + timeline vẽ sẵn tuyến

  D1->>API: Bốc Pool
  API->>DB: UPDATE ... WHERE status='Submitted' AND NOT EXISTS(lock)
  Note over API,DB: Atomic pickup + tạo ticket_lock (TTL 5')

  D1->>API: Xác nhận Document type + luồng
  API->>T: transition(confirm)
  activate T
  T->>DB: BEGIN · FOR UPDATE
  T->>DB: sinh mã (number_counter) · status=Submitted to VP Andy
  T->>DB: INSERT ticket_event
  T->>DB: COMMIT
  deactivate T

  D1->>API: Andy duyệt (General, không BOP)
  API->>T: transition(approve)
  activate T
  T->>DB: BEGIN · status=Completed · INSERT ticket_event · INSERT outbox(email)
  T->>DB: COMMIT
  deactivate T
  Note over T,DB: MỘT transaction: status + audit + outbox intent
  API-->>AP: Badge SLA/dwell tính dẫn xuất lúc đọc
```

### 6.3 Luồng Contract — bàn giao 2 pha, ACC, BOP, Hardcopy

```mermaid
sequenceDiagram
  actor D1 as DCC1
  actor D2 as DCC2
  participant API as API
  participant T as transition()
  participant DB as PostgreSQL
  participant OUT as Outbox→SMTP

  Note over D1,D2: (sau khi Andy duyệt)
  D1->>API: Chuyển cho DCC2 →
  API->>T: transition → Submitted to DCC2
  D2->>API: "Đã nhận bản cứng" (nhập ngày)
  API->>T: transition → Received by DCC2
  Note over D2: Nếu thiếu giấy → cờ đối chiếu, giữ ở tab DCC1

  D2->>API: Document No (UNIQUE) + gửi ACC
  API->>T: transition → Submitted to Accounting
  Note over D1: Ticket hiện ở tab "Chờ ACC" của DCC1 (một status, 2 tab)

  D1->>API: "Nhận về từ ACC" (cầm bản cứng)
  API->>T: transition → Received from ACC
  alt ACC approved
    D1->>API: Trình BOP →
    API->>T: transition → Submitted to BOP
    D1->>API: BOP approved → chuyển về DCC2
    API->>T: transition → Submitted to DCC2 (Hardcopy)
    D2->>API: "Đã nhận bản cứng"
    API->>T: transition → Hardcopy
    D2->>API: Nhập path scan + hoàn tất
    API->>T: transition → Completed
    T->>DB: status + ticket_event + outbox
    OUT-->>D1: (post-commit) email Applicant
  else ACC return / BOP từ chối
    D1->>API: Return (kèm lý do bắt buộc)
    API->>T: sendBack → Return (đếm vòng, trao lại bản cứng)
    T->>DB: status + ticket_event + outbox(email Return)
  end
```

### 6.4 Nội bộ `transition()` — bất biến ghi atomic

```mermaid
sequenceDiagram
  participant APP as Application use-case
  participant T as transition()
  participant SM as state-machine (data)
  participant DB as PostgreSQL

  APP->>T: transition(ticketId, event, actor, payload)
  T->>DB: BEGIN
  T->>DB: SELECT ticket FOR UPDATE
  T->>SM: hợp lệ? (from, event, actorRole)
  alt Không hợp lệ
    SM-->>T: reject
    T->>DB: ROLLBACK
    T-->>APP: DomainError (không đổi gì)
  else Hợp lệ
    SM-->>T: to-status + ownerRole + slaKey
    T->>DB: UPDATE status + current_holder_sub + timestamps
    T->>DB: INSERT ticket_event (append-only, 1 writer)
    opt Có thông báo
      T->>DB: INSERT notification_outbox
    end
    T->>DB: COMMIT
    T-->>APP: OK
  end
```

---

## Tham chiếu

- Hợp đồng kiến trúc (20 AD): `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`
- SPEC (12 capability): `_bmad-output/specs/spec-qlhs/SPEC.md`
- Yêu cầu chi tiết (FR/NFR, state machine, SLA): `_bmad-output/planning-artifacts/prds/.../prd.md`
- Epics & stories: `_bmad-output/planning-artifacts/epics.md`
