import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { OptionRepo, type OptionRow } from '../../infra/prisma/admin/option.repo'

const empty = () => new BadRequestException({ code: 'InvalidOption', message: 'Giá trị không được rỗng' })
const dup = () => new ConflictException({ code: 'DuplicateOption', message: 'Giá trị đã tồn tại' })

/** Add a new dropdown value. Rejects blank + duplicate (within the kind); order is
 *  appended after the current max so new values land at the bottom. */
@Injectable()
export class CreateOptionUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(kind: string, valueRaw: string): Promise<OptionRow> {
    const value = valueRaw.trim()
    if (!value) throw empty()
    if (await this.options.findByValue(kind, value)) throw dup()
    return this.options.create(kind, value)
  }
}

/** Rename or (de)activate a value. Never deletes (old tickets keep the string) —
 *  toggling `active:false` only hides it from new create forms. */
@Injectable()
export class UpdateOptionUseCase {
  constructor(private readonly options: OptionRepo) {}

  async execute(id: string, patch: { value?: string; active?: boolean }): Promise<OptionRow> {
    const existing = await this.options.findById(id)
    if (!existing) throw new NotFoundException({ code: 'OptionNotFound', message: 'Không tìm thấy giá trị' })

    const data: { value?: string; active?: boolean } = {}
    if (patch.active !== undefined) data.active = patch.active
    if (patch.value !== undefined) {
      const value = patch.value.trim()
      if (!value) throw empty()
      if (value !== existing.value && (await this.options.findByValue(existing.kind, value))) throw dup()
      data.value = value
    }
    return this.options.update(id, data)
  }
}
