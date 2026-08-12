import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export const OPTION_KINDS = ['paymentTerm', 'projectTeam', 'currency'] as const
export type OptionKind = (typeof OPTION_KINDS)[number]

export function isOptionKind(k: string): k is OptionKind {
  return (OPTION_KINDS as readonly string[]).includes(k)
}

export interface OptionRow {
  id: string
  kind: string
  value: string
  flow: string | null
  sortOrder: number
  active: boolean
}

/** Document Type sống trong cùng bảng option_item nhưng mang thêm `flow` (luồng
 *  xử lý) — admin thêm mới kèm luồng; suy luồng khi tạo hồ sơ đọc từ đây. */
export const DOC_TYPE_KIND = 'documentType'

/** Admin-managed create-form dropdowns (N3). Values are deactivated, never
 *  deleted — old tickets keep their string. Sorted by (sortOrder, value). */
@Injectable()
export class OptionRepo {
  constructor(private readonly prisma: PrismaService) {}

  list(kind: string): Promise<OptionRow[]> {
    return this.prisma.optionItem.findMany({
      where: { kind },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    })
  }

  listActive(kind: string): Promise<OptionRow[]> {
    return this.prisma.optionItem.findMany({
      where: { kind, active: true },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    })
  }

  findByValue(kind: string, value: string): Promise<OptionRow | null> {
    return this.prisma.optionItem.findUnique({ where: { kind_value: { kind, value } } })
  }

  findById(id: string): Promise<OptionRow | null> {
    return this.prisma.optionItem.findUnique({ where: { id } })
  }

  async create(kind: string, value: string): Promise<OptionRow> {
    const max = await this.prisma.optionItem.aggregate({ where: { kind }, _max: { sortOrder: true } })
    return this.prisma.optionItem.create({
      data: { kind, value, sortOrder: (max._max.sortOrder ?? 0) + 1, active: true },
    })
  }

  update(id: string, patch: { value?: string; active?: boolean }): Promise<OptionRow> {
    return this.prisma.optionItem.update({ where: { id }, data: patch })
  }

  /** "Đang dùng bởi": tickets whose field equals this value (by kind). */
  usageCount(kind: string, value: string): Promise<number> {
    if (kind === DOC_TYPE_KIND) return this.prisma.ticket.count({ where: { documentType: value } })
    if (kind === 'projectTeam') return this.prisma.ticket.count({ where: { projectTeam: value } })
    if (kind === 'currency') return this.prisma.ticket.count({ where: { currency: value } })
    return this.prisma.ticket.count({ where: { paymentTerm: value } })
  }

  /** Số hồ sơ đang dùng từng document type, gộp một truy vấn (cho màn Admin). */
  async docTypeUsage(): Promise<Record<string, number>> {
    const rows = await this.prisma.ticket.groupBy({ by: ['documentType'], _count: { _all: true } })
    const out: Record<string, number> = {}
    for (const r of rows) if (r.documentType) out[r.documentType] = r._count._all
    return out
  }

  count(kind: string): Promise<number> {
    return this.prisma.optionItem.count({ where: { kind } })
  }

  /** Active document types (kèm flow) cho form tạo hồ sơ + màn Danh mục. */
  listActiveDocTypes(): Promise<OptionRow[]> {
    return this.prisma.optionItem.findMany({
      where: { kind: DOC_TYPE_KIND, active: true },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    })
  }

  /** MỌI document type (kể cả đã ẩn) — chỉ màn Admin quản lý mới cần thấy loại ẩn. */
  listDocTypes(): Promise<OptionRow[]> {
    return this.prisma.optionItem.findMany({
      where: { kind: DOC_TYPE_KIND },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    })
  }

  /** Xoá hẳn một giá trị — chỉ dùng cho document type CHƯA có hồ sơ nào tham chiếu
   *  (use-case tự chặn usedBy>0); loại đang dùng phải ẩn, không xoá. */
  async deleteById(id: string): Promise<void> {
    await this.prisma.optionItem.delete({ where: { id } })
  }

  async createDocType(value: string, flow: string): Promise<OptionRow> {
    const max = await this.prisma.optionItem.aggregate({
      where: { kind: DOC_TYPE_KIND },
      _max: { sortOrder: true },
    })
    return this.prisma.optionItem.create({
      data: { kind: DOC_TYPE_KIND, value, flow, sortOrder: (max._max.sortOrder ?? 0) + 1, active: true },
    })
  }

  /** Luồng của một document type (active) — nguồn suy luồng khi tạo hồ sơ. */
  async flowForDocType(value: string): Promise<string | null> {
    const row = await this.prisma.optionItem.findUnique({
      where: { kind_value: { kind: DOC_TYPE_KIND, value } },
    })
    return row && row.active ? row.flow : null
  }

  /** Loại ĐÃ BỊ ẨN (row tồn tại nhưng active=false) — để FlowResolver phân biệt với
   *  loại chưa từng có trong catalog (fallback built-in): ẩn thì từ chối tạo mới. */
  async isDocTypeHidden(value: string): Promise<boolean> {
    const row = await this.prisma.optionItem.findUnique({
      where: { kind_value: { kind: DOC_TYPE_KIND, value } },
    })
    return !!row && !row.active
  }
}
