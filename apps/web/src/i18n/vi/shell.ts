/** App shell: topbar, brand, theme, clock, role-less warning, DCC home tag. */
export const shell = {
  loading: 'Đang tải…',
  brand: {
    tagline: 'Quản lý hồ sơ',
  },
  topbar: {
    homeAria: 'Về bảng Hồ sơ',
    brandSuffix: '· Hồ sơ',
    logout: 'Thoát',
  },
  // Nhãn vai hiển thị dưới tên trong card người dùng (sidebar Admin + header board).
  roleLabel: {
    Admin: 'Quản trị viên',
    Applicant: 'Nhân viên',
    DCC1: 'Admin1',
    DCC2: 'Admin2',
    DCC3: 'Admin3',
  },
  // Split around <b> — keep the leading/trailing spacing bytes intact.
  roleWarn: {
    prefix: 'Tài khoản của bạn ',
    noRole: 'chưa được gán vai',
    suffix: '. Vui lòng liên hệ Admin để được cấp quyền.',
  },
  // Leading " · " is part of the string: rendered right after the role tag.
  dccHome: {
    allLines: ' · Cả 3 tuyến',
    lineContract: ' · Tuyến B — Hợp đồng',
    linePayment: ' · Tuyến C — Thanh toán',
    hideMap: 'Thu gọn bản đồ',
    showMap: 'Hiện bản đồ tuyến',
    mapRegion: 'Bản đồ tuyến điều độ',
  },
  themeToggle: {
    aria: 'Đổi nền sáng/tối',
    toDark: 'Dark',
    toLight: 'Light',
  },
  localeToggle: {
    aria: 'Chuyển ngôn ngữ Việt / English',
  },
  clock: {
    // Comma-joined Sun→Sat; Clock splits at render so a locale switch re-evaluates.
    dow: 'CN,T2,T3,T4,T5,T6,T7',
  },
} as const
