# QLHS — Observability (3.2)

Vận hành on-prem: một endpoint Prometheus + một cảnh báo outbox tồn đọng. Không thêm bảng, số liệu derive ở read (AD-6).

## `GET /metrics` — Prometheus scrape

Text exposition format (v0.0.4), **không cần đăng nhập** mặc định (chạy sau nginx allow-list trong mạng nội bộ). Đặt env `QLHS_METRICS_TOKEN=<token>` để bắt buộc `Authorization: Bearer <token>` khi scraper nằm ngoài host. Endpoint được **miễn throttler** nên scrape 15s không ăn quota của người dùng thật.

Gauge phát ra:

| Metric | Nhãn | Ý nghĩa |
|---|---|---|
| `qlhs_up` | — | Tiến trình API đang phục vụ (=1) |
| `qlhs_process_uptime_seconds` | — | Giây kể từ khi API khởi động |
| `qlhs_tickets` | `flow`, `status` | Số hồ sơ theo luồng×trạng thái (raw count, **không** phải SLA-derived) |
| `qlhs_sla_pauses_open` | — | Số đồng hồ SLA đang tạm dừng lúc này (F8) |
| `qlhs_mail_outbox` | `status` (`pending`/`failed`) | Chiều sâu hàng đợi email thông báo (AD-15) |
| `qlhs_digest_outbox` | `status` (`pending`/`failed`) | Chiều sâu hàng đợi digest sáng (F11) |

> Overdue/dwell **không** nằm ở đây (đắt vì cần pause-adjust + threshold) — chúng derive trên trang Admin Analytics (2.4).

### Ví dụ scrape config (prometheus.yml)

```yaml
scrape_configs:
  - job_name: qlhs-api
    metrics_path: /metrics
    scrape_interval: 30s
    static_configs:
      - targets: ['qlhs-api:3000']
    # nếu bật token:
    # authorization: { credentials: '<QLHS_METRICS_TOKEN>' }
```

### Alert rule gợi ý (Prometheus)

```yaml
groups:
  - name: qlhs-outbox
    rules:
      - alert: QlhsMailDropped
        expr: qlhs_mail_outbox{status="failed"} > 0 or qlhs_digest_outbox{status="failed"} > 0
        for: 0m
        labels: { severity: critical }
        annotations:
          summary: "QLHS đã bỏ rơi một email (hết cửa sổ backoff)"
      - alert: QlhsMailBacklog
        expr: qlhs_mail_outbox{status="pending"} >= 20
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "Hàng đợi email QLHS đang ùn (>=20 pending 15 phút)"
```

## Cảnh báo outbox tồn đọng — log có cấu trúc

`OpsHealthScheduler` chạy **mỗi giờ** (gate `QLHS_DISABLE_CRON=1` khi test), đọc chiều sâu hàng đợi và **chỉ ghi 1 dòng log/giờ khi vượt ngưỡng** — hết ngưỡng thì im lặng:

- `WARN` khi `pending >= QLHS_MAIL_BACKLOG_WARN` (mặc định 20) — đang ùn, drain chậm hơn nạp.
- `ERROR` khi có bất kỳ dòng `failed > 0` (một email đã **mất** sau khi cạn cửa sổ backoff) hoặc `pending >= QLHS_MAIL_BACKLOG_CRITICAL` (mặc định 100).

Dòng log là JSON để Loki/journald bắt được:

```json
{"event":"outbox_backlog","level":"critical","breached":["mailFailed"],"mailPending":0,"mailFailed":1,"digestPending":0,"digestFailed":0}
```

Đây là **tín hiệu vận hành**, cố ý **không** ghi vào chuông 🔔 (chuông để cho người + hồ sơ, log để cho operator). Chiều sâu `pending` đã hiện sẵn trên trang tổng quan Admin (`mailPending`).

### Env cấu hình

| Env | Mặc định | Tác dụng |
|---|---|---|
| `QLHS_METRICS_TOKEN` | (rỗng → mở) | Bearer token bắt buộc cho `/metrics` |
| `QLHS_MAIL_BACKLOG_WARN` | `20` | Ngưỡng `pending` → WARN |
| `QLHS_MAIL_BACKLOG_CRITICAL` | `100` | Ngưỡng `pending` → ERROR |
| `QLHS_DISABLE_CRON` | — | `=1` tắt scheduler (test/CI) |
