import { Injectable, NotFoundException } from '@nestjs/common'
import { OptionRepo, DOC_TYPE_KIND, type OptionRow } from '../../infra/prisma/admin/option.repo'

/** Ẩn / bật lại một document type (mềm, hoàn tác được). Ẩn = biến khỏi form tạo hồ
 *  sơ; hồ sơ cũ giữ nguyên text + luồng đã lưu, không suy lại. Không đụng loại khác. */
@Injectable()
export class SetDocTypeActiveUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(id: string, active: boolean): Promise<OptionRow> {
    const existing = await this.options.findById(id)
    if (!existing || existing.kind !== DOC_TYPE_KIND) {
      throw new NotFoundException({ code: 'DocTypeNotFound', message: 'Không tìm thấy loại hồ sơ' })
    }
    return this.options.update(id, { active })
  }
}
