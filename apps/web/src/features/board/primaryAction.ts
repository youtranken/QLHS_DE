import { TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { t } from '../../i18n'
import { PAUSE_EVENT, RESUME_EVENT } from './slaPauseActions'
import type { LegalAction } from './api'

// Ở ⋯ (không lên nút chính): mọi hành động LÙI / cần lý do (Trả lại, Mở lại) và
// điều khiển đồng hồ SLA. reasonRequired đã phủ SendBack/Reopen/__return/pause;
// chỉ còn resume phải liệt kê tay.
const MENU_ONLY = new Set<string>([PAUSE_EVENT, RESUME_EVENT])
// Ngoại lệ: SubmitToBop tuy reasonRequired (kèm ghi chú cho BOP) vẫn là bước TIẾN
// nên lên nút chính — chỉ mở modal nhập lý do như thường, không bị đẩy xuống ⋯.
const PRIMARY_REASON = new Set<string>([TICKET_EVENT.SubmitToBop])
// Phòng thủ (allowlist theo đích): mọi hành động dẫn tới trạng thái LÙI/HỦY luôn
// ở ⋯ — chặn một event tương lai reasonRequired:false-nhưng-phá-huỷ (vd Cancel)
// tự leo lên nút chính chỉ vì lọt denylist sự-kiện.
const BACK_STATUS = new Set<string>([TICKET_STATUS.Returned, TICKET_STATUS.Cancelled])

/**
 * Tách danh sách hành động hợp lệ của một thẻ thành nút-chính (bước tiến an toàn,
 * 1 chạm) và mục ⋯. KHÔNG đụng guard nào — chỉ sắp xếp lại đúng danh sách server
 * đã suy từ state machine (AD-17); nút chính vẫn gọi cùng onAction + modal như cũ.
 * Chỉ ga General "Trình Sếp" cho >1 nút (Hoàn tất / Trình BOP) — mọi ga khác 1 nút.
 */
export function splitActions(actions: LegalAction[]): { primary: LegalAction[]; menu: LegalAction[] } {
  const primary: LegalAction[] = []
  const menu: LegalAction[] = []
  for (const a of actions) {
    const forcedMenu =
      (a.reasonRequired && !PRIMARY_REASON.has(a.event)) ||
      MENU_ONLY.has(a.event) ||
      BACK_STATUS.has(a.toStatus)
    if (forcedMenu) menu.push(a)
    else primary.push(a)
  }
  return { primary, menu }
}

// Nhãn NGẮN cho nút chính (menu ⋯ vẫn giữ nhãn đầy đủ của server).
const SHORT: Record<string, () => string> = {
  __pick: () => t('board.primary.pick'),
  [TICKET_EVENT.AndyApproveComplete]: () => t('board.primary.andyComplete'),
  [TICKET_EVENT.AndyRequireBop]: () => t('board.primary.andyBop'),
  [TICKET_EVENT.SendToAccounting]: () => t('board.primary.sendAccounting'),
  [TICKET_EVENT.CompleteContract]: () => t('board.primary.completeContract'),
  [TICKET_EVENT.SubmitToBop]: () => t('board.primary.submitBop'),
}

export const primaryLabel = (a: LegalAction): string => SHORT[a.event]?.() ?? a.label
