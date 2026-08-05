import { Injectable } from '@nestjs/common'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'

export interface OptionView {
  id: string
  value: string
  sortOrder: number
  active: boolean
  usedBy: number
}

/** Admin list for one kind: every value (active + hidden) with how many tickets
 *  already reference it — the "Đang dùng bởi" column that justifies never deleting. */
@Injectable()
export class ListOptionsUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(kind: string): Promise<OptionView[]> {
    const rows = await this.options.list(kind)
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        value: r.value,
        sortOrder: r.sortOrder,
        active: r.active,
        usedBy: await this.options.usageCount(kind, r.value),
      })),
    )
  }
}
