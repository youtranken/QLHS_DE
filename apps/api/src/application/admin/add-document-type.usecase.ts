import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { FLOW, type Flow } from '@qlhs/contracts'
import { DOC_TYPE_KIND, OptionRepo } from '../../infra/prisma/admin/option.repo'

const FLOWS: readonly string[] = Object.values(FLOW)

/** THÊM một document type mới (kèm luồng). Không sửa/xoá — hồ sơ cũ giữ nguyên. */
@Injectable()
export class AddDocumentTypeUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(valueRaw: string, flow: string): Promise<{ value: string; flow: Flow }> {
    const value = valueRaw.trim()
    if (!value) {
      throw new BadRequestException({ code: 'EmptyValue', message: 'Tên loại không được để trống' })
    }
    if (!FLOWS.includes(flow)) {
      throw new BadRequestException({ code: 'InvalidFlow', message: 'Luồng không hợp lệ' })
    }
    if (await this.options.findByValue(DOC_TYPE_KIND, value)) {
      throw new ConflictException({ code: 'DuplicateValue', message: 'Loại hồ sơ này đã tồn tại' })
    }
    const row = await this.options.createDocType(value, flow)
    return { value: row.value, flow: row.flow as Flow }
  }
}
