import { Injectable } from '@nestjs/common'
import { AnalyticsRepo } from '../../infra/prisma/admin/analytics.repo'
import { toCsv } from '../../domain/analytics/csv'

const HEADERS = [
  'Thời điểm',
  'Mã hồ sơ',
  'Luồng',
  'Hành động',
  'Từ trạng thái',
  'Sang trạng thái',
  'Người thực hiện',
  'Lý do',
] as const

/** Raw event-level export for a date window — the flexible base managers pivot in
 *  Excel. UTF-8 BOM (csv.ts) keeps Vietnamese readable. */
@Injectable()
export class ExportAnalyticsUseCase {
  constructor(private readonly analytics: AnalyticsRepo) {}

  async execute(from: Date, to: Date): Promise<string> {
    const rows = await this.analytics.exportRows(from, to)
    return toCsv(
      HEADERS,
      rows.map((r) => [
        r.occurredAt.toISOString(),
        r.code ?? '',
        r.flow,
        r.action,
        r.fromStatus,
        r.toStatus,
        r.actorSub,
        r.reason ?? '',
      ]),
    )
  }
}
