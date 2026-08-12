import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { OptionRepo, DOC_TYPE_KIND } from '../../infra/prisma/admin/option.repo'

/** Xoá HẲN một document type — chỉ khi CHƯA hồ sơ nào tham chiếu (usedBy=0), tức
 *  loại lỡ thêm nhầm. Loại đang dùng phải ẩn (SetDocTypeActiveUseCase), không xoá:
 *  hồ sơ cũ lưu text nên xoá loại đang dùng sẽ mồ côi dữ liệu + hỏng suy luồng. */
@Injectable()
export class DeleteDocTypeUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(id: string): Promise<{ ok: true }> {
    const existing = await this.options.findById(id)
    if (!existing || existing.kind !== DOC_TYPE_KIND) {
      throw new NotFoundException({ code: 'DocTypeNotFound', message: 'Không tìm thấy loại hồ sơ' })
    }
    // Check-then-delete không nguyên tử: một hồ sơ tạo xen giữa count và delete có
    // thể lọt (usedBy đọc 0 rồi mới có ticket). Vô hại — ticket.documentType là text
    // không FK, flow đã lưu sẵn trên ticket; hệ quả chỉ là bookkeeping usedBy lệch,
    // không đóng được bằng transaction đơn vì không có ràng buộc DB để khoá.
    const used = await this.options.usageCount(DOC_TYPE_KIND, existing.value)
    if (used > 0) {
      throw new ConflictException({
        code: 'DocTypeInUse',
        message: `Đang có ${used} hồ sơ dùng loại này — chỉ ẩn được, không xoá.`,
      })
    }
    await this.options.deleteById(id)
    return { ok: true }
  }
}
