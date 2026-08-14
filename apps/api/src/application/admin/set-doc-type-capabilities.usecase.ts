import { BadRequestException, Injectable } from '@nestjs/common'
import {
  OptionRepo,
  type DocTypeCapabilities,
  type OptionRow,
} from '../../infra/prisma/admin/option.repo'

/** Bật/tắt hai cờ khả năng (requiresContractNo · allowSkip) cho một document type
 *  LUỒNG CONTRACT — bảng ma trận ở Admin. Hai cờ độc lập; chỉ áp cho loại Contract
 *  (repo trả null nếu id không phải Contract → 400, không cho set nhầm General/Payment). */
@Injectable()
export class SetDocTypeCapabilitiesUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(id: string, patch: Partial<DocTypeCapabilities>): Promise<OptionRow> {
    // Hai cờ LOẠI TRỪ NHAU: một loại Contract chỉ được là "cần Contract No" HOẶC
    // "cho Skip" HOẶC không cờ nào — không bao giờ cả hai. Bật một cờ tự tắt cờ kia
    // (kiểu radio), ép ở server để client trực tiếp gọi API cũng không phá được.
    const effective: Partial<DocTypeCapabilities> = { ...patch }
    if (patch.requiresContractNo === true) effective.allowSkip = false
    else if (patch.allowSkip === true) effective.requiresContractNo = false

    const updated = await this.options.setDocTypeCapabilities(id, effective)
    if (!updated) {
      throw new BadRequestException({
        code: 'DocTypeNotContract',
        message: 'Chỉ đặt được cho loại hồ sơ luồng Contract',
      })
    }
    return updated
  }
}
