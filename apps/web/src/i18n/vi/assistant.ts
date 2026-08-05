/** Trợ lý nội bộ (AssistantPanel) — chrome/chip/lỗi/nhãn thẻ do client sở hữu.
 *  TEXT của block do server trả (backend), không nằm ở đây. `starters.*` chỉ là
 *  NHÃN hiển thị; câu truy vấn (Chip.text) giữ tiếng Việt vì intent-engine no-LLM
 *  chỉ hiểu tiếng Việt — dịch sang EN sẽ vỡ nhận dạng ý định. */
export const assistant = {
  name: 'Trợ lý QLHS',
  online: 'Trực tuyến',
  clearChat: 'Xoá đoạn chat',
  close: 'Đóng',
  looking: 'Đang tra cứu',
  placeholder: 'Nhập câu hỏi…',
  questionLabel: 'Câu hỏi',
  send: 'Gửi',
  welcome:
    'Chào {who} 👋 Mình là trợ lý QLHS. Hỏi tự nhiên (vd “hồ sơ của tôi đang mở”, “chi tiết G-2026-0001”) hoặc chọn nhanh bên dưới.',
  welcomeYou: 'bạn',
  error: 'Có lỗi khi tra cứu, bạn thử lại nhé.',
  starters: {
    adminOverview: 'Tổng quan hệ thống',
    adminStats: 'Thống kê',
    adminPaused: 'Đang tạm dừng SLA',
    dccMine: 'Việc của tôi',
    dccMap: 'Bản đồ tuyến',
    unread: 'Thông báo chưa đọc',
    myTickets: 'Hồ sơ của tôi',
    myOpen: 'Hồ sơ đang mở',
  },
  card: {
    thCode: 'Mã',
    thFlow: 'Luồng',
    thStatus: 'Trạng thái',
    thType: 'Loại',
    nextStep: 'Bước tiếp theo cho',
    late: 'trễ {n}n',
    onTime: 'trong hạn',
    paused: 'tạm dừng',
    closed: 'đã đóng',
  },
} as const
