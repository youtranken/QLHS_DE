import { ROLE, type Role } from '@qlhs/contracts'
import { TOOL, type Chip } from './types'

const CHIPS: Record<string, Chip> = {
  [TOOL.MyTickets]: { label: 'Hồ sơ của tôi', text: 'hồ sơ của tôi' },
  [TOOL.Notifications]: { label: 'Thông báo chưa đọc', text: 'thông báo chưa đọc' },
  [TOOL.TicketDetail]: { label: 'Chi tiết một hồ sơ', text: 'chi tiết hồ sơ G-2026-0001' },
  [TOOL.WhatsNext]: { label: 'Bước tiếp theo', text: 'hồ sơ G-2026-0001 bước tiếp theo là gì' },
  [TOOL.Workbox]: { label: 'Việc của tôi', text: 'việc của tôi cần xử lý' },
  [TOOL.DispatchMap]: { label: 'Bản đồ tuyến', text: 'bản đồ tuyến hồ sơ' },
  [TOOL.ClosedLookup]: { label: 'Hồ sơ đã đóng', text: 'tra cứu hồ sơ đã đóng' },
  [TOOL.Overview]: { label: 'Tổng quan hệ thống', text: 'tổng quan hệ thống' },
  [TOOL.Analytics]: { label: 'Thống kê', text: 'thống kê tháng này' },
  [TOOL.Paused]: { label: 'Đang tạm dừng SLA', text: 'hồ sơ đang tạm dừng SLA' },
  [TOOL.Audit]: { label: 'Nhật ký thao tác', text: 'nhật ký thao tác gần đây' },
}

export function chipFor(tool: string): Chip {
  return CHIPS[tool] ?? { label: tool, text: tool }
}

// Chip phải là câu trợ lý ĐÁP ỨNG ĐƯỢC. "đang mở" lọc theo openOnly (khả thi);
// KHÔNG dùng "đang trễ" vì list-my-tickets không mang SLA (review D1).
const OPEN_CHIP: Chip = { label: 'Hồ sơ đang mở', text: 'hồ sơ của tôi đang mở' }

/** Chip khởi tạo/khi không hiểu — theo vai (không gợi ý tool ngoài quyền). */
export function defaultSuggestions(activeRole: Role | null): Chip[] {
  if (activeRole === ROLE.Admin) {
    return [chipFor(TOOL.Overview), chipFor(TOOL.Analytics), chipFor(TOOL.Paused)]
  }
  if (activeRole === ROLE.Dcc1 || activeRole === ROLE.Dcc2 || activeRole === ROLE.Dcc3) {
    return [chipFor(TOOL.Workbox), chipFor(TOOL.DispatchMap), chipFor(TOOL.Notifications)]
  }
  return [chipFor(TOOL.MyTickets), chipFor(TOOL.Notifications), OPEN_CHIP]
}
