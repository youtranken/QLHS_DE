/** Cross-feature strings: relative-time units, generic buttons, fallbacks. */
export const common = {
  actions: {
    cancel: 'Hủy',
    close: 'Đóng',
    confirm: 'Xác nhận',
  },
  confirm: {
    title: 'Xác nhận',
    reasonLabel: 'Lý do',
    reasonPlaceholder: 'Nêu lý do (bắt buộc)…',
  },
  toasts: {
    regionAria: 'Thông báo',
  },
  states: {
    loading: 'Đang tải…',
    retry: 'Thử lại',
  },
  select: {
    noOptions: '— Không có lựa chọn —',
  },
  datePicker: {
    choose: 'Chọn ngày',
    clear: 'Bỏ chọn ngày',
    prev: 'Tháng trước',
    next: 'Tháng sau',
  },
  time: {
    justNow: 'vừa xong',
    minutes: '{n} phút',
    hours: '{n} giờ',
    days: '{n} ngày',
    minutesAgo: '{n} phút trước',
    hoursAgo: '{n} giờ trước',
    daysAgo: '{n} ngày trước',
  },
} as const
