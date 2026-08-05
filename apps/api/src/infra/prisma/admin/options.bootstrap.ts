import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OptionRepo } from './option.repo'

/** Sensible starting values so the create-ticket dropdowns are never empty on a
 *  fresh DB. Admins add/rename/hide from here. Seeded per-kind only when empty
 *  (idempotent) — also the recovery path after e2e wipes the shared dev DB. */
const DEFAULTS: Record<string, string[]> = {
  paymentTerm: [
    'Tạm ứng 30% - còn lại theo tiến độ',
    'Thanh toán theo tiến độ nghiệm thu',
    'Thanh toán 1 lần sau nghiệm thu',
    'Thanh toán đợt cuối (giữ lại 5% bảo hành)',
  ],
  projectTeam: [
    'KĐT Nam Sài Gòn',
    'Hạ tầng kỹ thuật',
    'Cấp thoát nước',
    'Điện - Cơ điện',
    'Cảnh quan',
  ],
  currency: ['VND', 'USD', 'EURO', 'N/A'],
}

@Injectable()
export class OptionsBootstrap implements OnModuleInit {
  private readonly log = new Logger(OptionsBootstrap.name)

  constructor(private readonly options: OptionRepo) {}

  async onModuleInit(): Promise<void> {
    for (const [kind, values] of Object.entries(DEFAULTS)) {
      if ((await this.options.count(kind)) > 0) continue
      for (const value of values) await this.options.create(kind, value)
      this.log.log(`Seeded ${values.length} default ${kind} options`)
    }
  }
}
