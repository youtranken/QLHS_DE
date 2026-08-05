/** Khối trả lời có cấu trúc — FE dựng lại bằng component sẵn có (SLA badge, bảng). */

export interface TicketRowVM {
  code: string | null
  flow: string
  status: string
  priority?: string
  overdueDays?: number
  contractor?: string | null
  unseen?: boolean
}

export interface ActionVM {
  label: string
  toStatus: string
}

export interface NotificationVM {
  code: string | null
  kind: string
  createdAt: string
  read: boolean
}

export interface StatVM {
  label: string
  value: number | string
}

/** Dòng danh sách chung (tạm dừng / nhật ký): tiêu đề + phụ đề + mã tuỳ chọn. */
export interface LineVM {
  primary: string
  secondary?: string
  code?: string | null
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'empty'; text: string }
  | { type: 'ticketList'; rows: TicketRowVM[]; note?: string }
  | {
      type: 'ticketDetail'
      code: string | null
      flow: string
      status: string
      priority: string
      overdueDays: number
      paused: boolean
      isClosed: boolean
      documentType: string | null
    }
  | { type: 'actions'; code: string | null; status: string; actions: ActionVM[] }
  | { type: 'notifications'; items: NotificationVM[]; unread: number }
  | { type: 'stats'; title?: string; items: StatVM[] }
  | { type: 'lines'; title?: string; items: LineVM[] }

export interface AnswerPayload {
  blocks: Block[]
}
