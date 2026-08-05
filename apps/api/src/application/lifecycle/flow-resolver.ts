import { BadRequestException, Injectable } from '@nestjs/common'
import type { DocumentType, Flow } from '@qlhs/contracts'
import { mapFlow } from '../../domain/ticket/document-flow'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'

/** Suy luồng từ document type — nguồn CHÍNH là catalog (6 loại seed + loại admin
 *  thêm), fallback mapFlow cho built-in (an toàn nếu catalog trống), loại không
 *  xác định được luồng bị từ chối (catalog + built-in là chân lý về loại hợp lệ).
 *
 *  Dùng CHUNG cho MỌI đường ghi flow (tạo mới / tạo-từ-có-sẵn / sửa field) — trước
 *  đây mỗi đường tự gọi mapFlow trần, trả undefined với loại admin thêm → hoặc
 *  desync flow khi sửa, hoặc 500 khi clone. Một nguồn duy nhất để không tái phạm. */
@Injectable()
export class FlowResolver {
  constructor(private readonly options: OptionRepo) {}

  async resolve(documentType: string): Promise<Flow> {
    const fromCatalog = await this.options.flowForDocType(documentType)
    if (fromCatalog) return fromCatalog as Flow
    const builtin = mapFlow(documentType as DocumentType) as Flow | undefined
    if (builtin) return builtin
    throw new BadRequestException({ code: 'InvalidDocumentType', message: 'Loại hồ sơ không hợp lệ' })
  }
}
