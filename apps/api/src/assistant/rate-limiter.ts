import { Injectable } from '@nestjs/common'

/** Giới hạn theo NGƯỜI DÙNG, đếm theo SỐ TOOL chạy trong 60s trượt (spec §7).
 *  In-memory là đủ cho on-prem một tiến trình; đổi sang store nếu chạy nhiều node. */
@Injectable()
export class AssistantRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit = Number(process.env.ASSISTANT_RATE_PER_MIN ?? 20),
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Cho phép chạy thêm `cost` tool? Ghi nhận nếu cho phép; từ chối trọn gói nếu vượt. */
  allow(sub: string, cost: number): boolean {
    if (cost <= 0) return true
    const t = this.now()
    const recent = (this.hits.get(sub) ?? []).filter((x) => x > t - 60_000)
    if (recent.length + cost > this.limit) {
      this.hits.set(sub, recent)
      return false
    }
    for (let i = 0; i < cost; i++) recent.push(t)
    this.hits.set(sub, recent)
    return true
  }
}
