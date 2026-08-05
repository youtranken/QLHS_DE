/** Admin overview: KPIs, line health, recent activity, to-do card. */
export const adminOverview = {
  title: 'Tổng quan quản trị',
  loadError: 'Không tải được tổng quan — thử lại sau.',
  loading: 'Đang tải tổng quan…',
  // Shared by the overdue KPI breakdown and the overdue to-do line.
  overdueBreak: '▲{n} {flow}',
  mailPending: '{n} email chờ gửi',
  tasks: {
    title: 'Việc cần làm',
    overdueTitle: '{n} hồ sơ quá SLA',
    overdueFallbackSub: 'kiểm tra ngưỡng SLA',
    pausedTitle: '{n} hồ sơ đang dừng đồng hồ SLA',
    pausedSub: 'xem lý do · ai dừng · bao lâu',
    mailSub: 'hàng đợi thông báo',
    auditTitle: 'Xem nhật ký hệ thống',
    auditSub: '{n} sự kiện hôm nay',
  },
  kpis: {
    usersAria: 'Người dùng — mở quản trị vai',
    users: 'Người dùng',
    usersSub: '{n} giữ vai DCC/Admin',
    running: 'Hồ sơ đang chạy',
    runningSub: 'trên cả 3 tuyến',
    overdue: 'Quá SLA hôm nay',
    overdueNone: 'không có hồ sơ quá hạn',
    auditToday: 'Sự kiện audit hôm nay',
  },
  lines: {
    title: 'Luồng hồ sơ',
    running: '{n} hồ sơ đang chạy',
    railAria: '{flow} {pct}% đúng hạn',
    railAriaOverdue: ', {n} quá hạn',
    onTimePct: '{pct}% đúng hạn',
    overdueFlag: '▲{n}',
    okFlag: 'ổn',
  },
  recent: {
    title: 'Hoạt động gần đây',
    empty: 'Chưa có sự kiện nào.',
    viewAll: 'Xem toàn bộ nhật ký',
  },
} as const
