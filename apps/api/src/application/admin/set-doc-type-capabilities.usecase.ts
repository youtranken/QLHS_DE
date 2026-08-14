import { BadRequestException, Injectable } from '@nestjs/common'
import {
  OptionRepo,
  type DocTypeCapabilities,
  type OptionRow,
} from '../../infra/prisma/admin/option.repo'

/** Bật/tắt hai cờ khả năng (requiresContractNo · allowSkip) cho một document type
 *  LUỒNG CONTRACT — bảng ma trận ở Admin. Hai cờ ĐỘC LẬP, KHÔNG loại trừ nhau: một
 *  loại có thể cần Contract No, cho Skip, cả hai (vd Service Contract: nhập số rồi
 *  tick Skip → Completed kèm số), hoặc không cờ nào. Chỉ áp cho loại Contract (repo
 *  trả null nếu id không phải Contract → 400, không cho set nhầm General/Payment). */
@Injectable()
export class SetDocTypeCapabilitiesUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(id: string, patch: Partial<DocTypeCapabilities>): Promise<OptionRow> {
    // Client gửi cờ nào đổi cờ đó (undefined = giữ nguyên nhờ Prisma); hai cờ độc lập.
    const updated = await this.options.setDocTypeCapabilities(id, patch)
    if (!updated) {
      throw new BadRequestException({
        code: 'DocTypeNotContract',
        message: 'Chỉ đặt được cho loại hồ sơ luồng Contract',
      })
    }
    return updated
  }
}
