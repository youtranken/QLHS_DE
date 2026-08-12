import { Injectable } from '@nestjs/common'
import { FLOW, type Flow } from '@qlhs/contracts'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'

/** Thứ tự tuyến A→B→C — khớp header mline-map và picker gộp theo luồng. */
const FLOW_ORDER: readonly Flow[] = [FLOW.General, FLOW.Contract, FLOW.Payment]

export interface AdminDocType {
  id: string
  value: string
  active: boolean
  /** Số hồ sơ đang tham chiếu loại này — 0 mới cho xoá hẳn, >0 thì chỉ ẩn được. */
  usedBy: number
}
export interface AdminDocTypeGroup {
  flow: string
  types: AdminDocType[]
}

/** Document type cho màn Admin quản lý: gồm CẢ loại đã ẩn + số hồ sơ đang dùng, gộp
 *  theo luồng. Khác GetDocumentTypesUseCase (chỉ active, cho form tạo hồ sơ). */
@Injectable()
export class GetAdminDocTypesUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(): Promise<AdminDocTypeGroup[]> {
    const [rows, usage] = await Promise.all([this.options.listDocTypes(), this.options.docTypeUsage()])
    return FLOW_ORDER.map((flow) => ({
      flow,
      types: rows
        .filter((r) => r.flow === flow)
        .map((r) => ({ id: r.id, value: r.value, active: r.active, usedBy: usage[r.value] ?? 0 })),
    })).filter((g) => g.types.length > 0)
  }
}
