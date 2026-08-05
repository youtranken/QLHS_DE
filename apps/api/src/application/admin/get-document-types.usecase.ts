import { Injectable } from '@nestjs/common'
import { FLOW, type Flow } from '@qlhs/contracts'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'

/** Thứ tự tuyến A→B→C cho picker gộp theo luồng (khớp header mline-map). */
const FLOW_ORDER: readonly Flow[] = [FLOW.General, FLOW.Contract, FLOW.Payment]

export interface DocTypeGroup {
  flow: string
  types: string[]
}

/** Document type đang hoạt động, gộp theo luồng — cho form tạo hồ sơ + Danh mục. */
@Injectable()
export class GetDocumentTypesUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(): Promise<DocTypeGroup[]> {
    const rows = await this.options.listActiveDocTypes()
    return FLOW_ORDER.map((flow) => ({
      flow,
      types: rows.filter((r) => r.flow === flow).map((r) => r.value),
    })).filter((g) => g.types.length > 0)
  }
}
